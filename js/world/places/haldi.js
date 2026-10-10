/*
 * Haldi: the morning of Tuesday 9 March, in the courtyard of the groom's
 * home at Noorpur. No people: the morning is laid ready for them.
 *
 * A turmeric-washed courtyard closed by two-storey haveli walls with cusped
 * arcades and jharokhas. In the middle, a low canopy on marigold-wound
 * bamboo poles, draped in yellow and saffron, with banana plants tied to its
 * front poles and a toran of mango leaves; under it two empty low seats
 * (patlas) on a white cloth, and before them brass urlis of turmeric paste
 * with floating marigolds, a kalash and a few small bowls. Marigold strings
 * swing from the rooftops to the canopy; the sun slants in over the east
 * wall in shafts through a fine turmeric haze, and petals drift.
 *
 * Origin: the middle of the front (east-west) wall; the court runs back to
 * z = -DEPTH. The camera stands just inside, looking at the canopy.
 */
import { THREE, clamp, lerp, smooth, rng, col, box, cyl, archAt, pointedArch, notchShape, shiftPts, swag, groundShade,
         Garlands, PointSet, pointKit, GLOW_F, HALO_F, FLAME_F, PETAL_F, diyaBowls, worldUV, stoneTexture, onionDome,
         rangoliTexture, rangoli, broadleaf, treeMesh , Q, tag } from '../lib.js';
import { tinted, merge, softSprite } from '../../immersive/kit.js';
import { keyed, cols } from '../timeline.js';
import { HALDI } from '../land.js';
import { SUNRISE } from '../sky.js';

var HALF = 12, DEPTH = 27, CZ = -14;        // court half-width, depth, canopy centre (local z)
var C = cols(['px', 'py', 'pz', 'tx', 'ty', 'tz', 'tod']);
var WIDE = keyed([
  //  at   px    py    pz     tx    ty    tz    tod
  // Arriving from the air: crane down over the front wall into the court.
  [0,      3.4,  11.0, -2.2, -1.6,  0.6,  -17,  9.0],
  [0.32,   3.0,  2.5,  -3.2, -2.6,  1.8,  -17,  9.15],
  [1,      1.8,  2.2,  -5.4, -2.2,  1.6,  -17,  9.6]
]);
var TALL = keyed([
  [0,      0,    11.5, -2.0,  0,    0.6,  -16,  9.0],
  [0.32,   0,    2.6,  -2.8,  0,    2.6,  -17,  9.15],
  [1,      0,    2.4,  -4.8,  0,    2.2,  -17,  9.6]
]);
export function pose(u, out, f) {
  var row = (f.aspect < 0.9 ? TALL : WIDE)(u), o = HALDI;
  out.pos.set(o.x + row[C.px], row[C.py], o.z + row[C.pz]);
  out.tgt.set(o.x + row[C.tx], row[C.ty], o.z + row[C.tz]);
  out.tod = row[C.tod];
  out.mist = 0;
}

// The sun's direction at about 9 in the morning (as sky.js places it).
function sunAt(h) {
  var s = (h - 6) / 12.3, phi = lerp(SUNRISE, Math.PI, s), el = Math.sin(Math.PI * s) * 1.22;
  return new THREE.Vector3(Math.sin(phi) * Math.cos(el), Math.sin(el), Math.cos(phi) * Math.cos(el));
}

// One haveli wall facing +z along x in [-L/2, L/2]: an arcade below, a
// storey of windows and jharokhas above, a parapet with merlons.
function wallFace(g, glow, L, P, r, opts) {
  var H1 = 3.4, H2 = 6.4, NA = Math.max(3, Math.round(L / 3.4)), AS = L / NA;
  var bays = [], one = pointedArch(AS - 0.95, 1.6, 2.75, 7, 0.1, 12);
  for (var k = 0; k < NA; k++) bays.push(shiftPts(one, -L / 2 + (k + 0.5) * AS));
  g.push(tinted(new THREE.ExtrudeGeometry(notchShape(-L / 2, L / 2, H1, bays), { depth: 0.45, bevelEnabled: false }), P.wall));
  // The rooms behind: a dim back wall with a warm doorway in alternate bays.
  box(g, -L / 2, L / 2, 0, H1, -2.2, -2.0, P.wall2);
  box(g, -L / 2, L / 2, H1 - 0.2, H1, -2.2, 0, P.trim);
  for (k = 0; k < NA; k++) {
    var cx = -L / 2 + (k + 0.5) * AS;
    if (k % 2 === 0) archAt(glow, 1.1, 2.1, cx, 0, -1.98, col('#ffb862'));
    else archAt(g, 1.1, 2.1, cx, 0, -1.98, P.red);
  }
  // Upper storey.
  box(g, -L / 2, L / 2, H1, H2, -0.6, -0.15, P.wall2);
  box(g, -L / 2 - 0.1, L / 2 + 0.1, H1, H1 + 0.18, -0.6, 0.35, P.trim);
  for (k = 0; k < NA; k++) {
    cx = -L / 2 + (k + 0.5) * AS;
    if (k % 2 === 1 && opts.jharokha) {
      box(g, cx - 0.8, cx + 0.8, H1 + 0.35, H1 + 0.55, -0.15, 0.6, P.trim);
      box(g, cx - 0.66, cx + 0.66, H1 + 0.55, H1 + 2.0, -0.15, 0.45, P.wall);
      archAt(glow, 0.7, 1.05, cx, H1 + 0.72, 0.46, col('#ffa04a'));
      g.push(tinted(new THREE.ConeGeometry(1.0, 0.55, 4).rotateY(Math.PI / 4).translate(cx, H1 + 2.28, 0.15), P.dome));
    } else {
      archAt(g, 0.95, 1.6, cx, H1 + 0.6, -0.14, P.trim);
      archAt(glow, 0.7, 1.3, cx, H1 + 0.72, -0.13, col('#ffa85a'));
    }
  }
  // Eave, parapet and merlons.
  box(g, -L / 2 - 0.2, L / 2 + 0.2, H2, H2 + 0.16, -0.7, 0.5, P.trim);
  box(g, -L / 2, L / 2, H2 + 0.16, H2 + 0.62, -0.5, -0.2, P.wall2);
  for (var mx = -L / 2; mx <= L / 2 + 0.01; mx += 0.6) box(g, mx - 0.12, mx + 0.12, H2 + 0.62, H2 + 0.9, -0.45, -0.25, P.trim);
  return { H1: H1, H2: H2, NA: NA, AS: AS };
}

export function build(W) {
  var small = W.small, o = HALDI, r = rng(909);
  var group = new THREE.Group();
  group.position.set(o.x, 0, o.z);
  var U = { uTime: { value: 0 }, uScale: { value: 600 }, uFogD: { value: 0.004 }, uLit: { value: 1 } };
  var pk = pointKit(U, group);
  var G = new Garlands();
  var g = [], glow = [];
  var P = { wall: '#ebb85e', wall2: '#e3a650', trim: '#f6e4bf', red: '#b04a2a', dome: '#f2dcb0' };
  var YEL = '#ffcf2e', SAF = '#ff9318', leafGreen = '#3d7a24', BRASS = '#c89a32';

  // ── The floor and the walls ────────────────────────────────────────────
  var ft = stoneTexture().clone(); ft.needsUpdate = true; ft.repeat.set(HALF, DEPTH / 2);
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, DEPTH).rotateX(-Math.PI / 2).translate(0, 0.02, -DEPTH / 2),
    new THREE.MeshLambertMaterial({ color: '#efd7ae', map: ft })));
  var walls = [
    { L: HALF * 2, m: new THREE.Matrix4().makeTranslation(0, 0, -DEPTH), j: true },                                       // back (west)
    { L: DEPTH, m: new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(-HALF, 0, -DEPTH / 2), j: true },          // south
    { L: DEPTH, m: new THREE.Matrix4().makeRotationY(-Math.PI / 2).setPosition(HALF, 0, -DEPTH / 2), j: false },         // north (sun side)
    { L: HALF * 2, m: new THREE.Matrix4().makeRotationY(Math.PI).setPosition(0, 0, 0), j: false }                         // front
  ];
  var wallInfo = null;
  walls.forEach(function (w) {
    var wg = [], wl = [];
    wallInfo = wallFace(wg, wl, w.L, P, r, { jharokha: w.j });
    wg.forEach(function (q) { q.applyMatrix4(w.m); g.push(q); });
    wl.forEach(function (q) { q.applyMatrix4(w.m); glow.push(q); });
  });
  // Corner towers with chhatris, so the court reads from the air.
  [[-HALF, 0], [HALF, 0], [-HALF, -DEPTH], [HALF, -DEPTH]].forEach(function (c) {
    g.push(tinted(new THREE.CylinderGeometry(1.1, 1.25, 7.8, 12).translate(c[0], 3.9, c[1]), P.wall2));
    g.push(tinted(new THREE.CylinderGeometry(1.35, 1.35, 0.25, 12).translate(c[0], 7.9, c[1]), P.trim));
    g.push(onionDome(0.9, 8.0, P.dome, small ? 12 : 16).translate(c[0], 0, c[1]));
  });

  // The court's own gateway on the outside of the front wall: a red arch,
  // a toran, and two small chhatris over it (seen as we arrive).
  var oz = 0.06;
  box(g, -2.4, 2.4, 0, 5.2, oz, oz + 0.5, P.red);
  archAt(g, 2.2, 3.6, 0, 0, oz + 0.51, P.trim);
  archAt(glow, 1.7, 3.2, 0, 0, oz + 0.52, col('#ffb862'));
  box(g, -2.6, 2.6, 5.2, 5.4, oz - 0.1, oz + 0.7, P.trim);
  [-1.6, 1.6].forEach(function (x) {
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { box(g, x + q[0] * 0.4 - 0.05, x + q[0] * 0.4 + 0.05, 5.4, 6.4, oz + 0.3 + q[1] * 0.3 - 0.05, oz + 0.3 + q[1] * 0.3 + 0.05, P.trim); });
    box(g, x - 0.55, x + 0.55, 6.4, 6.5, oz - 0.25, oz + 0.85, P.trim);
    g.push(onionDome(0.48, 6.5, P.dome, small ? 10 : 14).translate(x, 0, oz + 0.3));
  });
  swag([-1.3, 3.75, oz + 0.62], [1.3, 3.75, oz + 0.62], 0.2, small ? 16 : 24, function (x, y, z, t, k) {
    G.ball(x, y, z, 0.07);
    g.push(tinted(new THREE.ConeGeometry(0.06, 0.32, 4).scale(1, 1, 0.25).rotateX(Math.PI).translate(x, y - 0.22, z + 0.02), k % 2 ? '#2f6a1c' : '#4a8a2a'));
  });
  for (var gx = -HALF + 1; gx < HALF - 0.5; gx += 3.0) G.garlandTo([gx, 6.3, oz + 0.2], [gx + 3.0, 6.3, oz + 0.2], 0.5, small ? 10 : 15, 0.07);

  // ── The canopy ─────────────────────────────────────────────────────────
  var PX = 2.7, PZ = 2.3, PH = 3.5;
  box(g, -PX - 0.6, PX + 0.6, 0, 0.22, CZ - PZ - 0.6, CZ + PZ + 0.6, '#d8b98a');
  box(g, -PX - 0.4, PX + 0.4, 0.22, 0.25, CZ - PZ - 0.4, CZ + PZ + 0.4, '#fff6e6');      // a white cloth
  var poles = [[-PX, CZ + PZ], [PX, CZ + PZ], [-PX, CZ - PZ], [PX, CZ - PZ]];
  poles.forEach(function (p, i) {
    cyl(g, p[0], p[1], 0.22, PH, 0.07, '#c8a868', 8);
    // Marigolds wound round each pole.
    var nb = small ? 34 : 52;
    for (var k = 0; k < nb; k++) {
      var t = k / nb, an = t * Math.PI * 2 * 5.5 + i;
      G.ball(p[0] + Math.cos(an) * 0.11, lerp(0.35, PH - 0.1, t), p[1] + Math.sin(an) * 0.11, 0.055, k % 7 === 6 ? G.ROSE : null);
    }
  });
  // The top frame.
  box(g, -PX - 0.1, PX + 0.1, PH, PH + 0.1, CZ + PZ - 0.06, CZ + PZ + 0.06, '#c8a868');
  box(g, -PX - 0.1, PX + 0.1, PH, PH + 0.1, CZ - PZ - 0.06, CZ - PZ + 0.06, '#c8a868');
  box(g, -PX - 0.06, -PX + 0.06, PH, PH + 0.1, CZ - PZ, CZ + PZ, '#c8a868');
  box(g, PX - 0.06, PX + 0.06, PH, PH + 0.1, CZ - PZ, CZ + PZ, '#c8a868');
  // The drapes: a shallow roof of yellow and saffron panels, and swags on three sides.
  var drapeMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.9, emissive: '#3a2200' });
  var dg = [];
  (function roof() {
    var N = 10, pos = [], cs = [], cy = col(YEL), cs2 = col(SAF);
    for (var i = 0; i < N; i++) {
      var x0 = lerp(-PX, PX, i / N), x1 = lerp(-PX, PX, (i + 1) / N), c = i % 2 ? cs2 : cy;
      for (var j = 0; j < 6; j++) {
        var z0 = lerp(CZ - PZ, CZ + PZ, j / 6), z1 = lerp(CZ - PZ, CZ + PZ, (j + 1) / 6);
        function y(z, x) { var t = (z - CZ + PZ) / (2 * PZ), s = (x + PX) / (2 * PX); return PH + 0.1 - 0.32 * Math.sin(Math.PI * t) * Math.sin(Math.PI * s) + 0.5 * Math.sin(Math.PI * s) * Math.sin(Math.PI * t) * 0; }
        pos.push(x0, y(z0, x0), z0, x0, y(z1, x0), z1, x1, y(z0, x1), z0, x1, y(z0, x1), z0, x0, y(z1, x0), z1, x1, y(z1, x1), z1);
        for (var q = 0; q < 6; q++) cs.push(c.r, c.g, c.b);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
    geo.computeVertexNormals();
    dg.push(geo);
  })();
  [[[-PX, CZ + PZ], [PX, CZ + PZ], 0.75], [[PX, CZ + PZ], [PX, CZ - PZ], 1.0], [[-PX, CZ - PZ], [-PX, CZ + PZ], 1.0], [[PX, CZ - PZ], [-PX, CZ - PZ], 1.0]].forEach(function (sd, si) {
    var n = 3;
    for (var k = 0; k < n; k++) {
      var a = [lerp(sd[0][0], sd[1][0], k / n), lerp(sd[0][1], sd[1][1], k / n)], b = [lerp(sd[0][0], sd[1][0], (k + 1) / n), lerp(sd[0][1], sd[1][1], (k + 1) / n)];
      var pg = new THREE.PlaneGeometry(1, 1, 10, 4), pp = pg.attributes.position, c = (k + si) % 2 ? col(SAF) : col(YEL), cc = [];
      for (var v = 0; v < pp.count; v++) {
        var s = pp.getX(v) + 0.5, vv = 0.5 - pp.getY(v);
        pp.setXYZ(v, lerp(a[0], b[0], s), PH + 0.05 - vv * (0.12 + sd[2] * 0.62 * 4 * s * (1 - s)), lerp(a[1], b[1], s));
        cc.push(c.r, c.g, c.b);
      }
      pg.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
      pg.computeVertexNormals();
      dg.push(pg.toNonIndexed());
      // A marigold string falling from each swag's ends.
      G.strand(b[0], PH - 0.02, b[1], small ? 14 : 20, 0.11, 0.055, 5);
    }
  });
  dg.forEach(function (q) { group.add(new THREE.Mesh(q, drapeMat)); });
  // A toran of mango leaves across the front, with marigolds.
  swag([-PX, PH - 0.05, CZ + PZ + 0.08], [PX, PH - 0.05, CZ + PZ + 0.08], 0.18, small ? 22 : 34, function (x, y, z, t, k) {
    G.ball(x, y, z, 0.06);
    g.push(tinted(new THREE.ConeGeometry(0.06, 0.34, 4).scale(1, 1, 0.25).rotateX(Math.PI).rotateZ((k % 2 ? 1 : -1) * 0.15)
      .translate(x, y - 0.22, z + 0.02), k % 3 ? '#2f6a1c' : '#4a8a2a'));
  });

  // Banana plants tied to the two front poles.
  var bananaGeo = (function () {
    var parts = [tinted(new THREE.CylinderGeometry(0.09, 0.14, 2.4, 7).translate(0, 1.2, 0), '#6a8a3a')];
    for (var k = 0; k < 7; k++) {
      var a = k / 7 * Math.PI * 2 + 0.4, lean = 0.55 + (k % 3) * 0.18, len = 1.5 + (k % 2) * 0.35;
      var lf = new THREE.PlaneGeometry(0.42, len, 1, 4), lp = lf.attributes.position;
      for (var v = 0; v < lp.count; v++) {
        var y = lp.getY(v) + len / 2, t = y / len;
        lp.setXYZ(v, lp.getX(v) * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08)), y, -t * t * 0.55);
      }
      lf.translate(0, 0, 0).rotateX(-lean).rotateY(a).translate(0, 2.2 + (k % 2) * 0.2, 0);
      parts.push(tinted(lf.toNonIndexed(), k % 2 ? '#4a8a2c' : '#5fa036'));
    }
    return merge(parts);
  })();
  var bananaMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  [[-PX - 0.25, CZ + PZ + 0.2, 0.3], [PX + 0.25, CZ + PZ + 0.2, -0.4]].forEach(function (b) {
    var m = new THREE.Mesh(bananaGeo, bananaMat); m.position.set(b[0], 0.22, b[1]); m.rotation.y = b[2]; m.scale.setScalar(1.05); group.add(m);
  });

  // ── Under the canopy: two empty seats, the urlis, a kalash ─────────────
  [-0.65, 0.65].forEach(function (x) {
    box(g, x - 0.42, x + 0.42, 0.33, 0.43, CZ - 0.6, CZ + 0.05, '#8a5226');                // a low wooden patla
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { box(g, x + q[0] * 0.34 - 0.04, x + q[0] * 0.34 + 0.04, 0.25, 0.33, CZ - 0.27 + q[1] * 0.25 - 0.04, CZ - 0.27 + q[1] * 0.25 + 0.04, '#6a3a1a'); });
    box(g, x - 0.38, x + 0.38, 0.43, 0.47, CZ - 0.56, CZ + 0.01, YEL);                      // a yellow cloth on it
    for (var k = 0; k < 10; k++) G.ball(x - 0.4 + k * 0.089, 0.47, CZ + 0.06, 0.035);        // marigolds along its edge
  });
  var urliProf = [[0, 0], [0.18, 0], [0.22, 0.04], [0.4, 0.1], [0.5, 0.16], [0.52, 0.19], [0.47, 0.19], [0.38, 0.13], [0, 0.13]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var brassMat = new THREE.MeshPhongMaterial({ color: BRASS, specular: '#ffe6a8', shininess: 55, emissive: '#2a1604' });
  var urliGeo = new THREE.LatheGeometry(urliProf, small ? 16 : 24);
  var pasteMat = new THREE.MeshLambertMaterial({ color: '#f4b40a', emissive: '#4a2a00' });
  var pasteGeo = new THREE.CircleGeometry(0.43, small ? 16 : 24).rotateX(-Math.PI / 2);
  [[0, CZ + 1.2, 1.15], [-1.5, CZ + 0.9, 0.8], [1.5, CZ + 0.9, 0.8]].forEach(function (u, i) {
    var m = new THREE.Mesh(urliGeo, brassMat); m.position.set(u[0], 0.25, u[1]); m.scale.setScalar(u[2]); group.add(m);
    var p2 = new THREE.Mesh(pasteGeo, pasteMat); p2.position.set(u[0], 0.25 + 0.15 * u[2], u[1]); p2.scale.setScalar(u[2]); group.add(p2);
    for (var k = 0; k < 7; k++) { var a = k / 7 * Math.PI * 2 + i; G.ball(u[0] + Math.cos(a) * 0.24 * u[2], 0.25 + 0.17 * u[2], u[1] + Math.sin(a) * 0.24 * u[2], 0.055, k % 3 === 0 ? G.ROSE : null); }
  });
  // Small bowls of turmeric, kumkum and rice, a kalash with mango leaves.
  [[-0.9, CZ + 1.9, '#f4b40a'], [-0.45, CZ + 2.05, '#c8142a'], [0.45, CZ + 2.05, '#fff6e6'], [0.9, CZ + 1.9, '#f4b40a']].forEach(function (b) {
    g.push(tinted(new THREE.CylinderGeometry(0.12, 0.08, 0.07, 12).translate(b[0], 0.285, b[1]), BRASS));
    g.push(tinted(new THREE.CylinderGeometry(0.105, 0.105, 0.01, 12).translate(b[0], 0.32, b[1]), b[2]));
  });
  var kal = [[0, 0], [0.09, 0.01], [0.17, 0.09], [0.19, 0.16], [0.15, 0.25], [0.075, 0.31], [0.07, 0.35], [0.11, 0.38], [0.1, 0.4], [0, 0.4]]
    .map(function (p) { return new THREE.Vector2(p[0] * 1.3, p[1] * 1.3); });
  g.push(tinted(new THREE.LatheGeometry(kal, 14).translate(1.75, 0.25, CZ - 0.9), BRASS));
  g.push(tinted(new THREE.SphereGeometry(0.13, 10, 6).translate(1.75, 0.25 + 0.62, CZ - 0.9), '#8a5a2e'));
  for (var kk = 0; kk < 6; kk++) g.push(tinted(new THREE.ConeGeometry(0.045, 0.3, 4).rotateZ(-1.15).translate(0.16, 0.25 + 0.55, 0).rotateY(kk / 6 * Math.PI * 2).translate(1.75, 0, CZ - 0.9), leafGreen));
  // A few diyas on the cloth.
  var lamps = new PointSet();
  [[-2.1, CZ + 1.7], [2.1, CZ + 1.7], [-2.2, CZ - 1.6], [2.2, CZ - 1.6], [-1.2, CZ + 2.3], [1.2, CZ + 2.3]].forEach(function (p) { lamps.add(p[0], 0.25, p[1], 0, r(), 0, 1); });
  group.add(diyaBowls(lamps, 1.2, small ? 8 : 12));
  pk.add(lamps, 'vec4 place(){ vCol = vec3(1.0, 0.55, 0.2); return vec4(position + vec3(0.0, 0.19, 0.0), 0.85 + 0.15 * sin(uTime * 8.0 + aData.y * 30.0)); }\n',
    [[HALO_F, 0.5, 2.0, 1, false, 2], [FLAME_F, 0.2, 1.6, 2]]);

  // ── Rangoli, petals on the floor, planters ─────────────────────────────
  var rangoliMat = new THREE.MeshLambertMaterial({ map: rangoliTexture(), transparent: true, depthWrite: false, emissive: '#2a0c04' });
  rangoli(group, rangoliMat, 0, 0.0, CZ + PZ + 2.1, 2.6, 0.2);
  var spots = [];
  for (var k = 0; k < (small ? 160 : 260); k++) {
    var x = (r() - 0.5) * 9, z = CZ + (r() - 0.3) * 10;
    if (Math.abs(x) < PX + 0.5 && Math.abs(z - CZ) < PZ + 0.5) continue;
    spots.push([x, 0.03 + r() * 0.01, z]);
  }
  var pCols = ['#ff8c00', '#ffa10a', '#ffc21f', '#ffd84a', '#e8590c', '#fff0d8'].map(col);
  var petals = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 6).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide, emissive: '#2a1200' }), spots.length);
  var mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e3 = new THREE.Euler(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
  spots.forEach(function (p, j) {
    petals.setMatrixAt(j, mtx.compose(ps.set(p[0], p[1], p[2]), q4.setFromEuler(e3.set(r() * 0.3, r() * 6, r() * 0.3)), sc.set(0.05, 1, 0.03)));
    petals.setColorAt(j, pCols[j % pCols.length]);
  });
  petals.userData.thin = true;
  group.add(petals);
  // Brass urlis of water and flowers along the side arcades, and tulsi planters.
  [[-HALF + 2.0, -6], [-HALF + 2.0, -22], [HALF - 2.0, -6], [HALF - 2.0, -22]].forEach(function (u2, i) {
    var m = new THREE.Mesh(urliGeo, brassMat); m.position.set(u2[0], 0, u2[1]); m.scale.setScalar(1.6); group.add(m);
    for (var k2 = 0; k2 < 9; k2++) { var a = k2 / 9 * Math.PI * 2; G.ball(u2[0] + Math.cos(a) * 0.45, 0.24, u2[1] + Math.sin(a) * 0.45, 0.08, k2 % 3 ? null : G.ROSE); }
  });
  // Trees beyond the walls.
  var leafCols = ['#ffffff', '#e4ecd8', '#f2f6e8', '#d8e2cc'].map(col), trees = [];
  [[-17, -8], [-18, -20], [17, -10], [18, -22], [-9, -33], [9, -34]].forEach(function (p, i) { trees.push([p[0], 0, p[1], 1.1 + r() * 0.4, r() * 6, leafCols[i % 4], 1]); });
  group.add(treeMesh(broadleaf('#6a4a30', '#4c7232'), trees));

  // ── Marigold strings from the rooftops to the canopy ───────────────────
  var apex = [0, PH + 0.1, CZ];
  [[-HALF + 0.6, 6.5, -3], [HALF - 0.6, 6.5, -3], [-HALF + 0.6, 6.5, -24], [HALF - 0.6, 6.5, -24], [0, 6.6, -DEPTH + 0.6], [-HALF + 0.6, 6.5, -13.5], [HALF - 0.6, 6.5, -13.5]].forEach(function (a, i) {
    var b = [apex[0] + Math.sign(a[0]) * PX * 0.8, PH + 0.08, CZ + Math.sign(a[2] - CZ) * PZ * 0.8];
    G.garlandTo(a, b, 0.9, small ? 26 : 40, 0.06);
    swag(a, b, 0.9, 8, function (x, y, z, t, k) { if (k > 0 && k < 8 && k % 2) G.strand(x, y - 0.1, z, 3, 0.11, 0.05, 3); });
  });
  // Curtains of marigolds along the arcades' upper edges.
  [[-HALF + 0.55, -1.5, -DEPTH + 1.5], [HALF - 0.55, -1.5, -DEPTH + 1.5]].forEach(function (s) {
    for (var z = s[1]; z > s[2]; z -= small ? 0.9 : 0.6) G.strand(s[0], 3.3, z, small ? 6 : 9, 0.11, 0.055, 4);
  });
  for (var xb = -HALF + 1.5; xb < HALF - 1.4; xb += small ? 0.9 : 0.6) G.strand(xb, 3.3, -DEPTH + 0.55, small ? 6 : 9, 0.11, 0.055, 4);
  // Mango-leaf torans over the doorways of the back wall.
  for (var kb = 0; kb < wallInfo.NA; kb += 2) {
    var dx = -HALF + (kb + 0.5) * (HALF * 2 / wallInfo.NA);
    swag([dx - 0.7, 2.55, -DEPTH + 0.5], [dx + 0.7, 2.55, -DEPTH + 0.5], 0.12, 10, function (x, y, z, t, k) {
      G.ball(x, y, z, 0.05);
      g.push(tinted(new THREE.ConeGeometry(0.05, 0.28, 4).scale(1, 1, 0.25).rotateX(Math.PI).translate(x, y - 0.18, z + 0.02), k % 2 ? '#2f6a1c' : '#4a8a2a'));
    });
  }

  // ── Assemble ───────────────────────────────────────────────────────────
  var stone = merge(g);
  groundShade(stone, 0, 2.2, 0.78);
  worldUV(stone, 2);
  group.add(new THREE.Mesh(stone, new THREE.MeshLambertMaterial({ vertexColors: true, map: stoneTexture() })));
  var glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, color: '#9a8a7a' });
  group.add(new THREE.Mesh(merge(glow), glowMat));
  group.add(G.mesh('#5a2600', small));

  // ── Sunbeams through the turmeric haze ─────────────────────────────────
  var sun = sunAt(9.3), down = sun.clone().negate();
  var beamU = { uAmt: { value: 1 }, uCol: { value: col('#ffd890') } };
  var beamMat = new THREE.ShaderMaterial({
    uniforms: beamU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying float vT; varying float vF; void main(){ vT = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0);\n' +
      ' vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uAmt; uniform vec3 uCol; varying float vT; varying float vF;\n' +
      'void main(){ float a = smoothstep(0.0, 0.25, vT) * (1.0 - smoothstep(0.55, 1.0, vT)) * pow(vF, 2.2) * 0.16 * uAmt;\n' +
      ' gl_FragColor = vec4(uCol * a, a);\n #include <colorspace_fragment>\n}'
  });
  var beamGeo = new THREE.CylinderGeometry(0.75, 1.1, 1, 14, 1, true).translate(0, -0.5, 0);
  var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), down);
  [[-3.5, 1.0], [-10, 1.1], [-16.5, 0.9], [-22, 1.0], [-13.5, 1.25]].forEach(function (b, i) {
    var start = new THREE.Vector3(HALF - 0.6, 7.2, b[0]), len = 7.2 / -down.y * 0.98;
    var m = new THREE.Mesh(beamGeo, beamMat);
    m.position.copy(start); m.quaternion.copy(q); m.scale.set(b[1], len, b[1]);
    m.renderOrder = 9; m.frustumCulled = false;
    group.add(m);
  });
  // Motes of turmeric in the air, catching the light.
  var motes = new PointSet();
  for (k = 0; k < (small ? 160 : 280); k++) motes.add((r() - 0.5) * HALF * 1.8, 0.4 + r() * 6, -1 - r() * (DEPTH - 2), 0, r(), 0, 0.6 + r() * 0.6, col(k % 3 ? '#ffd870' : '#fff0c0'));
  tag(pk.add(motes,
    'vec4 place(){ float s = aData.y;\n' +
    ' vec3 p = position + vec3(sin(uTime * 0.13 + s * 30.0) * 0.6, sin(uTime * 0.2 + s * 17.0) * 0.25, cos(uTime * 0.11 + s * 23.0) * 0.6);\n' +
    ' return vec4(p, 0.35 * (0.6 + 0.4 * sin(uTime * 0.9 + s * 40.0))); }\n',
    [[GLOW_F, 0.05, 1.2, 3, false, 1.0]]), 'pts');
  // Petals drifting down through the court.
  var air = new PointSet(), aCols = ['#ff8c00', '#ffb21a', '#ffd04a', '#e8590c', '#fff0d8', '#c21e3a'].map(col);
  for (k = 0; k < (small ? 90 : 160); k++) air.add((r() - 0.5) * HALF * 1.8, r() * 7, -1 - r() * (DEPTH - 2), 0, r(), 0, 0.8 + r() * 0.5, aCols[k % aCols.length]);
  tag(pk.add(air,
    'vec4 place(){ vec3 B = vec3(' + (HALF * 1.8).toFixed(1) + ', 7.0, ' + (DEPTH - 2).toFixed(1) + '), O = vec3(' + (-HALF * 0.9).toFixed(1) + ', 0.0, ' + (-DEPTH + 1).toFixed(1) + '); float s = aData.y;\n' +
    ' vec3 p = position + vec3(uTime * 0.25 + sin(uTime * 0.7 + s * 20.0) * 0.5, -uTime * (0.2 + s * 0.22), sin(uTime * 0.45 + s * 9.0) * 0.5);\n' +
    ' p = O + mod(p - O, B); vCol = aCol * uLit; return vec4(p, 0.95); }\n',
    [[PETAL_F, 0.12, 1.4, 7, true, 1.4]]), 'pts');

  var turmeric = col('#ffd56a'), warm = col('#fff0c8');
  function frame(f) {
    var P = f.P, w = f.w;
    U.uTime.value = f.time; U.uScale.value = f.pxScale; U.uFogD.value = f.fogD * 0.5;
    U.uLit.value = clamp(P.hi * 0.65 + 0.15, 0.5, 1.2);
    // Turmeric in the air: a warm haze over the court while we are here.
    P.hor.lerp(turmeric, 0.35 * w); P.hs.lerp(warm, 0.25 * w); P.fd *= 1 + 0.7 * w;
    beamU.uAmt.value = clamp(P.si / 2, 0, 1) * (0.4 + 0.6 * w);
    var fl = f.reduce ? 1 : 0.9 + 0.1 * Math.sin(f.time * 8.3);
    W.lamp(o.x, 1.3, o.z + CZ + 1.6, '#ffb060', 2.2 * fl, 6, 1.8);
  }
  return { group: group, frame: frame };
}
