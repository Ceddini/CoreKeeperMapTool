import type { ChunkUpload } from '../../core/rpc.ts';
import type { RenderState, Renderer } from '../renderer.ts';
import {
  CHUNK_FS,
  CHUNK_VS,
  MAX_MARKERS,
  MAX_RINGS,
  MAX_SECTORS,
  OVERLAY_FS,
  OVERLAY_VS,
  POINTS_FS,
  POINTS_VS,
} from './shaders.ts';

const PAGE_LAYERS = 64;
const PART = 256;
const PALETTE_W = 256;
const PALETTE_H = 128; // 32768 entries

interface Page {
  tex: WebGLTexture;
  free: number[];
}

interface Slot {
  page: number;
  layer: number;
  cx: number;
  cy: number;
}

type Uniforms = Record<string, WebGLUniformLocation | null>;

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost())
      throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(s)}`);
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost())
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(p)}`);
  return p;
}

function uniforms(gl: WebGL2RenderingContext, p: WebGLProgram, names: string[]): Uniforms {
  const u: Uniforms = {};
  for (const n of names) u[n] = gl.getUniformLocation(p, n);
  return u;
}

/** True if WebGL2 with the integer texture features we need is available. */
export function supportsWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

export class GlRenderer implements Renderer {
  readonly kind = 'webgl2' as const;
  private gl!: WebGL2RenderingContext;
  private chunkProg!: WebGLProgram;
  private overlayProg!: WebGLProgram;
  private pointsProg!: WebGLProgram;
  private cu!: Uniforms;
  private ou!: Uniforms;
  private pu!: Uniforms;
  private quad!: WebGLBuffer;
  private instBuf!: WebGLBuffer;
  private chunkVao!: WebGLVertexArrayObject;
  private overlayVao!: WebGLVertexArrayObject;
  private pointsVao!: WebGLVertexArrayObject;
  private pointsBuf!: WebGLBuffer;
  private pointCount = 0;
  private paletteTex!: WebGLTexture;
  private lutTex!: WebGLTexture;
  private mazeTex!: WebGLTexture;
  private mazeSize = 1;
  private pages: Page[] = [];
  /** Exploration-time textures, parallel to `pages` (same layer per chunk); created on demand. */
  private timePages: (WebGLTexture | null)[] = [];
  private slots = new Map<number, Slot>();
  private instData = new Float32Array(0);
  private lost = false;
  private readonly canvas: HTMLCanvasElement;
  private readonly onLost: () => void;
  private readonly onRestored: () => void;

  constructor(canvas: HTMLCanvasElement, handlers: { lost(): void; restored(): void }) {
    this.canvas = canvas;
    this.onLost = handlers.lost;
    this.onRestored = handlers.restored;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      this.onLost();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      this.init();
      this.onRestored();
    });
    this.init();
  }

  get isLost(): boolean {
    return this.lost;
  }

  private init(): void {
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('webgl2-unavailable');
    this.gl = gl;
    this.pages = [];
    this.timePages = [];
    this.slots.clear();
    this.pointCount = 0;

    this.chunkProg = compile(gl, CHUNK_VS, CHUNK_FS);
    this.cu = uniforms(gl, this.chunkProg, [
      'u_clipPerWorld',
      'u_cells',
      'u_palette',
      'u_lut',
      'u_hlActive',
      'u_dim',
      'u_custom',
      'u_tilesPerPx',
      'u_times',
      'u_timeMode',
      'u_timeCut',
    ]);
    this.overlayProg = compile(gl, OVERLAY_VS, OVERLAY_FS);
    this.ou = uniforms(gl, this.overlayProg, [
      'u_viewport',
      'u_camera',
      'u_pxPerTile',
      'u_ringCount',
      'u_rings',
      'u_ringColors',
      'u_sectorCount',
      'u_sectors',
      'u_sectorColors',
      'u_markerCount',
      'u_markers',
      'u_markerColors',
      'u_gridChunk',
      'u_gridMob',
      'u_maze',
      'u_mazeClasses',
      'u_mazeRadius',
      'u_hover',
      'u_segment',
      'u_segmentColor',
    ]);
    this.pointsProg = compile(gl, POINTS_VS, POINTS_FS);
    this.pu = uniforms(gl, this.pointsProg, [
      'u_camera',
      'u_clipPerWorld',
      'u_size',
      'u_palette',
      'u_override',
      'u_useOverride',
    ]);

    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    this.instBuf = gl.createBuffer()!;
    this.chunkVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.chunkVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 12, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);

    this.overlayVao = gl.createVertexArray()!;

    this.pointsBuf = gl.createBuffer()!;
    this.pointsVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.pointsVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointsBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.bindVertexArray(null);

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.paletteTex = this.makeTex2D(gl.RGBA8, PALETTE_W, PALETTE_H);
    this.lutTex = this.makeTex2D(gl.R8UI, PALETTE_W, PALETTE_H);
    this.mazeTex = this.makeTex2D(gl.R8UI, 1, 1);
    this.mazeSize = 1;
  }

  private makeTex2D(internal: number, w: number, h: number): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, internal, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  private newPage(): number {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.R16UI, PART, PART, PAGE_LAYERS);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.pages.push({ tex, free: Array.from({ length: PAGE_LAYERS }, (_, i) => PAGE_LAYERS - 1 - i) });
    return this.pages.length - 1;
  }

  clearChunks(): void {
    if (this.lost) return;
    for (const p of this.pages) this.gl.deleteTexture(p.tex);
    for (const t of this.timePages) if (t) this.gl.deleteTexture(t);
    this.pages = [];
    this.timePages = [];
    this.slots.clear();
  }

  private timePage(page: number): WebGLTexture {
    let tex = this.timePages[page];
    if (!tex) {
      const gl = this.gl;
      tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
      // texStorage zero-fills: chunks without times read as "unknown".
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.R16UI, PART, PART, PAGE_LAYERS);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      this.timePages[page] = tex;
    }
    return tex;
  }

  setTimes(chunks: readonly { key: number; times: Uint16Array }[] | null): void {
    if (this.lost) return;
    const gl = this.gl;
    if (!chunks) {
      for (const t of this.timePages) if (t) gl.deleteTexture(t);
      this.timePages = [];
      return;
    }
    for (const c of chunks) {
      const slot = this.slots.get(c.key);
      if (!slot) continue;
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.timePage(slot.page));
      gl.texSubImage3D(
        gl.TEXTURE_2D_ARRAY,
        0,
        0,
        0,
        slot.layer,
        PART,
        PART,
        1,
        gl.RED_INTEGER,
        gl.UNSIGNED_SHORT,
        c.times,
      );
    }
  }

  upsertChunks(chunks: readonly ChunkUpload[]): void {
    if (this.lost) return;
    const gl = this.gl;
    for (const c of chunks) {
      let slot = this.slots.get(c.key);
      if (!slot) {
        let page = this.pages.findIndex((p) => p.free.length > 0);
        if (page < 0) page = this.newPage();
        slot = { page, layer: this.pages[page]!.free.pop()!, cx: c.cx, cy: c.cy };
        this.slots.set(c.key, slot);
      }
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.pages[slot.page]!.tex);
      gl.texSubImage3D(
        gl.TEXTURE_2D_ARRAY,
        0,
        0,
        0,
        slot.layer,
        PART,
        PART,
        1,
        gl.RED_INTEGER,
        gl.UNSIGNED_SHORT,
        c.cells,
      );
    }
  }

  removeChunks(keys: readonly number[]): void {
    for (const k of keys) {
      const s = this.slots.get(k);
      if (!s) continue;
      this.pages[s.page]?.free.push(s.layer);
      this.slots.delete(k);
    }
  }

  get chunkCount(): number {
    return this.slots.size;
  }

  setPalette(colors: Uint32Array, size: number): void {
    if (this.lost) return;
    const data = new Uint8Array(PALETTE_W * PALETTE_H * 4);
    for (let i = 0; i < size; i++) {
      const c = colors[i]!;
      data[i * 4] = c >> 16;
      data[i * 4 + 1] = (c >> 8) & 255;
      data[i * 4 + 2] = c & 255;
      data[i * 4 + 3] = 255;
    }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, PALETTE_W, PALETTE_H, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  setHighlightLut(lut: Uint8Array): void {
    if (this.lost) return;
    const data = new Uint8Array(PALETTE_W * PALETTE_H);
    data.set(lut.subarray(0, data.length));
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, PALETTE_W, PALETTE_H, gl.RED_INTEGER, gl.UNSIGNED_BYTE, data);
  }

  setMazeMask(mask: Uint8Array | null, size: number): void {
    if (this.lost) return;
    const gl = this.gl;
    gl.deleteTexture(this.mazeTex);
    if (!mask) {
      this.mazeTex = this.makeTex2D(gl.R8UI, 1, 1);
      this.mazeSize = 1;
      return;
    }
    this.mazeTex = this.makeTex2D(gl.R8UI, size, size);
    this.mazeSize = size;
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size, size, gl.RED_INTEGER, gl.UNSIGNED_BYTE, mask);
  }

  /** Highlight positions as (x, y, paletteIndex) triples. */
  setPoints(points: Float32Array | null): void {
    if (this.lost) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointsBuf);
    gl.bufferData(gl.ARRAY_BUFFER, points ?? new Float32Array(0), gl.DYNAMIC_DRAW);
    this.pointCount = points ? points.length / 3 : 0;
  }

  render(s: RenderState): void {
    if (this.lost) return;
    const gl = this.gl;
    const W = Math.max(1, Math.round(s.width * s.dpr));
    const H = Math.max(1, Math.round(s.height * s.dpr));
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const pxPerTile = s.camera.zoom * s.dpr;
    // Snap the camera to whole device pixels when tiles are big, so edges stay crisp.
    let camX = s.camera.x;
    let camY = s.camera.y;
    if (pxPerTile >= 1) {
      camX = Math.round(camX * pxPerTile) / pxPerTile;
      camY = Math.round(camY * pxPerTile) / pxPerTile;
    }
    const clipX = (2 * pxPerTile) / W;
    const clipY = (2 * pxPerTile) / H;

    // Visible chunk range.
    const halfW = W / 2 / pxPerTile;
    const halfH = H / 2 / pxPerTile;
    const minCx = Math.floor((camX - halfW) / PART);
    const maxCx = Math.floor((camX + halfW) / PART);
    const minCy = Math.floor((camY - halfH) / PART);
    const maxCy = Math.floor((camY + halfH) / PART);

    // --- Chunks
    gl.useProgram(this.chunkProg);
    gl.uniform2f(this.cu.u_clipPerWorld!, clipX, clipY);
    gl.uniform1i(this.cu.u_cells!, 0);
    gl.uniform1i(this.cu.u_palette!, 1);
    gl.uniform1i(this.cu.u_lut!, 2);
    gl.uniform1i(this.cu.u_hlActive!, s.highlightActive ? 1 : 0);
    gl.uniform1f(this.cu.u_dim!, s.dim);
    gl.uniform3f(this.cu.u_custom!, ...s.customColor);
    gl.uniform1f(this.cu.u_tilesPerPx!, 1 / pxPerTile);
    const timeMode = this.timePages.length ? s.timeMode : 0;
    gl.uniform1i(this.cu.u_timeMode!, timeMode);
    gl.uniform1ui(this.cu.u_timeCut!, Math.max(0, Math.round(s.timeCut)));
    gl.uniform1i(this.cu.u_times!, 4);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.bindVertexArray(this.chunkVao);

    const perPage: number[][] = this.pages.map(() => []);
    for (const slot of this.slots.values()) {
      if (slot.cx < minCx || slot.cx > maxCx || slot.cy < minCy || slot.cy > maxCy) continue;
      perPage[slot.page]!.push(slot.cx * PART - camX, slot.cy * PART - camY, slot.layer);
    }
    gl.activeTexture(gl.TEXTURE0);
    perPage.forEach((list, page) => {
      if (!list.length) return;
      if (this.instData.length < list.length) this.instData = new Float32Array(list.length * 2);
      this.instData.set(list);
      if (timeMode) {
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.timePage(page));
        gl.activeTexture(gl.TEXTURE0);
      }
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.pages[page]!.tex);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.instData.subarray(0, list.length), gl.STREAM_DRAW);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, list.length / 3);
    });

    // --- Highlight points (zoomed out)
    if (s.points && this.pointCount > 0) {
      gl.useProgram(this.pointsProg);
      gl.uniform2f(this.pu.u_camera!, camX, camY);
      gl.uniform2f(this.pu.u_clipPerWorld!, clipX, clipY);
      gl.uniform1f(this.pu.u_size!, Math.max(pxPerTile + 2, 4 * s.dpr));
      gl.uniform1i(this.pu.u_palette!, 1);
      gl.uniform1i(this.pu.u_useOverride!, s.pointOverride ? 1 : 0);
      gl.uniform3f(this.pu.u_override!, ...(s.pointOverride ?? [1, 1, 1]));
      gl.bindVertexArray(this.pointsVao);
      gl.drawArrays(gl.POINTS, 0, this.pointCount);
    }

    // --- Overlay
    gl.useProgram(this.overlayProg);
    gl.bindVertexArray(this.overlayVao);
    const ou = this.ou;
    gl.uniform2f(ou.u_viewport!, W, H);
    gl.uniform2f(ou.u_camera!, camX, camY);
    gl.uniform1f(ou.u_pxPerTile!, pxPerTile);
    const rings = new Float32Array(MAX_RINGS * 4);
    const ringColors = new Float32Array(MAX_RINGS * 4);
    const sectors = new Float32Array(MAX_SECTORS * 4);
    const sectorColors = new Float32Array(MAX_SECTORS * 4);
    const markers = new Float32Array(MAX_MARKERS * 4);
    const markerColors = new Float32Array(MAX_MARKERS * 4);
    let nr = 0,
      ns = 0,
      nm = 0;
    let gridChunk: number[] = [0, 0, 0, 0];
    let gridMob: number[] = [0, 0, 0, 0];
    let segment: number[] = [0, 0, 0, 0];
    let segmentColor: number[] = [0, 0, 0, 0];
    const rad = Math.PI / 180;
    for (const p of s.primitives) {
      if (p.kind === 'ring' && nr < MAX_RINGS) {
        rings.set([p.r, p.halfWidth, 0, 0], nr * 4);
        ringColors.set(p.color, nr++ * 4);
      } else if (p.kind === 'sector' && ns < MAX_SECTORS) {
        sectors.set([p.r0, p.r1, (((p.startDeg % 360) + 360) % 360) * rad, p.spanDeg * rad], ns * 4);
        sectorColors.set(p.color, ns++ * 4);
      } else if (p.kind === 'marker' && nm < MAX_MARKERS) {
        markers.set([p.x, p.y, p.radius, 0], nm * 4);
        markerColors.set(p.color, nm++ * 4);
      } else if (p.kind === 'grid') {
        if (p.strong) gridChunk = p.color;
        else gridMob = p.color;
      } else if (p.kind === 'segment') {
        segment = [p.x0, p.y0, p.x1, p.y1];
        segmentColor = p.color;
      }
    }
    gl.uniform1i(ou.u_ringCount!, nr);
    gl.uniform4fv(ou.u_rings!, rings);
    gl.uniform4fv(ou.u_ringColors!, ringColors);
    gl.uniform1i(ou.u_sectorCount!, ns);
    gl.uniform4fv(ou.u_sectors!, sectors);
    gl.uniform4fv(ou.u_sectorColors!, sectorColors);
    gl.uniform1i(ou.u_markerCount!, nm);
    gl.uniform4fv(ou.u_markers!, markers);
    gl.uniform4fv(ou.u_markerColors!, markerColors);
    gl.uniform4fv(ou.u_gridChunk!, gridChunk);
    gl.uniform4fv(ou.u_gridMob!, gridMob);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.mazeTex);
    gl.uniform1i(ou.u_maze!, 3);
    gl.uniform1i(ou.u_mazeClasses!, this.mazeSize > 1 ? s.mazeClasses : 0);
    gl.uniform1f(ou.u_mazeRadius!, (this.mazeSize - 1) / 2);
    gl.uniform3f(ou.u_hover!, s.hover?.[0] ?? 0, s.hover?.[1] ?? 0, s.hover ? 1 : 0);
    gl.uniform4fv(ou.u_segment!, segment);
    gl.uniform4fv(ou.u_segmentColor!, segmentColor);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
