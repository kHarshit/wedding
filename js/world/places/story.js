/*
 * Our Story, told as a place in the world (moved here from
 * js/immersive/story.js, which ran its own canvas).
 *
 * It reads the four chapters from section.story-sec and builds a tall scroll
 * track after the header and portrait: a sticky full-screen stage with one
 * panel per chapter, a short intro beat and an outro on the names. The world
 * canvas shows through the stage. The chapter list stays in the page for
 * screen readers, hidden only while the scene runs; if the world falls back
 * the track goes and the list returns.
 *
 * The camera arrives from the courtyard and leaves for the morning by
 * travelling (the world's timeline), not through a cream veil.
 *
 * The scene, first person and without people:
 *   Intro  dusk over a marigold field; petals drift; the camera floats in.
 *   I      two havelis either side of the field, a diya and a toran at each
 *          door. A light sets out from each diya and wanders through the
 *          flowers until the two come close and pause.
 *   II     night falls and the stars come out; fireflies go back and forth
 *          between the two lights like a slow conversation, then gather
 *          with them into one steady glow.
 *   III    the glow is carried to the mandap and lights the sacred fire;
 *          petals shower down from all round and a golden thread of light
 *          loops seven times round the fire.
 *   IV     the whole place lit: fairy lights curtain both houses and swing
 *          between them, rings of diyas, sky lanterns rising, fireworks.
 *   Outro  Deeksha & Harshit.
 *
 * Keyframes are pinned to the panels by keys(); columns are named in C.
 */
import { THREE, clamp, lerp, smooth, rng, col, mq, box, cyl, swag, groundShade, Garlands, PointSet, pointKit,
         GLOW_F, HALO_F, FLAME_F, PETAL_F, LANTERN_F, haveli, HAVELI_PAL, broadleaf, ashoka, diyaGeometry,
         rangoliTexture, pool } from '../lib.js';
import { tinted, merge, softSprite } from '../../immersive/kit.js';
import { keyed, cols } from '../timeline.js';
import { STORY, groundH } from '../land.js';
import { STORY_DUSK, STORY_NIGHT } from '../sky.js';

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

// ── Timeline, in screens of scroll ──────────────────────────────────────
// u runs from -1 (the track's top at the bottom of the screen) through 0
// (the stage sticks) to TOTAL (it lets go). Each chapter fades in over FADE,
// reads for READ and fades out over FADE.
var INTRO = 0.6, FADE = 0.2, READ = 0.45, OUTRO = 0.85;
var PANEL = FADE * 2 + READ;
function S(i) { return INTRO + i * PANEL; }
function E(i) { return S(i) + PANEL; }
var TOTAL = S(4) + OUTRO;

var C = cols(['px', 'py', 'pz', 'tx', 'ty', 'tz', 'fit', 'night', 'walk', 'talk', 'gather', 'carry',
              'petal', 'phera', 'fest', 'lant', 'fw', 'drift', 'lift', 'liftP']);

function keys() {
  var F = FADE, R = READ;
  // lift / liftP raise the look target on landscape / portrait screens, so
  // the scene sits under the words rather than behind them.
  //  unit             px  py    pz     tx  ty    tz    fit  night walk talk gath carry petal phera fest lant  fw  drift lift liftP
  return [
    [-1,               0, 17,   46,    0, 3.0, -12,   0.4, 0,    0,   0,   0,   0,    0,   0,    0,   0,    0,  1,   1.2, 0],
    [0,                0, 9.0,  22,    0, 2.4, -12,   1,   0,    0,   0,   0,   0,    0,   0,    0,   0,    0,  1,   1.8, 0],
    [S(0),             0, 6.6,  15.5,  0, 2.1, -12,   1,   0.02, 0,   0,   0,   0,    0,   0,    0,   0,    0,  1,   2.2, -0.4],
    [S(0) + F,         0, 6.2,  14,    0, 2.0, -12,   1,   0.05, 0.02, 0,  0,   0,    0,   0,    0,   0,    0,  0.9, 2.2, -0.4],
    [E(0) - F,         0, 4.8,  9,     0, 1.7, -10,   1,   0.22, 1,   0,   0,   0,    0,   0,    0,   0,    0,  0.55, 1.7, -0.3],
    [E(0),             0, 4.1,  6.5,   0, 1.6, -9,    0.85, 0.4, 1,   0.1, 0,   0,    0,   0,    0,   0,    0,  0.35, 1.3, -0.2],
    [S(1) + F,         0, 3.0,  1.6,   0, 1.4, -7.4,  0.6, 0.85, 1,   1,   0,   0,    0,   0,    0,   0,    0,  0.1, 0.9, 0.2],
    [S(1) + F + R * .4, 0, 2.75, 0.4,  0, 1.35, -7.4, 0.55, 1,   1,   1,   0.12, 0,   0,   0,    0,   0,    0,  0,   0.8, 0.5],
    [E(1) - F,         0, 2.6, -0.6,   0, 1.4, -7.4,  0.55, 1,   1,   1,   1,   0,    0,   0,    0,   0,    0,  0,   0.8, 0.5],
    [E(1),             0, 2.8, -2.0,   0, 1.5, -9,    0.6, 1,    1,   0.8, 1,   0.06, 0,   0,    0,   0,    0,  0,   1.2, 0],
    [S(2) + F,         0, 4.2, -13.8,  0, 1.8, -29,   0.8, 1,    1,   0,   1,   1,    0.35, 0,   0,   0,    0,  0,   2.4, 0.6],
    [E(2) - F,         0, 4.4, -15.6,  0, 1.6, -29,   0.8, 1,    1,   0,   1,   1,    1,   1,    0,   0,    0,  0,   2.5, 0.7],
    [E(2),             0, 5.2, -14.5,  0, 1.9, -28,   0.7, 1,    1,   0,   1,   1,    0.7, 1,    0.12, 0,  0,  0,   2.0, 0.4],
    [S(3) + F + 0.1,   0, 8.2,  13,    0, 4.2, -18,   0.45, 1,    1,   0,   1,   1,    0.1, 1,    1,   0.35, 0.5, 0,  1.2, -1.2],
    [E(3),             0, 9.2,  21,    0, 5.2, -18,   0.45, 1,    1,   0,   1,   1,    0,   1,    1,   0.7,  1,  0,   1.2, -1.4],
    [TOTAL,            0, 9.8,  24,    0, 5.8, -18,   0.45, 1,    1,   0,   1,   1,    0,   1,    1,   1,    1,  0,   1.2, -1.4]
  ];
}
var sample = keyed(keys());

// ── World layout (metres) ───────────────────────────────────────────────
var HOME_A = STORY.HOME_A, HOME_B = STORY.HOME_B, MZ = STORY.MZ;
var MEET = [0, 1.15, -7.4];      // where the two lights meet

// Portrait screens pull the camera back along its view so both houses fit.
var kPort = 1, port = 0;
function fitScreen(aspect) {
  var fov = aspect < 1 ? lerp(60, 50, smooth(0.45, 1, aspect)) : 50;
  var hNow = Math.atan(Math.tan(fov * Math.PI / 360) * aspect), hWant = Math.atan(Math.tan(25 * Math.PI / 180) * 1.5);
  kPort = 1 + Math.max(0, Math.tan(hWant) / Math.tan(hNow) - 1) * 0.55;
  port = smooth(1.25, 0.55, aspect);
}

// The camera at u, for the timeline: keyed position and target; the hour
// follows the story's night (dusk 18.7 to night 21).
function pose(u, out) {
  var row = sample(u);
  out.tgt.set(row[C.tx], row[C.ty], row[C.tz]);
  out.pos.set(row[C.px], row[C.py], row[C.pz]).sub(out.tgt).multiplyScalar(lerp(1, kPort, row[C.fit])).add(out.tgt);
  out.tgt.y += lerp(row[C.lift], row[C.liftP], port);
  out.tod = lerp(STORY_DUSK, STORY_NIGHT, row[C.night]);
  out.mist = 0;
}

// ═════════════════════════════════════════════════════════════════════════
// The scene
// ═════════════════════════════════════════════════════════════════════════
function createScene(W) {
  var small = W.small, r = rng(310);
  // The sky (now the world's) drew its stars from this same generator first;
  // spend those numbers so every flower, tree and light lands where it did.
  for (var burn = 0; burn < 2 * ((small ? 900 : 1700) + (small ? 70 : 120)); burn++) r();
  var group = new THREE.Group();
  var V = THREE.Vector3;

  var U = {
    uTime: { value: 0 }, uScale: { value: 600 }, uFogD: { value: 0.006 },
    uWalk: { value: 0 }, uTalk: { value: 0 }, uGather: { value: 0 }, uCarry: { value: 0 },
    uFire: { value: 0 }, uPetal: { value: 0 }, uPhera: { value: 0 }, uFest: { value: 0 },
    uLant: { value: 0 }, uFw: { value: 0 }, uDrift: { value: 0 }, uNight: { value: 0 },
    uLit: { value: 1 }, uHead: { value: 0 },
    uA: { value: new V() }, uB: { value: new V() }, uG: { value: new V() }
  };
  var pk = pointKit(U, group);
  var addPoints = pk.add;

  // Marigold balls (garlands, torans) collected from everywhere, one instanced mesh.
  var G = new Garlands();
  var ROSE = G.ROSE, MARI = G.MARI;
  var leafGreen = '#3e6a22';
  var cFairy = [col('#ffd88a'), col('#ffe6b0'), col('#ffc060'), col('#ffd0a0')], cWin = col('#ffa04a');

  // ── Havelis ────────────────────────────────────────────────────────────
  var fairy = new PointSet(), winSpots = [], homeLamp = [];
  var ctx = { small: small, r: r, g: G, fairy: fairy, winSpots: winSpots };
  var hA = haveli(ctx, HOME_A, HAVELI_PAL[0], 0), hB = haveli(ctx, HOME_B, HAVELI_PAL[1], 1);
  homeLamp.push(hA.lamp, hB.lamp);
  var houseMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  [hA.geo, hB.geo].forEach(function (g) { group.add(new THREE.Mesh(g, houseMat)); });
  var glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: '#ffffff', fog: true });
  [hA.glow, hB.glow].forEach(function (g) { group.add(new THREE.Mesh(g, glowMat)); });

  // ── Rangoli at each door and the mandap ───────────────────────────────
  var rangoliMat = new THREE.MeshLambertMaterial({ map: rangoliTexture(), transparent: true, depthWrite: false, emissive: '#2a0c04' });
  function rangoli(x, z, size, rot) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), rangoliMat);
    m.position.set(x, 0.025, z); m.rotation.y = rot || 0; m.renderOrder = 1;
    group.add(m);
  }
  homeLamp.forEach(function (h) { rangoli(h.door.x + h.out.x * 2.6, h.door.z + h.out.z * 2.6, 2.2, Math.atan2(h.out.x, h.out.z)); });
  rangoli(0, MZ + 5.6, 3.2, 0);

  // ── The mandap ─────────────────────────────────────────────────────────
  var mg2 = [], PH = 0.5, HW = 3.8, PX = 2.9, PT = 3.9;
  box(mg2, -HW - 0.15, HW + 0.15, 0, 0.14, MZ - HW - 0.15, MZ + HW + 0.15, '#c4a074');
  box(mg2, -HW, HW, 0, PH, MZ - HW, MZ + HW, '#ead4ae');
  box(mg2, -1.7, 1.7, 0, 0.34, MZ + HW, MZ + HW + 0.42, '#e3caa0');
  box(mg2, -1.7, 1.7, 0, 0.17, MZ + HW, MZ + HW + 0.84, '#dcc298');
  box(mg2, -3.05, 3.05, PH, PH + 0.015, MZ - 3.05, MZ + 3.05, '#c99a3a');
  box(mg2, -2.9, 2.9, PH, PH + 0.03, MZ - 2.9, MZ + 2.9, '#8e1f2c');
  var corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]], kalashAt = [];
  corners.forEach(function (c) {
    var x = c[0] * PX, z = MZ + c[1] * PX;
    box(mg2, x - 0.32, x + 0.32, PH, PH + 0.36, z - 0.32, z + 0.32, '#d6b06a');
    cyl(mg2, x, z, PH + 0.36, PT - 0.3, 0.14, '#f1e2c2', 12);
    box(mg2, x - 0.28, x + 0.28, PT - 0.3, PT, z - 0.28, z + 0.28, '#d6b06a');
    // Marigolds wound up each pillar.
    var nb = small ? 40 : 64;
    for (var k = 0; k < nb; k++) {
      var t = k / nb, an = t * Math.PI * 2 * 6.5;
      G.ball(x + Math.cos(an) * 0.2, lerp(PH + 0.45, PT - 0.35, t), z + Math.sin(an) * 0.2, 0.06, k % 9 === 8 ? ROSE : null);
    }
    kalashAt.push([c[0] * 2.3, PH + 0.03, MZ + c[1] * 2.3]);
  });
  // Beams along the top.
  box(mg2, -PX - 0.25, PX + 0.25, PT, PT + 0.22, MZ - PX - 0.12, MZ - PX + 0.12, '#c99a3a');
  box(mg2, -PX - 0.25, PX + 0.25, PT, PT + 0.22, MZ + PX - 0.12, MZ + PX + 0.12, '#c99a3a');
  box(mg2, -PX - 0.12, -PX + 0.12, PT, PT + 0.22, MZ - PX - 0.25, MZ + PX + 0.25, '#c99a3a');
  box(mg2, PX - 0.12, PX + 0.12, PT, PT + 0.22, MZ - PX - 0.25, MZ + PX + 0.25, '#c99a3a');
  // The havan kund and the two seats beside it.
  box(mg2, -0.58, 0.58, PH, PH + 0.3, MZ - 0.58, MZ + 0.58, '#9a4a2c');
  box(mg2, -0.66, 0.66, PH + 0.3, PH + 0.36, MZ - 0.66, MZ + 0.66, '#c99a3a');
  box(mg2, -0.42, 0.42, PH + 0.36, PH + 0.38, MZ - 0.42, MZ + 0.42, '#2a120a');
  [-1, 1].forEach(function (s) {
    box(mg2, s * 1.35 - 0.38, s * 1.35 + 0.38, PH, PH + 0.22, MZ + 1.0 - 0.3, MZ + 1.0 + 0.3, '#d4a64a');
    box(mg2, s * 1.35 - 0.36, s * 1.35 + 0.36, PH + 0.22, PH + 0.34, MZ + 1.0 - 0.28, MZ + 1.0 + 0.28, '#d8344e');
  });
  var mandapGeo = merge(mg2);
  groundShade(mandapGeo, 0, 1.2, 0.8);
  group.add(new THREE.Mesh(mandapGeo, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#24100a' })));
  var FIRE = new V(0, PH + 0.38, MZ);
  (function kalash() {
    var prof = [[0, 0], [0.09, 0.01], [0.17, 0.09], [0.19, 0.16], [0.15, 0.25], [0.075, 0.31], [0.07, 0.35], [0.11, 0.38], [0.1, 0.4], [0, 0.4]]
      .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var parts = [tinted(new THREE.LatheGeometry(prof, 16), '#d9a43c'),
                 tinted(new THREE.SphereGeometry(0.1, 12, 8).scale(1, 1.15, 1).translate(0, 0.49, 0), '#8a5a2e'),
                 tinted(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 16).translate(0, 0.25, 0), '#b8202e')];
    for (var k = 0; k < 6; k++) {
      var a = k / 6 * Math.PI * 2;
      parts.push(tinted(new THREE.ConeGeometry(0.035, 0.24, 4).rotateZ(-1.15).translate(0.12, 0.42, 0).rotateY(a), leafGreen));
    }
    var g = merge(parts), mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#3a2206' });
    kalashAt.forEach(function (p) { var m = new THREE.Mesh(g, mat); m.position.set(p[0], p[1], p[2]); m.scale.setScalar(1.25); group.add(m); });
  })();

  // The canopy: a peaked tent of maroon and saffron panels.
  (function canopy() {
    var pos = [], cs = [], N = 28, RINGS = 7, E2 = PX + 0.3, cA = col('#8a1a2e'), cB = col('#e09a2a');
    function edge(a) { return E2 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))); }
    function pt(a, rho, frac) {
      var rr2 = edge(a) * rho, y = PT + 0.22 + 1.35 * Math.pow(1 - rho, 1.1) - 0.1 * Math.sin(Math.PI * frac) * rho;
      return [Math.cos(a) * rr2, y, MZ + Math.sin(a) * rr2];
    }
    for (var s = 0; s < N; s++) {
      var a0 = s / N * Math.PI * 2, a1 = (s + 1) / N * Math.PI * 2, cc = s % 2 ? cA : cB;
      for (var k = 0; k < RINGS; k++) {
        var r0 = k / RINGS, r1 = (k + 1) / RINGS;
        for (var j = 0; j < 4; j++) {
          var f0 = j / 4, f1 = (j + 1) / 4, b0 = lerp(a0, a1, f0), b1 = lerp(a0, a1, f1);
          var p00 = pt(b0, r0, f0), p01 = pt(b1, r0, f1), p10 = pt(b0, r1, f0), p11 = pt(b1, r1, f1);
          pos.push.apply(pos, p00.concat(p10, p01, p01, p10, p11));
          for (var q = 0; q < 6; q++) cs.push(cc.r, cc.g, cc.b);
        }
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: '#1a0406' })));
  })();

  // Sheer rose swags between the pillars, and tails gathered at each pillar.
  var fabricMat = new THREE.MeshLambertMaterial({ color: '#f08a9c', side: THREE.DoubleSide, transparent: true, opacity: 0.82, emissive: '#2a0810' });
  (function drapes() {
    var sides = [[[-PX, MZ + PX], [PX, MZ + PX], [0, 1]], [[PX, MZ + PX], [PX, MZ - PX], [1, 0]],
                 [[PX, MZ - PX], [-PX, MZ - PX], [0, -1]], [[-PX, MZ - PX], [-PX, MZ + PX], [-1, 0]]];
    var geos = [];
    sides.forEach(function (sd, si) {
      var g = new THREE.PlaneGeometry(1, 1, 18, 6), p = g.attributes.position;
      for (var k = 0; k < p.count; k++) {
        var s = p.getX(k) + 0.5, vv = 0.5 - p.getY(k);
        var drop = si === 0 ? 0.55 : 0.95;   // shallower at the front, to keep the fire in view
        var y = PT + 0.05 - vv * (0.2 + drop * 4 * s * (1 - s));
        var bil = vv * (0.08 + 0.22 * Math.sin(Math.PI * s));
        p.setXYZ(k, lerp(sd[0][0], sd[1][0], s) + sd[2][0] * (0.16 + bil), y, lerp(sd[0][1], sd[1][1], s) + sd[2][1] * (0.16 + bil));
      }
      g.computeVertexNormals();
      geos.push(g);
      // Garland strands hanging inside the swag, longer towards the pillars.
      var ns = small ? 9 : 14;
      for (var j = 1; j < ns; j++) {
        var t = j / ns, len = Math.round(lerp(10, 4, Math.sin(Math.PI * t)) * (si === 0 ? 0.8 : 1));
        G.strand(lerp(sd[0][0], sd[1][0], t) + sd[2][0] * 0.05, PT - 0.02, lerp(sd[0][1], sd[1][1], t) + sd[2][1] * 0.05, len, 0.11, 0.052, 4);
      }
    });
    corners.forEach(function (c) {
      var g = new THREE.PlaneGeometry(0.55, PT - PH - 0.1, 3, 12), p = g.attributes.position;
      for (var k = 0; k < p.count; k++) {
        var y = p.getY(k) + (PT - PH - 0.1) / 2, tie = Math.exp(-Math.pow((y - 2.1) / 0.5, 2));
        p.setX(k, p.getX(k) * (1 - 0.75 * tie) + Math.sin(y * 3) * 0.03);
        p.setY(k, y + PH + 0.05);
      }
      g.rotateY(Math.atan2(c[0], c[1]));
      g.translate(c[0] * (PX + 0.24), 0, MZ + c[1] * (PX + 0.24));
      g.computeVertexNormals();
      geos.push(g);
    });
    geos.forEach(function (g) { group.add(new THREE.Mesh(g, fabricMat)); });
  })();

  // Fairy lights on the mandap: along the beams and up the tent's ridges.
  (function mandapFairy() {
    var step = small ? 0.3 : 0.2;
    [[-PX, PX], [PX, PX], [PX, -PX], [-PX, -PX]].forEach(function (c, i, all) {
      var n = all[(i + 1) % 4];
      for (var t = 0; t < 1; t += step / (2 * PX)) fairy.add(lerp(c[0], n[0], t), PT + 0.25, MZ + lerp(c[1], n[1], t), 0.05 + t * 0.05, r(), 0, 0.9, cFairy[1]);
      for (t = 0; t < 1; t += step / 4) fairy.add(c[0] * (1 - t) * 1.03, PT + 0.24 + 1.35 * Math.pow(t, 1.1), MZ + c[1] * (1 - t) * 1.03, 0.1 + t * 0.08, r(), 0, 0.9, cFairy[0]);
    });
  })();

  // Strings of lights swung from the houses to the mandap and across the field.
  (function strings() {
    var step = small ? 0.55 : 0.38;
    function str(a, b, sag, at) {
      var n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / step);
      swag(a, b, sag, n, function (x, y, z, t) { fairy.add(x, y, z, at + t * 0.12, r(), 0, 1.0, cFairy[(r() * 4) | 0]); });
    }
    var tA = new V(-4.5 + 0.8, 6.9, -6.3).applyMatrix4(homeLamp[0].m), tB = new V(4.5 - 0.8, 6.9, -6.3).applyMatrix4(homeLamp[1].m);
    var fA = new V(4.6, 4.4, 0.4).applyMatrix4(homeLamp[0].m), fB = new V(-4.6, 4.4, 0.4).applyMatrix4(homeLamp[1].m);
    var apex = [0, PT + 1.55, MZ];
    str([tA.x, tA.y, tA.z], apex, 1.4, 0.35);
    str([tB.x, tB.y, tB.z], apex, 1.4, 0.38);
    str([fA.x, fA.y, fA.z], [-PX, PT + 0.2, MZ + PX], 1.1, 0.3);
    str([fB.x, fB.y, fB.z], [PX, PT + 0.2, MZ + PX], 1.1, 0.32);
    // Across the field, from house to house.
    [[-0.2, 0.4], [-2.6, 0.48], [-5.0, 0.55]].forEach(function (o, i) {
      var a = new V(4.4, 4.5 + i * 0.4, o[0]).applyMatrix4(homeLamp[0].m), b = new V(-4.4, 4.5 + i * 0.4, o[0]).applyMatrix4(homeLamp[1].m);
      str([a.x, a.y, a.z], [b.x, b.y, b.z], 1.6 + i * 0.3, o[1]);
    });
  })();

  // ── The marigold field ────────────────────────────────────────────────
  // Rows running away towards the mandap, a clear earthen aisle down the middle.
  var bushSpots = [];
  var xStep = small ? 0.82 : 0.6, zStep = small ? 0.42 : 0.3;
  for (var fx2 = -11; fx2 <= 11.01; fx2 += xStep) {
    if (Math.abs(fx2) < 1.5) continue;
    for (var fz = 24; fz > -21.5; fz -= zStep) {
      var bx = fx2 + (r() - 0.5) * 0.18, bz = fz + (r() - 0.5) * 0.14;
      if (Math.hypot(bx - HOME_A.x, bz - HOME_A.z) < 8.2 || Math.hypot(bx - HOME_B.x, bz - HOME_B.z) < 8.2) continue;
      if (Math.abs(bx) > 11 - (bz < -15 ? (bz + 15) * -0.4 : 0)) continue;
      bushSpots.push([bx, bz]);
    }
  }
  // Phones get a lighter shape for the thousands of blooms (20 faces, not 36).
  var bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: '#ffffff' }), bushSpots.length);
  var flowers = new THREE.InstancedMesh(small ? new THREE.IcosahedronGeometry(1, 0) : new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#3a1400' }), bushSpots.length * 3);
  var mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), sc = new V(), ps = new V(), eul = new THREE.Euler();
  var greens = ['#2f4a1e', '#365222', '#3c5a26', '#2a4219'].map(col), nf = 0;
  bushSpots.forEach(function (s, k) {
    var h = 0.34 + r() * 0.14;
    ps.set(s[0], h * 0.55, s[1]); q4.setFromEuler(eul.set(r() * 0.4, r() * 6, r() * 0.4)); sc.set(0.3 + r() * 0.08, h * 0.75, 0.3 + r() * 0.08);
    bushes.setMatrixAt(k, mtx.compose(ps, q4, sc));
    bushes.setColorAt(k, greens[k % 4]);
    var nfl = 1 + ((r() * 2.6) | 0);
    for (var j = 0; j < nfl; j++) {
      var rad = 0.085 + r() * 0.04;
      ps.set(s[0] + (r() - 0.5) * 0.36, h + 0.08 + r() * 0.12, s[1] + (r() - 0.5) * 0.28);
      q4.setFromEuler(eul.set(r() * 3, r() * 3, r() * 3)); sc.set(rad, rad * 0.75, rad);
      flowers.setMatrixAt(nf, mtx.compose(ps, q4, sc));
      flowers.setColorAt(nf, MARI[(r() * MARI.length) | 0]);
      nf++;
    }
  });
  flowers.count = nf;
  group.add(bushes, flowers);

  // Trees round the edges, dark against the dusk.
  var treeSpots = [];
  for (var t2 = 0; t2 < 400 && treeSpots.length < (small ? 40 : 64); t2++) {
    var tx = (r() - 0.5) * 110, tz = 8 - r() * 75;
    if (Math.abs(tx) < 16 && tz > -40) continue;
    if (Math.abs(tx) < 30 && tz > -24 && tz < -8 && Math.min(Math.hypot(tx - HOME_A.x, tz - HOME_A.z), Math.hypot(tx - HOME_B.x, tz - HOME_B.z)) < 9) continue;
    if (Math.abs(tx) < 9 && tz > -46) continue;
    treeSpots.push([tx, tz]);
  }
  // A few ashokas flank the mandap.
  var ashokaSpots = [[-8.5, MZ - 3], [-10.5, MZ - 6.5], [8.5, MZ - 3], [10.5, MZ - 6.5], [-6.5, MZ - 9], [6.5, MZ - 9]];
  var treeCols = ['#3a4a2a', '#2e3e22', '#44502c', '#34442a'].map(col);
  [broadleaf(), ashoka()].forEach(function (g, gi) {
    var list = gi ? ashokaSpots : treeSpots;
    var mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: gi ? THREE.DoubleSide : THREE.FrontSide }), Math.max(1, list.length));
    list.forEach(function (s2, k) {
      var scl = gi ? 0.75 + r() * 0.25 : 0.9 + r() * 0.8;
      ps.set(s2[0], groundH(s2[0], s2[1]) - 0.2, s2[1]); q4.setFromEuler(eul.set(0, r() * 6, 0)); sc.set(scl, scl * (0.9 + r() * 0.3), scl);
      mesh.setMatrixAt(k, mtx.compose(ps, q4, sc));
      mesh.setColorAt(k, treeCols[k % 4]);
    });
    mesh.count = list.length;
    group.add(mesh);
  });

  group.add(G.mesh(null, small));

  // ── Lamps ──────────────────────────────────────────────────────────────
  var lamps = new PointSet();   // aData.x: when it lights (< 0 always lit)
  // The two doorstep diyas, lit from the start.
  homeLamp.forEach(function (h) { lamps.add(h.door.x, h.door.y, h.door.z, -1, r(), 0, 1.25); });
  // In ch IV: two rings round the mandap, the aisle, and clusters at each door.
  function ringOf(n, rad, at0, at1) {
    for (var k = 0; k < n; k++) {
      var a = k / n * Math.PI * 2 + 0.05, x = Math.cos(a) * rad, z = MZ + Math.sin(a) * rad;
      if (Math.abs(x) < 1.9 && z > MZ) continue;   // leave the way in open
      lamps.add(x, 0.0, z, lerp(at0, at1, (Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)) / Math.PI + 1) / 2 * 0.5 + r() * 0.04), r(), 0, 1);
    }
  }
  ringOf(small ? 40 : 60, 5.6, 0.0, 0.4);
  ringOf(small ? 46 : 70, 6.5, 0.08, 0.48);
  for (var az = MZ + 4.6; az < 23; az += small ? 1.25 : 0.9) {
    [-1.3, 1.3].forEach(function (x) { lamps.add(x, 0, az + (x > 0 ? 0.45 : 0), 0.2 + (az - MZ) / 52 * 0.5, r(), 0, 1); });
  }
  homeLamp.forEach(function (h) {
    for (var k = 0; k < (small ? 8 : 12); k++) {
      var a = k / (small ? 8 : 12) * Math.PI * 2, c = h.door.clone().addScaledVector(h.out, 2.6);
      lamps.add(c.x + Math.cos(a) * 1.35, 0, c.z + Math.sin(a) * 1.35, 0.3 + k * 0.012, r(), 0, 1);
    }
  });
  var NL = lamps.p.length / 3;
  var bowls = new THREE.InstancedMesh(diyaGeometry(small ? 8 : 12), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#1a0a04' }), NL);
  for (var li = 0; li < NL; li++) bowls.setMatrixAt(li, mtx.makeTranslation(lamps.p[li * 3], lamps.p[li * 3 + 1], lamps.p[li * 3 + 2]));
  group.add(bowls);
  var LAMP_POS =
    'vec4 place(){ float lit = aData.x < 0.0 ? 1.0 : smoothstep(aData.x, aData.x + 0.06, uFest);\n' +
    ' vCol = vec3(1.0, 0.55, 0.2); return vec4(position + vec3(0.0, 0.16, 0.0), lit); }\n';
  addPoints(lamps, LAMP_POS, [[HALO_F, 0.8, 2.5, 1, false, 9], [FLAME_F, 0.2, 1.6, 2]]);

  // Fairy lights: on in ch IV, each at its own moment, twinkling.
  var FAIRY_POS =
    'vec4 place(){ float lit = smoothstep(aData.x, aData.x + 0.04, uFest);\n' +
    ' float tw = 0.7 + 0.3 * sin(uTime * (1.3 + aData.y * 2.0) + aData.y * 50.0);\n' +
    ' return vec4(position, lit * tw); }\n';
  addPoints(fairy, FAIRY_POS, [[GLOW_F, 0.2, 1.6, 2]]);

  // Window glow halos, warmer as night falls.
  var winGlow = new PointSet();
  winSpots.forEach(function (sp) { winGlow.add(sp[0], sp[1], sp[2], 0, r(), 0, sp[3], cWin); });
  addPoints(winGlow, 'vec4 place(){ return vec4(position, 0.12 + uNight * 0.3 + uFest * 0.2); }\n', [[HALO_F, 1.2, 2.0, 1]]);

  // ── The two lights, their trails and the fireflies ─────────────────────
  var curves = homeLamp.map(function (h, i) {
    var s = i ? 1 : -1, d = h.door;
    var pts = [
      [d.x, d.y + 0.25, d.z],
      [d.x + h.out.x * 1.6, 0.95, d.z + h.out.z * 1.6],
      i ? [7.6, 1.25, -6.8] : [-7.2, 1.3, -10.2],
      i ? [5.2, 1.1, -10.8] : [-5.4, 1.05, -5.6],
      i ? [2.8, 1.3, -6.0] : [-2.9, 1.25, -9.2],
      [MEET[0] + s * 0.65, MEET[1], MEET[2]]
    ].map(function (p) { return new V(p[0], p[1], p[2]); });
    return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  });
  var trail = new PointSet(), tv = new V();
  curves.forEach(function (c, i) {
    var n = small ? 150 : 240;
    for (var k = 0; k <= n; k++) {
      c.getPointAt(k / n, tv);
      trail.add(tv.x + (r() - 0.5) * 0.08, tv.y + (r() - 0.5) * 0.08, tv.z + (r() - 0.5) * 0.08, k / n, r(), i, 0.6 + r() * 0.6, col(i ? '#ffc070' : '#ffb060'));
    }
  });
  addPoints(trail,
    'vec4 place(){ float behind = uWalk - aData.x;\n' +
    ' float a = step(0.0, behind) * step(0.001, uWalk) * (0.22 + 0.78 * exp(-behind * 7.0));\n' +
    ' vec3 p = position + vec3(0.0, sin(uTime * 1.4 + aData.y * 30.0) * 0.04, 0.0);\n' +
    ' return vec4(p, a * (1.0 - 0.75 * uCarry)); }\n',
    [[GLOW_F, 0.08, 1.5, 2]]);

  // The lights themselves: halo and flame at uA and uB.
  var heads = new PointSet();
  heads.add(0, 0, 0, 0, 0.3, 0, 1, col('#ffb060')).add(0, 0, 0, 1, 0.7, 0, 1, col('#ffb060'));
  var HEAD_POS = 'vec4 place(){ vec3 p = aData.x < 0.5 ? uA : uB; return vec4(p, uHead); }\n';
  addPoints(heads, HEAD_POS, [[HALO_F, 2.2, 3.0, 3], [FLAME_F, 0.32, 2.0, 4]]);

  var unity = new PointSet();
  unity.add(0, 0, 0, 0, 0.5, 0, 1, col('#ffc070'));
  addPoints(unity, 'vec4 place(){ return vec4(uG, 0.55 * smoothstep(0.3, 1.0, uGather) * (1.0 - smoothstep(0.75, 1.0, uCarry))); }\n', [[HALO_F, 2.4, 3.0, 3]]);

  // Fireflies: a conversation between the two lights, then gathered round one.
  var flies = new PointSet(), NF = small ? 130 : 220;
  for (var k2 = 0; k2 < NF; k2++) flies.add(0, 0, 0, k2 % 2, r(), r(), 0.7 + r() * 0.6, col(k2 % 3 ? '#ffd27a' : '#f4f0a0'));
  addPoints(flies,
    'vec4 place(){ float s = aData.y;\n' +
    ' float ph = fract(uTime * (0.06 + s * 0.05) + aData.z);\n' +
    ' float e = ph * ph * (3.0 - 2.0 * ph);\n' +
    ' vec3 a = aData.x < 0.5 ? uA : uB; vec3 b = aData.x < 0.5 ? uB : uA;\n' +
    ' float arc = sin(ph * 3.14159);\n' +
    ' vec3 p = mix(a, b, e) + vec3(sin(uTime * 1.3 + s * 40.0) * 0.1, arc * (0.35 + s * 0.6), (s - 0.5) * 1.6 * arc + cos(uTime * 1.1 + s * 30.0) * 0.12);\n' +
    ' float an = uTime * (0.35 + s * 0.5) + s * 60.0, rad = mix(1.7, 0.45, uGather) * (0.55 + aData.z * 0.7);\n' +
    ' vec3 orb = uG + vec3(cos(an) * rad, sin(uTime * 0.6 + s * 20.0) * 0.35 * rad + 0.1, sin(an) * rad);\n' +
    ' p = mix(p, orb, smoothstep(0.0, 1.0, uGather));\n' +
    ' float tw = 0.55 + 0.45 * sin(uTime * 3.0 + s * 50.0);\n' +
    ' return vec4(p, uTalk * tw * (1.0 - smoothstep(0.6, 1.0, uCarry))); }\n',
    [[GLOW_F, 0.1, 1.8, 3]]);

  // A few fireflies loose over the field all night.
  var loose = new PointSet();
  for (k2 = 0; k2 < (small ? 80 : 150); k2++) loose.add((r() - 0.5) * 30, 0.5 + r() * 2.2, 6 - r() * 34, 0, r(), 0, 0.8 + r() * 0.5, col('#e8f08a'));
  addPoints(loose,
    'vec4 place(){ float s = aData.y;\n' +
    ' vec3 p = position + vec3(sin(uTime * 0.3 + s * 30.0) * 0.9, sin(uTime * 0.5 + s * 17.0) * 0.35, cos(uTime * 0.27 + s * 23.0) * 0.9);\n' +
    ' float tw = pow(0.5 + 0.5 * sin(uTime * (1.0 + s) * 1.6 + s * 40.0), 3.0);\n' +
    ' return vec4(p, smoothstep(0.45, 1.0, uNight) * tw * (1.0 - uFest * 0.5)); }\n',
    [[GLOW_F, 0.09, 1.6, 2]]);

  // ── Fire ───────────────────────────────────────────────────────────────
  var CS = '\n #include <colorspace_fragment>\n';
  var FIRE_V = 'uniform float uAmt; uniform vec2 uSize; varying vec2 vUv;\n' +
    'void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);\n' +
    ' mv.xy += position.xy * uSize * (0.3 + 0.7 * uAmt); gl_Position = projectionMatrix * mv; }';
  var FIRE_F = 'uniform float uTime; uniform float uAmt; uniform float uSeed; varying vec2 vUv;\n' +
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);\n' +
    ' return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }\n' +
    'float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.02 + 3.1; a *= 0.5; } return v; }\n' +
    'void main(){ vec2 p = vec2(vUv.x * 2.0 - 1.0, vUv.y); float t = uTime * 1.5;\n' +
    ' float n = fbm(vec2(p.x * 2.2 + uSeed * 7.0, p.y * 2.6 - t));\n' +
    ' float n2 = fbm(vec2(p.x * 4.0 - uSeed * 3.0, p.y * 5.0 - t * 1.7));\n' +
    ' float x = p.x + (n - 0.5) * 0.6 * p.y;\n' +
    ' float w = mix(0.62, 0.04, pow(p.y, 0.8));\n' +
    ' float body = 1.0 - smoothstep(w * 0.5, w, abs(x));\n' +
    ' float f = body * (1.0 - smoothstep(0.3 + n2 * 0.5, 0.95, p.y)) * smoothstep(0.0, 0.07, p.y);\n' +
    ' float core = smoothstep(0.3, 0.95, f) * (1.0 - smoothstep(0.05, 0.55, p.y));\n' +
    ' vec3 c = mix(vec3(0.85, 0.16, 0.03), vec3(1.0, 0.55, 0.1), smoothstep(0.0, 0.6, f));\n' +
    ' c = mix(c, vec3(1.0, 0.86, 0.55), core * 0.8);\n' +
    ' float a = f * uAmt * 0.85; if (a < 0.01) discard;\n' +
    ' gl_FragColor = vec4(c, a);' + CS + '}';
  var fireGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  [[1.25, 1.7, 0, 0.1], [0.95, 1.45, -0.14, 0.55], [0.8, 2.0, 0.12, 0.9]].forEach(function (f, i) {
    var m = new THREE.Mesh(fireGeo, new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uAmt: U.uFire, uSeed: { value: f[3] }, uSize: { value: new THREE.Vector2(f[0], f[1]) } },
      vertexShader: FIRE_V, fragmentShader: FIRE_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    m.position.set(FIRE.x + f[2], FIRE.y - 0.02, FIRE.z + (i - 1) * 0.08);
    m.frustumCulled = false; m.renderOrder = 5;
    group.add(m);
  });
  // Its glow and embers.
  var fireGlow = new PointSet();
  fireGlow.add(FIRE.x, FIRE.y + 0.55, FIRE.z, 0, 0.5, 0, 1, col('#ff8a3a'));
  addPoints(fireGlow, 'vec4 place(){ return vec4(position, uFire * (0.8 + 0.2 * sin(uTime * 9.0) * sin(uTime * 5.3))); }\n', [[HALO_F, 5.5, 4.0, 4]]);
  var embers = new PointSet();
  for (k2 = 0; k2 < (small ? 50 : 90); k2++) embers.add(FIRE.x, FIRE.y, FIRE.z, r(), r(), r(), 0.6 + r() * 0.6, col('#ffa040'));
  addPoints(embers,
    'vec4 place(){ float f = fract(uTime * (0.25 + aData.y * 0.25) + aData.x);\n' +
    ' vec3 p = position + vec3(sin(f * 8.0 + aData.y * 40.0) * 0.25 * f + (aData.z - 0.5) * 0.4, 0.3 + f * 3.4, cos(f * 7.0 + aData.y * 30.0) * 0.25 * f);\n' +
    ' return vec4(p, uFire * (1.0 - f) * smoothstep(0.0, 0.1, f)); }\n',
    [[GLOW_F, 0.06, 1.4, 5]]);

  // ── Seven pheras: a golden thread looping round the fire ──────────────
  var thread = new PointSet(), NT = small ? 1100 : 1800;
  for (k2 = 0; k2 < NT; k2++) thread.add(FIRE.x, FIRE.y, FIRE.z, k2 / NT, r(), 0, 0.8 + r() * 0.4, col('#ffcf6a'));
  var THREAD_POS =
    'vec4 place(){ float s = aData.x, an = s * 7.0 * 6.2832 + 1.5708;\n' +
    ' float rad = 1.6 + 0.04 * sin(s * 90.0 + uTime);\n' +
    ' vec3 p = position + vec3(cos(an) * rad, 0.35 + s * 0.85 + sin(an * 2.0) * 0.03, sin(an) * rad);\n' +
    ' float behind = uPhera - s;\n' +
    ' float a = step(0.0, behind) * step(0.0005, uPhera) * (0.5 + 0.5 * exp(-behind * 30.0));\n' +
    ' vCol = aCol * (1.0 + 2.5 * exp(-behind * 160.0));\n' +
    ' return vec4(p, a * (1.0 - uFest * 0.35)); }\n';
  addPoints(thread, THREAD_POS, [[GLOW_F, 0.07, 1.6, 6]]);
  var tip = new PointSet();
  tip.add(FIRE.x, FIRE.y, FIRE.z, 0, 0.5, 0, 1, col('#ffe0a0'));
  addPoints(tip,
    'vec4 place(){ float s = uPhera, an = s * 7.0 * 6.2832 + 1.5708;\n' +
    ' vec3 p = position + vec3(cos(an) * 1.6, 0.35 + s * 0.85, sin(an) * 1.6);\n' +
    ' return vec4(p, step(0.002, s) * (1.0 - step(0.999, s))); }\n',
    [[HALO_F, 0.8, 3.0, 6]]);

  // ── Petals: drifting at dusk, then showering on the mandap ─────────────
  var petalCols = ['#ff8c00', '#ffb21a', '#e8590c', '#c21e3a', '#f06a8a', '#ffd04a', '#fff0d8'].map(col);
  var drift = new PointSet();
  for (k2 = 0; k2 < (small ? 160 : 280); k2++) drift.add((r() - 0.5) * 30, r() * 14, 26 - r() * 44, 0, r(), 0, 0.8 + r() * 0.5, petalCols[k2 % 5]);
  addPoints(drift,
    'vec4 place(){ vec3 B = vec3(30.0, 14.0, 44.0), O = vec3(-15.0, 0.0, -18.0); float s = aData.y;\n' +
    ' vec3 p = position + vec3(uTime * 0.5 + sin(uTime * 0.7 + s * 20.0) * 0.6, -uTime * (0.3 + s * 0.3), sin(uTime * 0.45 + s * 9.0) * 0.6);\n' +
    ' p = O + mod(p - O, B); vCol = aCol * uLit;\n' +
    ' return vec4(p, uDrift); }\n',
    [[PETAL_F, 0.13, 1.5, 7, true]]);
  var shower = new PointSet();
  for (k2 = 0; k2 < (small ? 520 : 950); k2++) shower.add(0, 0, MZ, r(), r(), r(), 0.8 + r() * 0.5, petalCols[k2 % petalCols.length]);
  addPoints(shower,
    'vec4 place(){ float s = aData.y, Ht = 9.5;\n' +
    ' float f = fract(aData.x + uTime * (0.045 + s * 0.035));\n' +
    ' float an = aData.z * 6.2832 + f * 1.4, rad = mix(1.2 + aData.z * 7.0, 0.8 + aData.z * 3.0, f);\n' +
    ' vec3 p = position + vec3(cos(an) * rad + sin(uTime * 1.3 + s * 20.0) * 0.3, Ht - f * Ht, sin(an) * rad + cos(uTime * 1.1 + s * 15.0) * 0.3);\n' +
    ' vCol = aCol * uLit;\n' +
    ' return vec4(p, uPetal * smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(0.92, 1.0, f))); }\n',
    [[PETAL_F, 0.11, 1.5, 7, true]]);

  // ── Sky lanterns ───────────────────────────────────────────────────────
  var lant = new PointSet();
  for (k2 = 0; k2 < (small ? 44 : 80); k2++) {
    var lx = (r() - 0.5) * 34, lz = 4 - r() * 40;
    lant.add(lx, 1 + r() * 5, lz, r() * 0.35, r(), 0, 0.8 + r() * 0.5);
  }
  addPoints(lant,
    'vec4 place(){ float s = aData.y, t = clamp((uLant - aData.x) / 0.65, 0.0, 1.0);\n' +
    ' float up = t * (16.0 + s * 34.0) + uTime * 0.12 * step(0.001, t);\n' +
    ' vec3 p = position + vec3(sin(uTime * 0.25 + s * 30.0) * 0.5 + up * 0.12 * (s - 0.3), up + sin(uTime * 0.8 + s * 10.0) * 0.12, -up * 0.22 * s);\n' +
    ' float fl = 0.85 + 0.15 * sin(uTime * 7.0 + s * 40.0);\n' +
    ' return vec4(p, smoothstep(0.0, 0.04, t) * fl); }\n',
    [[LANTERN_F, 0.75, 2.6, 3]]);

  // ── Fireworks: a few gentle bursts high over the mandap ────────────────
  var fw = new PointSet(), FWB = small ? 5 : 7, FWN = small ? 120 : 200;
  var fwCols = ['#ffd27a', '#ff8fb0', '#ffb04a', '#fff1cc', '#ff6a7a', '#ffcf5a', '#ffa6d0'].map(col);
  for (var bI = 0; bI < FWB; bI++) {
    for (k2 = 0; k2 < FWN; k2++) {
      var u1 = r() * 2 - 1, th = r() * Math.PI * 2, sq = Math.sqrt(1 - u1 * u1);
      fw.add(sq * Math.cos(th), u1, sq * Math.sin(th), bI, r(), 0.75 + r() * 0.25, 1, fwCols[bI % fwCols.length]);
    }
  }
  addPoints(fw,
    'vec4 place(){ float bid = aData.x, P = 5.6;\n' +
    ' float tt = uTime + bid * 1.43 + 0.7, cyc = floor(tt / P), t = tt - cyc * P - 0.3;\n' +
    ' float hs = h1(cyc * 7.13 + bid * 3.1);\n' +
    ' vec3 c = vec3(mix(-24.0, 24.0, h1(cyc * 1.7 + bid * 9.2)), 17.0 + 11.0 * hs, -42.0 - 24.0 * h1(cyc * 3.3 + bid * 1.9));\n' +
    ' float R = (5.5 + 3.0 * hs) * aData.z;\n' +
    ' vec3 p = c + position * R * (1.0 - exp(-max(t, 0.0) * 2.3)) + vec3(0.0, -0.6 * t * t, 0.0);\n' +
    ' float life = step(0.0, t) * (1.0 - smoothstep(1.1, 3.0, t));\n' +
    ' float sp = t > 1.5 ? 0.5 + 0.5 * sin(uTime * 28.0 + aData.y * 80.0) : 1.0;\n' +
    ' vCol = aCol * (1.0 + 2.0 * exp(-max(t, 0.0) * 6.0));\n' +
    ' return vec4(p, life * sp * uFw); }\n',
    [[GLOW_F, 0.34, 1.8, 3]]);

  // ── Light pools on the ground ──────────────────────────────────────────
  var poolTex = softSprite('rgba(255,170,90,1)', 'rgba(255,120,40,0)');
  var mandapPool = pool(group, poolTex, 0, 0, MZ, 18), homePools = homeLamp.map(function (h) { return pool(group, poolTex, h.door.x + h.out.x * 2.2, 0, h.door.z + h.out.z * 2.2, 11); });
  var doorPools = homeLamp.map(function (h) { return pool(group, poolTex, h.door.x, 0, h.door.z + 0.1, 2.6); });

  // ── Per frame ──────────────────────────────────────────────────────────
  var headA = new V(), headB = new V(), gPos = new V(), mid = new V(), meet = new V(MEET[0], MEET[1], MEET[2]);
  var carryMid = new V(0, 4.2, -18);
  var cFest = col('#ffb070'), tFest1 = col('#7a3a3a'), tFest2 = col('#6a2a1a');
  var LD = homeLamp.map(function (h) { return h.door.clone().setY(h.door.y + 0.45); });
  var LFp = FIRE.clone().setY(FIRE.y + 0.8);

  function frame(f) {
    var row = sample(f.u), time = f.time, reduce = f.reduce, P = f.P, w = f.w;
    var night = row[C.night], walk = row[C.walk], talk = row[C.talk], gather = row[C.gather], carry = row[C.carry];
    var fest = row[C.fest];

    // The lamps warm the sky as they come on (weighted by how present the story is).
    if (fest > 0 && w > 0) {
      P.hor.lerp(tFest1, fest * 0.35 * w); P.glow.lerp(tFest2, fest * 0.3 * w);
      P.hs.lerp(cFest, fest * 0.25 * w); P.hi += fest * 0.2 * w;
    }

    // The two lights: out of the diyas, through the flowers, close, then one.
    curves[0].getPointAt(walk, headA);
    curves[1].getPointAt(walk, headB);
    var bob = reduce ? 0 : 1;
    headA.y += Math.sin(time * 1.6) * 0.05 * bob; headB.y += Math.sin(time * 1.6 + 0.6) * 0.05 * bob;
    mid.copy(meet);
    headA.lerp(mid, gather); headB.lerp(mid, gather);
    // Carried along a high arc to the fire.
    if (carry > 0) {
      var c1 = carry, a1 = (1 - c1) * (1 - c1), b1 = 2 * c1 * (1 - c1), d1 = c1 * c1;
      gPos.set(meet.x * a1 + carryMid.x * b1 + FIRE.x * d1, meet.y * a1 + carryMid.y * b1 + (FIRE.y + 0.5) * d1, meet.z * a1 + carryMid.z * b1 + FIRE.z * d1);
      headA.copy(gPos); headB.copy(gPos);
    } else gPos.copy(mid);
    U.uA.value.copy(headA); U.uB.value.copy(headB); U.uG.value.copy(gPos);
    var headOn = smooth(0, 0.04, walk) * (1 - smooth(0.82, 1, carry));
    U.uHead.value = headOn;
    var flick = reduce ? 1 : 0.85 + 0.15 * Math.sin(time * 11) * Math.sin(time * 6.7);
    // Point lights: the doorstep diyas, the two lights (in ch IV, the lit houses), the fire.
    var lampI = headOn * 4.5 * flick * (gather > 0.5 ? lerp(1, 0.7, gather) : 1);
    if (fest > 0) {
      var hf = fest * 26 * (0.95 + 0.05 * flick);
      f.lamp(homeLamp[0].front.x, homeLamp[0].front.y, homeLamp[0].front.z, '#ffa858', hf, 22, 2);
      f.lamp(homeLamp[1].front.x, homeLamp[1].front.y, homeLamp[1].front.z, '#ffa858', hf, 22, 2);
    } else {
      f.lamp(headA.x, headA.y, headA.z, '#ffa858', lampI, 9, 2);
      f.lamp(headB.x, headB.y, headB.z, '#ffa858', lampI, 9, 2);
    }
    for (var i = 0; i < LD.length; i++) f.lamp(LD[i].x, LD[i].y, LD[i].z, '#ff9a48', 2.6 * flick * (1 - fest * 0.3), 7, 2);
    var fire = smooth(0.75, 1, carry);
    f.lamp(LFp.x, LFp.y, LFp.z, '#ff8a3a', fire * 30 * (reduce ? 1 : 0.85 + 0.15 * Math.sin(time * 9) * Math.sin(time * 5.3)), 26, 1.7);

    // Lamps, petals, thread, lanterns, fireworks.
    U.uTime.value = time;
    U.uScale.value = f.pxScale;
    U.uWalk.value = walk; U.uTalk.value = talk; U.uGather.value = gather; U.uCarry.value = carry;
    U.uFire.value = fire; U.uPetal.value = row[C.petal]; U.uPhera.value = row[C.phera];
    U.uFest.value = fest; U.uLant.value = row[C.lant]; U.uFw.value = row[C.fw]; U.uDrift.value = row[C.drift];
    U.uNight.value = night;
    U.uLit.value = lerp(1.0, 0.45, night) + fire * 0.45 + fest * 0.2;
    U.uFogD.value = f.fogD * 0.49;
    glowMat.color.setScalar(lerp(0.45, 1.0, smooth(0, 0.8, night)) + fest * 0.25);

    mandapPool.material.opacity = fire * 0.35 + fest * 0.45;
    for (i = 0; i < 2; i++) { homePools[i].material.opacity = fest * 0.5; doorPools[i].material.opacity = 0.35 + 0.25 * night; }
  }

  return { group: group, frame: frame };
}

// ═════════════════════════════════════════════════════════════════════════
// The page: the chapter track, its text, and the stop
// ═════════════════════════════════════════════════════════════════════════
function readChapters(section) {
  return Array.prototype.map.call(section.querySelectorAll('.stop .chapter'), function (c) {
    var label = c.querySelector('.chap-label'), title = c.querySelector('h4'), text = c.querySelector('p');
    return { label: label ? label.textContent.trim() : '', title: title ? title.textContent.trim() : '', text: text ? text.textContent.trim() : '' };
  });
}

function el(tag, cls, html) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

function buildDom(chapters) {
  var track = el('div', 'si');
  track.style.setProperty('--si-units', (TOTAL + 1).toFixed(2));
  var stage = el('div', 'si-stage');
  var vignette = el('div', 'si-vignette');
  vignette.setAttribute('aria-hidden', 'true');
  var text = el('div', 'si-text');
  text.setAttribute('aria-hidden', 'true');
  var rule = '<div class="si-rule"><i></i><b>&#10022;</b><i></i></div>';

  var intro = el('div', 'si-beat si-intro',
    '<p class="si-kicker">Our Story</p><p class="si-lead">told in lamplight</p>' +
    '<p class="si-cue"><span>Scroll</span><i></i></p>');
  text.appendChild(intro);
  var panels = chapters.map(function (c) {
    var p = el('div', 'si-beat si-panel',
      '<p class="si-label">' + esc(c.label) + '</p><p class="si-title">' + esc(c.title) + '</p>' + rule +
      '<p class="si-line">' + esc(c.text) + '</p>');
    text.appendChild(p);
    return p;
  });
  var outro = el('div', 'si-beat si-outro',
    '<p class="si-label">And so it begins</p><p class="si-names">Deeksha <span class="amp">&amp;</span> Harshit</p>' + rule +
    '<p class="si-date">10 &middot; March &middot; 2027</p>');
  text.appendChild(outro);

  var skip = el('button', 'si-skip', 'Skip story <span aria-hidden="true">&darr;</span>');
  skip.type = 'button';
  skip.setAttribute('aria-label', 'Skip the story and go to the celebrations');
  if (mq('(pointer: fine)')) skip.style.cursor = 'none';   // the site draws its own cursor

  [vignette, text, skip].forEach(function (n) { stage.appendChild(n); });
  track.appendChild(stage);
  return { track: track, stage: stage, vignette: vignette, intro: intro, panels: panels, outro: outro, skip: skip };
}

// Write a style only when it changes, to keep layout work down.
function setter() {
  var last = new Map();
  return function (node, prop, value) {
    var k = last.get(node) || {};
    if (k[prop] === value) return;
    k[prop] = value; last.set(node, k);
    if (prop.charAt(0) === '-') node.style.setProperty(prop, value); else node.style[prop] = value;
  };
}

// The stop, its DOM and its scene. Returns null if the section isn't there.
export function mount(W) {
  var section = document.querySelector('.story-sec');
  if (!section) return null;
  var chapters = readChapters(section);
  if (chapters.length !== 4 || chapters.some(function (c) { return !c.title; })) return null;
  var root = document.documentElement, reduce = W.reduce;
  var dom = buildDom(chapters);

  // Mount after the header and portrait, keeping the reader's place if the
  // track lands above them (e.g. a restored scroll position).
  var container = section.querySelector('.container');
  var anchor = section.nextElementSibling || section;
  var before = anchor.getBoundingClientRect().top;
  root.style.overflowAnchor = 'none';
  container.parentNode.insertBefore(dom.track, container.nextSibling);
  section.classList.add('si-on');
  var after = anchor.getBoundingClientRect().top;
  if (before < 0 && after !== before) window.scrollBy({ top: after - before, left: 0, behavior: 'instant' });
  requestAnimationFrame(function () { root.style.overflowAnchor = ''; });

  var trackTop = 0, sh = 1;
  var stop = {
    name: 'story', places: ['story'], arc: 8, mist: 0.5,
    range: function (vh) {
      trackTop = dom.track.getBoundingClientRect().top + window.scrollY;
      sh = dom.stage.clientHeight || vh;
      return [trackTop - sh, trackTop + TOTAL * sh];
    },
    local: function (y) { return clamp((y - trackTop) / sh, -1, TOTAL); },
    pose: pose
  };

  var set = setter();
  function beat(node, a, b, c, d, uu) {
    var fin = smooth(a, b, uu), fout = smooth(c, d, uu), o = fin * (1 - fout);
    set(node, 'opacity', o.toFixed(3));
    set(node, 'visibility', o > 0.002 ? 'visible' : 'hidden');
    set(node, '--y', ((1 - fin) * 26 - fout * 26).toFixed(1) + 'px');
    return o;
  }
  function updateText(ys) {
    // The same eased scroll the camera follows, so words and scene move together.
    var uu = clamp((ys - trackTop) / sh, -1.5, TOTAL + 1);
    set(dom.vignette, 'opacity', (smooth(-0.45, 0.05, uu) * (1 - smooth(TOTAL - 0.1, TOTAL + 0.6, uu))).toFixed(3));
    beat(dom.intro, 0.06, 0.24, S(0) - 0.16, S(0) + 0.02, uu);
    for (var i = 0; i < dom.panels.length; i++) beat(dom.panels[i], S(i), S(i) + FADE, E(i) - FADE, E(i), uu);
    var oIn = smooth(E(3) + 0.02, E(3) + 0.28, uu);
    set(dom.outro, 'opacity', oIn.toFixed(3));
    set(dom.outro, 'visibility', oIn > 0.002 ? 'visible' : 'hidden');
    set(dom.outro, '--y', ((1 - oIn) * 26).toFixed(1) + 'px');
    dom.skip.classList.toggle('show', uu > -0.35 && uu < TOTAL - 0.5);
  }

  dom.skip.addEventListener('click', function () {
    var next = document.querySelector('.ev-sec') || dom.track.parentNode.nextElementSibling;
    var top = next ? next.getBoundingClientRect().top + window.scrollY - 12 : dom.track.getBoundingClientRect().bottom + window.scrollY;
    window.scrollTo({ top: top, behavior: reduce ? 'instant' : 'smooth' });
  });

  var built = false;
  // The scene itself is heavy: build it when the browser is idle (or at
  // once if the camera is already on its way).
  function buildScene() {
    return new Promise(function (resolve) {
      var go = function () {
        var view = createScene(W);
        fitScreen(W.f.aspect);
        built = true;
        resolve({
          group: view.group, stop: stop,
          frame: function (f) { updateText(f.ys); view.frame(f); },
          resize: function (w, h, aspect) { fitScreen(aspect); },
          unmount: function () {
            var r = dom.track.getBoundingClientRect(), inside = r.top < 0 && r.bottom > window.innerHeight * 0.5;
            dom.track.remove();
            section.classList.remove('si-on');
            return inside ? section.querySelector('.story-body') : null;
          }
        });
      };
      if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 1200 }); else setTimeout(go, 60);
    });
  }
  // If the world fails before the scene is built, give the list back too.
  W.onFail(function () { if (!built && dom.track.parentNode) { dom.track.remove(); section.classList.remove('si-on'); } });
  return { stop: stop, build: buildScene, fit: fitScreen };
}
