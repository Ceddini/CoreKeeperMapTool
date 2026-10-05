import { MapPartsScanner, ScanError } from './scanner.ts';
import { decodePng } from './png.ts';
import { CELLS, MapModel, chunkKey, type Chunk, type ChunkKey } from '../model/map-model.ts';
import { IngestError, type IngestWarning } from '../../core/errors.ts';

export interface IngestProgress {
  phase: 'read' | 'decode';
  loaded: number;
  total: number;
}

export interface IngestOptions {
  signal?: AbortSignal;
  /** Keep chunks whose hash did not change (live refresh). */
  incremental?: boolean;
  fileName?: string;
  onProgress?(p: IngestProgress): void;
  /** Called with batches of new or changed chunks while decoding (before block flags exist). */
  onChunks?(chunks: Chunk[]): void;
}

export interface IngestResult {
  changed: ChunkKey[];
  removed: ChunkKey[];
  /** Chunks whose block flags changed after the final pass (re-upload these). */
  reflagged: ChunkKey[];
  warnings: IngestWarning[];
  partCount: number;
}

const DECODE_CONCURRENCY = 8;
const FLUSH_MS = 50;

/** Gzip magic or a raw JSON object. */
async function openStream(source: Blob, onRead: (n: number) => void): Promise<ReadableStream<Uint8Array>> {
  const head = new Uint8Array(await source.slice(0, 2).arrayBuffer());
  if (head.length === 0) throw new IngestError('empty-file');
  const counting = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctl) {
      onRead(chunk.byteLength);
      ctl.enqueue(chunk);
    },
  });
  const raw = source.stream().pipeThrough(counting);
  if (head[0] === 0x1f && head[1] === 0x8b) {
    if (typeof DecompressionStream === 'function') {
      return raw.pipeThrough(
        new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>,
      );
    }
    const { Gunzip } = await import('fflate');
    return raw.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        start(ctl) {
          (this as { g?: InstanceType<typeof Gunzip> }).g = new Gunzip((data) => ctl.enqueue(data));
        },
        transform(chunk) {
          (this as unknown as { g: InstanceType<typeof Gunzip> }).g.push(chunk);
        },
        flush() {
          (this as unknown as { g: InstanceType<typeof Gunzip> }).g.push(new Uint8Array(0), true);
        },
      }),
    );
  }
  // Uncompressed JSON (some servers or tools store it that way).
  if (head[0] === 0x7b || head[0] === 0x20 || head[0] === 0x0a) return raw;
  throw new IngestError('not-gzip');
}

export async function ingest(source: Blob, model: MapModel, opts: IngestOptions = {}): Promise<IngestResult> {
  const { signal } = opts;
  const total = source.size;
  let read = 0;
  let lastProgress = 0;
  const report = (phase: IngestProgress['phase'], force = false) => {
    const now = performance.now();
    if (!force && now - lastProgress < 100) return;
    lastProgress = now;
    opts.onProgress?.({ phase, loaded: read, total });
  };

  const stream = await openStream(source, (n) => {
    read += n;
    report('read');
  });

  const keys: { x: number; y: number }[] = [];
  const pendingParts = new Map<number, { png: Uint8Array | null; hash: number; ts: Uint8Array | null }>();
  const seen = new Set<ChunkKey>();
  const changed: ChunkKey[] = [];
  const warnings: IngestWarning[] = [];
  let partCount = 0;
  let firstByteChecked = false;

  const queue: { cx: number; cy: number; png: Uint8Array; hash: number; ts: Uint8Array | null }[] = [];
  const running = new Set<Promise<void>>();
  let batch: Chunk[] = [];
  let lastFlush = performance.now();
  const flush = (force = false) => {
    if (batch.length && (force || performance.now() - lastFlush > FLUSH_MS)) {
      opts.onChunks?.(batch);
      batch = [];
      lastFlush = performance.now();
    }
  };

  const decodeOne = async (job: (typeof queue)[number]) => {
    try {
      const { width, height, rgba } = await decodePng(job.png);
      if (width !== 256 || height !== 256) throw new Error(`unexpected size ${width}×${height}`);
      const cells = new Uint16Array(CELLS);
      model.palette.indexPixels(rgba, cells);
      const chunk: Chunk = { key: chunkKey(job.cx, job.cy), cx: job.cx, cy: job.cy, hash: job.hash, cells };
      if (job.ts) chunk.ts = job.ts;
      model.set(chunk);
      changed.push(chunk.key);
      batch.push(chunk);
      flush();
    } catch (e) {
      if (e instanceof RangeError && e.message === 'too-many-colors')
        throw new IngestError('too-many-colors');
      warnings.push({ kind: 'corrupt-part', cx: job.cx, cy: job.cy, reason: (e as Error).message });
    }
  };

  const pump = async (drainAll: boolean) => {
    while (queue.length && running.size < DECODE_CONCURRENCY) {
      const job = queue.shift()!;
      const p = decodeOne(job).finally(() => running.delete(p));
      running.add(p);
    }
    if (drainAll) {
      while (running.size || queue.length) {
        await Promise.race(running);
        while (queue.length && running.size < DECODE_CONCURRENCY) {
          const job = queue.shift()!;
          const p = decodeOne(job).finally(() => running.delete(p));
          running.add(p);
        }
      }
    } else if (queue.length > 32) {
      await Promise.race(running);
    }
  };

  const accept = (index: number, png: Uint8Array | null, hash: number, ts: Uint8Array | null = null) => {
    const k = keys[index];
    if (!k) {
      pendingParts.set(index, { png, hash, ts });
      return;
    }
    partCount++;
    if (!png) return;
    const key = chunkKey(k.x, k.y);
    if (seen.has(key)) return;
    seen.add(key);
    const existing = model.chunks.get(key);
    if (opts.incremental && existing && existing.hash === hash) return;
    queue.push({ cx: k.x, cy: k.y, png: png.slice(), hash, ts: ts ? ts.slice() : null });
  };

  const scanner = new MapPartsScanner({
    key(index, x, y) {
      keys[index] = { x, y };
      const pending = pendingParts.get(index);
      if (pending) {
        pendingParts.delete(index);
        accept(index, pending.png, pending.hash, pending.ts);
      }
    },
    part: accept,
  });

  if (!opts.incremental) model.clear();

  const reader = stream.getReader();
  try {
    for (;;) {
      if (signal?.aborted) throw new IngestError('aborted');
      const { value, done } = await reader.read();
      if (done) break;
      if (!firstByteChecked && value.length) {
        firstByteChecked = true;
        const first = value.find((b) => b !== 0x20 && b !== 0x0a && b !== 0x0d && b !== 0x09);
        if (first !== undefined && first !== 0x7b) {
          throw new IngestError(
            'wrong-file',
            /\.world(\.gzip)?$/i.test(opts.fileName ?? '') ? 'world' : 'unknown',
          );
        }
      }
      scanner.push(value);
      await pump(false);
    }
    scanner.end();
  } catch (e) {
    reader.cancel().catch(() => {});
    if (e instanceof IngestError) throw e;
    if (e instanceof ScanError) {
      throw new IngestError(
        e.message === 'Not a map file' ? 'wrong-file' : 'truncated',
        /\.world(\.gzip)?$/i.test(opts.fileName ?? '') ? 'world' : undefined,
      );
    }
    // Decompression errors (corrupt or partially written gzip).
    throw new IngestError('truncated');
  }
  report('decode', true);
  await pump(true);
  if (signal?.aborted) throw new IngestError('aborted');
  flush(true);

  const removed: ChunkKey[] = [];
  for (const key of [...model.chunks.keys()]) {
    if (!seen.has(key)) {
      model.delete(key);
      removed.push(key);
    }
  }
  if (model.chunks.size === 0) throw new IngestError('empty-map');

  // Block flags need neighbours, so they are computed once all chunks are known.
  const reflag = model.neighbourhood([...changed, ...removed]);
  const reflagged = [...reflag].filter((k) => model.chunks.has(k));
  model.computeBlockFlags(reflagged);

  return { changed, removed, reflagged, warnings, partCount };
}
