const TrackGeometry = require('../js/track_geometry.js');
const CorridorData = require('../js/corridor_data.js');

const stations = CorridorData.stations;
const stFrom = stations.find(s => s.code === "MAS");
const stTo = stations.find(s => s.code === "AJJ");

console.log("stFrom:", stFrom);
console.log("stTo:", stTo);

function sliceTrackGeometry(polyline, stFrom, stTo) {
  if (!polyline || polyline.length === 0 || !stFrom || !stTo) return null;
  let fromIdx = -1, toIdx = -1;
  let minFromDist = Infinity, minToDist = Infinity;
  for (let i = 0; i < polyline.length; i++) {
    const dFrom = Math.hypot(polyline[i][0] - stFrom.lat, polyline[i][1] - stFrom.lng);
    if (dFrom < minFromDist) {
      minFromDist = dFrom;
      fromIdx = i;
    }
    const dTo = Math.hypot(polyline[i][0] - stTo.lat, polyline[i][1] - stTo.lng);
    if (dTo < minToDist) {
      minToDist = dTo;
      toIdx = i;
    }
  }
  console.log(`minFromDist: ${minFromDist.toFixed(6)}, fromIdx: ${fromIdx}`);
  console.log(`minToDist: ${minToDist.toFixed(6)}, toIdx: ${toIdx}`);

  if (minFromDist > 0.25 || minToDist > 0.25) return null;
  if (fromIdx <= toIdx) {
    return polyline.slice(fromIdx, toIdx + 1);
  } else {
    return polyline.slice(toIdx, fromIdx + 1).reverse();
  }
}

function getCorridorTrackPath(stFrom, stTo) {
  if (!stFrom || !stTo) return [];
  const tg = TrackGeometry;

  if (tg.trunkLine1 && tg.trunkLine1.length > 0) {
    const slice1 = sliceTrackGeometry(tg.trunkLine1, stFrom, stTo);
    if (slice1 && slice1.length >= 2) return slice1;
  }
  return [[stFrom.lat, stFrom.lng], [stTo.lat, stTo.lng]];
}

const corridorTrackPath = getCorridorTrackPath(stFrom, stTo);
console.log("corridorTrackPath length:", corridorTrackPath.length);

const startKm = 5.00;
const endKm = 8.20;
const secStartKm = Math.min(stFrom.km || 0, stTo.km || 100);
const secTotalKm = Math.abs((stTo.km || 100) - (stFrom.km || 0)) || 1;
const worksiteMidKm = (startKm + endKm) / 2;
let ratio = (worksiteMidKm - secStartKm) / secTotalKm;
ratio = Math.max(0, Math.min(1, ratio));
const idx = Math.floor(ratio * (corridorTrackPath.length - 1));
const pt = corridorTrackPath[idx] || corridorTrackPath[0];

console.log(`worksiteMidKm: ${worksiteMidKm}, ratio: ${ratio.toFixed(4)}, idx: ${idx}`);
console.log("Calculated Point (Lat, Lng):", pt);
