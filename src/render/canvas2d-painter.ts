import type { OverlayLabel, OverlayPrimitive, RGBA } from './overlay-scene.ts';

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Maps world tile coordinates to canvas pixels: px = (x - x0) * s, py = (y0 - y) * s. */
export interface PaintView {
  x0: number;
  y0: number;
  scale: number;
  width: number;
  height: number;
}

function css([r, g, b, a]: RGBA): string {
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
}

const toCanvasAngle = (deg: number) => ((deg - 90) * Math.PI) / 180;

export function paintOverlay(ctx: Ctx2D, view: PaintView, primitives: readonly OverlayPrimitive[]): void {
  const { x0, y0, scale: s } = view;
  const cx = (0 - x0) * s;
  const cy = (y0 - 0) * s;
  ctx.save();
  for (const p of primitives) {
    switch (p.kind) {
      case 'ring':
        ctx.strokeStyle = css(p.color);
        ctx.lineWidth = p.halfWidth * 2 * s;
        ctx.beginPath();
        ctx.arc(cx, cy, p.r * s, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'sector': {
        const a0 = toCanvasAngle(p.startDeg);
        const a1 = toCanvasAngle(p.startDeg + p.spanDeg);
        ctx.fillStyle = css(p.color);
        ctx.beginPath();
        ctx.arc(cx, cy, p.r1 * s, a0, a1, false);
        ctx.arc(cx, cy, p.r0 * s, a1, a0, true);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'grid': {
        if (p.spacing * s < 6) break; // too dense to be useful at this scale
        ctx.strokeStyle = css(p.color);
        ctx.lineWidth = Math.max(1, (p.strong ? 0.18 : 0.1) * s);
        ctx.beginPath();
        const minX = x0,
          maxX = x0 + view.width / s;
        const maxY = y0,
          minY = y0 - view.height / s;
        for (let x = Math.ceil(minX / p.spacing) * p.spacing; x <= maxX; x += p.spacing) {
          const px = Math.round((x - x0) * s) + 0.5;
          ctx.moveTo(px, 0);
          ctx.lineTo(px, view.height);
        }
        for (let y = Math.ceil(minY / p.spacing) * p.spacing; y <= maxY; y += p.spacing) {
          const py = Math.round((y0 - y) * s) + 0.5;
          ctx.moveTo(0, py);
          ctx.lineTo(view.width, py);
        }
        ctx.stroke();
        break;
      }
      case 'marker': {
        const px = (p.x - x0) * s;
        const py = (y0 - p.y) * s;
        ctx.strokeStyle = css(p.color);
        ctx.lineWidth = Math.max(2, 4 * s);
        ctx.beginPath();
        ctx.arc(px, py, p.radius * s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = css([p.color[0], p.color[1], p.color[2], 1]);
        ctx.beginPath();
        ctx.arc(px, py, Math.max(4, 1.5 * s), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }
  ctx.restore();
}

export function paintLabels(
  ctx: Ctx2D,
  view: PaintView,
  labels: readonly OverlayLabel[],
  fontPx: number,
): void {
  ctx.save();
  ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const l of labels) {
    const px = (l.x - view.x0) * view.scale;
    const py = (view.y0 - l.y) * view.scale;
    ctx.lineWidth = Math.max(3, fontPx / 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(l.text, px, py);
    ctx.fillStyle = '#fff';
    ctx.fillText(l.text, px, py);
  }
  ctx.restore();
}
