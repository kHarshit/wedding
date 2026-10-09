/*
 * One sky for the whole world, driven by the hour (tod, in hours; it keeps
 * counting past 24 so the night can turn into the next morning).
 *
 * A table of hours gives the sky dome's colours, the far ridges, the fog, the
 * hemisphere light, the sun and the moon. update(tod) blends the two hours
 * either side into P; a place may then adjust P (the story warms the horizon
 * as its lamps come on); apply() writes P to the scene. From 18.7 (dusk) to
 * 21.0 (night) the table is exactly the Our Story ramp, so the story keeps
 * its look.
 */
import { THREE, col, clamp, lerp, smooth, rng } from './lib.js';

// ── The hours ────────────────────────────────────────────────────────────
//   top mid hor glow: sky dome (zenith, middle band, horizon, glow round the sun)
//   hs hg hi: hemisphere light sky / ground colour and intensity
//   sc si: sun colour and intensity; mi: moonlight; so: sun disc
//   st br mo: stars, bright stars, moon sprite; fd: fog density
//   rf rm rn: far, middle and near ridges
var HOURS = [
  [0.0,  { top: '#070818', mid: '#15122a', hor: '#2a1a30', glow: '#1a0e18', hs: '#3c4280', hg: '#0e080c', hi: 0.6, sc: '#ff9a5c', si: 0, mi: 0.5, so: 0, st: 1, br: 1, mo: 1, fd: 0.011, rf: '#1e1628', rm: '#181222', rn: '#120c1a' }],
  [4.6,  { top: '#0a0c26', mid: '#1c1c44', hor: '#3a3058', glow: '#3a2440', hs: '#4a5290', hg: '#120e18', hi: 0.62, sc: '#ff9a6a', si: 0, mi: 0.45, so: 0, st: 0.95, br: 1, mo: 0.9, fd: 0.0095, rf: '#26223e', rm: '#1e1a34', rn: '#16122a' }],
  [5.35, { top: '#101438', mid: '#2c2e62', hor: '#6a5a88', glow: '#7a4058', hs: '#6a74b8', hg: '#1a141e', hi: 0.75, sc: '#ff9a6a', si: 0, mi: 0.35, so: 0, st: 0.7, br: 0.85, mo: 0.7, fd: 0.0095, rf: '#3a3658', rm: '#2e2a4a', rn: '#221e38' }],
  [6.2,  { top: '#3c4f8e', mid: '#a88aa8', hor: '#f2b89a', glow: '#ffa060', hs: '#ffd2bc', hg: '#5a4038', hi: 1.25, sc: '#ffb07a', si: 1.1, mi: 0.05, so: 0.9, st: 0.08, br: 0.1, mo: 0.15, fd: 0.0095, rf: '#a88aa0', rm: '#8a6e88', rn: '#6a5470' }],
  [7.4,  { top: '#5a7cbc', mid: '#aec0dc', hor: '#f6dcc0', glow: '#ffd098', hs: '#fff0de', hg: '#6e5a44', hi: 1.5, sc: '#ffd0a0', si: 1.7, mi: 0, so: 1, st: 0, br: 0, mo: 0, fd: 0.0075, rf: '#98a8c0', rm: '#7c90aa', rn: '#66788e' }],
  [9.5,  { top: '#5a8ccc', mid: '#a6cae6', hor: '#eef0e6', glow: '#fff0d0', hs: '#fff6e8', hg: '#74664c', hi: 1.65, sc: '#fff2dc', si: 2.0, mi: 0, so: 1, st: 0, br: 0, mo: 0, fd: 0.0065, rf: '#9cb0c4', rm: '#8296ac', rn: '#6c7e92' }],
  [12.5, { top: '#4a82c4', mid: '#98c2e4', hor: '#e6eef0', glow: '#fff6e0', hs: '#fffaf0', hg: '#786a50', hi: 1.7, sc: '#fffaf0', si: 2.1, mi: 0, so: 1, st: 0, br: 0, mo: 0, fd: 0.006, rf: '#98acc2', rm: '#8094aa', rn: '#6a7c90' }],
  [16.4, { top: '#4a72b0', mid: '#c4b8b4', hor: '#f8d8a8', glow: '#ffc070', hs: '#fff0d8', hg: '#74583c', hi: 1.6, sc: '#ffd49a', si: 1.9, mi: 0, so: 1, st: 0, br: 0, mo: 0, fd: 0.0065, rf: '#b8a4a4', rm: '#9c8890', rn: '#7a6a78' }],
  [17.7, { top: '#4a4686', mid: '#d0907a', hor: '#ffc68c', glow: '#ffa040', hs: '#ffd8a8', hg: '#62422a', hi: 1.6, sc: '#ffae66', si: 1.75, mi: 0, so: 0.95, st: 0, br: 0, mo: 0, fd: 0.0075, rf: '#d49a84', rm: '#ac7468', rn: '#7e5254' }]
];
// Dusk to night: the story's own ramp, sampled so its curves stay true.
(function storyHours() {
  var A = { top: '#2b1d4e', mid: '#8c4c7c', hor: '#f6a668', glow: '#ff7a30', hs: '#ffc49a', hg: '#52301e', rf: '#c78478', rm: '#9a5f66', rn: '#6e4450' };
  var B = { top: '#0b0a22', mid: '#251838', hor: '#4a2236', glow: '#3a1418', hs: '#545aa8', hg: '#140a10', rf: '#2a1a34', rm: '#20142c', rn: '#170f20' };
  [0, 0.2, 0.4, 0.6, 0.8, 1].forEach(function (n) {
    var k = { sc: '#ff9a5c', so: 0, fd: lerp(0.0085, 0.011, n), hi: lerp(1.55, 0.8, n),
              si: 1.5 * (1 - smooth(0, 0.8, n)), mi: 0.55 * smooth(0.4, 1, n),
              st: 0.9 * smooth(0.35, 0.95, n), br: smooth(0.45, 1, n), mo: smooth(0.4, 1, n) };
    Object.keys(A).forEach(function (c) { k[c] = '#' + col(A[c]).lerp(col(B[c]), n).getHexString(); });
    HOURS.push([18.7 + 2.3 * n, k]);
  });
})();
HOURS.push([24, HOURS[0][1]]);
HOURS.sort(function (a, b) { return a[0] - b[0]; });
export var STORY_DUSK = 18.7, STORY_NIGHT = 21.0;
var COLS = ['top', 'mid', 'hor', 'glow', 'hs', 'hg', 'sc', 'rf', 'rm', 'rn'];
var NUMS = ['hi', 'si', 'mi', 'so', 'st', 'br', 'mo', 'fd'];
HOURS.forEach(function (h) { COLS.forEach(function (c) { h[1][c] = col(h[1][c]); }); });

export function createSky(K, scene, small) {
  var CS = '\n #include <colorspace_fragment>\n';
  var group = new THREE.Group();
  scene.add(group);
  var U = {
    uTop: { value: col('#000') }, uMid: { value: col('#000') }, uHor: { value: col('#000') }, uGlow: { value: col('#000') },
    uSunXZ: { value: new THREE.Vector2(0, -1) }, uSun: { value: new THREE.Vector3(0, 0, -1) }, uSunC: { value: col('#fff') }, uSunO: { value: 0 }
  };
  group.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uGlow; uniform vec2 uSunXZ; uniform vec3 uSun; uniform vec3 uSunC; uniform float uSunO; varying vec3 vP;\n' +
      'void main(){ vec3 d = normalize(vP); float h = d.y;\n' +
      ' vec3 c = mix(uHor, uMid, smoothstep(-0.01, 0.2, h)); c = mix(c, uTop, smoothstep(0.16, 0.72, h));\n' +
      ' float az = max(dot(normalize(d.xz + 1e-5), uSunXZ), 0.0);\n' +
      ' c += uGlow * pow(az, 3.0) * exp(-max(h, 0.0) * 7.0);\n' +
      ' float s = max(dot(d, uSun), 0.0);\n' +
      ' c += uSunC * uSunO * (smoothstep(0.9993, 0.9997, s) * 2.2 + pow(s, 60.0) * 0.35 + pow(s, 8.0) * 0.12);\n' +
      ' gl_FragColor = vec4(c, 1.0);' + CS + '}'
  })));
  // The same stars the story had (same seed, same order).
  var r = rng(310);
  var stars = K.starField(r, small ? 900 : 1700, 850, 0.05, small ? 1.3 : 1.5);
  group.add(stars);
  var bright = K.starField(r, small ? 70 : 120, 840, 0.12, small ? 2.2 : 2.6);
  group.add(bright);
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
  group.add(moonSprite);

  // Ridges of far hills, painted in sky colours (no fog: they are the fog).
  // Round the story's field they stay put, as they always did; elsewhere
  // they travel with the camera so they never come close.
  var ridgeGroup = new THREE.Group();
  scene.add(ridgeGroup);
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
    ridgeGroup.add(m);
    return m;
  }
  var ridges = [ridge(420, 26, 7, 120), ridge(300, 16, 11, 120), ridge(200, 8, 3, 100)];

  // ── Light ──────────────────────────────────────────────────────────────
  var hemi = new THREE.HemisphereLight('#ffc49a', '#4a2a1c', 1.5);
  var sun = new THREE.DirectionalLight('#ff9a5c', 1.4);
  var moon = new THREE.DirectionalLight('#9aa0e0', 0);
  moon.position.set(60, 90, 40);
  scene.add(hemi, sun, moon);
  var fog = new THREE.FogExp2('#c07a6a', 0.0085);
  scene.fog = fog;

  // The palette for the current hour; places may adjust it before apply().
  var P = { tod: 0, dark: 0, sunDir: new THREE.Vector3(0, 0, -1), lightDir: new THREE.Vector3(0, 0.12, -1) };
  COLS.forEach(function (c) { P[c] = col('#000'); });
  NUMS.forEach(function (n) { P[n] = 0; });

  function hour(tod, Q) {
    var h = ((tod % 24) + 24) % 24, i = 0;
    while (i < HOURS.length - 2 && HOURS[i + 1][0] <= h) i++;
    var a = HOURS[i], b = HOURS[i + 1], t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
    for (var c = 0; c < COLS.length; c++) Q[COLS[c]].copy(a[1][COLS[c]]).lerp(b[1][COLS[c]], t);
    for (var n = 0; n < NUMS.length; n++) Q[NUMS[n]] = lerp(a[1][NUMS[n]], b[1][NUMS[n]], t);
    // The sun rises in the east (+z, swung well round to +x, so mornings are
    // side-lit) and sets due west (-z), behind the mandap.
    var s = (h - 6) / 12.3, phi = lerp(1.15, Math.PI, clamp(s, 0, 1)), el = Math.sin(Math.PI * clamp(s, -0.1, 1.1)) * 1.22;
    Q.sunDir.set(Math.sin(phi) * Math.cos(el), Math.sin(el), Math.cos(phi) * Math.cos(el));
    var le = Math.max(el, 0.119);
    Q.lightDir.set(Math.sin(phi) * Math.cos(le), Math.sin(le), Math.cos(phi) * Math.cos(le));
  }
  function update(tod) { P.tod = tod; hour(tod, P); return P; }
  // Between two places the sky cross-fades from one hour to the other
  // rather than living through every hour in between.
  var Q = { sunDir: new THREE.Vector3(), lightDir: new THREE.Vector3() };
  COLS.forEach(function (c) { Q[c] = col('#000'); });
  function blend(todA, todB, e) {
    hour(todA, P);
    if (e <= 0) { P.tod = todA; return P; }
    hour(todB, Q);
    for (var c = 0; c < COLS.length; c++) P[COLS[c]].lerp(Q[COLS[c]], e);
    for (var n = 0; n < NUMS.length; n++) P[NUMS[n]] = lerp(P[NUMS[n]], Q[NUMS[n]], e);
    P.sunDir.lerp(Q.sunDir, e).normalize(); P.lightDir.lerp(Q.lightDir, e).normalize();
    P.tod = e < 0.5 ? todA : todB;
    return P;
  }

  var hor = col('#000');
  function apply(camera, time, still) {
    U.uTop.value.copy(P.top); U.uMid.value.copy(P.mid); U.uHor.value.copy(P.hor); U.uGlow.value.copy(P.glow);
    U.uSunXZ.value.set(P.sunDir.x, P.sunDir.z).normalize();
    U.uSun.value.copy(P.sunDir); U.uSunC.value.copy(P.sc); U.uSunO.value = P.so;
    hor.copy(P.hor);
    fog.color.copy(hor).multiplyScalar(0.9);
    fog.density = P.fd;
    ridges[0].material.color.copy(P.rf).lerp(hor, 0.3);
    ridges[1].material.color.copy(P.rm).lerp(hor, 0.15);
    ridges[2].material.color.copy(P.rn);
    stars.material.opacity = P.st;
    bright.material.opacity = P.br;
    moonSprite.material.opacity = P.mo;
    stars.visible = P.st > 0.003; bright.visible = P.br > 0.003; moonSprite.visible = P.mo > 0.003;
    stars.rotation.y = bright.rotation.y = still ? 0 : time * 0.004;
    hemi.color.copy(P.hs); hemi.groundColor.copy(P.hg); hemi.intensity = P.hi;
    sun.color.copy(P.sc); sun.intensity = P.si; sun.position.copy(P.lightDir).multiplyScalar(100);
    moon.intensity = P.mi;
    group.position.copy(camera.position);
    var cz = camera.position.z;
    ridgeGroup.position.set(0, 0, cz - clamp(cz, -20, 50));
    P.dark = 1 - clamp((P.hor.r + P.hor.g + P.hor.b + P.top.r + P.top.g + P.top.b) / 3.6, 0, 1);
  }

  return { P: P, U: U, update: update, blend: blend, apply: apply, hemi: hemi, sun: sun, moon: moon, fog: fog, clear: hor };
}
