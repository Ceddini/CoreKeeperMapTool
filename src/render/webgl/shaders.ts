export const MAX_RINGS = 64;
export const MAX_SECTORS = 64;
export const MAX_MARKERS = 4;

const SHADE = /* glsl */ `
uniform highp usampler2DArray u_cells;
uniform sampler2D u_palette;
uniform highp usampler2D u_lut;
uniform bool u_hlActive;
uniform float u_dim;
uniform vec3 u_custom;
uniform highp usampler2DArray u_times;
uniform int u_timeMode;   // 0 off, 1 replay, 2 highlight newer
uniform uint u_timeCut;

vec4 shade(ivec2 t, int layer) {
  uint v = texelFetch(u_cells, ivec3(t, layer), 0).r;
  uint idx = v & 0x7FFFu;
  if (idx == 0u) return vec4(0.0);
  bool older = false;
  if (u_timeMode != 0) {
    uint tv = texelFetch(u_times, ivec3(t, layer), 0).r;
    if (u_timeMode == 1 && (tv == 0u || tv > u_timeCut)) return vec4(0.0);
    older = u_timeMode == 2 && tv < u_timeCut;
  }
  ivec2 pc = ivec2(int(idx & 255u), int(idx >> 8u));
  vec4 c = texelFetch(u_palette, pc, 0);
  if (u_hlActive) {
    uint f = texelFetch(u_lut, pc, 0).r;
    bool on = f != 0u && ((f & 2u) == 0u || (v & 0x8000u) != 0u);
    if (!on) c.a = u_dim;
    else if ((f & 4u) != 0u) c.rgb = u_custom;
  }
  if (older) c.a = min(c.a, u_dim);
  return c;
}
`;

export const CHUNK_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec3 a_inst; // chunk origin relative to the camera (world units), layer
uniform vec2 u_clipPerWorld;
out vec2 v_uv;
flat out int v_layer;
void main() {
  vec2 world = a_inst.xy + a_corner * 256.0;
  gl_Position = vec4(world * u_clipPerWorld, 0.0, 1.0);
  v_uv = vec2(a_corner.x, 1.0 - a_corner.y) * 256.0;
  v_layer = int(a_inst.z);
}
`;

export const CHUNK_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
${SHADE}
uniform float u_tilesPerPx;
in vec2 v_uv;
flat in int v_layer;
out vec4 o;
void main() {
  if (u_tilesPerPx <= 1.0) {
    vec4 c = shade(ivec2(clamp(floor(v_uv), 0.0, 255.0)), v_layer);
    o = vec4(c.rgb * c.a, c.a);
    return;
  }
  // Zoomed out: average up to 4×4 samples across the pixel footprint (premultiplied).
  float n = min(ceil(u_tilesPerPx), 4.0);
  vec4 acc = vec4(0.0);
  for (int j = 0; j < 4; j++) {
    if (float(j) >= n) break;
    for (int i = 0; i < 4; i++) {
      if (float(i) >= n) break;
      vec2 p = v_uv + ((vec2(float(i), float(j)) + 0.5) / n - 0.5) * u_tilesPerPx;
      vec4 c = shade(ivec2(clamp(floor(p), 0.0, 255.0)), v_layer);
      acc += vec4(c.rgb * c.a, c.a);
    }
  }
  o = acc / (n * n);
}
`;

export const OVERLAY_VS = /* glsl */ `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }
`;

export const OVERLAY_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform vec2 u_viewport;      // device px
uniform vec2 u_camera;        // world position at the viewport centre
uniform float u_pxPerTile;    // device px per tile
uniform int u_ringCount;
uniform vec4 u_rings[${MAX_RINGS}];       // r, halfWidth
uniform vec4 u_ringColors[${MAX_RINGS}];
uniform int u_sectorCount;
uniform vec4 u_sectors[${MAX_SECTORS}];   // r0, r1, start (rad, compass), span (rad)
uniform vec4 u_sectorColors[${MAX_SECTORS}];
uniform int u_markerCount;
uniform vec4 u_markers[${MAX_MARKERS}];   // x, y, radius
uniform vec4 u_markerColors[${MAX_MARKERS}];
uniform vec4 u_gridChunk;     // rgba (a = 0: off)
uniform vec2 u_gridChunkSpec; // spacing, offset (tiles)
uniform vec4 u_gridMob;
uniform highp usampler2D u_maze;
uniform int u_mazeClasses;    // bit mask
uniform float u_mazeRadius;
uniform vec3 u_hover;         // x, y, enabled
uniform vec4 u_segment;       // x0, y0, x1, y1 (world)
uniform vec4 u_segmentColor;  // a = 0: off
out vec4 o;

const float TAU = 6.28318530718;

void over(inout vec4 dst, vec4 c, float cov) {
  float a = c.a * clamp(cov, 0.0, 1.0);
  dst = vec4(c.rgb * a, a) + dst * (1.0 - a);
}

float compass(vec2 p) {
  float a = atan(p.x, p.y);
  return a < 0.0 ? a + TAU : a;
}

float gridLine(float coord, float spacing, float widthPx) {
  float d = abs(coord - spacing * floor(coord / spacing + 0.5)) * u_pxPerTile;
  return clamp(widthPx * 0.5 + 0.5 - d, 0.0, 1.0);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = u_camera + (frag - u_viewport * 0.5) / u_pxPerTile;
  float px = 1.0 / u_pxPerTile; // world units per device px
  float r = length(p);
  float ang = compass(p);
  vec4 col = vec4(0.0);

  for (int i = 0; i < ${MAX_SECTORS}; i++) {
    if (i >= u_sectorCount) break;
    vec4 s = u_sectors[i];
    float radial = min(r - s.x, s.y - r) / px;
    float da = mod(ang - s.z, TAU);
    float angular = s.w >= TAU - 0.0001 ? 1e6 : min(da, s.w - da) * r / px;
    if (da > s.w) angular = -min(da - s.w, TAU - da) * r / px;
    over(col, u_sectorColors[i], min(radial, angular) + 0.5);
  }

  if (u_mazeClasses != 0) {
    ivec2 cell = ivec2(floor(p.x) + u_mazeRadius, u_mazeRadius - floor(p.y));
    int w = int(u_mazeRadius) * 2 + 1;
    if (cell.x >= 0 && cell.y >= 0 && cell.x < w && cell.y < w) {
      uint cls = texelFetch(u_maze, cell, 0).r;
      if (cls != 0u && (u_mazeClasses & (1 << (int(cls) - 1))) != 0) {
        vec3 mc = cls == 1u ? vec3(1.0, 0.0, 1.0) : cls == 2u ? vec3(0.0, 1.0, 1.0) : vec3(0.1, 1.0, 0.2);
        over(col, vec4(mc, 0.85), 1.0);
      }
    }
  }

  for (int i = 0; i < ${MAX_RINGS}; i++) {
    if (i >= u_ringCount) break;
    vec4 g = u_rings[i];
    float d = (g.y - abs(r - g.x)) / px;
    over(col, u_ringColors[i], d + 0.5);
  }

  if (u_gridMob.a > 0.0 && u_pxPerTile >= 2.0) {
    float c = max(gridLine(p.x, 16.0, 1.0), gridLine(p.y, 16.0, 1.0));
    over(col, u_gridMob, c * clamp((u_pxPerTile - 2.0) / 2.0, 0.0, 1.0));
  }
  if (u_gridChunk.a > 0.0 && u_pxPerTile >= 0.25) {
    float w = u_pxPerTile >= 4.0 ? 2.0 : 1.0;
    vec2 q = p - u_gridChunkSpec.y;
    float c = max(gridLine(q.x, u_gridChunkSpec.x, w), gridLine(q.y, u_gridChunkSpec.x, w));
    over(col, u_gridChunk, c);
  }

  for (int i = 0; i < ${MAX_MARKERS}; i++) {
    if (i >= u_markerCount) break;
    vec4 m = u_markers[i];
    float dm = length(p - m.xy);
    float lw = max(2.0, 0.35 * u_pxPerTile) * px;
    over(col, u_markerColors[i], (lw - abs(dm - m.z)) / px + 0.5);
    over(col, vec4(u_markerColors[i].rgb, 1.0), (max(5.0 * px, 0.9) - dm) / px + 0.5);
  }

  // Measurement line: dark outline, coloured core, dots at both ends.
  if (u_segmentColor.a > 0.0) {
    vec2 a = u_segment.xy;
    vec2 b = u_segment.zw;
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    float ds = length(p - (a + ab * t)) / px;
    over(col, vec4(0.0, 0.0, 0.0, 0.75), 3.5 - ds);
    over(col, u_segmentColor, 1.75 - ds);
    float de = min(length(p - a), length(p - b)) / px;
    over(col, vec4(0.0, 0.0, 0.0, 0.85), 7.0 - de);
    over(col, vec4(u_segmentColor.rgb, 1.0), 5.0 - de);
  }

  // Core marker.
  float dc = length(p);
  over(col, vec4(0.0, 0.0, 0.0, 0.8), (max(7.0 * px, 2.2) - dc) / px + 0.5);
  over(col, vec4(1.0, 0.75, 0.25, 1.0), (max(5.0 * px, 1.6) - dc) / px + 0.5);

  // Hovered tile outline (only when tiles are large enough).
  if (u_hover.z > 0.5 && u_pxPerTile >= 6.0) {
    vec2 t = p - u_hover.xy;
    if (t.x >= -px && t.y >= -px && t.x <= 1.0 + px && t.y <= 1.0 + px) {
      float edge = min(min(t.x, 1.0 - t.x), min(t.y, 1.0 - t.y)) / px;
      over(col, vec4(1.0, 1.0, 1.0, 0.9), 1.5 - abs(edge));
    }
  }

  o = col;
}
`;

export const POINTS_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec3 a_point; // world x, y, palette index
uniform vec2 u_camera;
uniform vec2 u_clipPerWorld;
uniform float u_size;
uniform sampler2D u_palette;
out vec3 v_color;
void main() {
  vec2 rel = a_point.xy + 0.5 - u_camera;
  gl_Position = vec4(rel * u_clipPerWorld, 0.0, 1.0);
  gl_PointSize = u_size;
  int idx = int(a_point.z);
  v_color = texelFetch(u_palette, ivec2(idx & 255, idx >> 8), 0).rgb;
}
`;

export const POINTS_FS = /* glsl */ `#version 300 es
precision mediump float;
uniform vec3 u_override;
uniform bool u_useOverride;
in vec3 v_color;
out vec4 o;
void main() {
  vec2 q = abs(gl_PointCoord - 0.5) * 2.0;
  float m = max(q.x, q.y);
  vec3 c = u_useOverride ? u_override : v_color;
  o = m > 0.6 ? vec4(0.0, 0.0, 0.0, 0.9) : vec4(c, 1.0);
}
`;
