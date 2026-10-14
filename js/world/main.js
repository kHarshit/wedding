/*
 * The world's entry point: the one module script index.html loads.
 *
 * A tiny script in index.html's head has already looked for WebGL and
 * prefers-reduced-data, and set html.world-likely, which shows a still of
 * the 3D gate (assets/images/gate-tall.webp / gate-wide.webp, rendered from
 * the scene) while three.js loads. Without that class, or if the guest has
 * already tapped through the video gate, this does nothing and the page
 * stays the cream site. Otherwise it registers a gate with js/intro.js straight away
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
 * The stops, in page order: the shrine (#invite, in the dawn court's
 * pavilion), the two homes (#invitation), the terrace (.count-sec), Our
 * Story, and the morning court (the rest, until Phases 3-4). After the
 * doors, the homes', terrace's and story's code arrives and each builds
 * when the browser is idle; the morning court as the camera nears it.
 */
function mq(q) { return !!(window.matchMedia && window.matchMedia(q).matches); }
function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
// Fetching with retries: a patchy phone connection may drop a file now and
// then. Each file is fetched (and retried) before it is imported, because a
// failed import is remembered for its URL and can't simply be repeated.
function fetchRetry(url, n) {
  return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url); return r.blob(); })
    .catch(function (e) { if (n >= 3) throw e; return wait(400 * (n + 1) * (n + 1)).then(function () { return fetchRetry(url, n + 1); }); });
}
// A later place's module (it only imports modules that are already loaded):
// fetch it with retries, import it, and if the import still fails, import it
// again under another name.
var needed = {};
function need(path) {
  if (needed[path]) return needed[path];
  var url = new URL(path, import.meta.url).href, tries = 0;
  var p = needed[path] = fetchRetry(url, 0).catch(function () {}).then(function attempt() {
    return import(tries ? url + '?retry=' + tries : url).catch(function (e) {
      if (++tries > 2) throw e;
      return wait(600 * tries).then(function () { return fetchRetry(url + '?retry=' + tries, 1).catch(function () {}); }).then(attempt);
    });
  });
  p.catch(function () { if (needed[path] === p) delete needed[path]; });
  return p;
}
// The invitation's two families, each in a half of its own, so each can
// rest before its own home (css/world.css lays them out); put back on fallback.
function splitInvitation(on) {
  var card = document.querySelector('#invitation .card');
  if (!card) return;
  if (on) {
    if (card.querySelector('.card-half')) return;
    var labels = card.querySelectorAll(':scope > .person-label');
    Array.prototype.forEach.call(labels, function (label, i) {
      var half = document.createElement('div');
      half.className = 'card-half ' + (i ? 'bride' : 'groom');
      card.insertBefore(half, label);
      for (var n = label; n && !n.classList.contains('card-divider') && !n.classList.contains('card-close');) {
        var next = n.nextElementSibling; half.appendChild(n); n = next;
      }
    });
  } else {
    Array.prototype.forEach.call(card.querySelectorAll(':scope > .card-half'), function (half) {
      while (half.firstChild) card.insertBefore(half.firstChild, half);
      half.remove();
    });
  }
}
// Build when the browser is idle, or at once if the camera already needs it.
var worldRef = null;
function idleFor(name) {
  return new Promise(function (res) {
    if (worldRef && worldRef.wants(name)) return res();
    var done = false, go = function () { if (!done) { done = true; res(); } };
    if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 80);
    // Check again every frame: a fling may want it before the browser is idle.
    (function poll() { if (done) return; if (worldRef && worldRef.wants(name)) go(); else requestAnimationFrame(poll); })();
  });
}
function idle(timeout) {
  return new Promise(function (res) {
    if (window.requestIdleCallback) window.requestIdleCallback(function () { res(); }, { timeout: timeout || 1500 });
    else setTimeout(res, 80);
  });
}

var intro = window.weddingIntro;
var body = document.body, root = document.documentElement;
var themeMeta = document.querySelector('meta[name="theme-color"]'), themeCream = themeMeta && themeMeta.getAttribute('content');
var video = document.querySelector('#intro video');
var VIDEO_SRC = video ? video.getAttribute('src') : null;

// index.html's head script has already checked for WebGL and reduced data
// (html.world-likely, which also shows the gate's still while we load).
if (intro && intro.state() === 'waiting' && root.classList.contains('world-likely') &&
    'ResizeObserver' in window && 'IntersectionObserver' in window) start();
else root.classList.remove('world-likely');

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
    if (window.weddingSections) window.weddingSections.useWorld(null);
    storyBeats = null;
    root.classList.remove('world-likely');
    splitInvitation(false);
    if (themeMeta) themeMeta.setAttribute('content', themeCream);
    restoreVideo();
    var introEl = document.getElementById('intro');
    if (introEl) introEl.classList.remove('world-wait');
    if (W && !W.dead()) W.fail(err || 'given up');
    if (openCb) openCb();                       // mid-opening: just let the guest in
    if (pending) { var p = pending; pending = null; p.fallback(); }
  }

  // The gate's files are already downloading (with retries) from index.html's
  // head; import once they are in the cache.
  Promise.resolve(window.__worldWarm).catch(function () {}).then(function () {
    return Promise.all([
      import('../immersive/kit.js'), import('./engine.js'), import('./land.js'),
      import('./places/gate.js'), import('./places/court.js'), import('./places/shrine.js')
    ]);
  }).then(function (m) {
    if (gaveUp) return null;
    var K = m[0], E = m[1], L = m[2], Gate = m[3], Court = m[4], Shrine = m[5];
    W = E.createWorld(K, { reduceMotion: reduceMotion });
    worldRef = W;
    W.onFail(function (err) { giveUp(err, true); });
    // The stops, in page order (the story adds its own once it mounts).
    var shrine = W.timeline.add({ name: 'shrine', places: ['gate', 'dawn', 'shrine'], pose: Shrine.shrinePose(L.COURT_DAWN) });
    // Up over the shrine's lamp towers (not past them), then down the lane.
    var homes = W.timeline.add({ name: 'homes', places: ['homes', 'terrace'], mist: 0.1,
                                 via: function (f, P, T) { var tall = f.aspect < 0.9; P.set(tall ? 9 : 15, tall ? 15 : 19, 98); T.set(tall ? -2 : -6, 6, 62); }, span: function () { return homesSpan(); },
                                 pose: function (u, out, f) { homesPose(u, out, f); } });
    var terrace = W.timeline.add({ name: 'terrace', places: ['terrace', 'story'], arc: 8, tilt: 0.15, span: [0.25, 0.5],
                                   pose: function (u, out, f) { terracePose(u, out, f); } });
    // The celebrations: the events header and each event card have a place and an hour of their own.
    // Out of the story's night: rise high over the trees, turn to the dawn
    // breaking over the ridge (the sky passes through 6:30, with rays), then
    // come down into the Haldi court through a drift of marigold petals.
    var haldi = W.timeline.add({ name: 'haldi', places: ['haldi'], through: 6.6, rays: 1.2, haze: '#fff0d0', hazeAmt: 0.15, petals: 3, mist: -0.75,
                                 via: function (f, P, T) {
                                   var tall = f.aspect < 0.9;
                                   P.set(tall ? 2 : 4, tall ? 52 : 54, tall ? -40 : -36);
                                   T.set(tall ? 26 : 48, tall ? 34 : 36, tall ? -100 : -100);
                                 },
                                 span: [0.75, 0.75], pose: function (u, out, f) { celebPose('haldi', u, out, f); } });
    var baraat = W.timeline.add({ name: 'baraat', places: ['baraat', 'hall'], arc: 7, tilt: 0.2, haze: '#ffb060', petals: 1.6, mist: 0.1,
                                  span: [0.75, 0.75], pose: function (u, out, f) { celebPose('baraat', u, out, f); } });
    var hall = W.timeline.add({ name: 'hall', places: ['hall'], arc: 1.2, tilt: 0, petals: 0.8,
                                span: [0.75, 0.75], pose: function (u, out, f) { celebPose('hall', u, out, f); } });
    // The closing: high over the estate for the Venue's night map, down to the
    // midnight pavilion for the RSVP, and up again into the dawn for the footer.
    var venue = W.timeline.add({ name: 'venue', places: ['estate'], span: [0.6, 0.35], via: function (f, P, T) { P.set(2, 78, -176); T.set(f.aspect < 0.9 ? 18 : 34, 0, -198); },
                                 pose: function (u, out, f) { closePose('map', u, out, f); } });
    var rsvp = W.timeline.add({ name: 'rsvp', places: ['pavilion', 'hall'], span: [0.55, 0.85],
                                via: function (f, P, T) { P.set(26, 38, -206); T.set(2, 4, -252); },
                                pose: function (u, out, f) { closePose('pavilion', u, out, f); } });
    var dawn = W.timeline.add({ name: 'dawn', places: ['estate', 'pavilion', 'hall'], span: [0.85, 0], through: 30.2, rays: 1, mist: -0.6,
                                via: function (f, P, T) { P.set(14, 78, -256); T.set(70, f.aspect < 0.9 ? 40 : 24, -300); },
                                pose: function (u, out, f) { closePose('dawn', u, out, f); } });
    W.define('gate', function () { var p = Gate.build(W, { origin: L.COURT_DAWN }); p.stop = shrine; return p; });
    W.define('dawn', function () { var p = Court.build(W, { variant: 'dawn', origin: L.COURT_DAWN }); p.stop = shrine; return p; });
    W.define('shrine', function () { var p = Shrine.build(W, { origin: L.COURT_DAWN }); p.stop = shrine; return p; });
    // Later places load their own code, and build when the browser is idle.
    W.define('homes', function () { return homesMod.then(function (H) { return idleFor('homes').then(function () { var p = H.build(W); p.stop = homes; return p; }); }); });
    W.define('terrace', function () { return terraceMod.then(function (T) { return idleFor('terrace').then(function () { var p = T.build(W); p.stop = terrace; return p; }); }); });
    W.define('estate', function () {
      return need('./places/estate.js').then(function (E2) {
        closePoses.map = E2.mapPose; closePoses.dawn = E2.dawnPose;
        return idleFor('estate').then(function () { var p = E2.build(W); p.stop = venue; return p; });
      });
    });
    W.define('pavilion', function () {
      return need('./places/pavilion.js').then(function (P2) {
        closePoses.pavilion = P2.pose;
        return idleFor('pavilion').then(function () { var p = P2.build(W); p.stop = rsvp; return p; });
      });
    });
    [['haldi', haldi], ['baraat', baraat], ['hall', hall]].forEach(function (d) {
      W.define(d[0], function () {
        return need('./places/' + d[0] + '.js').then(function (P) {
          celebPoses[d[0]] = P.pose;
          return idleFor(d[0]).then(function () { var p = P.build(W); p.stop = d[1]; return p; });
        });
      });
    });
    return Promise.all([W.ensure('gate'), W.ensure('dawn'), W.ensure('shrine')]);
  }).then(function (built) {
    if (!built || gaveUp) return;
    if (!built[0] || !built[1] || !built[2]) throw new Error('the gate could not be built');
    if (intro.state() === 'begun') { giveUp(null); return; }   // the guest is already in
    gate = built[0];
    gate.hold();
    W.start();
    W.render();
    if (W.dead()) return;
    splitInvitation(true);
    body.classList.add('world-on', 'world-gate');
    tellSections();
    if (themeMeta) themeMeta.setAttribute('content', '#1a1020');
    // Fetch the next places' code while the guest reads the names.
    storyModule = need('./places/story.js');
    storyModule.catch(function () {});
    fetchLater();
    if (pending) { var p = pending; pending = null; document.getElementById('intro').classList.remove('world-wait'); openDoors(p.done); }
  }).catch(function (err) { giveUp(err); });

  var storyModule = null, homesMod = null, terraceMod = null, storyBeats = null;
  // Previous / Next (js/sections.js) land inside the stops' ranges and on the
  // story's panels, and wait for a place to be built before gliding into it.
  function tellSections() {
    var A = window.weddingSections;
    if (!A) return;
    A.useWorld({
      measure: function () { if (W && !W.dead()) W.timeline.measure(window.innerHeight); },
      range: function (name) {
        var st = W.timeline.stops;
        for (var i = 0; i < st.length; i++) if (st[i].name === name) return [st[i].y0, st[i].y1];
        return null;
      },
      story: function () { return storyBeats && !W.dead() ? storyBeats() : null; },
      // true when every place on the way from y a to y b is built, else a promise for them.
      ready: function (a, b) {
        if (!W || W.dead()) return true;
        var lo = Math.min(a, b), hi = Math.max(a, b), names = {}, waits = [];
        W.timeline.stops.forEach(function (s) { if (s.y1 >= lo - 1 && s.y0 <= hi + 1) s.places.forEach(function (n) { names[n] = true; }); });
        Object.keys(names).forEach(function (n) { if (W.place(n)) return; var p = W.ensure(n); if (p && p.then) waits.push(p); });
        return waits.length ? Promise.all(waits) : true;
      }
    });
  }
  // Each celebration's camera comes with its code; until then a stand-in on its axis.
  var celebPoses = {}, CELEB_Z = { haldi: -92, baraat: -140, hall: -198 }, CELEB_TOD = { haldi: 9.2, baraat: 18.4, hall: 21.8 };
  var closePoses = {};
  var CLOSE = { map: [[50, 180, -92], [56, 0, -162], 23.0, -0.6], pavilion: [[0, 2.3, -228], [0, 2.3, -250], 24.0, 0], dawn: [[-62, 32, 40], [28, 0, -72], 30.4, -0.7] };
  function closePose(name, u, out, f) {
    if (closePoses[name]) return closePoses[name](u, out, f);
    var c = CLOSE[name]; out.pos.fromArray(c[0]); out.tgt.fromArray(c[1]); out.tod = c[2]; out.mist = c[3];
  }
  function celebPose(name, u, out, f) {
    if (celebPoses[name]) return celebPoses[name](u, out, f);
    out.pos.set(0, 3, CELEB_Z[name] + 12); out.tgt.set(0, 3, CELEB_Z[name] - 10); out.tod = CELEB_TOD[name]; out.mist = 0;
  }
  var homesPose = function (u, out, f) { out.pos.set(0, 3, 80); out.tgt.set(0, 3, 56); out.tod = 8.5; out.mist = 0; };
  var homesSpan = function () { return [0.3, 0.15]; };
  var terracePose = function (u, out) { out.pos.set(0, 8.8, 53); out.tgt.set(0, 6.5, 18); out.tod = 17; out.mist = 0; };
  function fetchLater() {
    homesMod = need('./places/homes.js');
    homesMod.then(function (H) { homesPose = H.homesPose; homesSpan = H.homesSpan; if (W) W.poke(); }).catch(function () {});
    terraceMod = need('./places/terrace.js');
    terraceMod.then(function (T) { terracePose = T.terracePose; if (W) W.poke(); }).catch(function () {});
  }
  function afterDoors() {
    var sh = W && W.place('shrine');
    if (sh) sh.arrive();
    // Measure the frame rate as the guest settles in (it may drop a tier).
    setTimeout(function () { if (W && !W.dead()) W.startProbe(); }, 600);
    // Fetch the rest of the places' code while the guest reads (small, cached),
    // so a fast fling to the end never waits on the network.
    setTimeout(function () {
      ['haldi', 'baraat', 'hall', 'estate', 'pavilion'].forEach(function (n) { need('./places/' + n + '.js').catch(function () {}); });
    }, 2500);
    // Mount the story once the page has faded in; its scene builds when idle.
    setTimeout(function () {
      if (!W || W.dead()) return;
      (storyModule || need('./places/story.js')).then(function (S) {
        if (W.dead()) return;
        var m = S.mount(W);
        if (!m) return;
        storyBeats = m.beats;
        W.timeline.add(m.stop);
        W.define('story', m.build);
        W.poke();
      }).catch(function (err) { console.warn('[world] Our Story could not load:', err); });
    }, 1300);
  }
}
