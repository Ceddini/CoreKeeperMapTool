/** World tile coordinates: x east, y north; the Core is at (0, 0). Screen coordinates are CSS px, y down. */
export interface Camera {
  /** World position at the viewport centre. */
  x: number;
  y: number;
  /** CSS pixels per tile. */
  zoom: number;
}

export const MIN_ZOOM = 1 / 32;
export const MAX_ZOOM = 48;

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

export interface Viewport {
  width: number;
  height: number;
}

export function screenToWorld(cam: Camera, vp: Viewport, sx: number, sy: number): [number, number] {
  return [cam.x + (sx - vp.width / 2) / cam.zoom, cam.y - (sy - vp.height / 2) / cam.zoom];
}

export function worldToScreen(cam: Camera, vp: Viewport, wx: number, wy: number): [number, number] {
  return [(wx - cam.x) * cam.zoom + vp.width / 2, (cam.y - wy) * cam.zoom + vp.height / 2];
}

/** Zoom by `factor` keeping the world point under screen position (sx, sy) fixed. */
export function zoomAt(cam: Camera, vp: Viewport, factor: number, sx: number, sy: number): Camera {
  const zoom = clampZoom(cam.zoom * factor);
  const [wx, wy] = screenToWorld(cam, vp, sx, sy);
  return {
    zoom,
    x: wx - (sx - vp.width / 2) / zoom,
    y: wy + (sy - vp.height / 2) / zoom,
  };
}

/** Camera that fits the world rectangle into the viewport with some padding. */
export function fitBounds(
  vp: Viewport,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  pad = 32,
): Camera {
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const zoom = clampZoom(Math.min((vp.width - pad * 2) / w, (vp.height - pad * 2) / h));
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom };
}
