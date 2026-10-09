/*
 * Our Story, told as a scroll-driven three.js scene.
 *
 * Progressive enhancement over the plain chapter list in section.story-sec.
 * At start-up this checks for WebGL and prefers-reduced-data and, if they
 * allow it, waits until the section is about 1.5 screens away before it
 * imports three.js (through ./kit.js), so the intro, the door video and the
 * countdown are never slowed. It then reads the four chapters from the page
 * and builds a tall scroll track after the header and portrait: a sticky
 * full-screen stage with the canvas, one panel per chapter, a short intro
 * beat and an outro on the names. The chapter list is hidden (kept for
 * screen readers) only once the scene has started; if anything fails it
 * simply stays.
 *
 * The approach to the track (the screen before it sticks) lifts a cream
 * veil off the dusk, and the last half screen brings it back, so the scene
 * opens out of the invitation and closes back into it.
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
 * Keyframes are pinned to the panels by keys(); columns are named in COLS.
 */

var section = document.querySelector('.story-sec');
var root = document.documentElement;
function mq(q) { return !!(window.matchMedia && window.matchMedia(q).matches); }
var reduceMotion = mq('(prefers-reduced-motion: reduce)');
var reduceData = mq('(prefers-reduced-data: reduce)');

var THREE = null;   // set once kit.js (and three.js) has loaded

// ── Small helpers ───────────────────────────────────────────────────────
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function hasWebGL() {
  try {
    var c = document.createElement('canvas');
    var gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    var lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return true;
  } catch (e) { return false; }
}

// ── Timeline, in screens of scroll ──────────────────────────────────────
// u runs from -1 (the track's top at the bottom of the screen) through 0
// (the stage sticks) to TOTAL (it lets go). Each chapter fades in over FADE,
// reads for READ and fades out over FADE.
var INTRO = 0.6, FADE = 0.2, READ = 0.45, OUTRO = 0.85;
var PANEL = FADE * 2 + READ;
function S(i) { return INTRO + i * PANEL; }
function E(i) { return S(i) + PANEL; }
var TOTAL = S(4) + OUTRO;

var COLS = ['px', 'py', 'pz', 'tx', 'ty', 'tz', 'fit', 'night', 'walk', 'talk', 'gather', 'carry',
            'petal', 'phera', 'fest', 'lant', 'fw', 'drift', 'lift', 'liftP'];
var C = {};
COLS.forEach(function (n, i) { C[n] = i; });

function keys() {
  var F = FADE, R = READ;
  // lift / liftP raise the look target on landscape / portrait screens, so
  // the scene sits under the words rather than behind them.
  //  unit             px  py    pz     tx  ty    tz    fit  night walk talk gath carry petal phera fest lant  fw  drift lift liftP
  return [
    [-1,               0, 17,   46,    0, 3.0, -12,   1,   0,    0,   0,   0,   0,    0,   0,    0,   0,    0,  1,   1.2, 0],
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

// ── World layout (metres) ───────────────────────────────────────────────
var HOME_A = { x: -13, z: -17, rot: 0.42 };
var HOME_B = { x: 13, z: -17, rot: -0.42 };
var MZ = -29;                    // mandap centre (x = 0)
var MEET = [0, 1.15, -7.4];      // where the two lights meet

// ═════════════════════════════════════════════════════════════════════════
// The scene
// ═════════════════════════════════════════════════════════════════════════
function createScene(K, canvas, env) {
  var small = env.small, r = rng(310);
  var gl = K.makeRenderer(canvas, { clear: '#2a1830', exposure: 1.0 });
  var world = new THREE.Scene();
  world.fog = new THREE.FogExp2('#c07a6a', 0.0085);
  var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1500);
  var V = THREE.Vector3;
  function col(h) { return new THREE.Color(h); }

  // ── Shared point-field shader pieces ─────────────────────────────────
  // Every glow in the scene is a shader point (lamps, fairy lights,
  // fireflies, lanterns, fireworks, petals). Each field supplies place(),
  // returning a world position and how visible it is; everything moves on
  // the GPU from these uniforms, so nothing is allocated per frame.
  var U = {
    uTime: { value: 0 }, uScale: { value: 600 }, uFogD: { value: 0.006 },
    uWalk: { value: 0 }, uTalk: { value: 0 }, uGather: { value: 0 }, uCarry: { value: 0 },
    uFire: { value: 0 }, uPetal: { value: 0 }, uPhera: { value: 0 }, uFest: { value: 0 },
    uLant: { value: 0 }, uFw: { value: 0 }, uDrift: { value: 0 }, uNight: { value: 0 },
    uLit: { value: 1 }, uHead: { value: 0 },
    uA: { value: new V() }, uB: { value: new V() }, uG: { value: new V() }
  };
  var HEAD =
    'uniform float uTime, uScale, uFogD, uWalk, uTalk, uGather, uCarry, uFire, uPetal, uPhera, uFest, uLant, uFw, uDrift, uNight, uLit, uHead;\n' +
    'uniform vec3 uA, uB, uG;\n' +
    'attribute vec4 aData; attribute vec3 aCol;\n' +
    'varying vec3 vCol; varying float vA; varying float vPx; varying float vSeed;\n' +
    'float h1(float n){ return fract(sin(n) * 43758.5453123); }\n';
  var VMAIN =
    'void main(){\n' +
    ' vCol = aCol; vSeed = aData.y;\n' +
    ' vec4 P = place();\n' +
    ' vec4 mv = modelViewMatrix * vec4(P.xyz, 1.0); gl_Position = projectionMatrix * mv;\n' +
    ' float d = max(-mv.z, 0.05);\n' +
    ' vPx = SIZE * aData.w * uScale / d;\n' +
    ' gl_PointSize = clamp(vPx, MINPX, 280.0);\n' +
    ' vA = P.w * exp(-pow(uFogD * d, 2.0)) * min(1.0, vPx / MINPX);\n' +
    '#ifdef NEAR\n vA *= smoothstep(NEAR * 0.35, NEAR, d);\n#endif\n' +
    ' if (vA < 0.003) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; }\n' +
    '}';
  var FHEAD = 'uniform float uTime; varying vec3 vCol; varying float vA; varying float vPx; varying float vSeed;\n';
  var CS = '\n #include <colorspace_fragment>\n';

  // A round glow with a bright core, tinted by vCol.
  var GLOW_F = FHEAD +
    'void main(){ vec2 p = gl_PointCoord - 0.5; float d2 = dot(p, p);\n' +
    ' float core = exp(-d2 * 90.0); float a = (exp(-d2 * 13.0) * 0.42 + core * 0.85) * vA; if (a < 0.004) discard;\n' +
    ' gl_FragColor = vec4(mix(vCol, vec3(1.0, 0.95, 0.84), core * 0.6), min(a, 1.0));' + CS + '}';
  // Just the halo, for the big soft light round a flame.
  var HALO_F = FHEAD +
    'void main(){ vec2 p = gl_PointCoord - 0.5; float d2 = dot(p, p);\n' +
    ' float a = (exp(-d2 * 12.0) * 0.5 + exp(-d2 * 55.0) * 0.35) * vA; if (a < 0.003) discard;\n' +
    ' gl_FragColor = vec4(vCol, min(a, 1.0));' + CS + '}';
  // A diya flame: a teardrop, white-gold at the heart.
  var FLAME_F = FHEAD +
    'void main(){ vec2 p = gl_PointCoord - 0.5; p.y = -p.y;\n' +
    ' float sx = mix(0.15, 0.035, clamp(p.y + 0.35, 0.0, 1.0));\n' +
    ' float f = exp(-(p.x * p.x) / (sx * sx) - pow((p.y + 0.12) / 0.26, 2.0));\n' +
    ' f = mix(exp(-dot(p, p) * 18.0), f, smoothstep(3.0, 9.0, vPx));\n' +
    ' vec3 c = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.93, 0.72), smoothstep(0.35, 0.9, f));\n' +
    ' float a = f * vA; if (a < 0.004) discard;\n' +
    ' gl_FragColor = vec4(c, min(a, 1.0));' + CS + '}';
  // A petal: a small spinning, fluttering ellipse (normal blending).
  var PETAL_F = FHEAD +
    'void main(){ vec2 p = gl_PointCoord - 0.5;\n' +
    ' float an = vSeed * 6.2832 + uTime * (0.5 + vSeed); float c = cos(an), s = sin(an);\n' +
    ' p = mat2(c, -s, s, c) * p; p.x *= 1.9 / (0.35 + 0.65 * abs(sin(uTime * 1.9 + vSeed * 20.0)));\n' +
    ' float d = dot(p, p) * 4.6; float a = (1.0 - smoothstep(0.5, 1.0, d)) * vA; if (a < 0.02) discard;\n' +
    ' gl_FragColor = vec4(vCol * (0.8 + 0.35 * (1.0 - d)), min(a, 1.0));' + CS + '}';
  // A sky lantern: a warm paper body lit from below, and its halo.
  var LANTERN_F = FHEAD +
    'void main(){ vec2 p = gl_PointCoord - 0.5; float d2 = dot(p, p);\n' +
    ' vec2 q = abs(p) / vec2(0.12 - p.y * 0.06, 0.17);\n' +
    ' float body = 1.0 - smoothstep(0.75, 1.0, max(q.x, q.y));\n' +
    ' float hot = exp(-(p.x * p.x * 260.0 + (p.y - 0.1) * (p.y - 0.1) * 160.0));\n' +
    ' float halo = exp(-d2 * 11.0) * 0.45;\n' +
    ' vec3 c = mix(vec3(1.0, 0.42, 0.12), vec3(1.0, 0.78, 0.45), body * (0.4 + p.y * 1.5) + hot);\n' +
    ' float a = (halo + body * 0.85 + hot) * vA; if (a < 0.004) discard;\n' +
    ' gl_FragColor = vec4(c, min(a, 1.0));' + CS + '}';

  function ptsMat(place, frag, size, minPx, normal, near) {
    return new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false,
      blending: normal ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: '#define SIZE ' + size.toFixed(3) + '\n#define MINPX ' + minPx.toFixed(2) + '\n' +
        (near ? '#define NEAR ' + near.toFixed(2) + '\n' : '') + HEAD + place + VMAIN,
      fragmentShader: frag
    });
  }
  // A growable list of points: position, aData (param, seed, param2, size), aCol.
  function PointSet() { this.p = []; this.d = []; this.c = []; }
  PointSet.prototype.add = function (x, y, z, a, b, c2, size, color) {
    this.p.push(x, y, z);
    this.d.push(a, b, c2, size == null ? 1 : size);
    var cc = color || WHITE;
    this.c.push(cc.r, cc.g, cc.b);
    return this;
  };
  PointSet.prototype.geo = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('aData', new THREE.Float32BufferAttribute(this.d, 4));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.c, 3));
    return g;
  };
  var WHITE = col('#ffffff');
  function addPoints(set, place, layers) {
    if (!set.p.length) return;
    var g = set.geo();
    layers.forEach(function (l) {
      var pts = new THREE.Points(g, ptsMat(place, l[0], l[1], l[2], l[4], l[5]));
      pts.frustumCulled = false;
      pts.renderOrder = l[3] || 0;
      world.add(pts);
    });
  }

  // ── Sky: a dusk gradient with the afterglow behind the mandap ──────────
  var sky = new THREE.Group();
  world.add(sky);
  var skyU = {
    uTop: { value: col('#000') }, uMid: { value: col('#000') }, uHor: { value: col('#000') }, uGlow: { value: col('#000') }
  };
  sky.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uGlow; varying vec3 vP;\n' +
      'void main(){ vec3 d = normalize(vP); float h = d.y;\n' +
      ' vec3 c = mix(uHor, uMid, smoothstep(-0.01, 0.2, h)); c = mix(c, uTop, smoothstep(0.16, 0.72, h));\n' +
      ' float az = max(dot(normalize(d.xz + 1e-5), vec2(0.0, -1.0)), 0.0);\n' +
      ' c += uGlow * pow(az, 3.0) * exp(-max(h, 0.0) * 7.0);\n' +
      ' gl_FragColor = vec4(c, 1.0);' + CS + '}'
  })));
  var stars = K.starField(r, small ? 900 : 1700, 850, 0.05, small ? 1.3 : 1.5);
  sky.add(stars);
  var bright = K.starField(r, small ? 70 : 120, 840, 0.12, small ? 2.2 : 2.6);
  sky.add(bright);
  var moonTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 10, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,236,200,0.5)'); g.addColorStop(0.35, 'rgba(255,220,170,0.16)'); g.addColorStop(1, 'rgba(255,200,150,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    var m = document.createElement('canvas'); m.width = m.height = 128;
    var y = m.getContext('2d');
    y.fillStyle = '#fff2d8'; y.beginPath(); y.arc(64, 64, 15, 0, 7); y.fill();
    y.globalCompositeOperation = 'destination-out'; y.beginPath(); y.arc(71, 59, 14, 0, 7); y.fill();
    x.drawImage(m, 0, 0);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  var moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
  moonSprite.position.set(-0.42, 0.3, -0.86).normalize().multiplyScalar(800);
  moonSprite.scale.setScalar(150);
  sky.add(moonSprite);

  // Ridges of far hills, painted in sky colours (no fog: they are the fog).
  function ridge(R, amp, seed, segs) {
    var pos = [], rr = rng(seed);
    var ph = [rr() * 6, rr() * 6, rr() * 6];
    for (var i = 0; i < segs; i++) {
      var a0 = lerp(-Math.PI - 0.5, 0.5, i / segs), a1 = lerp(-Math.PI - 0.5, 0.5, (i + 1) / segs);
      var h0 = amp * (0.55 + 0.25 * Math.sin(a0 * 5 + ph[0]) + 0.15 * Math.sin(a0 * 13 + ph[1]) + 0.05 * Math.sin(a0 * 31 + ph[2]));
      var h1 = amp * (0.55 + 0.25 * Math.sin(a1 * 5 + ph[0]) + 0.15 * Math.sin(a1 * 13 + ph[1]) + 0.05 * Math.sin(a1 * 31 + ph[2]));
      var x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R - 20, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R - 20;
      pos.push(x0, -4, z0, x1, -4, z1, x0, h0, z0, x0, h0, z0, x1, -4, z1, x1, h1, z1);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#000', fog: false, side: THREE.DoubleSide }));
    world.add(m);
    return m;
  }
  var ridges = [ridge(420, 26, 7, 120), ridge(300, 16, 11, 120), ridge(200, 8, 3, 100)];

  // ── Light ──────────────────────────────────────────────────────────────
  var hemi = new THREE.HemisphereLight('#ffc49a', '#4a2a1c', 1.5);
  var glowSun = new THREE.DirectionalLight('#ff9a5c', 1.4);
  glowSun.position.set(0, 12, -100);
  var moon = new THREE.DirectionalLight('#9aa0e0', 0);
  moon.position.set(60, 90, 40);
  world.add(hemi, glowSun, moon);

  // ── Ground ─────────────────────────────────────────────────────────────
  function groundH(x, z) {
    var d = Math.max(0, Math.abs(x) - 24, z - 14, -46 - z);
    return Math.min(d * 0.09, 5) * (0.65 + 0.35 * Math.sin(x * 0.045 + 1.1) * Math.cos(z * 0.06)) +
           0.06 * Math.sin(x * 0.7) * Math.sin(z * 0.6) * smooth(2, 10, d);
  }
  var gSeg = small ? 90 : 140;
  var gGeo = new THREE.PlaneGeometry(460, 460, gSeg, gSeg).rotateX(-Math.PI / 2).translate(0, 0, -70);
  var gp = gGeo.attributes.position, gCols = new Float32Array(gp.count * 3);
  var cGrass = col('#56603a'), cField = col('#3e4824'), cPath = col('#8a6a48'), cYard = col('#a07e5a'), cTmp = new THREE.Color();
  for (var i = 0; i < gp.count; i++) {
    var x = gp.getX(i), z = gp.getZ(i);
    gp.setY(i, groundH(x, z));
    var inField = Math.abs(x) < 11.5 && z < 24.5 && z > -22;
    cTmp.copy(cGrass).lerp(cField, inField ? 1 : 0);
    if (Math.abs(x) < 1.25 && z < 30 && z > -26) cTmp.copy(cPath);
    var dA = Math.hypot(x - HOME_A.x, z - HOME_A.z), dB = Math.hypot(x - HOME_B.x, z - HOME_B.z);
    cTmp.lerp(cYard, 1 - smooth(5.5, 8.5, Math.min(dA, dB)));
    cTmp.lerp(cYard, 1 - smooth(4.5, 7, Math.hypot(x, z - MZ)));
    var n = 0.9 + 0.1 * Math.sin(x * 1.7 + z * 0.9) * Math.sin(z * 2.3 - x * 0.4);
    gCols[i * 3] = cTmp.r * n; gCols[i * 3 + 1] = cTmp.g * n; gCols[i * 3 + 2] = cTmp.b * n;
  }
  gGeo.setAttribute('color', new THREE.BufferAttribute(gCols, 3));
  gGeo.computeVertexNormals();
  world.add(new THREE.Mesh(gGeo, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // ── Geometry helpers ───────────────────────────────────────────────────
  function box(geos, x0, x1, y0, y1, z0, z1, color) {
    geos.push(K.tinted(new THREE.BoxGeometry(Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0))
      .translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), color));
  }
  function cyl(geos, x, z, y0, y1, rad, color, seg) {
    geos.push(K.tinted(new THREE.CylinderGeometry(rad, rad, y1 - y0, seg || 10).translate(x, (y0 + y1) / 2, z), color));
  }
  // A flat arch facing +z: a rectangle with a round top, w wide, h tall.
  function arch(w, h) {
    var s = new THREE.Shape(), rr2 = w / 2;
    s.moveTo(-rr2, 0); s.lineTo(-rr2, h - rr2); s.absarc(0, h - rr2, rr2, Math.PI, 0, true); s.lineTo(rr2, 0); s.lineTo(-rr2, 0);
    return new THREE.ShapeGeometry(s, 8);
  }
  function archAt(geos, w, h, x, y, z, color, rotY) {
    var g = arch(w, h);
    if (rotY) g.rotateY(rotY);
    geos.push(K.tinted(g.translate(x, y, z), color));
  }
  var winSpots = [];   // centres of the glowing arches, for their halos
  // Points along a hanging string (a parabola is close enough to a catenary).
  function swag(a, b, sag, n, fn) {
    for (var k = 0; k <= n; k++) {
      var t = k / n;
      fn(lerp(a[0], b[0], t), lerp(a[1], b[1], t) - sag * 4 * t * (1 - t), lerp(a[2], b[2], t), t, k);
    }
  }
  // Darken a merged geometry towards the ground, as if lit from the sky.
  function groundShade(geo, y0, y1, low) {
    var p = geo.attributes.position, c = geo.attributes.color;
    for (var k = 0; k < p.count; k++) {
      var s = lerp(low, 1, smooth(y0, y1, p.getY(k)));
      c.setXYZ(k, c.getX(k) * s, c.getY(k) * s, c.getZ(k) * s);
    }
  }

  // Marigold balls (garlands, torans) collected from everywhere, one instanced mesh.
  var MARI = ['#ff8c00', '#ffa10a', '#ffb31a', '#f57c00', '#ffc21f', '#ff9500'].map(col);
  var ROSE = col('#b0122c');
  var balls = [];   // x, y, z, radius, colour
  function ball(x, y, z, rad, c) { balls.push([x, y, z, rad, c || MARI[(balls.length * 7 + (balls.length >> 2)) % MARI.length]]); }
  function garlandTo(a, b, sag, n, rad) { swag(a, b, sag, n, function (x, y, z) { ball(x, y, z, rad); }); }
  function strand(x, y, z, count, step, rad, roseEvery) {
    for (var k = 0; k < count; k++) ball(x, y - k * step, z, rad, roseEvery && k % roseEvery === roseEvery - 1 ? ROSE : null);
  }

  // ── Havelis ────────────────────────────────────────────────────────────
  // Built facing +z with the door at x = 0, then turned towards the field.
  var houseGeos = [], houseGlow = [], fairy = new PointSet(), homeLamp = [];
  var leafGreen = '#3e6a22';
  var PAL = [
    { wall: '#d9a066', wall2: '#e3b27c', trim: '#f4e0bc', trim2: '#c58552', stone: '#a4785a', step: '#b98d68', dome: '#f2ddb6' },
    { wall: '#d38a74', wall2: '#de9d86', trim: '#f5ddc4', trim2: '#bb7660', stone: '#9e7462', step: '#b48874', dome: '#f4dfc8' }
  ];
  var cWarm = col('#ffb862'), cWin = col('#ffa04a'), cFairy = [col('#ffd88a'), col('#ffe6b0'), col('#ffc060'), col('#ffd0a0')];

  function haveli(H, P, hi) {
    var g = [], glow = [], m = new THREE.Matrix4().makeRotationY(H.rot).setPosition(H.x, 0, H.z);
    var v = new V(), W = 9, D = 7, G0 = 0.5, G1 = 3.9, U0 = G1 + 0.22, U1 = U0 + 2.7, uz = -0.75;
    function world3(x, y, z) { return v.set(x, y, z).applyMatrix4(m); }
    var b0 = balls.length, f0 = fairy.p.length / 3;

    box(g, -W / 2 - 0.5, W / 2 + 0.5, 0, G0, -D - 0.5, 0.5, P.stone);
    for (var k = 0; k < 3; k++) box(g, -1.5, 1.5, 0, G0 - k * 0.16, 0.5, 0.5 + 0.38 * (k + 1), P.step);
    box(g, -W / 2, W / 2, G0, G1, -D, 0, P.wall);
    box(g, -W / 2 - 0.08, W / 2 + 0.08, G0, G0 + 0.4, -D - 0.08, 0.08, P.trim2);
    box(g, -W / 2 - 0.35, W / 2 + 0.35, G1, G1 + 0.22, -D - 0.35, 0.45, P.trim);
    // Corner pilasters.
    [-1, 1].forEach(function (s) { box(g, s * W / 2 - 0.3, s * W / 2 + 0.3, G0, G1, -0.3, 0.12, P.trim2); });
    // Front terrace parapet with little merlons.
    box(g, -W / 2 - 0.2, W / 2 + 0.2, U0, U0 + 0.5, 0.12, 0.4, P.trim);
    for (var mx = -W / 2; mx <= W / 2 + 0.01; mx += 0.6) box(g, mx - 0.13, mx + 0.13, U0 + 0.5, U0 + 0.78, 0.16, 0.36, P.trim);
    // Upper floor and its parapet.
    box(g, -W / 2 + 0.8, W / 2 - 0.8, U0, U1, -D + 0.8, uz, P.wall2);
    box(g, -W / 2 + 0.6, W / 2 - 0.6, U1, U1 + 0.2, -D + 0.6, uz + 0.25, P.trim);
    box(g, -W / 2 + 0.65, W / 2 - 0.65, U1 + 0.2, U1 + 0.6, uz - 0.05, uz + 0.2, P.trim2);
    for (mx = -W / 2 + 0.8; mx <= W / 2 - 0.79; mx += 0.55) box(g, mx - 0.12, mx + 0.12, U1 + 0.6, U1 + 0.85, uz, uz + 0.16, P.trim2);
    // Rooftop chhatris at the back corners.
    [-1, 1].forEach(function (s) {
      var cx = s * (W / 2 - 1.9), cz = -D + 2.0, y0 = U1 + 0.2;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { box(g, cx + c[0] * 0.6 - 0.07, cx + c[0] * 0.6 + 0.07, y0, y0 + 1.25, cz + c[1] * 0.6 - 0.07, cz + c[1] * 0.6 + 0.07, P.trim); });
      box(g, cx - 0.82, cx + 0.82, y0 + 1.25, y0 + 1.4, cz - 0.82, cz + 0.82, P.trim);
      g.push(K.tinted(new THREE.SphereGeometry(0.78, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.15, 1).translate(cx, y0 + 1.4, cz), P.dome));
      g.push(K.tinted(new THREE.ConeGeometry(0.09, 0.45, 6).translate(cx, y0 + 2.5, cz), '#d9a441'));
      // Fairy lights round the dome's rim.
      for (var q = 0; q < (small ? 10 : 16); q++) {
        var an = q / (small ? 10 : 16) * Math.PI * 2;
        var wp = world3(cx + Math.cos(an) * 0.85, y0 + 1.42, cz + Math.sin(an) * 0.85);
        fairy.add(wp.x, wp.y, wp.z, 0.18 + hi * 0.04 + r() * 0.04, r(), 0, 0.9, cFairy[q % 4]);
      }
    });

    // The door: a cream arch surround, the warm hall glowing within.
    archAt(g, 2.1, 3.0, 0, G0, 0.02, P.trim);
    archAt(glow, 1.5, 2.55, 0, G0, 0.05, cWarm);
    var spots = [[0, G0 + 1.2, 0.2, 2.2]];
    // Ground-floor windows and the side windows.
    [-2.9, 2.9].forEach(function (x) {
      archAt(g, 1.3, 2.0, x, G0 + 0.85, 0.02, P.trim);
      archAt(glow, 0.95, 1.65, x, G0 + 1.0, 0.05, cWin);
      spots.push([x, G0 + 1.8, 0.2, 1.4]);
    });
    [-1, 1].forEach(function (s) {
      [-1.8, -5.0].forEach(function (z) {
        archAt(g, 1.2, 1.9, 0, 0, 0, P.trim, s * Math.PI / 2);
        g[g.length - 1].translate(s * (W / 2 + 0.02), G0 + 0.85, z);
        archAt(glow, 0.85, 1.55, 0, 0, 0, cWin, s * Math.PI / 2);
        glow[glow.length - 1].translate(s * (W / 2 + 0.05), G0 + 1.0, z);
        spots.push([s * (W / 2 + 0.2), G0 + 1.8, z, 1.3]);
      });
    });
    // Jharokhas: three projecting balconies on the upper floor.
    [-2.3, 0, 2.3].forEach(function (x) {
      box(g, x - 0.75, x + 0.75, U0 + 0.45, U0 + 0.7, uz, uz + 0.7, P.trim);
      box(g, x - 0.62, x + 0.62, U0 + 0.7, U0 + 2.05, uz, uz + 0.55, P.wall);
      archAt(glow, 0.72, 1.05, x, U0 + 0.85, uz + 0.56, cWin);
      spots.push([x, U0 + 1.35, uz + 0.7, 1.1]);
      g.push(K.tinted(new THREE.ConeGeometry(0.98, 0.55, 4).rotateY(Math.PI / 4).translate(x, U0 + 2.33, uz + 0.28), P.dome));
      g.push(K.tinted(new THREE.ConeGeometry(0.05, 0.3, 5).translate(x, U0 + 2.75, uz + 0.28), '#d9a441'));
    });

    // Toran over the door: marigolds on a sagging string, mango leaves and pendants.
    var ty = G0 + 3.12;
    swag([-1.15, ty, 0.16], [1.15, ty, 0.16], 0.24, small ? 12 : 18, function (x, y, z, t, kk) {
      ball(x, y, z, 0.062);
      if (kk % 2) g.push(K.tinted(new THREE.ConeGeometry(0.06, 0.22, 3).rotateX(Math.PI).translate(x, y - 0.14, z + 0.02), leafGreen));
      if (kk % 3 === 0 && t > 0.05 && t < 0.95) strand(x, y - 0.12, z, 3, 0.11, 0.05, 3);
    });
    // Garland swags along the cornice and the roof parapet.
    for (var sw = 0; sw < 4; sw++) {
      var xa = -W / 2 - 0.3 + sw * (W + 0.6) / 4, xb = xa + (W + 0.6) / 4;
      garlandTo([xa, G1 - 0.02, 0.52], [xb, G1 - 0.02, 0.52], 0.42, small ? 9 : 13, 0.06);
      strand(xa, G1 - 0.08, 0.52, 5, 0.11, 0.055, 5);
    }
    strand(W / 2 + 0.3, G1 - 0.08, 0.52, 5, 0.11, 0.055, 5);
    for (sw = 0; sw < 3; sw++) {
      var xc = -W / 2 + sw * W / 3;
      garlandTo([xc, U0 + 0.45, 0.45], [xc + W / 3, U0 + 0.45, 0.45], 0.3, small ? 7 : 10, 0.055);
    }

    // Fairy-light curtain: strands down the whole front, lit top to bottom
    // in ch IV (aData.x is the moment each light comes on).
    var dx = small ? 0.42 : 0.3, dy = small ? 0.24 : 0.17;
    for (var fx = -W / 2 + 0.15; fx <= W / 2 - 0.1; fx += dx) {
      var top = G1 + 0.12, bottom = Math.abs(fx) < 1.15 ? G0 + 3.05 : G0 + 0.35 + r() * 0.3, delay = r() * 0.05;
      for (var fy = top; fy > bottom; fy -= dy) {
        var w3 = world3(fx, fy, 0.56);
        fairy.add(w3.x, w3.y, w3.z, 0.2 + hi * 0.05 + (top - fy) / 3.4 * 0.3 + delay, r(), 0, 0.85 + r() * 0.3, cFairy[(r() * 4) | 0]);
      }
    }
    for (fx = -W / 2 + 0.95; fx <= W / 2 - 0.9; fx += dx) {
      var top2 = U1 + 0.15, bottom2 = U0 + 0.85;
      for (fy = top2; fy > bottom2; fy -= dy) {
        var w4 = world3(fx, fy, uz + 0.75);
        fairy.add(w4.x, w4.y, w4.z, 0.14 + hi * 0.05 + (top2 - fy) / 2.6 * 0.25, r(), 0, 0.85 + r() * 0.3, cFairy[(r() * 4) | 0]);
      }
    }
    // ... and outlines along the parapets and cornice.
    for (fx = -W / 2 - 0.3; fx <= W / 2 + 0.3; fx += dx * 0.6) {
      var w5 = world3(fx, U0 + 0.82, 0.3); fairy.add(w5.x, w5.y, w5.z, 0.12 + hi * 0.05, r(), 0, 0.9, cFairy[0]);
      var w6 = world3(fx, G1 + 0.24, 0.5); fairy.add(w6.x, w6.y, w6.z, 0.1 + hi * 0.05, r(), 0, 0.9, cFairy[1]);
      if (Math.abs(fx) < W / 2 - 0.7) { var w7 = world3(fx, U1 + 0.9, uz + 0.1); fairy.add(w7.x, w7.y, w7.z, 0.08 + hi * 0.05, r(), 0, 0.9, cFairy[0]); }
    }

    // To world space.
    var merged = K.merge(g);
    groundShade(merged, 0, 2.6, 0.72);
    merged.applyMatrix4(m);
    houseGeos.push(merged);
    var mg = K.merge(glow);
    mg.applyMatrix4(m);
    houseGlow.push(mg);
    spots.forEach(function (sp) { var wv = world3(sp[0], sp[1], sp[2]); winSpots.push([wv.x, wv.y, wv.z, sp[3]]); });
    for (var bi = b0; bi < balls.length; bi++) { world3(balls[bi][0], balls[bi][1], balls[bi][2]); balls[bi][0] = v.x; balls[bi][1] = v.y; balls[bi][2] = v.z; }

    // Where things stand in front of the house, in world space.
    var door = world3(0, G0 + 0.02, 0.72).clone();
    var out = new V(Math.sin(H.rot), 0, Math.cos(H.rot));
    homeLamp.push({ door: door, out: out, m: m, front: world3(0, 3.2, 4).clone() });
  }
  haveli(HOME_A, PAL[0], 0);
  haveli(HOME_B, PAL[1], 1);
  var houseMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  houseGeos.forEach(function (g) { world.add(new THREE.Mesh(g, houseMat)); });
  var glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: '#ffffff', fog: true });
  houseGlow.forEach(function (g) { world.add(new THREE.Mesh(g, glowMat)); });

  // ── Rangoli: painted once on a canvas, laid at each door and the mandap ─
  function rangoliTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 512;
    var x = c.getContext('2d'); x.translate(256, 256);
    function petals(n, rIn, rOut, wid, color, rot) {
      x.fillStyle = color;
      for (var k = 0; k < n; k++) {
        x.save(); x.rotate(k / n * Math.PI * 2 + (rot || 0));
        x.beginPath(); x.moveTo(0, rIn);
        x.quadraticCurveTo(wid, (rIn + rOut) / 2, 0, rOut); x.quadraticCurveTo(-wid, (rIn + rOut) / 2, 0, rIn);
        x.fill(); x.restore();
      }
    }
    function ring(rad, w, color) { x.strokeStyle = color; x.lineWidth = w; x.beginPath(); x.arc(0, 0, rad, 0, Math.PI * 2); x.stroke(); }
    function dots(n, rad, size, color) { x.fillStyle = color; for (var k = 0; k < n; k++) { var a = k / n * Math.PI * 2; x.beginPath(); x.arc(Math.cos(a) * rad, Math.sin(a) * rad, size, 0, 7); x.fill(); } }
    petals(16, 170, 248, 44, '#e8590c'); petals(16, 175, 236, 26, '#ffb21a');
    ring(168, 10, '#fff3dc'); dots(48, 152, 5, '#fff3dc');
    petals(12, 70, 145, 40, '#b5173a', Math.PI / 12); petals(12, 78, 135, 22, '#f06a8a', Math.PI / 12);
    petals(8, 30, 82, 30, '#ffc21f'); ring(66, 6, '#fff3dc');
    x.fillStyle = '#ff8c00'; x.beginPath(); x.arc(0, 0, 30, 0, 7); x.fill();
    x.fillStyle = '#fff3dc'; x.beginPath(); x.arc(0, 0, 12, 0, 7); x.fill();
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  var rangoliMat = new THREE.MeshLambertMaterial({ map: rangoliTexture(), transparent: true, depthWrite: false, emissive: '#2a0c04' });
  function rangoli(x, z, size, rot) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), rangoliMat);
    m.position.set(x, 0.025, z); m.rotation.y = rot || 0; m.renderOrder = 1;
    world.add(m);
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
      ball(x + Math.cos(an) * 0.2, lerp(PH + 0.45, PT - 0.35, t), z + Math.sin(an) * 0.2, 0.06, k % 9 === 8 ? ROSE : null);
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
  var mandapGeo = K.merge(mg2);
  groundShade(mandapGeo, 0, 1.2, 0.8);
  world.add(new THREE.Mesh(mandapGeo, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#24100a' })));
  var FIRE = new V(0, PH + 0.38, MZ);
  (function kalash() {
    var prof = [[0, 0], [0.09, 0.01], [0.17, 0.09], [0.19, 0.16], [0.15, 0.25], [0.075, 0.31], [0.07, 0.35], [0.11, 0.38], [0.1, 0.4], [0, 0.4]]
      .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var parts = [K.tinted(new THREE.LatheGeometry(prof, 16), '#d9a43c'),
                 K.tinted(new THREE.SphereGeometry(0.1, 12, 8).scale(1, 1.15, 1).translate(0, 0.49, 0), '#8a5a2e'),
                 K.tinted(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 16).translate(0, 0.25, 0), '#b8202e')];
    for (var k = 0; k < 6; k++) {
      var a = k / 6 * Math.PI * 2;
      parts.push(K.tinted(new THREE.ConeGeometry(0.035, 0.24, 4).rotateZ(-1.15).translate(0.12, 0.42, 0).rotateY(a), leafGreen));
    }
    var g = K.merge(parts), mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#3a2206' });
    kalashAt.forEach(function (p) { var m = new THREE.Mesh(g, mat); m.position.set(p[0], p[1], p[2]); m.scale.setScalar(1.25); world.add(m); });
  })();

  // The canopy: a peaked tent of maroon and saffron panels.
  (function canopy() {
    var pos = [], cols = [], N = 28, RINGS = 7, E2 = PX + 0.3, cA = col('#8a1a2e'), cB = col('#e09a2a');
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
          for (var q = 0; q < 6; q++) cols.push(cc.r, cc.g, cc.b);
        }
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    world.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: '#1a0406' })));
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
        strand(lerp(sd[0][0], sd[1][0], t) + sd[2][0] * 0.05, PT - 0.02, lerp(sd[0][1], sd[1][1], t) + sd[2][1] * 0.05, len, 0.11, 0.052, 4);
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
    geos.forEach(function (g) { world.add(new THREE.Mesh(g, fabricMat)); });
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
  var bushGeo = new THREE.IcosahedronGeometry(1, 0);
  var bushes = new THREE.InstancedMesh(bushGeo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), bushSpots.length);
  var flowerGeo = new THREE.DodecahedronGeometry(1, 0);
  var flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#3a1400' }), bushSpots.length * 3);
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
  world.add(bushes, flowers);

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
  function broadleaf() {
    var rr = rng(77), parts = [K.tinted(new THREE.CylinderGeometry(0.14, 0.26, 3.4, 7).translate(0, 1.7, 0), '#3a2a20')];
    parts.push(K.tinted(new THREE.CylinderGeometry(0.05, 0.1, 1.7, 5).rotateZ(0.7).translate(0.5, 3.1, 0), '#3a2a20'));
    for (var k = 0; k < 7; k++) {
      var rad = 0.9 + rr() * 0.7, a = rr() * Math.PI * 2, d = k === 0 ? 0 : 0.8 + rr() * 0.6;
      parts.push(K.tinted(new THREE.IcosahedronGeometry(rad, 1).scale(1, 0.82, 1)
        .translate(Math.cos(a) * d, 4.1 + rr() * 1.5 + (k === 0 ? 0.7 : 0), Math.sin(a) * d), '#ffffff'));
    }
    return K.merge(parts);
  }
  // Ashoka: tall and narrow, drooping tiers of leaves.
  function ashoka() {
    var parts = [K.tinted(new THREE.CylinderGeometry(0.08, 0.14, 2, 6).translate(0, 1, 0), '#3a2a20')];
    for (var k = 0; k < 6; k++) {
      var y = 1.5 + k * 1.0, rad = lerp(0.95, 0.5, k / 5);
      parts.push(K.tinted(new THREE.IcosahedronGeometry(rad, 1).scale(1, 1.25, 1).translate(0, y + 0.6, 0), '#ffffff'));
    }
    parts.push(K.tinted(new THREE.IcosahedronGeometry(0.4, 1).scale(1, 1.6, 1).translate(0, 7.9, 0), '#ffffff'));
    return K.merge(parts);
  }
  var treeCols = ['#3a4a2a', '#2e3e22', '#44502c', '#34442a'].map(col);
  var kinds = [broadleaf(), ashoka()].map(function (g, gi) {
    var list = gi ? ashokaSpots : treeSpots;
    var mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: gi ? THREE.DoubleSide : THREE.FrontSide }), Math.max(1, list.length));
    list.forEach(function (s2, k) {
      var scl = gi ? 0.75 + r() * 0.25 : 0.9 + r() * 0.8;
      ps.set(s2[0], groundH(s2[0], s2[1]) - 0.2, s2[1]); q4.setFromEuler(eul.set(0, r() * 6, 0)); sc.set(scl, scl * (0.9 + r() * 0.3), scl);
      mesh.setMatrixAt(k, mtx.compose(ps, q4, sc));
      mesh.setColorAt(k, treeCols[k % 4]);
    });
    mesh.count = list.length;
    world.add(mesh);
    return mesh;
  });

  // ── Marigold balls: every garland and toran, one instanced mesh ─────────
  var ballMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#4a1a00' }), balls.length);
  balls.forEach(function (b, k) {
    ps.set(b[0], b[1], b[2]); q4.setFromEuler(eul.set(k * 1.3, k * 0.7, k * 2.1)); sc.setScalar(b[3]);
    ballMesh.setMatrixAt(k, mtx.compose(ps, q4, sc));
    ballMesh.setColorAt(k, b[4]);
  });
  world.add(ballMesh);

  // ── Lamps ──────────────────────────────────────────────────────────────
  // Diya bowls: a lathe-turned clay lamp, instanced wherever a flame burns.
  function diyaGeometry() {
    var pts = [[0, 0], [0.05, 0.004], [0.075, 0.025], [0.085, 0.05], [0.07, 0.05], [0.05, 0.03], [0, 0.03]]
      .map(function (p) { return new THREE.Vector2(p[0] * 1.4, p[1] * 1.4); });
    var geo = new THREE.LatheGeometry(pts, 12).toNonIndexed(), pos = geo.attributes.position, cs = [];
    for (var k = 0; k < pos.count; k++) {
      var y = pos.getY(k), rr2 = Math.hypot(pos.getX(k), pos.getZ(k)), inner = rr2 < 0.1 && y > 0.036;
      var c = inner ? col('#e08a3c') : col('#7a3a1e').lerp(col('#b8602c'), y / 0.07);
      cs.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
    return geo;
  }
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
  var bowls = new THREE.InstancedMesh(diyaGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#1a0a04' }), NL);
  for (var li = 0; li < NL; li++) bowls.setMatrixAt(li, mtx.makeTranslation(lamps.p[li * 3], lamps.p[li * 3 + 1], lamps.p[li * 3 + 2]));
  world.add(bowls);
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
  var fireU = { uTime: U.uTime, uAmt: U.uFire };
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
      uniforms: { uTime: fireU.uTime, uAmt: fireU.uAmt, uSeed: { value: f[3] }, uSize: { value: new THREE.Vector2(f[0], f[1]) } },
      vertexShader: FIRE_V, fragmentShader: FIRE_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    m.position.set(FIRE.x + f[2], FIRE.y - 0.02, FIRE.z + (i - 1) * 0.08);
    m.frustumCulled = false; m.renderOrder = 5;
    world.add(m);
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
  var poolTex = K.softSprite('rgba(255,170,90,1)', 'rgba(255,120,40,0)');
  function pool(x, z, size) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
    m.position.set(x, 0.06, z); m.renderOrder = 1;
    world.add(m);
    return m;
  }
  var mandapPool = pool(0, MZ, 18), homePools = homeLamp.map(function (h) { return pool(h.door.x + h.out.x * 2.2, h.door.z + h.out.z * 2.2, 11); });
  var doorPools = homeLamp.map(function (h) { return pool(h.door.x, h.door.z + 0.1, 2.6); });

  // ── Point lights: the doorstep diyas, the two lights, the fire ─────────
  var LD = homeLamp.map(function (h) {
    var l = new THREE.PointLight('#ff9a48', 2.5, 7, 2);
    l.position.copy(h.door).y += 0.45;
    world.add(l);
    return l;
  });
  var LA = new THREE.PointLight('#ffa858', 0, 9, 2), LB = new THREE.PointLight('#ffa858', 0, 9, 2);
  var LF = new THREE.PointLight('#ff8a3a', 0, 26, 1.7);
  LF.position.copy(FIRE).y += 0.8;
  world.add(LA, LB, LF);

  // ── Colour ramps: dusk -> night ────────────────────────────────────────
  var RAMP = {
    top: [col('#2b1d4e'), col('#0b0a22')], mid: [col('#8c4c7c'), col('#251838')],
    hor: [col('#f6a668'), col('#4a2236')], glow: [col('#ff7a30'), col('#3a1418')],
    hemiS: [col('#ffc49a'), col('#545aa8')], hemiG: [col('#52301e'), col('#140a10')],
    ridgeFar: [col('#c78478'), col('#2a1a34')], ridgeMid: [col('#9a5f66'), col('#20142c')], ridgeNear: [col('#6e4450'), col('#170f20')]
  };
  function ramp(pair, t, out) { return out.copy(pair[0]).lerp(pair[1], t); }
  var cFest = col('#ffb070'), tmpC = col('#000');

  // ── Per frame ──────────────────────────────────────────────────────────
  var camP = new V(), camT = new V(), headA = new V(), headB = new V(), gPos = new V(), mid = new V(), meet = new V(MEET[0], MEET[1], MEET[2]);
  var carryMid = new V(0, 4.2, -18), H = 800, kPort = 1, port = 0, fovNow = 50;

  function frame(f) {
    var row = f.row, time = f.time;
    var night = row[C.night], walk = row[C.walk], talk = row[C.talk], gather = row[C.gather], carry = row[C.carry];
    var fest = row[C.fest];

    // Camera: keyed position and target; portrait screens pull back along the view.
    camT.set(row[C.tx], row[C.ty], row[C.tz]);
    camP.set(row[C.px], row[C.py], row[C.pz]).sub(camT).multiplyScalar(lerp(1, kPort, row[C.fit])).add(camT);
    camT.y += lerp(row[C.lift], row[C.liftP], port);
    if (!env.reduceMotion) { camP.x += Math.sin(time * 0.21) * 0.25; camP.y += Math.sin(time * 0.33) * 0.12; }
    camera.position.copy(camP);
    camera.lookAt(camT);
    camera.rotateY(-f.mx * 0.035);
    camera.rotateX(-f.my * 0.02);
    sky.position.copy(camera.position);

    // Dusk to night.
    ramp(RAMP.top, night, skyU.uTop.value);
    ramp(RAMP.mid, night, skyU.uMid.value);
    var hor = ramp(RAMP.hor, night, skyU.uHor.value);
    ramp(RAMP.glow, night, skyU.uGlow.value);
    if (fest > 0) { skyU.uHor.value.lerp(tmpC.set('#7a3a3a'), fest * 0.35); skyU.uGlow.value.lerp(tmpC.set('#6a2a1a'), fest * 0.3); }
    world.fog.color.copy(skyU.uHor.value).multiplyScalar(0.9);
    world.fog.density = lerp(0.0085, 0.011, night);
    gl.setClearColor(skyU.uHor.value);
    ramp(RAMP.ridgeFar, night, ridges[0].material.color);
    ramp(RAMP.ridgeMid, night, ridges[1].material.color);
    ramp(RAMP.ridgeNear, night, ridges[2].material.color);
    ridges[0].material.color.lerp(hor, 0.3);
    ridges[1].material.color.lerp(hor, 0.15);
    stars.material.opacity = 0.9 * smooth(0.35, 0.95, night);
    bright.material.opacity = smooth(0.45, 1, night);
    moonSprite.material.opacity = smooth(0.4, 1, night);
    stars.rotation.y = bright.rotation.y = env.reduceMotion ? 0 : time * 0.004;

    ramp(RAMP.hemiS, night, hemi.color);
    ramp(RAMP.hemiG, night, hemi.groundColor);
    hemi.color.lerp(cFest, fest * 0.25);
    hemi.intensity = lerp(1.55, 0.8, night) + fest * 0.2;
    glowSun.intensity = 1.5 * (1 - smooth(0, 0.8, night));
    moon.intensity = 0.55 * smooth(0.4, 1, night);

    // The two lights: out of the diyas, through the flowers, close, then one.
    var w = walk;
    curves[0].getPointAt(w, headA);
    curves[1].getPointAt(w, headB);
    var bob = env.reduceMotion ? 0 : 1;
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
    var flick = env.reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(time * 11) * Math.sin(time * 6.7);
    LA.position.copy(headA); LB.position.copy(headB);
    LA.intensity = LB.intensity = headOn * 4.5 * flick * (gather > 0.5 ? lerp(1, 0.7, gather) : 1);
    LA.distance = LB.distance = 9;
    // In ch IV the two lights become the glow of the lit houses.
    if (fest > 0) {
      LA.position.copy(homeLamp[0].front); LB.position.copy(homeLamp[1].front);
      LA.intensity = LB.intensity = fest * 26 * (0.95 + 0.05 * flick);
      LA.distance = LB.distance = 22;
    }
    LD.forEach(function (l) { l.intensity = 2.6 * flick * (1 - fest * 0.3); });
    var fire = smooth(0.75, 1, carry);
    LF.intensity = fire * 30 * (env.reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(time * 9) * Math.sin(time * 5.3));

    // Lamps, petals, thread, lanterns, fireworks.
    U.uTime.value = time;
    U.uScale.value = H / (2 * Math.tan(fovNow * Math.PI / 360));
    U.uWalk.value = walk; U.uTalk.value = talk; U.uGather.value = gather; U.uCarry.value = carry;
    U.uFire.value = fire; U.uPetal.value = row[C.petal]; U.uPhera.value = row[C.phera];
    U.uFest.value = fest; U.uLant.value = row[C.lant]; U.uFw.value = row[C.fw]; U.uDrift.value = row[C.drift];
    U.uNight.value = night;
    U.uLit.value = lerp(1.0, 0.45, night) + fire * 0.45 + fest * 0.2;
    U.uFogD.value = lerp(0.004, 0.0055, night);
    glowMat.color.setScalar(lerp(0.45, 1.0, smooth(0, 0.8, night)) + fest * 0.25);

    mandapPool.material.opacity = fire * 0.35 + fest * 0.45;
    homePools.forEach(function (p) { p.material.opacity = fest * 0.5; });
    doorPools.forEach(function (p) { p.material.opacity = 0.35 + 0.25 * night; });

    gl.render(world, camera);
  }

  return {
    resize: function (w, h, dpr) {
      gl.setPixelRatio(Math.min(dpr, small ? 1.25 : 1.5));
      gl.setSize(w, h, false);
      var aspect = w / h;
      camera.aspect = aspect;
      // Narrow screens: a slightly wider lens, and pull back part of the way
      // so both houses (and the whole mandap) still fit across.
      fovNow = aspect < 1 ? lerp(60, 50, smooth(0.45, 1, aspect)) : 50;
      camera.fov = fovNow;
      camera.updateProjectionMatrix();
      var hNow = Math.atan(Math.tan(fovNow * Math.PI / 360) * aspect), hWant = Math.atan(Math.tan(25 * Math.PI / 180) * 1.5);
      kPort = 1 + Math.max(0, Math.tan(hWant) / Math.tan(hNow) - 1) * 0.55;
      port = smooth(1.25, 0.55, aspect);
      H = h * gl.getPixelRatio();
    },
    frame: frame,
    destroy: function () { K.disposeAll(world, gl); }
  };
}

// ═════════════════════════════════════════════════════════════════════════
// The lean engine: DOM, lazy start, scroll timeline, text, lifecycle
// ═════════════════════════════════════════════════════════════════════════
function readChapters() {
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
  var canvas = el('canvas', 'si-canvas');
  canvas.setAttribute('aria-hidden', 'true');
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
  var names = '<p class="si-label">And so it begins</p><p class="si-names">Deeksha <span class="amp">&amp;</span> Harshit</p>' + rule +
              '<p class="si-date">10 &middot; March &middot; 2027</p>';
  var outro = el('div', 'si-beat si-outro', names);
  text.appendChild(outro);

  var veilTop = el('div', 'si-veil si-veil-top'), veilBot = el('div', 'si-veil si-veil-bot');
  veilTop.setAttribute('aria-hidden', 'true'); veilBot.setAttribute('aria-hidden', 'true');
  var ink = el('div', 'si-beat si-outro si-ink', names);
  ink.setAttribute('aria-hidden', 'true');

  var skip = el('button', 'si-skip', 'Skip story <span aria-hidden="true">&darr;</span>');
  skip.type = 'button';
  skip.setAttribute('aria-label', 'Skip the story and go to the celebrations');
  if (mq('(pointer: fine)')) skip.style.cursor = 'none';   // the site draws its own cursor

  [canvas, vignette, text, veilTop, veilBot, ink, skip].forEach(function (n) { stage.appendChild(n); });
  track.appendChild(stage);
  return { track: track, stage: stage, canvas: canvas, intro: intro, panels: panels, outro: outro, ink: ink,
           veilTop: veilTop, veilBot: veilBot, skip: skip };
}

// Write a style only when it changes (rounded), to keep layout work down.
function setter() {
  var last = new Map();
  return function (node, prop, value) {
    var k = last.get(node) || {};
    if (k[prop] === value) return;
    k[prop] = value; last.set(node, k);
    if (prop.charAt(0) === '-') node.style.setProperty(prop, value); else node.style[prop] = value;
  };
}

async function start(chapters) {
  var K = await import('./kit.js');
  THREE = K.THREE;
  var small = K.isSmall();
  var dom = buildDom(chapters);
  var view;
  try {
    view = createScene(K, dom.canvas, { small: small, reduceMotion: reduceMotion });
  } catch (e) {
    console.warn('[story] immersive scene could not start; keeping the chapter list.', e);
    return;
  }

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

  function unmount(e) {
    console.warn('[story] immersive scene stopped; showing the chapter list.', e);
    try { view.destroy(); } catch (x) {}
    dom.track.remove();
    section.classList.remove('si-on');
    root.classList.remove('si-immersed');
  }
  try { run3(); } catch (e) { unmount(e); }

  function run3() {
  var keyRows = keys(), row = new Array(COLS.length);
  function sample(u) {
    var last = keyRows[keyRows.length - 1], j;
    if (u >= last[0]) { for (j = 1; j < last.length; j++) row[j - 1] = last[j]; return row; }
    if (u <= keyRows[0][0]) { for (j = 1; j < last.length; j++) row[j - 1] = keyRows[0][j]; return row; }
    for (var i = 0; i < keyRows.length - 1; i++) {
      var a = keyRows[i], b = keyRows[i + 1];
      if (u <= b[0]) {
        var t = smooth(a[0], b[0], u);
        for (j = 1; j < a.length; j++) row[j - 1] = lerp(a[j], b[j], t);
        return row;
      }
    }
    return row;
  }

  function resize() {
    view.resize(dom.stage.clientWidth, dom.stage.clientHeight, window.devicePixelRatio || 1);
  }
  resize();

  function progress() {
    var rect = dom.track.getBoundingClientRect(), sh = dom.stage.clientHeight || window.innerHeight;
    return clamp(-rect.top / sh, -1, TOTAL);
  }

  var set = setter();
  var u = progress(), raf = 0, running = false, last = performance.now(), time = reduceMotion ? 2.6 : 0;
  var mx = 0, my = 0, tmx = 0, tmy = 0, fine = mq('(pointer: fine)'), immersed = false;
  var frameArg = { row: row, time: 0, dt: 0, mx: 0, my: 0, u: 0 };

  function onPointer(e) {
    if (e.pointerType !== 'mouse') return;
    tmx = e.clientX / window.innerWidth * 2 - 1;
    tmy = e.clientY / window.innerHeight * 2 - 1;
  }
  window.addEventListener('pointermove', onPointer, { passive: true });
  var ro = new ResizeObserver(resize);
  ro.observe(dom.stage);

  function beat(node, a, b, c, d, uu) {
    var fin = smooth(a, b, uu), fout = smooth(c, d, uu), o = fin * (1 - fout);
    set(node, 'opacity', o.toFixed(3));
    set(node, 'visibility', o > 0.002 ? 'visible' : 'hidden');
    set(node, '--y', ((1 - fin) * 26 - fout * 26).toFixed(1) + 'px');
    return o;
  }

  function updateText(uu) {
    // Until the stage sticks, its top edge (mid-screen) stays cream with the
    // dusk rising out of it; once it fills the screen the veil lifts away.
    var kTop = 0.34 * (1 - smooth(0.0, 0.34, uu)), kBot = smooth(TOTAL - 0.42, TOTAL - 0.02, uu);
    set(dom.veilTop, '--k', kTop.toFixed(4));
    set(dom.veilBot, '--k', kBot.toFixed(4));
    beat(dom.intro, 0.06, 0.24, S(0) - 0.16, S(0) + 0.02, uu);
    dom.panels.forEach(function (p, i) { beat(p, S(i), S(i) + FADE, E(i) - FADE, E(i), uu); });
    // The light names leave before the cream reaches them; the ink names
    // arrive once it has, so the two never sit half-and-half.
    var oIn = smooth(E(3) + 0.02, E(3) + 0.28, uu), inkO = smooth(0.8, 0.97, kBot);
    var o1 = oIn * (1 - smooth(0.42, 0.58, kBot));
    set(dom.outro, 'opacity', o1.toFixed(3));
    set(dom.outro, 'visibility', o1 > 0.002 ? 'visible' : 'hidden');
    set(dom.outro, '--y', ((1 - oIn) * 26).toFixed(1) + 'px');
    set(dom.ink, 'opacity', inkO.toFixed(3));
    set(dom.ink, 'visibility', inkO > 0.002 ? 'visible' : 'hidden');
    dom.skip.classList.toggle('show', uu > -0.35 && uu < TOTAL - 0.5);
    var imm = uu > 0.02 && uu < TOTAL - 0.25;
    if (imm !== immersed) { immersed = imm; root.classList.toggle('si-immersed', imm); }
    return kTop > 0.999 || kBot > 0.999;
  }

  function frame(now) {
    raf = running ? requestAnimationFrame(frame) : 0;
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!reduceMotion) time += dt;
    var ut = progress(), leap = Math.abs(ut - u) > 0.9;
    u = reduceMotion || leap ? ut : u + (ut - u) * (1 - Math.exp(-dt * 6));
    if (Math.abs(ut - u) < 0.0005) u = ut;
    if (fine && !reduceMotion) {
      mx += (tmx - mx) * (1 - Math.exp(-dt * 3));
      my += (tmy - my) * (1 - Math.exp(-dt * 3));
    }
    var covered = updateText(u);
    if (covered) return;
    sample(u);
    frameArg.time = time; frameArg.dt = dt; frameArg.mx = mx; frameArg.my = my; frameArg.u = u;
    view.frame(frameArg);
  }

  function run(on) {
    if (on === running) return;
    running = on;
    if (on) { last = performance.now(); raf = requestAnimationFrame(frame); }
    else {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (immersed) { immersed = false; root.classList.remove('si-immersed'); }
    }
  }
  var io = new IntersectionObserver(function (entries) { run(entries[entries.length - 1].isIntersecting); });
  io.observe(dom.track);

  dom.skip.addEventListener('click', function () {
    var next = document.querySelector('.ev-sec') || dom.track.parentNode.nextElementSibling;
    var top = next ? next.getBoundingClientRect().top + window.scrollY - 12 : dom.track.getBoundingClientRect().bottom + window.scrollY;
    window.scrollTo({ top: top, behavior: reduceMotion ? 'instant' : 'smooth' });
  });

  // If the GPU drops the context (phones under memory pressure), let three
  // restore it; on a real unload, free the GPU straight away.
  dom.canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); }, false);
  window.addEventListener('pagehide', function (e) {
    run(false);
    if (!e.persisted) {
      io.disconnect(); ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      view.destroy();
    }
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted) run(true); });

  // Draw the first frame now so the stage is never blank when it arrives.
  updateText(u);
  sample(u);
  frameArg.row = row; frameArg.time = time;
  view.frame(frameArg);
  }
}

function init() {
  if (!section || reduceData) return;
  var chapters = readChapters();
  if (chapters.length !== 4 || chapters.some(function (c) { return !c.title; })) return;
  if (!('IntersectionObserver' in window) || !('ResizeObserver' in window) || !hasWebGL()) return;
  // Load three.js only when the story is about 1.5 screens away.
  var io = new IntersectionObserver(function (entries) {
    if (!entries.some(function (e) { return e.isIntersecting; })) return;
    io.disconnect();
    start(chapters).catch(function (e) { console.warn('[story] immersive scene unavailable; keeping the chapter list.', e); });
  }, { rootMargin: '150% 0px 150% 0px' });
  io.observe(section);
}

init();
