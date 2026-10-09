/*
 * The two homes, in the morning: the havelis of Our Story, met here first,
 * facing each other across a paved lane beyond the dawn courtyard's far arch.
 * The groom's home ("Noorpur (Bijnor), UP") stands on the left, the bride's
 * ("Gurugram, HR") on the right; each has its doors thrown open on the warm
 * hall within, a toran, a doorstep diya and a rangoli. Marigold strings swing
 * across the lane; at its end rises the terrace (terrace.js).
 *
 * On landscape screens the camera looks down the lane with a home either
 * side (the invitation's two halves rest in front of them); on portrait it
 * turns from the groom's home to the bride's as the two blocks scroll past.
 */
import { THREE, clamp, lerp, smooth, rng, col, box, swag, Garlands, PointSet, pointKit, GLOW_F, HALO_F, FLAME_F,
         haveli, HAVELI_PAL, broadleaf, treeMesh, diyaBowls, rangoliTexture, rangoli, stoneTexture, pool } from '../lib.js';
import { tinted, merge, softSprite } from '../../immersive/kit.js';
import { keyed, cols } from '../timeline.js';
import { HOMES } from '../land.js';

var C = cols(['px', 'py', 'pz', 'tx', 'ty', 'tz', 'tod']);
var WIDE = keyed([
  //  at  px    py    pz     tx    ty    tz    tod
  [0,     0,    3.1,  80.9,  0,    3.9,  50,   8.3],
  [1,     0,    3.0,  79.9,  0,    3.8,  50,   9.0]
]);
var TALL = keyed([
  [0,     0.6,  2.6,  80.6, -HOMES.x + 0.4, 5.0, HOMES.z + 1.0, 8.3],
  [0.22,  0.6,  2.6,  80.6, -HOMES.x + 0.4, 5.0, HOMES.z + 1.0, 8.45],
  [0.5,   0,    2.8,  80.2,  0,    4.6,  52,   8.65],
  [0.78, -0.6,  2.6,  80.0,  HOMES.x - 0.4, 5.0, HOMES.z + 1.0, 8.85],
  [1,    -0.6,  2.6,  80.0,  HOMES.x - 0.4, 5.0, HOMES.z + 1.0, 9.0]
]);

export function homesPose(u, out, f) {
  var tall = f.aspect < 0.9, row = (tall ? TALL : WIDE)(u);
  out.pos.set(row[C.px], row[C.py], row[C.pz]);
  out.tgt.set(row[C.tx], row[C.ty], row[C.tz]);
  out.tod = row[C.tod];
  out.mist = 0;
}
// Portrait screens hold the stop while each block passes; landscape ones a little less.
export function homesSpan() { return window.innerWidth / window.innerHeight < 0.9 ? [0.55, 0.1] : [0.3, 0.15]; }

export function build(W) {
  var small = W.small, r = rng(2027);
  var group = new THREE.Group();
  var U = { uTime: { value: 0 }, uScale: { value: 600 }, uFogD: { value: 0.004 }, uOn: { value: 1 } };
  var pk = pointKit(U, group);
  var G = new Garlands();
  var fairy = new PointSet(), winSpots = [];
  var ctx = { small: small, r: r, g: G, fairy: fairy, winSpots: winSpots };
  var groom = haveli(ctx, { x: -HOMES.x, z: HOMES.z, rot: HOMES.rot }, HAVELI_PAL[0], 0);
  var bride = haveli(ctx, { x: HOMES.x, z: HOMES.z, rot: -HOMES.rot }, HAVELI_PAL[1], 1);
  var houseMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  var glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  [groom, bride].forEach(function (h) { group.add(new THREE.Mesh(h.geo, houseMat), new THREE.Mesh(h.glow, glowMat)); });

  // Doors thrown open: two teak leaves at each doorway, swung out.
  var g = [];
  [groom, bride].forEach(function (h) {
    [-1, 1].forEach(function (s) {
      var leaf = tinted(new THREE.BoxGeometry(0.74, 2.45, 0.07).translate(s * 0.37, 1.225, 0), '#5d3519');
      var studs = tinted(new THREE.BoxGeometry(0.05, 2.2, 0.02).translate(s * 0.6, 1.225, 0.045), '#c8942e');
      [leaf, studs].forEach(function (q) {
        q.rotateY(-s * 1.2).translate(s * 0.74, 0.5, 0.06).applyMatrix4(h.lamp.m);
        g.push(q);
      });
    });
  });
  group.add(new THREE.Mesh(merge(g), new THREE.MeshLambertMaterial({ vertexColors: true })));

  // Doorstep diyas, rangolis, and the warm light spilling out.
  var lamps = new PointSet(), pools = [];
  var poolTex = softSprite('rgba(255,170,90,1)', 'rgba(255,120,40,0)');
  var rangoliMat = new THREE.MeshLambertMaterial({ map: rangoliTexture(), transparent: true, depthWrite: false, emissive: '#2a0c04' });
  [groom, bride].forEach(function (h) {
    var d = h.lamp.door, out = h.lamp.out;
    [-0.95, 0.95].forEach(function (s) {
      var side = new THREE.Vector3(out.z, 0, -out.x).multiplyScalar(s);
      lamps.add(d.x + side.x + out.x * 0.5, 0.5, d.z + side.z + out.z * 0.5, 0, r(), 0, 1.2);
    });
    rangoli(group, rangoliMat, d.x + out.x * 2.7, 0.0, d.z + out.z * 2.7, 2.3, Math.atan2(out.x, out.z));
    pools.push(pool(group, poolTex, d.x + out.x * 1.0, 0, d.z + out.z * 1.0, 3.2));
  });
  group.add(diyaBowls(lamps, 1.4, small ? 8 : 12));
  pk.add(lamps, 'vec4 place(){ vCol = vec3(1.0, 0.55, 0.2); return vec4(position + vec3(0.0, 0.2, 0.0), 0.88 + 0.12 * sin(uTime * (7.0 + aData.y * 5.0) + aData.y * 40.0)); }\n',
    [[HALO_F, 0.75, 2.2, 1, false, 3], [FLAME_F, 0.24, 1.6, 2]]);
  // Window glow, gentle by day.
  var winGlow = new PointSet(), cWin = col('#ffa04a');
  winSpots.forEach(function (sp) { winGlow.add(sp[0], sp[1], sp[2], 0, r(), 0, sp[3], cWin); });
  pk.add(winGlow, 'vec4 place(){ return vec4(position, 0.22); }\n', [[HALO_F, 1.0, 2.0, 1]]);

  // ── The lane ───────────────────────────────────────────────────────────
  var lt = stoneTexture().clone();
  lt.needsUpdate = true; lt.repeat.set(12, 16);
  var lane = new THREE.Mesh(new THREE.PlaneGeometry(24, 32).rotateX(-Math.PI / 2).translate(0, 0.03, 66),
    new THREE.MeshLambertMaterial({ color: '#c9ab88', map: lt }));
  group.add(lane);
  // A runner of red sandstone down the middle, edged in cream.
  var st = [];
  box(st, -1.3, 1.3, 0.03, 0.05, 52, 81.5, '#a8543c');
  [-1, 1].forEach(function (s) { box(st, s * 1.3 - 0.08, s * 1.3 + 0.08, 0.03, 0.06, 52, 81.5, '#f0dcb8'); });
  // Low plinths along the lane's edges, with planters.
  var urns = [];
  [-1, 1].forEach(function (s) {
    for (var z = 54; z < 76; z += 3.2) {
      if (Math.abs(z - HOMES.z) < 6.5) continue;
      urns.push([s * 4.6, z]);
    }
  });
  var urnProf = [[0, 0], [0.16, 0], [0.18, 0.06], [0.14, 0.12], [0.26, 0.3], [0.3, 0.48], [0.24, 0.64], [0.2, 0.7], [0.27, 0.76], [0.25, 0.8], [0, 0.8]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  urns.forEach(function (u) {
    st.push(tinted(new THREE.LatheGeometry(urnProf, small ? 10 : 14).translate(u[0], 0, u[1]), '#b4583a'));
    st.push(tinted(new THREE.IcosahedronGeometry(0.42, 1).scale(1, 0.8, 1).translate(u[0], 1.1, u[1]), '#3a5a26'));
    for (var j = 0; j < 7; j++) { var a = j / 7 * Math.PI * 2 + u[1]; G.ball(u[0] + Math.cos(a) * 0.3, 1.32 + (j % 2) * 0.08, u[1] + Math.sin(a) * 0.3, 0.075); }
  });
  group.add(new THREE.Mesh(merge(st), new THREE.MeshLambertMaterial({ vertexColors: true })));

  // Marigold strings swung across the lane, roof to roof.
  [-3.2, 0, 3.2].forEach(function (lx, i) {
    var a = new THREE.Vector3(lx, 4.55, 0.45).applyMatrix4(groom.lamp.m);
    var b = new THREE.Vector3(-lx, 4.55, 0.45).applyMatrix4(bride.lamp.m);
    var sag = 1.3 + (i === 1 ? 0.25 : 0), n = small ? 40 : 60;
    G.garlandTo([a.x, a.y, a.z], [b.x, b.y, b.z], sag, n, 0.07);
    swag([a.x, a.y, a.z], [b.x, b.y, b.z], sag, 14, function (x, y, z, t, k) {
      if (k > 0 && k < 14 && k % 2 === 0) G.strand(x, y - 0.1, z, 3 + (k % 4 === 0 ? 1 : 0), 0.11, 0.05, 3);
    });
  });
  group.add(G.mesh(null, small));

  // Trees behind the homes and along the lane's far end.
  var leafCols = ['#ffffff', '#e4ecd8', '#f2f6e8', '#d8e2cc'].map(col), trees = [];
  [[-15, 60], [-14, 73], [15, 61], [14.5, 74], [-11.5, 58.5], [11.5, 59], [-17.5, 66], [17.5, 67]].forEach(function (p, i) {
    trees.push([p[0], 0, p[1], 0.95 + r() * 0.4, r() * 6, leafCols[i % 4], 0.95 + r() * 0.2]);
  });
  group.add(treeMesh(broadleaf('#6a4a30', '#4c7232'), trees));

  function frame(f) {
    U.uTime.value = f.time; U.uScale.value = f.pxScale; U.uFogD.value = f.fogD * 0.5;
    glowMat.color.setScalar(0.55);
    for (var i = 0; i < pools.length; i++) pools[i].material.opacity = 0.32;
    var fl = f.reduce ? 1 : 0.9 + 0.1 * Math.sin(f.time * 8.1);
    W.lamp(groom.lamp.door.x + groom.lamp.out.x * 0.8, 1.4, groom.lamp.door.z + groom.lamp.out.z * 0.8, '#ffa050', 2.6 * fl, 7, 1.8);
    W.lamp(bride.lamp.door.x + bride.lamp.out.x * 0.8, 1.4, bride.lamp.door.z + bride.lamp.out.z * 0.8, '#ffa050', 2.6 * fl, 7, 1.8);
  }
  return { group: group, frame: frame };
}
