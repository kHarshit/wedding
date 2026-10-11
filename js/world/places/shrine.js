/*
 * The shrine: Ganesha in the dawn courtyard's pavilion, where the camera
 * comes to rest as the doors let the guest in, beside the shloka.
 *
 * A carved sandstone screen with a cusped, vermilion niche; a lotus pedestal;
 * the murti (assets/images/ganesha.webp, the same image the page shows) as a
 * gilded relief before a gold prabhavali; nine brass diyas in an arc that
 * light one by one once the page has opened (arrive()); a brass bell under
 * the toran that swings as you arrive; incense curling up beside it; a thali
 * of flowers, and marigold and rose petals strewn at its foot. The court's
 * two lamp towers flank it. Coordinates are the court's (pavilion at z = PZ).
 */
import { THREE, clamp, lerp, smooth, rng, col, box, pointedArch, notchShape, shiftPts, Garlands, PointSet, pointKit,
         GLOW_F, HALO_F, FLAME_F, diyaGeometry, worldUV, stoneTexture, groundShade } from '../lib.js';
import { tinted, merge } from '../../immersive/kit.js';

var PZ = -37.2, PH0 = 1.0, PT = 4.6, PW = 3.1;
var NICHE_Z = PZ - 2.05, MURTI_Y = PH0 + 0.52;

// The camera at the shrine, for the timeline: far enough back to see the
// whole temple, from its steps to the flag on its tower. On landscape
// screens it sits right of centre (the shloka is on the left); on portrait
// ones it sits low, the tower's flag below the shloka at the top.
export function shrinePose(o) {
  return function (u, out, f) {
    var port = smooth(1.25, 0.6, f.aspect);
    out.pos.set(o.x + lerp(0.6, 0, port), lerp(2.5, 2.2, port), o.z + lerp(-19.6, -15.8, port));
    out.tgt.set(o.x + lerp(-2.9, 0, port), lerp(6.4, 9.5, port), o.z + PZ);
    out.tod = 6.2;
    out.mist = 0;
  };
}

var SMOKE_F = 'uniform float uTime; varying vec3 vCol; varying float vA; varying float vPx; varying float vSeed;\n' +
  'void main(){ vec2 p = gl_PointCoord - 0.5; float d2 = dot(p, p);\n' +
  ' float a = exp(-d2 * 9.0) * vA; if (a < 0.004) discard;\n' +
  ' gl_FragColor = vec4(vCol, a);\n #include <colorspace_fragment>\n}';

export function build(W, opts) {
  var small = W.small, o = opts.origin, r = rng(108);
  var group = new THREE.Group();
  group.position.set(o.x, 0, o.z);
  var U = { uTime: { value: 0 }, uScale: { value: 600 }, uFogD: { value: 0.004 }, uLight: { value: 0 }, uLit: { value: 1 } };
  var pk = pointKit(U, group);
  var G = new Garlands();
  var g = [];
  var STONE = '#e6c9a2', TRIM = '#f4e2c2', RED = '#9e2a22', GOLD = '#d9a441';

  // ── The carved screen and its niche ────────────────────────────────────
  var niche = pointedArch(1.9, 1.75, 2.95, 9, 0.1, 20);
  g.push(tinted(new THREE.ExtrudeGeometry(notchShape(-2.25, 2.25, 3.25, [niche]), { depth: 0.3, bevelEnabled: false }).translate(0, PH0, NICHE_Z - 0.15), STONE));
  // A trim band round the niche, and a red one outside it.
  var bandOut = pointedArch(2.25, 1.75, 3.2, 0, 0, 20);
  var band = new THREE.Shape(); band.moveTo(bandOut[0][0], bandOut[0][1]);
  bandOut.forEach(function (p) { band.lineTo(p[0], p[1]); });
  for (var i = niche.length - 1; i >= 0; i--) band.lineTo(niche[i][0], niche[i][1]);
  g.push(tinted(new THREE.ExtrudeGeometry(band, { depth: 0.06, bevelEnabled: false }).translate(0, PH0, NICHE_Z + 0.15), TRIM));
  // Pilasters and a cornice on the screen.
  [-1, 1].forEach(function (s) {
    box(g, s * 2.05 - 0.14, s * 2.05 + 0.14, PH0, PH0 + 3.0, NICHE_Z + 0.15, NICHE_Z + 0.27, TRIM);
    g.push(tinted(new THREE.CylinderGeometry(0.2, 0.12, 0.2, 10).translate(s * 2.05, PH0 + 3.05, NICHE_Z + 0.22), TRIM));
  });
  box(g, -2.4, 2.4, PH0 + 3.25, PH0 + 3.42, NICHE_Z - 0.2, NICHE_Z + 0.32, RED);
  // The niche's back: vermilion, with a gold prabhavali behind the murti.
  box(g, -1.0, 1.0, PH0, PH0 + 2.95, NICHE_Z - 0.2, NICHE_Z - 0.15, RED);
  var halo = tinted(new THREE.TorusGeometry(0.7, 0.05, 6, 40).translate(0, MURTI_Y + 0.86, NICHE_Z - 0.12), GOLD);
  g.push(halo);
  for (var k = 0; k < 18; k++) {
    var a = k / 18 * Math.PI * 2;
    g.push(tinted(new THREE.ConeGeometry(0.05, 0.16, 4).rotateZ(a - Math.PI / 2).translate(Math.cos(a) * 0.8, MURTI_Y + 0.86 + Math.sin(a) * 0.8, NICHE_Z - 0.12), GOLD));
  }
  // The lotus pedestal.
  var pedProf = [[0, 0], [0.62, 0], [0.62, 0.1], [0.5, 0.16], [0.56, 0.3], [0.46, 0.44], [0.32, 0.5], [0, 0.5]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  g.push(tinted(new THREE.LatheGeometry(pedProf, 20).translate(0, PH0, NICHE_Z + 0.42), '#c99a5a'));
  for (k = 0; k < 16; k++) {
    var b = k / 16 * Math.PI * 2;
    g.push(tinted(new THREE.SphereGeometry(1, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.13, 0.2, 0.05).rotateX(-0.35)
      .translate(0, PH0 + 0.3, 0.5).rotateY(b).translate(0, 0, NICHE_Z + 0.42), k % 2 ? '#f6a8b8' : '#ffd0d8'));
  }
  // A thali of flowers and kumkum before it.
  g.push(tinted(new THREE.CylinderGeometry(0.3, 0.27, 0.035, 20).translate(0.0, PH0 + 0.02, NICHE_Z + 1.25), GOLD));
  for (k = 0; k < 14; k++) G.ball(Math.cos(k * 2.4) * 0.18 * Math.sqrt(k / 14), PH0 + 0.07, NICHE_Z + 1.25 + Math.sin(k * 2.4) * 0.18 * Math.sqrt(k / 14), 0.05, k % 4 === 3 ? G.ROSE : null);
  g.push(tinted(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10).translate(0.15, PH0 + 0.06, NICHE_Z + 1.12), '#c4142a'));
  // A garland following the niche, and strands either side.
  niche.forEach(function (p, j) { if (j % 2 === 0 && p[1] > 0.3) G.ball(p[0] * 1.08, PH0 + p[1] + 0.06, NICHE_Z + 0.24, 0.06, j % 6 === 0 ? G.ROSE : null); });
  [-1, 1].forEach(function (s) { G.strand(s * 1.25, PH0 + 1.8, NICHE_Z + 0.26, 15, 0.11, 0.058, 5); });
  // A garland round the murti's shoulders.
  for (k = 0; k <= 16; k++) { var t = k / 16, ga = lerp(-1.25, 1.25, t); G.ball(Math.sin(ga) * 0.42, MURTI_Y + 0.88 - Math.cos(ga) * 0.42, NICHE_Z + 0.02 + Math.cos(ga) * 0.1, 0.045, k % 4 === 2 ? G.ROSE : null); }

  // ── The murti ──────────────────────────────────────────────────────────
  var tex = new THREE.TextureLoader().load('assets/images/ganesha.webp');
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  var murtiMat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.45, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.22, side: THREE.DoubleSide });
  var murti = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 1.62), murtiMat);
  murti.position.set(0, MURTI_Y + 0.79, NICHE_Z + 0.02);
  group.add(murti);

  // ── Nine brass diyas in an arc ─────────────────────────────────────────
  var diyas = new PointSet(), ND = 9;
  for (k = 0; k < ND; k++) {
    var da = lerp(-1.05, 1.05, k / (ND - 1));
    // aData.x: the order they light in, from the middle outwards.
    var order = Math.abs(k - (ND - 1) / 2);
    diyas.add(Math.sin(da) * 1.18, PH0 + 0.02, NICHE_Z + 0.42 + Math.cos(da) * 1.0, order, r(), 0, 1);
  }
  var bowlMat = new THREE.MeshPhongMaterial({ color: '#c8922e', specular: '#ffe0a0', shininess: 50, emissive: '#2a1404' });
  var bowls = new THREE.InstancedMesh(diyaGeometry(small ? 8 : 12), bowlMat, ND);
  var mtx = new THREE.Matrix4();
  for (k = 0; k < ND; k++) bowls.setMatrixAt(k, mtx.makeScale(1.3, 1.3, 1.3).setPosition(diyas.p[k * 3], diyas.p[k * 3 + 1], diyas.p[k * 3 + 2]));
  group.add(bowls);
  var LIT = 'float lit(){ return smoothstep(aData.x * 0.42, aData.x * 0.42 + 0.35, uLight); }\n';
  pk.add(diyas, LIT + 'vec4 place(){ vCol = vec3(1.0, 0.56, 0.2); float fl = 0.86 + 0.14 * sin(uTime * (7.0 + aData.y * 5.0) + aData.y * 40.0);\n' +
    ' return vec4(position + vec3(0.0, 0.2, 0.0), lit() * fl); }\n', [[HALO_F, 0.75, 2.4, 1, false, 2], [FLAME_F, 0.24, 1.6, 2]]);

  // ── The bell ───────────────────────────────────────────────────────────
  var bellProf = [[0.01, 0], [0.2, 0], [0.19, 0.05], [0.15, 0.14], [0.12, 0.26], [0.09, 0.32], [0.04, 0.35], [0, 0.36]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var bellGeo = merge([
    tinted(new THREE.LatheGeometry(bellProf, 16), '#ffffff'),
    tinted(new THREE.SphereGeometry(0.045, 8, 5).translate(0, 0.02, 0), '#ffffff'),
    tinted(new THREE.TorusGeometry(0.035, 0.012, 5, 10).translate(0, 0.4, 0), '#ffffff'),
    tinted(new THREE.CylinderGeometry(0.01, 0.01, 0.7, 4).translate(0, 0.78, 0), '#a07020')
  ]);
  var brass = new THREE.MeshPhongMaterial({ vertexColors: true, color: '#c8922e', specular: '#ffe6b0', shininess: 60, emissive: '#2a1404' });
  var bell = new THREE.Group();
  bell.position.set(0, PT - 1.33, PZ + PW + 0.12);     // pivot at the top of its chain
  var bellMesh = new THREE.Mesh(bellGeo, brass);
  bellMesh.position.y = -1.13;
  bell.add(bellMesh);
  bell.position.y += 1.13;
  group.add(bell);

  // ── Incense: a holder, three sticks, glowing tips and a curl of smoke ──
  var IX = 0.95, IZ = NICHE_Z + 0.95;
  g.push(tinted(new THREE.CylinderGeometry(0.07, 0.09, 0.08, 10).translate(IX, PH0 + 0.04, IZ), GOLD));
  var tips = new PointSet(), smoke = new PointSet();
  [-0.03, 0, 0.03].forEach(function (dx, j) {
    var lean = (j - 1) * 0.12;
    g.push(tinted(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 3).translate(0, 0.21, 0).rotateZ(lean).translate(IX + dx, PH0 + 0.06, IZ), '#5a2a14'));
    tips.add(IX + dx - Math.sin(lean) * 0.42, PH0 + 0.06 + Math.cos(lean) * 0.42, IZ, 0, r(), 0, 1, col('#ff6a2a'));
  });
  var NS = small ? 70 : 120;
  for (k = 0; k < NS; k++) smoke.add(IX, PH0 + 0.5, IZ, k / NS, r(), r(), 0.8 + r() * 0.5, col(k % 3 ? '#efe6ee' : '#d8cfe0'));
  pk.add(tips, 'vec4 place(){ return vec4(position, 0.9 + 0.1 * sin(uTime * 3.0 + aData.y * 9.0)); }\n', [[GLOW_F, 0.05, 1.4, 3]]);
  pk.add(smoke,
    'vec4 place(){ float h = fract(aData.x + uTime * 0.07);\n' +
    ' float H = h * 1.7, sw = 0.05 + h * 0.32;\n' +
    ' vec3 p = position + vec3(sin(H * 3.1 + uTime * 0.6 + aData.z * 0.6) * sw, H, cos(H * 2.3 + uTime * 0.45) * sw * 0.7);\n' +
    ' vCol = aCol * uLit;\n' +
    ' return vec4(p, 0.16 * smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.45, 1.0, h))); }\n',
    [[SMOKE_F, 0.09, 1.5, 4, true]]);

  // ── Petals at its foot ─────────────────────────────────────────────────
  var spots = [];
  for (k = 0; k < (small ? 110 : 180); k++) {
    var ang = r() * Math.PI * 2, rad = 0.7 + Math.pow(r(), 0.6) * 2.2;
    var px = Math.cos(ang) * rad * 1.15, pz = NICHE_Z + 0.6 + Math.abs(Math.sin(ang)) * rad * 0.9;
    if (pz > PZ + 4.3) continue;
    spots.push([px, PH0 + 0.012 + r() * 0.01, pz]);
  }
  for (k = 0; k < 40; k++) spots.push([(r() - 0.5) * 4, 1.0 - Math.floor(r() * 3) * 0.25 + 0.012, PZ + 4.5 + Math.floor(r() * 3) * 0.42 + r() * 0.3]);
  var pCols = ['#ff8c00', '#ffa10a', '#ffc21f', '#e8590c', '#c21e3a', '#f06a8a', '#fff0d8'].map(col);
  var petals = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 6).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide, emissive: '#2a0a00' }), spots.length);
  var q4 = new THREE.Quaternion(), e3 = new THREE.Euler(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
  spots.forEach(function (p, j) {
    petals.setMatrixAt(j, mtx.compose(ps.set(p[0], p[1], p[2]), q4.setFromEuler(e3.set(r() * 0.3, r() * 6, r() * 0.3)), sc.set(0.045, 1, 0.027)));
    petals.setColorAt(j, pCols[j % pCols.length]);
  });
  petals.userData.thin = true;
  group.add(petals);

  // ── Assemble ───────────────────────────────────────────────────────────
  var stone = merge(g);
  groundShade(stone, PH0, PH0 + 2.0, 0.85);
  worldUV(stone, 2);
  group.add(new THREE.Mesh(stone, new THREE.MeshLambertMaterial({ vertexColors: true, map: stoneTexture() })));
  group.add(G.mesh(null, small));
  // The niche glows warmly once the lamps are lit.
  var glowSet = new PointSet();
  glowSet.add(0, MURTI_Y + 0.75, NICHE_Z + 0.3, 0, 0.5, 0, 3.2, col('#ffb060'));
  pk.add(glowSet, 'vec4 place(){ return vec4(position, 0.08 + 0.32 * smoothstep(0.0, 3.6, uLight)); }\n', [[HALO_F, 1.0, 2.0, 1]]);

  // ── Per frame ──────────────────────────────────────────────────────────
  var t0 = -1, arrived = false;
  function frame(f) {
    var time = f.time;
    var light = f.reduce ? 10 : (!arrived ? 0 : time - t0);
    U.uTime.value = time; U.uScale.value = f.pxScale; U.uFogD.value = f.fogD * 0.5;
    U.uLight.value = light;
    U.uLit.value = clamp(f.P.hi * 0.7 + 0.2, 0.4, 1.1);
    // The bell: a ring as the guest arrives, then a slow sway.
    var ring = !arrived || f.reduce ? 0 : Math.exp(-(time - t0) * 0.6) * Math.sin((time - t0) * 5.2) * 0.28;
    bell.rotation.z = f.reduce ? 0 : ring + Math.sin(time * 0.9) * 0.025;
    bell.rotation.x = f.reduce ? 0 : Math.sin(time * 0.7 + 1) * 0.015;
    var on = smooth(0, 3.6, light);
    murtiMat.emissiveIntensity = 0.16 + 0.22 * on;
    if (on > 0.01) W.lamp(o.x, MURTI_Y + 0.9, o.z + NICHE_Z + 1.5, '#ffa858', 5.5 * on * (f.reduce ? 1 : 0.92 + 0.08 * Math.sin(time * 8.3)), 6, 1.6);
  }

  return {
    group: group, frame: frame,
    // Called once the page has opened: the lamps light, the bell rings.
    arrive: function () { if (!arrived) { arrived = true; t0 = W.f.time; } }
  };
}
