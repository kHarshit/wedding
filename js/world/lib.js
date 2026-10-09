/*
 * Shared pieces for the world's places, moved out of the Our Story scene.
 *
 *  - small maths: clamp, smooth, lerp, rng, col
 *  - point fields: every glow in the world (lamps, fairy lights, petals,
 *    fireflies, lanterns, fireworks) is a shader point. A place makes one
 *    pointKit() with its own uniforms; each field supplies a GLSL place()
 *    returning a world position and how visible it is, so everything moves
 *    on the GPU and nothing is allocated per frame.
 *  - geometry: box/cyl/arch helpers, swags, a haveli, trees, the diya bowl,
 *    the rangoli, marigold garlands (one instanced mesh per place), light pools.
 */
import { THREE, tinted, merge } from '../immersive/kit.js';

export { THREE };

// ── Maths ────────────────────────────────────────────────────────────────
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function col(h) { return new THREE.Color(h); }
export function mq(q) { return !!(window.matchMedia && window.matchMedia(q).matches); }

// ── Point fields ─────────────────────────────────────────────────────────
var CS = '\n #include <colorspace_fragment>\n';
var FHEAD = 'uniform float uTime; varying vec3 vCol; varying float vA; varying float vPx; varying float vSeed;\n';

// A round glow with a bright core, tinted by vCol.
export var GLOW_F = FHEAD +
  'void main(){ vec2 p = gl_PointCoord - 0.5; float d2 = dot(p, p);\n' +
  ' float core = exp(-d2 * 90.0); float a = (exp(-d2 * 13.0) * 0.42 + core * 0.85) * vA; if (a < 0.004) discard;\n' +
  ' gl_FragColor = vec4(mix(vCol, vec3(1.0, 0.95, 0.84), core * 0.6), min(a, 1.0));' + CS + '}';
// Just the halo, for the big soft light round a flame.
export var HALO_F = FHEAD +
  'void main(){ vec2 p = gl_PointCoord - 0.5; float d2 = dot(p, p);\n' +
  ' float a = (exp(-d2 * 12.0) * 0.5 + exp(-d2 * 55.0) * 0.35) * vA; if (a < 0.003) discard;\n' +
  ' gl_FragColor = vec4(vCol, min(a, 1.0));' + CS + '}';
// A diya flame: a teardrop, white-gold at the heart.
export var FLAME_F = FHEAD +
  'void main(){ vec2 p = gl_PointCoord - 0.5; p.y = -p.y;\n' +
  ' float sx = mix(0.15, 0.035, clamp(p.y + 0.35, 0.0, 1.0));\n' +
  ' float f = exp(-(p.x * p.x) / (sx * sx) - pow((p.y + 0.12) / 0.26, 2.0));\n' +
  ' f = mix(exp(-dot(p, p) * 18.0), f, smoothstep(3.0, 9.0, vPx));\n' +
  ' vec3 c = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.93, 0.72), smoothstep(0.35, 0.9, f));\n' +
  ' float a = f * vA; if (a < 0.004) discard;\n' +
  ' gl_FragColor = vec4(c, min(a, 1.0));' + CS + '}';
// A petal: a small spinning, fluttering ellipse (normal blending).
export var PETAL_F = FHEAD +
  'void main(){ vec2 p = gl_PointCoord - 0.5;\n' +
  ' float an = vSeed * 6.2832 + uTime * (0.5 + vSeed); float c = cos(an), s = sin(an);\n' +
  ' p = mat2(c, -s, s, c) * p; p.x *= 1.9 / (0.35 + 0.65 * abs(sin(uTime * 1.9 + vSeed * 20.0)));\n' +
  ' float d = dot(p, p) * 4.6; float a = (1.0 - smoothstep(0.5, 1.0, d)) * vA; if (a < 0.02) discard;\n' +
  ' gl_FragColor = vec4(vCol * (0.8 + 0.35 * (1.0 - d)), min(a, 1.0));' + CS + '}';
// A sky lantern: a warm paper body lit from below, and its halo.
export var LANTERN_F = FHEAD +
  'void main(){ vec2 p = gl_PointCoord - 0.5; float d2 = dot(p, p);\n' +
  ' vec2 q = abs(p) / vec2(0.12 - p.y * 0.06, 0.17);\n' +
  ' float body = 1.0 - smoothstep(0.75, 1.0, max(q.x, q.y));\n' +
  ' float hot = exp(-(p.x * p.x * 260.0 + (p.y - 0.1) * (p.y - 0.1) * 160.0));\n' +
  ' float halo = exp(-d2 * 11.0) * 0.45;\n' +
  ' vec3 c = mix(vec3(1.0, 0.42, 0.12), vec3(1.0, 0.78, 0.45), body * (0.4 + p.y * 1.5) + hot);\n' +
  ' float a = (halo + body * 0.85 + hot) * vA; if (a < 0.004) discard;\n' +
  ' gl_FragColor = vec4(c, min(a, 1.0));' + CS + '}';

var VMAIN =
  'void main(){\n' +
  ' vCol = aCol; vSeed = aData.y;\n' +
  ' vec4 P = place();\n' +
  ' vec4 mv = modelViewMatrix * vec4(P.xyz, 1.0); gl_Position = projectionMatrix * mv;\n' +
  ' float d = max(-mv.z, 0.05);\n' +
  ' vPx = SIZE * aData.w * uScale / d;\n' +
  ' gl_PointSize = clamp(vPx, MINPX, 280.0);\n' +
  ' vA = P.w * exp(-pow(uFogD * d, 2.0)) * min(1.0, vPx / MINPX);\n' +
  '#ifdef NEAR\n vA *= smoothstep(NEAR * 0.35, NEAR, d);\n#endif\n' +
  ' if (vA < 0.003) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; }\n' +
  '}';

// U must hold uTime, uScale and uFogD; its other floats and vec3s are
// declared for every field's place() to use.
export function pointKit(U, group) {
  var fl = [], v3 = [];
  Object.keys(U).forEach(function (k) {
    var v = U[k].value;
    if (typeof v === 'number') fl.push(k); else if (v && v.isVector3) v3.push(k);
  });
  var HEAD = 'uniform float ' + fl.join(', ') + ';\n' + (v3.length ? 'uniform vec3 ' + v3.join(', ') + ';\n' : '') +
    'attribute vec4 aData; attribute vec3 aCol;\n' +
    'varying vec3 vCol; varying float vA; varying float vPx; varying float vSeed;\n' +
    'float h1(float n){ return fract(sin(n) * 43758.5453123); }\n';
  function mat(place, frag, size, minPx, normal, near) {
    return new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false,
      blending: normal ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: '#define SIZE ' + size.toFixed(3) + '\n#define MINPX ' + minPx.toFixed(2) + '\n' +
        (near ? '#define NEAR ' + near.toFixed(2) + '\n' : '') + HEAD + place + VMAIN,
      fragmentShader: frag
    });
  }
  // layers: [fragment, size, min px, render order, normal blending?, fade-near distance?]
  function add(set, place, layers) {
    if (!set.p.length) return [];
    var g = set.geo();
    return layers.map(function (l) {
      var pts = new THREE.Points(g, mat(place, l[0], l[1], l[2], l[4], l[5]));
      pts.frustumCulled = false;
      pts.renderOrder = l[3] || 0;
      group.add(pts);
      return pts;
    });
  }
  return { mat: mat, add: add };
}

// A growable list of points: position, aData (param, seed, param2, size), aCol.
var WHITE = null;
export function PointSet() { this.p = []; this.d = []; this.c = []; }
PointSet.prototype.add = function (x, y, z, a, b, c2, size, color) {
  this.p.push(x, y, z);
  this.d.push(a, b, c2, size == null ? 1 : size);
  var cc = color || WHITE || (WHITE = col('#ffffff'));
  this.c.push(cc.r, cc.g, cc.b);
  return this;
};
PointSet.prototype.geo = function () {
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
  g.setAttribute('aData', new THREE.Float32BufferAttribute(this.d, 4));
  g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.c, 3));
  return g;
};

// ── Geometry ─────────────────────────────────────────────────────────────
export function box(geos, x0, x1, y0, y1, z0, z1, color) {
  geos.push(tinted(new THREE.BoxGeometry(Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0))
    .translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), color));
}
export function cyl(geos, x, z, y0, y1, rad, color, seg) {
  geos.push(tinted(new THREE.CylinderGeometry(rad, rad, y1 - y0, seg || 10).translate(x, (y0 + y1) / 2, z), color));
}
// A flat arch facing +z: a rectangle with a round top, w wide, h tall.
export function arch(w, h) {
  var s = new THREE.Shape(), rr2 = w / 2;
  s.moveTo(-rr2, 0); s.lineTo(-rr2, h - rr2); s.absarc(0, h - rr2, rr2, Math.PI, 0, true); s.lineTo(rr2, 0); s.lineTo(-rr2, 0);
  return new THREE.ShapeGeometry(s, 8);
}
export function archAt(geos, w, h, x, y, z, color, rotY) {
  var g = arch(w, h);
  if (rotY) g.rotateY(rotY);
  geos.push(tinted(g.translate(x, y, z), color));
}
// The outline of a pointed (Mughal) arch, w wide, straight sides to `spring`
// then two arcs meeting at `apex`; `cusps` lobes scallop it inwards by `depth`.
// Returns points from the bottom left, round the top, to the bottom right.
export function pointedArch(w, spring, apex, cusps, depth, n) {
  var hw = w / 2, h = apex - spring, c = (h * h - hw * hw) / (2 * hw), R = hw + c, pts = [];
  var th0 = Math.acos(-c / R), N = n || 24;
  pts.push([-hw, 0]);
  for (var k = 0; k <= N * 2; k++) {
    var s = k / (N * 2), x, y, nx, ny;
    if (s <= 0.5) { var a = lerp(Math.PI, th0, s * 2); x = c + R * Math.cos(a); y = spring + R * Math.sin(a); nx = -Math.cos(a); ny = -Math.sin(a); }
    else { var b = lerp(Math.PI - th0, 0, s * 2 - 1); x = -c + R * Math.cos(b); y = spring + R * Math.sin(b); nx = -Math.cos(b); ny = -Math.sin(b); }
    if (cusps) { var o = depth * (1 - Math.abs(Math.sin(Math.PI * cusps * s))); x += nx * o; y += ny * o; }
    pts.push([x, y]);
  }
  pts.push([hw, 0]);
  return pts;
}
// A wall panel x0..x1, h tall, with arched openings cut up from its foot
// (each from pointedArch(), shifted into place, left to right).
export function notchShape(x0, x1, h, arches) {
  var s = new THREE.Shape();
  s.moveTo(x0, 0);
  arches.forEach(function (pts) { pts.forEach(function (p) { s.lineTo(p[0], p[1]); }); });
  s.lineTo(x1, 0); s.lineTo(x1, h); s.lineTo(x0, h); s.closePath();
  return s;
}
// A band following an arch: up the outer outline and back down the inner one.
export function bandShape(outer, inner) {
  var s = new THREE.Shape();
  s.moveTo(outer[0][0], outer[0][1]);
  for (var i = 1; i < outer.length; i++) s.lineTo(outer[i][0], outer[i][1]);
  for (i = inner.length - 1; i >= 0; i--) s.lineTo(inner[i][0], inner[i][1]);
  s.closePath();
  return s;
}
// merge() that keeps uv too (for textured pieces).
export function mergeUV(geos) {
  var total = 0;
  geos.forEach(function (g) { total += g.attributes.position.count; });
  var out = new THREE.BufferGeometry();
  [['position', 3], ['normal', 3], ['color', 3], ['uv', 2]].forEach(function (a) {
    var arr = new Float32Array(total * a[1]), o = 0;
    geos.forEach(function (g) { arr.set(g.attributes[a[0]].array, o); o += g.attributes[a[0]].array.length; });
    out.setAttribute(a[0], new THREE.BufferAttribute(arr, a[1]));
  });
  geos.forEach(function (g) { g.dispose(); });
  return out;
}
export function shiftPts(pts, dx, dy) { return pts.map(function (p) { return [p[0] + dx, p[1] + (dy || 0)]; }); }
export function shapeFrom(pts, hole) {
  var s = hole ? new THREE.Path() : new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (var i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}
// Points along a hanging string (a parabola is close enough to a catenary).
export function swag(a, b, sag, n, fn) {
  for (var k = 0; k <= n; k++) {
    var t = k / n;
    fn(lerp(a[0], b[0], t), lerp(a[1], b[1], t) - sag * 4 * t * (1 - t), lerp(a[2], b[2], t), t, k);
  }
}
// Darken a merged geometry towards the ground, as if lit from the sky.
export function groundShade(geo, y0, y1, low) {
  var p = geo.attributes.position, c = geo.attributes.color;
  for (var k = 0; k < p.count; k++) {
    var s = lerp(low, 1, smooth(y0, y1, p.getY(k)));
    c.setXYZ(k, c.getX(k) * s, c.getY(k) * s, c.getZ(k) * s);
  }
}

// Marigold balls (garlands, torans) collected from a place: one instanced mesh.
export var MARI_HEX = ['#ff8c00', '#ffa10a', '#ffb31a', '#f57c00', '#ffc21f', '#ff9500'];
export function Garlands() {
  this.balls = [];
  this.MARI = MARI_HEX.map(col);
  this.ROSE = col('#b0122c');
}
Garlands.prototype.ball = function (x, y, z, rad, c) {
  var b = this.balls;
  b.push([x, y, z, rad, c || this.MARI[(b.length * 7 + (b.length >> 2)) % this.MARI.length]]);
};
Garlands.prototype.garlandTo = function (a, b, sag, n, rad) {
  var self = this;
  swag(a, b, sag, n, function (x, y, z) { self.ball(x, y, z, rad); });
};
Garlands.prototype.strand = function (x, y, z, count, step, rad, roseEvery) {
  for (var k = 0; k < count; k++) this.ball(x, y - k * step, z, rad, roseEvery && k % roseEvery === roseEvery - 1 ? this.ROSE : null);
};
// small: a 20-face ball instead of 36 (phones; no difference at this size).
Garlands.prototype.mesh = function (emissive, small) {
  var m = new THREE.InstancedMesh(small ? new THREE.IcosahedronGeometry(1, 0) : new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: emissive || '#4a1a00' }), Math.max(1, this.balls.length));
  var mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), e = new THREE.Euler();
  this.balls.forEach(function (b, k) {
    ps.set(b[0], b[1], b[2]); q.setFromEuler(e.set(k * 1.3, k * 0.7, k * 2.1)); sc.setScalar(b[3]);
    m.setMatrixAt(k, mtx.compose(ps, q, sc));
    m.setColorAt(k, b[4]);
  });
  m.count = this.balls.length;
  return m;
};

// ── A haveli ─────────────────────────────────────────────────────────────
// Built facing +z with the door at x = 0, then turned by H.rot and set at
// (H.x, 0, H.z). ctx: { small, r, g (Garlands), fairy (PointSet), winSpots }.
// hi offsets when its fairy lights come on. Returns world-space geometry
// for the walls and for the glowing windows, and where its door is.
export var HAVELI_PAL = [
  { wall: '#d9a066', wall2: '#e3b27c', trim: '#f4e0bc', trim2: '#c58552', stone: '#a4785a', step: '#b98d68', dome: '#f2ddb6' },
  { wall: '#d38a74', wall2: '#de9d86', trim: '#f5ddc4', trim2: '#bb7660', stone: '#9e7462', step: '#b48874', dome: '#f4dfc8' }
];
export function haveli(ctx, H, P, hi) {
  var small = ctx.small, r = ctx.r, G = ctx.g, fairy = ctx.fairy;
  var leafGreen = '#3e6a22', cWarm = col('#ffb862'), cWin = col('#ffa04a');
  var cFairy = [col('#ffd88a'), col('#ffe6b0'), col('#ffc060'), col('#ffd0a0')];
  var g = [], glow = [], m = new THREE.Matrix4().makeRotationY(H.rot).setPosition(H.x, 0, H.z);
  var v = new THREE.Vector3(), W = 9, D = 7, G0 = 0.5, G1 = 3.9, U0 = G1 + 0.22, U1 = U0 + 2.7, uz = -0.75;
  function world3(x, y, z) { return v.set(x, y, z).applyMatrix4(m); }
  var b0 = G.balls.length;

  box(g, -W / 2 - 0.5, W / 2 + 0.5, 0, G0, -D - 0.5, 0.5, P.stone);
  for (var k = 0; k < 3; k++) box(g, -1.5, 1.5, 0, G0 - k * 0.16, 0.5, 0.5 + 0.38 * (k + 1), P.step);
  box(g, -W / 2, W / 2, G0, G1, -D, 0, P.wall);
  box(g, -W / 2 - 0.08, W / 2 + 0.08, G0, G0 + 0.4, -D - 0.08, 0.08, P.trim2);
  box(g, -W / 2 - 0.35, W / 2 + 0.35, G1, G1 + 0.22, -D - 0.35, 0.45, P.trim);
  // Corner pilasters.
  [-1, 1].forEach(function (s) { box(g, s * W / 2 - 0.3, s * W / 2 + 0.3, G0, G1, -0.3, 0.12, P.trim2); });
  // Front terrace parapet with little merlons.
  box(g, -W / 2 - 0.2, W / 2 + 0.2, U0, U0 + 0.5, 0.12, 0.4, P.trim);
  for (var mx = -W / 2; mx <= W / 2 + 0.01; mx += 0.6) box(g, mx - 0.13, mx + 0.13, U0 + 0.5, U0 + 0.78, 0.16, 0.36, P.trim);
  // Upper floor and its parapet.
  box(g, -W / 2 + 0.8, W / 2 - 0.8, U0, U1, -D + 0.8, uz, P.wall2);
  box(g, -W / 2 + 0.6, W / 2 - 0.6, U1, U1 + 0.2, -D + 0.6, uz + 0.25, P.trim);
  box(g, -W / 2 + 0.65, W / 2 - 0.65, U1 + 0.2, U1 + 0.6, uz - 0.05, uz + 0.2, P.trim2);
  for (mx = -W / 2 + 0.8; mx <= W / 2 - 0.79; mx += 0.55) box(g, mx - 0.12, mx + 0.12, U1 + 0.6, U1 + 0.85, uz, uz + 0.16, P.trim2);
  // Rooftop chhatris at the back corners.
  [-1, 1].forEach(function (s) {
    var cx = s * (W / 2 - 1.9), cz = -D + 2.0, y0 = U1 + 0.2;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { box(g, cx + c[0] * 0.6 - 0.07, cx + c[0] * 0.6 + 0.07, y0, y0 + 1.25, cz + c[1] * 0.6 - 0.07, cz + c[1] * 0.6 + 0.07, P.trim); });
    box(g, cx - 0.82, cx + 0.82, y0 + 1.25, y0 + 1.4, cz - 0.82, cz + 0.82, P.trim);
    g.push(tinted(new THREE.SphereGeometry(0.78, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.15, 1).translate(cx, y0 + 1.4, cz), P.dome));
    g.push(tinted(new THREE.ConeGeometry(0.09, 0.45, 6).translate(cx, y0 + 2.5, cz), '#d9a441'));
    // Fairy lights round the dome's rim.
    for (var q = 0; q < (small ? 10 : 16); q++) {
      var an = q / (small ? 10 : 16) * Math.PI * 2;
      var wp = world3(cx + Math.cos(an) * 0.85, y0 + 1.42, cz + Math.sin(an) * 0.85);
      fairy.add(wp.x, wp.y, wp.z, 0.18 + hi * 0.04 + r() * 0.04, r(), 0, 0.9, cFairy[q % 4]);
    }
  });

  // The door: a cream arch surround, the warm hall glowing within.
  archAt(g, 2.1, 3.0, 0, G0, 0.02, P.trim);
  archAt(glow, 1.5, 2.55, 0, G0, 0.05, cWarm);
  var spots = [[0, G0 + 1.2, 0.2, 2.2]];
  // Ground-floor windows and the side windows.
  [-2.9, 2.9].forEach(function (x) {
    archAt(g, 1.3, 2.0, x, G0 + 0.85, 0.02, P.trim);
    archAt(glow, 0.95, 1.65, x, G0 + 1.0, 0.05, cWin);
    spots.push([x, G0 + 1.8, 0.2, 1.4]);
  });
  [-1, 1].forEach(function (s) {
    [-1.8, -5.0].forEach(function (z) {
      archAt(g, 1.2, 1.9, 0, 0, 0, P.trim, s * Math.PI / 2);
      g[g.length - 1].translate(s * (W / 2 + 0.02), G0 + 0.85, z);
      archAt(glow, 0.85, 1.55, 0, 0, 0, cWin, s * Math.PI / 2);
      glow[glow.length - 1].translate(s * (W / 2 + 0.05), G0 + 1.0, z);
      spots.push([s * (W / 2 + 0.2), G0 + 1.8, z, 1.3]);
    });
  });
  // Jharokhas: three projecting balconies on the upper floor.
  [-2.3, 0, 2.3].forEach(function (x) {
    box(g, x - 0.75, x + 0.75, U0 + 0.45, U0 + 0.7, uz, uz + 0.7, P.trim);
    box(g, x - 0.62, x + 0.62, U0 + 0.7, U0 + 2.05, uz, uz + 0.55, P.wall);
    archAt(glow, 0.72, 1.05, x, U0 + 0.85, uz + 0.56, cWin);
    spots.push([x, U0 + 1.35, uz + 0.7, 1.1]);
    g.push(tinted(new THREE.ConeGeometry(0.98, 0.55, 4).rotateY(Math.PI / 4).translate(x, U0 + 2.33, uz + 0.28), P.dome));
    g.push(tinted(new THREE.ConeGeometry(0.05, 0.3, 5).translate(x, U0 + 2.75, uz + 0.28), '#d9a441'));
  });

  // Toran over the door: marigolds on a sagging string, mango leaves and pendants.
  var ty = G0 + 3.12;
  swag([-1.15, ty, 0.16], [1.15, ty, 0.16], 0.24, small ? 12 : 18, function (x, y, z, t, kk) {
    G.ball(x, y, z, 0.062);
    if (kk % 2) g.push(tinted(new THREE.ConeGeometry(0.06, 0.22, 3).rotateX(Math.PI).translate(x, y - 0.14, z + 0.02), leafGreen));
    if (kk % 3 === 0 && t > 0.05 && t < 0.95) G.strand(x, y - 0.12, z, 3, 0.11, 0.05, 3);
  });
  // Garland swags along the cornice and the roof parapet.
  for (var sw = 0; sw < 4; sw++) {
    var xa = -W / 2 - 0.3 + sw * (W + 0.6) / 4, xb = xa + (W + 0.6) / 4;
    G.garlandTo([xa, G1 - 0.02, 0.52], [xb, G1 - 0.02, 0.52], 0.42, small ? 9 : 13, 0.06);
    G.strand(xa, G1 - 0.08, 0.52, 5, 0.11, 0.055, 5);
  }
  G.strand(W / 2 + 0.3, G1 - 0.08, 0.52, 5, 0.11, 0.055, 5);
  for (sw = 0; sw < 3; sw++) {
    var xc = -W / 2 + sw * W / 3;
    G.garlandTo([xc, U0 + 0.45, 0.45], [xc + W / 3, U0 + 0.45, 0.45], 0.3, small ? 7 : 10, 0.055);
  }

  // Fairy-light curtain: strands down the whole front (aData.x is the
  // moment each light comes on), and outlines along the parapets.
  var dx = small ? 0.42 : 0.3, dy = small ? 0.24 : 0.17;
  for (var fx = -W / 2 + 0.15; fx <= W / 2 - 0.1; fx += dx) {
    var top = G1 + 0.12, bottom = Math.abs(fx) < 1.15 ? G0 + 3.05 : G0 + 0.35 + r() * 0.3, delay = r() * 0.05;
    for (var fy = top; fy > bottom; fy -= dy) {
      var w3 = world3(fx, fy, 0.56);
      fairy.add(w3.x, w3.y, w3.z, 0.2 + hi * 0.05 + (top - fy) / 3.4 * 0.3 + delay, r(), 0, 0.85 + r() * 0.3, cFairy[(r() * 4) | 0]);
    }
  }
  for (fx = -W / 2 + 0.95; fx <= W / 2 - 0.9; fx += dx) {
    var top2 = U1 + 0.15, bottom2 = U0 + 0.85;
    for (fy = top2; fy > bottom2; fy -= dy) {
      var w4 = world3(fx, fy, uz + 0.75);
      fairy.add(w4.x, w4.y, w4.z, 0.14 + hi * 0.05 + (top2 - fy) / 2.6 * 0.25, r(), 0, 0.85 + r() * 0.3, cFairy[(r() * 4) | 0]);
    }
  }
  for (fx = -W / 2 - 0.3; fx <= W / 2 + 0.3; fx += dx * 0.6) {
    var w5 = world3(fx, U0 + 0.82, 0.3); fairy.add(w5.x, w5.y, w5.z, 0.12 + hi * 0.05, r(), 0, 0.9, cFairy[0]);
    var w6 = world3(fx, G1 + 0.24, 0.5); fairy.add(w6.x, w6.y, w6.z, 0.1 + hi * 0.05, r(), 0, 0.9, cFairy[1]);
    if (Math.abs(fx) < W / 2 - 0.7) { var w7 = world3(fx, U1 + 0.9, uz + 0.1); fairy.add(w7.x, w7.y, w7.z, 0.08 + hi * 0.05, r(), 0, 0.9, cFairy[0]); }
  }

  // To world space.
  var merged = merge(g);
  groundShade(merged, 0, 2.6, 0.72);
  merged.applyMatrix4(m);
  var mg = merge(glow);
  mg.applyMatrix4(m);
  spots.forEach(function (sp) { var wv = world3(sp[0], sp[1], sp[2]); ctx.winSpots.push([wv.x, wv.y, wv.z, sp[3]]); });
  for (var bi = b0; bi < G.balls.length; bi++) { world3(G.balls[bi][0], G.balls[bi][1], G.balls[bi][2]); G.balls[bi][0] = v.x; G.balls[bi][1] = v.y; G.balls[bi][2] = v.z; }

  var door = world3(0, G0 + 0.02, 0.72).clone();
  var out = new THREE.Vector3(Math.sin(H.rot), 0, Math.cos(H.rot));
  return { geo: merged, glow: mg, lamp: { door: door, out: out, m: m, front: world3(0, 3.2, 4).clone() } };
}

// ── Trees ────────────────────────────────────────────────────────────────
// A broadleaf about 6 m tall; the crown is white so instance colours tint it
// (the story's dusk silhouettes). Daylit places pass their own bark and leaf.
export function broadleaf(bark, leaf) {
  bark = bark || '#3a2a20'; leaf = leaf || '#ffffff';
  var rr = rng(77), parts = [tinted(new THREE.CylinderGeometry(0.14, 0.26, 3.4, 7).translate(0, 1.7, 0), bark)];
  parts.push(tinted(new THREE.CylinderGeometry(0.05, 0.1, 1.7, 5).rotateZ(0.7).translate(0.5, 3.1, 0), bark));
  for (var k = 0; k < 7; k++) {
    var rad = 0.9 + rr() * 0.7, a = rr() * Math.PI * 2, d = k === 0 ? 0 : 0.8 + rr() * 0.6;
    parts.push(tinted(new THREE.IcosahedronGeometry(rad, 1).scale(1, 0.82, 1)
      .translate(Math.cos(a) * d, 4.1 + rr() * 1.5 + (k === 0 ? 0.7 : 0), Math.sin(a) * d), leaf));
  }
  return merge(parts);
}
// Ashoka: tall and narrow, drooping tiers of leaves.
export function ashoka(bark, leaf) {
  bark = bark || '#3a2a20'; leaf = leaf || '#ffffff';
  var parts = [tinted(new THREE.CylinderGeometry(0.08, 0.14, 2, 6).translate(0, 1, 0), bark)];
  for (var k = 0; k < 6; k++) {
    var y = 1.5 + k * 1.0, rad = lerp(0.95, 0.5, k / 5);
    parts.push(tinted(new THREE.IcosahedronGeometry(rad, 1).scale(1, 1.25, 1).translate(0, y + 0.6, 0), leaf));
  }
  parts.push(tinted(new THREE.IcosahedronGeometry(0.4, 1).scale(1, 1.6, 1).translate(0, 7.9, 0), leaf));
  return merge(parts);
}
// Instanced trees of one kind: spots [[x, y, z, scale, rotY, colour], ...].
export function treeMesh(geo, spots, double) {
  var mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: double ? THREE.DoubleSide : THREE.FrontSide }), Math.max(1, spots.length));
  var mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
  spots.forEach(function (s, k) {
    ps.set(s[0], s[1], s[2]); q.setFromEuler(e.set(0, s[4], 0)); sc.set(s[3], s[3] * (s[6] || 1), s[3]);
    mesh.setMatrixAt(k, mtx.compose(ps, q, sc));
    mesh.setColorAt(k, s[5]);
  });
  mesh.count = spots.length;
  return mesh;
}

// ── Lamps ────────────────────────────────────────────────────────────────
// Diya bowls: a lathe-turned clay lamp, instanced wherever a flame burns.
export function diyaGeometry(seg) {
  var pts = [[0, 0], [0.05, 0.004], [0.075, 0.025], [0.085, 0.05], [0.07, 0.05], [0.05, 0.03], [0, 0.03]]
    .map(function (p) { return new THREE.Vector2(p[0] * 1.4, p[1] * 1.4); });
  var geo = new THREE.LatheGeometry(pts, seg || 12).toNonIndexed(), pos = geo.attributes.position, cs = [];
  var inner = col('#e08a3c'), lo = col('#7a3a1e'), hi = col('#b8602c'), c = col('#000');
  for (var k = 0; k < pos.count; k++) {
    var y = pos.getY(k), rr2 = Math.hypot(pos.getX(k), pos.getZ(k));
    if (rr2 < 0.1 && y > 0.036) c.copy(inner); else c.copy(lo).lerp(hi, y / 0.07);
    cs.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
  return geo;
}
export function diyaBowls(lamps, scale, seg) {
  var n = lamps.p.length / 3;
  var bowls = new THREE.InstancedMesh(diyaGeometry(seg), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#1a0a04' }), Math.max(1, n));
  var mtx = new THREE.Matrix4(), s = scale || 1;
  for (var i = 0; i < n; i++) {
    mtx.makeScale(s, s, s).setPosition(lamps.p[i * 3], lamps.p[i * 3 + 1], lamps.p[i * 3 + 2]);
    bowls.setMatrixAt(i, mtx);
  }
  bowls.count = n;
  return bowls;
}

// ── Stone ────────────────────────────────────────────────────────────────
// UVs from position, picked by the face's direction, so a texture lies on
// every wall, pier and dome at one scale (metres per repeat).
export function worldUV(geo, scale) {
  var p = geo.attributes.position, n = geo.attributes.normal, k = 1 / (scale || 2);
  var uv = new Float32Array(p.count * 2);
  for (var i = 0; i < p.count; i++) {
    var ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ay > 0.7) { uv[i * 2] = x * k; uv[i * 2 + 1] = z * k; }
    else if (ax > az) { uv[i * 2] = z * k; uv[i * 2 + 1] = y * k; }
    else { uv[i * 2] = x * k; uv[i * 2 + 1] = y * k; }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
// Coursed sandstone (ashlar), near white so vertex colours tint it: 2 m a repeat.
var stoneTex = null;
export function stoneTexture() {
  if (stoneTex) return stoneTex;
  var c = document.createElement('canvas'); c.width = c.height = 512;
  var x = c.getContext('2d'), r = rng(23);
  x.fillStyle = '#cfc2b0'; x.fillRect(0, 0, 512, 512);
  var rows = 5, rh = 512 / rows;
  for (var j = 0; j < rows; j++) {
    var xx = -r() * 200;
    while (xx < 512) {
      var w = 150 + r() * 190, v = 0.9 + r() * 0.1;
      var g = x.createLinearGradient(0, j * rh, 0, (j + 1) * rh);
      var c1 = 'rgb(' + Math.round(255 * v) + ',' + Math.round(249 * v) + ',' + Math.round(240 * v) + ')';
      var c2 = 'rgb(' + Math.round(240 * v) + ',' + Math.round(230 * v) + ',' + Math.round(216 * v) + ')';
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      x.fillStyle = g;
      // Draw twice at +-512 so the pattern wraps.
      [0, 512, -512].forEach(function (o) { x.fillRect(xx + 3 + o, j * rh + 3, w - 6, rh - 6); });
      xx += w;
    }
  }
  // Grain and pits.
  for (var k = 0; k < 2600; k++) {
    x.fillStyle = r() < 0.5 ? 'rgba(120,90,60,' + (0.04 + r() * 0.08).toFixed(3) + ')' : 'rgba(255,250,240,' + (0.05 + r() * 0.1).toFixed(3) + ')';
    x.fillRect(r() * 512, r() * 512, 1 + r() * 2.5, 1 + r() * 2);
  }
  stoneTex = new THREE.CanvasTexture(c);
  stoneTex.colorSpace = THREE.SRGBColorSpace; stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping; stoneTex.anisotropy = 4;
  return stoneTex;
}
// An onion dome of radius R on a drum at y0: lathe geometry, plus a lotus crown.
export function onionDome(R, y0, color, seg) {
  var prof = [[0.88, 0], [0.97, 0.12], [1.06, 0.36], [1.1, 0.6], [1.06, 0.86], [0.92, 1.1], [0.7, 1.32], [0.45, 1.5], [0.24, 1.62], [0.1, 1.7], [0.03, 1.76], [0, 1.78]]
    .map(function (p) { return new THREE.Vector2(p[0] * R, y0 + p[1] * R); });
  var parts = [tinted(new THREE.LatheGeometry(prof, seg || 20), color)];
  // Lotus leaves round the base, and a kalash finial.
  var n = seg || 20;
  for (var k = 0; k < n; k++) {
    var a = k / n * Math.PI * 2;
    parts.push(tinted(new THREE.SphereGeometry(1, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.16 * R, 0.24 * R, 0.07 * R)
      .rotateX(-0.25).translate(0, y0 - 0.02 * R, 0.86 * R).rotateY(a), color));
  }
  var top = y0 + 1.78 * R;
  parts.push(tinted(new THREE.CylinderGeometry(0.05 * R, 0.09 * R, 0.08 * R, 10).translate(0, top + 0.02 * R, 0), '#d9a441'));
  parts.push(tinted(new THREE.SphereGeometry(0.1 * R, 10, 6).translate(0, top + 0.14 * R, 0), '#d9a441'));
  parts.push(tinted(new THREE.SphereGeometry(0.06 * R, 8, 5).translate(0, top + 0.3 * R, 0), '#d9a441'));
  parts.push(tinted(new THREE.ConeGeometry(0.025 * R, 0.4 * R, 6).translate(0, top + 0.52 * R, 0), '#d9a441'));
  return merge(parts);
}

// ── Rangoli: painted once on a canvas ────────────────────────────────────
var rangoliTex = null;
export function rangoliTexture() {
  if (rangoliTex) return rangoliTex;
  var c = document.createElement('canvas'); c.width = c.height = 512;
  var x = c.getContext('2d'); x.translate(256, 256);
  function petals(n, rIn, rOut, wid, color, rot) {
    x.fillStyle = color;
    for (var k = 0; k < n; k++) {
      x.save(); x.rotate(k / n * Math.PI * 2 + (rot || 0));
      x.beginPath(); x.moveTo(0, rIn);
      x.quadraticCurveTo(wid, (rIn + rOut) / 2, 0, rOut); x.quadraticCurveTo(-wid, (rIn + rOut) / 2, 0, rIn);
      x.fill(); x.restore();
    }
  }
  function ring(rad, w, color) { x.strokeStyle = color; x.lineWidth = w; x.beginPath(); x.arc(0, 0, rad, 0, Math.PI * 2); x.stroke(); }
  function dots(n, rad, size, color) { x.fillStyle = color; for (var k = 0; k < n; k++) { var a = k / n * Math.PI * 2; x.beginPath(); x.arc(Math.cos(a) * rad, Math.sin(a) * rad, size, 0, 7); x.fill(); } }
  petals(16, 170, 248, 44, '#e8590c'); petals(16, 175, 236, 26, '#ffb21a');
  ring(168, 10, '#fff3dc'); dots(48, 152, 5, '#fff3dc');
  petals(12, 70, 145, 40, '#b5173a', Math.PI / 12); petals(12, 78, 135, 22, '#f06a8a', Math.PI / 12);
  petals(8, 30, 82, 30, '#ffc21f'); ring(66, 6, '#fff3dc');
  x.fillStyle = '#ff8c00'; x.beginPath(); x.arc(0, 0, 30, 0, 7); x.fill();
  x.fillStyle = '#fff3dc'; x.beginPath(); x.arc(0, 0, 12, 0, 7); x.fill();
  rangoliTex = new THREE.CanvasTexture(c); rangoliTex.colorSpace = THREE.SRGBColorSpace; rangoliTex.anisotropy = 4;
  return rangoliTex;
}
export function rangoli(group, mat, x, y, z, size, rot) {
  var m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), mat);
  m.position.set(x, y + 0.025, z); m.rotation.y = rot || 0; m.renderOrder = 1;
  group.add(m);
  return m;
}

// ── Light pools on the ground ────────────────────────────────────────────
export function pool(group, tex, x, y, z, size, sx) {
  var m = new THREE.Mesh(new THREE.PlaneGeometry(size * (sx || 1), size).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
  m.position.set(x, y + 0.06, z); m.renderOrder = 1;
  group.add(m);
  return m;
}
