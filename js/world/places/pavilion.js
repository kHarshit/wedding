/*
 * The RSVP: a quiet pavilion by a still pool, at midnight.
 *
 * A long pool edged in white marble, diyas floating on it and their
 * reflections trembling in the dark water, a few lotuses; brass lanterns on
 * posts along both sides. At the far end a small marble baradari with a dome,
 * lanterns hanging in its arches and steps down to the water; trees behind,
 * the stars and the moon above. While the guest is here the scene slows and
 * dims, so the form is easy to read.
 *
 * On a successful RSVP (the 'rsvp:sent' event from js/rsvp.js) a single sky
 * lantern lifts from the middle of the pool and drifts up into the night.
 *
 * Origin: the pool's near edge on the axis; the pool runs back to z = -L.
 */
import { THREE, clamp, lerp, smooth, rng, col, box, cyl, archAt, pointedArch, notchShape, shiftPts, swag, groundShade,
         Garlands, PointSet, pointKit, GLOW_F, HALO_F, FLAME_F, LANTERN_F, diyaBowls, worldUV, stoneTexture, onionDome,
         broadleaf, ashoka, treeMesh, pool } from '../lib.js';
import { tinted, merge, softSprite } from '../../immersive/kit.js';
import { keyed, cols } from '../timeline.js';
import { PAVILION } from '../land.js';

var QX = 3.6, L = 16, RIM = 0.35, WY = 0.22;                // pool half-width, length, rim height, water level
var PZ = -L - 4.2, PH = 0.9, PW = 2.7, PT = PH + 3.4;       // the pavilion
var LZ0 = -2.0;                                               // where the reply's lantern lifts from (x by screen: uLX)
var C = cols(['px', 'py', 'pz', 'tx', 'ty', 'tz', 'tod']);
var WIDE = keyed([
  [0,   0,   2.4,  6.0,   0,   2.4,  -18,  23.8],
  [1,   0,   2.1,  3.0,   0,   2.1,  -18,  24.3]
]);
var TALL = keyed([
  [0,   0,   2.6,  7.5,   0,   3.4,  -18,  23.8],
  [1,   0,   2.3,  4.5,   0,   3.2,  -18,  24.3]
]);
export function pose(u, out, f) {
  var row = (f.aspect < 0.9 ? TALL : WIDE)(u), o = PAVILION;
  out.pos.set(o.x + row[C.px], row[C.py], o.z + row[C.pz]);
  out.tgt.set(o.x + row[C.tx], row[C.ty], o.z + row[C.tz]);
  out.tod = row[C.tod]; out.mist = 0;
}

export function build(W) {
  var small = W.small, o = PAVILION, r = rng(1212);
  var group = new THREE.Group();
  group.position.set(o.x, 0, o.z);
  var U = { uTime: { value: 0 }, uScale: { value: 600 }, uFogD: { value: 0.004 }, uRise: { value: -1 }, uLX: { value: 2.8 }, uLit: { value: 1 } };
  var pk = pointKit(U, group);
  var G = new Garlands();
  var g = [], glow = [];
  var MARBLE = '#f4e6d0', MARBLE2 = '#e8d4b8', GOLD = '#d9a441';

  // ── Lawn, the pool and its marble rim ──────────────────────────────────
  // The garden round the pool: mown stripes, flower beds and gravel walks,
  // with lamps along the walks (it reads as a garden from above, too).
  var gc = document.createElement('canvas'); gc.width = gc.height = 512;
  var gx = gc.getContext('2d'), gr = rng(9);
  for (var gs = 0; gs < 16; gs++) { gx.fillStyle = gs % 2 ? '#2c4824' : '#34542a'; gx.fillRect(0, gs * 32, 512, 32); }
  for (var gn = 0; gn < 2400; gn++) { gx.fillStyle = gr() < 0.5 ? 'rgba(10,25,8,0.3)' : 'rgba(110,140,70,0.16)'; gx.fillRect(gr() * 512, gr() * 512, 2, 2 + gr() * 3); }
  gx.fillStyle = '#b8a07a'; gx.fillRect(40, 0, 26, 512); gx.fillRect(446, 0, 26, 512); gx.fillRect(0, 470, 512, 26);
  [[150, 120], [362, 120], [150, 300], [362, 300]].forEach(function (c) {
    gx.fillStyle = '#b8a07a'; gx.beginPath(); gx.ellipse(c[0], c[1], 54, 34, 0, 0, 7); gx.fill();
    gx.fillStyle = '#26401e'; gx.beginPath(); gx.ellipse(c[0], c[1], 44, 26, 0, 0, 7); gx.fill();
    for (var b = 0; b < 90; b++) { var a = gr() * 7, rr = gr(); gx.fillStyle = ['#ff9a1a', '#fff0d0', '#c2183a', '#f4a3b6'][(gr() * 4) | 0]; gx.beginPath(); gx.arc(c[0] + Math.cos(a) * rr * 38, c[1] + Math.sin(a) * rr * 22, 2.6, 0, 7); gx.fill(); }
  });
  var gardenTex = new THREE.CanvasTexture(gc); gardenTex.colorSpace = THREE.SRGBColorSpace; gardenTex.anisotropy = 4;
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(40, 46).rotateX(-Math.PI / 2).translate(0, 0.012, -L / 2 - 2), new THREE.MeshLambertMaterial({ map: gardenTex, emissive: '#121c0c' })));
  var ft = stoneTexture().clone(); ft.needsUpdate = true; ft.repeat.set(5, 12);
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(QX * 2 + 6, L + 8).rotateX(-Math.PI / 2).translate(0, 0.02, -L / 2 - 1.5), new THREE.MeshLambertMaterial({ color: '#e8d6ba', map: ft })));
  [[-QX - 0.6, QX + 0.6, 0, 0.6], [-QX - 0.6, QX + 0.6, -L - 0.6, -L]].forEach(function (s) { box(g, s[0], s[1], 0, RIM, s[2], s[3], MARBLE); });
  [-1, 1].forEach(function (s) { box(g, s * QX + (s > 0 ? 0 : -0.6), s * QX + (s > 0 ? 0.6 : 0), 0, RIM, -L, 0, MARBLE); });
  box(g, -QX, QX, 0, 0.04, -L, 0, '#0c1824');
  var water = new THREE.Mesh(new THREE.PlaneGeometry(QX * 2, L).rotateX(-Math.PI / 2).translate(0, WY, -L / 2),
    new THREE.MeshPhongMaterial({ color: '#0a1622', specular: '#8a8aa8', shininess: 120, emissive: '#04080e' }));
  group.add(water);

  // ── The pavilion ───────────────────────────────────────────────────────
  box(g, -PW - 0.9, PW + 0.9, 0, PH, PZ - PW - 0.9, PZ + PW + 0.9, MARBLE2);
  for (var st = 0; st < 3; st++) box(g, -1.6, 1.6, 0, PH - (st + 1) * 0.26, PZ + PW + 0.9, PZ + PW + 0.9 + 0.36 * (st + 1), MARBLE);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
    var x = c[0] * PW, z = PZ + c[1] * PW;
    box(g, x - 0.3, x + 0.3, PH, PH + 0.3, z - 0.3, z + 0.3, MARBLE2);
    cyl(g, x, z, PH + 0.3, PT - 0.3, 0.16, MARBLE, 10);
    box(g, x - 0.28, x + 0.28, PT - 0.3, PT, z - 0.28, z + 0.28, GOLD);
  });
  [0, 1, 2, 3].forEach(function (side) {
    var a = new THREE.ExtrudeGeometry(notchShape(-PW, PW, PT - PH - 0.3, [pointedArch(PW * 2 - 0.7, 0.4, 2.55, 9, 0.1, 14)]), { depth: 0.24, bevelEnabled: false })
      .translate(0, PH + 0.3, -0.12).translate(0, 0, PW).rotateY(side * Math.PI / 2).translate(0, 0, PZ);
    g.push(tinted(a, MARBLE));
  });
  box(g, -PW - 0.5, PW + 0.5, PT, PT + 0.16, PZ - PW - 0.5, PZ + PW + 0.5, MARBLE2);
  box(g, -PW - 0.3, PW + 0.3, PT + 0.16, PT + 0.55, PZ - PW - 0.3, PZ + PW + 0.3, MARBLE);
  g.push(tinted(new THREE.CylinderGeometry(1.9, 2.0, 0.6, 18).translate(0, PT + 0.85, PZ), MARBLE2));
  g.push(onionDome(1.85, PT + 1.15, MARBLE, small ? 16 : 22).translate(0, 0, PZ));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { g.push(onionDome(0.4, PT + 0.55, MARBLE, 10).translate(c[0] * (PW + 0.05), 0, PZ + c[1] * (PW + 0.05))); });
  // A low divan with cushions inside, and a warm glow.
  box(g, -1.4, 1.4, PH, PH + 0.35, PZ - 1.1, PZ - 0.2, '#8e1f2c');
  [-0.8, 0, 0.8].forEach(function (x) { g.push(tinted(new THREE.CylinderGeometry(0.18, 0.18, 0.7, 10).rotateZ(Math.PI / 2).translate(x, PH + 0.5, PZ - 1.0), '#d9a441')); });

  // Hanging lanterns in the four arches and on posts along the pool.
  var lanterns = new PointSet(), lampPosts = [];
  [[0, PZ + PW], [0, PZ - PW], [-PW, PZ], [PW, PZ]].forEach(function (p) { lanterns.add(p[0], PT - 0.95, p[1], 0, r(), 0, 0.9); });
  [-1, 1].forEach(function (s) { for (var z = -1.5; z > -L; z -= 3.6) { lampPosts.push([s * (QX + 1.6), z]); lanterns.add(s * (QX + 1.6), 2.15, z, 1, r(), 0, 1); } });
  var lantGeo = merge([
    tinted(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 3, 1, true).translate(0, 0.55, 0), '#6a4a24'),
    tinted(new THREE.ConeGeometry(0.17, 0.18, 6, 1, true).translate(0, 0.28, 0), '#c08a2a'),
    tinted(new THREE.CylinderGeometry(0.13, 0.1, 0.3, 6, 1, true).translate(0, 0.04, 0), '#ffd28a'),
    tinted(new THREE.ConeGeometry(0.11, 0.08, 6, 1, true).rotateX(Math.PI).translate(0, -0.15, 0), '#c08a2a')
  ]);
  var lantMesh = new THREE.InstancedMesh(lantGeo, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#5a2a08', side: THREE.DoubleSide }), lanterns.p.length / 3);
  var mtx = new THREE.Matrix4();
  for (var li = 0; li < lanterns.p.length / 3; li++) lantMesh.setMatrixAt(li, mtx.makeTranslation(lanterns.p[li * 3], lanterns.p[li * 3 + 1], lanterns.p[li * 3 + 2]));
  group.add(lantMesh);
  var postProf = [[0, 0], [0.16, 0], [0.16, 0.08], [0.05, 0.14], [0.04, 2.0], [0.12, 2.05], [0, 2.05]].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var posts = new THREE.InstancedMesh(new THREE.LatheGeometry(postProf, 8), new THREE.MeshPhongMaterial({ color: '#b88a3a', specular: '#ffe0a0', shininess: 40, emissive: '#2a1404' }), lampPosts.length);
  lampPosts.forEach(function (p, i) { posts.setMatrixAt(i, mtx.makeTranslation(p[0] + (p[0] > 0 ? 0.25 : -0.25), 0, p[1])); });
  group.add(posts);
  // Marigold garlands round the pavilion's eaves, and down its columns.
  for (var e = 0; e < 4; e++) {
    var c0 = [[-1, 1], [1, 1], [1, -1], [-1, -1]][e], c1 = [[1, 1], [1, -1], [-1, -1], [-1, 1]][e];
    G.garlandTo([c0[0] * (PW + 0.45), PT - 0.05, PZ + c0[1] * (PW + 0.45)], [c1[0] * (PW + 0.45), PT - 0.05, PZ + c1[1] * (PW + 0.45)], 0.45, small ? 16 : 24, 0.06);
  }
  [[-1, 1], [1, 1]].forEach(function (c) { G.strand(c[0] * (PW + 0.2), PT - 0.15, PZ + c[1] * (PW + 0.2), small ? 20 : 28, 0.11, 0.055, 4); });

  // ── Floating diyas, their reflections, lotuses ─────────────────────────
  var floatD = new PointSet();
  for (var k = 0; k < (small ? 16 : 26); k++) floatD.add((r() - 0.5) * (QX * 2 - 1), WY, -0.8 - r() * (L - 1.6), 0, r(), 0, 1);
  var rimD = new PointSet();
  // Lamps along the garden's walks (the canvas's walks: x = -15.6 and +14.9, z = +16 and back).
  [-15.6, 14.9].forEach(function (x) { for (var z = 16; z > -L - 6; z -= small ? 2.4 : 1.7) rimD.add(x + (x < 0 ? 1.1 : -1.1), 0.02, z, 0, r(), 0, 0.9); });
  for (var wx = -15; wx <= 15; wx += small ? 2.4 : 1.7) rimD.add(wx, 0.02, 16.4, 0, r(), 0, 0.9);
  for (var rx = -QX - 0.3; rx <= QX + 0.31; rx += small ? 0.8 : 0.55) rimD.add(rx, RIM, 0.3, 0, r(), 0, 0.9);
  for (var rz = -0.6; rz > -L; rz -= small ? 0.9 : 0.6) { rimD.add(-QX - 0.3, RIM, rz, 0, r(), 0, 0.9); rimD.add(QX + 0.3, RIM, rz, 0, r(), 0, 0.9); }
  group.add(diyaBowls(floatD, 1.1, small ? 8 : 12), diyaBowls(rimD, 1, small ? 8 : 12));
  var FL = 'float fl(){ return 0.85 + 0.15 * sin(uTime * (6.0 + aData.y * 4.0) + aData.y * 40.0); }\n';
  pk.add(floatD, FL + 'vec4 place(){ vec3 p = position + vec3(0.0, 0.17 + sin(uTime * 0.9 + aData.y * 20.0) * 0.008, 0.0); vCol = vec3(1.0, 0.55, 0.2); return vec4(p, fl()); }\n',
    [[HALO_F, 0.75, 2.2, 1, false, 3], [FLAME_F, 0.2, 1.6, 2]]);
  pk.add(rimD, FL + 'vec4 place(){ vCol = vec3(1.0, 0.55, 0.2); return vec4(position + vec3(0.0, 0.16, 0.0), fl()); }\n',
    [[HALO_F, 0.6, 2.0, 1, false, 3], [FLAME_F, 0.18, 1.6, 2]]);
  pk.add(lanterns, FL + 'vec4 place(){ vCol = vec3(1.0, 0.62, 0.28); return vec4(position + vec3(0.0, 0.04, 0.0), fl()); }\n',
    [[HALO_F, 1.3, 2.2, 1, false, 3], [GLOW_F, 0.2, 1.6, 2]]);
  // Reflections: each flame mirrored in the still water (as in the dawn court).
  var MIRROR = function (lift, amt) {
    return 'vec4 place(){ vec3 P0 = position + vec3(0.0, ' + lift + ', 0.0); float H = ' + WY.toFixed(2) + ';\n' +
      ' vec3 Pm = vec3(P0.x, 2.0 * H - P0.y, P0.z); vec3 cam = cameraPosition - modelMatrix[3].xyz;\n' +
      ' vec3 Q = cam + (Pm - cam) * ((cam.y - H) / max(cam.y - Pm.y, 0.001)); Q.y = H + 0.005;\n' +
      ' Q.x += sin(uTime * 0.9 + P0.z * 3.0 + aData.y * 6.0) * 0.015;\n' +
      ' float inside = step(abs(Q.x), ' + (QX - 0.05).toFixed(2) + ') * step(abs(Q.z + ' + (L / 2).toFixed(2) + '), ' + (L / 2 - 0.05).toFixed(2) + ');\n' +
      ' vCol = vec3(1.0, 0.6, 0.28); return vec4(Q, ' + amt + ' * inside * (0.8 + 0.2 * sin(uTime * 2.0 + aData.y * 20.0))); }\n';
  };
  pk.add(floatD, MIRROR('0.17', '0.55'), [[HALO_F, 0.5, 1.8, 2], [GLOW_F, 0.12, 1.4, 2]]);
  pk.add(rimD, MIRROR('0.16', '0.4'), [[HALO_F, 0.45, 1.8, 2], [GLOW_F, 0.1, 1.4, 2]]);
  pk.add(lanterns, MIRROR('0.04', '0.45'), [[HALO_F, 0.9, 1.8, 2]]);
  var lotusParts = [];
  for (var ring = 0; ring < 2; ring++) for (k = 0; k < (ring ? 6 : 8); k++) {
    var a = (k + ring * 0.5) / (ring ? 6 : 8) * Math.PI * 2;
    lotusParts.push(tinted(new THREE.SphereGeometry(1, 5, 3).scale(0.07, 0.03, 0.17).translate(0, 0.04 + ring * 0.035, 0.12 - ring * 0.04).rotateX(-0.5 - ring * 0.5).rotateY(a), '#ffffff'));
  }
  lotusParts.push(tinted(new THREE.CylinderGeometry(0.26, 0.26, 0.01, 10), '#2a4a22'));
  var lotusSpots = [];
  for (k = 0; k < (small ? 8 : 12); k++) lotusSpots.push([(r() - 0.5) * (QX * 2 - 1), WY, -1 - r() * (L - 2), 0.9 + r() * 0.5, r() * 6, col(k % 3 ? '#f6c4d0' : '#fff0f4')]);
  var lotus = treeMesh(merge(lotusParts), lotusSpots);
  lotus.material = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#2a1018' });
  group.add(lotus);

  // Trees behind, dark against the stars.
  var leafCols = ['#ffffff', '#e4ecd8', '#f2f6e8', '#d8e2cc'].map(col), trees = [], ash = [];
  [[-12, -4], [-13, -14], [-10, -26], [12, -5], [13, -15], [10, -27], [-4, -31], [5, -32]].forEach(function (p, i) { trees.push([p[0], 0, p[1], 1.1 + r() * 0.4, r() * 6, leafCols[i % 4], 1]); });
  [-1, 1].forEach(function (s) { for (var z = -2; z > -L; z -= 4.5) ash.push([s * (QX + 4.2), 0, z, 0.8 + r() * 0.2, r() * 6, leafCols[(r() * 4) | 0], 1]); });
  group.add(treeMesh(broadleaf('#2a2018', '#22341c'), trees), treeMesh(ashoka('#2a2018', '#22341c'), ash, true));

  // ── The lantern that lifts on a reply ──────────────────────────────────
  var sky = new PointSet();
  sky.add(0, WY + 0.3, LZ0, 0, 0.4, 0, 2.2);
  pk.add(sky,
    'vec4 place(){ float t = uRise; if (t < 0.0) return vec4(position, 0.0);\n' +
    ' float up = t * t * 0.03 + t * 0.32;\n' +
    ' vec3 p = position + vec3(uLX + sin(t * 0.6) * 0.3 + t * 0.12, up, -t * 0.35);\n' +
    ' float fl = 0.88 + 0.12 * sin(uTime * 7.0);\n' +
    ' return vec4(p, smoothstep(0.0, 1.2, t) * fl * (1.0 - smoothstep(26.0, 34.0, t))); }\n',
    [[LANTERN_F, 0.85, 3.0, 6]]);
  var riseT0 = -1;
  function onSent() { if (riseT0 < 0) { riseT0 = W.f.time; W.poke(); } }
  document.addEventListener('rsvp:sent', onSent);

  // ── Assemble ───────────────────────────────────────────────────────────
  var stone = merge(g);
  groundShade(stone, 0, 2.0, 0.8);
  worldUV(stone, 2);
  group.add(new THREE.Mesh(stone, new THREE.MeshLambertMaterial({ vertexColors: true, map: stoneTexture(), emissive: '#2a1a0c' })));
  group.add(G.mesh('#3a1004', small));
  var poolTex = softSprite('rgba(255,170,90,1)', 'rgba(255,120,40,0)');
  var pools = [pool(group, poolTex, 0, PH, PZ, 7)];
  lampPosts.forEach(function (p) { pools.push(pool(group, poolTex, p[0], 0, p[1], 3.4)); });
  var halo = new PointSet();
  halo.add(0, PH + 1.6, PZ, 0, 0.5, 0, 5, col('#ffb070'));
  pk.add(halo, 'vec4 place(){ return vec4(position, 0.4); }\n', [[HALO_F, 1, 2, 1]]);

  function frame(f) {
    U.uTime.value = f.time; U.uScale.value = f.pxScale; U.uFogD.value = f.fogD * 0.5;
    U.uRise.value = riseT0 < 0 ? -1 : (f.reduce ? 6 : f.time - riseT0);
    // Beside the cards on wide screens, within the frame on narrow ones.
    U.uLX.value = f.aspect < 0.9 ? 0.9 : 2.9;
    if (riseT0 >= 0) f.slow = 1;   // keep the clock running while the lantern climbs
    // Quiet: the night dims and the scene slows while the guest replies.
    var w = f.w;
    f.P.hi *= lerp(1, 0.75, w); f.P.st *= lerp(1, 0.8, w);
    if (riseT0 < 0) f.slow = Math.min(f.slow, lerp(1, 0.35, w));
    for (var i = 0; i < pools.length; i++) pools[i].material.opacity = 0.32;
    var fl = f.reduce ? 1 : 0.92 + 0.08 * Math.sin(f.time * 6.1);
    W.lamp(o.x, PT - 1.2, o.z + PZ, '#ffb070', 5 * fl, 9, 1.6);
    W.lamp(o.x - QX - 1.6, 2.2, o.z - 5, '#ffa858', 2.5 * fl, 7, 1.8);
    W.lamp(o.x + QX + 1.6, 2.2, o.z - 9, '#ffa858', 2.5 * fl, 7, 1.8);
    if (riseT0 >= 0) {
      var t = f.reduce ? 6 : f.time - riseT0, up = t * t * 0.03 + t * 0.32;
      W.lamp(o.x + U.uLX.value + Math.sin(t * 0.6) * 0.3 + t * 0.12, WY + 0.3 + up, o.z + LZ0 - t * 0.35, '#ffa040', 4 * smooth(0, 1.2, t) * (1 - smooth(10, 20, t)), 10, 1.6);
    }
  }
  return { group: group, frame: frame };
}
