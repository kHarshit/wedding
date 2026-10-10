/*
 * The world engine: one fixed canvas behind <main>, one renderer and one
 * scene for the whole page.
 *
 *  - The sky (sky.js) and the land (land.js) are always there; places
 *    (places/*.js) are built lazily and shown only while the camera is at
 *    their stop or travelling to or from it.
 *  - Each frame: the smoothed scroll position is located on the timeline,
 *    the stop (or the two stops of a travel segment) gives the camera, the
 *    hour and the mist; the sky takes the hour; each visible place animates;
 *    the point lights go to whichever lamps matter most.
 *  - The loop stops while the tab is hidden and slows when nothing has moved
 *    for a while. With prefers-reduced-motion the clock stands still and a
 *    frame is drawn only when something changes.
 *  - The page's ink follows the hour: --world-ink, --world-ink-soft,
 *    --world-card(-strong) and --world-halo go on :root (css/world.css).
 *  - If anything fails, or the GPU drops the context, fail() takes the world
 *    down and the cream site returns, without a reload.
 *
 * A place is { group, frame(f), palette?(P, f), resize?(w, h, aspect),
 * unmount?() }. A stop is { name, places: [names], pose(local, out),
 * local?(y, vh), range?(vh), arc?, mist? } (see timeline.js).
 */
import { THREE, clamp, lerp, smooth, rng, col, mq, PointSet, pointKit, PETAL_F, GLOW_F } from './lib.js';
import { createSky } from './sky.js';
import { buildLand } from './land.js';
import { createTimeline } from './timeline.js';

var NLIGHTS = 6;

export function createWorld(K, opts) {
  var small = K.isSmall(), reduce = !!opts.reduceMotion;
  var root = document.documentElement, body = document.body;
  var canvas = document.createElement('canvas');
  canvas.className = 'world-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  body.insertBefore(canvas, body.firstChild);
  var fade = document.createElement('div');
  fade.className = 'world-fade';
  fade.setAttribute('aria-hidden', 'true');
  body.insertBefore(fade, canvas.nextSibling);

  var gl = K.makeRenderer(canvas, { clear: '#1a1020', exposure: 1.0 });
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1500);
  var sky = createSky(K, scene, small);
  scene.add(buildLand(small));
  var timeline = createTimeline();

  // A fixed pool of point lights (so shaders never recompile as places come
  // and go); places ask for lamps each frame and the brightest near ones win.
  var lights = [], reqs = [], nreq = 0;
  for (var i = 0; i < NLIGHTS; i++) { var l = new THREE.PointLight('#ff9a48', 0, 8, 2); scene.add(l); lights.push(l); }
  for (i = 0; i < 24; i++) reqs.push({ p: new THREE.Vector3(), c: new THREE.Color(), i: 0, d: 0, k: 2, s: 0 });
  function lamp(x, y, z, color, intensity, distance, decay) {
    if (nreq >= reqs.length || intensity <= 0) return;
    var q = reqs[nreq++];
    q.p.set(x, y, z); q.c.set(color); q.i = intensity; q.d = distance; q.k = decay == null ? 2 : decay;
    var dd = q.p.distanceTo(camera.position) / Math.max(1, distance);
    q.s = intensity / (1 + dd * dd);
  }
  function assignLights() {
    // Partial selection sort: a handful of requests at most.
    for (var a = 0; a < NLIGHTS; a++) {
      var best = -1, bs = 0;
      for (var b = a; b < nreq; b++) if (reqs[b].s > bs) { bs = reqs[b].s; best = b; }
      var L = lights[a];
      if (best < 0) { L.intensity = 0; continue; }
      var t = reqs[a]; reqs[a] = reqs[best]; reqs[best] = t;
      var q = reqs[a];
      L.position.copy(q.p); L.color.copy(q.c); L.intensity = q.i; L.distance = q.d; L.decay = q.k;
    }
  }

  // Petals drifting past the camera while it travels between places. A stop
  // may ask for more (petals: up to 3) and a haze colour: the sky and the
  // mist then warm through that colour at the middle of the travel, so one
  // hour breaks into the next through a drift of petals and golden air
  // rather than a muddy blend of the two.
  var TU = { uTime: { value: 0 }, uScale: { value: 600 }, uFogD: { value: 0.004 }, uAmt: { value: 0 }, uLit: { value: 1 }, uCam: { value: new THREE.Vector3() } };
  var travelGroup = new THREE.Group();
  scene.add(travelGroup);
  (function travelPetals() {
    var r = rng(91), set = new PointSet(), cs = ['#ff8c00', '#ffb21a', '#e8590c', '#c21e3a', '#f06a8a', '#ffd04a', '#fff0d8'].map(col);
    for (var k = 0; k < (small ? 420 : 700); k++) set.add((r() - 0.5) * 20, (r() - 0.5) * 11, (r() - 0.5) * 20, r(), r(), 0, 0.8 + r() * 0.6, cs[k % cs.length]);
    pointKit(TU, travelGroup).add(set,
      'vec4 place(){ vec3 B = vec3(20.0, 11.0, 20.0); float s = aData.y;\n' +
      ' vec3 p = position + vec3(uTime * 0.6 + sin(uTime * 0.7 + s * 20.0) * 0.8, -uTime * (0.45 + s * 0.4), sin(uTime * 0.45 + s * 9.0) * 0.8);\n' +
      ' p = uCam + mod(p - uCam + B * 0.5, B) - B * 0.5; vCol = aCol * uLit;\n' +
      ' return vec4(p, smoothstep(aData.x * 3.0, aData.x * 3.0 + 0.35, uAmt)); }\n',
      [[PETAL_F, 0.13, 1.5, 8, true, 1.2]]);
  })();

  // Ambient life near the camera, wherever we are near the ground (not in
  // the story, which has its own): butterflies by day, fireflies by night.
  var AU = { uTime: { value: 0 }, uScale: { value: 600 }, uFogD: { value: 0.004 }, uDay: { value: 0 }, uNightK: { value: 0 }, uCam: { value: new THREE.Vector3() } };
  var ambient = new THREE.Group();
  scene.add(ambient);
  (function ambientLife() {
    var r = rng(77), akit = pointKit(AU, ambient);
    var BUTTERFLY_F = 'uniform float uTime; varying vec3 vCol; varying float vA; varying float vPx; varying float vSeed;\n' +
      'void main(){ vec2 p = gl_PointCoord - 0.5; p.y = -p.y;\n' +
      ' float flap = 0.18 + 0.82 * abs(sin(uTime * 9.0 + vSeed * 40.0));\n' +
      ' vec2 q = vec2(abs(p.x) / flap, p.y);\n' +
      ' float up = length((q - vec2(0.17, 0.07)) / vec2(0.17, 0.15)), lo = length((q - vec2(0.12, -0.12)) / vec2(0.11, 0.1));\n' +
      ' float wing = (1.0 - smoothstep(0.85, 1.0, min(up, lo))) * step(0.012, abs(p.x));\n' +
      ' float body = (1.0 - smoothstep(0.012, 0.024, abs(p.x))) * (1.0 - smoothstep(0.16, 0.2, abs(p.y)));\n' +
      ' float a = max(wing, body) * vA; if (a < 0.05) discard;\n' +
      ' vec3 c = body > 0.5 ? vCol * 0.3 : vCol * (0.7 + 0.45 * smoothstep(1.0, 0.2, min(up, lo)));\n' +
      ' gl_FragColor = vec4(c, min(a, 1.0));\n #include <colorspace_fragment>\n}';
    var bs = new PointSet(), bc = ['#f2b33a', '#fff4e0', '#e8783a', '#f4a3b6', '#ffd24a'].map(col);
    for (var k = 0; k < (small ? 8 : 14); k++) bs.add((r() - 0.5) * 20, 1.0 + r() * 3.2, (r() - 0.5) * 20, 0, r(), 0, 0.8 + r() * 0.4, bc[k % bc.length]);
    akit.add(bs,
      'vec4 place(){ float s = aData.y; vec3 B = vec3(20.0, 1.0, 20.0);\n' +
      ' vec3 p = position + vec3(sin(uTime * 0.31 + s * 20.0) * 2.6 + uTime * 0.4 * (s - 0.5), sin(uTime * 1.3 + s * 7.0) * 0.45, cos(uTime * 0.27 + s * 13.0) * 2.6);\n' +
      ' p.xz = uCam.xz + mod(p.xz - uCam.xz + B.xz * 0.5, B.xz) - B.xz * 0.5;\n' +
      ' return vec4(p, uDay); }\n',
      [[BUTTERFLY_F, 0.32, 3.0, 7, true, 1.2]]);
    var fs = new PointSet();
    for (k = 0; k < (small ? 40 : 70); k++) fs.add((r() - 0.5) * 22, 0.4 + r() * 2.6, (r() - 0.5) * 22, 0, r(), 0, 0.8 + r() * 0.5, col(k % 3 ? '#e8f08a' : '#ffd27a'));
    akit.add(fs,
      'vec4 place(){ float s = aData.y; vec3 B = vec3(22.0, 1.0, 22.0);\n' +
      ' vec3 p = position + vec3(sin(uTime * 0.3 + s * 30.0) * 0.9, sin(uTime * 0.5 + s * 17.0) * 0.35, cos(uTime * 0.27 + s * 23.0) * 0.9);\n' +
      ' p.xz = uCam.xz + mod(p.xz - uCam.xz + B.xz * 0.5, B.xz) - B.xz * 0.5;\n' +
      ' float tw = pow(0.5 + 0.5 * sin(uTime * (1.0 + s) * 1.6 + s * 40.0), 3.0);\n' +
      ' return vec4(p, uNightK * tw); }\n',
      [[GLOW_F, 0.09, 1.6, 2, false, 0.8]]);
  })();

  // ── Places ─────────────────────────────────────────────────────────────
  var places = {};          // name -> { loader, state, place }
  function define(name, loader) { places[name] = { loader: loader, state: 'idle', place: null }; }
  function ensure(name) {
    var e = places[name];
    if (!e || e.state !== 'idle') return e ? e.ready : null;
    e.state = 'loading';
    e.ready = Promise.resolve().then(e.loader).then(function (p) {
      if (dead) return null;
      e.place = p; e.state = 'built';
      p.group.visible = false;
      scene.add(p.group);
      if (p.resize) p.resize(vw, vh, vw / vh);
      // Compile its shaders now, off the critical path, so it never hitches on arrival.
      try { if (gl.compileAsync) gl.compileAsync(p.group, camera, scene).catch(function () {}); } catch (x) {}
      dirtyMeasure = true; poke();
      return p;
    }).catch(function (err) { e.state = 'failed'; console.warn('[world] a place could not be built:', name, err); return null; });
    return e.ready;
  }
  function placeOf(name) { var e = places[name]; return e && e.place; }

  // ── Frame state ────────────────────────────────────────────────────────
  var vw = 1, vh = 1, fovNow = 50, pxScale = 600, H = 800;
  var seg = { a: null, b: null, t: 0, e: 0, la: 0, lb: 0 };
  var poseA = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), tod: 6, mist: 0 };
  var poseB = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), tod: 6, mist: 0 };
  var pose = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), tod: 6, tod2: 6, e: 0, mist: 0 };
  var f = { time: reduce ? 2.6 : 0, dt: 0, tod: 6, P: sky.P, cam: camera, pxScale: 600, fogD: 0.0085, small: small, reduce: reduce,
            mx: 0, my: 0, aspect: 1, u: 0, w: 1, ys: 0, travel: 0, slow: 1, lamp: lamp, world: null };
  var override = null;      // the gate drives the camera until the doors are through
  var speedNow = 1;
  var raysK = 0, viaP = new THREE.Vector3(), viaT = new THREE.Vector3();
  function bez(out, a, v, b, e) { var u = 1 - e; out.set(a.x * u * u + 2 * v.x * u * e + b.x * e * e, a.y * u * u + 2 * v.y * u * e + b.y * e * e, a.z * u * u + 2 * v.z * u * e + b.z * e * e); }
  var hazeK = 0, hazeC = new THREE.Color(), hazeL = new THREE.Color(), WHITE = new THREE.Color('#ffffff');
  var ys = window.scrollY, mx = 0, my = 0, tmx = 0, tmy = 0, fine = mq('(pointer: fine)');
  var raf = 0, running = false, dead = false, last = 0, lastInput = 0, frameNo = 0, dirtyMeasure = true, need = true;
  var visibleNow = {}, lastDark = -1, failHooks = [];

  var sizedW = 0, sizedH = 0, sizedR = 0;
  function resize() {
    var w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    var ratio = Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.5);
    vw = w; vh = window.innerHeight || h;
    dirtyMeasure = true; poke();
    // The canvas is sized to the large viewport, so a phone's URL bar coming
    // and going only re-measures the stops; the buffers stay as they are.
    if (w === sizedW && h === sizedH && ratio === sizedR) return;
    sizedW = w; sizedH = h; sizedR = ratio;
    gl.setPixelRatio(ratio);
    gl.setSize(w, h, false);
    var aspect = w / h;
    camera.aspect = aspect;
    fovNow = aspect < 1 ? lerp(60, 50, smooth(0.45, 1, aspect)) : 50;
    camera.fov = fovNow;
    camera.updateProjectionMatrix();
    H = h * gl.getPixelRatio();
    pxScale = H / (2 * Math.tan(fovNow * Math.PI / 360));
    f.aspect = aspect;
    Object.keys(places).forEach(function (n) { var p = placeOf(n); if (p && p.resize) p.resize(w, h, aspect); });
  }

  function poseOf(stop, local, out) {
    out.mist = 0;
    stop.pose(local, out, f);
  }

  function computePose() {
    if (dirtyMeasure) { timeline.measure(vh); dirtyMeasure = false; }
    timeline.locate(ys, vh, seg);
    if (!seg.a) return false;
    poseOf(seg.a, seg.la, poseA);
    if (!seg.b) {
      pose.pos.copy(poseA.pos); pose.tgt.copy(poseA.tgt); pose.tod = pose.tod2 = poseA.tod; pose.e = 0; pose.mist = poseA.mist; f.travel = 0; seg.e = 0; hazeK = 0;
      pose.thr = null; raysK = 0;
    } else {
      poseOf(seg.b, seg.lb, poseB);
      var t = seg.t, e = smooth(0, 1, t), arc = Math.sin(Math.PI * t);
      if (reduce) e = t < 0.5 ? 0 : 1;
      seg.e = e;
      if (seg.b.via && !reduce) {
        // A route of its own: a curve through a waypoint for the eye and for the gaze.
        seg.b.via(f, viaP, viaT);
        bez(pose.pos, poseA.pos, viaP, poseB.pos, e);
        bez(pose.tgt, poseA.tgt, viaT, poseB.tgt, e);
      } else {
        pose.pos.lerpVectors(poseA.pos, poseB.pos, e);
        pose.tgt.lerpVectors(poseA.tgt, poseB.tgt, e);
        // Arc up between places, the gaze lifting with it (over roofs and domes, not into them).
        if (!reduce) { pose.pos.y += (seg.b.arc || 0) * arc; pose.tgt.y += (seg.b.arc || 0) * (seg.b.tilt == null ? 0.5 : seg.b.tilt) * arc; }
      }
      pose.tod = poseA.tod; pose.tod2 = poseB.tod; pose.e = e;
      pose.thr = seg.b.through != null && !reduce ? seg.b.through : null;
      raysK = seg.b.rays && !reduce ? seg.b.rays * smooth(0.2, 0.5, t) * (1 - smooth(0.62, 0.95, t)) : 0;
      pose.mist = lerp(poseA.mist, poseB.mist, e) + (reduce ? 0 : (seg.b.mist || 0) * arc);
      f.travel = reduce ? 0 : arc;
      f.petals = seg.b.petals || 1;
      hazeK = seg.b.haze && !reduce ? Math.pow(arc, 0.8) * (seg.b.hazeAmt == null ? 1 : seg.b.hazeAmt) : 0;
      if (hazeK) hazeC.set(seg.b.haze);
    }
    return true;
  }

  function frame(now) {
    raf = running ? requestAnimationFrame(frame) : 0;
    // (rAF's timestamp can be a little before the performance.now() taken
    // when the loop started: never let the clock run backwards.)
    var dt = clamp((now - last) / 1000, 0, 0.05);
    last = Math.max(last, now);
    // Idle: after a few still seconds draw every other frame; with reduced
    // motion, only when something changed.
    var idle = now - lastInput > 4000 && !override;
    frameNo++;
    if (reduce ? !need : (idle && frameNo % 2)) return;
    try { draw(dt * (idle ? 2 : 1)); } catch (err) { fail(err); }
  }

  function draw(dt) {
    need = false;
    // A place may slow the scene (f.slow, 0..1) while it is on screen.
    speedNow += (f.slow - speedNow) * (1 - Math.exp(-dt * 2));
    if (!reduce) f.time += dt * speedNow;
    f.dt = dt;
    var y = window.scrollY, leap = Math.abs(y - ys) > vh * 0.9;
    ys = reduce || leap ? y : ys + (y - ys) * (1 - Math.exp(-dt * 6));
    if (Math.abs(y - ys) < 0.5) ys = y; else need = true;
    if (fine && !reduce) {
      mx += (tmx - mx) * (1 - Math.exp(-dt * 3));
      my += (tmy - my) * (1 - Math.exp(-dt * 3));
    }
    f.mx = mx; f.my = my; f.ys = ys;

    var have = computePose();
    if (override) { pose.e = 0; override(pose, f); pose.tod2 = pose.tod; need = true; }
    else if (!have) return;

    // Which places show: those of the stop(s) in play, plus any the gate wants.
    for (var n in visibleNow) visibleNow[n] = false;
    if (seg.a) mark(seg.a.places);
    if (seg.b) mark(seg.b.places);
    if (override && override.places) mark(override.places);
    // Build ahead: the places of the stop we are at (or leaving), the one we
    // are heading to, and the one after (never while the gate opens).
    var ix = timeline.stops.indexOf(seg.a);
    for (var k = Math.max(0, ix); !override && k < Math.min(timeline.stops.length, ix + 3); k++) {
      var ps = timeline.stops[k].places;
      for (var j = 0; j < ps.length; j++) if (places[ps[j]] && places[ps[j]].state === 'idle') ensure(ps[j]);
    }

    // Camera.
    camera.position.copy(pose.pos);
    if (!reduce) { camera.position.x += Math.sin(f.time * 0.21) * 0.25; camera.position.y += Math.sin(f.time * 0.33) * 0.12; }
    camera.lookAt(pose.tgt);
    camera.rotateY(-mx * 0.035);
    camera.rotateX(-my * 0.02);

    // Sky for the hour, then the places (which may tint it), then the sky's apply.
    // Between two hours, or through a third (night to morning by way of the dawn).
    if (pose.thr != null && !override) {
      if (pose.e < 0.5) sky.blend(pose.tod, pose.thr, smooth(0.04, 0.42, pose.e));
      else sky.blend(pose.thr, pose.tod2, smooth(0.6, 0.97, pose.e));
    } else sky.blend(pose.tod, pose.tod2, pose.e);
    sky.P.rays = override ? 0 : raysK;
    f.tod = sky.P.tod;
    sky.P.fd *= Math.max(0.15, 1 + pose.mist);
    if (hazeK > 0 && !override) {
      var P = sky.P, k = hazeK;
      hazeL.copy(hazeC).lerp(WHITE, 0.35);
      P.top.lerp(hazeC, k * 0.3); P.mid.lerp(hazeC, k * 0.62); P.hor.lerp(hazeL, k * 0.8); P.glow.lerp(hazeC, k * 0.55);
      P.hs.lerp(hazeL, k * 0.5); P.hg.lerp(hazeC, k * 0.3); P.hi = lerp(P.hi, 1.35, k);
      P.st *= 1 - k; P.br *= 1 - k; P.mo *= 1 - k;
      P.rf.lerp(hazeL, k * 0.6); P.rm.lerp(hazeL, k * 0.5); P.rn.lerp(hazeC, k * 0.4);
      P.fd *= 1 + 0.6 * k;
    }
    f.fogD = sky.P.fd;
    f.pxScale = pxScale;
    f.slow = 1;
    nreq = 0;
    for (var name in places) {
      var e = places[name], p = e.place;
      if (!p) continue;
      var show = !!visibleNow[name];
      if (p.group.visible !== show) p.group.visible = show;
      if (!show) continue;
      f.u = p.stop === seg.a ? seg.la : p.stop === seg.b ? seg.lb : 0;
      f.w = p.stop === seg.a ? 1 - seg.e : p.stop === seg.b ? seg.e : 0;
      p.frame(f);
    }
    sky.apply(camera, f.time, reduce);
    gl.setClearColor(sky.clear);
    assignLights();
    var nearGround = 1 - smooth(9, 16, camera.position.y), inStory = (seg.a && seg.a.name === 'story' && !seg.b) ? 0 : 1;
    var day = 1 - smooth(0.35, 0.55, sky.P.dark);
    AU.uTime.value = f.time; AU.uScale.value = pxScale; AU.uFogD.value = f.fogD * 0.5; AU.uCam.value.copy(camera.position);
    AU.uDay.value = override ? 0 : day * nearGround * inStory;
    AU.uNightK.value = override ? 0 : (1 - day) * nearGround * inStory;
    ambient.visible = AU.uDay.value + AU.uNightK.value > 0.01;
    TU.uTime.value = f.time; TU.uScale.value = pxScale; TU.uFogD.value = f.fogD * 0.5;
    TU.uCam.value.copy(camera.position);
    TU.uAmt.value = f.travel * (override ? 0 : f.petals || 1);
    TU.uLit.value = clamp(sky.P.hi * 0.6 + 0.2, 0.35, 1.1);
    travelGroup.visible = TU.uAmt.value > 0.002;
    // The fade that stands in for travel when motion is reduced.
    var fo = reduce && seg.b ? 1 - smooth(0.08, 0.22, Math.abs(seg.t - 0.5)) : 0;
    if (override && override.fade != null) fo = Math.max(fo, override.fade);
    setFade(fo);
    // The page's ink follows the hour: dark ink on light glass by day, cream
    // ink on plum glass at night (stepped, so styles change rarely).
    // Day ink or night ink, never in between (half-way is low in contrast);
    // a little hysteresis so it doesn't flicker at the turn. css/world.css
    // eases the change over 0.4 s.
    var ink = lastDark === 1 ? (sky.P.dark > 0.5 ? 1 : 0) : (sky.P.dark > 0.55 ? 1 : 0);
    if (ink !== lastDark) setInk(lastDark = ink);
    gl.render(scene, camera);
  }

  function setInk(k) {
    function m(a, b) { return Math.round(lerp(a, b, k)); }
    var s = root.style;
    s.setProperty('--world-ink', 'rgb(' + m(31, 255) + ',' + m(20, 243) + ',' + m(10, 222) + ')');
    s.setProperty('--world-ink-soft', 'rgba(' + m(74, 255) + ',' + m(47, 236) + ',' + m(18, 212) + ',' + lerp(1, 0.92, k).toFixed(2) + ')');
    s.setProperty('--world-card', 'rgba(' + m(255, 36) + ',' + m(249, 16) + ',' + m(238, 34) + ',' + lerp(0.5, 0.44, k).toFixed(2) + ')');
    s.setProperty('--world-gold', 'rgb(' + m(122, 246) + ',' + m(78, 207) + ',' + m(10, 122) + ')');
    s.setProperty('--world-panel', 'rgba(' + m(255, 32) + ',' + m(250, 14) + ',' + m(241, 30) + ',' + lerp(0.93, 0.88, k).toFixed(2) + ')');
    s.setProperty('--world-card-strong', 'rgba(' + m(253, 34) + ',' + m(246, 15) + ',' + m(232, 32) + ',' + lerp(0.86, 0.88, k).toFixed(2) + ')');
    s.setProperty('--world-halo', 'rgba(' + m(255, 22) + ',' + m(248, 8) + ',' + m(234, 20) + ',' + lerp(0.9, 0.8, k).toFixed(2) + ')');
  }
  function mark(list) { for (var i = 0; i < list.length; i++) visibleNow[list[i]] = true; }

  var fadeNow = -1;
  function setFade(o) {
    o = Math.round(o * 100) / 100;
    if (o === fadeNow) return;
    fadeNow = o;
    fade.style.opacity = o;
    fade.style.visibility = o > 0 ? 'visible' : 'hidden';
  }

  function poke() { need = true; lastInput = performance.now(); }
  function run(on) {
    if (dead || on === running) return;
    running = on;
    if (on) { last = performance.now(); raf = requestAnimationFrame(frame); }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  function onScroll() { poke(); }
  function onPointer(e) {
    poke();
    if (e.pointerType !== 'mouse') return;
    tmx = e.clientX / window.innerWidth * 2 - 1;
    tmy = e.clientY / window.innerHeight * 2 - 1;
  }
  function onVis() { run(!document.hidden); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVis);
  var ro = new ResizeObserver(resize);
  ro.observe(canvas);
  // Layout changes (images arriving, the story's track) move the stops.
  var mainRo = new ResizeObserver(function () { dirtyMeasure = true; poke(); });
  mainRo.observe(document.querySelector('main') || body);
  window.addEventListener('pagehide', onHide);
  window.addEventListener('pageshow', onShow);
  function onHide(e) { run(false); if (!e.persisted) teardown(); }
  function onShow(e) { if (e.persisted) run(true); }
  var lost = false;
  canvas.addEventListener('webglcontextlost', function () { lost = true; fail(new Error('WebGL context lost')); }, false);

  function teardown() {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pagehide', onHide);
    window.removeEventListener('pageshow', onShow);
    ro.disconnect(); mainRo.disconnect();
    try { K.disposeAll(scene); gl.dispose(); if (!lost) gl.forceContextLoss(); } catch (x) {}
  }

  // Take the world down and give the page back to the cream design, keeping
  // the reader where they were.
  function fail(err) {
    if (dead) return;
    dead = true;
    console.warn('[world] falling back to the plain page:', err && err.message || err);
    run(false);
    var main = document.querySelector('main'), anchor = null, offset = 0;
    if (main) {
      var kids = main.children;
      for (var k = 0; k < kids.length; k++) {
        var rc = kids[k].getBoundingClientRect();
        if (rc.bottom > 1 && rc.height > 0) { anchor = kids[k]; offset = rc.top; break; }
      }
    }
    var keep = null;
    Object.keys(places).forEach(function (n) {
      var p = placeOf(n);
      if (p && p.unmount) { var k2 = p.unmount(); if (k2) keep = k2; }
    });
    body.classList.remove('world-on', 'world-gate', 'world-open');
    ['--world-ink', '--world-ink-soft', '--world-card', '--world-card-strong', '--world-halo', '--world-gold', '--world-panel'].forEach(function (p) { root.style.removeProperty(p); });
    failHooks.forEach(function (h) { try { h(err); } catch (x) {} });
    if (keep) keep.scrollIntoView({ block: 'start', behavior: 'instant' });
    else if (anchor) window.scrollBy({ top: anchor.getBoundingClientRect().top - offset, left: 0, behavior: 'instant' });
    canvas.remove(); fade.remove();
    teardown();
  }

  var W = {
    THREE: THREE, K: K, gl: gl, scene: scene, camera: camera, sky: sky, timeline: timeline, small: small, reduce: reduce,
    canvas: canvas, f: f,
    define: define, ensure: ensure, place: placeOf,
    lamp: lamp, poke: poke,
    setOverride: function (fn) { override = fn; poke(); },
    pose: function (y, out) {        // the timeline's camera at scroll y
      var saved = ys; ys = y; var ok = computePose(); ys = saved;
      if (ok) { out.pos.copy(pose.pos); out.tgt.copy(pose.tgt); out.tod = pose.tod; }
      return ok;
    },
    start: function () { resize(); run(!document.hidden); },
    render: function () { try { draw(0); } catch (err) { fail(err); } },
    onFail: function (h) { failHooks.push(h); },
    fail: fail,
    dead: function () { return dead; }
  };
  f.world = W;
  canvas.world = W;        // for inspection from the console (renderer info, fail())
  resize();
  return W;
}
