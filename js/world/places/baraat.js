/*
 * Baraat: Wednesday 10 March, 7 PM, through the Radisson's main entrance,
 * as the sun sets. No people and no horse: the way is lit and waiting.
 *
 * A paved avenue runs west to the hall gate, the sun going down behind it.
 * Brass lamp pillars and mashaal torches line both sides; arches of lights
 * span the avenue and pulse to a dhol rhythm, the beat rolling towards the
 * gate; a red runner strewn with petals leads to a freestanding arch of
 * marigolds and roses, and beyond it the gate, a red sandstone gateway
 * with towers, chhatris and a lamp-lit arch onto the hall. Fireworks open
 * over the gate as the card is read.
 *
 * Origin: the avenue's start on its axis; the gate's face is at z = -GZ.
 */
import { THREE, clamp, lerp, smooth, rng, col, box, cyl, archAt, pointedArch, notchShape, bandShape, shiftPts, swag,
         groundShade, Garlands, PointSet, pointKit, GLOW_F, HALO_F, FLAME_F, PETAL_F, worldUV, stoneTexture, onionDome,
         ashoka, broadleaf, treeMesh, rangoliTexture, rangoli, pool , Q, tag } from '../lib.js';
import { tinted, merge, softSprite } from '../../immersive/kit.js';
import { keyed, cols } from '../timeline.js';
import { BARAAT } from '../land.js';

var GZ = 40, AW = 4.6, LX = 5.4;     // gate distance, avenue half-width, lamp rows
var C = cols(['px', 'py', 'pz', 'tx', 'ty', 'tz', 'tod', 'fw']);
var WIDE = keyed([
  //  at   px    py    pz     tx    ty    tz    tod    fw
  [0,     -1.2,  2.3,   1.0,  2.6,  4.6,  -38,  17.85, 0],
  [0.35,  -1.0,  2.3,  -1.5,  2.4,  5.4,  -38,  18.0,  0.6],
  [1,     -0.6,  2.4,  -5.0,  2.0,  6.6,  -38,  18.2,  1]
]);
var TALL = keyed([
  [0,      0,    2.2,   1.5,  0,    5.4,  -38,  17.85, 0],
  [0.35,   0,    2.2,  -1.0,  0,    6.4,  -38,  18.0,  0.6],
  [1,      0,    2.3,  -4.5,  0,    7.6,  -38,  18.2,  1]
]);
export function pose(u, out, f) {
  var row = (f.aspect < 0.9 ? TALL : WIDE)(u), o = BARAAT;
  out.pos.set(o.x + row[C.px], row[C.py], o.z + row[C.pz]);
  out.tgt.set(o.x + row[C.tx], row[C.ty], o.z + row[C.tz]);
  out.tod = row[C.tod];
  out.mist = 0;
}

// The fireworks of Our Story, gentler, over the gate.
var FW_POS =
  'vec4 place(){ float bid = aData.x, P = 4.8;\n' +
  ' float tt = uTime + bid * 1.21 + 0.4, cyc = floor(tt / P), t = tt - cyc * P - 0.3;\n' +
  ' float hs = h1(cyc * 7.13 + bid * 3.1);\n' +
  ' vec3 c = vec3(mix(-20.0, 20.0, h1(cyc * 1.7 + bid * 9.2)), 18.0 + 10.0 * hs, -' + (GZ + 8) + '.0 - 16.0 * h1(cyc * 3.3 + bid * 1.9));\n' +
  ' float R = (5.0 + 3.0 * hs) * aData.z;\n' +
  ' vec3 p = c + position * R * (1.0 - exp(-max(t, 0.0) * 2.3)) + vec3(0.0, -0.6 * t * t, 0.0);\n' +
  ' float life = step(0.0, t) * (1.0 - smoothstep(1.1, 3.0, t));\n' +
  ' float sp = t > 1.5 ? 0.5 + 0.5 * sin(uTime * 28.0 + aData.y * 80.0) : 1.0;\n' +
  ' vCol = aCol * (1.0 + 2.0 * exp(-max(t, 0.0) * 6.0));\n' +
  ' return vec4(p, life * sp * uFw); }\n';

// The dhol: dha . dhin-dhin . dha . dhin-dhin, about 100 beats a minute; the
// beat rolls down the avenue (each light hears it a little later).
var BEAT =
  'float hit(float t, float h){ float d = t - h; return d >= 0.0 ? exp(-d * 9.0) : 0.0; }\n' +
  'float dhol(float t){ t = mod(t, 2.4);\n' +
  ' return hit(t, 0.0) * 1.0 + hit(t, 0.6) * 0.55 + hit(t, 0.9) * 0.55 + hit(t, 1.2) * 0.85 + hit(t, 1.8) * 0.55 + hit(t, 2.1) * 0.55 + hit(t - 2.4, 0.0) * 0.0; }\n';

export function build(W) {
  var small = W.small, o = BARAAT, r = rng(1903);
  var group = new THREE.Group();
  group.position.set(o.x, 0, o.z);
  var U = { uTime: { value: 0 }, uScale: { value: 600 }, uFogD: { value: 0.004 }, uFw: { value: 0 }, uLit: { value: 1 }, uOn: { value: 1 } };
  var pk = pointKit(U, group);
  var G = new Garlands();
  var g = [], glow = [];
  var P = { red: '#b4553c', red2: '#a2472f', marble: '#f3e6d0', trim: '#f6e4c4', stone: '#9c7656', dome: '#f0dcbc', gold: '#d9a441' };

  // ── The avenue ─────────────────────────────────────────────────────────
  var at = stoneTexture().clone(); at.needsUpdate = true; at.repeat.set(9, GZ / 2);
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(AW * 2 + 6, GZ + 8).rotateX(-Math.PI / 2).translate(0, 0.02, -GZ / 2 + 2),
    new THREE.MeshLambertMaterial({ color: '#dcc4a0', map: at })));
  box(g, -1.35, 1.35, 0.02, 0.045, -GZ + 0.5, 4, '#a3222e');                                // the red runner
  [-1, 1].forEach(function (s) { box(g, s * 1.35 - 0.1, s * 1.35 + 0.1, 0.02, 0.05, -GZ + 0.5, 4, '#e8c27a'); });
  // Low balustraded walls either side, with planters of marigolds.
  [-1, 1].forEach(function (s) {
    var x = s * (AW + 2.6);
    box(g, x - 0.3, x + 0.3, 0, 0.9, -GZ + 1, 6, P.red2);
    box(g, x - 0.38, x + 0.38, 0.9, 1.02, -GZ + 1, 6, P.trim);
    for (var z = 4; z > -GZ + 2; z -= 4) {
      g.push(tinted(new THREE.CylinderGeometry(0.34, 0.26, 0.42, 10).translate(x, 1.23, z), '#b4583a'));
      for (var k = 0; k < 7; k++) { var a = k / 7 * Math.PI * 2 + z; G.ball(x + Math.cos(a) * 0.22, 1.5 + (k % 2) * 0.07, z + Math.sin(a) * 0.22, 0.08); }
    }
  });

  // ── Lamp pillars and mashaal torches ───────────────────────────────────
  var lampProf = [[0, 0], [0.32, 0], [0.32, 0.12], [0.18, 0.2], [0.11, 0.4], [0.07, 2.4], [0.12, 2.5], [0.24, 2.62], [0.3, 2.72], [0.28, 2.78], [0, 2.74]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var lampGeo = new THREE.LatheGeometry(lampProf, small ? 10 : 14);
  var brass = new THREE.MeshPhongMaterial({ color: '#c08a2a', specular: '#ffe0a0', shininess: 50, emissive: '#2a1404' });
  var lamps = [], flames = new PointSet(), torches = new PointSet();
  [-1, 1].forEach(function (s) {
    for (var z = 0; z > -GZ + 4; z -= 4) {
      lamps.push([s * LX, z]);
      flames.add(s * LX, 2.95, z, -z / GZ, r(), 0, 1.3);
      // A mashaal halfway between: a pole with a cloth head, a tall flame.
      var tz = z - 2;
      cyl(g, s * (LX - 0.9), tz, 0, 2.3, 0.04, '#5a3a1e', 6);
      g.push(tinted(new THREE.CylinderGeometry(0.12, 0.07, 0.3, 8).translate(s * (LX - 0.9), 2.42, tz), '#3a2412'));
      torches.add(s * (LX - 0.9), 2.68, tz, -tz / GZ, r(), 0, 1);
    }
  });
  var lampMesh = new THREE.InstancedMesh(lampGeo, brass, lamps.length);
  var mtx = new THREE.Matrix4();
  lamps.forEach(function (l, i) { lampMesh.setMatrixAt(i, mtx.makeTranslation(l[0], 0, l[1])); });
  group.add(lampMesh);
  var FL = 'float fl(){ return 0.84 + 0.16 * sin(uTime * (8.0 + aData.y * 5.0) + aData.y * 40.0) * sin(uTime * 5.3 + aData.y * 9.0); }\n';
  pk.add(flames, FL + 'vec4 place(){ vCol = vec3(1.0, 0.55, 0.2); return vec4(position, fl() * uOn); }\n',
    [[HALO_F, 1.1, 2.4, 1, false, 3], [FLAME_F, 0.32, 1.8, 2]]);
  // Mashaal flames: bigger, ragged, with sparks going up.
  pk.add(torches, FL + 'vec4 place(){ vCol = vec3(1.0, 0.48, 0.14); vec3 p = position + vec3(sin(uTime * 3.1 + aData.y * 9.0) * 0.03, 0.0, 0.0); return vec4(p, fl() * uOn); }\n',
    [[HALO_F, 1.6, 2.6, 1, false, 3], [FLAME_F, 0.55, 2.0, 2]]);
  var sparks = new PointSet();
  for (var k = 0; k < (small ? 60 : 110); k++) {
    var ti = (r() * torches.p.length / 3) | 0;
    sparks.add(torches.p[ti * 3], torches.p[ti * 3 + 1] + 0.15, torches.p[ti * 3 + 2], r(), r(), r(), 0.6 + r() * 0.6, col('#ffa040'));
  }
  tag(pk.add(sparks,
    'vec4 place(){ float f = fract(uTime * (0.3 + aData.y * 0.3) + aData.x);\n' +
    ' vec3 p = position + vec3(sin(f * 8.0 + aData.y * 40.0) * 0.18 * f, f * 2.4, cos(f * 7.0 + aData.y * 30.0) * 0.18 * f);\n' +
    ' return vec4(p, uOn * (1.0 - f) * smoothstep(0.0, 0.1, f)); }\n',
    [[GLOW_F, 0.05, 1.4, 5]]), 'pts');

  // ── Arches of lights over the avenue, pulsing to the dhol ──────────────
  var arcs = new PointSet(), cA = [col('#ffd88a'), col('#ffe6b0'), col('#ffc060')];
  var NARC = 5;
  for (var ai = 0; ai < NARC; ai++) {
    var az = -3 - ai * 7.2, R = AW + 0.8;
    // A slender brass frame for each arch.
    var tor = new THREE.TorusGeometry(R, 0.05, 5, 36, Math.PI).translate(0, 2.4, 0).translate(0, 0, az);
    g.push(tinted(tor, P.gold));
    [-1, 1].forEach(function (s) { cyl(g, s * R, az, 0, 2.4, 0.07, P.gold, 6); });
    var n = small ? 34 : 54;
    for (var k2 = 0; k2 <= n; k2++) {
      var a = k2 / n * Math.PI;
      arcs.add(Math.cos(a) * R, 2.4 + Math.sin(a) * R, az, ai, r(), 0, 0.95, cA[k2 % 3]);
    }
    for (var y2 = 0.3; y2 < 2.4; y2 += 0.3) [-1, 1].forEach(function (s) { arcs.add(s * R, y2, az, ai, r(), 0, 0.9, cA[1]); });
    // Marigold strands hanging from each arch.
    for (k2 = 1; k2 < 9; k2++) { var a2 = k2 / 9 * Math.PI; G.strand(Math.cos(a2) * R, 2.4 + Math.sin(a2) * R - 0.08, az, small ? 4 : 6, 0.11, 0.055, 4); }
  }
  pk.add(arcs, BEAT +
    'vec4 place(){ float d = dhol(uTime - aData.x * 0.12);\n' +
    ' float tw = 0.75 + 0.25 * sin(uTime * (1.3 + aData.y * 2.0) + aData.y * 50.0);\n' +
    ' vCol = aCol * (1.0 + 1.4 * d); return vec4(position, uOn * (0.45 + 0.55 * d) * tw); }\n',
    [[GLOW_F, 0.17, 1.6, 2]]);
  // A ring of lanterns round the forecourt before the gate, on the same beat.
  var ring = new PointSet();
  var RZ = -GZ + 5, RR = 3.6;
  for (k = 0; k < 16; k++) { var an = k / 16 * Math.PI * 2; ring.add(Math.cos(an) * RR, 0.06, RZ + Math.sin(an) * RR * 0.7, k, r(), 0, 1, col('#ffb060')); }
  pk.add(ring, BEAT +
    'vec4 place(){ float d = dhol(uTime - 0.6 - aData.x * 0.02); vCol = vec3(1.0, 0.6, 0.25) * (1.0 + d);\n' +
    ' return vec4(position + vec3(0.0, 0.18, 0.0), uOn * (0.5 + 0.5 * d)); }\n',
    [[HALO_F, 0.9, 2.2, 1], [FLAME_F, 0.22, 1.6, 2]]);
  var rangoliMat = new THREE.MeshLambertMaterial({ map: rangoliTexture(), transparent: true, depthWrite: false, emissive: '#2a0c04' });
  rangoli(group, rangoliMat, 0, 0.03, RZ, 3.8, 0);

  // ── The flower arch before the gate ────────────────────────────────────
  var FZ = -GZ + 2.2, FR = 3.4, FH = 3.6;
  var fcols = [col('#fff6ea'), col('#f4a3b6'), col('#c2183a'), col('#ff9a1a')];
  [-1, 1].forEach(function (s) {
    for (var y = 0.1; y < FH; y += 0.12) for (var j = 0; j < 3; j++) {
      var jx = s * FR + (j - 1) * 0.12;
      G.ball(jx + (r() - 0.5) * 0.06, y, FZ + (r() - 0.5) * 0.25, 0.085, j === 1 ? null : fcols[(r() * 3) | 0]);
    }
  });
  var nArc = small ? 90 : 140;
  for (k = 0; k <= nArc; k++) {
    var a3 = k / nArc * Math.PI;
    for (var j3 = 0; j3 < 3; j3++) {
      var rr = FR + (j3 - 1) * 0.13;
      G.ball(Math.cos(a3) * rr, FH + Math.sin(a3) * rr, FZ + (r() - 0.5) * 0.25, 0.09, j3 === 1 ? fcols[k % 4] : null);
    }
  }
  for (k = 1; k < 12; k++) { var a4 = k / 12 * Math.PI; G.strand(Math.cos(a4) * FR, FH + Math.sin(a4) * FR - 0.1, FZ, 6 + (k % 3) * 2, 0.12, 0.065, 3); }

  // ── The gate ───────────────────────────────────────────────────────────
  var GW = 12, GH = 10.5, OW = 5.0, OH = 8.2;
  var opening = pointedArch(OW, OH - 1.8, OH, 9, 0.12, 20);
  g.push(tinted(new THREE.ExtrudeGeometry(notchShape(-GW, GW, GH, [opening]), { depth: 2.2, bevelEnabled: false }).translate(0, 0, -GZ - 2.2), P.red));
  // White marble bands round the arch, an alfiz, rosettes, and inlay lines.
  var bOut = pointedArch(OW + 0.7, OH - 1.8, OH + 0.4, 0, 0, 20), bIn = pointedArch(OW, OH - 1.8, OH, 0, 0, 20);
  g.push(tinted(new THREE.ExtrudeGeometry(bandShape(bOut, bIn), { depth: 0.1, bevelEnabled: false }).translate(0, 0, -GZ), P.marble));
  var AX = OW / 2 + 1.1, AY = OH + 1.0;
  [[-AX - 0.22, -AX, 0.4, AY + 0.22], [AX, AX + 0.22, 0.4, AY + 0.22], [-AX - 0.22, AX + 0.22, AY, AY + 0.22]].forEach(function (q) { box(g, q[0], q[1], q[2], q[3], -GZ, -GZ + 0.12, P.marble); });
  [-1, 1].forEach(function (s) {
    g.push(tinted(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 16).rotateX(Math.PI / 2).translate(s * (OW / 2 + 0.5), OH + 0.3, -GZ + 0.05), P.marble));
    // Side bays: blind arches with lamps, and small jharokhas above.
    [OW / 2 + 3.2, OW / 2 + 6.6].forEach(function (x) {
      archAt(g, 1.8, 3.4, s * x, 0.6, -GZ + 0.01, P.marble);
      archAt(glow, 1.4, 3.0, s * x, 0.7, -GZ + 0.02, col('#ffae5a'));
      box(g, s * x - 0.9, s * x + 0.9, 5.4, 5.6, -GZ, -GZ + 0.6, P.trim);
      box(g, s * x - 0.75, s * x + 0.75, 5.6, 7.3, -GZ, -GZ + 0.5, P.red2);
      archAt(glow, 0.8, 1.2, s * x, 5.8, -GZ + 0.51, col('#ffa04a'));
      g.push(tinted(new THREE.ConeGeometry(1.1, 0.6, 4).rotateY(Math.PI / 4).translate(s * x, 7.6, -GZ + 0.25), P.dome));
    });
  });
  // Cornice, parapet, merlons, and three chhatris on top.
  box(g, -GW - 0.3, GW + 0.3, GH, GH + 0.25, -GZ - 2.4, -GZ + 0.5, P.trim);
  box(g, -GW, GW, GH + 0.25, GH + 0.9, -GZ - 2.2, -GZ + 0.1, P.red2);
  for (var mx = -GW; mx <= GW + 0.01; mx += 0.7) box(g, mx - 0.15, mx + 0.15, GH + 0.9, GH + 1.3, -GZ - 0.3, -GZ + 0.05, P.marble);
  [[-6.5, 0.85], [0, 1.25], [6.5, 0.85]].forEach(function (c) {
    var cx = c[0], s = c[1], y0 = GH + 0.9, cz = -GZ - 1.1;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { box(g, cx + q[0] * 0.75 * s - 0.08, cx + q[0] * 0.75 * s + 0.08, y0, y0 + 1.4 * s, cz + q[1] * 0.75 * s - 0.08, cz + q[1] * 0.75 * s + 0.08, P.marble); });
    box(g, cx - 1.0 * s, cx + 1.0 * s, y0 + 1.4 * s, y0 + 1.55 * s, cz - 1.0 * s, cz + 1.0 * s, P.trim);
    g.push(onionDome(0.85 * s, y0 + 1.55 * s, P.dome, small ? 12 : 16).translate(cx, 0, cz));
  });
  // Towers at the ends.
  [-1, 1].forEach(function (s) {
    var tx = s * (GW + 1.0), tz = -GZ - 1.0, TH = GH + 2.5;
    g.push(tinted(new THREE.CylinderGeometry(1.5, 1.7, TH, 14).translate(tx, TH / 2, tz), P.red));
    [3.0, 6.5, 10].forEach(function (y) { g.push(tinted(new THREE.CylinderGeometry(1.62, 1.62, 0.2, 14).translate(tx, y, tz), P.marble)); });
    g.push(tinted(new THREE.CylinderGeometry(1.9, 1.6, 0.3, 14).translate(tx, TH + 0.15, tz), P.trim));
    for (var c2 = 0; c2 < 6; c2++) { var a5 = c2 / 6 * Math.PI * 2; cyl(g, tx + Math.cos(a5) * 1.2, tz + Math.sin(a5) * 1.2, TH + 0.3, TH + 1.7, 0.09, P.marble, 6); }
    g.push(tinted(new THREE.CylinderGeometry(1.55, 1.55, 0.16, 14).translate(tx, TH + 1.78, tz), P.trim));
    g.push(onionDome(1.25, TH + 1.86, P.dome, small ? 12 : 16).translate(tx, 0, tz));
    archAt(glow, 0.55, 1.1, tx, 7.4, tz + 1.62, col('#ffa04a'));
  });
  // The light of the hall beyond the arch.
  var beyond = new THREE.Mesh(new THREE.ShapeGeometry(shapeFromPts(opening), 1).translate(0, 0, -GZ - 2.0),
    new THREE.MeshBasicMaterial({ color: '#ff9a40', fog: false, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  group.add(beyond);
  // Marigold swags and a toran across the gate.
  swag([-OW / 2 - 0.3, OH - 1.4, -GZ + 0.2], [OW / 2 + 0.3, OH - 1.4, -GZ + 0.2], 0.25, small ? 26 : 40, function (x, y, z, t, k3) {
    G.ball(x, y, z, 0.075);
    if (k3 % 3 === 0 && t > 0.03 && t < 0.97) G.strand(x, y - 0.12, z, 4, 0.12, 0.06, 4);
  });
  for (var sw = 0; sw < 4; sw++) {
    var xa = -GW + 0.6 + sw * (GW * 2 - 1.2) / 4;
    G.garlandTo([xa, GH - 0.2, -GZ + 0.4], [xa + (GW * 2 - 1.2) / 4, GH - 0.2, -GZ + 0.4], 0.6, small ? 18 : 28, 0.08);
  }
  // Lights along the gate's outline.
  var outline = new PointSet();
  for (var ox = -GW; ox <= GW; ox += small ? 0.5 : 0.35) outline.add(ox, GH + 0.3, -GZ + 0.55, 0, r(), 0, 0.9, cA[0]);
  bOut.forEach(function (p2, i2) { if (i2 % 2 === 0 && p2[1] > 0.4) outline.add(p2[0] * 1.03, p2[1] + 0.1, -GZ + 0.15, 0, r(), 0, 0.9, cA[1]); });
  pk.add(outline, 'vec4 place(){ float tw = 0.7 + 0.3 * sin(uTime * (1.3 + aData.y * 2.0) + aData.y * 50.0); return vec4(position, uOn * tw); }\n', [[GLOW_F, 0.2, 1.5, 2]]);

  // ── Trees beyond the walls, in silhouette against the sunset ───────────
  var leafCols = ['#ffffff', '#e4ecd8', '#f2f6e8', '#d8e2cc'].map(col), trees = [], ash = [];
  [-1, 1].forEach(function (s) {
    for (var z = 2; z > -GZ + 2; z -= 5.5) ash.push([s * (AW + 4.2 + r() * 0.6), 0, z - r(), 0.85 + r() * 0.2, r() * 6, leafCols[(r() * 4) | 0], 1]);
    for (z = 6; z > -GZ - 8; z -= 7) trees.push([s * (AW + 9 + r() * 5), 0, z, 1.1 + r() * 0.5, r() * 6, leafCols[(r() * 4) | 0], 1]);
  });
  group.add(treeMesh(broadleaf('#5a4028', '#45682e'), trees), treeMesh(ashoka('#5a4028', '#3a6428'), ash, true));

  // ── Petals on the runner and in the air ────────────────────────────────
  var pCols = ['#ff8c00', '#ffa10a', '#ffc21f', '#c21e3a', '#f06a8a', '#fff0d8'].map(col);
  var spots = [];
  for (k = 0; k < (small ? 220 : 380); k++) spots.push([(r() - 0.5) * 3.2, 0.05 + r() * 0.01, 4 - r() * (GZ - 2)]);
  var petals = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 6).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide, emissive: '#2a0a00' }), spots.length);
  var q4 = new THREE.Quaternion(), e3 = new THREE.Euler(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
  spots.forEach(function (p2, j) {
    petals.setMatrixAt(j, mtx.compose(ps.set(p2[0], p2[1], p2[2]), q4.setFromEuler(e3.set(r() * 0.3, r() * 6, r() * 0.3)), sc.set(0.055, 1, 0.032)));
    petals.setColorAt(j, pCols[j % pCols.length]);
  });
  petals.userData.thin = true;
  group.add(petals);
  var air = new PointSet();
  for (k = 0; k < (small ? 70 : 120); k++) air.add((r() - 0.5) * 14, r() * 8, 4 - r() * GZ, 0, r(), 0, 0.8 + r() * 0.5, pCols[k % pCols.length]);
  tag(pk.add(air,
    'vec4 place(){ vec3 B = vec3(14.0, 8.0, ' + GZ + '.0), O = vec3(-7.0, 0.0, ' + (-GZ + 4) + '.0); float s = aData.y;\n' +
    ' vec3 p = position + vec3(uTime * 0.2 + sin(uTime * 0.7 + s * 20.0) * 0.5, -uTime * (0.22 + s * 0.2), sin(uTime * 0.45 + s * 9.0) * 0.5);\n' +
    ' p = O + mod(p - O, B); vCol = aCol * uLit; return vec4(p, 0.9); }\n',
    [[PETAL_F, 0.12, 1.4, 7, true, 1.4]]), 'pts');

  // ── Fireworks over the gate ────────────────────────────────────────────
  var fw = new PointSet(), FWB = small ? 4 : 6, FWN = small ? 110 : 180;
  var fwCols = ['#ffd27a', '#ff8fb0', '#ffb04a', '#fff1cc', '#ff6a7a', '#ffcf5a'].map(col);
  for (var bI = 0; bI < FWB; bI++) {
    for (k = 0; k < FWN; k++) {
      var u1 = r() * 2 - 1, th = r() * Math.PI * 2, sq = Math.sqrt(1 - u1 * u1);
      fw.add(sq * Math.cos(th), u1, sq * Math.sin(th), bI, r(), 0.75 + r() * 0.25, 1, fwCols[bI % fwCols.length]);
    }
  }
  pk.add(fw, FW_POS, [[GLOW_F, 0.34, 1.8, 3]]);

  // ── Assemble ───────────────────────────────────────────────────────────
  var stone = merge(g);
  groundShade(stone, 0, 2.2, 0.78);
  worldUV(stone, 2);
  group.add(new THREE.Mesh(stone, new THREE.MeshLambertMaterial({ vertexColors: true, map: stoneTexture() })));
  var glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  group.add(new THREE.Mesh(merge(glow), glowMat));
  group.add(G.mesh(null, small));
  var poolTex = softSprite('rgba(255,170,90,1)', 'rgba(255,120,40,0)');
  var pools = [];
  lamps.forEach(function (l) { pools.push(pool(group, poolTex, l[0], 0, l[1], 3.4)); });

  var fwRow = keyed([[0, 0], [0.25, 0.2], [0.6, 1], [1, 1]]);
  function frame(f) {
    var h = (f.tod % 24 + 24) % 24;
    U.uTime.value = f.time; U.uScale.value = f.pxScale; U.uFogD.value = f.fogD * 0.5;
    U.uLit.value = clamp(f.P.hi * 0.6 + 0.2, 0.4, 1.1);
    U.uFw.value = fwRow(f.u)[0] * f.w;
    U.uOn.value = 0.75 + 0.25 * smooth(17.6, 18.4, h);
    glowMat.color.setScalar(0.85);
    for (var i = 0; i < pools.length; i++) pools[i].material.opacity = 0.32;
    var fl = f.reduce ? 1 : 0.88 + 0.12 * Math.sin(f.time * 9.1) * Math.sin(f.time * 5.7);
    // The two nearest lamp pairs light the avenue; the hall's light the arch.
    var cz = W.camera.position.z - o.z;
    var near = clamp(Math.round(-cz / 4) * -4, -GZ + 4, 0);
    W.lamp(o.x - LX, 2.9, o.z + near - 4, '#ff9a48', 4.5 * fl, 10, 1.7);
    W.lamp(o.x + LX, 2.9, o.z + near - 4, '#ff9a48', 4.5 * fl, 10, 1.7);
    W.lamp(o.x, 4.0, o.z - GZ + 1.2, '#ffb26a', 7, 14, 1.6);
  }
  return { group: group, frame: frame };
}

function shapeFromPts(pts) {
  var s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
  for (var i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath(); return s;
}
