import { computed, effect, signal, untracked } from '../core/signals.ts';
import { mapKey, patchSettings, type AppStore, type Spot } from '../core/store.ts';
import { tileById, tilesByRgb } from '../data/tiles.ts';
import { lang, poiName, t, tileName, tn } from '../i18n/i18n.ts';
import { exploreTimeToDate } from '../workers/analysis/timeline.ts';
import { clampZoom, fitBounds, screenToWorld, worldToScreen, zoomAt, type Camera } from '../render/camera.ts';
import { buildHighlightLut, lutIsActive, HL_CUSTOM } from '../render/highlight.ts';
import { buildOverlayScene, type OverlayLabel, type OverlayPrimitive } from '../render/overlay-scene.ts';
import { GlRenderer, supportsWebGL2 } from '../render/webgl/gl-renderer.ts';
import { C2dRenderer } from '../render/canvas2d/c2d-renderer.ts';
import type { Renderer } from '../render/renderer.ts';
import type { MapService } from '../services/map-service.ts';
import { MAZE_WINDOW } from '../core/constants.ts';
import { CLUSTER_STRIDE } from '../workers/analysis/clusters.ts';
import { BLOCK_FLAG, INDEX_MASK } from '../workers/model/palette.ts';
import type { TileDef, ZoneDef } from '../data/schema.ts';
import { h } from './dom.ts';
import { poiIconUrl } from './poi-icons.ts';

export interface MapView {
  el: HTMLElement;
  canvas: HTMLCanvasElement;
  /** `reveal`: centre the point in the part of the map not covered by an overlaying panel. */
  flyTo(x: number, y: number, zoom?: number, reveal?: boolean): void;
  zoomBy(factor: number): void;
  centerCore(): void;
  fit(): void;
  /** Rotations actually used for sectors (manual or detected). */
  rotations: () => Partial<Record<ZoneDef['id'], number>>;
  overlay(): ReturnType<typeof buildOverlayScene>;
  lut(): Uint8Array | null;
  onContextMenu: ((x: number, y: number, sx: number, sy: number) => void) | null;
  onPick: ((x: number, y: number, cell: number) => void) | null;
  /** Fly to a spot and pulse a ring around it. */
  focusSpot(spot: Spot): void;
}

/** Distance from a pin label's left edge to the centre of its dot (see .map-label--pin). */
const PIN_DOT_OFFSET = 11;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createMapView(store: AppStore, service: MapService): MapView {
  const canvas = h('canvas', {
    class: 'map-canvas',
    tabindex: '0',
    role: 'application',
    'aria-roledescription': () => t('map.roledescription'),
    'aria-label': () => t('map.label'),
    'aria-describedby': 'map-help',
  });
  const labelsLayer = h('div', { class: 'map-labels', 'aria-hidden': 'true' });
  const help = h('p', { id: 'map-help', class: 'visually-hidden' }, () => t('map.keyboardHelp'));
  const announcer = h('div', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
  const focusRing = h('div', { class: 'focus-ring', 'aria-hidden': 'true', hidden: true });
  const el = h('div', { class: 'map-view' }, canvas, labelsLayer, focusRing, help, announcer);
  let focused: { x0: number; y0: number; x1: number; y1: number; until: number } | null = null;

  const size = signal({ width: 1, height: 1, dpr: window.devicePixelRatio || 1 });
  /** Current size; measures directly if the ResizeObserver hasn't reported yet. */
  const viewport = () => {
    const s = size.peek();
    if (s.width > 1) return s;
    const r = el.getBoundingClientRect();
    if (r.width > 1) size.value = { width: r.width, height: r.height, dpr: window.devicePixelRatio || 1 };
    return size.peek();
  };
  let dirty = true;
  let raf = 0;
  let anim: { from: Camera; to: Camera; start: number; dur: number } | null = null;

  const makeGl = () =>
    new GlRenderer(canvas, {
      lost: () => {},
      restored: () => {
        renderer.setPalette(store.palette.peek().colors, store.palette.peek().size);
        service.resendAll();
        lutVersion.value++;
        mazeVersion.value++;
        request();
      },
    });
  let renderer: Renderer;
  try {
    renderer =
      supportsWebGL2() && !new URLSearchParams(location.search).has('canvas2d')
        ? makeGl()
        : new C2dRenderer(canvas);
  } catch {
    // WebGL 2 exists but failed to initialise (blocklisted driver, shader compile issue…).
    renderer = new C2dRenderer(canvas);
  }
  el.dataset.renderer = renderer.kind;

  service.sink = {
    reset: () => {
      renderer.clearChunks();
      request();
    },
    chunks: (c) => {
      renderer.upsertChunks(c);
      request();
    },
    removed: (k) => {
      renderer.removeChunks(k);
      request();
    },
    palette: (colors, n) => {
      renderer.setPalette(colors, n);
      request();
    },
  };

  function request(): void {
    dirty = true;
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // ---------- derived render state

  const rotations = computed(() => {
    const s = store.settings.value.sectors;
    if (s.manual) return { inner: s.inner, outer: s.outer };
    const out: Partial<Record<ZoneDef['id'], number>> = {};
    for (const z of store.analysis.value?.zones ?? []) out[z.zone] = z.rotationDeg;
    return out;
  });

  /** The ruler with its end point following the cursor while it is being placed. */
  const rulerLine = computed(() => {
    const r = store.ruler.value;
    if (!r) return null;
    const b =
      r.b ?? (store.hover.value ? ([store.hover.value.x, store.hover.value.y] as [number, number]) : null);
    return b ? { a: r.a, b } : null;
  });

  const baseScene = computed(() => {
    // Nothing to annotate until a map is loaded (keeps the empty state calm).
    if (!store.summary.value) return { primitives: [], labels: [] };
    const s = store.settings.value;
    return buildOverlayScene({
      world: s.world,
      pois: new Set(s.pois),
      cropToBiome: s.cropToBiome,
      sectors: { show: s.sectors.show, rotations: rotations.value },
      customRing: s.customRing,
      grids: s.grids,
      player: s.player,
      alpha: { rings: s.alpha.rings, sectors: s.alpha.sectors, grid: s.alpha.grid },
      poiName,
      playerLabel: t('layers.player.label'),
      pins: s.showPins ? (s.pins[mapKey(store) ?? ''] ?? []) : [],
    });
  });

  // The ruler changes with every mouse move, so it is added on top of the (cached) base scene.
  const scene = computed(() => {
    const base = baseScene.value;
    const line = rulerLine.value;
    if (!line) return base;
    const [ax, ay] = line.a;
    const [bx, by] = line.b;
    const segment: OverlayPrimitive = {
      kind: 'segment',
      x0: ax + 0.5,
      y0: ay + 0.5,
      x1: bx + 0.5,
      y1: by + 0.5,
      color: [1, 0.81, 0.44, 1],
    };
    const label: OverlayLabel = {
      id: 'ruler',
      x: (ax + bx) / 2 + 0.5,
      y: (ay + by) / 2 + 0.5,
      text: formatDistance(ax, ay, bx, by),
      color: '#ffcf70',
    };
    return { primitives: [...base.primitives, segment], labels: [label, ...base.labels] };
  });

  const lutVersion = signal(0);
  const lut = computed(() => {
    void lutVersion.value;
    const s = store.settings.value;
    const pal = store.palette.value;
    const selected = s.highlight.map((id) => tileById.get(id)).filter((x) => !!x);
    let l = buildHighlightLut(pal.colors, pal.size, selected, s.pickedColor);
    if (s.paint.on) l = l.map((f) => (f ? f | HL_CUSTOM : 0));
    return l;
  });
  const highlightActive = computed(() => lutIsActive(lut.value));

  effect(() => {
    renderer.setHighlightLut(lut.value);
    request();
  });

  // Points layer: positions of highlighted tiles, so single tiles stay visible zoomed out.
  let pointsReq = 0;
  effect(() => {
    const l = lut.value;
    const active = highlightActive.value;
    void store.summary.value;
    const id = ++pointsReq;
    if (!active) {
      renderer.setPoints(null);
      request();
      return;
    }
    void service.points(l, 400_000).then((ev) => {
      if (id !== pointsReq) return;
      renderer.setPoints(ev.points);
      request();
    });
  });

  // Exploration times: the summary is read after every load (for the inspector and the layer UI);
  // per-tile times only go to the GPU while the history layer is on.
  let timelineReq = 0;
  effect(() => {
    if (!store.summary.value) {
      store.timeline.value = null;
      return;
    }
    const id = ++timelineReq;
    void service.timeline(false).then((ev) => {
      if (id === timelineReq) store.timeline.value = ev.info;
    });
  });
  const historyOn = computed(() => store.history.value.on);
  let timesReq = 0;
  effect(() => {
    const on = historyOn.value;
    void store.summary.value;
    const id = ++timesReq;
    if (!on) {
      renderer.setTimes(null);
      request();
      return;
    }
    void service.timeline(true).then((ev) => {
      if (id !== timesReq) return;
      renderer.setTimes(ev.chunks);
      request();
    });
  });
  effect(() => {
    void store.history.value;
    void store.timeline.value;
    request();
  });

  // Spots (connected groups of highlighted tiles) for "nearest / next".
  let spotsReq = 0;
  let spotsTimer: ReturnType<typeof setTimeout> | undefined;
  effect(() => {
    const l = lut.value;
    const active = highlightActive.value;
    void store.summary.value;
    const id = ++spotsReq;
    clearTimeout(spotsTimer);
    if (!active) {
      store.spots.value = null;
      store.spotsBusy.value = false;
      return;
    }
    store.spotsBusy.value = true;
    spotsTimer = setTimeout(() => {
      void service.clusters(l).then((ev) => {
        if (id !== spotsReq) return;
        const all: Spot[] = [];
        for (let i = 0; i < ev.count; i++) {
          const o = i * CLUSTER_STRIDE;
          const c = ev.clusters;
          all.push({
            x: c[o]!,
            y: c[o + 1]!,
            count: c[o + 2]!,
            minX: c[o + 3]!,
            minY: c[o + 4]!,
            maxX: c[o + 5]!,
            maxY: c[o + 6]!,
          });
        }
        store.spots.value = { all, truncated: ev.truncated, index: -1 };
        store.spotsBusy.value = false;
      });
    }, 150);
  });

  // Maze holes.
  const mazeVersion = signal(0);
  const mazeOn = computed(() => {
    const m = store.settings.value.maze;
    return m.small || m.medium || m.large;
  });
  effect(() => {
    void mazeVersion.value;
    if (!mazeOn.value || !store.summary.value) return;
    const inner = rotations.value.inner;
    if (inner === undefined) return;
    store.mazeBusy.value = true;
    void service.maze(inner).then(
      (res) => {
        store.maze.value = { mask: res.mask, holes: res.holes };
        store.mazeBusy.value = false;
        renderer.setMazeMask(res.mask, MAZE_WINDOW);
        request();
      },
      () => (store.mazeBusy.value = false),
    );
  });
  const mazeClasses = computed(() => {
    const m = store.settings.value.maze;
    return (m.small ? 1 : 0) | (m.medium ? 2 : 0) | (m.large ? 4 : 0);
  });

  const paintRgb = computed<[number, number, number]>(() => {
    const n = parseInt(store.settings.value.paint.color.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  });

  effect(() => {
    void scene.value;
    void mazeClasses.value;
    void paintRgb.value;
    void store.settings.value.alpha.dim;
    request();
  });

  // ---------- labels

  let labelEls = new Map<string, HTMLElement>();
  const labelSize = new WeakMap<HTMLElement, [number, number]>();
  let currentLabels: OverlayLabel[] = [];
  effect(() => {
    const labels = scene.value.labels;
    untracked(() => {
      const next = new Map<string, HTMLElement>();
      for (const l of labels) {
        let node = labelEls.get(l.id);
        if (!node) {
          const url = l.icon ? poiIconUrl(l.icon) : null;
          node = h(
            'div',
            { class: l.kind === 'pin' ? 'map-label map-label--pin' : 'map-label' },
            url ? h('img', { src: url, alt: '', width: '20', height: '20', decoding: 'async' }) : null,
            h('span', null, l.text),
          );
          if (l.kind === 'pin') node.dataset.anchor = 'left';
        } else if (node.querySelector('span')!.textContent !== l.text) {
          node.querySelector('span')!.textContent = l.text;
          labelSize.delete(node);
        }
        node.style.setProperty('--label-color', l.color);
        next.set(l.id, node);
      }
      for (const [id, node] of labelEls) if (!next.has(id)) node.remove();
      for (const node of next.values()) if (!node.isConnected) labelsLayer.appendChild(node);
      labelEls = next;
      currentLabels = labels;
      positionLabels();
    });
  });

  /** Place labels in priority order (scene order) and hide those that would overlap. */
  function positionLabels(): void {
    const cam = store.camera.peek();
    const vp = viewport();
    const placed: [number, number, number, number][] = [];
    for (const l of currentLabels) {
      const node = labelEls.get(l.id);
      if (!node) continue;
      const [sx, sy] = worldToScreen(cam, vp, l.x, l.y);
      let visible = sx > -200 && sy > -50 && sx < vp.width + 200 && sy < vp.height + 50;
      if (visible) {
        let sz = labelSize.get(node);
        if (!sz) {
          node.style.display = '';
          sz = [node.offsetWidth, node.offsetHeight];
          if (sz[0]) labelSize.set(node, sz);
        }
        // Pins sit with their dot on the point (left anchor); other labels are centred.
        const left = node.dataset.anchor === 'left' ? sx - PIN_DOT_OFFSET : sx - sz[0] / 2;
        const r: [number, number, number, number] = [
          left - 4,
          sy - sz[1] / 2 - 2,
          left + sz[0] + 4,
          sy + sz[1] / 2 + 2,
        ];
        if (placed.some((p) => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])) visible = false;
        else placed.push(r);
      }
      node.style.display = visible ? '' : 'none';
      if (visible)
        node.style.transform =
          node.dataset.anchor === 'left'
            ? `translate(${Math.round(sx - PIN_DOT_OFFSET)}px, ${Math.round(sy)}px) translate(0, -50%)`
            : `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -50%)`;
    }
    positionFocus();
  }

  function positionFocus(): void {
    if (!focused || performance.now() > focused.until) {
      focusRing.hidden = true;
      focused = null;
      return;
    }
    const cam = store.camera.peek();
    const vp = viewport();
    const [x0, y0] = worldToScreen(cam, vp, focused.x0, focused.y1);
    const [x1, y1] = worldToScreen(cam, vp, focused.x1, focused.y0);
    const pad = 10;
    const size = Math.max(28, x1 - x0 + pad * 2, y1 - y0 + pad * 2);
    focusRing.hidden = false;
    focusRing.style.width = `${size}px`;
    focusRing.style.height = `${size}px`;
    focusRing.style.transform = `translate(${Math.round((x0 + x1) / 2 - size / 2)}px, ${Math.round((y0 + y1) / 2 - size / 2)}px)`;
  }

  // ---------- frame loop

  function timeState(): { timeMode: 0 | 1 | 2; timeCut: number } {
    const hist = store.history.peek();
    const info = store.timeline.peek();
    if (!hist.on || !info) return { timeMode: 0, timeCut: 0 };
    const step = Math.floor((hist.cut - info.min) / info.unit) + 1;
    return { timeMode: hist.mode === 'replay' ? 1 : 2, timeCut: Math.max(0, step) };
  }

  function frame(now: number): void {
    raf = 0;
    if (anim) {
      const k = Math.min(1, (now - anim.start) / anim.dur);
      const e = 1 - Math.pow(1 - k, 3);
      const zf = Math.log(anim.from.zoom) + (Math.log(anim.to.zoom) - Math.log(anim.from.zoom)) * e;
      store.camera.value = {
        x: anim.from.x + (anim.to.x - anim.from.x) * e,
        y: anim.from.y + (anim.to.y - anim.from.y) * e,
        zoom: Math.exp(zf),
      };
      if (k >= 1) anim = null;
      dirty = true;
    }
    if (dirty) {
      dirty = false;
      const vp = viewport();
      const cam = store.camera.peek();
      const hov = store.hover.peek();
      renderer.render({
        camera: cam,
        width: vp.width,
        height: vp.height,
        dpr: vp.dpr,
        highlightActive: highlightActive.peek(),
        dim: store.settings.peek().alpha.dim,
        customColor: paintRgb.peek(),
        primitives: scene.peek().primitives,
        mazeClasses: mazeClasses.peek(),
        hover: hov ? [hov.x, hov.y] : null,
        points: highlightActive.peek() && cam.zoom * vp.dpr < 3,
        pointOverride: store.settings.peek().paint.on ? paintRgb.peek() : null,
        ...timeState(),
      });
      positionLabels();
    }
    if (anim) raf = requestAnimationFrame(frame);
  }

  effect(() => {
    void store.camera.value;
    request();
  });

  // ---------- size

  const ro = new ResizeObserver((entries) => {
    const r = entries[0]!.contentRect;
    size.value = { width: r.width, height: r.height, dpr: window.devicePixelRatio || 1 };
    request();
  });
  ro.observe(el);
  const dprQuery = () => {
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener(
      'change',
      () => {
        size.value = { ...size.peek(), dpr: window.devicePixelRatio || 1 };
        request();
        dprQuery();
      },
      { once: true },
    );
  };
  dprQuery();

  // ---------- camera helpers

  function setCamera(c: Camera): void {
    anim = null;
    store.camera.value = { ...c, zoom: clampZoom(c.zoom) };
  }

  /**
   * Offset (CSS px) from the canvas centre to the centre of the area not covered by the panel,
   * which overlays the map on tablets (left) and phones (bottom sheet).
   */
  function uncoveredOffset(): [number, number] {
    const panel = document.getElementById('panel');
    if (!panel || panel.hidden) return [0, 0];
    const p = panel.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    if (p.width === 0 || p.right <= c.left || p.left >= c.right || p.bottom <= c.top || p.top >= c.bottom)
      return [0, 0];
    if (p.top > c.top + 1) return [0, (p.top - c.top) / 2 - c.height / 2]; // bottom sheet
    if (p.left <= c.left + 1 && p.right < c.right)
      return [(c.right - p.right) / 2 + (p.right - c.left) - c.width / 2, 0]; // left panel
    return [0, 0];
  }

  function flyTo(x: number, y: number, zoom = store.camera.peek().zoom, reveal = false): void {
    const z = clampZoom(zoom);
    const [ox, oy] = reveal ? uncoveredOffset() : [0, 0];
    const to = { x: x - ox / z, y: y + oy / z, zoom: z };
    if (reducedMotion()) return setCamera(to);
    anim = { from: store.camera.peek(), to, start: performance.now(), dur: 320 };
    request();
  }

  function zoomBy(factor: number): void {
    const vp = viewport();
    const c = zoomAt(store.camera.peek(), vp, factor, vp.width / 2, vp.height / 2);
    flyTo(c.x, c.y, c.zoom);
  }

  function fit(): void {
    const s = store.summary.peek();
    if (!s) return;
    const e = store.stats.peek()?.bounds;
    const b = s.bounds;
    const c = e
      ? fitBounds(viewport(), e.minX, e.minY, e.maxX + 1, e.maxY + 1)
      : fitBounds(viewport(), b.minCx * 256, b.minCy * 256, (b.maxCx + 1) * 256, (b.maxCy + 1) * 256);
    flyTo(c.x, c.y, c.zoom);
  }

  function centerCore(): void {
    flyTo(0, 0, Math.max(store.camera.peek().zoom, 1), true);
  }

  // ---------- input

  const pointers = new Map<number, { x: number; y: number }>();
  let dragStart: { x: number; y: number; cam: Camera; moved: boolean } | null = null;
  let pinch: { dist: number; cam: Camera; mid: [number, number] } | null = null;
  let longPress: ReturnType<typeof setTimeout> | null = null;

  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    canvas.setPointerCapture(e.pointerId);
    const [x, y] = local(e);
    pointers.set(e.pointerId, { x, y });
    anim = null;
    if (pointers.size === 1) {
      dragStart = { x, y, cam: store.camera.peek(), moved: false };
      if (e.pointerType !== 'mouse') {
        longPress = setTimeout(() => {
          if (dragStart && !dragStart.moved) {
            dragStart = null;
            openMenuAt(x, y);
          }
        }, 550);
      }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = {
        dist: Math.hypot(a!.x - b!.x, a!.y - b!.y),
        cam: store.camera.peek(),
        mid: [(a!.x + b!.x) / 2, (a!.y + b!.y) / 2],
      };
      dragStart = null;
      if (longPress) clearTimeout(longPress);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x, y });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const mid: [number, number] = [(a!.x + b!.x) / 2, (a!.y + b!.y) / 2];
      const vp = viewport();
      let c = zoomAt(pinch.cam, vp, dist / pinch.dist, pinch.mid[0], pinch.mid[1]);
      c = { ...c, x: c.x - (mid[0] - pinch.mid[0]) / c.zoom, y: c.y + (mid[1] - pinch.mid[1]) / c.zoom };
      setCamera(c);
      return;
    }
    if (dragStart && pointers.size === 1) {
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      if (!dragStart.moved && Math.hypot(dx, dy) > 4) {
        dragStart.moved = true;
        canvas.classList.add('is-dragging');
        if (longPress) clearTimeout(longPress);
      }
      if (dragStart.moved) {
        const z = dragStart.cam.zoom;
        setCamera({ x: dragStart.cam.x - dx / z, y: dragStart.cam.y + dy / z, zoom: z });
      }
      return;
    }
    if (e.pointerType === 'mouse') hoverAt(x, y);
  });

  const endPointer = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (longPress) clearTimeout(longPress);
    canvas.classList.remove('is-dragging');
    if (pointers.size < 2) pinch = null;
    if (dragStart && !dragStart.moved && e.type === 'pointerup') {
      const [x, y] = local(e);
      click(x, y, e.pointerType);
    }
    if (pointers.size === 0) dragStart = null;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !pointers.size) {
      store.hover.value = null;
      request();
    }
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const [x, y] = local(e);
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const delta = e.deltaY * unit;
      const factor = Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0018));
      setCamera(zoomAt(store.camera.peek(), viewport(), factor, x, y));
      hoverAt(x, y);
    },
    { passive: false },
  );

  canvas.addEventListener('dblclick', (e) => {
    const [x, y] = local(e);
    const c = zoomAt(store.camera.peek(), viewport(), 2, x, y);
    flyTo(c.x, c.y, c.zoom);
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    // Keyboard-invoked (Menu key / Shift+F10): open at the centre of the map.
    const fromKeyboard = e.button !== 2 && e.clientX === 0 && e.clientY === 0;
    const vp = viewport();
    const [x, y] = fromKeyboard ? [vp.width / 2, vp.height / 2] : local(e);
    openMenuAt(x, y);
  });

  canvas.addEventListener('keydown', (e) => {
    const cam = store.camera.peek();
    const step = (e.shiftKey ? 256 : 64) / cam.zoom;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':
        setCamera({ ...cam, x: cam.x - step });
        break;
      case 'ArrowRight':
        setCamera({ ...cam, x: cam.x + step });
        break;
      case 'ArrowUp':
        setCamera({ ...cam, y: cam.y + step });
        break;
      case 'ArrowDown':
        setCamera({ ...cam, y: cam.y - step });
        break;
      case 'Enter':
        if (store.pickMode.peek() !== 'none') {
          const vp = viewport();
          click(vp.width / 2, vp.height / 2, 'keyboard');
        } else handled = false;
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      if (e.key.startsWith('Arrow')) announceCenter();
    }
  });

  let announceTimer: ReturnType<typeof setTimeout> | undefined;
  function announceCenter(): void {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(async () => {
      const c = store.camera.peek();
      const x = Math.floor(c.x);
      const y = Math.floor(c.y);
      const { cell, time } = await service.probeFull(x, y);
      store.hover.value = { x, y, cell, time };
      announcer.textContent = describeTile(store, x, y, cell, time);
    }, 400);
  }

  // Hover probe, throttled to one in flight.
  let probeBusy = false;
  let probeNext: [number, number] | null = null;
  function hoverAt(sx: number, sy: number): void {
    if (!store.summary.peek()) return;
    const [wx, wy] = screenToWorld(store.camera.peek(), viewport(), sx, sy);
    const x = Math.floor(wx);
    const y = Math.floor(wy);
    const cur = store.hover.peek();
    if (cur && cur.x === x && cur.y === y) return;
    probeNext = [x, y];
    if (probeBusy) return;
    const run = async () => {
      while (probeNext) {
        const [px, py] = probeNext;
        probeNext = null;
        probeBusy = true;
        const { cell, time } = await service.probeFull(px, py);
        store.hover.value = { x: px, y: py, cell, time };
        request();
      }
      probeBusy = false;
    };
    void run();
  }

  async function click(sx: number, sy: number, pointerType: string): Promise<void> {
    const mode = store.pickMode.peek();
    if (mode === 'none') {
      // Touch has no hover: a tap inspects the tile instead.
      if (pointerType !== 'mouse') hoverAt(sx, sy);
      return;
    }
    const [wx, wy] = screenToWorld(store.camera.peek(), viewport(), sx, sy);
    const x = Math.floor(wx);
    const y = Math.floor(wy);
    if (mode === 'measure') {
      const r = store.ruler.peek();
      if (r && !r.b) {
        store.ruler.value = { a: r.a, b: [x, y] };
        store.pickMode.value = 'none';
      } else {
        store.ruler.value = { a: [x, y], b: null };
      }
      request();
      return;
    }
    if (mode === 'player') {
      patchSettings(store, (s) => ({ player: { ...s.player, on: true, x, y } }));
    } else {
      const cell = await service.probe(x, y);
      view.onPick?.(x, y, cell);
    }
    store.pickMode.value = 'none';
  }

  function openMenuAt(sx: number, sy: number): void {
    const [wx, wy] = screenToWorld(store.camera.peek(), viewport(), sx, sy);
    view.onContextMenu?.(Math.floor(wx), Math.floor(wy), sx, sy);
  }

  effect(() => {
    canvas.classList.toggle('is-picking', store.pickMode.value !== 'none');
  });

  const view: MapView = {
    el,
    canvas,
    flyTo,
    zoomBy,
    centerCore,
    fit,
    rotations: () => rotations.peek(),
    overlay: () => scene.peek(),
    lut: () => (highlightActive.peek() ? lut.peek() : null),
    onContextMenu: null,
    onPick: null,
    focusSpot(spot) {
      const w = spot.maxX - spot.minX + 1;
      const hgt = spot.maxY - spot.minY + 1;
      const vp = viewport();
      // Close enough to see the spot clearly, without zooming out from a closer view.
      const zoom = Math.max(
        store.camera.peek().zoom,
        Math.min(8, (Math.min(vp.width, vp.height) * 0.25) / Math.max(w, hgt)),
      );
      flyTo(spot.x + 0.5, spot.y + 0.5, zoom, true);
      focused = {
        x0: spot.minX,
        y0: spot.minY,
        x1: spot.maxX + 1,
        y1: spot.maxY + 1,
        until: performance.now() + 6000,
      };
      focusRing.classList.remove('is-pulsing');
      void focusRing.offsetWidth;
      focusRing.classList.add('is-pulsing');
      setTimeout(() => request(), 6100);
      request();
    },
  };
  return view;
}

/** Straight-line distance between two tiles, e.g. "123.4 tiles". */
export function formatDistance(ax: number, ay: number, bx: number, by: number): string {
  return tn('ruler.tiles', Math.round(Math.hypot(bx - ax, by - ay) * 10) / 10);
}

/** One-line description of a tile for the status bar and screen readers. */
export function describeTile(store: AppStore, x: number, y: number, cell: number, time = 0): string {
  const idx = cell & INDEX_MASK;
  const dist = Math.round(Math.hypot(x + 0.5, y + 0.5));
  const base = t('status.position', { x, y, dist });
  if (!idx) return `${base} · ${t('status.unexplored')}`;
  const rgb = store.palette.peek().colors[idx] ?? 0;
  const tiles = tilesByRgb.get(rgb);
  const name = tiles?.length
    ? tileLabel(tiles, cell)
    : t('status.unknownColor', { hex: `#${rgb.toString(16).padStart(6, '0')}` });
  const when = time ? ` · ${t('status.explored', { when: formatExploreTime(time) })}` : '';
  return `${base} · ${name}${when}`;
}

/** Exploration time as a short local date and time. */
export function formatExploreTime(seconds: number): string {
  return new Intl.DateTimeFormat(lang.value, { dateStyle: 'medium', timeStyle: 'short' }).format(
    exploreTimeToDate(seconds),
  );
}

export function tileLabel(tiles: readonly TileDef[], cell: number): string {
  // Prefer the boulder when the tile is part of a 2×2 block, otherwise the single-tile variant.
  const block = (cell & BLOCK_FLAG) !== 0;
  const preferred = tiles.filter((t) => (t.shape === 'block2x2') === block);
  const list = preferred.length ? preferred : tiles;
  const names = [...new Set(list.map(tileName))];
  return names.length > 2 ? `${names[0]} +${names.length - 1}` : names.join(' / ');
}
