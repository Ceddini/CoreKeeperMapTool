import type { ChunkUpload, ExportOptions, WorkerEvent, WorkerRequest } from '../core/rpc.ts';
import type { AppStore, FileInfo } from '../core/store.ts';
import type { WorldType } from '../data/schema.ts';
import type { SerializedIngestError } from '../core/errors.ts';

export interface RendererSink {
  reset(): void;
  chunks(chunks: ChunkUpload[]): void;
  removed(keys: number[]): void;
  palette(colors: Uint32Array, size: number): void;
}

type Pending = { resolve(ev: WorkerEvent): void; reject(err: unknown): void };

/** Main-thread facade for the map worker. */
export class MapService {
  private readonly worker: Worker;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private ingestId = 0;
  private exportProgress = new Map<number, (done: number, total: number) => void>();
  sink: RendererSink | null = null;
  private readonly store: AppStore;

  constructor(store: AppStore) {
    this.store = store;
    this.worker = new Worker(new URL('../workers/map.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<WorkerEvent>) => this.onEvent(e.data);
    this.worker.onerror = (e) => console.error('map worker error', e);
  }

  private send(req: WorkerRequest, transfer: Transferable[] = []): void {
    this.worker.postMessage(req, transfer);
  }

  private request<T extends WorkerEvent>(
    build: (id: number) => WorkerRequest,
    transfer: Transferable[] = [],
  ): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (ev: WorkerEvent) => void, reject });
      this.send(build(id), transfer);
    });
  }

  private onEvent(ev: WorkerEvent): void {
    switch (ev.type) {
      case 'palette':
        this.store.palette.value = { colors: ev.colors, size: ev.size };
        this.sink?.palette(ev.colors, ev.size);
        return;
      case 'reset':
        this.sink?.reset();
        return;
      case 'chunks':
        this.sink?.chunks(ev.chunks);
        return;
      case 'removed':
        this.sink?.removed(ev.keys);
        return;
      case 'progress':
        if (ev.id === this.ingestId)
          this.store.progress.value = { phase: ev.phase, loaded: ev.loaded, total: ev.total };
        return;
      case 'export-progress':
        this.exportProgress.get(ev.id)?.(ev.done, ev.total);
        return;
    }
    const id = 'id' in ev ? ev.id : -1;
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    if (ev.type === 'error') p.reject(ev.error);
    else p.resolve(ev);
  }

  /**
   * Load a map file. Full loads replace the map (the previous map is kept if the file fails);
   * incremental loads (live refresh) only apply changed parts and never surface transient errors.
   */
  async load(file: Blob, info: FileInfo, incremental = false): Promise<boolean> {
    const s = this.store;
    if (!incremental) {
      s.status.value = 'loading';
      s.error.value = null;
      s.progress.value = { phase: 'read', loaded: 0, total: file.size };
    }
    try {
      const ev = await this.request<Extract<WorkerEvent, { type: 'ingested' }>>((id) => {
        this.ingestId = id;
        return { type: 'ingest', id, file, fileName: info.name, incremental };
      });
      s.summary.value = ev.summary;
      s.file.value = info;
      s.updatedAt.value = Date.now();
      s.status.value = 'ready';
      s.progress.value = null;
      if (!incremental || ev.summary.changed > 0 || ev.summary.removed.length > 0)
        await this.refreshAnalysis();
      return true;
    } catch (err) {
      const e = err as SerializedIngestError;
      if (incremental) return false;
      s.progress.value = null;
      if (e.kind === 'aborted') {
        s.status.value = s.summary.peek() ? 'ready' : 'idle';
        return false;
      }
      s.error.value = err as AppStore['error']['value'];
      s.status.value = s.summary.peek() ? 'ready' : 'error';
      return false;
    }
  }

  cancel(): void {
    if (this.ingestId) this.send({ type: 'cancel', id: this.ingestId });
  }

  async refreshAnalysis(): Promise<void> {
    const world = this.store.settings.peek().world;
    const [stats, detected] = await Promise.all([
      this.request<Extract<WorkerEvent, { type: 'stats' }>>((id) => ({ type: 'stats', id })),
      this.detect(world),
    ]);
    this.store.stats.value = stats.stats;
    this.store.analysis.value = { zones: detected };
  }

  async detect(world: WorldType) {
    const ev = await this.request<Extract<WorkerEvent, { type: 'detected' }>>((id) => ({
      type: 'detect',
      id,
      world,
    }));
    return ev.zones;
  }

  async maze(stoneStartDeg: number) {
    return this.request<Extract<WorkerEvent, { type: 'maze' }>>((id) => ({
      type: 'maze',
      id,
      stoneStartDeg,
    }));
  }

  async points(lut: Uint8Array, limit: number) {
    const copy = lut.slice();
    return this.request<Extract<WorkerEvent, { type: 'points' }>>(
      (id) => ({ type: 'points', id, lut: copy, limit }),
      [copy.buffer],
    );
  }

  async probe(x: number, y: number): Promise<number> {
    const ev = await this.request<Extract<WorkerEvent, { type: 'probe' }>>((id) => ({
      type: 'probe',
      id,
      x,
      y,
    }));
    return ev.cell;
  }

  resendAll(): void {
    this.send({ type: 'chunks', id: 0, keys: 'all' });
  }

  async export(opts: ExportOptions, onProgress: (done: number, total: number) => void, signal?: AbortSignal) {
    const id = this.nextId;
    this.exportProgress.set(id, onProgress);
    signal?.addEventListener('abort', () => this.send({ type: 'cancel', id }));
    try {
      const ev = await this.request<Extract<WorkerEvent, { type: 'exported' }>>((i) => ({
        type: 'export',
        id: i,
        opts,
      }));
      return ev.blob;
    } finally {
      this.exportProgress.delete(id);
    }
  }
}
