/*
 * The estate: where each place sits, and the one piece of land under them.
 *
 * Everything faces -z. The gate and the dawn courtyard (with the shrine in
 * its pavilion) are furthest +z; through the court's far arch a lane runs
 * between the two family homes to the terrace, which looks west over the
 * marigold field of Our Story (round the origin: the story's havelis and the
 * mandap at z = -29); beyond the field lies the morning courtyard. The land
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
export var COURT_MORNING = { x: 0, z: -122 };
// The lane between the two homes, and the terrace at its end.
export var HOMES = { z: 63.5, x: 6.8, rot: Math.PI / 2 - 0.72 };
export var TERRACE = { z: 50, deck: 7.0 };

var FLATS = [COURT_DAWN, COURT_MORNING].map(function (c) {
  return { x0: c.x - COURT.HALF - 2, x1: c.x + COURT.HALF + 2, z0: c.z - COURT.DEPTH - 2, z1: c.z + 12 };
});
FLATS.push({ x0: -20, x1: 20, z0: TERRACE.z - 7, z1: COURT_DAWN.z - COURT.DEPTH });

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

export function buildLand(small) {
  var H = STORY, gSeg = small ? 90 : 140;
  var gGeo = new THREE.PlaneGeometry(460, 460, gSeg, gSeg).rotateX(-Math.PI / 2).translate(0, 0, -70);
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
    var n = 0.9 + 0.1 * Math.sin(x * 1.7 + z * 0.9) * Math.sin(z * 2.3 - x * 0.4);
    gCols[i * 3] = cTmp.r * n; gCols[i * 3 + 1] = cTmp.g * n; gCols[i * 3 + 2] = cTmp.b * n;
  }
  gGeo.setAttribute('color', new THREE.BufferAttribute(gCols, 3));
  gGeo.computeVertexNormals();
  return new THREE.Mesh(gGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
}
