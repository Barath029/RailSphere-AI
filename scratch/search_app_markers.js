const fs = require('fs');
const content = fs.readFileSync('js/app.js', 'utf8');

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('circleMarker') || line.includes('marker') || line.includes('.addTo') || line.includes('polyline') || line.includes('L.')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
