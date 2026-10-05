/**
 * Minimal PNG decoder for map parts. Returns exact RGBA bytes (no colour management or
 * premultiplication, which matters because tiles are identified by their exact colour).
 * Supports 8-bit RGBA and RGB, non-interlaced, which is what Core Keeper writes.
 */

export class PngError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PngError';
  }
}

export interface DecodedPng {
  width: number;
  height: number;
  /** RGBA, row 0 = top. */
  rgba: Uint8Array;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

type Inflate = (data: Uint8Array) => Promise<Uint8Array>;

let inflateImpl: Inflate | null = null;

async function nativeInflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** zlib inflate, native where available, fflate otherwise (lazy loaded). */
export async function inflateZlib(data: Uint8Array): Promise<Uint8Array> {
  if (!inflateImpl) {
    if (typeof DecompressionStream === 'function') inflateImpl = nativeInflate;
    else {
      const { unzlibSync } = await import('fflate');
      inflateImpl = async (d) => unzlibSync(d);
    }
  }
  return inflateImpl(data);
}

export async function decodePng(bytes: Uint8Array): Promise<DecodedPng> {
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIGNATURE[i]) throw new PngError('Not a PNG');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8;
  let width = 0,
    height = 0,
    colorType = -1;
  const idat: Uint8Array[] = [];
  let idatLen = 0;
  while (p + 8 <= bytes.length) {
    const len = view.getUint32(p);
    const type = String.fromCharCode(bytes[p + 4]!, bytes[p + 5]!, bytes[p + 6]!, bytes[p + 7]!);
    const data = bytes.subarray(p + 8, p + 8 + len);
    if (data.length !== len) throw new PngError('Truncated chunk');
    if (type === 'IHDR') {
      width = view.getUint32(p + 8);
      height = view.getUint32(p + 12);
      const depth = data[8];
      colorType = data[9]!;
      if (depth !== 8 || (colorType !== 6 && colorType !== 2) || data[12] !== 0)
        throw new PngError(`Unsupported PNG format (depth ${depth}, colour type ${colorType})`);
    } else if (type === 'IDAT') {
      idat.push(data);
      idatLen += len;
    } else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (!width || !height || idat.length === 0) throw new PngError('Missing image data');

  let compressed: Uint8Array;
  if (idat.length === 1) compressed = idat[0]!;
  else {
    compressed = new Uint8Array(idatLen);
    let o = 0;
    for (const d of idat) {
      compressed.set(d, o);
      o += d.length;
    }
  }
  const raw = await inflateZlib(compressed);
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  if (raw.length < (stride + 1) * height) throw new PngError('Truncated image data');
  const pixels = unfilter(raw, width, height, bpp);
  return { width, height, rgba: bpp === 4 ? pixels : rgbToRgba(pixels, width * height) };
}

function unfilter(raw: Uint8Array, width: number, height: number, bpp: number): Uint8Array {
  const stride = width * bpp;
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const prev = dst - stride;
    switch (filter) {
      case 0:
        out.set(raw.subarray(src, src + stride), dst);
        break;
      case 1:
        for (let x = 0; x < stride; x++)
          out[dst + x] = (raw[src + x]! + (x >= bpp ? out[dst + x - bpp]! : 0)) & 255;
        break;
      case 2:
        for (let x = 0; x < stride; x++) out[dst + x] = (raw[src + x]! + (y > 0 ? out[prev + x]! : 0)) & 255;
        break;
      case 3:
        for (let x = 0; x < stride; x++) {
          const a = x >= bpp ? out[dst + x - bpp]! : 0;
          const b = y > 0 ? out[prev + x]! : 0;
          out[dst + x] = (raw[src + x]! + ((a + b) >> 1)) & 255;
        }
        break;
      case 4:
        for (let x = 0; x < stride; x++) {
          const a = x >= bpp ? out[dst + x - bpp]! : 0;
          const b = y > 0 ? out[prev + x]! : 0;
          const c = x >= bpp && y > 0 ? out[prev + x - bpp]! : 0;
          const pa = Math.abs(b - c);
          const pb = Math.abs(a - c);
          const pc = Math.abs(a + b - 2 * c);
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          out[dst + x] = (raw[src + x]! + pred) & 255;
        }
        break;
      default:
        throw new PngError(`Unknown filter ${filter}`);
    }
  }
  return out;
}

function rgbToRgba(rgb: Uint8Array, count: number): Uint8Array {
  const out = new Uint8Array(count * 4);
  for (let i = 0, j = 0; i < count; i++, j += 3) {
    out[i * 4] = rgb[j]!;
    out[i * 4 + 1] = rgb[j + 1]!;
    out[i * 4 + 2] = rgb[j + 2]!;
    out[i * 4 + 3] = 255;
  }
  return out;
}
