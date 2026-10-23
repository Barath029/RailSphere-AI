const http = require('http');

const data = JSON.stringify({
  requisition: {
    reqId: 'REQ-SR-CIVIL-999',
    department: 'Civil / Track (P-Way)',
    fromStation: 'MAS',
    toStation: 'AJJ',
    sectionName: 'Puratchi Thalaivar Dr. M.G.R. Chennai Central – Arakkonam Junction',
    trackLine: 'UP Main Line',
    blockType: 'UP Line Block',
    worksiteStartKm: 5.00,
    worksiteEndKm: 8.20,
    kmRange: 'KM 5.00 – KM 8.20',
    workType: 'Plain track tamping & track geometry alignment',
    durationMin: 150,
    urgency: 'Due',
    recommendedBlock: '16:30 – 19:00 IST',
    sanctionedSlot: '16:30 – 19:00 IST',
    status: 'SCHEDULED (OPTIMIZED)'
  },
  eventType: 'SUBMITTED'
});

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/telegram/alert',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log("Port 5000 Response Status:", res.statusCode);
    console.log("Port 5000 Response Body:", body);
  });
});

req.on('error', e => console.error("Error connecting to port 5000:", e.message));
req.write(data);
req.end();
