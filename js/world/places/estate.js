/*
 * The whole estate, seen from afar: one light model of every place, for the
 * two views that take it all in at once.
 *
 *  - The Venue, late at night: high above the estate, a stylised night map.
 *    The places glow far below, villages and lanes of lights are scattered
 *    across the dark fields, and a gold route traces from the estate's
 *    approach east to a pin for the Radisson, which pulses behind "Get
 *    Directions". (A mood, not a real map: no street names.)
 *  - The footer, at dawn: the sun rising over the ridge, every place seen
 *    together from a gentle height.
 *
 * Each place is a handful of boxes, domes and an instanced tree belt in its
 * own colours (one merged mesh), with its lights as a point field. When the
 * real place is on screen (travelling to or from it) its stand-in hides, so
 * the two never overlap.
 */
import { THREE, clamp, lerp, smooth, rng, col, box, cyl, Garlands, PointSet, pointKit, GLOW_F, HALO_F, broadleaf,
         treeMesh, groundShade, onionDome, shikhara, Q, tag } from '../lib.js';
import { tinted, merge } from '../../immersive/kit.js';
import { keyed, cols } from '../timeline.js';
import { COURT_DAWN, HOMES, TERRACE, STORY, HALDI, BARAAT, HALL, PAVILION, PIN, groundH } from '../land.js';

var C = cols(['px', 'py', 'pz', 'tx', 'ty', 'tz', 'tod']);
// The Venue's camera: high over the celebrations, the pin to the east.
var MAP_W = keyed([
  [0,   44, 175, -88,  54, 0, -160, 22.8],
  [1,   54, 185, -96,  58, 0, -164, 23.4]
]);
var MAP_T = keyed([
  [0,   50, 250, -92,  54, 0, -162, 22.8],
  [1,   56, 262, -98,  58, 0, -166, 23.4]
]);
export function mapPose(u, out, f) {
  var row = (f.aspect < 0.9 ? MAP_T : MAP_W)(u);
  out.pos.set(row[C.px], row[C.py], row[C.pz]); out.tgt.set(row[C.tx], row[C.ty], row[C.tz]);
  out.tod = row[C.tod]; out.mist = -0.6;
}
// The footer's camera: from the north-west at a gentle height, the whole
// estate laid out towards the rising sun.
var DAWN_W = keyed([
  [0,  -66, 34,  44,   26, 0, -70,  30.0],
  [1,  -58, 30,  36,   30, 0, -74,  30.9]
]);
var DAWN_T = keyed([
  [0,  -44, 46, 70,    14, 0, -60,  30.0],
  [1,  -40, 42, 62,    16, 0, -64,  30.9]
]);
export function dawnPose(u, out, f) {
  var row = (f.aspect < 0.9 ? DAWN_T : DAWN_W)(u);
  out.pos.set(row[C.px], row[C.py], row[C.pz]); out.tgt.set(row[C.tx], row[C.ty], row[C.tz]);
  out.tod = row[C.tod]; out.mist = -0.7;
}

var SAND = '#dcae80', SAND2 = '#e6bf94', TRIM = '#f4e2c2', DOME = '#f2e2c4', RED = '#b4553c', MARBLE = '#f6e6cc';

export function build(W) {
  var small = W.small, r = rng(4040);
  var group = new THREE.Group();
  var U = { uTime: { value: 0 }, uScale: { value: 600 }, uFogD: { value: 0.004 }, uNight: { value: 1 }, uMap: { value: 0 }, uRoute: { value: 0 }, uHide: { value: 0 } };
  var pk = pointKit(U, group);
  var cWarm = [col('#ffd88a'), col('#ffc060'), col('#ffe6b0'), col('#ffb070')];

  // ── One stand-in per place ─────────────────────────────────────────────
  var parts = {}, lights = new PointSet(), treeSpots = [];
  var leafCols = ['#ffffff', '#e4ecd8', '#f2f6e8', '#d8e2cc'].map(col);
  var partIdx = 0, partNames = [];
  function part(name, fn) {
    var g = [], start = lights.p.length / 3;
    partIdx = partNames.length; partNames.push(name);
    fn(g);
    var geo = merge(g);
    groundShade(geo, 0, 3, 0.75);
    var m = new THREE.Mesh(geo, mat);
    group.add(m);
    parts[name] = { mesh: m, l0: start, l1: lights.p.length / 3 };
  }
  var mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  function lamp(x, y, z, size, k) { lights.add(x, y, z, k == null ? 1 : k, r(), partIdx, size || 1, cWarm[(r() * 4) | 0]); }
  function walledCourt(g, cx, z0, z1, hw, h, wall, opts) {
    var t = 0.9;
    if (!opts.noFront) box(g, cx - hw, cx + hw, 0, h, z0 - t, z0, wall);
    box(g, cx - hw, cx + hw, 0, h, z1, z1 + t, wall);
    box(g, cx - hw, cx - hw + t, 0, h, z1, z0, wall); box(g, cx + hw - t, cx + hw, 0, h, z1, z0, wall);
    box(g, cx - hw + t, cx + hw - t, 0, 0.05, z1 + t, z0 - t, opts.floor || '#e6cfa6');
    [[cx - hw, z0], [cx + hw, z0], [cx - hw, z1], [cx + hw, z1]].slice(opts.noFront ? 2 : 0).forEach(function (c) {
      g.push(tinted(new THREE.CylinderGeometry(1.2, 1.35, h + 2, 8).translate(c[0], (h + 2) / 2, c[1]), SAND2));
      g.push(onionDome(0.95, h + 2, DOME, 8).translate(c[0], 0, c[1]));
    });
    // Arcades' roofs along the inside of the side walls.
    box(g, cx - hw + t, cx - hw + 4, 4.0, 4.4, z1 + t, z0 - t, SAND2); box(g, cx + hw - 4, cx + hw - t, 4.0, 4.4, z1 + t, z0 - t, SAND2);
    for (var z = z0 - 2; z > z1 + 1; z -= 3) { lamp(cx - hw + 3, 2.4, z, 1.1); lamp(cx + hw - 3, 2.4, z, 1.1); }
  }
  function haveliBox(g, x, z, rot, wall) {
    var m = new THREE.Matrix4().makeRotationY(rot).setPosition(x, 0, z), q = [];
    box(q, -4.5, 4.5, 0, 4.1, -7, 0, wall); box(q, -3.7, 3.7, 4.1, 6.8, -6.2, -0.75, wall);
    box(q, -4.8, 4.8, 3.9, 4.15, -7.3, 0.45, TRIM);
    [-1, 1].forEach(function (s) { q.push(onionDome(0.8, 7.0, DOME, 8).translate(s * 2.6, 0, -5)); });
    q.forEach(function (p) { p.applyMatrix4(m); g.push(p); });
    var v = new THREE.Vector3();
    [[-2.9, 1.4], [0, 1.4], [2.9, 1.4], [-2.3, 5.3], [0, 5.3], [2.3, 5.3]].forEach(function (w) { v.set(w[0], w[1], 0.4).applyMatrix4(m); lamp(v.x, v.y, v.z, 1.3); });
  }

  part('court', function (g) {
    var o = COURT_DAWN;
    walledCourt(g, o.x, o.z, o.z - 46, 15, 6.2, SAND, { noFront: true });
    // Pool, pavilion and its temple tower, and the gate's portal and turrets.
    box(g, -4.4, 4.4, 0.05, 0.3, o.z - 24.2, o.z - 12.2, '#2a4a58');
    box(g, -4.4, 4.4, 0, 4.6, o.z - 41.6, o.z - 32.8, SAND2);
    var tz = o.z - 37.2, gold = [];
    box(g, -2.3, 2.3, 4.6, 6.25, tz - 2.3, tz + 2.3, '#f0c9b0');
    shikhara(g, gold, { x: 0, z: tz, y0: 6.25, B: 2.1, H: 5.5, n: 4, detail: 0, top: 0.36, color: '#f6d4be', seg: 6, kalash: 0.95, kseg: 6 });
    [[0, 1], [1, 0], [-1, 0]].forEach(function (d) {
      shikhara(g, gold, { x: d[0] * 2.12, z: tz + d[1] * 2.12, y0: 6.25, B: 0.98, H: 3.0, n: 2, detail: 0, top: 0.36, color: '#f6d4be', seg: 5, kalash: 0.45, kseg: 5 });
    });
    gold.forEach(function (k) { g.push(tinted(k, '#d9a441')); });
    // The floral gateway: an arch of marigolds between walls of flowers, drapes either side.
    var arch = new THREE.Shape(), ap = [[-2.9, 0], [-1.7, 0], [-1.7, 4.2], [-1.0, 5.7], [0, 6.35], [1.0, 5.7], [1.7, 4.2], [1.7, 0], [2.9, 0], [2.9, 4.4], [2.0, 6.6], [0, 7.6], [-2.0, 6.6], [-2.9, 4.4]];
    arch.moveTo(ap[0][0], ap[0][1]); ap.forEach(function (p) { arch.lineTo(p[0], p[1]); });
    g.push(tinted(new THREE.ExtrudeGeometry(arch, { depth: 1.75, bevelEnabled: false }).translate(0, 0, o.z - 1.15), '#f08a1c'));
    box(g, -1.7, 1.7, 0, 4.2, o.z - 1.15, o.z - 1.05, '#eedcb8');
    [-1, 1].forEach(function (s) {
      box(g, s * 2.85, s * 6.6, 0, 3.4, o.z + 0.08, o.z + 0.42, '#d6336c');
      box(g, s * 2.95, s * 15.2, 0, 6.15, o.z - 1.6, o.z - 1.4, '#f4dccb');
    });
    for (var k = 0; k < 10; k++) lamp((k - 4.5) * 0.9, 0.4, o.z + 3 + k * 0.8, 0.9);
    lamp(0, 2.6, o.z - 39, 2.4);
  });
  part('homes', function (g) {
    haveliBox(g, -HOMES.x, HOMES.z, HOMES.rot, '#d9a066');
    haveliBox(g, HOMES.x, HOMES.z, -HOMES.rot, '#d38a74');
    box(g, -1.3, 1.3, 0, 0.05, 52, 81, '#a8543c');
  });
  part('terrace', function (g) {
    var z = TERRACE.z;
    box(g, -9.5, 9.5, 0, 7.0, z - 6.5, z + 6.5, SAND); box(g, -9.8, 9.8, 7.0, 7.3, z - 6.8, z + 6.8, TRIM);
    [[-8.5, z - 5.5], [8.5, z - 5.5], [-8.5, z + 5.5], [8.5, z + 5.5]].forEach(function (c) { g.push(onionDome(0.7, 9.4, DOME, 8).translate(c[0], 0, c[1])); box(g, c[0] - 0.8, c[0] + 0.8, 7.3, 9.4, c[1] - 0.8, c[1] + 0.8, TRIM); });
    for (var x = -8; x <= 8; x += 2) lamp(x, 2, z + 6.8, 1.1);
  });
  // The story's marigold field: a striped field texture, the havelis, the mandap.
  var fc = document.createElement('canvas'); fc.width = 64; fc.height = 256;
  var fx = fc.getContext('2d');
  fx.fillStyle = '#3e4824'; fx.fillRect(0, 0, 64, 256);
  for (var i = 0; i < 64; i += 4) { fx.fillStyle = i % 8 ? '#e58a14' : '#f2a21e'; fx.fillRect(i, 0, 2.5, 256); }
  fx.fillStyle = '#8a6a48'; fx.fillRect(29, 0, 6, 256);
  var fieldTex = new THREE.CanvasTexture(fc); fieldTex.colorSpace = THREE.SRGBColorSpace;
  var field = new THREE.Mesh(new THREE.PlaneGeometry(23, 46).rotateX(-Math.PI / 2).translate(0, 0.25, 1.2), new THREE.MeshLambertMaterial({ map: fieldTex, emissive: '#2a1200' }));
  group.add(field);
  part('story', function (g) {
    haveliBox(g, STORY.HOME_A.x, STORY.HOME_A.z, STORY.HOME_A.rot, '#d9a066');
    haveliBox(g, STORY.HOME_B.x, STORY.HOME_B.z, STORY.HOME_B.rot, '#d38a74');
    box(g, -3.8, 3.8, 0, 0.5, STORY.MZ - 3.8, STORY.MZ + 3.8, '#ead4ae');
    g.push(tinted(new THREE.ConeGeometry(4.2, 1.6, 4).rotateY(Math.PI / 4).translate(0, 4.9, STORY.MZ), '#8a1a2e'));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { cyl(g, c[0] * 2.9, STORY.MZ + c[1] * 2.9, 0.5, 4.1, 0.16, '#f1e2c2', 6); });
    for (var z = 22; z > -22; z -= 2.2) { lamp(-1.3, 0.3, z, 0.7); lamp(1.3, 0.3, z, 0.7); }
    for (var k = 0; k < 24; k++) { var a = k / 24 * Math.PI * 2; lamp(Math.cos(a) * 6, 0.3, STORY.MZ + Math.sin(a) * 6, 0.8); }
  });
  part('haldi', function (g) {
    walledCourt(g, HALDI.x, HALDI.z, HALDI.z - 27, 12, 7.0, '#ebb85e', { floor: '#efd7ae' });
    box(g, -3.0, 3.0, 3.4, 3.7, HALDI.z - 16.3, HALDI.z - 11.7, '#ffcf2e');
  });
  part('baraat', function (g) {
    var z0 = BARAAT.z, gz = z0 - 40;
    box(g, -7.6, 7.6, 0, 0.05, gz, z0 + 4, '#dcc4a0'); box(g, -1.35, 1.35, 0.05, 0.08, gz, z0 + 4, '#a3222e');
    box(g, -12, 12, 0, 10.5, gz - 2.2, gz, RED); box(g, -12.3, 12.3, 10.5, 11.2, gz - 2.4, gz + 0.3, TRIM);
    [-13, 13].forEach(function (x) { g.push(tinted(new THREE.CylinderGeometry(1.5, 1.7, 13, 8).translate(x, 6.5, gz - 1), RED)); g.push(onionDome(1.25, 13, DOME, 8).translate(x, 0, gz - 1)); });
    g.push(onionDome(1.1, 11.2, DOME, 8).translate(0, 0, gz - 1.1));
    for (var z = z0; z > gz + 3; z -= 2) { lamp(-5.4, 2.9, z, 1.4); lamp(5.4, 2.9, z, 1.4); }
  });
  part('hall', function (g) {
    var z0 = HALL.z;
    box(g, -8.2, 8.2, 0, 0.6, z0 - 26.6, z0 + 0.6, MARBLE);
    box(g, -7.9, 7.9, 5.2, 6.3, z0 - 26.4, z0 + 0.4, MARBLE);
    for (var z = z0; z > z0 - 26.1; z -= 3.7) [-7.6, 7.6].forEach(function (x) { cyl(g, x, z, 0.6, 5.2, 0.2, MARBLE, 6); });
    g.push(onionDome(1.9, 7.1, MARBLE, 12).translate(0, 0, z0 - 22.5));
    for (var x = -7.5; x <= 7.5; x += 1) { lamp(x, 6.4, z0 + 0.5, 0.8); lamp(x, 0.7, z0 + 0.8, 0.8); }
    for (z = z0; z > z0 - 26; z -= 3) lamp(0, 3.6, z, 1.6);
  });
  part('pavilion', function (g) {
    var o = PAVILION;
    box(g, -6, 6, 0, 0.2, o.z - 18, o.z, '#1a2a38');
    box(g, -3.5, 3.5, 0, 4.6, o.z - 23, o.z - 17, MARBLE);
    g.push(onionDome(2.2, 4.6, MARBLE, 10).translate(0, 0, o.z - 20));
    for (var k = 0; k < 16; k++) lamp((r() - 0.5) * 10, 0.3, o.z - 1 - r() * 16, 0.7);
  });

  // Hamlets in the fields round the pavilion: a few lit windows and lanes,
  // so the land beyond its garden is never just dark (never hidden).
  partIdx = 20;
  [[-38, -262], [44, -274], [-60, -300], [30, -318], [76, -250], [-86, -246]].forEach(function (hm) {
    for (var k = 0; k < 9; k++) { var hx = hm[0] + (r() - 0.5) * 12, hz = hm[1] + (r() - 0.5) * 10; lamp(hx, groundH(hx, hz) + 1.2, hz, 1.6); }
    for (var k2 = 1; k2 < 7; k2++) { var lx2 = lerp(hm[0], hm[0] * 0.5, k2 / 7), lz2 = lerp(hm[1], -240, k2 / 7); lamp(lx2, groundH(lx2, lz2) + 0.5, lz2, 1.0); }
  });

  // A belt of trees round everything (the map's and the dawn's woods).
  var avoid = [[0, 105, 20, 30], [0, 63, 14, 10], [0, 50, 12, 9], [0, 0, 26, 50], [0, -97, 15, 16], [0, -146, 14, 24], [0, -197, 13, 16], [0, -242, 10, 14]];
  for (var t = 0; t < 1400 && treeSpots.length < (small ? 260 : 400); t++) {
    var x = (r() - 0.5) * 120, z = 150 - r() * 410;
    var bad = avoid.some(function (a) { return Math.abs(x - a[0]) < a[2] && Math.abs(z - a[1]) < a[3]; });
    if (bad || Math.abs(x) < 3) continue;
    treeSpots.push([x, groundH(x, z) - 0.2, z, 0.9 + r() * 0.8, r() * 6, leafCols[(r() * 4) | 0], 0.9 + r() * 0.3]);
  }
  var treeGeo = merge([tinted(new THREE.CylinderGeometry(0.15, 0.25, 3.2, small ? 3 : 4, 1, small).translate(0, 1.6, 0), '#4a3424'),
                       tinted(new THREE.IcosahedronGeometry(2.2, 0).scale(1, 0.85, 1).translate(0, 4.6, 0), '#4c6e30')]);
  // And the countryside's own trees, scattered over the fields and in rows
  // along their edges (they give the land texture from the air).
  for (t = 0; t < (small ? 300 : 480); t++) {
    var cxs = (r() - 0.5) * 420, czs = 150 - r() * 520;
    if (Math.abs(cxs) < 62 && czs > -228) continue;            // the estate itself
    if (Math.abs(cxs) < 22 && czs > -290) continue;            // the pavilion and its garden
    if (Math.abs(cxs - PIN.x) < 40 && Math.abs(czs - PIN.z) < 34) continue;
    treeSpots.push([cxs, groundH(cxs, czs) - 0.2, czs, 0.8 + r() * 0.9, r() * 6, leafCols[(r() * 4) | 0], 0.85 + r() * 0.3]);
    if (r() < 0.45) for (var hr = 1; hr < 5; hr++) { var hx = cxs + hr * 6.5, hz = czs + (r() - 0.5) * 1.5; treeSpots.push([hx, groundH(hx, hz) - 0.2, hz, 0.6 + r() * 0.4, r() * 6, leafCols[(r() * 4) | 0], 1]); }
  }
  // Mango orchards and hedgerows round the pavilion's garden, so its
  // surroundings read from the air (and from the climb into the dawn).
  var orchard = [];   // its own mesh: kept whole at every tier (the climb into the dawn passes over it)
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (q) {
    for (var ox = 26; ox < 74; ox += small ? 7.5 : 6) for (var oz = 0; oz < 66; oz += small ? 7.5 : 6) {
      if (r() < 0.25) continue;
      var tx = q[0] * ox + (r() - 0.5) * 1.5, tz = PAVILION.z + 8 - oz * (q[1] > 0 ? 1 : -1) * 0 - oz + (r() - 0.5) * 1.5;
      if (q[1] < 0) tz = PAVILION.z - 60 - oz * 0.6;
      orchard.push([tx, groundH(tx, tz) - 0.2, tz, 0.7 + r() * 0.35, r() * 6, leafCols[(r() * 4) | 0], 0.9]);
    }
  });
  var orchardMesh = treeMesh(treeGeo, orchard);
  orchardMesh.userData.thin = false;
  group.add(orchardMesh);
  var trees = treeMesh(treeGeo, treeSpots);
  group.add(trees);

  // ── The night map: villages, lanes, the route and the pin ──────────────
  var vill = new PointSet();
  for (var v = 0; v < (small ? 18 : 30); v++) {
    var vx = (r() < 0.5 ? -1 : 1) * (40 + r() * 170), vz = 140 - r() * 420;
    if (Math.abs(vx - PIN.x) < 22 && Math.abs(vz - PIN.z) < 22) continue;
    var n = 6 + (r() * 14) | 0;
    for (var k = 0; k < n; k++) { var ux = vx + (r() - 0.5) * 14, uz = vz + (r() - 0.5) * 14; vill.add(ux, groundH(ux, uz) + 0.8, uz, 0, r(), 0, 0.9 + r() * 0.8, cWarm[(r() * 4) | 0]); }
  }
  // Lanes between villages: faint dotted lines of lamps.
  for (var l = 0; l < (small ? 6 : 10); l++) {
    var ax = (r() - 0.5) * 380, az = 120 - r() * 400, bx = ax + (r() - 0.5) * 200, bz = az + (r() - 0.5) * 200;
    var steps = Math.hypot(bx - ax, bz - az) / 6;
    for (var s2 = 0; s2 < steps; s2++) { var lx = lerp(ax, bx, s2 / steps), lz = lerp(az, bz, s2 / steps); vill.add(lx, groundH(lx, lz) + 0.6, lz, 0, r(), 0, 0.55, cWarm[1]); }
  }
  tag(pk.add(vill, 'vec4 place(){ return vec4(position, uMap * (0.65 + 0.35 * sin(uTime * 0.7 + aData.y * 30.0))); }\n', [[GLOW_F, 2.4, 2.2, 2]]), 'pts');
  // The map's surface: deep indigo fields ruled in faint gold, a river and
  // lanes, laid over the land while the map shows (no names, no streets).
  var MS = small ? 512 : 1024, mc = document.createElement('canvas'); mc.width = mc.height = MS;
  var mx = mc.getContext('2d'), mr = rng(66);
  mx.scale(MS / 1024, MS / 1024);
  mx.fillStyle = '#140d2a'; mx.fillRect(0, 0, 1024, 1024);
  for (var cy = 0; cy < 1024; cy += 46) for (var cx = 0; cx < 1024; cx += 58) {
    var sh = 20 + mr() * 30;
    mx.fillStyle = 'rgb(' + (sh | 0) + ',' + ((sh * 0.7) | 0) + ',' + ((sh * 1.9) | 0) + ')';
    mx.beginPath();
    mx.moveTo(cx + mr() * 8, cy + mr() * 8); mx.lineTo(cx + 58 - mr() * 8, cy + mr() * 8);
    mx.lineTo(cx + 58 - mr() * 8, cy + 46 - mr() * 8); mx.lineTo(cx + mr() * 8, cy + 46 - mr() * 8); mx.closePath(); mx.fill();
    mx.strokeStyle = 'rgba(226,182,100,0.34)'; mx.lineWidth = 1.6; mx.stroke();
  }
  mx.strokeStyle = 'rgba(120,150,230,0.5)'; mx.lineWidth = 9; mx.beginPath();
  for (var ry = 0; ry <= 1024; ry += 32) mx.lineTo(820 + Math.sin(ry * 0.012) * 70 + Math.sin(ry * 0.031) * 22, ry); mx.stroke();
  mx.strokeStyle = 'rgba(220,186,130,0.45)'; mx.lineWidth = 3.5;
  for (var ln = 0; ln < 7; ln++) { mx.beginPath(); var y0 = mr() * 1024; mx.moveTo(0, y0); mx.bezierCurveTo(300, y0 + (mr() - 0.5) * 400, 700, y0 + (mr() - 0.5) * 400, 1024, y0 + (mr() - 0.5) * 300); mx.stroke(); }
  var mapTex = new THREE.CanvasTexture(mc); mapTex.colorSpace = THREE.SRGBColorSpace; mapTex.anisotropy = 4;
  var mapMat = new THREE.MeshBasicMaterial({ map: mapTex, transparent: true, opacity: 0, depthWrite: false, fog: false });
  var mpg = new THREE.PlaneGeometry(460, 460, small ? 46 : 92, small ? 46 : 92).rotateX(-Math.PI / 2).translate(0, 0, -70), mpp = mpg.attributes.position;
  for (var mi = 0; mi < mpp.count; mi++) mpp.setY(mi, groundH(mpp.getX(mi), mpp.getZ(mi)) + 0.35);   // lie on the land
  var mapPlane = new THREE.Mesh(mpg, mapMat);
  mapPlane.renderOrder = -1;
  group.add(mapPlane);

  // The city round the pin: a denser bloom of lights.
  var city = new PointSet();
  for (k = 0; k < (small ? 160 : 280); k++) {
    var a2 = r() * Math.PI * 2, rr = Math.pow(r(), 0.7) * 36;
    var cx2 = PIN.x + Math.cos(a2) * rr * 1.3, cz2 = PIN.z + Math.sin(a2) * rr;
    city.add(cx2, groundH(cx2, cz2) + 0.9, cz2, 0, r(), 0, 0.8 + r() * 0.9, k % 5 ? cWarm[(r() * 4) | 0] : col('#fff0e0'));
  }
  tag(pk.add(city, 'vec4 place(){ return vec4(position, uMap * (0.6 + 0.3 * sin(uTime * 1.1 + aData.y * 40.0))); }\n', [[GLOW_F, 2.6, 2.2, 2]]), 'pts');
  // The route: from the Baraat avenue's start, east across the fields to the pin.
  var curve = new THREE.CatmullRomCurve3([[0, BARAAT.z + 6], [18, BARAAT.z + 10], [38, BARAAT.z - 2], [56, BARAAT.z - 10], [72, BARAAT.z - 30], [90, PIN.z + 4], [PIN.x, PIN.z]]
    .map(function (p) { return new THREE.Vector3(p[0], 0.9, p[1]); }), false, 'centripetal');
  var route = new PointSet(), tv = new THREE.Vector3(), NR = small ? 180 : 300;
  for (k = 0; k <= NR; k++) { curve.getPointAt(k / NR, tv); route.add(tv.x, groundH(tv.x, tv.z) + 1.0, tv.z, k / NR, r(), 0, 1, col('#ffd27a')); }
  pk.add(route,
    'vec4 place(){ float s = aData.x; float drawn = smoothstep(s - 0.02, s, uRoute);\n' +
    ' float pulse = exp(-pow(fract(uTime * 0.18) * 1.3 - s, 2.0) * 300.0);\n' +
    ' vCol = aCol * (1.0 + 2.5 * pulse); return vec4(position, uMap * drawn * (0.75 + 0.25 * pulse)); }\n',
    [[GLOW_F, 2.6, 2.4, 3]]);
  // The pin: a rose-gold marker standing over the city, rings pulsing out round it.
  var PIN_Y = groundH(PIN.x, PIN.z);
  var pinGeo = merge([tinted(new THREE.ConeGeometry(3.4, 12, 18).rotateX(Math.PI).translate(0, 6, 0), '#ffffff'),
                      tinted(new THREE.SphereGeometry(5.2, 18, 12).translate(0, 14.4, 0), '#ffffff'),
                      tinted(new THREE.SphereGeometry(2.1, 14, 10).translate(0, 14.4, 3.7), '#fff2e8')]);
  var pin = new THREE.Mesh(pinGeo, new THREE.MeshBasicMaterial({ vertexColors: true, color: '#ffb0b8', fog: false, transparent: true }));
  pin.position.set(PIN.x, PIN_Y, PIN.z);
  group.add(pin);
  var rings = [0, 1, 2].map(function (i) {
    var m = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffb6c0', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    m.position.set(PIN.x, PIN_Y + 0.6, PIN.z); m.renderOrder = 4; group.add(m); return m;
  });
  var pinGlow = new PointSet();
  pinGlow.add(PIN.x, PIN_Y + 14.4, PIN.z, 0, 0.5, 0, 1, col('#ff9aa8'));
  pk.add(pinGlow, 'vec4 place(){ return vec4(position, uMap * (0.7 + 0.3 * sin(uTime * 3.0))); }\n', [[HALO_F, 34, 6, 5]]);

  // The places' own lights (windows, lamps), brighter at night.
  pk.add(lights, 'vec4 place(){ float tw = 0.8 + 0.2 * sin(uTime * (1.3 + aData.y * 2.0) + aData.y * 50.0);\n' +
    ' float hidden = mod(floor(uHide / exp2(aData.z) + 0.001), 2.0);\n' +
    ' return vec4(position, (0.12 + 0.88 * uNight) * tw * aData.x * (1.0 - hidden)); }\n',
    [[GLOW_F, 1.6, 2.0, 2]]);
  // Mist lying in the fields at dawn: soft low veils.
  var mist = new PointSet();
  for (k = 0; k < (small ? 26 : 40); k++) mist.add((r() - 0.5) * 140, 1.5 + r() * 2, 120 - r() * 380, 0, r(), 0, 0.8 + r() * 0.6, col('#fff0e0'));
  tag(pk.add(mist, 'vec4 place(){ return vec4(position + vec3(sin(uTime * 0.05 + aData.y * 9.0) * 4.0, 0.0, 0.0), 0.22 * (1.0 - uNight) * (1.0 - uMap)); }\n',
    [[HALO_F, 22, 4, 1]]), 'lowSkip');

  var REAL = { court: ['dawn', 'gate'], homes: ['homes'], terrace: ['terrace'], story: ['story'], haldi: ['haldi'], baraat: ['baraat'], hall: ['hall'], pavilion: ['pavilion'] };
  function realShown(names) {
    for (var i = 0; i < names.length; i++) { var p = W.place(names[i]); if (p && p.group.visible) return true; }
    return false;
  }
  function frame(f) {
    var h = (f.tod % 24 + 24) % 24, night = 1 - smooth(5.4, 6.8, h) * (1 - smooth(17.6, 19.5, h));
    var map = smooth(21.4, 22.6, h < 12 ? h + 24 : h) * (1 - smooth(25.5, 27.5, h < 12 ? h + 24 : h));
    U.uTime.value = f.time; U.uScale.value = f.pxScale; U.uFogD.value = f.fogD * 0.4;
    U.uNight.value = night; U.uMap.value = map;
    mat.emissive.setRGB(0.16 * night, 0.09 * night, 0.04 * night);   // lamplight on the walls at night
    // The route draws itself in as the camera rises to the map.
    U.uRoute.value = map > 0 ? clamp(smooth(0.15, 0.95, f.w) * 1.06, 0, 1.06) : 0;
    // Stand-ins hide where the real place is on screen.
    var hide = 0;
    for (var pi = 0; pi < partNames.length; pi++) {
      var shown = realShown(REAL[partNames[pi]]);
      parts[partNames[pi]].mesh.visible = !shown;
      if (shown) hide += Math.pow(2, pi);
    }
    U.uHide.value = hide;
    field.visible = parts.story.mesh.visible;
    var pulse = f.reduce ? 0.5 : (f.time * 0.6) % 1;
    for (var i = 0; i < 3; i++) {
      var k = (pulse + i / 3) % 1, m = rings[i];
      m.scale.setScalar(6 + k * 34); m.material.opacity = map * (1 - k) * 0.9; m.visible = map > 0.01;
    }
    pin.visible = map > 0.01; pin.material.opacity = map;
    // The map is a view from high up: it gives way to the land as we come down.
    var hk = smooth(22, 70, W.camera.position.y);
    mapMat.opacity = map * 0.82 * hk; mapPlane.visible = map * hk > 0.01;
    pin.position.y = PIN_Y + (f.reduce ? 0.5 : 0.5 + Math.sin(f.time * 2.2) * 0.8);
    // At night the map glows, so the estate's glass and ink read over dark.
    if (map > 0) { f.P.hi *= lerp(1, 0.7, map); }
    // At dawn the sun breaks over the ridge in rays.
    var dawnK = smooth(5.5, 6.0, h) * (1 - smooth(6.9, 7.8, h));
    f.P.rays = Math.max(f.P.rays || 0, dawnK * 0.85 * (1 - map));
  }
  return { group: group, frame: frame };
}
