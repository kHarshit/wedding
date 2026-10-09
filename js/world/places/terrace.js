/*
 * The terrace, at golden hour: the roof of a two-storey pavilion at the end
 * of the homes' lane, looking west over the estate. Below lies the marigold
 * field of Our Story with its two havelis and the mandap; the sun lowers
 * behind them as the countdown is read. A jaali balustrade with marigold
 * swags runs along the west edge between two chhatris; a durrie with bolsters
 * and brass lamps is laid on the deck; strings of lights wait to come on.
 *
 * Seen from the lane, its east face closes the view: arcades below,
 * jharokhas above, chhatris at the corners.
 */
import { THREE, clamp, lerp, smooth, rng, col, box, cyl, archAt, pointedArch, notchShape, shiftPts, swag, groundShade,
         Garlands, PointSet, pointKit, GLOW_F, HALO_F, FLAME_F, LANTERN_F, worldUV, stoneTexture, jaaliTexture, onionDome } from '../lib.js';
import { tinted, merge } from '../../immersive/kit.js';
import { keyed, cols } from '../timeline.js';
import { TERRACE } from '../land.js';

var C = cols(['px', 'py', 'pz', 'tx', 'ty', 'tz', 'tod']);
var Z = TERRACE.z, DECK = TERRACE.deck, X0 = -9.5, X1 = 9.5, ZW = Z - 6.5, ZE = Z + 6.5;
var KEYS = keyed([
  //  at  px   py     pz      tx  ty    tz    tod
  [0,     0,   10.4,  Z - 1.0, 0,  4.6,  8,    16.5],
  [1,     0,   10.2,  Z - 2.0, 0,  3.9,  4,    17.95]
]);
export function terracePose(u, out, f) {
  var row = KEYS(u), port = smooth(1.25, 0.6, f.aspect);
  out.pos.set(row[C.px], row[C.py] + port * 0.6, row[C.pz] + port * 1.0);
  out.tgt.set(row[C.tx], row[C.ty] + port * 1.4, row[C.tz]);
  out.tod = row[C.tod];
  out.mist = 0;
}

export function build(W) {
  var small = W.small, r = rng(1717);
  var group = new THREE.Group();
  var U = { uTime: { value: 0 }, uScale: { value: 600 }, uFogD: { value: 0.004 }, uOn: { value: 0 } };
  var pk = pointKit(U, group);
  var G = new Garlands();
  var g = [], glow = [];
  var halos = new PointSet(), lanterns = new PointSet(), flames = new PointSet(), fairy = new PointSet();
  var PAL = { wall: '#dcae80', wall2: '#e6bf94', trim: '#f4e2c2', red: '#b8644a', stone: '#a8805c', dome: '#f2e2c4' };
  var cWin = col('#ffa04a'), cFairy = [col('#ffd88a'), col('#ffe6b0'), col('#ffc060')];

  // ── The building ───────────────────────────────────────────────────────
  var G1 = 3.4;   // the first floor
  box(g, X0 - 0.3, X1 + 0.3, 0, 0.5, ZW - 0.3, ZE + 0.3, PAL.stone);
  box(g, X0, X1, 0.5, DECK, ZW, ZE - 1.0, PAL.wall);
  // The east face: an arcade below and jharokhas above.
  var bays = [], AW = (X1 - X0) / 5;
  for (var k = 0; k < 5; k++) bays.push(shiftPts(pointedArch(AW - 0.9, 1.5, 2.75, 7, 0.1, 14), X0 + (k + 0.5) * AW));
  g.push(tinted(new THREE.ExtrudeGeometry(notchShape(X0, X1, G1 - 0.5, bays), { depth: 0.45, bevelEnabled: false }).translate(0, 0.5, ZE - 0.45), PAL.wall2));
  for (k = 0; k < 5; k++) { archAt(glow, AW - 1.2, 2.5, X0 + (k + 0.5) * AW, 0.5, ZE - 0.98, k % 2 ? cWin : col('#ffb862')); }
  box(g, X0 - 0.15, X1 + 0.15, G1, G1 + 0.22, ZW - 0.15, ZE + 0.3, PAL.trim);
  box(g, X0, X1, G1 + 0.22, DECK, ZE - 1.0, ZE, PAL.wall2);
  [-6.4, -2.1, 2.1, 6.4].forEach(function (x) {
    box(g, x - 0.9, x + 0.9, G1 + 0.45, G1 + 0.62, ZE, ZE + 0.65, PAL.trim);
    box(g, x - 0.75, x + 0.75, G1 + 0.62, G1 + 2.4, ZE, ZE + 0.5, PAL.wall);
    archAt(glow, 0.9, 1.4, x, G1 + 0.78, ZE + 0.51, cWin);
    archAt(g, 1.1, 1.6, x, G1 + 0.7, ZE + 0.505, PAL.trim);
    g.push(tinted(new THREE.ConeGeometry(1.15, 0.6, 4).rotateY(Math.PI / 4).translate(x, G1 + 2.7, ZE + 0.25), PAL.dome));
    halos.add(x, G1 + 1.4, ZE + 0.8, 0, r(), 0, 1.3, cWin);
  });
  // The deck's edge: a cornice all round.
  box(g, X0 - 0.35, X1 + 0.35, DECK - 0.05, DECK + 0.12, ZW - 0.35, ZE + 0.35, PAL.trim);

  // ── The deck ───────────────────────────────────────────────────────────
  var dt = stoneTexture().clone(); dt.needsUpdate = true; dt.repeat.set(9, 6.5);
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, ZE - ZW).rotateX(-Math.PI / 2).translate(0, DECK + 0.125, Z),
    new THREE.MeshLambertMaterial({ color: '#d8bb94', map: dt })));
  // The west balustrade: a low wall, jaali panels between posts, a rail.
  box(g, X0, X1, DECK + 0.12, DECK + 0.42, ZW, ZW + 0.32, PAL.trim);
  for (var px = X0; px <= X1 + 0.01; px += 1.9) {
    box(g, px - 0.13, px + 0.13, DECK + 0.42, DECK + 1.08, ZW + 0.02, ZW + 0.3, PAL.trim);
    g.push(tinted(new THREE.SphereGeometry(0.1, 8, 5).translate(px, DECK + 1.2, ZW + 0.16), '#d9a441'));
  }
  box(g, X0, X1, DECK + 1.06, DECK + 1.14, ZW - 0.02, ZW + 0.34, PAL.red);
  var jt = jaaliTexture('#f0dcb8'); jt.repeat.set((X1 - X0) / 0.75, 1);
  var jaali = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, 0.64).translate(0, DECK + 0.74, ZW + 0.16),
    new THREE.MeshLambertMaterial({ map: jt, alphaTest: 0.5, side: THREE.DoubleSide }));
  group.add(jaali);
  // Low parapets on the other three sides.
  box(g, X0, X1, DECK + 0.12, DECK + 0.75, ZE - 0.3, ZE, PAL.trim);
  [X0, X1].forEach(function (x) { box(g, x - (x < 0 ? 0 : 0.3), x + (x < 0 ? 0.3 : 0), DECK + 0.12, DECK + 0.75, ZW, ZE, PAL.trim); });
  // Chhatris at the four corners.
  [[X0 + 1.0, ZW + 1.0], [X1 - 1.0, ZW + 1.0], [X0 + 1.0, ZE - 1.0], [X1 - 1.0, ZE - 1.0]].forEach(function (c, ci) {
    var cx = c[0], cz = c[1], y0 = DECK + 0.12, s = 0.95;
    box(g, cx - 0.85, cx + 0.85, y0, y0 + 0.25, cz - 0.85, cz + 0.85, PAL.red);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { cyl(g, cx + q[0] * 0.62, cz + q[1] * 0.62, y0 + 0.25, y0 + 2.1, 0.07, PAL.trim, 8); });
    box(g, cx - 0.9, cx + 0.9, y0 + 2.1, y0 + 2.25, cz - 0.9, cz + 0.9, PAL.trim);
    var dome = onionDome(0.72, y0 + 2.25, PAL.dome, 16); dome.translate(cx, 0, cz);
    g.push(dome);
    // A hanging lantern inside each.
    lanterns.add(cx, y0 + 1.45, cz, 0, r(), 0, 1);
    // Marigolds round its eaves.
    for (var j = 0; j < 4; j++) {
      var q0 = [[-1, -1], [1, -1], [1, 1], [-1, 1]][j], q1 = [[1, -1], [1, 1], [-1, 1], [-1, -1]][j];
      G.garlandTo([cx + q0[0] * 0.85, y0 + 2.05, cz + q0[1] * 0.85], [cx + q1[0] * 0.85, y0 + 2.05, cz + q1[1] * 0.85], 0.22, small ? 6 : 9, 0.055);
    }
  });
  // Marigold swags along the balustrade.
  for (px = X0; px < X1 - 0.1; px += 1.9) {
    G.garlandTo([px, DECK + 1.12, ZW - 0.06], [px + 1.9, DECK + 1.12, ZW - 0.06], 0.32, small ? 8 : 12, 0.06);
    G.strand(px, DECK + 1.08, ZW - 0.06, 4, 0.11, 0.055, 4);
  }
  // A durrie with bolsters and cushions, and brass lamps on stands.
  var rug = document.createElement('canvas'); rug.width = 256; rug.height = 128;
  var rx = rug.getContext('2d');
  var stripes = ['#8a1e2c', '#d8a03a', '#8a1e2c', '#f2e2c4', '#2c4a6a', '#f2e2c4', '#8a1e2c', '#d8a03a', '#8a1e2c'];
  stripes.forEach(function (c2, i) { rx.fillStyle = c2; rx.fillRect(0, i * 128 / stripes.length, 256, 128 / stripes.length + 1); });
  rx.fillStyle = 'rgba(255,240,210,0.5)';
  for (var dx = 6; dx < 256; dx += 12) { rx.beginPath(); rx.moveTo(dx, 58); rx.lineTo(dx + 6, 64); rx.lineTo(dx, 70); rx.lineTo(dx - 6, 64); rx.fill(); }
  var rugTex = new THREE.CanvasTexture(rug); rugTex.colorSpace = THREE.SRGBColorSpace;
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.4).rotateX(-Math.PI / 2).translate(0, DECK + 0.14, Z + 1.0),
    new THREE.MeshLambertMaterial({ map: rugTex })));
  [[-2.4, Z + 2.3, 0], [2.4, Z + 2.3, 0], [-3.0, Z + 0.4, 1], [3.0, Z + 0.4, 1]].forEach(function (b, i) {
    var bol = new THREE.CylinderGeometry(0.2, 0.2, 1.1, 10).rotateZ(Math.PI / 2);
    if (b[2]) bol.rotateY(Math.PI / 2);
    g.push(tinted(bol.translate(b[0], DECK + 0.34, b[1]), i % 2 ? '#c23a4a' : '#d8a03a'));
  });
  for (k = 0; k < 5; k++) g.push(tinted(new THREE.BoxGeometry(0.62, 0.14, 0.62).translate(-2.2 + k * 1.1, DECK + 0.21, Z + 2.55), ['#8a1e2c', '#f2e2c4', '#d8a03a'][k % 3]));
  var stands = [[-3.6, Z - 1.4], [3.6, Z - 1.4]];
  var brassMat = new THREE.MeshPhongMaterial({ color: '#c08a2a', specular: '#ffe0a0', shininess: 50, emissive: '#2a1404' });
  var standProf = [[0, 0], [0.24, 0], [0.24, 0.05], [0.07, 0.12], [0.05, 1.1], [0.16, 1.18], [0.18, 1.22], [0, 1.22]].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var standGeo = new THREE.LatheGeometry(standProf, 12);
  stands.forEach(function (s2) {
    var m = new THREE.Mesh(standGeo, brassMat); m.position.set(s2[0], DECK + 0.12, s2[1]); group.add(m);
    flames.add(s2[0], DECK + 0.12 + 1.34, s2[1], 0, r(), 0, 1.1);
  });
  // Strings of lights between the chhatris, waiting for dusk.
  [[[X0 + 1.0, DECK + 2.2, ZW + 1.0], [X1 - 1.0, DECK + 2.2, ZE - 1.0]], [[X1 - 1.0, DECK + 2.2, ZW + 1.0], [X0 + 1.0, DECK + 2.2, ZE - 1.0]]].forEach(function (ab) {
    swag(ab[0], ab[1], 0.9, small ? 34 : 56, function (x, y, z) { fairy.add(x, y, z, 0, r(), 0, 0.9 + r() * 0.3, cFairy[(r() * 3) | 0]); });
  });

  var stone = merge(g);
  groundShade(stone, 0, 2.2, 0.75);
  worldUV(stone, 2);
  group.add(new THREE.Mesh(stone, new THREE.MeshLambertMaterial({ vertexColors: true, map: stoneTexture() })));
  var glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  group.add(new THREE.Mesh(merge(glow), glowMat));
  group.add(G.mesh(null, small));

  pk.add(flames, 'vec4 place(){ vCol = vec3(1.0, 0.55, 0.2); return vec4(position, 0.9 + 0.1 * sin(uTime * 8.0 + aData.y * 30.0)); }\n',
    [[HALO_F, 0.7, 2.2, 1, false, 2], [FLAME_F, 0.22, 1.6, 2]]);
  pk.add(lanterns, 'vec4 place(){ vCol = vec3(1.0, 0.6, 0.25); return vec4(position, 0.35 + 0.65 * uOn); }\n', [[LANTERN_F, 0.5, 2.0, 2]]);
  pk.add(fairy, 'vec4 place(){ float tw = 0.7 + 0.3 * sin(uTime * (1.3 + aData.y * 2.0) + aData.y * 50.0); return vec4(position, (0.12 + 0.88 * uOn) * tw); }\n', [[GLOW_F, 0.17, 1.5, 2]]);
  pk.add(halos, 'vec4 place(){ return vec4(position, 0.22 + 0.3 * uOn); }\n', [[HALO_F, 1.0, 2.0, 1]]);

  function frame(f) {
    var h = (f.tod % 24 + 24) % 24;
    var on = smooth(17.2, 18.6, h);
    U.uTime.value = f.time; U.uScale.value = f.pxScale; U.uFogD.value = f.fogD * 0.5; U.uOn.value = on;
    glowMat.color.setScalar(lerp(0.5, 0.95, on));
    var fl = f.reduce ? 1 : 0.9 + 0.1 * Math.sin(f.time * 8.7);
    W.lamp(stands[0][0], DECK + 1.5, stands[0][1], '#ffa050', 2.2 * fl, 6, 1.8);
    W.lamp(stands[1][0], DECK + 1.5, stands[1][1], '#ffa050', 2.2 * fl, 6, 1.8);
  }
  return { group: group, frame: frame };
}
