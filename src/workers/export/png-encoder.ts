/** Streaming RGBA PNG encoder: rows are compressed as they arrive, so memory stays bounded. */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(parts: Uint8Array[]): number {
  let c = 0xffffffff;
  for (const p of parts) for (let i = 0; i < p.length; i++) c = CRC_TABLE[(c ^ p[i]!) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  const typeBytes = new TextEncoder().encode(type);
  out.set(typeBytes, 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32([typeBytes, data]));
  return out;
}

export class PngEncoder {
  private readonly parts: BlobPart[] = [];
  private readonly writer: { write(b: Uint8Array): Promise<void>; close(): Promise<void> };
  private readonly done: Promise<void>;
  private readonly width: number;

  constructor(width: number, height: number) {
    this.width = width;
    const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = new Uint8Array(13);
    const v = new DataView(ihdr.buffer);
    v.setUint32(0, width);
    v.setUint32(4, height);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    this.parts.push(sig, chunk('IHDR', ihdr));

    const cs = new CompressionStream('deflate');
    const w = cs.writable.getWriter();
    this.writer = { write: (b) => w.write(b as unknown as BufferSource), close: () => w.close() };
    this.done = (async () => {
      const reader = cs.readable.getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        this.parts.push(chunk('IDAT', value as Uint8Array));
      }
    })();
  }

  /** Append rows of RGBA pixels (row-major, `rows * width * 4` bytes). */
  async writeRows(rgba: Uint8Array, rows: number): Promise<void> {
    const stride = this.width * 4;
    const buf = new Uint8Array(rows * (stride + 1));
    for (let r = 0; r < rows; r++) {
      buf[r * (stride + 1)] = 0; // filter: none
      buf.set(rgba.subarray(r * stride, (r + 1) * stride), r * (stride + 1) + 1);
    }
    await this.writer.write(buf);
  }

  async finish(): Promise<Blob> {
    await this.writer.close();
    await this.done;
    this.parts.push(chunk('IEND', new Uint8Array(0)));
    return new Blob(this.parts, { type: 'image/png' });
  }
}
