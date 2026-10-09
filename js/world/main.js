/*
 * The world's entry point: the one module script index.html loads.
 *
 * Without WebGL, with prefers-reduced-data, or if the guest has already
 * tapped through the video gate, it does nothing and the page stays the
 * cream site. Otherwise it registers a gate with js/intro.js straight away
 * (so the tap waits for the 3D doors instead of playing intro.mp4), loads
 * three.js and the first places, and once the doors are drawn sets
 * body.world-on: the door poster fades to the live doors.
 *
 * The tap still runs intro.js's flow inside the user's gesture (the music is
 * primed there, which unlocks audio on iOS); intro.js then calls open(), the
 * doors swing, the camera pushes through, and intro.js's begin() runs as the
 * camera reaches the courtyard. If the world cannot start in time (8 s after
 * a tap), or fails later, the video gate and the cream page come back. The
 * door video is held back while the world loads, so the two never compete
 * for a slow connection; any fallback restores it.
 *
 * After the doors: Our Story mounts its track and builds when idle; the
 * morning courtyard is built as the camera nears it.
 */
function mq(q) { return !!(window.matchMedia && window.matchMedia(q).matches); }
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
function idle(timeout) {
  return new Promise(function (res) {
    if (window.requestIdleCallback) window.requestIdleCallback(function () { res(); }, { timeout: timeout || 1500 });
    else setTimeout(res, 80);
  });
}

var intro = window.weddingIntro;
var body = document.body;
var video = document.querySelector('#intro video');
var VIDEO_SRC = video ? video.getAttribute('src') : null;

if (intro && intro.state() === 'waiting' && !mq('(prefers-reduced-data: reduce)') &&
    'ResizeObserver' in window && 'IntersectionObserver' in window && hasWebGL()) start();

function start() {
  var reduceMotion = mq('(prefers-reduced-motion: reduce)');
  var W = null, gate = null, pending = null, gaveUp = false, openCb = null;

  // Taken by intro.js; the tap lands here.
  intro.useGate({
    open: function (done, fallback) {
      if (gaveUp) return fallback();
      if (gate) return openDoors(done);
      pending = { done: done, fallback: fallback };
      document.getElementById('intro').classList.add('world-wait');
      setTimeout(function () { if (pending) giveUp(new Error('the world took too long to load')); }, 8000);
    }
  });

  function openDoors(done) {
    var called = false;
    openCb = function () { if (called) return; called = true; openCb = null; done(); afterDoors(); };
    gate.open(openCb);
  }

  // The 1.2 MB door video would compete with three.js for the guest's
  // bandwidth: hold it back (the poster stays) unless the world gives up.
  stopVideo();

  function stopVideo() {
    if (!video) return;
    try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {}
  }
  function restoreVideo() {
    if (!video || !VIDEO_SRC || video.getAttribute('src')) return;
    try { video.setAttribute('src', VIDEO_SRC); video.load(); } catch (e) {}
  }

  // Back to the video gate (before the doors are through) or the cream page.
  function giveUp(err, quiet) {
    if (gaveUp) return;
    gaveUp = true;
    if (err && !quiet) console.warn('[world] not starting:', err && err.message || err);
    intro.useGate(null);
    restoreVideo();
    var introEl = document.getElementById('intro');
    if (introEl) introEl.classList.remove('world-wait');
    if (W && !W.dead()) W.fail(err || 'given up');
    if (openCb) openCb();                       // mid-opening: just let the guest in
    if (pending) { var p = pending; pending = null; p.fallback(); }
  }

  Promise.all([
    import('../immersive/kit.js'), import('./engine.js'), import('./land.js'),
    import('./places/gate.js'), import('./places/court.js')
  ]).then(function (m) {
    if (gaveUp) return null;
    var K = m[0], E = m[1], L = m[2], Gate = m[3], Court = m[4];
    W = E.createWorld(K, { reduceMotion: reduceMotion });
    W.onFail(function (err) { giveUp(err, true); });
    var court = W.timeline.add({ name: 'court', places: ['gate', 'dawn'], pose: Court.courtPose('dawn', L.COURT_DAWN) });
    var morning = W.timeline.add({ name: 'morning', places: ['morning'], arc: 9, mist: 0.2, pose: Court.courtPose('morning', L.COURT_MORNING) });
    W.define('gate', function () { var p = Gate.build(W, { origin: L.COURT_DAWN }); p.stop = court; return p; });
    W.define('dawn', function () { var p = Court.build(W, { variant: 'dawn', origin: L.COURT_DAWN }); p.stop = court; return p; });
    W.define('morning', function () {
      return idle(1500).then(function () { var p = Court.build(W, { variant: 'morning', origin: L.COURT_MORNING }); p.stop = morning; return p; });
    });
    return Promise.all([W.ensure('gate'), W.ensure('dawn')]);
  }).then(function (built) {
    if (!built || gaveUp) return;
    if (!built[0] || !built[1]) throw new Error('the gate could not be built');
    if (intro.state() === 'begun') { giveUp(null); return; }   // the guest is already in
    gate = built[0];
    gate.hold();
    W.start();
    W.render();
    if (W.dead()) return;
    body.classList.add('world-on', 'world-gate');
    // Fetch Our Story while the guest reads the names.
    storyModule = import('./places/story.js');
    storyModule.catch(function () {});
    if (pending) { var p = pending; pending = null; document.getElementById('intro').classList.remove('world-wait'); openDoors(p.done); }
  }).catch(function (err) { giveUp(err); });

  var storyModule = null;
  function afterDoors() {
    // Mount the story once the page has faded in; its scene builds when idle.
    setTimeout(function () {
      if (!W || W.dead()) return;
      (storyModule || import('./places/story.js')).then(function (S) {
        if (W.dead()) return;
        var m = S.mount(W);
        if (!m) return;
        W.timeline.add(m.stop);
        W.define('story', m.build);
        W.poke();
      }).catch(function (err) { console.warn('[world] Our Story could not load:', err); });
    }, 1300);
  }
}
