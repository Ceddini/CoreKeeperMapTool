/**
 * Generates the PWA / touch icons from src/assets/logo.png with nearest-neighbour scaling
 * (keeps the pixel art crisp) on a parchment background. Run once: node scripts/make-icons.ts
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { decodePng } from '../src/workers/ingest/png.ts';
import { PngEncoder } from '../src/workers/export/png-encoder.ts';

const BG: [number, number, number] = [0xf4, 0xef, 0xe6];

async function make(size: number, contentRatio: number, out: string): Promise<void> {
  const src = await decodePng(new Uint8Array(await readFile('src/assets/logo.png')));
  const px = new Uint8Array(size * size * 4);
  const content = Math.round(size * contentRatio);
  const off = Math.round((size - content) / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      let [r, g, b] = BG;
      const cx = x - off;
      const cy = y - off;
      if (cx >= 0 && cy >= 0 && cx < content && cy < content) {
        const sx = Math.floor((cx / content) * src.width);
        const sy = Math.floor((cy / content) * src.height);
        const so = (sy * src.width + sx) * 4;
        const a = src.rgba[so + 3]! / 255;
        r = Math.round(src.rgba[so]! * a + r * (1 - a));
        g = Math.round(src.rgba[so + 1]! * a + g * (1 - a));
        b = Math.round(src.rgba[so + 2]! * a + b * (1 - a));
      }
      px[o] = r;
      px[o + 1] = g;
      px[o + 2] = b;
      px[o + 3] = 255;
    }
  }
  const enc = new PngEncoder(size, size);
  await enc.writeRows(px, size);
  await writeFile(out, new Uint8Array(await (await enc.finish()).arrayBuffer()));
  console.log('wrote', out);
}

await mkdir('public/icons', { recursive: true });
await make(192, 0.8, 'public/icons/icon-192.png');
await make(512, 0.8, 'public/icons/icon-512.png');
// Maskable icons need the content inside the 80% safe zone.
await make(512, 0.6, 'public/icons/maskable-512.png');
await make(180, 0.8, 'public/icons/apple-touch-icon.png');
