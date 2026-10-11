/*
 * The gate: the first thing a guest sees, in place of the door video.
 *
 * A floral wedding entrance (pravesh dwar) at the court's front, in the last
 * of the night. A deep cusped arch, densely covered in flowers in bands
 * (white and red roses at its inner edge, a field of orange marigolds with
 * yellow diamonds, pink roses and a yellow rim outside), with a marigold and
 * mango-leaf toran, strands (ladis) of marigold and jasmine falling down its
 * sides, a curtain of jasmine glowing in the arch over the doors and a gold
 * kalash on its crown. The doors are ivory, carved and gilded, hung with
 * bells and garlands. Either side, a wall of flowers carries an elephant in
 * white blossoms with its trunk raised towards the doors; sheer drapes swag
 * from the arch to slim brass poles; tall brass samai lamps, urns of flowers,
 * a flowering hedge and fairy lights; a red runner lined with diyas, a
 * rangoli and petals on the ground.
 *
 * Every flower is an instance (one mesh per kind: marigolds, roses, jasmine,
 * mango leaves); the big surfaces under them carry painted flowers, so the
 * gaps read as more flowers and phones can draw fewer.
 *
 * open(done) swings the doors in and pushes the camera through into the
 * dawn courtyard, then calls done(). Local coordinates match court.js: the
 * doorway at the origin, the outside towards +z.
 */
import { THREE, clamp, lerp, smooth, rng, col, box, pointedArch, shapeFrom, swag, mergeUV, PointSet, pointKit,
         GLOW_F, HALO_F, FLAME_F, rangoliTexture, rangoli, pool, diyaBowls, Q, tag } from '../lib.js';
import { tinted, merge, softSprite } from '../../immersive/kit.js';

var DOOR_Z = -1.1, DOOR_H = 4.2, DOOR_W = 1.69, OPEN_W = 3.4;
var GX = 2.9, GZ0 = -1.15, GZ1 = 0.6;            // the arch's outer half-width, back and front faces
var SPRING = 4.4, CROWN = 7.6, IN_APEX = 6.35;
var WX0 = GX - 0.05, WING = 3.75, WZ0 = 0.08, WZ1 = 0.42;   // the flower walls either side

// ── Painted flowers ──────────────────────────────────────────────────────
// One small flower on a canvas: kind 0 marigold, 1 rose, 2 white blossom, 3 leaf.
function paintFlower(x, cx, cy, r, kind, c, rot) {
  if (kind === 3) {
    x.save(); x.translate(cx, cy); x.rotate(rot); x.fillStyle = c;
    x.beginPath(); x.ellipse(0, 0, r * 1.25, r * 0.5, 0, 0, 7); x.fill(); x.restore(); return;
  }
  var base = c.isColor ? c.clone() : col(c), dark = base.clone().multiplyScalar(0.62), lite = base.clone().lerp(col('#ffffff'), kind === 2 ? 0.5 : 0.28);
  x.fillStyle = '#' + dark.getHexString(); x.beginPath(); x.arc(cx, cy + r * 0.12, r * 1.04, 0, 7); x.fill();
  x.fillStyle = '#' + base.getHexString(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
  var n = kind === 0 ? 9 : kind === 1 ? 5 : 6;
  x.fillStyle = '#' + lite.getHexString();
  for (var k = 0; k < n; k++) {
    var a = rot + k / n * Math.PI * 2, rr = kind === 0 ? 0.62 : 0.5;
    x.beginPath(); x.arc(cx + Math.cos(a) * r * rr, cy + Math.sin(a) * r * rr, r * (kind === 0 ? 0.36 : 0.42), 0, 7); x.fill();
  }
  if (kind === 1) {   // a rose's whorl
    x.strokeStyle = '#' + dark.getHexString(); x.lineWidth = Math.max(1, r * 0.18);
    x.beginPath(); x.arc(cx, cy, r * 0.45, rot, rot + 4.2); x.stroke();
    x.beginPath(); x.arc(cx, cy, r * 0.2, rot + 2, rot + 6); x.stroke();
  } else {
    x.fillStyle = kind === 2 ? '#f2c94a' : '#' + dark.getHexString();
    x.beginPath(); x.arc(cx, cy, r * 0.22, 0, 7); x.fill();
  }
}
// Fill a canvas with flowers on a jittered grid; pick(u, v) -> [kind, colour].
function paintBed(size, spacing, radius, seed, bg, pick) {
  var c = document.createElement('canvas'); c.width = c.height = size;
  var x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = bg; x.fillRect(0, 0, size, size);
  // Leaves first, then flowers over them.
  for (var pass = 0; pass < 2; pass++) {
    var sp = pass ? spacing : spacing * 1.6;
    for (var gy = -sp; gy < size + sp; gy += sp) for (var gx = -sp; gx < size + sp; gx += sp) {
      var px = gx + (r() - 0.5) * sp * 0.9, py = gy + (r() - 0.5) * sp * 0.9;
      if (!pass) { paintFlower(x, px, py, radius * 0.9, 3, r() < 0.5 ? '#2e5a1c' : '#3d6e24', r() * 6); continue; }
      var p = pick((px + size) % size / size, 1 - (py + size) % size / size, r);
      if (p) paintFlower(x, px, py, radius * (0.85 + r() * 0.3), p[0], p[1], r() * 6);
    }
  }
  var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

// The elephant on each flower wall, facing +x (towards the doors once
// placed): its outline, ear, tusk and saddle cloth, in units of about a metre.
var ELE = [[0.12, 0], [0.36, 0], [0.37, 0.3], [0.5, 0.27], [0.7, 0.26], [0.86, 0.29], [0.9, 0], [1.13, 0], [1.15, 0.34], [1.22, 0.46],
  [1.3, 0.52], [1.4, 0.58], [1.46, 0.62], [1.54, 0.66], [1.62, 0.76], [1.68, 0.9], [1.71, 1.05], [1.7, 1.2], [1.65, 1.31], [1.57, 1.36],
  [1.51, 1.33], [1.55, 1.27], [1.6, 1.18], [1.61, 1.06], [1.59, 0.95], [1.54, 0.86], [1.48, 0.82], [1.45, 0.92], [1.42, 1.04], [1.36, 1.12],
  [1.26, 1.16], [1.15, 1.15], [1.05, 1.09], [0.86, 1.12], [0.6, 1.13], [0.36, 1.08], [0.18, 0.98], [0.07, 0.82], [0.03, 0.62], [0, 0.5],
  [0.02, 0.36], [0.08, 0.3], [0.1, 0.12]];
var EAR = [[1.0, 0.66], [1.2, 0.7], [1.25, 0.98], [1.12, 1.05], [0.99, 0.94], [0.97, 0.78]];
var TUSK = [[1.4, 0.61], [1.5, 0.56], [1.57, 0.59], [1.49, 0.64]];
var JHOOL = [[0.34, 0.56], [0.97, 0.58], [0.99, 1.2], [0.32, 1.2]];
var ES = 1.62, EX = 0.42, EY = 0.42;      // its scale and place on the wall (wall coordinates, x from the doors)
function eleAt(p) { return [WING - (EX + p[0] * ES), EY + p[1] * ES]; }   // facing the doors: mirrored on the wall
function inPoly(px, py, poly) {
  var inside = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distPoly(px, py, poly, closed) {
  var best = 1e9;
  for (var i = 0; i < poly.length - (closed ? 0 : 1); i++) {
    var a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1];
    var t = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    best = Math.min(best, Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t));
  }
  return best;
}
// The wall's top edge: a gentle rise with scallops, high by the arch.
function wingTop(lx) { var t = lx / WING; return lerp(3.55, 3.0, t) + 0.22 * Math.sin(Math.PI * t) + 0.07 * Math.abs(Math.sin(Math.PI * 6 * t)); }

// ── Flower shapes (white, so instances colour them) ──────────────────────
function shadeBy(geo, fn) {
  var p = geo.attributes.position, c = new Float32Array(p.count * 3);
  for (var i = 0; i < p.count; i++) { var k = fn(p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
// Soft, rounded shading for small flowers: normals from a centre (or blended towards +z).
function roundNormals(g, fz) {
  var p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
  for (var i = 0; i < p.count; i++) { v.set(p.getX(i), p.getY(i) * 1.2, p.getZ(i) + (fz || 0)).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  n.needsUpdate = true;
  return g;
}
function fromTris(pts) {
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([].concat.apply([], pts), 3));
  g.computeVertexNormals();
  return g;
}
// A marigold: a ruffled ball (a six-sided double pyramid with a zigzag waist); phones an octahedron.
function marigoldGeo() {
  var g;
  if (Q.small) g = new THREE.OctahedronGeometry(1, 0).scale(1, 0.82, 1);
  else {
    var top = [0, 0.78, 0], bot = [0, -0.72, 0], ring = [], t = [];
    for (var k = 0; k < 6; k++) { var a = k / 6 * Math.PI * 2, odd = k % 2; ring.push([Math.cos(a) * (odd ? 0.9 : 1), odd ? 0.16 : -0.08, Math.sin(a) * (odd ? 0.9 : 1)]); }
    for (k = 0; k < 6; k++) { var A = ring[k], B = ring[(k + 1) % 6]; t.push(top, B, A, bot, A, B); }
    g = fromTris(t);
  }
  return roundNormals(shadeBy(g, function (x, y) { return y > 0.6 ? 0.8 : lerp(0.6, 1.08, smooth(-0.8, 0.3, y)); }));
}
// A rose facing +z: a scalloped ring of petals round a darker heart.
function roseGeo() {
  var n = 5, ring = [], t = [], front = [0, 0, 0.42], back = [0, 0, -0.3];
  for (var k = 0; k < n; k++) { var a = k / n * Math.PI * 2, rr = k % 2 ? 0.86 : 1; ring.push([Math.cos(a) * rr, Math.sin(a) * rr, k % 2 ? 0.08 : 0]); }
  for (k = 0; k < n; k++) { var A = ring[k], B = ring[(k + 1) % n]; t.push(front, A, B, back, B, A); }
  return roundNormals(shadeBy(fromTris(t), function (x, y, z) { return z > 0.4 ? 0.5 : z < -0.2 ? 0.55 : 1.05; }), 0.5);
}
// A jasmine bud, and a mango leaf (tip down, facing +z).
function budGeo() { return roundNormals(shadeBy(new THREE.OctahedronGeometry(1, 0).scale(0.6, 1, 0.6), function (x, y) { return y < -0.5 ? 0.82 : 1; })); }
function leafGeo() {
  return shadeBy(fromTris([[0, 0, 0], [0.24, -0.45, 0.05], [0, -1, 0], [0, 0, 0], [0, -1, 0], [-0.24, -0.45, 0.05]]), function (x, y) { return y < -0.9 ? 0.8 : 1; });
}
// Instances of one kind of flower: [x, y, z, size, colour, normal or null].
function Bed() { this.l = []; }
Bed.prototype.add = function (x, y, z, s, c, n) { this.l.push([x, y, z, s, c, n || null]); };
var Z = new THREE.Vector3(0, 0, 1);
Bed.prototype.mesh = function (geo, mat, r, thin, spin) {
  var n = this.l.length, m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
  var mt = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), nv = new THREE.Vector3();
  this.l.forEach(function (f, k) {
    if (f[5] && f[5].isQuaternion) q.copy(f[5]);
    else if (f[5]) { q.setFromUnitVectors(Z, nv.fromArray(f[5]).normalize()); q2.setFromAxisAngle(Z, (r() - 0.5) * (spin == null ? 6.28 : spin)); q.multiply(q2); }
    else q.setFromEuler(e.set(r() * 6.28, r() * 6.28, r() * 6.28));
    m.setMatrixAt(k, mt.compose(p.set(f[0], f[1], f[2]), q, s.setScalar(f[3])));
    m.setColorAt(k, f[4]);
  });
  m.count = n;
  if (thin) m.userData.thin = true;
  return m;
};

// ── The doors: ivory, carved and gilded ──────────────────────────────────
function doorTexture() {
  var w = 400, h = 1000, c = document.createElement('canvas'); c.width = w; c.height = h;
  var x = c.getContext('2d'), r = rng(12);
  var g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#e6d2ac'); g.addColorStop(0.5, '#f0e2c4'); g.addColorStop(1, '#e6d2ac');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (var k = 0; k < 60; k++) { x.fillStyle = 'rgba(150,110,60,' + (0.02 + r() * 0.04).toFixed(3) + ')'; x.fillRect(r() * w, 0, 1 + r() * 2, h); }
  var GOLD = '#c99a3c', GL = '#f4d98a', SH = 'rgba(90,60,20,0.45)';
  function carve(fn) {      // draw a carving three times: shadow, gold, highlight
    x.save(); x.translate(2, 3); x.strokeStyle = SH; x.fillStyle = SH; fn(); x.restore();
    x.save(); x.strokeStyle = GOLD; x.fillStyle = GOLD; fn(); x.restore();
    x.save(); x.translate(-1, -1); x.globalAlpha = 0.55; x.strokeStyle = GL; x.fillStyle = GL; x.lineWidth *= 0.5; fn(); x.restore();
  }
  function frame(x0, y0, x1, y1, arch) {
    carve(function () {
      x.lineWidth = 7; x.beginPath();
      if (arch) { x.moveTo(x0, y1); x.lineTo(x0, y0 + (x1 - x0) / 2); x.quadraticCurveTo(x0, y0, (x0 + x1) / 2, y0); x.quadraticCurveTo(x1, y0, x1, y0 + (x1 - x0) / 2); x.lineTo(x1, y1); x.closePath(); }
      else x.rect(x0, y0, x1 - x0, y1 - y0);
      x.stroke();
      x.lineWidth = 2.5; x.beginPath();
      if (arch) { x.moveTo(x0 + 12, y1 - 12); x.lineTo(x0 + 12, y0 + (x1 - x0) / 2); x.quadraticCurveTo(x0 + 12, y0 + 12, (x0 + x1) / 2, y0 + 12); x.quadraticCurveTo(x1 - 12, y0 + 12, x1 - 12, y0 + (x1 - x0) / 2); x.lineTo(x1 - 12, y1 - 12); x.closePath(); }
      else x.rect(x0 + 12, y0 + 12, x1 - x0 - 24, y1 - y0 - 24);
      x.stroke();
    });
  }
  function lotus(cx, cy, R) {
    carve(function () {
      x.lineWidth = 3;
      for (var ring = 0; ring < 2; ring++) {
        var n = ring ? 8 : 12, rr = ring ? R * 0.62 : R;
        for (var k = 0; k < n; k++) {
          var a = k / n * Math.PI * 2 + ring * 0.2;
          x.save(); x.translate(cx, cy); x.rotate(a); x.beginPath();
          x.moveTo(0, -rr * 0.25); x.quadraticCurveTo(rr * 0.28, -rr * 0.62, 0, -rr); x.quadraticCurveTo(-rr * 0.28, -rr * 0.62, 0, -rr * 0.25); x.stroke(); x.restore();
        }
      }
      x.beginPath(); x.arc(cx, cy, R * 0.2, 0, 7); x.fill();
      x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, R * 1.08, 0, 7); x.stroke();
    });
  }
  function vine(x0, y0, x1, y1, n) {
    carve(function () {
      x.lineWidth = 2.5; x.beginPath();
      for (var k = 0; k <= 40; k++) { var t = k / 40, px = lerp(x0, x1, t) + Math.sin(t * n * Math.PI) * 9, py = lerp(y0, y1, t); if (k) x.lineTo(px, py); else x.moveTo(px, py); }
      x.stroke();
      for (k = 1; k < n * 2; k++) {
        var t2 = k / (n * 2), qx = lerp(x0, x1, t2) + Math.sin(t2 * n * Math.PI) * 9, qy = lerp(y0, y1, t2), sd = k % 2 ? 1 : -1;
        x.beginPath(); x.ellipse(qx + sd * 9, qy, 7, 3.5, sd * 0.6, 0, 7); x.fill();
      }
    });
  }
  // Border, three panels, a lotus in the middle one, vines, and a kalash of flowers below.
  frame(14, 14, w - 14, h - 14, false);
  frame(46, 58, w - 46, 330, true);
  frame(46, 366, w - 46, 646, false);
  frame(46, 682, w - 46, h - 46, false);
  lotus(w / 2, 506, 92);
  lotus(w / 2, 214, 54);
  vine(30, 40, 30, h - 40, 14); vine(w - 30, 40, w - 30, h - 40, 14);
  carve(function () {
    x.lineWidth = 3; var cx = w / 2, cy = 860;
    x.beginPath(); x.moveTo(cx - 34, cy + 60); x.quadraticCurveTo(cx - 70, cy + 10, cx - 30, cy - 18); x.lineTo(cx + 30, cy - 18); x.quadraticCurveTo(cx + 70, cy + 10, cx + 34, cy + 60); x.closePath(); x.stroke();
    for (var k = -2; k <= 2; k++) { x.beginPath(); x.moveTo(cx, cy - 18); x.quadraticCurveTo(cx + k * 34, cy - 70, cx + k * 52, cy - 96 + Math.abs(k) * 16); x.stroke(); x.beginPath(); x.arc(cx + k * 52, cy - 100 + Math.abs(k) * 16, 9, 0, 7); x.fill(); }
  });
  var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// One leaf, hinge at x = 0, running to +x; front towards +z.
function leafParts(r) {
  var W = DOOR_W, H = DOOR_H, F = 0.06;
  var body = new THREE.BoxGeometry(W, H, F * 2).translate(W / 2, H / 2, 0).toNonIndexed();
  var uv = body.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setXY(i, 0.012, 0.5);     // plain ivory on the edges
  var front = new THREE.PlaneGeometry(W, H).translate(W / 2, H / 2, F + 0.002).toNonIndexed();
  var back = new THREE.PlaneGeometry(W, H).rotateY(Math.PI).translate(W / 2, H / 2, -F - 0.002).toNonIndexed();
  var wood = mergeUV([tinted(body, '#e8d6b4'), tinted(front, '#ffffff'), tinted(back, '#efe2c8')]);
  // Gilt mouldings, the ring knocker, and bells hung along the top rail.
  var gold = [];
  [[0, W, H - 0.08, H], [0, W, 0, 0.08], [0, 0.07, 0, H], [W - 0.07, W, 0, H]].forEach(function (q) {
    gold.push(tinted(new THREE.BoxGeometry(q[1] - q[0], q[3] - q[2], 0.03).translate((q[0] + q[1]) / 2, (q[2] + q[3]) / 2, F + 0.015), '#ffffff'));
  });
  gold.push(tinted(new THREE.TorusGeometry(0.12, 0.018, 6, 18).translate(W - 0.3, 1.6, F + 0.1), '#ffffff'));
  gold.push(tinted(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12).rotateX(Math.PI / 2).translate(W - 0.3, 1.72, F + 0.04), '#ffffff'));
  var bellProf = [[0.01, 0], [0.2, 0], [0.19, 0.05], [0.15, 0.14], [0.12, 0.26], [0.09, 0.32], [0.04, 0.35], [0, 0.36]].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  [0.42, 1.27].forEach(function (bx) {
    gold.push(tinted(new THREE.LatheGeometry(bellProf, Q.small ? 7 : 10).scale(0.42, 0.42, 0.42).translate(bx, H - 0.62, F + 0.09), '#ffffff'));
    gold.push(tinted(new THREE.CylinderGeometry(0.006, 0.006, 0.36, 3).translate(bx, H - 0.29, F + 0.09), '#ffffff'));
    gold.push(tinted(new THREE.SphereGeometry(0.022, 5, 3).translate(bx, H - 0.63, F + 0.09), '#ffffff'));
  });
  // Garlands: a marigold swag across the leaf and a strand down its meeting edge (leaf coordinates).
  var balls = [];
  swag([0.12, H - 0.42, F + 0.11], [W - 0.08, H - 0.42, F + 0.11], 0.36, Q.small ? 11 : 16, function (px, py, pz) { balls.push([px, py, pz, 0.058]); });
  for (var k = 0; k < (Q.small ? 14 : 20); k++) balls.push([W - 0.12, H - 0.48 - k * 0.12, F + 0.1, 0.055]);
  return { wood: wood, gold: merge(gold), balls: balls };
}

export function build(W, opts) {
  var small = Q.small, o = opts.origin;
  var r = rng(1729);
  var group = new THREE.Group();
  group.position.set(o.x, 0, o.z);
  var U = { uTime: { value: 0 }, uScale: { value: 600 }, uFogD: { value: 0.004 }, uCrack: { value: 1 }, uOpen: { value: 0 }, uLit: { value: 1 }, uFlies: { value: 1 } };
  var pk = pointKit(U, group);
  var C = function (h) { return col(h); };
  var MARI = ['#ff8c00', '#f57c00', '#ff9a0a', '#e8650c'].map(C), YEL = ['#ffc21f', '#ffb31a', '#ffd23a'].map(C);
  var RED = ['#c8102e', '#b00c28', '#d81e3a'].map(C), PINK = ['#f48fb1', '#ff9ab8', '#f7a8c4'].map(C), WHITE = ['#fff6ee', '#fff0e2', '#ffffff'].map(C);
  var MAG = ['#d6336c', '#c2255c', '#e64980'].map(C);
  var JAS = ['#fffaf0', '#fff4e0'].map(C), LEAF = ['#2f5a1c', '#3c6a24', '#356020'].map(C);
  function pickC(a) { return a[(r() * a.length) | 0]; }
  var mari = new Bed(), rose = new Bed(), bud = new Bed(), leaf = new Bed(), stone = [];
  var halos = new PointSet(), fairy = new PointSet();
  var cWarm = col('#ffb862'), cFairy = [col('#ffd88a'), col('#ffe6b0'), col('#ffc060'), col('#fff0c8')];

  // ── The arch ───────────────────────────────────────────────────────────
  var inner = pointedArch(OPEN_W, DOOR_H, IN_APEX, 7, 0.13, 22), outer = pointedArch(GX * 2, SPRING, CROWN, 0, 0, 26);
  var sh = new THREE.Shape();
  sh.moveTo(-GX, 0); sh.lineTo(-OPEN_W / 2, 0);
  for (var i = 1; i < inner.length - 1; i++) sh.lineTo(inner[i][0], inner[i][1]);
  sh.lineTo(OPEN_W / 2, 0); sh.lineTo(GX, 0);
  for (i = outer.length - 2; i >= 1; i--) sh.lineTo(outer[i][0], outer[i][1]);
  sh.closePath();
  var archGeo = new THREE.ExtrudeGeometry(sh, { depth: GZ1 - GZ0, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, GZ0);
  var baseTex = paintBed(512, 26, 13, 21, '#2a3a14', function (u, v, rr) {
    var q = rr(); return q < 0.55 ? [0, pickC(MARI)] : q < 0.8 ? [0, pickC(YEL)] : q < 0.92 ? [1, pickC(RED)] : [2, pickC(WHITE)];
  });
  baseTex.repeat.set(1 / 1.3, 1 / 1.3);
  var archMat = new THREE.MeshLambertMaterial({ map: baseTex, emissive: '#2a1004' });
  group.add(new THREE.Mesh(archGeo, archMat));
  // The inner outline's length along the way, for motifs that run round the arch.
  var innerLen = [0];
  for (i = 1; i < inner.length; i++) innerLen.push(innerLen[i - 1] + Math.hypot(inner[i][0] - inner[i - 1][0], inner[i][1] - inner[i - 1][1]));
  var midLen = innerLen[innerLen.length - 1] / 2;
  function alongInner(px, py) {
    var best = 1e9, s = 0;
    for (var k = 0; k + 1 < inner.length; k++) {
      var a = inner[k], b = inner[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      var t = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / (L * L), 0, 1), d = Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t);
      if (d < best) { best = d; s = innerLen[k] + L * t; }
    }
    return Math.abs(s - midLen);
  }
  // The front: flowers in bands from the inner edge out.
  var FZ = GZ1, h = small ? 0.17 : 0.128;
  var innerPoly = inner.slice(), outerPoly = outer.slice();
  for (var gy = 0.3; gy < CROWN; gy += h) for (var gx = -GX; gx <= GX; gx += h) {
    var px = gx + (r() - 0.5) * h * 0.7, py = gy + (r() - 0.5) * h * 0.7;
    if (!inPoly(px, py, outerPoly) || inPoly(px, py, innerPoly)) continue;
    var di = distPoly(px, py, innerPoly, false), dout = distPoly(px, py, outerPoly, false), t = di / (di + dout);
    var u = alongInner(px, py), fz = FZ + 0.04 + r() * 0.03;
    var dia = Math.abs((u / 0.62) % 1 - 0.5) * 2 * 0.31 / 0.2 + Math.abs(t - 0.52) / 0.2;
    if (t < 0.13) rose.add(px, py, fz, 0.07 + r() * 0.012, pickC(WHITE), [0, 0, 1]);
    else if (t < 0.3) rose.add(px, py, fz, 0.075 + r() * 0.012, pickC(RED), [0, 0, 1]);
    else if (t < 0.74) {
      if (dia < 0.32) rose.add(px, py, fz + 0.01, 0.08, pickC(PINK), [0, 0, 1]);
      else mari.add(px, py, fz, (small ? 0.098 : 0.08) + r() * 0.012, dia < 1 ? pickC(YEL) : pickC(MARI));
    }
    else if (t < 0.88) rose.add(px, py, fz, 0.075 + r() * 0.012, pickC(PINK), [0, 0, 1]);
    else mari.add(px, py, fz, (small ? 0.095 : 0.078) + r() * 0.01, pickC(YEL));
  }
  // The reveal: marigold rows round the inside of the arch, red roses at its mouth.
  var hr = small ? 0.3 : 0.23;
  for (var s0 = 0; s0 < innerLen[innerLen.length - 1]; s0 += hr) {
    var k0 = 0; while (k0 + 1 < innerLen.length && innerLen[k0 + 1] < s0) k0++;
    var A = inner[k0], B = inner[Math.min(k0 + 1, inner.length - 1)], L0 = (innerLen[k0 + 1] || innerLen[k0]) - innerLen[k0] || 1, tt = (s0 - innerLen[k0]) / L0;
    var ex = lerp(A[0], B[0], tt), ey = lerp(A[1], B[1], tt);
    if (ey < 0.3) continue;
    // Inward normal (into the opening): the outline runs up the left side, over and down the right.
    var tx = B[0] - A[0], ty = B[1] - A[1], tl = Math.hypot(tx, ty) || 1, nx = ty / tl, ny = -tx / tl;
    for (var zz = -0.8; zz < GZ1 - 0.02; zz += hr) {
      var jz = zz + (r() - 0.5) * hr * 0.5, row = Math.floor((jz + 1) / 0.34);
      var qx = ex + nx * 0.03, qy = ey + ny * 0.03;
      if (jz > GZ1 - 0.16) rose.add(qx, qy, jz, 0.075, pickC(RED), [nx, ny, 0]);
      else mari.add(qx, qy, jz, (small ? 0.11 : 0.088) + r() * 0.012, row % 2 ? pickC(YEL) : pickC(MARI));
    }
  }
  // The toran across the doorway, and a fringe of strands under the arch.
  var TY = DOOR_H + 0.22, TZ = FZ + 0.16, TW = OPEN_W / 2;
  swag([-TW, TY, TZ], [TW, TY, TZ], 0.06, small ? 26 : 38, function (x, y, z, t2, kk) {
    mari.add(x, y, z, 0.07, kk % 4 === 0 ? pickC(YEL) : pickC(MARI));
    if (kk % 2) leaf.add(x, y - 0.07, z + 0.03, 0.2, pickC(LEAF), [0, 0, 1]);
  });
  // Ladis: long strands down both sides of the doorway, marigold with jasmine and a rose now and then.
  function strand(x, y0, z, n, step, rad, phase) {
    for (var k = 0; k < n; k++) {
      var y = y0 - k * step;
      if ((k + phase) % 6 === 5) rose.add(x, y, z, rad * 0.95, pickC(RED), [0, 0, 1]);
      else if ((k + phase) % 3 === 2) bud.add(x, y, z, rad * 0.7, pickC(JAS));
      else mari.add(x, y, z, rad, (k + phase) % 2 ? pickC(YEL) : pickC(MARI));
    }
  }
  [-1, 1].forEach(function (s) {
    var nS = small ? 2 : 3;
    for (var j = 0; j < nS; j++) {
      var sx = s * (TW + 0.08 + j * 0.16);
      strand(sx, SPRING - 0.05 - j * 0.1, FZ + 0.12 + (j % 2) * 0.05, Math.round((SPRING - 0.8 - j * 0.6) / 0.11), 0.11, 0.058, j * 2);
    }
    // And at the arch's outer edges.
    strand(s * (GX - 0.06), SPRING + 0.1, FZ + 0.1, Math.round((SPRING - 0.6) / 0.11), 0.11, 0.06, 1);
  });
  // Short strands hanging from the arch's inner edge, longer towards its sides.
  for (i = 2; i < inner.length - 2; i += small ? 3 : 2) {
    var ip = inner[i];
    if (ip[1] < DOOR_H + 0.3) continue;
    var len = Math.max(0, ip[1] - (DOOR_H + 0.35)) * 0.55 + 0.25;
    strand(ip[0] * 0.98, ip[1] - 0.08, FZ + 0.09, Math.max(2, Math.round(len / 0.1)), 0.1, 0.05, i);
  }
  // Jasmine curtain in the arch over the doors, against the light behind.
  var tymp = inner.filter(function (p) { return p[1] >= DOOR_H - 0.001; });
  for (var cx2 = -TW + 0.12; cx2 <= TW - 0.1; cx2 += small ? 0.22 : 0.17) {
    var topY = DOOR_H;
    for (i = 0; i + 1 < tymp.length; i++) if ((tymp[i][0] - cx2) * (tymp[i + 1][0] - cx2) <= 0) topY = Math.max(topY, lerp(tymp[i][1], tymp[i + 1][1], (cx2 - tymp[i][0]) / ((tymp[i + 1][0] - tymp[i][0]) || 1)));
    for (var by = topY - 0.1; by > DOOR_H + 0.06; by -= small ? 0.12 : 0.095) bud.add(cx2, by, DOOR_Z + 0.22 + (r() - 0.5) * 0.04, 0.046, pickC(JAS));
  }
  var tg = new THREE.ShapeGeometry(shapeFrom([[-TW, DOOR_H]].concat(tymp, [[TW, DOOR_H]])), 1);
  var behindMat = new THREE.MeshBasicMaterial({ color: '#ffb064', transparent: true, fog: false });
  var behind = new THREE.Mesh(tg.translate(0, 0, DOOR_Z - 0.04), behindMat);
  group.add(behind);
  halos.add(0, DOOR_H + 0.9, DOOR_Z + 0.3, 0, 0.5, 0, 2.4, cWarm);

  // The kalash on the crown: a gold pot, mango leaves, a coconut, on a cushion of marigolds.
  var gold = [];
  var KY = CROWN - 0.08, KZ = (GZ0 + GZ1) / 2 + 0.25;
  gold.push(tinted(new THREE.LatheGeometry([[0, 0], [0.22, 0.02], [0.3, 0.16], [0.32, 0.3], [0.24, 0.46], [0.13, 0.52], [0.17, 0.58], [0, 0.6]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), small ? 10 : 14).translate(0, KY, KZ), '#ffffff'));
  // Mango leaves fanning up and out of its mouth (the leaf's tip is its -y).
  for (i = 0; i < 7; i++) {
    var la = i / 7 * Math.PI * 2, tipDir = new THREE.Vector3(Math.cos(la) * 0.8, 0.6, Math.sin(la) * 0.8).normalize();
    leaf.add(Math.cos(la) * 0.08, KY + 0.58, KZ + Math.sin(la) * 0.08, 0.42, pickC(LEAF), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), tipDir));
  }
  var nut = tinted(new THREE.SphereGeometry(0.15, 9, 6).scale(1, 1.25, 1).translate(0, KY + 0.74, KZ), '#7a4a24');
  for (i = 0; i < 14; i++) { var ka = i / 14 * Math.PI * 2; mari.add(Math.cos(ka) * 0.34, KY + 0.02, KZ + Math.sin(ka) * 0.34, 0.085, i % 2 ? pickC(YEL) : pickC(MARI)); }
  halos.add(0, KY + 0.4, KZ + 0.2, 0, 0.3, 0, 1.4, col('#ffcf80'));

  // ── The flower walls either side, each with its elephant ───────────────
  var eleW = ELE.map(eleAt), earW = EAR.map(eleAt), tuskW = TUSK.map(eleAt), jhoolW = JHOOL.map(eleAt);
  var wallTex = paintBed(1024, 19, 9.5, 33, '#24361a', function (u, v, rr) {
    var lx = u * WING, ly = v * WING, top = wingTop(lx);
    if (ly > top + 0.05) return null;
    if (lx < 0.16 || lx > WING - 0.16 || ly < 0.22 || ly > top - 0.14) return [0, rr() < 0.7 ? pickC(MARI) : pickC(YEL)];
    if (lx < 0.26 || lx > WING - 0.26 || ly < 0.3 || ly > top - 0.24) return [1, pickC(RED)];
    if (inPoly(lx, ly, eleW)) {
      if (inPoly(lx, ly, tuskW)) return [2, C('#fff3d6')];
      if (inPoly(lx, ly, earW)) return [1, C('#f7b8cc')];
      if (inPoly(lx, ly, jhoolW)) return distPoly(lx, ly, jhoolW, true) < 0.07 ? [0, pickC(YEL)] : [1, pickC(RED)];
      var eye = eleAt([1.33, 0.98]);
      if (Math.hypot(lx - eye[0], ly - eye[1]) < 0.04) return [1, C('#5a1020')];
      if (ly < EY + 0.12 * ES && ly > EY + 0.06 * ES) return [0, pickC(YEL)];      // anklets
      return [2, pickC(WHITE)];
    }
    return [1, rr() < 0.75 ? pickC(MAG) : pickC(PINK)];
  });
  wallTex.wrapS = wallTex.wrapT = THREE.ClampToEdgeWrapping;
  wallTex.repeat.set(1 / WING, 1 / WING);
  var wsh = new THREE.Shape(); wsh.moveTo(0, 0); wsh.lineTo(WING, 0);
  for (i = 24; i >= 0; i--) wsh.lineTo(i / 24 * WING, wingTop(i / 24 * WING));
  wsh.closePath();
  var esh = shapeFrom(eleW.slice().reverse());
  var wallParts = [];
  [-1, 1].forEach(function (s) {
    [new THREE.ExtrudeGeometry(wsh, { depth: WZ1 - WZ0, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, WZ0),
     new THREE.ExtrudeGeometry(esh, { depth: 0.07, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, WZ1)].forEach(function (gg) {
      gg.translate(WX0, 0, 0);
      if (s < 0) flipX(gg);
      wallParts.push(tinted(gg, '#ffffff'));
    });
    // Relief: the elephant traced in white roses, its saddle cloth edged in marigolds, marigolds along the wall's top.
    for (var k = 0; k < eleW.length; k++) {
      var a = eleW[k], b = eleW[(k + 1) % eleW.length], segL = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (var d = 0; d < segL; d += small ? 0.15 : 0.11) {
        var lx = lerp(a[0], b[0], d / segL), ly = lerp(a[1], b[1], d / segL);
        mari.add(s * (WX0 + lx), ly, WZ1 + 0.1, small ? 0.07 : 0.06, pickC(YEL));
      }
    }
    for (var lx2 = 0.05; lx2 < WING; lx2 += small ? 0.13 : 0.095) mari.add(s * (WX0 + lx2), wingTop(lx2) - 0.03, (WZ0 + WZ1) / 2 + (r() - 0.5) * 0.12, 0.075, lx2 % 0.38 < 0.19 ? pickC(MARI) : pickC(YEL));
    // Fairy lights along the top.
    for (lx2 = 0.1; lx2 < WING; lx2 += small ? 0.22 : 0.15) fairy.add(s * (WX0 + lx2), wingTop(lx2) + 0.08, WZ1 + 0.05, r(), r(), 0, 0.9, cFairy[(r() * 4) | 0]);
  });
  var wallMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: wallTex, emissive: '#1e0c06' });
  group.add(new THREE.Mesh(mergeUV(wallParts), wallMat));

  // ── Brass: samai lamps, urns, poles; the hedge; the drapes ─────────────
  var brass = [], flames = new PointSet(), lampsAt = [];
  var samai = [[0, 0], [0.36, 0], [0.36, 0.06], [0.24, 0.12], [0.2, 0.2], [0.1, 0.28], [0.07, 0.6], [0.11, 0.66], [0.07, 0.72], [0.055, 1.25],
    [0.1, 1.3], [0.06, 1.36], [0.05, 1.5], [0.3, 1.56], [0.34, 1.62], [0.28, 1.64], [0.05, 1.62], [0.04, 1.74], [0.09, 1.82], [0, 1.95]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var SX = 2.4, SZ = 1.5;
  [-1, 1].forEach(function (s) {
    brass.push(tinted(new THREE.LatheGeometry(samai, small ? 8 : 16).translate(s * SX, 0, SZ), '#ffffff'));
    for (var k = 0; k < 5; k++) { var a = k / 5 * Math.PI * 2; flames.add(s * SX + Math.cos(a) * 0.26, 1.7, SZ + Math.sin(a) * 0.26, 0, r(), 0, 1); }
    lampsAt.push(new THREE.Vector3(o.x + s * SX, 1.9, o.z + SZ));
    for (k = 0; k < (small ? 10 : 16); k++) { var a2 = k / (small ? 10 : 16) * Math.PI * 2; mari.add(s * SX + Math.cos(a2) * 0.42, 0.07, SZ + Math.sin(a2) * 0.42, 0.075, k % 2 ? pickC(YEL) : pickC(MARI)); }
  });
  // Urns of flowers before the walls and along the hedge.
  var urn = [[0, 0], [0.18, 0], [0.2, 0.06], [0.14, 0.14], [0.3, 0.36], [0.33, 0.56], [0.24, 0.72], [0.28, 0.78], [0, 0.78]].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var urns = [7.45, 10.6].reduce(function (a, x) { return a.concat([[-x, 1.05], [x, 1.05]]); }, []);
  urns.forEach(function (u, ui) {
    brass.push(tinted(new THREE.LatheGeometry(urn, small ? 8 : 12).translate(u[0], 0, u[1]), '#ffffff'));
    var nF = small ? 20 : 30;
    for (var k = 0; k < nF; k++) {
      var a = r() * Math.PI * 2, rr2 = Math.sqrt(r()) * 0.34, fy = 0.82 + Math.sqrt(Math.max(0, 0.13 - rr2 * rr2)) * 1.1;
      var fx = u[0] + Math.cos(a) * rr2, fz = u[1] + Math.sin(a) * rr2, n = [fx - u[0], fy - 0.75, fz - u[1]];
      if (k % 3 === 0) rose.add(fx, fy, fz, 0.075, ui % 2 ? pickC(PINK) : pickC(RED), n);
      else mari.add(fx, fy, fz, 0.08, k % 2 ? pickC(MARI) : pickC(YEL));
    }
  });
  // Slim brass poles at the walls' outer ends, for the drapes.
  var PX = WX0 + WING + 0.18, PY = 4.3, PZ0 = 0.5;
  [-1, 1].forEach(function (s) {
    brass.push(tinted(new THREE.CylinderGeometry(0.04, 0.05, PY, 8).translate(s * PX, PY / 2, PZ0), '#ffffff'));
    brass.push(tinted(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 10).translate(s * PX, 0.04, PZ0), '#ffffff'));
    brass.push(tinted(new THREE.SphereGeometry(0.09, 8, 6).translate(s * PX, PY + 0.06, PZ0), '#ffffff'));
    brass.push(tinted(new THREE.ConeGeometry(0.04, 0.2, 6).translate(s * PX, PY + 0.24, PZ0), '#ffffff'));
  });
  brass.push(gold[0]);
  stone.push(nut);
  var brassMat = new THREE.MeshPhongMaterial({ vertexColors: true, color: '#d4a040', specular: '#ffe6a8', shininess: 50, emissive: '#3a2006' });
  group.add(new THREE.Mesh(merge(brass), brassMat));
  // A flowering hedge before the drapes, beyond the poles.
  var hedgeTex = paintBed(256, 15, 7.5, 41, '#2a4a18', function (u, v, rr) { var q = rr(); return q < 0.4 ? [3, q < 0.2 ? '#3d6e24' : '#4f8a30'] : q < 0.6 ? [2, pickC(WHITE)] : q < 0.82 ? [1, pickC(PINK)] : [0, pickC(MARI)]; });
  hedgeTex.repeat.set(0.8, 0.8);
  var hedge = [];
  [-1, 1].forEach(function (s) {
    var hb = new THREE.BoxGeometry(14.8 - (PX + 0.3), 1.05, 0.75).translate(s * (PX + 0.3 + (14.8 - PX - 0.3) / 2), 0.525, 0.6).toNonIndexed();
    var p = hb.attributes.position, n = hb.attributes.normal, uvs = new Float32Array(p.count * 2);
    for (var k = 0; k < p.count; k++) { var ax = Math.abs(n.getY(k)) > 0.5; uvs[k * 2] = ax || Math.abs(n.getZ(k)) > 0.5 ? p.getX(k) : p.getZ(k); uvs[k * 2 + 1] = ax ? p.getZ(k) : p.getY(k); }
    hb.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    hedge.push(tinted(hb, '#ffffff'));
    for (var hx = PX + 0.5; hx < 14.6; hx += small ? 0.5 : 0.34) {
      var hz = 0.3 + r() * 0.6;
      if (r() < 0.5) rose.add(s * hx, 1.07, hz, 0.07, r() < 0.5 ? pickC(PINK) : pickC(WHITE), [0, 1, 0.3]);
      else mari.add(s * hx, 1.06, hz, 0.075, pickC(MARI));
      fairy.add(s * hx + (r() - 0.5) * 0.2, 1.12, 0.98, r(), r(), 0, 0.85, cFairy[(r() * 4) | 0]);
    }
  });
  group.add(new THREE.Mesh(mergeUV(hedge), new THREE.MeshLambertMaterial({ vertexColors: true, map: hedgeTex, emissive: '#141a0c' })));
  // Sheer drapes: from the arch's shoulders to the poles, then falling to the ground, tied back.
  var drape = [], DC = col('#f8d2c4'), DC2 = col('#f0b8a8');
  function ribbon(pts, wid, pleats, c1, c2) {      // a strip hanging below a path of points
    var T = [], cs = [];
    for (var k = 0; k + 1 < pts.length; k++) {
      var a = pts[k], b = pts[k + 1];
      var fa = Math.sin(k * pleats) * 0.05, fb = Math.sin((k + 1) * pleats) * 0.05;
      var A1 = [a[0], a[1], a[2]], B1 = [b[0], b[1], b[2]], A2 = [a[0], a[1] - a[3], a[2] + fa], B2 = [b[0], b[1] - b[3], b[2] + fb];
      T.push(A1, A2, B1, B1, A2, B2);
      var ka = 0.92 + 0.08 * Math.sin(k * pleats), kb = 0.92 + 0.08 * Math.sin((k + 1) * pleats);
      [c1, c2, c1, c1, c2, c2].forEach(function (cc, j) { var kk = j === 2 || j === 3 || j === 5 ? kb : ka; cs.push(cc.r * kk, cc.g * kk, cc.b * kk); });
    }
    var g = fromTris(T); g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
    return g;
  }
  [-1, 1].forEach(function (s) {
    var a = [s * (GX - 0.1), 6.35, GZ1 + 0.2], b = [s * PX, PY, PZ0 + 0.06], sw = [];
    for (var k = 0; k <= 16; k++) {
      var t = k / 16, sag = Math.sin(Math.PI * t) * 0.85;
      sw.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t) - sag, lerp(a[2], b[2], t) + Math.sin(Math.PI * t) * 0.25, 0.32 + Math.sin(Math.PI * t) * 0.28]);
      if (k % 2 === 0 && k > 0 && k < 16) fairy.add(sw[k][0], sw[k][1] - 0.04, sw[k][2] + 0.03, r(), r(), 0, 1, cFairy[k % 4]);
    }
    drape.push(ribbon(sw, 0.5, 1.3, DC, DC2));
    // The falling panel, pinched at the tie-back.
    var fall = [];
    for (k = 0; k <= 12; k++) {
      var fy = PY - k / 12 * PY, pinch = 1 - 0.7 * Math.exp(-Math.pow((fy - 1.25) / 0.45, 2));
      fall.push([s * (PX + 0.02), fy, PZ0 + 0.1, 0]);
      fall[k].w = 0.5 * pinch;
    }
    // A vertical panel: build it sideways (width across x).
    var T2 = [], cs2 = [];
    for (k = 0; k < 12; k++) {
      var p0 = fall[k], p1 = fall[k + 1];
      for (var j = 0; j < 4; j++) {
        var u0 = j / 4, u1 = (j + 1) / 4, z0 = Math.sin(u0 * Math.PI * 3) * 0.05, z1 = Math.sin(u1 * Math.PI * 3) * 0.05;
        var q00 = [p0[0] - s * u0 * p0.w, p0[1], p0[2] + z0 * p0.w * 2], q01 = [p0[0] - s * u1 * p0.w, p0[1], p0[2] + z1 * p0.w * 2];
        var q10 = [p1[0] - s * u0 * p1.w, p1[1], p1[2] + z0 * p1.w * 2], q11 = [p1[0] - s * u1 * p1.w, p1[1], p1[2] + z1 * p1.w * 2];
        T2.push(q00, q10, q01, q01, q10, q11);
        var k0 = 0.88 + 0.12 * Math.cos(u0 * Math.PI * 6), k1 = 0.88 + 0.12 * Math.cos(u1 * Math.PI * 6);
        [k0, k0, k1, k1, k0, k1].forEach(function (kk) { cs2.push(DC.r * kk, DC.g * kk, DC.b * kk); });
      }
    }
    var g2 = fromTris(T2); g2.setAttribute('color', new THREE.Float32BufferAttribute(cs2, 3)); drape.push(g2);
    // A marigold band at the tie-back.
    for (k = 0; k < 8; k++) mari.add(s * (PX - 0.07 + Math.cos(k / 8 * 6.28) * 0.12), 1.25, PZ0 + 0.12 + Math.sin(k / 8 * 6.28) * 0.08, 0.055, pickC(MARI));
  });
  group.add(new THREE.Mesh(merge(drape), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: '#2a1410' })));

  // ── The doors ──────────────────────────────────────────────────────────
  var lp = leafParts(r);
  var woodMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: doorTexture(), emissive: '#14100a' });
  var goldMat = new THREE.MeshPhongMaterial({ vertexColors: true, color: '#d8a845', specular: '#fff0c0', shininess: 60, emissive: '#3a2206' });
  var mGeo = marigoldGeo(), flowerMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#3a1404' });
  var leaves = [-1, 1].map(function (s) {
    var pivot = new THREE.Group();
    pivot.position.set(s * OPEN_W / 2, 0, DOOR_Z);
    var lf = new THREE.Group();
    lf.scale.x = -s;       // the left leaf runs +x from its hinge, the right one -x
    lf.add(new THREE.Mesh(lp.wood, woodMat), new THREE.Mesh(lp.gold, goldMat));
    var gb = new Bed();
    lp.balls.forEach(function (b, k) { gb.add(b[0], b[1], b[2], b[3], k % 5 === 4 ? pickC(RED) : k % 2 ? pickC(YEL) : pickC(MARI)); });
    lf.add(gb.mesh(mGeo, flowerMat, r));
    pivot.add(lf);
    group.add(pivot);
    return pivot;
  });
  // The light behind the doors, seen through the crack, and under them.
  var crackMat = new THREE.MeshBasicMaterial({ color: '#ffc27a', transparent: true, fog: false, depthWrite: false });
  var crack = new THREE.Mesh(new THREE.PlaneGeometry(OPEN_W, DOOR_H).translate(0, DOOR_H / 2, DOOR_Z - 0.3), crackMat);
  group.add(crack);
  var sillMat = new THREE.MeshBasicMaterial({ color: '#ffb064', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  var sill = new THREE.Mesh(new THREE.PlaneGeometry(OPEN_W - 0.1, 0.5).rotateX(-Math.PI / 2).translate(0, 0.105, DOOR_Z + 0.32), sillMat);
  sill.renderOrder = 2;
  group.add(sill);
  var seam = new PointSet();
  for (var sy = 0.15; sy < DOOR_H - 0.05; sy += small ? 0.32 : 0.22) seam.add(0, sy, DOOR_Z + 0.1, 0, r(), 0, 0.9 + r() * 0.4, col('#ffbe70'));
  // The threshold and the arch's plinth.
  box(stone, -TW - 0.1, TW + 0.1, 0, 0.1, DOOR_Z - 0.2, GZ1 + 0.3, '#f3e2c4');
  [-1, 1].forEach(function (s) { box(stone, s * TW + (s > 0 ? 0 : -1.25), s * TW + (s > 0 ? 1.25 : 0), 0, 0.3, GZ0 - 0.02, GZ1 + 0.06, '#e8cfa6'); });
  box(stone, -14.8, -WX0, 0, 0.12, WZ0 - 0.05, WZ1 + 0.1, '#e0c49c'); box(stone, WX0, 14.8, 0, 0.12, WZ0 - 0.05, WZ1 + 0.1, '#e0c49c');

  // ── The ground: cream paving, a red runner, a rangoli, diyas, petals ───
  var pv = document.createElement('canvas'); pv.width = pv.height = 256;
  var px2 = pv.getContext('2d'), pr = rng(5);
  px2.fillStyle = '#9a8068'; px2.fillRect(0, 0, 256, 256);
  for (var ti = 0; ti < 4; ti++) for (var tj = 0; tj < 4; tj++) {
    var k2 = 0.92 + pr() * 0.12;
    px2.fillStyle = 'rgb(' + Math.round(232 * k2) + ',' + Math.round(214 * k2) + ',' + Math.round(186 * k2) + ')';
    px2.fillRect(ti * 64 + 2, tj * 64 + 2, 60, 60);
  }
  var pvTex = new THREE.CanvasTexture(pv); pvTex.colorSpace = THREE.SRGBColorSpace; pvTex.wrapS = pvTex.wrapT = THREE.RepeatWrapping; pvTex.repeat.set(30 / 2.6, 14 / 2.6); pvTex.anisotropy = 4;
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(30, 14).rotateX(-Math.PI / 2).translate(0, 0.012, 5.8), new THREE.MeshLambertMaterial({ map: pvTex })));
  var rc = document.createElement('canvas'); rc.width = 64; rc.height = 256;
  var rx = rc.getContext('2d');
  rx.fillStyle = '#b0182e'; rx.fillRect(0, 0, 64, 256);
  rx.fillStyle = '#e8b850'; rx.fillRect(0, 0, 6, 256); rx.fillRect(58, 0, 6, 256);
  rx.fillStyle = '#7a0e1e'; rx.fillRect(8, 0, 2, 256); rx.fillRect(54, 0, 2, 256);
  for (var rk = 0; rk < 8; rk++) { rx.fillStyle = 'rgba(212,160,64,0.6)'; rx.beginPath(); rx.arc(32, rk * 32 + 16, 5, 0, 7); rx.fill(); }
  var runTex = new THREE.CanvasTexture(rc); runTex.colorSpace = THREE.SRGBColorSpace; runTex.wrapT = THREE.RepeatWrapping; runTex.repeat.set(1, 9.5 / 2.2); runTex.anisotropy = 4;
  var runner = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 9.5).rotateX(-Math.PI / 2).translate(0, 0.022, 3.55 + 4.75), new THREE.MeshLambertMaterial({ map: runTex, emissive: '#2a0408' }));
  runner.renderOrder = 1;
  group.add(runner);
  var rangoliMat = new THREE.MeshLambertMaterial({ map: rangoliTexture(), transparent: true, depthWrite: false, emissive: '#2a0c04' });
  rangoli(group, rangoliMat, 0, 0.02, 2.15, 2.2, 0);
  var path = new PointSet();
  for (var pz = 3.8; pz < 12.5; pz += small ? 0.9 : 0.74) [-1, 1].forEach(function (s) { path.add(s * 1.3, 0.02, pz, 0, r(), 0, 1); });
  group.add(diyaBowls(path, 1, 8));
  var petalSpots = [], pCols = ['#ff8c00', '#ffa10a', '#ffc21f', '#e8590c', '#c21e3a', '#f06a8a', '#fff0d8', '#f48fb1'].map(col);
  for (var pp = 0; pp < (small ? 140 : 190); pp++) {
    var ang = r() * Math.PI * 2, rad = Math.pow(r(), 0.7) * 4.2;
    var ppx = Math.cos(ang) * rad * 1.3, ppz = 1.1 + Math.abs(Math.sin(ang)) * rad * 1.4;
    if (Math.hypot(ppx, ppz - 2.15) < 1.15) continue;   // keep the rangoli clear
    petalSpots.push([ppx, ppz]);
  }
  var petalMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 6).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide, emissive: '#2a0a00' }), petalSpots.length);
  var mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e3 = new THREE.Euler(), ps3 = new THREE.Vector3(), sc3 = new THREE.Vector3();
  petalSpots.forEach(function (p, k) {
    petalMesh.setMatrixAt(k, mtx.compose(ps3.set(p[0], 0.03 + r() * 0.01, p[1]), q4.setFromEuler(e3.set(r() * 0.3, r() * 6, r() * 0.3)), sc3.set(0.045, 1, 0.026)));
    petalMesh.setColorAt(k, pCols[k % pCols.length]);
  });
  petalMesh.userData.thin = true;
  group.add(petalMesh);

  // Tall pleated drapes either side, closing the court (the venue's fabric walls),
  // a scalloped valance along its top with marigold tassels, and a curtain
  // of fairy lights before it.
  var BZ = -1.5, BY0 = 0, BY1 = 6.15, BXE = 15.2, cloth = [];
  // Soft, uneven folds: two waves of different lengths.
  function fold(x) { return Math.sin(x * 15.7) * 0.06 + Math.sin(x * 6.1 + 1.3) * 0.05; }
  function foldShade(x) { return 0.9 + 0.06 * Math.cos(x * 15.7) + 0.05 * Math.cos(x * 6.1 + 1.3); }
  [-1, 1].forEach(function (s) {
    var T = [], cs = [], CA = col('#fbe6d6'), CB = col('#f6d2c2'), x0 = GX + 0.05, n = Math.round((BXE - x0) / 0.08);
    for (var k = 0; k < n; k++) {
      var xa = x0 + k * 0.08, xb = xa + 0.08, pa = fold(xa), pb = fold(xb), bay = Math.floor((xa - x0) / 1.45) % 2 ? CB : CA;
      var A0 = [s * xa, BY0, BZ + pa], A1 = [s * xa, BY1, BZ + pa * 0.5], B0 = [s * xb, BY0, BZ + pb], B1 = [s * xb, BY1, BZ + pb * 0.5];
      T.push(A0, B0, A1, A1, B0, B1);
      var ka = foldShade(xa), kb = foldShade(xb);
      [[ka, 1], [kb, 1], [ka, 0.86], [ka, 0.86], [kb, 1], [kb, 0.86]].forEach(function (q) { cs.push(bay.r * q[0] * q[1], bay.g * q[0] * q[1], bay.b * q[0] * q[1]); });
    }
    var g0 = fromTris(T); g0.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); cloth.push(g0);
    // The valance: swags of blush between hooks, a marigold tassel at each hook.
    for (var hx = x0; hx < BXE - 0.1; hx += 1.45) {
      var sw = [], hx2 = Math.min(hx + 1.45, BXE);
      for (k = 0; k <= 10; k++) { var t = k / 10; sw.push([s * lerp(hx, hx2, t), BY1 + 0.05 - Math.sin(Math.PI * t) * 0.32, BZ + 0.12 + Math.sin(Math.PI * t) * 0.06, 0.3 + Math.sin(Math.PI * t) * 0.12]); }
      cloth.push(ribbon(sw, 0, 1.6, col('#f2b8a8'), col('#e89c8c')));
      for (k = 0; k < (small ? 5 : 7); k++) mari.add(s * hx, BY1 - 0.05 - k * 0.11, BZ + 0.2, 0.06, k === 6 ? pickC(RED) : k % 2 ? pickC(YEL) : pickC(MARI));
    }
    // Fairy-light strings down the drape.
    for (var fx = x0 + 0.15; fx < BXE; fx += small ? 0.46 : 0.32) {
      for (var fy = BY1 - 0.4 - r() * 0.2; fy > 1.2; fy -= small ? 0.34 : 0.24) fairy.add(s * fx, fy, BZ + 0.16, r(), r(), 0, 0.75 + r() * 0.3, cFairy[(r() * 4) | 0]);
    }
  });
  group.add(new THREE.Mesh(merge(cloth), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: '#3a2218' })));

  // ── Assemble ───────────────────────────────────────────────────────────
  group.add(new THREE.Mesh(merge(stone), new THREE.MeshLambertMaterial({ vertexColors: true })));
  group.add(mari.mesh(mGeo, flowerMat, r, true));
  group.add(rose.mesh(roseGeo(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#2a0a0a' }), r, true));
  group.add(bud.mesh(budGeo(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#3a3020' }), r, true));
  group.add(leaf.mesh(leafGeo(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: '#061004' }), r, false, 0.5));

  // ── Point fields ───────────────────────────────────────────────────────
  var FL = 'float fl(){ return 0.86 + 0.14 * sin(uTime * (8.0 + aData.y * 4.0) + aData.y * 40.0) * sin(uTime * 5.3 + aData.y * 9.0); }\n';
  pk.add(flames, FL + 'vec4 place(){ vCol = vec3(1.0, 0.55, 0.2); return vec4(position + vec3(0.0, 0.06, 0.0), fl()); }\n',
    [[HALO_F, 0.55, 2.2, 1, false, 3], [FLAME_F, 0.2, 1.8, 2]]);
  pk.add(path, FL + 'vec4 place(){ vCol = vec3(1.0, 0.55, 0.2); return vec4(position + vec3(0.0, 0.16, 0.0), fl()); }\n',
    [[HALO_F, 0.6, 2.0, 1, false, 3], [FLAME_F, 0.2, 1.6, 2]]);
  pk.add(halos, 'vec4 place(){ return vec4(position, 0.5); }\n', [[HALO_F, 1.1, 2.0, 1]]);
  pk.add(fairy, 'vec4 place(){ float tw = 0.65 + 0.35 * sin(uTime * (1.2 + aData.y * 2.0) + aData.y * 50.0); return vec4(position, tw); }\n', [[GLOW_F, 0.13, 1.6, 2]]);
  pk.add(seam, 'vec4 place(){ return vec4(position, uCrack * (0.75 + 0.25 * sin(uTime * 1.3 + aData.y * 6.0)) * (1.0 - smoothstep(0.0, 0.25, uOpen))); }\n',
    [[HALO_F, 0.55, 2.0, 3]]);
  // Fireflies in the last of the night.
  var flies = new PointSet();
  for (var fk = 0; fk < (small ? 18 : 30); fk++) flies.add((r() - 0.5) * 14, 0.4 + r() * 3.2, 1.5 + r() * 8, 0, r(), 0, 0.8 + r() * 0.5, col(fk % 3 ? '#ffd27a' : '#f4f0a0'));
  tag(pk.add(flies,
    'vec4 place(){ float s = aData.y;\n' +
    ' vec3 p = position + vec3(sin(uTime * 0.3 + s * 30.0) * 0.9, sin(uTime * 0.5 + s * 17.0) * 0.35, cos(uTime * 0.27 + s * 23.0) * 0.6);\n' +
    ' float tw = pow(0.5 + 0.5 * sin(uTime * (1.0 + s) * 1.6 + s * 40.0), 3.0);\n' +
    ' return vec4(p, tw * uFlies); }\n',
    [[GLOW_F, 0.08, 1.6, 2]]), 'pts');

  var poolTex = softSprite('rgba(255,170,90,1)', 'rgba(255,120,40,0)');
  var pools = [-1, 1].map(function (s) { return pool(group, poolTex, s * SX, 0.02, SZ, 3.6); });
  var spill = pool(group, poolTex, 0, 0.03, GZ1 + 1.2, 4.0, 1.0);
  var doorPool = pool(group, poolTex, 0, 0.11, DOOR_Z + 0.9, 2.8, 1.3);

  // ── State and the opening ──────────────────────────────────────────────
  var opened = false, doorsOpen = 0, push = 0, done = null, begun = false;
  var startPose = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
  var endPose = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), tod: 6.2 };
  var tmpV = new THREE.Vector3();
  var aspect = 1;
  var OPEN_S = 2.6, PUSH0 = 0.55, PUSH1 = 6.4, BEGIN = 5.5, TOD0 = 5.6;

  // The camera before the tap: square on, a little below the toran.
  function closedPose(out) {
    var z = lerp(12, 15.5, smooth(0.5, 1.45, aspect));
    out.pos.set(o.x, 1.62, o.z + z);
    out.tgt.set(o.x, lerp(4.5, 4.35, smooth(0.5, 1.45, aspect)), o.z);
  }

  function doorAngle(a) {
    leaves[0].rotation.y = a;
    leaves[1].rotation.y = -a;
  }

  function override(pose, f) {
    // Wall-clock time since the tap: a slow phone gets fewer frames, not a
    // slower opening (the world clock is capped per frame).
    var t = opened ? (performance.now() - reduceStart) / 1000 : 0;
    // If the page was let in some other way (intro.js's safety net), hand
    // over at once so the guest's scrolling moves the camera.
    if (opened && !begun && window.weddingIntro && window.weddingIntro.state() === 'begun') { begun = true; if (done) done(); finish(); return; }
    closedPose(startPose);
    if (!opened) {
      pose.pos.copy(startPose.pos); pose.tgt.copy(startPose.tgt); pose.tod = TOD0; pose.mist = 0;
      override.fade = null;
      return;
    }
    if (f.reduce) {
      // A short fade through, the doors already open on the far side of it.
      var k = clamp(t / 0.35, 0, 1), back = smooth(0.45, 1.0, t);
      override.fade = k * (1 - back);
      var through = t > 0.4;
      doorsOpen = through ? 1 : 0;
      W.pose(window.scrollY, endPose);
      if (through) { pose.pos.copy(endPose.pos); pose.tgt.copy(endPose.tgt); pose.tod = endPose.tod; }
      else { pose.pos.copy(startPose.pos); pose.tgt.copy(startPose.tgt); pose.tod = TOD0; }
      if (t > 0.6 && !begun) { begun = true; if (done) done(); }
      if (t > 1.05) finish();
      return;
    }
    override.fade = null;
    // Unlatch (a small shudder), then the swing.
    var sw = smooth(0.25, OPEN_S, t);
    var shudder = t < 0.3 ? Math.sin(t * 60) * 0.004 * (1 - t / 0.3) : 0;
    doorsOpen = sw;
    // The push: out through the door into the court, easing to the timeline's pose.
    W.pose(window.scrollY, endPose);
    var p = smooth(PUSH0, PUSH1, t);
    push = p;
    tmpV.set(o.x, 1.7, o.z + DOOR_Z - 0.2);
    // A quadratic through the doorway.
    var a1 = (1 - p) * (1 - p), b1 = 2 * p * (1 - p), c1 = p * p;
    pose.pos.set(startPose.pos.x * a1 + tmpV.x * b1 + endPose.pos.x * c1,
                 startPose.pos.y * a1 + tmpV.y * b1 + endPose.pos.y * c1,
                 startPose.pos.z * a1 + tmpV.z * b1 + endPose.pos.z * c1);
    pose.tgt.lerpVectors(startPose.tgt, endPose.tgt, smooth(PUSH0 + 0.3, PUSH1, t));
    pose.tod = lerp(TOD0, endPose.tod, smooth(0.6, PUSH1, t));
    pose.mist = 0;
    doorAngle(shudder + sw * 1.72);
    if (t > BEGIN && !begun) { begun = true; if (done) done(); }
    if (t > PUSH1) finish();
  }
  override.places = ['gate', 'dawn', 'shrine'];
  override.fade = null;
  var reduceStart = 0;
  function finish() {
    W.setOverride(null);
    doorAngle(1.72);
    doorsOpen = 1;
  }

  function frame(f) {
    var time = f.time;
    U.uTime.value = time; U.uScale.value = f.pxScale; U.uFogD.value = f.fogD * 0.5;
    U.uOpen.value = doorsOpen;
    var night = 1 - smooth(5.6, 7.0, (f.tod % 24 + 24) % 24);
    U.uFlies.value = night;
    U.uCrack.value = 1;
    var breathe = f.reduce ? 1 : 0.9 + 0.1 * Math.sin(time * 1.1);
    crackMat.opacity = (1 - smooth(0.0, 0.22, doorsOpen)) * breathe;
    crack.visible = crackMat.opacity > 0.01;
    behindMat.opacity = 0.8 * breathe * (1 - smooth(0.15, 0.6, doorsOpen));
    behind.visible = behindMat.opacity > 0.01;
    sillMat.opacity = 0.55 * (1 - smooth(0, 0.2, doorsOpen)) * breathe;
    var fl = f.reduce ? 1 : 0.86 + 0.14 * Math.sin(time * 9) * Math.sin(time * 5.3);
    pools[0].material.opacity = pools[1].material.opacity = 0.4 * fl * lerp(1, 0.5, 1 - night);
    spill.material.opacity = 0.5 * smooth(0.05, 0.5, doorsOpen) * (1 - smooth(0.7, 1, doorsOpen) * 0.4);
    doorPool.material.opacity = 0.4 * (1 - smooth(0, 0.3, doorsOpen));
    // Lamps: the two samai, the light through the doorway, a warm wash on the arch.
    for (var i = 0; i < lampsAt.length; i++) W.lamp(lampsAt[i].x, lampsAt[i].y, lampsAt[i].z, '#ff9a48', 5.0 * fl, 8, 1.7);
    W.lamp(o.x, 2.0, o.z + GZ1 + 0.4, '#ffb26a', 2.2 + 6 * smooth(0.02, 0.5, doorsOpen) * (1 - smooth(0.85, 1, push)), 10, 1.6);
    W.lamp(o.x, 5.2, o.z + GZ1 + 2.4, '#ffc080', 2.0 * fl, 9, 1.6);
  }

  return {
    group: group, frame: frame,
    resize: function (w, h, a) { aspect = a; },
    // Drive the camera from now until the doors are through.
    hold: function () { W.setOverride(override); },
    open: function (cb) {
      if (opened) return;
      done = cb;
      opened = true; reduceStart = performance.now();
      W.poke();
    },
    finish: function () { if (!begun) { begun = true; if (done) done(); } finish(); }
  };
}

// Mirror a non-indexed geometry across x = 0, keeping its faces outward.
function flipX(g) {
  g.scale(-1, 1, 1);
  ['position', 'normal', 'uv'].forEach(function (name) {
    var a = g.attributes[name]; if (!a) return;
    var n = a.itemSize, arr = a.array;
    for (var i = 0; i < a.count; i += 3) for (var k = 0; k < n; k++) { var t = arr[(i + 1) * n + k]; arr[(i + 1) * n + k] = arr[(i + 2) * n + k]; arr[(i + 2) * n + k] = t; }
    a.needsUpdate = true;
  });
  return g;
}
