/*
 * Shared three.js helpers for the immersive "Our Story" scene.
 *
 * A trimmed copy of the kit behind the immersive poems on kharshit.github.io
 * (js/site/immersive/kit.js): three.js is pinned here, in one place, and the
 * scene builds its world from these pieces. story.js imports this file only
 * when the story section comes near, so three.js never slows the intro.
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

export { THREE };

// Phones and tablets get lighter scenes: fewer instances, lower resolution.
export function isSmall() {
  return window.innerWidth < 800 || !window.matchMedia('(pointer: fine)').matches;
}

export function makeRenderer(canvas, opts) {
  var gl = new THREE.WebGLRenderer({
    canvas: canvas, antialias: true, powerPreference: 'high-performance', alpha: false
  });
  gl.setClearColor((opts && opts.clear) || '#1a1020');
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = (opts && opts.exposure) || 1;
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.shadowMap.enabled = false;
  return gl;
}

// ── Geometry ─────────────────────────────────────────────────────────────
// Give a geometry one flat vertex colour (non-indexed, so it can be merged).
export function tinted(geo, color) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  var c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (var i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

// Concatenate tinted() geometries into one (position, normal, colour).
export function merge(geos) {
  var total = 0;
  geos.forEach(function (g) { total += g.attributes.position.count; });
  var out = new THREE.BufferGeometry();
  ['position', 'normal', 'color'].forEach(function (name) {
    var arr = new Float32Array(total * 3), o = 0;
    geos.forEach(function (g) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; });
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  });
  geos.forEach(function (g) { g.dispose(); });
  return out;
}

// A broadleaf tree about 6 m tall: a trunk and a few low-poly leaf clumps.
// The crown is white so per-instance colours tint it.
export function broadleafGeometry(r, bark) {
  var parts = [tinted(new THREE.CylinderGeometry(0.14, 0.24, 3.4, 6).translate(0, 1.7, 0), bark || '#4a3a2e')];
  parts.push(tinted(new THREE.CylinderGeometry(0.05, 0.09, 1.6, 4).rotateZ(0.7).translate(0.5, 3.1, 0), bark || '#4a3a2e'));
  for (var k = 0; k < 5; k++) {
    var rad = 1.1 + r() * 0.7, a = r() * Math.PI * 2, d = k === 0 ? 0 : 0.7 + r() * 0.5;
    parts.push(tinted(new THREE.IcosahedronGeometry(rad, 0)
      .scale(1, 0.85, 1)
      .translate(Math.cos(a) * d, 4.2 + r() * 1.4 + (k === 0 ? 0.6 : 0), Math.sin(a) * d), '#ffffff'));
  }
  return merge(parts);
}

// A soft round sprite on a canvas: `inner` at the centre fading to `outer`.
export function softSprite(inner, outer) {
  var c = document.createElement('canvas');
  c.width = c.height = 64;
  var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(0.4, inner.replace(/[\d.]+\)$/, '0.55)'));
  g.addColorStop(1, outer);
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  var t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Stars on a sphere; `minY` keeps them above the horizon.
export function starField(r, count, radius, minY, size) {
  var pos = [];
  for (var i = 0; i < count; i++) {
    var th = r() * Math.PI * 2, y = minY + r() * (1 - minY), s = Math.sqrt(1 - y * y);
    pos.push(radius * s * Math.cos(th), radius * y, radius * s * Math.sin(th));
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  var mat = new THREE.PointsMaterial({ color: '#f4ecff', size: size || 1.6, sizeAttenuation: false, fog: false,
                                       transparent: true, opacity: 0.85, depthWrite: false });
  return new THREE.Points(geo, mat);
}

// ── Teardown ─────────────────────────────────────────────────────────────
// Free a scene's GPU resources, then the renderer if one is given.
export function disposeAll(world, gl) {
  world.traverse(function (o) {
    if (o.geometry) o.geometry.dispose();
    var mats = o.material ? [].concat(o.material) : [];
    mats.forEach(function (m) {
      ['map', 'alphaMap', 'emissiveMap'].forEach(function (k) { if (m[k]) m[k].dispose(); });
      if (m.uniforms) Object.keys(m.uniforms).forEach(function (k) { var v = m.uniforms[k].value; if (v && v.isTexture) v.dispose(); });
      m.dispose();
    });
  });
  if (!gl) return;
  gl.dispose();
  gl.forceContextLoss();
}
