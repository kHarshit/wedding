/*
 * The courtyard behind the palace doors, at dawn: the guest arrives here
 * through the gate, and the shrine stands in its pavilion (shrine.js). (The
 * builder also lays the court out without the dawn's lamps, as 'morning'.)
 *
 * Sandstone arcades lit from within run down both sides; a stepped pool
 * with floating diyas, lotuses and petals fills the middle; a brass lamp
 * tower (deepstambh) stands before a domed pavilion at the far end; marigold
 * garlands and fairy lights are strung across. Local coordinates: the
 * gateway is at the origin, the court runs back to z = -DEPTH.
 */
import { THREE, clamp, lerp, smooth, rng, col, box, cyl, archAt, pointedArch, notchShape, shiftPts, swag, groundShade,
         Garlands, PointSet, pointKit, GLOW_F, HALO_F, FLAME_F, PETAL_F, diyaBowls, broadleaf, ashoka, treeMesh,
         rangoliTexture, rangoli, pool, worldUV, stoneTexture, onionDome , Q, tag } from '../lib.js';
import { tinted, merge, softSprite } from '../../immersive/kit.js';
import { COURT, groundH } from '../land.js';

// Sandstone tiles on a canvas; n x n tiles per repeat.
function tileTexture(n, base, grout, spread, seed, inlay) {
  var c = document.createElement('canvas'); c.width = c.height = 512;
  var x = c.getContext('2d'), r = rng(seed), s = 512 / n, b = col(base), t = col('#000');
  x.fillStyle = grout; x.fillRect(0, 0, 512, 512);
  for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
    var k = 1 + (r() - 0.5) * spread;
    t.copy(b).multiplyScalar(k);
    x.fillStyle = '#' + t.getHexString();
    x.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
    // Faint veins and wear.
    x.globalAlpha = 0.08;
    for (var q = 0; q < 6; q++) { x.fillStyle = r() < 0.5 ? '#fff6e6' : '#5a3a20'; x.fillRect(i * s + r() * s, j * s + r() * s, 2 + r() * s * 0.4, 1 + r() * 2); }
    x.globalAlpha = 1;
  }
  if (inlay) {
    // A white-marble border with a small star in each tile (the runner).
    x.strokeStyle = 'rgba(244,214,150,0.55)'; x.lineWidth = 3;
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
      var cx = i * s + s / 2, cy = j * s + s / 2;
      x.beginPath();
      for (q = 0; q < 8; q++) { var a = q / 8 * Math.PI * 2, rr = q % 2 ? s * 0.12 : s * 0.3; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      x.closePath(); x.stroke();
    }
  }
  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
  return tex;
}

// A lotus: eight tilted petals round a golden heart, white so instances tint it.
function lotusGeometry() {
  var parts = [];
  for (var ring = 0; ring < 2; ring++) {
    var n = ring ? 6 : 8;
    for (var k = 0; k < n; k++) {
      var a = (k + ring * 0.5) / n * Math.PI * 2;
      parts.push(tinted(new THREE.SphereGeometry(1, 6, 4).scale(0.07, 0.03, 0.17).translate(0, 0.04 + ring * 0.035, 0.12 - ring * 0.04)
        .rotateX(-0.5 - ring * 0.5).rotateY(a), '#ffffff'));
    }
  }
  parts.push(tinted(new THREE.CylinderGeometry(0.04, 0.05, 0.05, 8).translate(0, 0.07, 0), '#ffd04a'));
  // A pad underneath.
  parts.push(tinted(new THREE.CylinderGeometry(0.26, 0.26, 0.01, 12).translate(0, 0.0, 0), '#3a6a2a'));
  return merge(parts);
}
// A terracotta urn on its own small foot.
function urnGeometry() {
  var prof = [[0, 0], [0.16, 0], [0.18, 0.06], [0.14, 0.12], [0.26, 0.3], [0.3, 0.48], [0.24, 0.64], [0.2, 0.7], [0.27, 0.76], [0.25, 0.8], [0, 0.8]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var g = tinted(new THREE.LatheGeometry(prof, 14), '#b4583a');
  var band = tinted(new THREE.CylinderGeometry(0.305, 0.305, 0.05, 14, 1, true).translate(0, 0.48, 0), '#e8c27a');
  return merge([g, band]);
}

export function build(W, opts) {
  var K = W.K, small = W.small, variant = opts.variant, o = opts.origin, dawn = variant === 'dawn';
  var r = rng(dawn ? 4242 : 5151);
  var group = new THREE.Group();
  group.position.set(o.x, 0, o.z);
  var HW = COURT.HALF, D = COURT.DEPTH, WH = COURT.WALL, IN = HW - 1;   // inner wall face at x = +-IN
  var AX = 11;                                     // arcade front, x = +-AX
  var PAL = { wall: '#dcae80', wall2: '#e6bf94', trim: '#f4e2c2', red: '#b8644a', stone: '#a8805c', dome: '#f2e2c4', dark: '#6a4a34' };
  var U = { uTime: { value: 0 }, uScale: { value: 600 }, uFogD: { value: 0.004 }, uLit: { value: 1 }, uOn: { value: 1 }, uGlow: { value: 1 } };
  var pk = pointKit(U, group);
  var G = new Garlands();
  var g = [], glow = [];
  var cWarm = col('#ffb862'), cWin = col('#ffa04a');
  var cFairy = [col('#ffd88a'), col('#ffe6b0'), col('#ffc060'), col('#ffd0a0')];
  var lamps = new PointSet(), fairy = new PointSet(), halos = new PointSet(), lanterns = new PointSet();

  // ── Floor ──────────────────────────────────────────────────────────────
  var floorTex = tileTexture(4, '#d9bc96', '#8a6a4c', 0.14, 11);
  floorTex.repeat.set((IN * 2) / 5.6, (D - 1.2) / 5.6);
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(IN * 2, D - 1.2).rotateX(-Math.PI / 2).translate(0, 0.02, -(D + 1.2) / 2),
    new THREE.MeshLambertMaterial({ map: floorTex }));
  group.add(floor);
  var runTex = tileTexture(4, '#a84e36', '#6e3220', 0.08, 12, true);
  runTex.repeat.set(1, 9.8 / 3.2);
  var runner = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 9.8).rotateX(-Math.PI / 2).translate(0, 0.035, -6.1),
    new THREE.MeshLambertMaterial({ map: runTex }));
  runner.renderOrder = 1;
  group.add(runner);
  var run2 = runner.clone(); run2.geometry = new THREE.PlaneGeometry(3.2, 5).rotateX(-Math.PI / 2).translate(0, 0.035, -27.5);
  run2.material = new THREE.MeshLambertMaterial({ map: runTex.clone() }); run2.material.map.repeat.set(1, 5 / 3.2); run2.material.map.needsUpdate = true;
  group.add(run2);

  // ── Walls ──────────────────────────────────────────────────────────────
  // The gate wall with its doorway (the gate place dresses its outside).
  var gw = notchShape(-HW, HW, WH, [pointedArch(3.4, 4.2, 6.0, 0, 0, 16)]);
  g.push(tinted(new THREE.ExtrudeGeometry(gw, { depth: 1.2, bevelEnabled: false }).translate(0, 0, -1.2), PAL.wall));
  // Side and far walls.
  box(g, -HW, -IN, 0, WH, -D, -1.2, PAL.wall);
  box(g, IN, HW, 0, WH, -D, -1.2, PAL.wall);
  // The far wall, with a tall arch to the estate behind the pavilion.
  var far = notchShape(-HW, HW, WH, [pointedArch(4.0, 3.6, 5.7, 0, 0, 16)]);
  g.push(tinted(new THREE.ExtrudeGeometry(far, { depth: 1, bevelEnabled: false }).translate(0, 0, -D), PAL.wall));
  // Copings, plinths and merlons all round.
  [[-HW - 0.15, HW + 0.15, -1.35, 0.15], [-HW - 0.15, HW + 0.15, -D - 0.15, -D + 1.15]].forEach(function (s) {
    box(g, s[0], s[1], WH, WH + 0.25, s[2], s[3], PAL.trim);
    box(g, s[0], s[1], 0, 0.45, s[2], s[3], PAL.stone);
  });
  [-1, 1].forEach(function (s) {
    box(g, s * IN - 0.15 * s, s * HW + 0.15 * s, WH, WH + 0.25, -D - 0.15, 0.15, PAL.trim);
    box(g, s * IN - 0.15 * s, s * HW + 0.15 * s, 0, 0.45, -D - 0.15, 0.15, PAL.stone);
  });
  for (var mx = -HW; mx <= HW + 0.01; mx += 0.8) {
    box(g, mx - 0.18, mx + 0.18, WH + 0.25, WH + 0.75, -0.95, -0.25, PAL.trim);
    box(g, mx - 0.18, mx + 0.18, WH + 0.25, WH + 0.75, -D + 0.25, -D + 0.85, PAL.trim);
  }
  for (var mz = -1.6; mz >= -D + 0.4; mz -= 0.8) [-1, 1].forEach(function (s) { box(g, s * (HW - 0.5) - 0.18, s * (HW - 0.5) + 0.18, WH + 0.25, WH + 0.75, mz - 0.18, mz + 0.18, PAL.trim); });
  // Corner towers with little domes, for the views from above.
  [[-HW, -0.6], [HW, -0.6], [-HW, -D + 0.5], [HW, -D + 0.5]].forEach(function (c) {
    g.push(tinted(new THREE.CylinderGeometry(1.25, 1.45, WH + 2, 14).translate(c[0], (WH + 2) / 2, c[1]), PAL.wall2));
    g.push(tinted(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 14).translate(c[0], WH + 2.1, c[1]), PAL.trim));
    g.push(tinted(new THREE.SphereGeometry(1.15, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.2, 1).translate(c[0], WH + 2.25, c[1]), PAL.dome));
    g.push(tinted(new THREE.ConeGeometry(0.1, 0.6, 6).translate(c[0], WH + 3.85, c[1]), '#d9a441'));
    box(g, c[0] - 1.3, c[0] + 1.3, 1.2, 1.45, c[1] - 1.3, c[1] + 1.3, PAL.red);
  });

  // ── Arcades down both sides ────────────────────────────────────────────
  var Z0 = -3.4, Z1 = -42.2, NA = 9, AL = Z0 - Z1, AS = AL / NA, AH = 4.4;
  [-1, 1].forEach(function (s) {
    var bays = [], one = pointedArch(AS - 1.1, 1.9, 3.75, 7, 0.12, 14);
    for (var k = 0; k < NA; k++) bays.push(shiftPts(one, (k + 0.5) * AS));
    var fac = new THREE.ExtrudeGeometry(notchShape(0, AL, AH, bays), { depth: 0.5, bevelEnabled: false });
    // Lay it along -z at x = +-AX, facing the middle of the court.
    fac.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2);
    if (s > 0) fac.translate(AX, 0, Z0); else fac.translate(-AX, 0, Z1);
    g.push(tinted(fac, PAL.wall2));
    // Pilasters, the eave (chhajja) and the parapet.
    for (k = 0; k <= NA; k++) {
      var pz = Z0 - k * AS;
      box(g, s * AX - 0.32, s * AX + 0.32, 0, 0.5, pz - 0.38, pz + 0.38, PAL.stone);
      box(g, s * AX - (s > 0 ? 0.12 : 0.02), s * AX + (s > 0 ? 0.02 : 0.12), 0.5, AH - 0.3, pz - 0.2, pz + 0.2, PAL.trim);
    }
    box(g, s * (AX - 0.06), s * (AX + 0.56), AH - 0.3, AH - 0.08, Z1, Z0, PAL.red);
    var ch = new THREE.BoxGeometry(1.1, 0.12, AL).translate(0, 0, (Z0 + Z1) / 2);
    ch.rotateZ(s * 0.28).translate(s * (AX - 0.35), AH + 0.12, 0);
    g.push(tinted(ch, PAL.trim));
    box(g, s * AX - 0.15, s * AX + 0.15, AH + 0.25, AH + 0.95, Z1, Z0, PAL.wall2);
    box(g, s * AX - 0.22, s * AX + 0.22, AH + 0.95, AH + 1.08, Z1, Z0, PAL.trim);
    // The gallery roof back to the wall.
    box(g, Math.min(s * AX, s * IN), Math.max(s * AX, s * IN), AH, AH + 0.25, Z1, Z0, PAL.stone);
    // Rooms behind: a warm doorway and a lamp in every bay.
    for (k = 0; k < NA; k++) {
      var bz = Z0 - (k + 0.5) * AS;
      archAt(glow, 1.4, 2.4, 0, 0, 0, k % 2 ? cWin : cWarm, s > 0 ? -Math.PI / 2 : Math.PI / 2);
      glow[glow.length - 1].translate(s * (IN - 0.02), 0.02, bz);
      archAt(g, 1.9, 2.75, 0, 0, 0, PAL.trim, s > 0 ? -Math.PI / 2 : Math.PI / 2);
      g[g.length - 1].translate(s * (IN - 0.01), 0, bz);
      halos.add(s * (IN - 0.3), 1.3, bz, 0, r(), 0, 1.6, cWin);
      // A hanging lantern in each arch.
      lanterns.add(s * (AX + 0.25), 2.55, bz, 2, r(), 0, 0.9);
      // Marigold strands down each pier, and a swag across each arch.
      var p0 = Z0 - k * AS, p1 = p0 - AS;
      G.garlandTo([s * (AX - 0.35), 3.85, p0 - 0.25], [s * (AX - 0.35), 3.85, p1 + 0.25], 0.55, small ? 9 : 13, 0.06);
      G.strand(s * (AX - 0.35), 3.8, p0 - 0.25, small ? 9 : 14, 0.11, 0.055, 5);
    }
    G.strand(s * (AX - 0.35), 3.8, Z1 + 0.25, small ? 9 : 14, 0.11, 0.055, 5);
  });

  // ── The pavilion at the far end, before the arch to the estate ─────────
  var PZ = -37.2, PW = 3.1, PH0 = 1.0, PT = PH0 + 3.6;
  box(g, -4.4, 4.4, 0, PH0, PZ - 4.4, PZ + 4.4, PAL.stone);
  box(g, -4.55, 4.55, PH0 - 0.14, PH0 - 0.025, PZ - 4.55, PZ + 4.55, PAL.trim);
  for (var st = 0; st < 3; st++) box(g, -2.2, 2.2, 0, PH0 - (st + 1) * 0.25, PZ + 4.4, PZ + 4.4 + 0.42 * (st + 1), PAL.trim);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
    var x = c[0] * PW, z = PZ + c[1] * PW;
    box(g, x - 0.38, x + 0.38, PH0, PH0 + 0.4, z - 0.38, z + 0.38, PAL.red);
    cyl(g, x, z, PH0 + 0.4, PT - 0.45, 0.2, PAL.trim, 12);
    box(g, x - 0.34, x + 0.34, PT - 0.45, PT, z - 0.34, z + 0.34, PAL.red);
  });
  // Cusped arches on all four sides.
  [0, 1, 2, 3].forEach(function (side) {
    var sh = notchShape(-PW, PW, PT - PH0 - 0.4, [pointedArch(PW * 2 - 0.85, 0.45, 0.45 + 2.6, 9, 0.12, 18)]);
    var a = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false }).translate(0, PH0 + 0.4, -0.15);
    a.translate(0, 0, PW).rotateY(side * Math.PI / 2).translate(0, 0, PZ);
    g.push(tinted(a, PAL.trim));
  });
  box(g, -PW - 0.6, PW + 0.6, PT, PT + 0.18, PZ - PW - 0.6, PZ + PW + 0.6, PAL.red);
  box(g, -PW - 0.35, PW + 0.35, PT + 0.18, PT + 0.7, PZ - PW - 0.35, PZ + PW + 0.35, PAL.wall2);
  for (mx = -PW - 0.2; mx <= PW + 0.21; mx += 0.5) {
    box(g, mx - 0.1, mx + 0.1, PT + 0.7, PT + 0.95, PZ + PW + 0.2, PZ + PW + 0.4, PAL.trim);
    box(g, mx - 0.1, mx + 0.1, PT + 0.7, PT + 0.95, PZ - PW - 0.4, PZ - PW - 0.2, PAL.trim);
  }
  // The great dome on a drum, a lotus band and a finial; chhatris at the corners.
  g.push(tinted(new THREE.CylinderGeometry(2.3, 2.4, 0.9, 20).translate(0, PT + 1.15, PZ), PAL.wall2));
  g.push(tinted(new THREE.CylinderGeometry(2.55, 2.55, 0.16, 20).translate(0, PT + 1.62, PZ), PAL.trim));
  g.push(onionDome(2.2, PT + 1.7, PAL.dome, 24).translate(0, 0, PZ));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
    var cx = c[0] * (PW + 0.05), cz = PZ + c[1] * (PW + 0.05), y0 = PT + 0.7;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { box(g, cx + q[0] * 0.38 - 0.05, cx + q[0] * 0.38 + 0.05, y0, y0 + 0.75, cz + q[1] * 0.38 - 0.05, cz + q[1] * 0.38 + 0.05, PAL.trim); });
    box(g, cx - 0.55, cx + 0.55, y0 + 0.75, y0 + 0.86, cz - 0.55, cz + 0.55, PAL.trim);
    g.push(tinted(new THREE.SphereGeometry(0.48, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.15, 1).translate(cx, y0 + 0.86, cz), PAL.dome));
    g.push(tinted(new THREE.ConeGeometry(0.05, 0.3, 5).translate(cx, y0 + 1.55, cz), '#d9a441'));
  });
  // Inside the pavilion: a warm glow, and a toran on its front arch.
  if (!dawn) halos.add(0, PH0 + 1.5, PZ, 0, 0.5, 0, 3.4, cWarm);
  swag([-PW + 0.3, PT - 0.25, PZ + PW + 0.2], [PW - 0.3, PT - 0.25, PZ + PW + 0.2], 0.35, small ? 14 : 22, function (x, y, z, t, kk) {
    G.ball(x, y, z, 0.065);
    if (kk % 3 === 0 && t > 0.04 && t < 0.96) G.strand(x, y - 0.12, z, 4, 0.11, 0.05, 4);
  });
  [-1, 1].forEach(function (s) { G.strand(s * (PW + 0.05), PT - 0.3, PZ + PW + 0.25, small ? 22 : 30, 0.11, 0.06, 5); });

  // ── The pool ───────────────────────────────────────────────────────────
  var QX = 4.4, QZ0 = -12.2, QZ1 = -24.2, QZC = (QZ0 + QZ1) / 2, QL = QZ0 - QZ1, RIM = 0.42;
  [[-QX - 0.55, QX + 0.55, QZ0, QZ0 + 0.55], [-QX - 0.55, QX + 0.55, QZ1 - 0.55, QZ1]].forEach(function (s) { box(g, s[0], s[1], 0, RIM, s[2], s[3], PAL.trim); });
  [-1, 1].forEach(function (s) { box(g, s * QX + (s > 0 ? 0 : -0.55), s * QX + (s > 0 ? 0.55 : 0), 0, RIM, QZ1, QZ0, PAL.trim); });
  box(g, -QX, QX, 0, 0.05, QZ1, QZ0, '#2a3a40');
  var water = new THREE.Mesh(new THREE.PlaneGeometry(QX * 2, QL).rotateX(-Math.PI / 2).translate(0, 0.27, QZC),
    new THREE.MeshPhongMaterial({ color: '#16303c', specular: '#9a8a78', shininess: 70, emissive: '#000000' }));
  group.add(water);
  // Diyas round the rim, and floating on the water.
  var nRim = small ? 0.75 : 0.55;
  for (var rx = -QX - 0.25; rx <= QX + 0.26; rx += nRim) { lamps.add(rx, RIM, QZ0 + 0.27, 0.2, r(), 0, 1); lamps.add(rx, RIM, QZ1 - 0.27, 0.2, r(), 0, 1); }
  for (var rz = QZ0 - 0.4; rz >= QZ1 + 0.4; rz -= nRim) { lamps.add(-QX - 0.27, RIM, rz, 0.2, r(), 0, 1); lamps.add(QX + 0.27, RIM, rz, 0.2, r(), 0, 1); }
  var floatDiya = new PointSet(), lotusSpots = [];
  for (var fd = 0; fd < (small ? 14 : 22); fd++) {
    var fx = (r() - 0.5) * (QX * 2 - 1.2), fz = QZC + (r() - 0.5) * (QL - 1.2);
    floatDiya.add(fx, 0.27, fz, 1, r(), 0, 1);
  }
  for (var lt = 0; lt < (small ? 9 : 14); lt++) lotusSpots.push([(r() - 0.5) * (QX * 2 - 1), 0.27, QZC + (r() - 0.5) * (QL - 1), 0.9 + r() * 0.5, r() * 6]);
  var petalsW = new PointSet(), pCols = ['#ff8c00', '#ffb21a', '#e8590c', '#c21e3a', '#f06a8a', '#fff0d8'].map(col);
  for (var pw = 0; pw < (small ? 120 : 220); pw++) petalsW.add((r() - 0.5) * (QX * 2 - 0.3), 0.285, QZC + (r() - 0.5) * (QL - 0.3), 0, r(), 0, 0.7 + r() * 0.4, pCols[pw % pCols.length]);

  // Diyas down the runner, round the pavilion and by the gate.
  for (var az = -2.2; az > -11.3; az -= small ? 1.1 : 0.8) [-1.85, 1.85].forEach(function (x) { lamps.add(x, 0.03, az, 0.3, r(), 0, 1); });
  for (az = -25.5; az > -32.5; az -= small ? 1.1 : 0.8) [-1.85, 1.85].forEach(function (x) { lamps.add(x, 0.03, az, 0.35, r(), 0, 1); });
  for (var pk2 = 0; pk2 < (small ? 18 : 28); pk2++) {
    var pa = pk2 / (small ? 18 : 28);
    var px2 = lerp(-4.4, 4.4, pa);
    lamps.add(px2, PH0, PZ + 4.25, 0.4, r(), 0, 1);
  }

  // ── Deepstambhs: brass lamp towers before the pavilion ────────────────
  // At dawn two flank the shrine (the camera stands between them); in the
  // morning one stands on the axis.
  var brass = new THREE.MeshPhongMaterial({ color: '#c08a2a', specular: '#ffe0a0', shininess: 50, emissive: '#2a1404' });
  var towers = dawn ? [[-5.3, -31.6, 0.85], [5.3, -31.6, 0.85]] : [[0, -29.6, 1]];
  towers.forEach(function (tw) {
    var TX = tw[0], DZ = tw[1], ks = tw[2];
    var prof = [[0, 0], [0.55, 0], [0.55, 0.12], [0.42, 0.18], [0.36, 0.34], [0.2, 0.42], [0.12, 0.5]];
    var TIERS = 6, ty0 = 0.75, tstep = 0.5;
    for (var ti = 0; ti < TIERS; ti++) {
      var yy = ty0 + ti * tstep, rad = lerp(0.52, 0.2, ti / (TIERS - 1));
      prof.push([0.09, yy - 0.08], [rad, yy - 0.02], [rad + 0.03, yy + 0.02], [0.1, yy + 0.06]);
      var nf = Math.max(5, Math.round(rad * 22));
      for (var fk = 0; fk < nf; fk++) { var fa = fk / nf * Math.PI * 2 + ti; lamps.add(TX + Math.cos(fa) * rad * ks, (yy + 0.03) * ks, DZ + Math.sin(fa) * rad * ks, -1, r(), 0, 0.8); }
    }
    var topY = ty0 + TIERS * tstep;
    prof.push([0.08, topY - 0.1], [0.16, topY], [0.12, topY + 0.18], [0.03, topY + 0.32], [0, topY + 0.34]);
    var tower = new THREE.Mesh(new THREE.LatheGeometry(prof.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 18), brass);
    tower.position.set(TX, 0, DZ); tower.scale.setScalar(ks);
    group.add(tower);
    lamps.add(TX, (topY + 0.34) * ks, DZ, -1, 0.5, 0, 1.6);
    halos.add(TX, topY * 0.6 * ks, DZ, 0, 0.5, 0, 3.8 * ks, col('#ff9a48'));
  });

  // ── Garlands and fairy lights strung across the court ──────────────────
  var cross = dawn ? [-5.5, -14.5, -21.5] : [-5.5, -22, -31.4];
  cross.forEach(function (z, i) {
    var a = [-AX + 0.3, AH + 0.9, z], b = [AX - 0.3, AH + 0.9, z];
    G.garlandTo(a, b, 1.5 + (i % 2) * 0.3, small ? 46 : 70, 0.07);
    var n = small ? 34 : 54;
    swag([a[0], a[1] + 0.12, z + 0.25], [b[0], b[1] + 0.12, z + 0.25], 1.6 + (i % 2) * 0.3, n, function (x, y, zz, t) { fairy.add(x, y, zz, 0, r(), 0, 0.9 + r() * 0.3, cFairy[(r() * 4) | 0]); });
  });
  // Fairy lights along the arcade parapets and the pavilion's eaves.
  [-1, 1].forEach(function (s) { for (var zz = Z0; zz > Z1; zz -= small ? 0.5 : 0.34) fairy.add(s * (AX - 0.25), AH + 1.12, zz, 0, r(), 0, 0.85, cFairy[(r() * 4) | 0]); });
  for (var e2 = -PW - 0.6; e2 <= PW + 0.6; e2 += small ? 0.4 : 0.28) {
    fairy.add(e2, PT + 0.05, PZ + PW + 0.65, 0, r(), 0, 0.85, cFairy[1]);
    fairy.add(-PW - 0.65, PT + 0.05, PZ + e2, 0, r(), 0, 0.85, cFairy[1]);
    fairy.add(PW + 0.65, PT + 0.05, PZ + e2, 0, r(), 0, 0.85, cFairy[1]);
  }

  // ── Planters along the arcades ─────────────────────────────────────────
  var urnSpots = [];
  [-1, 1].forEach(function (s) { for (var k = 0; k <= NA; k++) if (k % 2 === 0) urnSpots.push([s * (AX - 1.0), Z0 - k * AS]); });
  [[-3.2, -2.4], [3.2, -2.4], [-5.6, PZ + 4.6], [5.6, PZ + 4.6]].forEach(function (p) { urnSpots.push(p); });
  var urnMesh = new THREE.InstancedMesh(urnGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), urnSpots.length);
  var bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: '#ffffff' }), urnSpots.length);
  var blooms = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#3a1400' }), urnSpots.length * 9);
  var mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e3 = new THREE.Euler(), ps = new THREE.Vector3(), sc = new THREE.Vector3(), nb = 0;
  var greens = ['#2f4a1e', '#365222', '#3c5a26'].map(col);
  urnSpots.forEach(function (u, k) {
    var s2 = 1.05 + r() * 0.15;
    urnMesh.setMatrixAt(k, mtx.compose(ps.set(u[0], 0, u[1]), q4.setFromEuler(e3.set(0, r() * 6, 0)), sc.setScalar(s2)));
    bush.setMatrixAt(k, mtx.compose(ps.set(u[0], 0.8 * s2 + 0.18, u[1]), q4, sc.set(0.42, 0.34, 0.42)));
    bush.setColorAt(k, greens[k % 3]);
    for (var j = 0; j < 9; j++) {
      var a = r() * Math.PI * 2, rr = 0.15 + r() * 0.24;
      blooms.setMatrixAt(nb, mtx.compose(ps.set(u[0] + Math.cos(a) * rr, 0.8 * s2 + 0.3 + r() * 0.2, u[1] + Math.sin(a) * rr), q4.setFromEuler(e3.set(r() * 3, r() * 3, 0)), sc.setScalar(0.07 + r() * 0.03)));
      blooms.setColorAt(nb, G.MARI[(r() * G.MARI.length) | 0]);
      nb++;
    }
  });
  blooms.count = nb;
  group.add(urnMesh, bush, blooms);

  // ── Trees: two neems by the pavilion, ashokas by the gate, a grove outside ─
  // Bark and leaf baked in; instances only vary the shade.
  var leafCols = ['#ffffff', '#e4ecd8', '#f2f6e8', '#d8e2cc'].map(col);
  var bl = [[-8.2, 0, -33.5, 1.15, 0.4, leafCols[0]], [8.2, 0, -33.5, 1.1, 2.2, leafCols[2]]];
  var ash = [[-7.5, 0, -3.6, 0.85, 0, leafCols[1]], [7.5, 0, -3.6, 0.85, 1, leafCols[3]], [-7.6, 0, -27, 0.8, 2, leafCols[0]], [7.6, 0, -27, 0.8, 3, leafCols[2]]];
  // Outside the walls, darker, on the land.
  var outside = [];
  for (var tk = 0; tk < 220 && outside.length < (small ? 26 : 40); tk++) {
    var ox = (r() - 0.5) * 80, oz = 14 - r() * (D + 40);
    if (Math.abs(ox) < HW + 3 && oz > -D - 4) continue;     // inside or against the walls
    if (oz > -1 && Math.abs(ox) < 26) continue;              // keep the gate's forecourt open
    if (Math.abs(ox) < 6 && oz < -D) continue;               // and the way out to the estate
    outside.push([ox, groundH(o.x + ox, o.z + oz) - 0.2, oz, 0.95 + r() * 0.8, r() * 6, leafCols[(r() * 4) | 0], 0.9 + r() * 0.3]);
  }
  group.add(treeMesh(broadleaf('#6a4a30', '#4c7232'), bl.concat(outside)), treeMesh(ashoka('#5a4028', '#3e6a2c'), ash, true));

  // ── Rangoli ────────────────────────────────────────────────────────────
  var rangoliMat = new THREE.MeshLambertMaterial({ map: rangoliTexture(), transparent: true, depthWrite: false, emissive: '#2a0c04' });
  rangoli(group, rangoliMat, 0, 0.02, -11.4, 1.7, 0);
  rangoli(group, rangoliMat, 0, 0.02, -27.8, 2.4, 0.3);

  // ── Merge and add the stone ────────────────────────────────────────────
  var stone = merge(g);
  groundShade(stone, 0, 2.4, 0.74);
  worldUV(stone, 2);
  var stoneMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: stoneTexture() });
  group.add(new THREE.Mesh(stone, stoneMat));
  // The glowing doorways of the rooms behind the arcades.
  var glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  group.add(new THREE.Mesh(merge(glow), glowMat));
  group.add(G.mesh(null, small));
  var lotusMesh = treeMesh(lotusGeometry(), lotusSpots.map(function (s, k) { return [s[0], s[1], s[2], s[3], s[4], col(k % 3 ? '#f6b8c8' : '#fff0f4')]; }));
  lotusMesh.material = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#2a1018' });
  group.add(lotusMesh);
  group.add(diyaBowls(lamps, 1, small ? 8 : 12), diyaBowls(floatDiya, 1, small ? 8 : 12));
  // Brass lanterns hung from the arches on chains.
  var lantGeo = merge([
    tinted(new THREE.CylinderGeometry(0.008, 0.008, 1.0, 3, 1, true).translate(0, 0.75, 0), '#6a4a24'),
    tinted(new THREE.ConeGeometry(0.15, 0.16, 6, 1, true).translate(0, 0.25, 0), '#c08a2a'),
    tinted(new THREE.CylinderGeometry(0.11, 0.09, 0.26, 6, 1, true).translate(0, 0.04, 0), '#ffd28a'),
    tinted(new THREE.ConeGeometry(0.1, 0.07, 6, 1, true).rotateX(Math.PI).translate(0, -0.125, 0), '#c08a2a')
  ]);
  var lantMesh = new THREE.InstancedMesh(lantGeo, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#3a1a04', side: THREE.DoubleSide }), lanterns.p.length / 3);
  for (var li = 0; li < lanterns.p.length / 3; li++) lantMesh.setMatrixAt(li, mtx.makeTranslation(lanterns.p[li * 3], lanterns.p[li * 3 + 1], lanterns.p[li * 3 + 2]));
  group.add(lantMesh);

  // ── Point fields ───────────────────────────────────────────────────────
  // Lamps: aData.x < 0 always lit (the tower), 2 hanging lanterns, else lit with uOn.
  var LAMP_POS =
    'vec4 place(){ float on = aData.x < 0.0 ? max(uOn, 0.25) : uOn;\n' +
    ' float fl = 0.85 + 0.15 * sin(uTime * (7.0 + aData.y * 5.0) + aData.y * 40.0);\n' +
    ' vec3 lift = aData.x > 1.5 ? vec3(0.0) : vec3(0.0, 0.16, 0.0);\n' +
    ' vCol = vec3(1.0, 0.55, 0.2); return vec4(position + lift, on * fl); }\n';
  pk.add(lamps, LAMP_POS, [[HALO_F, 0.7, 2.2, 1, false, 4], [FLAME_F, 0.2, 1.6, 2]]);
  pk.add(lanterns, 'vec4 place(){ vCol = vec3(1.0, 0.6, 0.25); return vec4(position + vec3(0.0, 0.04, 0.0), max(uOn, 0.0) * (0.9 + 0.1 * sin(uTime * 6.0 + aData.y * 30.0))); }\n',
    [[HALO_F, 1.1, 2.2, 1, false, 4], [GLOW_F, 0.16, 1.6, 2]]);
  var FLOAT_POS =
    'vec4 place(){ vec3 p = position + vec3(0.0, sin(uTime * 1.3 + aData.y * 20.0) * 0.01, 0.0);\n' +
    ' vCol = vec3(1.0, 0.55, 0.2); return vec4(p + vec3(0.0, 0.16, 0.0), uOn * (0.85 + 0.15 * sin(uTime * 8.0 + aData.y * 30.0))); }\n';
  pk.add(floatDiya, FLOAT_POS, [[HALO_F, 0.8, 2.2, 1, false, 4], [FLAME_F, 0.2, 1.6, 2]]);
  // Their reflections: each flame mirrored in the water, drawn where the eye
  // ray to the mirrored flame meets the surface, and only inside the pool.
  var MIRROR = function (lift, amt) {
    return 'vec4 place(){ vec3 P0 = position + vec3(0.0, ' + lift + ', 0.0); float H = 0.27;\n' +
      ' vec3 Pm = vec3(P0.x, 2.0 * H - P0.y, P0.z); vec3 cam = cameraPosition - modelMatrix[3].xyz;\n' +
      ' vec3 Q = cam + (Pm - cam) * ((cam.y - H) / max(cam.y - Pm.y, 0.001)); Q.y = H + 0.005;\n' +
      ' Q.x += sin(uTime * 1.7 + P0.z * 3.0 + aData.y * 6.0) * 0.025;\n' +
      ' float inside = step(abs(Q.x), ' + (QX - 0.05).toFixed(2) + ') * step(abs(Q.z - (' + QZC.toFixed(2) + ')), ' + (QL / 2 - 0.05).toFixed(2) + ');\n' +
      ' float on = aData.x < 0.0 ? max(uOn, 0.25) : uOn;\n' +
      ' vCol = vec3(1.0, 0.58, 0.24); return vec4(Q, ' + amt + ' * on * inside * (0.8 + 0.2 * sin(uTime * 3.0 + aData.y * 20.0))); }\n';
  };
  tag(pk.add(lamps, MIRROR('0.16', '0.42'), [[HALO_F, 0.45, 1.8, 2], [GLOW_F, 0.12, 1.4, 2]]), 'lowSkip');
  tag(pk.add(floatDiya, MIRROR('0.16', '0.5'), [[HALO_F, 0.45, 1.8, 2], [GLOW_F, 0.12, 1.4, 2]]), 'lowSkip');
  pk.add(fairy, 'vec4 place(){ float tw = 0.7 + 0.3 * sin(uTime * (1.3 + aData.y * 2.0) + aData.y * 50.0); return vec4(position, uOn * tw); }\n', [[GLOW_F, 0.17, 1.6, 2]]);
  pk.add(halos, 'vec4 place(){ return vec4(position, (0.12 + 0.5 * uOn) * uGlow); }\n', [[HALO_F, 1.2, 2.0, 1]]);
  tag(pk.add(petalsW,
    'vec4 place(){ vec3 p = position + vec3(sin(uTime * 0.15 + aData.y * 9.0) * 0.18, 0.0, cos(uTime * 0.12 + aData.y * 7.0) * 0.18);\n' +
    ' vCol = aCol * uLit; return vec4(p, 0.95); }\n',
    [[PETAL_F, 0.09, 1.3, 3, true]]), 'pts');
  // A few petals adrift in the air.
  var air = new PointSet();
  for (var ak = 0; ak < (small ? 70 : 130); ak++) air.add((r() - 0.5) * 24, r() * 7, -2 - r() * 40, 0, r(), 0, 0.8 + r() * 0.5, pCols[ak % pCols.length]);
  tag(pk.add(air,
    'vec4 place(){ vec3 B = vec3(24.0, 7.0, 40.0), O = vec3(-12.0, 0.0, -42.0); float s = aData.y;\n' +
    ' vec3 p = position + vec3(uTime * 0.35 + sin(uTime * 0.7 + s * 20.0) * 0.6, -uTime * (0.22 + s * 0.25), sin(uTime * 0.45 + s * 9.0) * 0.6);\n' +
    ' p = O + mod(p - O, B); vCol = aCol * uLit; return vec4(p, 0.9); }\n',
    [[PETAL_F, 0.12, 1.4, 7, true, 1.5]]), 'pts');

  var poolTex = softSprite('rgba(255,170,90,1)', 'rgba(255,120,40,0)');
  var pools = [pool(group, poolTex, 0, 0, -30, 9), pool(group, poolTex, 0, PH0, PZ, 8), pool(group, poolTex, 0, 0, QZC, 13, 0.85)];
  [-1, 1].forEach(function (s) { pools.push(pool(group, poolTex, s * (AX - 1.2), 0, (Z0 + Z1) / 2, 6, 7)); });

  // ── Per frame ──────────────────────────────────────────────────────────
  var on = dawn ? 1 : 0, tmpC = col('#000');
  function frame(f) {
    var P = f.P, time = f.time;
    // Lamps burn through dawn and go out as the morning brightens.
    var lit = dawn ? 1 - smooth(7.0, 9.5, (f.tod % 24 + 24) % 24) * 0.7 : 0;
    U.uTime.value = time; U.uScale.value = f.pxScale; U.uFogD.value = f.fogD * 0.5;
    U.uOn.value = lit; U.uGlow.value = 1;
    U.uLit.value = clamp(P.hi * 0.62 + 0.15, 0.4, 1.15);
    glowMat.color.setScalar(lerp(0.5, 1.0, lit));
    water.material.emissive.copy(P.top).multiplyScalar(0.16).add(tmpC.copy(P.hor).multiplyScalar(0.07));
    for (var i = 0; i < pools.length; i++) pools[i].material.opacity = lit * (i === 2 ? 0.28 : 0.4);
    if (lit > 0.02) {
      var fl = f.reduce ? 1 : 0.85 + 0.15 * Math.sin(time * 9) * Math.sin(time * 5.3);
      for (var ti2 = 0; ti2 < towers.length; ti2++) W.lamp(o.x + towers[ti2][0], 3.2 * towers[ti2][2], o.z + towers[ti2][1], '#ff9a48', (dawn ? 5 : 9) * lit * fl, 14, 1.6);
      W.lamp(o.x, PH0 + 2, o.z + PZ, '#ffa858', 5 * lit, 11, 1.6);
      W.lamp(o.x - AX + 0.8, 2.4, o.z - 12, '#ffa050', 3.2 * lit, 9, 1.8);
      W.lamp(o.x + AX - 0.8, 2.4, o.z - 12, '#ffa050', 3.2 * lit, 9, 1.8);
    }
  }

  return { group: group, frame: frame };
}
