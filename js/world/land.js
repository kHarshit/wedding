/*
 * The estate: where each place sits, and the one piece of land under them.
 *
 * Everything faces -z. The gate and the dawn courtyard (with the shrine in
 * its pavilion) are furthest +z; through the court's far arch a lane runs
 * between the two family homes to the terrace, which looks west over the
 * marigold field of Our Story (round the origin: the story's havelis and the
 * mandap at z = -29). Beyond the field a level valley holds the
 * celebrations, one after another: the Haldi courtyard of the groom's home,
 * the Baraat's lamp-lit avenue to the hall gate, and the hall itself; past
 * them, the midnight pavilion by its pool (the RSVP). East of the estate,
 * across the fields, the pin for the venue (the Venue's night map). The land
 * is the story's own ground and colours, flattened where these places stand.
 */
import { THREE, col, smooth } from './lib.js';

export var STORY = {
  HOME_A: { x: -13, z: -17, rot: 0.42 },
  HOME_B: { x: 13, z: -17, rot: -0.42 },
  MZ: -29
};
// A courtyard's origin is the middle of its gateway on the ground; the court
// runs from z = 0 back to z = -DEPTH (local), HALF wide either side.
export var COURT = { HALF: 15, DEPTH: 46, WALL: 6.2 };
export var COURT_DAWN = { x: 0, z: 128 };
export var COURT_MORNING = { x: 0, z: -232 };    // (the footprint the pavilion stands in)
export var PAVILION = { x: 0, z: -232 };         // the pool's near edge; the pavilion is at z = -252
export var PIN = { x: 104, z: -168 };            // the venue's pin on the night map
// The celebrations (each place's origin; see places/haldi.js, baraat.js, hall.js).
export var HALDI = { x: 0, z: -84 };       // the courtyard's front wall; it runs back to z = -110
export var BARAAT = { x: 0, z: -126 };     // the avenue's start; the hall gate stands at z = -166
export var HALL = { x: 0, z: -184 };       // the hall's front step; the stage is at z = -210 (its camera stands past the Baraat gate)
// The lane between the two homes, and the terrace at its end.
export var HOMES = { z: 63.5, x: 6.8, rot: Math.PI / 2 - 0.72 };
export var TERRACE = { z: 50, deck: 7.0 };

var FLATS = [COURT_DAWN, COURT_MORNING].map(function (c) {
  return { x0: c.x - COURT.HALF - 2, x1: c.x + COURT.HALF + 2, z0: c.z - COURT.DEPTH - 2, z1: c.z + 12 };
});
FLATS.push({ x0: -20, x1: 20, z0: TERRACE.z - 7, z1: COURT_DAWN.z - COURT.DEPTH });
FLATS.push({ x0: -34, x1: 34, z0: -222, z1: -64 });

function storyH(x, z) {
  // Level from the field back to z = 38, so the field can run towards the
  // camera on phones; hills beyond.
  var d = Math.max(0, Math.abs(x) - 24, z - 38, -46 - z);
  return Math.min(d * 0.09, 5) * (0.65 + 0.35 * Math.sin(x * 0.045 + 1.1) * Math.cos(z * 0.06)) +
         0.06 * Math.sin(x * 0.7) * Math.sin(z * 0.6) * smooth(2, 10, d);
}
// 1 inside a courtyard's footprint, easing to 0 over 14 m round it.
function flatK(x, z) {
  var k = 0;
  for (var i = 0; i < FLATS.length; i++) {
    var f = FLATS[i], d = Math.max(f.x0 - x, x - f.x1, f.z0 - z, z - f.z1);
    k = Math.max(k, 1 - smooth(0, 14, d));
  }
  return k;
}
export function groundH(x, z) {
  var k = flatK(x, z);
  return k >= 1 ? 0 : storyH(x, z) * (1 - k);
}

var PATCH = [col('#d8b42c'), col('#e2c43a'), col('#6f8f35'), col('#86a040'), col('#9c8456')];
function hash2(a, b) { var h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); }
function patchwork(x, z) {
  if (z > -42 || z < -380) return null;
  // Keep the celebrations' own ground (the courts, the avenue, the hall lawn).
  if (Math.abs(x) < 15 && z < HALDI.z + 4 && z > HALDI.z - 30) return null;
  if (Math.abs(x) < 13 && z < BARAAT.z + 6 && z > BARAAT.z - 44) return null;
  if (Math.abs(x) < 23 && z < HALL.z + 18 && z > HALL.z - 36) return null;
  if (Math.abs(x) < 15 && z < PAVILION.z + 6 && z > PAVILION.z - 34) return null;   // the pavilion's garden
  var cx = Math.floor(x / 15 + 0.3 * Math.sin(z * 0.05)), cz = Math.floor(z / 12);
  var h = hash2(cx, cz);
  return PATCH[Math.min(PATCH.length - 1, (h * PATCH.length) | 0)];
}

export function buildLand(small) {
  var H = STORY, gSeg = small ? 90 : 140;
  // Deep enough south that the dawn's climb out of the pavilion sees fields, not the land's edge.
  var gGeo = new THREE.PlaneGeometry(460, 540, gSeg, Math.round(gSeg * 540 / 460)).rotateX(-Math.PI / 2).translate(0, 0, -110);
  var gp = gGeo.attributes.position, gCols = new Float32Array(gp.count * 3);
  var cGrass = col('#56603a'), cField = col('#3e4824'), cPath = col('#8a6a48'), cYard = col('#a07e5a'), cTmp = new THREE.Color();
  for (var i = 0; i < gp.count; i++) {
    var x = gp.getX(i), z = gp.getZ(i);
    gp.setY(i, groundH(x, z));
    var inField = Math.abs(x) < 11.5 && z < (small ? 36.5 : 24.5) && z > -22;
    cTmp.copy(cGrass).lerp(cField, inField ? 1 : 0);
    // The earthen path: down the field, and on from the dawn courtyard's far arch.
    if (Math.abs(x) < 1.25 && z < COURT_DAWN.z - COURT.DEPTH + 2 && z > -26) cTmp.copy(cPath);
    var dA = Math.hypot(x - H.HOME_A.x, z - H.HOME_A.z), dB = Math.hypot(x - H.HOME_B.x, z - H.HOME_B.z);
    cTmp.lerp(cYard, 1 - smooth(5.5, 8.5, Math.min(dA, dB)));
    cTmp.lerp(cYard, 1 - smooth(4.5, 7, Math.hypot(x, z - H.MZ)));
    // Packed earth round the courtyards.
    cTmp.lerp(cYard, flatK(x, z) * 0.7);
    // Beyond the story's field, a patchwork of mustard in flower, young
    // wheat and fallow ground, as the celebrations' valley is seen from the air.
    var pf = patchwork(x, z);
    if (pf) cTmp.copy(pf);
    var n = 0.9 + 0.1 * Math.sin(x * 1.7 + z * 0.9) * Math.sin(z * 2.3 - x * 0.4);
    gCols[i * 3] = cTmp.r * n; gCols[i * 3 + 1] = cTmp.g * n; gCols[i * 3 + 2] = cTmp.b * n;
  }
  gGeo.setAttribute('color', new THREE.BufferAttribute(gCols, 3));
  gGeo.computeVertexNormals();
  return new THREE.Mesh(gGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
}
