const TrackGeometry = require('../js/track_geometry.js');
const CorridorData = require('../js/corridor_data.js');

const stations = CorridorData.stations;

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

  if (minFromDist > 0.08 || minToDist > 0.08) return null;
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
  if (tg.trunkLine2 && tg.trunkLine2.length > 0) {
    const slice2 = sliceTrackGeometry(tg.trunkLine2, stFrom, stTo);
    if (slice2 && slice2.length >= 2) return slice2;
  }
  return [[stFrom.lat, stFrom.lng], [stTo.lat, stTo.lng]];
}

function getPointAtRatioOnTrack(polyline, ratio) {
  if (!polyline || polyline.length === 0) return [0, 0];
  if (polyline.length === 1) return polyline[0];

  const clampedRatio = Math.max(0, Math.min(1, ratio));
  if (clampedRatio === 0) return polyline[0];
  if (clampedRatio === 1) return polyline[polyline.length - 1];

  const cumDists = [0];
  let totalDist = 0;
  for (let i = 1; i < polyline.length; i++) {
    const d = Math.hypot(polyline[i][0] - polyline[i - 1][0], polyline[i][1] - polyline[i - 1][1]);
    totalDist += d;
    cumDists.push(totalDist);
  }

  if (totalDist === 0) return polyline[0];

  const targetDist = clampedRatio * totalDist;
  for (let i = 0; i < polyline.length - 1; i++) {
    if (cumDists[i] <= targetDist && targetDist <= cumDists[i + 1]) {
      const segLen = cumDists[i + 1] - cumDists[i];
      const segRatio = segLen > 0 ? (targetDist - cumDists[i]) / segLen : 0;
      const lat = polyline[i][0] + segRatio * (polyline[i + 1][0] - polyline[i][0]);
      const lng = polyline[i][1] + segRatio * (polyline[i + 1][1] - polyline[i][1]);
      return [lat, lng];
    }
  }

  return polyline[polyline.length - 1];
}

function slicePolylineByRatio(polyline, startRatio, endRatio) {
  if (!polyline || polyline.length < 2) return polyline || [];
  const rStart = Math.max(0, Math.min(1, startRatio));
  const rEnd = Math.max(0, Math.min(1, endRatio));
  const minR = Math.min(rStart, rEnd);
  const maxR = Math.max(rStart, rEnd);

  const cumDists = [0];
  let totalDist = 0;
  for (let i = 1; i < polyline.length; i++) {
    const d = Math.hypot(polyline[i][0] - polyline[i - 1][0], polyline[i][1] - polyline[i - 1][1]);
    totalDist += d;
    cumDists.push(totalDist);
  }
  if (totalDist === 0) return polyline;

  const targetStart = minR * totalDist;
  const targetEnd = maxR * totalDist;

  const sliced = [];
  sliced.push(getPointAtRatioOnTrack(polyline, minR));

  for (let i = 0; i < polyline.length; i++) {
    if (cumDists[i] > targetStart && cumDists[i] < targetEnd) {
      sliced.push(polyline[i]);
    }
  }

  sliced.push(getPointAtRatioOnTrack(polyline, maxR));
  return sliced;
}

const stMAS = stations.find(s => s.code === "MAS");
const stAJJ = stations.find(s => s.code === "AJJ");
const trackPathMAS = getCorridorTrackPath(stMAS, stAJJ);

const worksiteStartRatio = (5.00 - 0.0) / 68.6;
const worksiteEndRatio = (8.20 - 0.0) / 68.6;

const worksitePath = slicePolylineByRatio(trackPathMAS, worksiteStartRatio, worksiteEndRatio);
const worksiteMidPt = getPointAtRatioOnTrack(trackPathMAS, (worksiteStartRatio + worksiteEndRatio) / 2);

console.log("Worksite polyline point count:", worksitePath.length);
console.log("Start point:", worksitePath[0]);
console.log("Mid point:", worksiteMidPt);
console.log("End point:", worksitePath[worksitePath.length - 1]);
