/*
 * The Celebration: Wednesday 10 March, 9 PM, in the wedding hall, under the
 * stars. No people: the evening is set and glowing.
 *
 * An open-sided marble baradari on a raised plinth: slender paired columns
 * and cusped arches along both sides, a roof outlined in lights. Inside, a
 * canopy of fairy lights swings from the centre to the eaves, and three
 * brass chandeliers hang down the middle over a runner. At the far end a
 * floral stage: a wall of roses and white flowers round an arch, two empty
 * gilded chairs, and urns of flowers. Outside on the lawn, lamps, trees
 * wound with lights, sky lanterns rising, and warm bokeh drifting near.
 *
 * Origin: the front of the plinth on the axis; the stage is at z = -SZ.
 */
import { THREE, clamp, lerp, smooth, rng, col, box, cyl, archAt, pointedArch, notchShape, shiftPts, swag, groundShade,
         Garlands, PointSet, pointKit, GLOW_F, HALO_F, FLAME_F, LANTERN_F, worldUV, stoneTexture, onionDome,
         broadleaf, treeMesh, pool, diyaBowls , Q, tag } from '../lib.js';
import { tinted, merge, softSprite } from '../../immersive/kit.js';
import { keyed, cols } from '../timeline.js';
import { HALL } from '../land.js';

var HW = 7.6, D = 26, PH = 0.6, CH = 5.2, SZ = 22.5;     // half-width, depth, plinth, column height, stage
var C = cols(['px', 'py', 'pz', 'tx', 'ty', 'tz', 'tod', 'lant']);
var WIDE = keyed([
  //  at   px    py    pz     tx    ty    tz    tod    lant
  [0,      1.4,  3.1,  13.0, -3.0,  3.7,  -20,  21.5,  0],
  [0.5,    1.2,  3.0,  10.5, -2.7,  3.5,  -20,  21.75, 0.5],
  [1,      1.0,  2.8,   8.0, -2.4,  3.2,  -20,  22.0,  1]
]);
var TALL = keyed([
  [0,      0,    2.9,  14.0,  0,    4.4,  -20,  21.5,  0],
  [0.5,    0,    2.8,  11.5,  0,    4.4,  -20,  21.75, 0.5],
  [1,      0,    2.7,   9.0,  0,    4.4,  -20,  22.0,  1]
]);
export function pose(u, out, f) {
  var row = (f.aspect < 0.9 ? TALL : WIDE)(u), o = HALL;
  out.pos.set(o.x + row[C.px], row[C.py], o.z + row[C.pz]);
  out.tgt.set(o.x + row[C.tx], row[C.ty], o.z + row[C.tz]);
  out.tod = row[C.tod];
  out.mist = 0;
}

export function build(W) {
  var small = W.small, o = HALL, r = rng(2110);
  var group = new THREE.Group();
  group.position.set(o.x, 0, o.z);
  var U = { uTime: { value: 0 }, uScale: { value: 600 }, uFogD: { value: 0.004 }, uLant: { value: 0 }, uLit: { value: 1 } };
  var pk = pointKit(U, group);
  var G = new Garlands();
  var g = [], glow = [];
  // Warm cream marble and gold, lit by the chandeliers and the canopy.
  var M = { marble: '#fbe9cc', marble2: '#f0d6ae', inlay: '#d9aa48', red: '#8e1f2c', gold: '#e2ae4a', lawn: '#2e4a24' };
  var cF = [col('#ffd88a'), col('#ffe6b0'), col('#ffc060'), col('#fff0d0')];
  var fairy = new PointSet(), flames = new PointSet(), crystals = new PointSet(), chand = [], roofLamps = new PointSet();

  // ── Lawn and plinth ────────────────────────────────────────────────────
  // The lawn: mown grass in stripes, garden beds of marigolds and roses, and
  // gravel walks (so it reads from above as a garden, not a flat sheet).
  var lc = document.createElement('canvas'); lc.width = lc.height = 512;
  var lx = lc.getContext('2d'), lr = rng(7);
  for (var ls = 0; ls < 16; ls++) { lx.fillStyle = ls % 2 ? '#3c5c2a' : '#46682f'; lx.fillRect(ls * 32, 0, 32, 512); }
  for (var ln = 0; ln < 2600; ln++) { lx.fillStyle = lr() < 0.5 ? 'rgba(20,40,10,0.25)' : 'rgba(120,150,70,0.18)'; lx.fillRect(lr() * 512, lr() * 512, 2, 2 + lr() * 3); }
  lx.fillStyle = '#c8b08a';
  [[0, 236, 512, 40], [236, 0, 40, 512]].forEach(function (q) { lx.fillRect(q[0], q[1], q[2], q[3]); });
  [[96, 96], [416, 96], [96, 416], [416, 416]].forEach(function (c) {
    lx.fillStyle = '#c8b08a'; lx.beginPath(); lx.arc(c[0], c[1], 70, 0, 7); lx.fill();
    lx.fillStyle = '#2e4a22'; lx.beginPath(); lx.arc(c[0], c[1], 58, 0, 7); lx.fill();
    for (var b = 0; b < 140; b++) { var a = lr() * 7, rr = 10 + lr() * 44; lx.fillStyle = ['#ff9a1a', '#ffc21f', '#c2183a', '#f4a3b6'][(lr() * 4) | 0]; lx.beginPath(); lx.arc(c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, 3, 0, 7); lx.fill(); }
  });
  var lawnTex = new THREE.CanvasTexture(lc); lawnTex.colorSpace = THREE.SRGBColorSpace; lawnTex.wrapS = lawnTex.wrapT = THREE.RepeatWrapping; lawnTex.repeat.set(2, 2.4); lawnTex.anisotropy = 4;
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(44, 52).rotateX(-Math.PI / 2).translate(0, 0.015, -D / 2 + 4),
    new THREE.MeshLambertMaterial({ map: lawnTex, emissive: '#18240e' })));
  // A paved path across the lawn to the steps.
  var pt = stoneTexture().clone(); pt.needsUpdate = true; pt.repeat.set(2.4, 6);
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(4.8, 12).rotateX(-Math.PI / 2).translate(0, 0.025, 7.6),
    new THREE.MeshLambertMaterial({ color: '#e8cfa6', map: pt, emissive: '#3a220c' })));
  box(g, -HW - 0.6, HW + 0.6, 0, PH, -D - 0.6, 0.6, M.marble2);
  box(g, -HW - 0.75, HW + 0.75, 0, 0.12, -D - 0.75, 0.75, M.inlay);
  for (var st = 0; st < 3; st++) box(g, -3.2, 3.2, 0, PH - (st + 1) * 0.2, 0.6, 0.6 + 0.38 * (st + 1), M.marble);
  var ft = stoneTexture().clone(); ft.needsUpdate = true; ft.repeat.set(HW, D / 2);
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, D).rotateX(-Math.PI / 2).translate(0, PH + 0.01, -D / 2),
    new THREE.MeshPhongMaterial({ color: '#f8e4c4', map: ft, specular: '#8a6a40', shininess: 60, emissive: '#4a2c10' })));
  box(g, -1.3, 1.3, PH + 0.01, PH + 0.03, -SZ + 1.6, 0.4, M.red);                                   // the runner
  [-1, 1].forEach(function (s) { box(g, s * 1.3 - 0.08, s * 1.3 + 0.08, PH + 0.01, PH + 0.035, -SZ + 1.6, 0.4, M.inlay); });

  // ── Columns, arches and roof ───────────────────────────────────────────
  var NB = 7, BS = D / NB;
  [-1, 1].forEach(function (s) {
    var x = s * HW;
    for (var k = 0; k <= NB; k++) {
      var z = -k * BS;
      [-0.22, 0.22].forEach(function (dz) {
        if ((k === 0 && dz < 0) || (k === NB && dz > 0)) return;
        cyl(g, x, z + dz, PH + 0.3, CH - 0.35, 0.13, M.marble, 10);
        g.push(tinted(new THREE.CylinderGeometry(0.22, 0.16, 0.3, 10).translate(x, PH + 0.15, z + dz), M.marble2));
        g.push(tinted(new THREE.CylinderGeometry(0.17, 0.24, 0.32, 10).translate(x, CH - 0.2, z + dz), M.inlay));
      });
    }
    // The cusped arcade, as one facade strip above the columns.
    var bays = [], one = pointedArch(BS - 0.8, CH - 1.9 - PH, CH - 0.55 - PH, 9, 0.1, 14);
    for (k = 0; k < NB; k++) bays.push(shiftPts(one, (k + 0.5) * BS));
    var fac = new THREE.ExtrudeGeometry(notchShape(0, D, CH + 0.3 - PH, bays), { depth: 0.36, bevelEnabled: false });
    fac.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2);
    if (s > 0) fac.translate(x - 0.18, PH, 0); else fac.translate(x + 0.18, PH, -D);
    // (strip's own columns are hidden by the real ones: cut its feet off)
    g.push(tinted(fac, M.marble));
  });
  // The back wall behind the stage, and the front fascia.
  box(g, -HW, HW, PH, CH + 0.3, -D - 0.3, -D, M.marble2);
  box(g, -HW - 0.3, HW + 0.3, CH, CH + 0.35, -D - 0.4, 0.4, M.marble);
  box(g, -HW - 0.5, HW + 0.5, CH + 0.35, CH + 0.5, -D - 0.55, 0.55, M.inlay);
  box(g, -HW - 0.3, HW + 0.3, CH + 0.5, CH + 1.1, -D - 0.4, 0.4, M.marble2);       // the roof slab
  // A painted ceiling: deep red coffers ruled in gold.
  var cc = document.createElement('canvas'); cc.width = cc.height = 256;
  var cx2 = cc.getContext('2d');
  cx2.fillStyle = '#5a1420'; cx2.fillRect(0, 0, 256, 256);
  cx2.strokeStyle = '#d9a441'; cx2.lineWidth = 6; cx2.strokeRect(8, 8, 240, 240);
  cx2.lineWidth = 2; cx2.strokeRect(24, 24, 208, 208);
  cx2.fillStyle = '#c99436'; cx2.beginPath();
  for (var ck = 0; ck < 16; ck++) { var ca = ck / 16 * Math.PI * 2, cr = ck % 2 ? 34 : 70; cx2.lineTo(128 + Math.cos(ca) * cr, 128 + Math.sin(ca) * cr); }
  cx2.closePath(); cx2.fill();
  cx2.fillStyle = '#7a2030'; cx2.beginPath(); cx2.arc(128, 128, 26, 0, 7); cx2.fill();
  var ceilTex = new THREE.CanvasTexture(cc); ceilTex.colorSpace = THREE.SRGBColorSpace; ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping; ceilTex.repeat.set(HW / 1.6, D / 3.2);
  var ceil = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, D).rotateX(Math.PI / 2).translate(0, CH - 0.01, -D / 2),
    new THREE.MeshLambertMaterial({ map: ceilTex, emissive: '#2a0a0e' }));
  group.add(ceil);
  // The roof terrace, for the views from above: an inlaid floor (red
  // sandstone border, marble with gold-ruled stars), parapets with merlons
  // all round, small chhatris down the long sides, diyas on the parapets
  // and strings of lights across.
  var rc = document.createElement('canvas'); rc.width = 128; rc.height = 128;
  var rx = rc.getContext('2d');
  rx.fillStyle = '#f2dcb8'; rx.fillRect(0, 0, 128, 128);
  rx.strokeStyle = '#b8743c'; rx.lineWidth = 3; rx.strokeRect(4, 4, 120, 120);
  rx.fillStyle = '#c99436'; rx.beginPath();
  for (var rk = 0; rk < 16; rk++) { var ra = rk / 16 * Math.PI * 2, rr2 = rk % 2 ? 18 : 40; rx.lineTo(64 + Math.cos(ra) * rr2, 64 + Math.sin(ra) * rr2); }
  rx.closePath(); rx.fill();
  rx.fillStyle = '#9c3a2c'; rx.beginPath(); rx.arc(64, 64, 12, 0, 7); rx.fill();
  var roofTex = new THREE.CanvasTexture(rc); roofTex.colorSpace = THREE.SRGBColorSpace; roofTex.wrapS = roofTex.wrapT = THREE.RepeatWrapping;
  roofTex.repeat.set((HW * 2 - 1) / 2.4, (D - 0.4) / 2.4); roofTex.anisotropy = 4;
  var roofFloor = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 - 1, D - 0.4).rotateX(-Math.PI / 2).translate(0, CH + 1.115, -D / 2),
    new THREE.MeshLambertMaterial({ map: roofTex, emissive: '#3a2410' }));
  group.add(roofFloor);
  box(g, -HW - 0.3, HW + 0.3, CH + 1.1, CH + 1.12, -D - 0.4, 0.4, '#a8543c');                    // sandstone border round it
  [[-HW - 0.3, HW + 0.3, 0.15, 0.4], [-HW - 0.3, HW + 0.3, -D - 0.4, -D - 0.15]].forEach(function (q) { box(g, q[0], q[1], CH + 1.1, CH + 1.5, q[2], q[3], M.marble); });
  [-1, 1].forEach(function (s) { box(g, s * HW + (s > 0 ? 0.05 : -0.3), s * HW + (s > 0 ? 0.3 : -0.05), CH + 1.1, CH + 1.5, -D - 0.4, 0.4, M.marble); });
  for (var mx = -HW; mx <= HW + 0.01; mx += 0.65) { box(g, mx - 0.12, mx + 0.12, CH + 1.5, CH + 1.75, 0.18, 0.38, M.marble); box(g, mx - 0.12, mx + 0.12, CH + 1.5, CH + 1.75, -D - 0.38, -D - 0.18, M.marble); }
  [-1, 1].forEach(function (s) { for (var mz = 0; mz >= -D; mz -= 0.65) box(g, s * (HW + 0.07) - 0.1, s * (HW + 0.07) + 0.1, CH + 1.5, CH + 1.75, mz - 0.12, mz + 0.12, M.marble); });
  [-1, 1].forEach(function (s) {
    [-8.6, -15.6].forEach(function (cz) {
      var cx = s * (HW - 0.4), y0 = CH + 1.1;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { box(g, cx + q[0] * 0.4 - 0.05, cx + q[0] * 0.4 + 0.05, y0, y0 + 0.9, cz + q[1] * 0.4 - 0.05, cz + q[1] * 0.4 + 0.05, M.marble); });
      box(g, cx - 0.55, cx + 0.55, y0 + 0.9, y0 + 1.0, cz - 0.55, cz + 0.55, M.marble);
      g.push(onionDome(0.48, y0 + 1.0, M.marble, small ? 10 : 14).translate(cx, 0, cz));
      roofLamps.add(cx, y0 + 0.5, cz, 0, r(), 0, 1.3);
    });
  });
  for (var px = -HW + 0.4; px <= HW - 0.39; px += small ? 1.3 : 0.9) { roofLamps.add(px, CH + 1.5, 0.28, 0, r(), 0, 0.8); roofLamps.add(px, CH + 1.5, -D - 0.28, 0, r(), 0, 0.8); }
  [-1, 1].forEach(function (s) { for (var pz = -1; pz > -D; pz -= small ? 1.3 : 0.9) roofLamps.add(s * (HW + 0.07), CH + 1.5, pz, 0, r(), 0, 0.8); });
  [-4, -11, -18].forEach(function (z) { swag([-HW + 0.3, CH + 2.4, z], [HW - 0.3, CH + 2.4, z], 0.7, small ? 22 : 34, function (x, y, zz) { fairy.add(x, y, zz, 0, r(), 0, 0.85, cF[(r() * 4) | 0]); }); });
  // Chhatris on the four corners and a dome over the stage.
  [[-HW, 0], [HW, 0], [-HW, -D], [HW, -D]].forEach(function (c) {
    var y0 = CH + 1.1;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { box(g, c[0] + q[0] * 0.5 - 0.06, c[0] + q[0] * 0.5 + 0.06, y0, y0 + 1.1, c[1] + q[1] * 0.5 - 0.06, c[1] + q[1] * 0.5 + 0.06, M.marble); });
    box(g, c[0] - 0.7, c[0] + 0.7, y0 + 1.1, y0 + 1.22, c[1] - 0.7, c[1] + 0.7, M.marble);
    g.push(onionDome(0.6, y0 + 1.22, M.marble, small ? 12 : 16).translate(c[0], 0, c[1]));
    for (var j = 0; j < 12; j++) { var a = j / 12 * Math.PI * 2; fairy.add(c[0] + Math.cos(a) * 0.72, y0 + 1.25, c[1] + Math.sin(a) * 0.72, 0, r(), 0, 0.9, cF[j % 4]); }
  });
  g.push(tinted(new THREE.CylinderGeometry(2.0, 2.1, 0.8, 18).translate(0, CH + 1.5, -SZ), M.marble2));
  g.push(onionDome(1.9, CH + 1.9, M.marble, small ? 16 : 22).translate(0, 0, -SZ));
  // Lights along the roof's edges.
  for (var ex = -HW - 0.3; ex <= HW + 0.3; ex += small ? 0.4 : 0.28) { fairy.add(ex, CH + 1.15, 0.45, 0, r(), 0, 0.9, cF[1]); fairy.add(ex, CH + 0.4, 0.5, 0, r(), 0, 0.9, cF[0]); }
  [-1, 1].forEach(function (s) { for (var ez = 0.4; ez > -D - 0.4; ez -= small ? 0.4 : 0.28) fairy.add(s * (HW + 0.35), CH + 0.4, ez, 0, r(), 0, 0.9, cF[0]); });

  // ── The canopy of lights, and chandeliers ──────────────────────────────
  var hub = [0, CH - 0.2, -D / 2 + 1];
  var NS = small ? 18 : 28;
  for (var si = 0; si < NS; si++) {
    var t = si / NS, ex2, ez2;
    // round the eaves' rectangle
    var per = t * 4, side = Math.floor(per), f2 = per - side;
    if (side === 0) { ex2 = lerp(-HW + 0.3, HW - 0.3, f2); ez2 = -0.2; }
    else if (side === 1) { ex2 = HW - 0.3; ez2 = lerp(-0.2, -D + 0.6, f2); }
    else if (side === 2) { ex2 = lerp(HW - 0.3, -HW + 0.3, f2); ez2 = -D + 0.6; }
    else { ex2 = -HW + 0.3; ez2 = lerp(-D + 0.6, -0.2, f2); }
    var nL = small ? 18 : 26;
    swag(hub, [ex2, CH - 0.15, ez2], 0.9, nL, function (x, y, z, tt) { if (tt > 0.04) fairy.add(x, y, z, 0, r(), 0, 0.85, cF[(r() * 4) | 0]); });
  }
  [-6.5, -12.5, -18.5].forEach(function (cz, ci) {
    // Three tiers of gilded rings with candles, and strings of crystal drops.
    var cy = CH - 1.7;
    cyl(g, 0, cz, cy + 0.9, CH - 0.1, 0.02, '#8a6a30', 4);
    [[1.05, 0], [0.75, 0.42], [0.42, 0.8]].forEach(function (t2, ti) {
      var R2 = t2[0], y2 = cy + t2[1];
      chand.push(tinted(new THREE.TorusGeometry(R2, 0.045, 6, 36).rotateX(Math.PI / 2).translate(0, y2, cz), M.gold));
      var nc = ti === 0 ? 16 : ti === 1 ? 12 : 8;
      for (var k = 0; k < nc; k++) {
        var a = k / nc * Math.PI * 2 + ti * 0.2, x2 = Math.cos(a) * R2, z2 = cz + Math.sin(a) * R2;
        chand.push(tinted(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 5).translate(x2, y2 + 0.09, z2), '#fff4e0'));
        flames.add(x2, y2 + 0.22, z2, 0, r(), 0, 0.85);
        if (ti < 2) for (var d = 0; d < (ti ? 3 : 5); d++) crystals.add(x2, y2 - 0.1 - d * 0.11, z2, 0, r(), 0, 0.8, cF[3]);
      }
      for (var sp = 0; sp < 6; sp++) { var sa = sp / 6 * Math.PI * 2; chand.push(tinted(new THREE.CylinderGeometry(0.018, 0.018, R2, 3).rotateZ(Math.PI / 2).translate(R2 / 2, y2, 0).rotateY(sa).translate(0, 0, cz), M.gold)); }
    });
    chand.push(tinted(new THREE.SphereGeometry(0.16, 10, 6).translate(0, cy - 0.2, cz), M.gold));
    for (var d2 = 0; d2 < 8; d2++) crystals.add(0, cy - 0.38 - d2 * 0.1, cz, 0, r(), 0, 0.9, cF[3]);
  });

  // ── The floral stage ───────────────────────────────────────────────────
  box(g, -4.6, 4.6, PH, PH + 0.55, -D, -SZ + 1.4, M.marble);
  box(g, -4.7, 4.7, PH + 0.5, PH + 0.56, -D, -SZ + 1.5, M.inlay);
  for (st = 0; st < 2; st++) box(g, -2, 2, PH, PH + 0.55 - (st + 1) * 0.18, -SZ + 1.4, -SZ + 1.4 + 0.35 * (st + 1), M.marble);
  box(g, -4.4, 4.4, PH + 0.56, PH + 0.58, -D, -SZ + 1.2, '#a3222e');
  // A wall of flowers round an arch: roses and white blooms, one instanced mesh.
  var fl = [], fCols = [col('#fff4ea'), col('#f6c4d0'), col('#e8607e'), col('#c2183a'), col('#fff8f0')];
  var wallZ = -D + 0.35, arcR = 2.2, arcY = PH + 0.56 + 2.0;
  for (var fx = -4.3; fx <= 4.3; fx += small ? 0.17 : 0.13) {
    for (var fy = PH + 0.6; fy < CH - 0.3; fy += small ? 0.17 : 0.13) {
      var dx = fx, dy = fy - arcY;
      var inArch = (Math.abs(dx) < arcR - 0.1 && fy < arcY) || (dx * dx + dy * dy < (arcR - 0.1) * (arcR - 0.1) && fy >= arcY);
      if (inArch) continue;
      fl.push([fx + (r() - 0.5) * 0.06, fy + (r() - 0.5) * 0.06, wallZ + r() * 0.12, 0.07 + r() * 0.04, fCols[(r() * fCols.length) | 0]]);
    }
  }
  // The arch's edge: a band of deep red roses.
  for (var k3 = 0; k3 <= 60; k3++) {
    var a3 = k3 / 60 * Math.PI;
    fl.push([Math.cos(a3) * arcR, arcY + Math.sin(a3) * arcR, wallZ + 0.15, 0.1, fCols[3]]);
  }
  for (var y3 = PH + 0.6; y3 < arcY; y3 += 0.12) [-1, 1].forEach(function (s) { fl.push([s * arcR, y3, wallZ + 0.15, 0.1, fCols[3]]); });
  var flowers = new THREE.InstancedMesh(small ? new THREE.OctahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#2a0a10' }), fl.length);
  var mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e3 = new THREE.Euler(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
  fl.forEach(function (b2, i) {
    flowers.setMatrixAt(i, mtx.compose(ps.set(b2[0], b2[1], b2[2]), q4.setFromEuler(e3.set(r() * 3, r() * 3, 0)), sc.set(b2[3], b2[3], b2[3] * 0.7)));
    flowers.setColorAt(i, b2[4]);
  });
  group.add(flowers);
  // A soft glow inside the arch, behind the chairs.
  var archGlow = new THREE.Mesh(new THREE.CircleGeometry(arcR - 0.1, 24, 0, Math.PI).translate(0, arcY, wallZ - 0.01), new THREE.MeshBasicMaterial({ color: '#c8784a', fog: false }));
  var archLow = new THREE.Mesh(new THREE.PlaneGeometry((arcR - 0.1) * 2, arcY - PH - 0.56).translate(0, (arcY + PH + 0.56) / 2, wallZ - 0.01), archGlow.material);
  group.add(archGlow, archLow);
  // Two empty gilded chairs.
  [-0.8, 0.8].forEach(function (x) {
    var y0 = PH + 0.58, cz = -D + 1.7;
    box(g, x - 0.42, x + 0.42, y0 + 0.4, y0 + 0.55, cz - 0.38, cz + 0.38, M.gold);                      // seat frame
    box(g, x - 0.38, x + 0.38, y0 + 0.55, y0 + 0.68, cz - 0.34, cz + 0.34, M.red);                      // cushion
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { box(g, x + q[0] * 0.36 - 0.04, x + q[0] * 0.36 + 0.04, y0, y0 + 0.4, cz + q[1] * 0.32 - 0.04, cz + q[1] * 0.32 + 0.04, M.gold); });
    box(g, x - 0.42, x + 0.42, y0 + 0.55, y0 + 1.55, cz - 0.42, cz - 0.32, M.gold);                     // back
    box(g, x - 0.34, x + 0.34, y0 + 0.65, y0 + 1.45, cz - 0.32, cz - 0.27, M.red);
    g.push(tinted(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(x, y0 + 1.55, cz - 0.37), M.gold));
    [-1, 1].forEach(function (s) { box(g, x + s * 0.42 - 0.05, x + s * 0.42 + 0.05, y0 + 0.55, y0 + 0.85, cz - 0.38, cz + 0.36, M.gold); });
  });
  // Urns of flowers either side of the stage, and a garland along its edge.
  [-3.6, 3.6].forEach(function (x) {
    g.push(tinted(new THREE.CylinderGeometry(0.3, 0.2, 0.7, 12).translate(x, PH + 0.56 + 0.35, -SZ + 0.6), M.gold));
    for (var k = 0; k < 26; k++) { var a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.45; G.ball(x + Math.cos(a) * rr, PH + 1.35 + r() * 0.4 - rr * 0.4, -SZ + 0.6 + Math.sin(a) * rr, 0.09, fCols[(r() * 5) | 0]); }
  });
  for (var gx = -4.5; gx < 4.5; gx += 1.5) G.garlandTo([gx, PH + 0.52, -SZ + 1.45], [gx + 1.5, PH + 0.52, -SZ + 1.45], 0.18, small ? 7 : 10, 0.06);
  // Curtains of marigolds and roses either side of the stage, a toran of
  // roses across its front, and urns of flowers at the foot of its steps.
  [-1, 1].forEach(function (s2) {
    for (var cx3 = 4.5; cx3 <= HW - 0.4; cx3 += small ? 0.28 : 0.2) G.strand(s2 * cx3, CH - 0.1, -D + 0.5 + (cx3 % 0.4) * 0.5, small ? 22 : 30, 0.13, 0.065, 3);
  });
  swag([-4.4, CH - 0.35, -SZ + 1.2], [4.4, CH - 0.35, -SZ + 1.2], 0.55, small ? 36 : 56, function (x, y, z, t, k) {
    G.ball(x, y, z, 0.08, k % 2 ? G.ROSE : null);
    if (k % 3 === 0 && t > 0.02 && t < 0.98) G.strand(x, y - 0.14, z, 5 + (k % 2), 0.13, 0.065, 2);
  });
  [-2.6, 2.6].forEach(function (x) {
    g.push(tinted(new THREE.CylinderGeometry(0.36, 0.24, 0.8, 12).translate(x, PH + 0.4, -SZ + 2.4), M.gold));
    for (var k = 0; k < 34; k++) { var a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.55; G.ball(x + Math.cos(a) * rr, PH + 1.0 + r() * 0.5 - rr * 0.4, -SZ + 2.4 + Math.sin(a) * rr, 0.1, fCols[(r() * 5) | 0]); }
  });

  // ── The lawn: lamps, trees in lights ───────────────────────────────────
  var lawnLamps = [];
  [-1, 1].forEach(function (s) { for (var z = 8; z > -D - 2; z -= 4.5) lawnLamps.push([s * (HW + 3.2), z]); });
  var postProf = [[0, 0], [0.18, 0], [0.18, 0.08], [0.06, 0.16], [0.04, 1.3], [0.16, 1.36], [0.2, 1.46], [0, 1.46]].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var brass = new THREE.MeshPhongMaterial({ color: '#c08a2a', specular: '#ffe0a0', shininess: 50, emissive: '#3a1c06' });
  var posts = new THREE.InstancedMesh(new THREE.LatheGeometry(postProf, 10), brass, lawnLamps.length);
  lawnLamps.forEach(function (l, i) { posts.setMatrixAt(i, mtx.makeTranslation(l[0], 0, l[1])); flames.add(l[0], 1.6, l[1], 0, r(), 0, 1.1); });
  group.add(posts);
  var leafCols = ['#ffffff', '#e4ecd8', '#f2f6e8', '#d8e2cc'].map(col), trees = [];
  [[-20, 10], [-16, -6], [-15.5, -18], [-14.5, -29], [20, 10], [16, -7], [15.5, -19], [14.5, -30], [-7, -33], [7, -33.5]].forEach(function (p, i) {
    var s = 1.0 + r() * 0.35;
    trees.push([p[0], 0, p[1], s, r() * 6, leafCols[i % 4], 1]);
    // Lights wound through each crown.
    for (var k = 0; k < (small ? 26 : 40); k++) {
      var a = r() * Math.PI * 2, rr = (0.6 + r() * 1.4) * s, y = (3.8 + r() * 2.6) * s;
      fairy.add(p[0] + Math.cos(a) * rr, y, p[1] + Math.sin(a) * rr, 0, r(), 0, 0.8, cF[(r() * 4) | 0]);
    }
  });
  group.add(treeMesh(broadleaf('#3a2a20', '#2c4424'), trees));

  // ── Point fields ───────────────────────────────────────────────────────
  var FL = 'float fl(){ return 0.86 + 0.14 * sin(uTime * (7.0 + aData.y * 5.0) + aData.y * 40.0); }\n';
  pk.add(fairy, 'vec4 place(){ float tw = 0.7 + 0.3 * sin(uTime * (1.3 + aData.y * 2.0) + aData.y * 50.0); return vec4(position, tw); }\n', [[GLOW_F, 0.15, 1.5, 2]]);
  pk.add(flames, FL + 'vec4 place(){ vCol = vec3(1.0, 0.58, 0.22); return vec4(position, fl()); }\n', [[HALO_F, 0.5, 2.2, 1, false, 2], [FLAME_F, 0.16, 1.8, 2]]);
  tag(pk.add(crystals, 'vec4 place(){ float tw = pow(0.5 + 0.5 * sin(uTime * (2.0 + aData.y * 3.0) + aData.y * 60.0), 4.0); return vec4(position, 0.35 + 0.65 * tw); }\n', [[GLOW_F, 0.06, 1.4, 3]]), 'pts');
  group.add(diyaBowls(roofLamps, 1.2, small ? 8 : 12));
  pk.add(roofLamps, FL + 'vec4 place(){ vCol = vec3(1.0, 0.56, 0.22); return vec4(position + vec3(0.0, 0.18, 0.0), fl()); }\n',
    [[HALO_F, 0.7, 2.2, 1, false, 2], [FLAME_F, 0.2, 1.6, 2]]);
  var halos = new PointSet();
  [-6.5, -12.5, -18.5].forEach(function (cz) { halos.add(0, CH - 1.35, cz, 0, r(), 0, 4.2, col('#ffc070')); });
  // Diyas along the front steps and both long edges of the plinth, so the
  // foreground glows; and round the stage.
  var diyas = new PointSet();
  for (var st2 = 0; st2 < 3; st2++) for (var dx = -3.0; dx <= 3.01; dx += small ? 0.6 : 0.42) diyas.add(dx, PH - (st2 + 1) * 0.2, 0.6 + 0.38 * (st2 + 1) - 0.12, 0, r(), 0, 1);
  [-1, 1].forEach(function (s) {
    for (var dz = 0.3; dz > -D; dz -= small ? 0.75 : 0.5) diyas.add(s * (HW + 0.35), PH, dz, 0, r(), 0, 1);
    for (dx = 3.3; dx <= HW + 0.4; dx += small ? 0.6 : 0.42) diyas.add(s * dx, PH, 0.45, 0, r(), 0, 1);
  });
  for (var sx = -4.4; sx <= 4.41; sx += small ? 0.5 : 0.35) diyas.add(sx, PH + 0.56, -SZ + 1.32, 0, r(), 0, 0.9);
  // Both edges of the path, and a ring of them round the plinth's foot.
  for (var pz = 1.8; pz < 13.5; pz += small ? 0.7 : 0.5) [-2.45, 2.45].forEach(function (x) { diyas.add(x, 0.03, pz, 0, r(), 0, 1.05); });
  for (var fx3 = -HW - 0.9; fx3 <= HW + 0.9; fx3 += small ? 0.7 : 0.5) if (Math.abs(fx3) > 3.4) diyas.add(fx3, 0.03, 1.05, 0, r(), 0, 1);
  group.add(diyaBowls(diyas, 1.1, small ? 8 : 12));
  pk.add(diyas, FL + 'vec4 place(){ vCol = vec3(1.0, 0.55, 0.2); return vec4(position + vec3(0.0, 0.17, 0.0), fl()); }\n',
    [[HALO_F, 0.55, 2.0, 1, false, 2], [FLAME_F, 0.17, 1.5, 2]]);
  halos.add(0, PH + 2.4, -D + 1.2, 0, 0.5, 0, 5.5, col('#ffb070'));
  pk.add(halos, 'vec4 place(){ return vec4(position, 0.55); }\n', [[HALO_F, 1.0, 2.0, 1]]);
  // Sky lanterns rising from beyond the hall.
  var lant = new PointSet();
  for (var k4 = 0; k4 < (small ? 30 : 50); k4++) { var lx = (r() < 0.5 ? -1 : 1) * (10 + r() * 22); lant.add(lx, 1 + r() * 4, 8 - r() * 44, r() * 0.5, r(), 0, 0.8 + r() * 0.5); }
  tag(pk.add(lant,
    'vec4 place(){ float s = aData.y, t = clamp((uLant - aData.x) / 0.5, 0.0, 1.0) + fract(uTime * 0.012 + s) * 0.0;\n' +
    ' float up = 6.0 + t * (10.0 + s * 26.0) + mod(uTime * (0.25 + s * 0.2) + s * 40.0, 40.0);\n' +
    ' vec3 p = position + vec3(sin(uTime * 0.25 + s * 30.0) * 0.6 + up * 0.1 * (s - 0.4), up, -up * 0.15 * s);\n' +
    ' float fl = 0.85 + 0.15 * sin(uTime * 7.0 + s * 40.0);\n' +
    ' return vec4(p, (0.35 + 0.65 * smoothstep(0.0, 0.2, t)) * fl * (1.0 - smoothstep(34.0, 46.0, up))); }\n',
    [[LANTERN_F, 0.75, 2.4, 3]]), 'pts');
  // Warm bokeh: big soft lights drifting close to the camera, out of focus.
  var bokeh = new PointSet(), bCols = [col('#ffcf8a'), col('#ffb070'), col('#ffe2b0'), col('#f6a0b0')];
  for (k4 = 0; k4 < (small ? 22 : 36); k4++) bokeh.add((r() - 0.5) * 12, 1 + r() * 5, 4 + r() * 8, 0, r(), 0, 0.7 + r() * 0.8, bCols[k4 % 4]);
  tag(pk.add(bokeh,
    'vec4 place(){ float s = aData.y; vec3 p = position + vec3(sin(uTime * 0.12 + s * 20.0) * 0.8, sin(uTime * 0.17 + s * 13.0) * 0.4, cos(uTime * 0.1 + s * 9.0) * 0.6);\n' +
    ' return vec4(p, 0.16 * (0.6 + 0.4 * sin(uTime * 0.6 + s * 30.0))); }\n',
    [[HALO_F, 0.9, 6.0, 9]]), 'lowSkip');

  // ── Assemble ───────────────────────────────────────────────────────────
  var stone = merge(g);
  groundShade(stone, 0, 2.0, 0.82);
  worldUV(stone, 2);
  group.add(new THREE.Mesh(stone, new THREE.MeshLambertMaterial({ vertexColors: true, map: stoneTexture(), emissive: '#5a3612' })));
  group.add(new THREE.Mesh(merge(chand), new THREE.MeshPhongMaterial({ vertexColors: true, emissive: '#7a5214', specular: '#ffe6a8', shininess: 60 })));
  if (glow.length) group.add(new THREE.Mesh(merge(glow), new THREE.MeshBasicMaterial({ vertexColors: true, fog: true })));
  var garlands = G.mesh('#3a1004', small);
  group.add(garlands);
  var poolTex = softSprite('rgba(255,170,90,1)', 'rgba(255,120,40,0)');
  var pools = [pool(group, poolTex, 0, PH, -12.5, 14, 0.9), pool(group, poolTex, 0, PH + 0.56, -D + 2, 7)];
  lawnLamps.forEach(function (l) { pools.push(pool(group, poolTex, l[0], 0, l[1], 3.4)); });
  [3.5, 7.5, 11.5].forEach(function (z) { pools.push(pool(group, poolTex, 0, 0.02, z, 6.5, 1.0)); });
  [-1, 1].forEach(function (s) { pools.push(pool(group, poolTex, s * (HW - 1), 0.02, 2.0, 7, 1.4)); });

  var warmS = col('#ffcf9a'), warmG = col('#7a4a24');
  var centreW = new THREE.Vector3(o.x, 3, o.z - 13);
  function frame(f) {
    // From the Baraat avenue the hall is a glow through the gate: its
    // thousands of garland flowers wait until we come closer.
    garlands.visible = W.camera.position.distanceTo(centreW) < 48;
    U.uTime.value = f.time; U.uScale.value = f.pxScale; U.uFogD.value = f.fogD * 0.5;
    U.uLant.value = f.u * f.w + (1 - f.w) * 0.2;
    U.uLit.value = clamp(f.P.hi * 0.6 + 0.3, 0.5, 1.1);
    pools[0].material.opacity = 0.55; pools[1].material.opacity = 0.6;
    for (var i = 2; i < pools.length; i++) pools[i].material.opacity = 0.42;
    // Warm the night round the hall: its glow fills the court.
    var w = f.w, P = f.P;
    P.hs.lerp(warmS, 0.55 * w); P.hg.lerp(warmG, 0.6 * w); P.hi = lerp(P.hi, 1.25, w);
    var fl = f.reduce ? 1 : 0.94 + 0.06 * Math.sin(f.time * 7.7);
    W.lamp(o.x, CH - 1.8, o.z - 6.5, '#ffc070', 14 * fl, 16, 1.2);
    W.lamp(o.x, CH - 1.8, o.z - 12.5, '#ffc070', 14 * fl, 16, 1.2);
    W.lamp(o.x, CH - 1.8, o.z - 18.5, '#ffc070', 14 * fl, 16, 1.2);
    W.lamp(o.x, PH + 2.2, o.z - D + 2.5, '#ffb070', 10, 10, 1.4);
    W.lamp(o.x, PH + 0.8, o.z + 1.4, '#ff9a48', 8 * fl, 9, 1.6);
  }
  // It has a stand-in in estate.js, so from far away it can step aside.
  return { group: group, frame: frame, centre: new THREE.Vector3(o.x, 3, o.z - 13) };
}
