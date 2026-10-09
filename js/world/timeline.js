/*
 * The scroll timeline: which stop the camera is at, or which two it is
 * travelling between.
 *
 * Each section carries data-stop="<name>"; neighbouring sections with the
 * same name form one stop. A stop holds while its sections fill the screen
 * (from its first section's top reaching the top of the screen until its
 * last section's bottom reaches the bottom), unless its place gives its own
 * range (the story's sticky track), or a span [a, b]: it then starts when
 * its first section's top is a screens down from the top of the screen, and
 * ends when its last section's bottom is b screens up from the bottom. The gaps between stops are the travel
 * segments, where the camera flies from one place to the next.
 *
 * Within a stop, keyframes follow the pattern Our Story set: a table of rows
 * [at, col0, col1, ...] with named columns, smoothed between rows.
 */
import { clamp, smooth, lerp } from './lib.js';

// keyed(rows) -> sample(u): the row at u, eased between keyframes.
export function keyed(rows) {
  var row = new Array(rows[0].length - 1);
  return function sample(u) {
    var last = rows[rows.length - 1], j;
    if (u >= last[0]) { for (j = 1; j < last.length; j++) row[j - 1] = last[j]; return row; }
    if (u <= rows[0][0]) { for (j = 1; j < last.length; j++) row[j - 1] = rows[0][j]; return row; }
    for (var i = 0; i < rows.length - 1; i++) {
      var a = rows[i], b = rows[i + 1];
      if (u <= b[0]) {
        var t = smooth(a[0], b[0], u);
        for (j = 1; j < a.length; j++) row[j - 1] = lerp(a[j], b[j], t);
        return row;
      }
    }
    return row;
  };
}
// cols(['px', 'py', ...]) -> { px: 0, py: 1, ... }
export function cols(names) { var C = {}; names.forEach(function (n, i) { C[n] = i; }); return C; }

export function createTimeline() {
  var stops = [], maxY = 0;

  // stop: { name, places: [...], pose(local, out), local?(y, vh), range?(vh) }
  function add(stop) {
    stop.els = Array.prototype.slice.call(document.querySelectorAll('[data-stop="' + stop.name + '"]'));
    stop.y0 = stop.y1 = 0;
    stops.push(stop);
    stops.sort(function (a, b) { return docTop(a.els[0]) - docTop(b.els[0]); });
    return stop;
  }
  function docTop(el) { return el ? el.getBoundingClientRect().top + window.scrollY : 0; }

  function measure(vh) {
    var sy = window.scrollY;
    // A stop whose sections aren't on the page plays no part.
    for (var d = stops.length - 1; d >= 0; d--) if (!stops[d].range && !stops[d].els.length) stops.splice(d, 1);
    stops.forEach(function (s) {
      if (s.range) { var rg = s.range(vh); s.y0 = rg[0]; s.y1 = rg[1]; return; }
      var top = Infinity, bottom = -Infinity;
      s.els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        top = Math.min(top, r.top + sy); bottom = Math.max(bottom, r.bottom + sy);
      });
      var sp = typeof s.span === 'function' ? s.span() : s.span;
      var a = sp ? sp[0] : 0, b = sp ? sp[1] : 0;
      s.y0 = top - a * vh; s.y1 = Math.max(s.y0, bottom - vh + b * vh);
    });
    maxY = Math.max(0, document.documentElement.scrollHeight - vh);
    for (var i = 0; i < stops.length; i++) {
      if (i === 0) stops[i].y0 = Math.min(stops[i].y0, 0);
      if (i > 0 && stops[i].y0 < stops[i - 1].y1) stops[i].y0 = stops[i - 1].y1;
      if (stops[i].y1 < stops[i].y0) stops[i].y1 = stops[i].y0;
    }
    if (stops.length) stops[stops.length - 1].y1 = Math.max(stops[stops.length - 1].y1, maxY);
  }

  function localAt(s, y, vh) {
    if (s.local) return s.local(y, vh);
    return s.y1 > s.y0 ? clamp((y - s.y0) / (s.y1 - s.y0), 0, 1) : 0;
  }

  // Where is y? Fills out = { a, b, t, la, lb }: in a stop when b is null
  // (la is its local position), else travelling from a to b (0 <= t <= 1).
  function locate(y, vh, out) {
    out.a = out.b = null; out.t = 0;
    if (!stops.length) return out;
    for (var i = 0; i < stops.length; i++) {
      var s = stops[i];
      if (y < s.y0 && i > 0) {
        var p = stops[i - 1];
        out.a = p; out.b = s; out.t = clamp((y - p.y1) / Math.max(1, s.y0 - p.y1), 0, 1);
        out.la = localAt(p, p.y1, vh); out.lb = localAt(s, s.y0, vh);
        return out;
      }
      if (y <= s.y1 || i === stops.length - 1) { out.a = s; out.la = localAt(s, Math.min(y, s.y1), vh); return out; }
    }
    return out;
  }

  return { stops: stops, add: add, measure: measure, locate: locate, maxY: function () { return maxY; } };
}
