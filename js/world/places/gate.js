/*
 * The gate: the first thing a guest sees, in place of the door video.
 *
 * Carved teak palace doors with fielded panels, brass straps, studs, bosses
 * and ring knockers, set deep in a sandstone portal with a cusped arch and a
 * stone jaali above. A marigold toran hangs across the doorway and garlands
 * fall either side; two big diyas burn on carved pedestals, brass lanterns
 * hang from the portal, and before dawn a warm light shows through the crack
 * between the doors and through the jaali. Turrets with little domes flank
 * the portal, and a rangoli is laid on the forecourt.
 *
 * open(done) swings the doors in and pushes the camera through into the
 * dawn courtyard, then calls done(). Local coordinates match court.js: the
 * doorway at the origin, the outside towards +z.
 */
import { THREE, clamp, lerp, smooth, rng, col, box, cyl, archAt, pointedArch, notchShape, bandShape, shapeFrom, swag,
         groundShade, mergeUV, Garlands, PointSet, pointKit, GLOW_F, HALO_F, FLAME_F, diyaGeometry, rangoliTexture,
         rangoli, pool, worldUV, stoneTexture, diyaBowls } from '../lib.js';
import { tinted, merge, softSprite } from '../../immersive/kit.js';
import { COURT } from '../land.js';

var DOOR_Z = -1.1, DOOR_H = 4.2, DOOR_W = 1.69, ARCH_TOP = 6.0, PORTAL_W = 3.4, PORTAL_H = 8.9, PORTAL_D = 0.55;

// Wood grain, white so vertex colours stain it.
function grainTexture() {
  var c = document.createElement('canvas'); c.width = 128; c.height = 512;
  var x = c.getContext('2d'), r = rng(8);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 128, 512);
  for (var k = 0; k < 90; k++) {
    var px = r() * 128, w = 0.6 + r() * 2.2, a = 0.05 + r() * 0.13;
    x.strokeStyle = 'rgba(60,30,10,' + a.toFixed(3) + ')'; x.lineWidth = w;
    x.beginPath(); x.moveTo(px, 0);
    for (var y = 0; y <= 512; y += 32) x.lineTo(px + Math.sin(y * 0.02 + k) * (2 + r() * 3), y);
    x.stroke();
  }
  // A few knots.
  for (k = 0; k < 4; k++) {
    var kx = r() * 128, ky = r() * 512;
    for (var q = 0; q < 5; q++) { x.strokeStyle = 'rgba(60,30,10,0.12)'; x.lineWidth = 1; x.beginPath(); x.ellipse(kx, ky, 3 + q * 3, 8 + q * 6, 0, 0, 7); x.stroke(); }
  }
  var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
// A stone jaali: eight-pointed stars and crosses cut through sandstone.
function jaaliTexture() {
  var c = document.createElement('canvas'); c.width = c.height = 256;
  var x = c.getContext('2d');
  x.fillStyle = '#e8c49a'; x.fillRect(0, 0, 256, 256);
  x.globalCompositeOperation = 'destination-out';
  var n = 6, s = 256 / n;
  for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
    var cx = (i + 0.5) * s, cy = (j + 0.5) * s;
    x.beginPath();
    for (var k = 0; k < 16; k++) { var a = k / 16 * Math.PI * 2, rr = k % 2 ? s * 0.2 : s * 0.38; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    x.closePath(); x.fill();
    // Small diamonds between the stars.
    x.beginPath(); x.moveTo(i * s, j * s - s * 0.09); x.lineTo(i * s + s * 0.09, j * s); x.lineTo(i * s, j * s + s * 0.09); x.lineTo(i * s - s * 0.09, j * s); x.closePath(); x.fill();
  }
  var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// One door leaf, hinge at x = 0, running to +x; front towards +z.
function leafGeometry(r) {
  var g = [], studs = [], bosses = [];
  var DARK = '#3b1f0f', STILE = '#5d3519', FIELD = '#6e3e1d', MED = '#80492a';
  function b(x0, x1, y0, y1, z0, z1, c) {
    var j = 0.93 + r() * 0.12, cc = col(c).multiplyScalar(j);
    g.push(tinted(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), cc));
  }
  var W = DOOR_W, H = DOOR_H, F = 0.07;
  b(0, W, 0, H, -F, F, DARK);
  // Stiles, muntin and rails.
  b(0, 0.18, 0, H, F, F + 0.035, STILE);
  b(W - 0.18, W, 0, H, F, F + 0.035, STILE);
  b(0.8, 0.9, 0.24, H - 0.2, F, F + 0.035, STILE);
  var rails = [[0, 0.24], [1.18, 1.32], [2.42, 2.56], [3.56, 3.7], [H - 0.2, H]];
  rails.forEach(function (rl) { b(0.18, W - 0.18, rl[0], rl[1], F, F + 0.035, STILE); });
  // Fielded panels with a carved lozenge and a brass boss.
  var rows = [[0.24, 1.18], [1.32, 2.42], [2.56, 3.56], [3.7, H - 0.2]], cols2 = [[0.18, 0.8], [0.9, W - 0.18]];
  rows.forEach(function (rw, ri) {
    cols2.forEach(function (cl) {
      var x0 = cl[0], x1 = cl[1], y0 = rw[0], y1 = rw[1];
      b(x0 + 0.05, x1 - 0.05, y0 + 0.05, y1 - 0.05, F, F + 0.012, '#4a2812');          // the sunk edge
      b(x0 + 0.09, x1 - 0.09, y0 + 0.09, y1 - 0.09, F, F + 0.028, FIELD);              // the raised field
      var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (ri < 3) {
        var d = Math.min(x1 - x0, y1 - y0) * 0.36;
        g.push(tinted(new THREE.BoxGeometry(d, d, 0.016).rotateZ(Math.PI / 4).translate(cx, cy, F + 0.034), col(MED)));
        g.push(tinted(new THREE.BoxGeometry(d * 0.62, d * 0.62, 0.012).rotateZ(Math.PI / 4).translate(cx, cy, F + 0.044), col(FIELD)));
        bosses.push([cx, cy, F + 0.05, 0.05]);
        for (var k = 0; k < 8; k++) { var a = k / 8 * Math.PI * 2; studs.push([cx + Math.cos(a) * 0.095, cy + Math.sin(a) * 0.095, F + 0.04, 0.014]); }
      } else bosses.push([cx, cy, F + 0.03, 0.035]);
    });
  });
  // Brass straps across the rails, studded.
  var straps = [1.25, 2.49, 3.63];
  var brassGeo = [];
  straps.forEach(function (y) {
    brassGeo.push(tinted(new THREE.BoxGeometry(W, 0.055, 0.014).translate(W / 2, y, F + 0.042), col('#ffffff')));
    for (var x = 0.08; x < W - 0.04; x += 0.135) studs.push([x, y, F + 0.05, 0.022]);
  });
  // Studs up both stiles and along the top and bottom rails.
  for (var y = 0.12; y < H - 0.06; y += 0.19) { studs.push([0.09, y, F + 0.036, 0.026]); studs.push([W - 0.09, y, F + 0.036, 0.026]); }
  for (var x2 = 0.3; x2 < W - 0.25; x2 += 0.17) { studs.push([x2, 0.12, F + 0.036, 0.024]); studs.push([x2, H - 0.1, F + 0.036, 0.024]); }
  // An edge strip on the meeting stile, and the hinge straps.
  brassGeo.push(tinted(new THREE.BoxGeometry(0.03, H, 0.02).translate(W - 0.015, H / 2, F + 0.02), col('#ffffff')));
  [0.45, H - 0.45].forEach(function (y) { brassGeo.push(tinted(new THREE.BoxGeometry(0.62, 0.07, 0.016).translate(0.31, y, F + 0.045), col('#ffffff'))); });
  // The ring knocker on its boss.
  brassGeo.push(tinted(new THREE.TorusGeometry(0.12, 0.017, 6, 20).translate(W - 0.3, 1.58, F + 0.09), col('#ffffff')));
  bosses.push([W - 0.3, 1.7, F + 0.06, 0.06]);
  // The back: plain boards and two cross-bars.
  b(0.06, W - 0.06, 0.6, 0.78, -F - 0.04, -F, STILE);
  b(0.06, W - 0.06, H - 0.8, H - 0.62, -F - 0.04, -F, STILE);
  b(0.06, W - 0.06, 2.0, 2.18, -F - 0.04, -F, STILE);
  var wood = mergeUV(g.map(function (q) {
    // Grain runs up the boards: scale the box UVs by size so it reads evenly.
    return q;
  }));
  return { wood: wood, brass: merge(brassGeo), studs: studs, bosses: bosses };
}

export function build(W, opts) {
  var K = W.K, small = W.small, o = opts.origin;
  var r = rng(1729);
  var group = new THREE.Group();
  group.position.set(o.x, 0, o.z);
  var PAL = { wall: '#dcae80', wall2: '#e6b98c', trim: '#f4e2c2', red: '#a9533a', stone: '#a8805c', dome: '#f2e2c4', inlay: '#f8ecd4' };
  var U = { uTime: { value: 0 }, uScale: { value: 600 }, uFogD: { value: 0.004 }, uCrack: { value: 1 }, uOpen: { value: 0 }, uLit: { value: 1 }, uFlies: { value: 1 } };
  var pk = pointKit(U, group);
  var G = new Garlands();
  var halos = new PointSet(), niches = new PointSet();
  var g = [], glowG = [];
  var cWin = col('#ffa04a'), cWarm = col('#ffb862');
  var leafGreen = '#3e6a22';

  // ── The portal ────────────────────────────────────────────────────────
  var opening = pointedArch(PORTAL_W, DOOR_H, ARCH_TOP, 0, 0, 18);
  var hw = PORTAL_W / 2 + 1.7;
  g.push(tinted(new THREE.ExtrudeGeometry(notchShape(-hw, hw, PORTAL_H, [opening]), { depth: PORTAL_D, bevelEnabled: false }), PAL.wall2));
  // A cusped trim round the arch, and an outer red band with a white inlay.
  var trimIn = pointedArch(PORTAL_W, DOOR_H, ARCH_TOP, 9, 0.11, 22), trimOut = pointedArch(PORTAL_W + 0.5, DOOR_H, ARCH_TOP + 0.32, 0, 0, 22);
  g.push(tinted(new THREE.ExtrudeGeometry(bandShape(trimOut, trimIn), { depth: 0.12, bevelEnabled: false }).translate(0, 0, PORTAL_D), PAL.trim));
  var redOut = pointedArch(PORTAL_W + 1.1, DOOR_H, ARCH_TOP + 0.7, 0, 0, 22), redIn = pointedArch(PORTAL_W + 0.56, DOOR_H, ARCH_TOP + 0.36, 0, 0, 22);
  g.push(tinted(new THREE.ExtrudeGeometry(bandShape(redOut, redIn), { depth: 0.08, bevelEnabled: false }).translate(0, 0, PORTAL_D), PAL.red));
  // The rectangular frame (alfiz) round it all, red with a white line.
  var FX = PORTAL_W / 2 + 0.95, FY = ARCH_TOP + 1.0;
  [[-FX - 0.2, -FX, 0.5, FY + 0.2], [FX, FX + 0.2, 0.5, FY + 0.2], [-FX - 0.2, FX + 0.2, FY, FY + 0.2]].forEach(function (q) {
    box(g, q[0], q[1], q[2], q[3], PORTAL_D, PORTAL_D + 0.1, PAL.red);
  });
  [[-FX - 0.12, -FX - 0.08, 0.5, FY + 0.12], [FX + 0.08, FX + 0.12, 0.5, FY + 0.12], [-FX - 0.12, FX + 0.12, FY + 0.08, FY + 0.12]].forEach(function (q) {
    box(g, q[0], q[1], q[2], q[3], PORTAL_D + 0.1, PORTAL_D + 0.115, PAL.inlay);
  });
  // Rosettes in the spandrels.
  [-1, 1].forEach(function (s) {
    var cx = s * (PORTAL_W / 2 + 0.42), cy = ARCH_TOP + 0.35;
    g.push(tinted(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16).rotateX(Math.PI / 2).translate(cx, cy, PORTAL_D + 0.03), PAL.trim));
    for (var k = 0; k < 8; k++) { var a = k / 8 * Math.PI * 2; g.push(tinted(new THREE.SphereGeometry(0.06, 6, 4).scale(1, 1, 0.5).translate(cx + Math.cos(a) * 0.13, cy + Math.sin(a) * 0.13, PORTAL_D + 0.07), PAL.red)); }
  });
  // A plinth along the foot, and pilasters with lotus capitals at the edges.
  box(g, -hw - 0.12, hw + 0.12, 0, 0.55, -0.02, PORTAL_D + 0.14, PAL.stone);
  [-1, 1].forEach(function (s) {
    var x = s * (hw - 0.28);
    box(g, x - 0.28, x + 0.28, 0.55, PORTAL_H - 0.9, PORTAL_D, PORTAL_D + 0.16, PAL.trim);
    box(g, x - 0.2, x + 0.2, 0.75, PORTAL_H - 1.1, PORTAL_D + 0.16, PORTAL_D + 0.2, PAL.wall2);
    g.push(tinted(new THREE.CylinderGeometry(0.36, 0.22, 0.32, 10).translate(x, PORTAL_H - 0.74, PORTAL_D + 0.08), PAL.trim));
    g.push(tinted(new THREE.CylinderGeometry(0.2, 0.32, 0.25, 10).translate(x, 0.68, PORTAL_D + 0.08), PAL.trim));
  });
  // Jambs: carved bands up the inside of the doorway.
  [-1, 1].forEach(function (s) {
    box(g, s * (PORTAL_W / 2) - 0.03 * s, s * (PORTAL_W / 2) + 0.06 * s, 0, DOOR_H, DOOR_Z + 0.12, PORTAL_D, PAL.trim);
    box(g, s * (PORTAL_W / 2) - 0.07 * s, s * (PORTAL_W / 2) + 0.0, 0.3, DOOR_H - 0.1, -0.3, 0.3, PAL.red);
  });
  // Threshold.
  box(g, -PORTAL_W / 2 - 0.1, PORTAL_W / 2 + 0.1, 0, 0.1, DOOR_Z - 0.2, PORTAL_D + 0.35, PAL.trim);

  // ── Above the arch: a jharokha, the cornice and three chhatris ─────────
  var JY = ARCH_TOP + 1.15;
  box(g, -1.1, 1.1, JY - 0.25, JY, PORTAL_D, PORTAL_D + 0.75, PAL.trim);
  for (var k = 0; k < 5; k++) { var bx = -0.9 + k * 0.45; g.push(tinted(new THREE.ConeGeometry(0.1, 0.4, 4).rotateX(Math.PI).translate(bx, JY - 0.42, PORTAL_D + 0.55), PAL.trim)); }
  box(g, -0.95, 0.95, JY, JY + 0.95, PORTAL_D + 0.05, PORTAL_D + 0.62, PAL.wall2);
  [-0.55, 0, 0.55].forEach(function (x) {
    archAt(glowG, 0.36, 0.66, x, JY + 0.12, PORTAL_D + 0.63, cWin);
    archAt(g, 0.46, 0.76, x, JY + 0.08, PORTAL_D + 0.625, PAL.trim);
  });
  // Its curved (bangaldar) roof.
  g.push(tinted(new THREE.CylinderGeometry(0.62, 0.62, 2.3, 16, 1, false, 0, Math.PI).scale(1, 0.55, 1).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, JY + 0.98, PORTAL_D + 0.34), PAL.dome));
  g.push(tinted(new THREE.ConeGeometry(0.05, 0.32, 5).translate(0, JY + 1.5, PORTAL_D + 0.34), '#d9a441'));
  // Cornice (chhajja) with brackets, and merlons.
  var CY = PORTAL_H;
  var chh = new THREE.BoxGeometry(hw * 2 + 0.7, 0.14, 0.9).rotateX(0.22).translate(0, CY - 0.05, PORTAL_D + 0.2);
  g.push(tinted(chh, PAL.trim));
  for (var bxk = -hw; bxk <= hw + 0.01; bxk += 0.6) g.push(tinted(new THREE.BoxGeometry(0.12, 0.4, 0.42).translate(bxk, CY - 0.38, PORTAL_D + 0.2), PAL.trim));
  box(g, -hw - 0.1, hw + 0.1, CY + 0.05, CY + 0.6, -0.4, PORTAL_D, PAL.wall2);
  for (var mx = -hw; mx <= hw + 0.01; mx += 0.55) box(g, mx - 0.13, mx + 0.13, CY + 0.6, CY + 0.95, PORTAL_D - 0.3, PORTAL_D - 0.05, PAL.trim);
  [[-hw + 0.6, 0.72], [0, 1.0], [hw - 0.6, 0.72]].forEach(function (c) {
    var cx = c[0], s = c[1], y0 = CY + 0.6, cz = 0.05;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { box(g, cx + q[0] * 0.5 * s - 0.06, cx + q[0] * 0.5 * s + 0.06, y0, y0 + 1.0 * s, cz + q[1] * 0.5 * s - 0.06, cz + q[1] * 0.5 * s + 0.06, PAL.trim); });
    box(g, cx - 0.72 * s, cx + 0.72 * s, y0 + 1.0 * s, y0 + 1.12 * s, cz - 0.72 * s, cz + 0.72 * s, PAL.trim);
    g.push(tinted(new THREE.SphereGeometry(0.64 * s, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.2, 1).translate(cx, y0 + 1.12 * s, cz), PAL.dome));
    g.push(tinted(new THREE.ConeGeometry(0.07 * s, 0.5 * s, 6).translate(cx, y0 + 1.12 * s + 0.77 * s + 0.2, cz), '#d9a441'));
    halos.add(cx, y0 + 0.5 * s, cz, 0, r(), 0, 1.4 * s, cWarm);
  });

  // ── The wall either side: niches with lamps, and two turrets ───────────
  var TX = 6.4;
  [-1, 1].forEach(function (s) {
    // Blind arched niches with a lamp in each.
    [hw + 1.05, TX + 2.3, TX + 4.4, TX + 6.5].forEach(function (x, i) {
      var nx = s * x;
      if (x > COURT.HALF - 0.6) return;
      archAt(g, 1.05, 1.9, nx, 1.9, 0.01, PAL.trim);
      archAt(g, 0.78, 1.62, nx, 2.0, 0.02, '#8a5a3e');
      niches.add(nx, 2.15, 0.12, 0, r(), 0, 1);
      box(g, nx - 0.32, nx + 0.32, 1.86, 1.96, 0.0, 0.18, PAL.trim);
      if (i === 0) { archAt(g, 0.7, 1.1, nx, 4.25, 0.01, PAL.trim); archAt(glowG, 0.5, 0.88, nx, 4.33, 0.02, cWin); }
    });
    // The turret.
    var tx = s * TX, tz = 0.35, TH = 8.6;
    g.push(tinted(new THREE.CylinderGeometry(1.2, 1.38, TH, 18).translate(tx, TH / 2, tz), PAL.wall2));
    [1.6, 4.4, 7.4].forEach(function (y) { g.push(tinted(new THREE.CylinderGeometry(1.32, 1.32, 0.18, 18).translate(tx, y, tz), PAL.trim)); });
    g.push(tinted(new THREE.CylinderGeometry(1.48, 1.4, 0.55, 18).translate(tx, 0.27, tz), PAL.stone));
    archAt(g, 0.62, 1.15, tx, 5.3, tz + 1.28, PAL.trim);
    archAt(glowG, 0.44, 0.95, tx, 5.38, tz + 1.3, cWin);
    halos.add(tx, 5.85, tz + 1.5, 0, r(), 0, 0.9, cWin);
    archAt(g, 0.5, 0.9, tx, 2.4, tz + 1.36, PAL.trim);
    archAt(glowG, 0.34, 0.72, tx, 2.48, tz + 1.37, cWarm);
    // Its open chhatri.
    var y0 = TH;
    g.push(tinted(new THREE.CylinderGeometry(1.55, 1.3, 0.25, 18).translate(tx, y0 + 0.12, tz), PAL.trim));
    for (var pk2 = 0; pk2 < 6; pk2++) { var a = pk2 / 6 * Math.PI * 2; cyl(g, tx + Math.cos(a) * 0.95, tz + Math.sin(a) * 0.95, y0 + 0.25, y0 + 1.35, 0.07, PAL.trim, 6); }
    g.push(tinted(new THREE.CylinderGeometry(1.25, 1.25, 0.14, 18).translate(tx, y0 + 1.42, tz), PAL.trim));
    g.push(tinted(new THREE.SphereGeometry(1.0, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.25, 1).translate(tx, y0 + 1.49, tz), PAL.dome));
    g.push(tinted(new THREE.ConeGeometry(0.08, 0.6, 6).translate(tx, y0 + 2.95, tz), '#d9a441'));
    halos.add(tx, y0 + 0.8, tz, 0, r(), 0, 1.6, cWarm);
  });

  // ── The doors ──────────────────────────────────────────────────────────
  var lg = leafGeometry(r);
  var grain = grainTexture();
  var woodMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: grain });
  var brassMat = new THREE.MeshPhongMaterial({ color: '#c8942e', specular: '#ffe6a8', shininess: 46, emissive: '#2a1604' });
  var studGeo = new THREE.SphereGeometry(1, small ? 6 : 8, small ? 3 : 4, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2);
  var leaves = [-1, 1].map(function (s) {
    var pivot = new THREE.Group();
    pivot.position.set(s * PORTAL_W / 2, 0, DOOR_Z);
    var leaf = new THREE.Group();
    leaf.scale.x = -s;       // the left leaf runs +x from its hinge, the right one -x
    leaf.add(new THREE.Mesh(lg.wood, woodMat), new THREE.Mesh(lg.brass, brassMat));
    var all = lg.studs.concat(lg.bosses);
    var im = new THREE.InstancedMesh(studGeo, brassMat, all.length);
    var m = new THREE.Matrix4(), sc = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
    all.forEach(function (st, k) { im.setMatrixAt(k, m.compose(p.set(st[0], st[1], st[2] - 0.01), q, sc.set(st[3], st[3], st[3] * 0.8))); });
    leaf.add(im);
    pivot.add(leaf);
    group.add(pivot);
    return pivot;
  });

  // The jaali above the doors, with lamplight behind it.
  var tymp = opening.filter(function (p) { return p[1] >= DOOR_H - 0.001; });
  tymp.unshift([-PORTAL_W / 2, DOOR_H]); tymp.push([PORTAL_W / 2, DOOR_H]);
  var tg = new THREE.ShapeGeometry(shapeFrom(tymp), 1);
  var uvs = tg.attributes.uv;
  for (var ui = 0; ui < uvs.count; ui++) uvs.setXY(ui, (tg.attributes.position.getX(ui) + 2) / 1.2, (tg.attributes.position.getY(ui) - DOOR_H) / 1.2);
  var jaali = new THREE.Mesh(tg.clone().translate(0, 0, DOOR_Z + 0.02), new THREE.MeshLambertMaterial({ map: jaaliTexture(), alphaTest: 0.5, side: THREE.DoubleSide }));
  jaali.material.map.repeat.set(1, 1);
  group.add(jaali);
  var behindMat = new THREE.MeshBasicMaterial({ color: '#ffb064', transparent: true, fog: false });
  group.add(new THREE.Mesh(tg.clone().translate(0, 0, DOOR_Z - 0.25), behindMat));
  // The light behind the doors, seen through the crack.
  var crackMat = new THREE.MeshBasicMaterial({ color: '#ffc27a', transparent: true, fog: false, depthWrite: false });
  var crack = new THREE.Mesh(new THREE.PlaneGeometry(PORTAL_W, DOOR_H).translate(0, DOOR_H / 2, DOOR_Z - 0.3), crackMat);
  group.add(crack);
  // Light spilling under the doors.
  var sillMat = new THREE.MeshBasicMaterial({ color: '#ffb064', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  var sill = new THREE.Mesh(new THREE.PlaneGeometry(PORTAL_W - 0.1, 0.5).rotateX(-Math.PI / 2).translate(0, 0.105, DOOR_Z + 0.32), sillMat);
  sill.renderOrder = 2;
  group.add(sill);
  var seam = new PointSet();
  for (var sy = 0.15; sy < DOOR_H - 0.05; sy += small ? 0.32 : 0.22) seam.add(0, sy, DOOR_Z + 0.12, 0, r(), 0, 0.9 + r() * 0.4, col('#ffbe70'));

  // ── Toran and garlands ─────────────────────────────────────────────────
  var TY = DOOR_H + 0.35, TZ = PORTAL_D + 0.2, TW = PORTAL_W / 2 + 0.45;
  swag([-TW, TY, TZ], [TW, TY, TZ], 0.07, small ? 30 : 44, function (x, y, z, t, kk) {
    G.ball(x, y, z, 0.07);
    // Mango leaves: slim blades, alternately tilted.
    g.push(tinted(new THREE.ConeGeometry(0.045, 0.3, 4).scale(1, 1, 0.25).rotateX(Math.PI).rotateZ((kk % 2 ? 1 : -1) * 0.12).translate(x, y - 0.2, z + 0.03), kk % 3 ? '#2f5a1c' : '#3c6a24'));
  });
  var nsw = 4;
  for (var sw = 0; sw < nsw; sw++) {
    var xa = -TW + sw * (TW * 2) / nsw, xb = xa + (TW * 2) / nsw;
    swag([xa, TY - 0.08, TZ + 0.04], [xb, TY - 0.08, TZ + 0.04], 0.34, small ? 10 : 14, function (x, y, z) { G.ball(x, y, z, 0.065); });
    if (sw > 0) G.strand(xa, TY - 0.12, TZ + 0.05, small ? 6 : 8, 0.12, 0.062, 4);
  }
  // Long garlands falling down both sides of the doorway.
  [-1, 1].forEach(function (s) {
    G.strand(s * TW, TY - 0.05, TZ + 0.02, small ? 28 : 38, 0.115, 0.07, 5);
    G.strand(s * (TW - 0.16), TY - 0.05, TZ + 0.06, small ? 10 : 14, 0.115, 0.06, 4);
  });
  // A swag along the top of the portal, under the cornice.
  for (sw = 0; sw < 3; sw++) {
    var xc = -hw + 0.3 + sw * (hw * 2 - 0.6) / 3;
    G.garlandTo([xc, CY - 0.55, PORTAL_D + 0.45], [xc + (hw * 2 - 0.6) / 3, CY - 0.55, PORTAL_D + 0.45], 0.45, small ? 12 : 18, 0.07);
    G.strand(xc, CY - 0.6, PORTAL_D + 0.45, small ? 5 : 7, 0.12, 0.06, 4);
  }
  G.strand(hw - 0.3, CY - 0.6, PORTAL_D + 0.45, small ? 5 : 7, 0.12, 0.06, 4);

  // ── Diyas on pedestals, and hanging lanterns ───────────────────────────
  var DX = PORTAL_W / 2 + 1.0, DZ = PORTAL_D + 1.15;
  var pedProf = [[0, 0], [0.34, 0], [0.34, 0.12], [0.26, 0.2], [0.21, 0.3], [0.17, 0.72], [0.22, 0.8], [0.3, 0.9], [0.36, 0.98], [0.36, 1.04], [0, 1.04]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var pedGeo = new THREE.LatheGeometry(pedProf, 16);
  var pedMat = new THREE.MeshPhongMaterial({ color: '#b8862c', specular: '#ffdc98', shininess: 40, emissive: '#2a1404' });
  var flames = new PointSet(), lampsAt = [];
  [-1, 1].forEach(function (s) {
    var pm = new THREE.Mesh(pedGeo, pedMat); pm.position.set(s * DX, 0, DZ); group.add(pm);
    box(g, s * DX - 0.48, s * DX + 0.48, 0, 0.12, DZ - 0.48, DZ + 0.48, PAL.stone);
    var bowl = new THREE.Mesh(diyaGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#2a1206' }));
    bowl.scale.setScalar(2.7);
    bowl.position.set(s * DX, 1.04, DZ);
    group.add(bowl);
    // Three wicks in each big diya.
    [-0.09, 0, 0.09].forEach(function (dx, i) { flames.add(s * DX + dx, 1.04 + 0.19 + (i === 1 ? 0.03 : 0), DZ + (i === 1 ? -0.04 : 0.05), 0, r(), 0, i === 1 ? 1.25 : 0.95); });
    lampsAt.push(new THREE.Vector3(o.x + s * DX, 1.55, o.z + DZ));
    // Marigolds heaped round the pedestal's foot.
    for (var k = 0; k < (small ? 14 : 20); k++) { var a = k / (small ? 14 : 20) * Math.PI * 2; G.ball(s * DX + Math.cos(a) * 0.42, 0.06, DZ + Math.sin(a) * 0.42, 0.07); }
  });
  // A path of little diyas leading to the doors.
  var path = new PointSet();
  for (var pz = PORTAL_D + 0.9; pz < PORTAL_D + 10.5; pz += small ? 0.9 : 0.62) {
    [-1, 1].forEach(function (s) { path.add(s * (1.75 + (pz - PORTAL_D) * 0.04), 0.02, pz, 0, r(), 0, 1); });
  }
  group.add(diyaBowls(path, 1, small ? 8 : 12));
  // Lanterns on brackets either side of the arch.
  var lanterns = new PointSet();
  [-1, 1].forEach(function (s) {
    var lx = s * (PORTAL_W / 2 + 0.8), ly = 3.35, lz = PORTAL_D + 0.55;
    box(g, lx - 0.03, lx + 0.03, ly + 0.95, ly + 1.0, PORTAL_D, lz + 0.03, '#6a4a24');
    lanterns.add(lx, ly, lz, 0, r(), 0, 1);
  });
  var lantGeo = merge([
    tinted(new THREE.CylinderGeometry(0.008, 0.008, 0.66, 4).translate(0, 0.65, 0), '#6a4a24'),
    tinted(new THREE.ConeGeometry(0.2, 0.22, 6).translate(0, 0.32, 0), '#c08a2a'),
    tinted(new THREE.CylinderGeometry(0.15, 0.12, 0.36, 6, 1, true).translate(0, 0.03, 0), '#ffd28a'),
    tinted(new THREE.CylinderGeometry(0.13, 0.07, 0.08, 6).translate(0, -0.19, 0), '#c08a2a'),
    tinted(new THREE.SphereGeometry(0.04, 6, 4).translate(0, 0.46, 0), '#c08a2a')
  ]);
  for (var li = 0; li < 2; li++) {
    var lm = new THREE.Mesh(lantGeo, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#4a2206', side: THREE.DoubleSide }));
    lm.position.set(lanterns.p[li * 3], lanterns.p[li * 3 + 1], lanterns.p[li * 3 + 2]);
    group.add(lm);
  }

  // ── The forecourt: paving, a rangoli, strewn petals ────────────────────
  var pv = document.createElement('canvas'); pv.width = pv.height = 256;
  var px = pv.getContext('2d'), pr = rng(5);
  px.fillStyle = '#7a5a40'; px.fillRect(0, 0, 256, 256);
  for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) {
    var k2 = 0.9 + pr() * 0.2;
    px.fillStyle = 'rgb(' + Math.round(196 * k2) + ',' + Math.round(160 * k2) + ',' + Math.round(122 * k2) + ')';
    px.fillRect(i * 64 + (j % 2) * 32 + 2, j * 64 + 2, 60, 60);
    px.fillRect(i * 64 + (j % 2) * 32 - 254 + 2, j * 64 + 2, 60, 60);
  }
  var pvTex = new THREE.CanvasTexture(pv); pvTex.colorSpace = THREE.SRGBColorSpace; pvTex.wrapS = pvTex.wrapT = THREE.RepeatWrapping; pvTex.repeat.set(5, 3); pvTex.anisotropy = 4;
  var fore = new THREE.Mesh(new THREE.PlaneGeometry(16, 9.5).rotateX(-Math.PI / 2).translate(0, 0.015, PORTAL_D + 4.75), new THREE.MeshLambertMaterial({ map: pvTex }));
  group.add(fore);
  var rangoliMat = new THREE.MeshLambertMaterial({ map: rangoliTexture(), transparent: true, depthWrite: false, emissive: '#2a0c04' });
  rangoli(group, rangoliMat, 0, 0.02, PORTAL_D + 3.1, 2.7, 0);
  var petalSpots = [];
  var pCols = ['#ff8c00', '#ffa10a', '#ffc21f', '#e8590c', '#c21e3a', '#f06a8a', '#fff0d8'].map(col);
  for (var pp = 0; pp < (small ? 120 : 200); pp++) {
    var ang = r() * Math.PI * 2, rad = Math.pow(r(), 0.7) * 3.4;
    var ppx = Math.cos(ang) * rad * 1.2, ppz = PORTAL_D + 1.6 + Math.abs(Math.sin(ang)) * rad * 0.7;
    if (Math.abs(ppx) < 1.5 && Math.abs(ppz - PORTAL_D - 3.1) < 1.4) continue;   // keep the rangoli clear
    petalSpots.push([ppx, ppz]);
  }
  var petalMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 6).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide, emissive: '#2a0a00' }), petalSpots.length);
  var mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e3 = new THREE.Euler(), ps3 = new THREE.Vector3(), sc3 = new THREE.Vector3();
  petalSpots.forEach(function (p, k) {
    petalMesh.setMatrixAt(k, mtx.compose(ps3.set(p[0], 0.03 + r() * 0.01, p[1]), q4.setFromEuler(e3.set(r() * 0.3, r() * 6, r() * 0.3)), sc3.set(0.045, 1, 0.026)));
    petalMesh.setColorAt(k, pCols[k % pCols.length]);
  });
  group.add(petalMesh);

  // ── Assemble ───────────────────────────────────────────────────────────
  var stone = merge(g);
  groundShade(stone, 0, 2.2, 0.72);
  worldUV(stone, 2);
  group.add(new THREE.Mesh(stone, new THREE.MeshLambertMaterial({ vertexColors: true, map: stoneTexture() })));
  var glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  group.add(new THREE.Mesh(merge(glowG), glowMat));
  group.add(G.mesh(null, small));

  // ── Point fields ───────────────────────────────────────────────────────
  var FL = 'float fl(){ return 0.86 + 0.14 * sin(uTime * (8.0 + aData.y * 4.0) + aData.y * 40.0) * sin(uTime * 5.3 + aData.y * 9.0); }\n';
  pk.add(flames, FL + 'vec4 place(){ vCol = vec3(1.0, 0.55, 0.2); return vec4(position, fl()); }\n',
    [[HALO_F, 0.9, 2.4, 1, false, 3], [FLAME_F, 0.3, 2.0, 2]]);
  pk.add(path, FL + 'vec4 place(){ vCol = vec3(1.0, 0.55, 0.2); return vec4(position + vec3(0.0, 0.16, 0.0), fl()); }\n',
    [[HALO_F, 0.6, 2.0, 1, false, 3], [FLAME_F, 0.2, 1.6, 2]]);
  pk.add(niches, FL + 'vec4 place(){ vCol = vec3(1.0, 0.56, 0.22); return vec4(position, fl()); }\n',
    [[HALO_F, 0.6, 2.2, 1], [FLAME_F, 0.16, 1.6, 2]]);
  pk.add(lanterns, FL + 'vec4 place(){ vCol = vec3(1.0, 0.6, 0.25); return vec4(position + vec3(0.0, 0.03, 0.0), fl()); }\n',
    [[HALO_F, 1.3, 2.4, 1], [GLOW_F, 0.2, 1.6, 2]]);
  pk.add(halos, 'vec4 place(){ return vec4(position, 0.55); }\n', [[HALO_F, 1.1, 2.0, 1]]);
  pk.add(seam, 'vec4 place(){ return vec4(position, uCrack * (0.75 + 0.25 * sin(uTime * 1.3 + aData.y * 6.0)) * (1.0 - smoothstep(0.0, 0.25, uOpen))); }\n',
    [[HALO_F, 0.55, 2.0, 3]]);
  // Fireflies in the last of the night.
  var flies = new PointSet();
  for (var fk = 0; fk < (small ? 24 : 40); fk++) flies.add((r() - 0.5) * 14, 0.4 + r() * 3.2, 1 + r() * 8, 0, r(), 0, 0.8 + r() * 0.5, col(fk % 3 ? '#ffd27a' : '#f4f0a0'));
  pk.add(flies,
    'vec4 place(){ float s = aData.y;\n' +
    ' vec3 p = position + vec3(sin(uTime * 0.3 + s * 30.0) * 0.9, sin(uTime * 0.5 + s * 17.0) * 0.35, cos(uTime * 0.27 + s * 23.0) * 0.6);\n' +
    ' float tw = pow(0.5 + 0.5 * sin(uTime * (1.0 + s) * 1.6 + s * 40.0), 3.0);\n' +
    ' return vec4(p, tw * uFlies); }\n',
    [[GLOW_F, 0.08, 1.6, 2]]);

  var poolTex = softSprite('rgba(255,170,90,1)', 'rgba(255,120,40,0)');
  var pools = [-1, 1].map(function (s) { return pool(group, poolTex, s * DX, 0.02, DZ, 4.2); });
  var spill = pool(group, poolTex, 0, 0.03, PORTAL_D + 1.2, 4.0, 1.0);
  var doorPool = pool(group, poolTex, 0, 0.11, DOOR_Z + 0.9, 2.8, 1.3);

  // ── State and the opening ──────────────────────────────────────────────
  var openT = -1, doorsOpen = 0, push = 0, done = null, begun = false, todNow = 5.35;
  var startPose = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
  var endPose = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), tod: 6.2 };
  var tmpV = new THREE.Vector3();
  var aspect = 1;
  var OPEN_S = 2.6, PUSH0 = 0.55, PUSH1 = 5.0, BEGIN = 4.35;

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
    var t = openT < 0 ? 0 : (f.reduce ? (performance.now() - reduceStart) / 1000 : f.time - openT);
    closedPose(startPose);
    if (openT < 0) {
      pose.pos.copy(startPose.pos); pose.tgt.copy(startPose.tgt); pose.tod = 5.35; pose.mist = 0;
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
      else { pose.pos.copy(startPose.pos); pose.tgt.copy(startPose.tgt); pose.tod = 5.35; }
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
    pose.tod = lerp(5.35, endPose.tod, smooth(0.6, PUSH1, t));
    pose.mist = 0;
    doorAngle(shudder + sw * 1.72);
    if (t > BEGIN && !begun) { begun = true; if (done) done(); }
    if (t > PUSH1) finish();
  }
  override.places = ['gate', 'dawn'];
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
    behindMat.opacity = 0.85 * breathe;
    sillMat.opacity = 0.55 * (1 - smooth(0, 0.2, doorsOpen)) * breathe;
    var fl = f.reduce ? 1 : 0.86 + 0.14 * Math.sin(time * 9) * Math.sin(time * 5.3);
    pools[0].material.opacity = pools[1].material.opacity = 0.42 * fl * lerp(1, 0.5, 1 - night);
    spill.material.opacity = 0.5 * smooth(0.05, 0.5, doorsOpen) * (1 - smooth(0.7, 1, doorsOpen) * 0.4);
    doorPool.material.opacity = 0.4 * (1 - smooth(0, 0.3, doorsOpen));
    glowMat.color.setScalar(lerp(0.45, 0.78, night));
    // Lamps: the two diyas, the light through the doorway, the lanterns.
    for (var i = 0; i < lampsAt.length; i++) W.lamp(lampsAt[i].x, lampsAt[i].y, lampsAt[i].z, '#ff9a48', 5.0 * fl, 8, 1.7);
    W.lamp(o.x, 2.0, o.z + PORTAL_D + 0.4, '#ffb26a', 2.2 + 6 * smooth(0.02, 0.5, doorsOpen) * (1 - smooth(0.85, 1, push)), 10, 1.6);
    W.lamp(o.x, 3.4, o.z + PORTAL_D + 0.9, '#ffa858', 1.8 * fl, 6, 2);
  }

  return {
    group: group, frame: frame,
    resize: function (w, h, a) { aspect = a; },
    // Drive the camera from now until the doors are through.
    hold: function () { W.setOverride(override); },
    open: function (cb) {
      if (openT >= 0) return;
      done = cb;
      openT = W.f.time; reduceStart = performance.now();
      W.poke();
    },
    finish: function () { if (!begun) { begun = true; if (done) done(); } finish(); }
  };
}
