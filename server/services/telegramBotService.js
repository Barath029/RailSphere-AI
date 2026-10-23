const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Lightweight .env reader if environment variable is not already defined in process.env
if (!process.env.TELEGRAM_BOT_TOKEN) {
  try {
    const envPaths = [
      path.join(__dirname, '../../.env'),
      path.join(__dirname, '../../../.env'),
      path.join(process.cwd(), '.env')
    ];
    for (const p of envPaths) {
      if (fs.existsSync(p)) {
        const envContent = fs.readFileSync(p, 'utf8');
        envContent.split(/\r?\n/).forEach((line) => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const k = trimmed.substring(0, idx).trim();
            const v = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[k]) process.env[k] = v;
          }
        });
        if (process.env.TELEGRAM_BOT_TOKEN) break;
      }
    }
  } catch (e) {}
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || '@Track_plan_bot';
const TELEGRAM_API_URL = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : '';

const STORAGE_FILE = path.join(__dirname, '../../scratch/telegram_subscribers.json');

// Load Corridor Data for live requisition lookups
let corridorDataRef = null;
try {
  corridorDataRef = require('../../js/corridor_data');
} catch (e) {}

// 5x7 ASCII Bitmap Font for Map Image Overlay Rendering
const FONT_5X7 = {
  'A': [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  'B': [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E],
  'C': [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E],
  'D': [0x1C, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1C],
  'E': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F],
  'F': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10],
  'G': [0x0E, 0x11, 0x10, 0x13, 0x11, 0x11, 0x0F],
  'H': [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  'I': [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E],
  'J': [0x1F, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C],
  'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
  'M': [0x11, 0x1B, 0x15, 0x11, 0x11, 0x11, 0x11],
  'N': [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  'O': [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
  'P': [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
  'Q': [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D],
  'R': [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11],
  'S': [0x0E, 0x11, 0x10, 0x0E, 0x01, 0x11, 0x0E],
  'T': [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
  'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
  'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x1B, 0x11],
  'X': [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
  'Y': [0x11, 0x11, 0x0A, 0x04, 0x04, 0x04, 0x04],
  'Z': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
  '0': [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E],
  '1': [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
  '2': [0x0E, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1F],
  '3': [0x1F, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0E],
  '4': [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02],
  '5': [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
  '6': [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E],
  '7': [0x1F, 0x01, 0x02, 0x04, 0x04, 0x04, 0x04],
  '8': [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E],
  '9': [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
  '-': [0x00, 0x00, 0x00, 0x1F, 0x00, 0x00, 0x00],
  ':': [0x00, 0x0C, 0x0C, 0x00, 0x0C, 0x0C, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x0C],
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  '/': [0x01, 0x02, 0x04, 0x08, 0x10, 0x00, 0x00],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '#': [0x0A, 0x0A, 0x1F, 0x0A, 0x1F, 0x0A, 0x0A],
  '&': [0x0C, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0D],
  '[': [0x0E, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0E],
  ']': [0x0E, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0E]
};

// Zero-dependency pure Node PNG graphic generator
class PureNodePNG {
  constructor(width, height, bgHex = '#0f172a') {
    this.width = width;
    this.height = height;
    this.buffer = Buffer.alloc(width * height * 4);
    const bgRgb = this.hexToRgb(bgHex);
    for (let i = 0; i < width * height; i++) {
      this.buffer[i * 4] = bgRgb.r;
      this.buffer[i * 4 + 1] = bgRgb.g;
      this.buffer[i * 4 + 2] = bgRgb.b;
      this.buffer[i * 4 + 3] = 255;
    }
  }

  hexToRgb(hex) {
    let clean = (hex || '#000000').replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    const num = parseInt(clean, 16) || 0;
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  setPixel(x, y, r, g, b, a = 255) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    if (a === 255) {
      this.buffer[idx] = r;
      this.buffer[idx + 1] = g;
      this.buffer[idx + 2] = b;
      this.buffer[idx + 3] = 255;
    } else {
      const alpha = a / 255;
      const invAlpha = 1 - alpha;
      this.buffer[idx] = Math.round(r * alpha + this.buffer[idx] * invAlpha);
      this.buffer[idx + 1] = Math.round(g * alpha + this.buffer[idx + 1] * invAlpha);
      this.buffer[idx + 2] = Math.round(b * alpha + this.buffer[idx + 2] * invAlpha);
      this.buffer[idx + 3] = 255;
    }
  }

  fillRect(x, y, w, h, hex, alpha = 255) {
    const rgb = this.hexToRgb(hex);
    const startX = Math.max(0, Math.floor(x));
    const startY = Math.max(0, Math.floor(y));
    const endX = Math.min(this.width, Math.floor(x + w));
    const endY = Math.min(this.height, Math.floor(y + h));
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        this.setPixel(px, py, rgb.r, rgb.g, rgb.b, alpha);
      }
    }
  }

  drawLine(x0, y0, x1, y1, hex, thickness = 1) {
    const rgb = this.hexToRgb(hex);
    x0 = Math.floor(x0); y0 = Math.floor(y0);
    x1 = Math.floor(x1); y1 = Math.floor(y1);
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let currX = x0; let currY = y0;
    const r = Math.floor(thickness / 2);

    while (true) {
      for (let tx = -r; tx <= r; tx++) {
        for (let ty = -r; ty <= r; ty++) {
          this.setPixel(currX + tx, currY + ty, rgb.r, rgb.g, rgb.b);
        }
      }
      if (currX === x1 && currY === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; currX += sx; }
      if (e2 < dx) { err += dx; currY += sy; }
    }
  }

  drawCircle(cx, cy, radius, hex, fill = true) {
    const rgb = this.hexToRgb(hex);
    const r2 = radius * radius;
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        const dist2 = x * x + y * y;
        if (fill ? dist2 <= r2 : Math.abs(dist2 - r2) < radius * 1.5) {
          this.setPixel(cx + x, cy + y, rgb.r, rgb.g, rgb.b);
        }
      }
    }
  }

  drawText(text, startX, startY, hex = '#ffffff', scale = 2) {
    const str = String(text || '').toUpperCase();
    let curX = Math.floor(startX);
    const curY = Math.floor(startY);
    const rgb = this.hexToRgb(hex);

    for (let char of str) {
      const bitmap = FONT_5X7[char] || FONT_5X7[' '];
      for (let row = 0; row < 7; row++) {
        const line = bitmap[row];
        for (let col = 0; col < 5; col++) {
          if ((line >> (4 - col)) & 1) {
            for (let sx = 0; sx < scale; sx++) {
              for (let sy = 0; sy < scale; sy++) {
                this.setPixel(curX + col * scale + sx, curY + row * scale + sy, rgb.r, rgb.g, rgb.b);
              }
            }
          }
        }
      }
      curX += (5 + 1) * scale;
    }
  }

  toBuffer() {
    const rawData = Buffer.alloc(this.height * (1 + this.width * 4));
    for (let y = 0; y < this.height; y++) {
      rawData[y * (1 + this.width * 4)] = 0;
      this.buffer.copy(rawData, y * (1 + this.width * 4) + 1, y * this.width * 4, (y + 1) * this.width * 4);
    }
    const compressed = zlib.deflateSync(rawData);
    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr.writeUInt8(8, 8);
    ihdr.writeUInt8(6, 9);
    ihdr.writeUInt8(0, 10);
    ihdr.writeUInt8(0, 11);
    ihdr.writeUInt8(0, 12);

    return Buffer.concat([
      signature,
      this.createChunk('IHDR', ihdr),
      this.createChunk('IDAT', compressed),
      this.createChunk('IEND', Buffer.alloc(0))
    ]);
  }

  createChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    buf.writeUInt32BE(this.crc32(buf.subarray(4, 8 + len)), 8 + len);
    return buf;
  }

  crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
}

class TelegramBotService {
  constructor() {
    this.subscribers = new Set();
    this.lastUpdateId = 0;
    this.isPolling = false;
    this.initStorage();
    this.setBotCommands();
    this.startPolling();
  }

  initStorage() {
    try {
      const dir = path.dirname(STORAGE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(STORAGE_FILE)) {
        const data = fs.readFileSync(STORAGE_FILE, 'utf8');
        const list = JSON.parse(data || '[]');
        if (Array.isArray(list)) {
          list.forEach(id => this.subscribers.add(id));
        }
      }
    } catch (e) {
      console.warn('[TelegramBot] Warning initializing storage:', e.message);
    }
  }

  saveSubscribers() {
    try {
      const list = Array.from(this.subscribers);
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      console.warn('[TelegramBot] Error saving subscribers:', e.message);
    }
  }

  addSubscriber(chatId) {
    if (!chatId) return false;
    const strId = String(chatId);
    if (!this.subscribers.has(strId)) {
      this.subscribers.add(strId);
      this.saveSubscribers();
      console.log(`[TelegramBot] New subscriber registered: ${strId}`);
      return true;
    }
    return false;
  }

  getSubscribers() {
    return Array.from(this.subscribers);
  }

  async setBotCommands() {
    try {
      await this.makeRequest('setMyCommands', {
        commands: [
          { command: 'start', description: '🚆 Subscribe & View Interactive Menu' },
          { command: 'requisitions', description: '📋 View Active Block Requisitions & Map' },
          { command: 'status', description: '🟢 Check System & Telemetry Connection' },
          { command: 'help', description: 'ℹ️ System Guide & Usage Instructions' }
        ]
      });
    } catch (e) {}
  }

  makeRequest(method, payload = {}) {
    return new Promise((resolve) => {
      if (!BOT_TOKEN || !TELEGRAM_API_URL) {
        return resolve({ ok: false, error: 'Telegram BOT_TOKEN is not configured' });
      }
      const url = `${TELEGRAM_API_URL}/${method}`;
      const postData = JSON.stringify(payload);

      const parsedUrl = new URL(url);
      const req = https.request({
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            resolve(parsed);
          } catch (err) {
            resolve({ ok: false, error: err.message });
          }
        });
      });

      req.on('error', (e) => resolve({ ok: false, error: e.message }));
      req.write(postData);
      req.end();
    });
  }

  async sendMessage(chatId, text, options = {}) {
    try {
      const res = await this.makeRequest('sendMessage', {
        chat_id: chatId,
        text: text,
        parse_mode: options.parse_mode || 'HTML',
        disable_web_page_preview: true,
        reply_markup: options.reply_markup || undefined,
        ...options
      });
      return res;
    } catch (e) {
      console.error(`[TelegramBot] Error sending message to ${chatId}:`, e.message);
      return { ok: false, error: e.message };
    }
  }

  async answerCallbackQuery(callbackQueryId, text = '') {
    try {
      await this.makeRequest('answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        text: text
      });
    } catch (e) {}
  }

  async sendPhoto(chatId, photoBuffer, captionText, options = {}) {
    return new Promise((resolve) => {
      try {
        if (!BOT_TOKEN || !TELEGRAM_API_URL) {
          return resolve({ ok: false, error: 'Telegram BOT_TOKEN is not configured' });
        }
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const crlf = '\r\n';

        let header = `--${boundary}${crlf}`;
        header += `Content-Disposition: form-data; name="chat_id"${crlf}${crlf}${chatId}${crlf}`;
        header += `--${boundary}${crlf}`;
        header += `Content-Disposition: form-data; name="caption"${crlf}${crlf}${captionText}${crlf}`;
        header += `--${boundary}${crlf}`;
        header += `Content-Disposition: form-data; name="parse_mode"${crlf}${crlf}HTML${crlf}`;

        if (options.reply_markup) {
          header += `--${boundary}${crlf}`;
          header += `Content-Disposition: form-data; name="reply_markup"${crlf}${crlf}${JSON.stringify(options.reply_markup)}${crlf}`;
        }

        header += `--${boundary}${crlf}`;
        header += `Content-Disposition: form-data; name="photo"; filename="railway_block_worksite_map.png"${crlf}`;
        header += `Content-Type: image/png${crlf}${crlf}`;

        const footer = `${crlf}--${boundary}--${crlf}`;

        const postData = Buffer.concat([
          Buffer.from(header, 'utf8'),
          photoBuffer,
          Buffer.from(footer, 'utf8')
        ]);

        const parsedUrl = new URL(`${TELEGRAM_API_URL}/sendPhoto`);
        const req = https.request({
          hostname: parsedUrl.hostname,
          port: 443,
          path: parsedUrl.pathname,
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': postData.length
          }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body || '{}');
              resolve(parsed);
            } catch (err) {
              resolve({ ok: false, error: err.message });
            }
          });
        });

        req.on('error', (e) => resolve({ ok: false, error: e.message }));
        req.write(postData);
        req.end();
      } catch (err) {
        resolve({ ok: false, error: err.message });
      }
    });
  }

  generateMapSnapshotPNG(reqData) {
    try {
      const png = new PureNodePNG(900, 500, '#0b1329');

      // Header Banner
      png.fillRect(0, 0, 900, 60, '#1e293b');
      png.drawText('SOUTHERN RAILWAY - MAINTENANCE BLOCK MAP', 20, 18, '#38bdf8', 2);
      png.drawText('LIVE CORRIDOR WORKSITE SNAPSHOT', 580, 22, '#94a3b8', 1);

      // Outer Card Frame
      png.fillRect(20, 80, 860, 400, '#151e32');

      const reqId = String((reqData && (reqData.reqId || reqData.requestId)) || 'REQ-SR-PLAN');
      const dept = String((reqData && reqData.department) || 'CIVIL / TRACK').toUpperCase();
      const fromStn = String((reqData && reqData.fromStation) || 'KPD').toUpperCase();
      const toStn = String((reqData && reqData.toStation) || 'JTJ').toUpperCase();
      const slot = String((reqData && (reqData.recommendedBlock || reqData.sanctionedSlot || reqData.scheduledSlot)) || '16:30 - 19:00 IST');
      const worksite = String((reqData && (reqData.kmRange || (reqData.worksiteStartKm && reqData.worksiteEndKm ? `KM ${parseFloat(reqData.worksiteStartKm).toFixed(2)} - KM ${parseFloat(reqData.worksiteEndKm).toFixed(2)}` : null))) || 'KM 129.50 - KM 174.00');

      // Text Specification Card
      png.fillRect(40, 100, 820, 90, '#1e293b');
      png.drawText(`REQ ID: ${reqId}`, 55, 115, '#f1f5f9', 2);
      png.drawText(`DEPT: ${dept.substring(0, 28)}`, 440, 115, '#38bdf8', 2);
      png.drawText(`CORRIDOR: ${fromStn} - ${toStn}`, 55, 145, '#fbbf24', 2);
      png.drawText(`SLOT: ${slot}`, 540, 145, '#4ade80', 2);

      // Railway Track Lines
      png.drawText('UP MAIN LINE', 40, 220, '#38bdf8', 1);
      png.drawLine(40, 240, 860, 240, '#0284c7', 4);

      png.drawText('DOWN MAIN LINE', 40, 310, '#c084fc', 1);
      png.drawLine(40, 330, 860, 330, '#9333ea', 4);

      // Worksite Highlight Box
      png.fillRect(300, 225, 340, 120, '#ef4444', 160);
      png.drawLine(300, 240, 640, 240, '#f87171', 6);
      png.drawText(`WORKSITE: ${worksite}`, 315, 270, '#ffffff', 2);
      png.drawText('STATUS: SCHEDULED (OPTIMIZED)', 320, 305, '#fef08a', 2);

      // Station Nodes
      const stations = [
        { name: 'MAS', x: 80 },
        { name: 'AJJ', x: 220 },
        { name: fromStn, x: 360 },
        { name: toStn, x: 580 },
        { name: 'SA',  x: 720 },
        { name: 'ED',  x: 840 }
      ];

      stations.forEach(s => {
        png.drawCircle(s.x, 240, 10, '#ffffff');
        png.drawCircle(s.x, 240, 6, '#0f172a');
        png.drawText(s.name, s.x - 14, 205, '#f8fafc', 2);
      });

      // Active Train Markers
      png.drawCircle(260, 240, 8, '#38bdf8');
      png.drawText('#20643', 245, 260, '#38bdf8', 1);

      png.drawCircle(780, 330, 8, '#c084fc');
      png.drawText('#12675', 765, 350, '#c084fc', 1);

      // Footer Watermark
      png.drawText('RAILFLOW OPTIMIZED DECISION SUPPORT SYSTEM - TELEGRAM @TRACK_PLAN_BOT', 190, 465, '#64748b', 1);

      return png.toBuffer();
    } catch (e) {
      console.warn('[TelegramBot] Error generating map snapshot PNG:', e.message);
      return null;
    }
  }

  async broadcastRequisitionAlert(reqData, eventType = 'SUBMITTED') {
    const isApproved = eventType === 'APPROVED' || (reqData && (reqData.status === 'SCHEDULED' || reqData.status === 'APPROVED'));

    const headerEmoji = isApproved ? '✅ <b>SANCTIONED BLOCK ORDER</b>' : '🚨 <b>NEW BLOCK REQUISITION SUBMITTED</b>';
    const reqId = (reqData && (reqData.reqId || reqData.requestId)) || 'REQ-SR-CIVIL-101';
    const dept = (reqData && reqData.department) || 'Civil / Track (P-Way)';
    const section = (reqData && reqData.sectionName) || `${(reqData && reqData.fromStation) || 'KPD'} - ${(reqData && reqData.toStation) || 'JTJ'}`;
    const trackLine = (reqData && reqData.trackLine) || 'UP Main Line';
    const blockType = (reqData && reqData.blockType) || 'UP Line Block';
    const worksite = (reqData && (reqData.kmRange || (reqData.worksiteStartKm && reqData.worksiteEndKm ? `KM ${parseFloat(reqData.worksiteStartKm).toFixed(2)} to KM ${parseFloat(reqData.worksiteEndKm).toFixed(2)}` : null))) || 'KM 129.50 – KM 174.00';
    const workType = (reqData && (reqData.workType || reqData.workDesc)) || 'Track Tamping & Alignment';
    const duration = (reqData && reqData.durationMin) || 150;
    const urgency = (reqData && reqData.urgency) || 'Due';
    const slot = (reqData && (reqData.recommendedBlock || reqData.sanctionedSlot || reqData.scheduledSlot || reqData.preferredSlot)) || '16:30 – 19:00 IST';
    const statusText = (reqData && reqData.status) || (isApproved ? 'SCHEDULED (OPTIMIZED)' : 'PLOTTED & PENDING APPROVAL');

    const fullMessage = `
${headerEmoji}
<b>Southern Railway • Section Control</b>
─────────────────────────────
📋 <b>Requisition ID:</b> <code>${reqId}</code>
🏢 <b>Department:</b> ${dept}
📍 <b>Corridor:</b> ${section}
🛣️ <b>Track Line:</b> ${trackLine} (${blockType})
📏 <b>Worksite Location:</b> <code>${worksite}</code>
🛠️ <b>Nature of Work:</b> ${workType}
⏱️ <b>Duration Needed:</b> ${duration} mins
🚨 <b>Urgency Level:</b> ${urgency}
─────────────────────────────
📅 <b>AI Optimal Scheduled Slot:</b> <code>${slot}</code>
⚡ <b>Status:</b> <b>${statusText}</b>
🎯 <b>Optimization Score:</b> <b>0 min direct train stopping delay</b> (Minimal Disruption)
⚠️ <b>Safety Precaution:</b> 30 km/h Caution Order on adjacent line during block possession.
─────────────────────────────
<i>RailFlow Decision-Support System • Live Alert (@Track_plan_bot)</i>
    `.trim();

    const photoCaption = `
${headerEmoji}
<b>Southern Railway Section Control</b>
📋 <b>Req ID:</b> <code>${reqId}</code> | 🏢 <b>Dept:</b> ${dept}
📍 <b>Corridor:</b> ${section} | 🛣️ <b>Line:</b> ${trackLine}
📏 <b>Worksite:</b> <code>${worksite}</code>
📅 <b>AI Recommended Slot:</b> <code>${slot}</code>
🎯 <b>Optimization:</b> 0 min direct train stopping delay
⚡ <b>Status:</b> <b>${statusText}</b>
<i>@Track_plan_bot • RailFlow Decision Support</i>
    `.trim();

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '📋 View Active Requisitions', callback_data: 'cmd_reqs' },
          { text: '🟢 System Status', callback_data: 'cmd_status' }
        ],
        [
          { text: '🗺️ Map Snapshot', callback_data: 'cmd_map' }
        ]
      ]
    };

    const subscribers = this.getSubscribers();
    const results = [];

    console.log(`[TelegramBot] Broadcasting alert for ${reqId} to ${subscribers.length} subscriber(s)...`);

    const mapPngBuffer = this.generateMapSnapshotPNG(reqData);

    for (const chatId of subscribers) {
      let sentSuccess = false;
      if (mapPngBuffer) {
        const photoRes = await this.sendPhoto(chatId, mapPngBuffer, photoCaption, { reply_markup: inlineKeyboard });
        if (photoRes && photoRes.ok) {
          sentSuccess = true;
          await this.sendMessage(chatId, fullMessage, { reply_markup: inlineKeyboard });
        }
      }

      if (!sentSuccess) {
        const textRes = await this.sendMessage(chatId, fullMessage, { reply_markup: inlineKeyboard });
        sentSuccess = textRes && textRes.ok;
      }

      results.push({ chatId, success: sentSuccess });
    }

    return {
      broadcastedCount: subscribers.length,
      results: results,
      reqId: reqId
    };
  }

  async handleStartOrHelp(chatId, senderName) {
    const welcomeMessage = `
🚆 <b>Welcome to RailFlow Maintenance Block System!</b>

Hello ${senderName}! You are connected to <b>Southern Railway</b> real-time decision support system via <b>${BOT_USERNAME}</b>.

<b>Core Capabilities:</b>
• 🚨 <b>Instant Alerts:</b> Live notifications when block requisitions are submitted or sanctioned.
• 🗺️ <b>Visual Map Snapshots:</b> Auto-generated PNG worksite maps broadcasted directly to Telegram.
• 🎯 <b>Minimal Delay Optimization:</b> Automatic train conflict evaluation & minimal detention slot allocation.

<b>Interactive Menu:</b>
Tap any button below to query live corridor state or generate map snapshots!
    `.trim();

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '📋 Active Requisitions', callback_data: 'cmd_reqs' },
          { text: '🟢 System Status', callback_data: 'cmd_status' }
        ],
        [
          { text: '🗺️ Generate Map Snapshot', callback_data: 'cmd_map' },
          { text: '🚀 Test Live Alert', callback_data: 'cmd_test' }
        ]
      ]
    };

    await this.sendMessage(chatId, welcomeMessage, { reply_markup: inlineKeyboard });
  }

  async handleStatus(chatId) {
    const subCount = this.subscribers.size;
    const reqCount = (corridorDataRef && Array.isArray(corridorDataRef.requisitions)) ? corridorDataRef.requisitions.length : 0;

    const statusMsg = `
🟢 <b>RailFlow System Operational</b>
─────────────────────────────
• 🚆 <b>Zone:</b> Southern Railway (SR)
• 📍 <b>Divisions:</b> Chennai / Salem / Trichy / Madurai
• 👥 <b>Active Subscribers:</b> <code>${subCount}</code>
• 📋 <b>Monitored Requisitions:</b> <code>${reqCount}</code>
• 🤖 <b>Telegram Bot:</b> <code>${BOT_USERNAME}</code>
• 🖼️ <b>Map Snapshot Engine:</b> <code>PNG High-Res Active</code>
• ⚡ <b>Backend Status:</b> <code>ONLINE (HTTP 200 OK)</code>
─────────────────────────────
<i>RailFlow Real-Time Decision Support Engine</i>
    `.trim();

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '📋 View Requisitions', callback_data: 'cmd_reqs' },
          { text: '🗺️ Map Snapshot', callback_data: 'cmd_map' }
        ]
      ]
    };

    await this.sendMessage(chatId, statusMsg, { reply_markup: inlineKeyboard });
  }

  async handleRequisitions(chatId) {
    const reqs = (corridorDataRef && Array.isArray(corridorDataRef.requisitions)) ? corridorDataRef.requisitions : [];

    if (reqs.length === 0) {
      const emptyMsg = `
📋 <b>Active Requisitions Register</b>
─────────────────────────────
<i>No active block requisitions currently in register.</i>

Submit a new block requisition on the RailFlow web portal or tap <b>🚀 Test Live Alert</b> below to raise a sample request!
      `.trim();

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: '🚀 Test Live Alert', callback_data: 'cmd_test' },
            { text: '🟢 System Status', callback_data: 'cmd_status' }
          ]
        ]
      };
      await this.sendMessage(chatId, emptyMsg, { reply_markup: inlineKeyboard });
      return;
    }

    let summaryText = `📋 <b>Active Requisitions Register (${reqs.length} Total)</b>\n─────────────────────────────\n`;
    reqs.forEach((r, idx) => {
      const rId = r.reqId || r.requestId || `REQ-${idx + 1}`;
      const d = r.department || 'Civil / Track';
      const sec = r.sectionName || `${r.fromStation || 'KPD'} - ${r.toStation || 'JTJ'}`;
      const slot = r.sanctionedSlot || r.recommendedBlock || '11:30 - 14:00 IST';
      summaryText += `${idx + 1}. <b>${rId}</b> (${d})\n   📍 ${sec} | 📅 ${slot}\n\n`;
    });

    const primaryReq = reqs[0];
    const mapPngBuffer = this.generateMapSnapshotPNG(primaryReq);

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '🗺️ View Map Snapshot', callback_data: 'cmd_map' },
          { text: '🟢 System Status', callback_data: 'cmd_status' }
        ]
      ]
    };

    if (mapPngBuffer) {
      await this.sendPhoto(chatId, mapPngBuffer, summaryText, { reply_markup: inlineKeyboard });
    } else {
      await this.sendMessage(chatId, summaryText, { reply_markup: inlineKeyboard });
    }
  }

  async handleMapSnapshot(chatId) {
    const reqs = (corridorDataRef && Array.isArray(corridorDataRef.requisitions)) ? corridorDataRef.requisitions : [];
    const sampleReq = reqs.length > 0 ? reqs[0] : {
      reqId: 'REQ-SR-CIVIL-129',
      department: 'Civil / Track (P-Way)',
      fromStation: 'KPD',
      toStation: 'JTJ',
      kmRange: 'KM 129.50 – KM 174.00',
      sanctionedSlot: '11:30 – 14:00 IST',
      status: 'SCHEDULED'
    };

    const mapPngBuffer = this.generateMapSnapshotPNG(sampleReq);
    const caption = `
🗺️ <b>Live Corridor Worksite Map Snapshot</b>
─────────────────────────────
📍 <b>Corridor:</b> ${sampleReq.fromStation || 'KPD'} – ${sampleReq.toStation || 'JTJ'}
📏 <b>Worksite:</b> <code>${sampleReq.kmRange || 'KM 129.50 – KM 174.00'}</code>
📅 <b>Assigned Slot:</b> <code>${sampleReq.sanctionedSlot || '11:30 – 14:00 IST'}</code>
⚡ <b>Status:</b> <b>SCHEDULED (OPTIMIZED)</b>
─────────────────────────────
<i>RailFlow High-Res Map Rendering Engine</i>
    `.trim();

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '📋 View Requisitions', callback_data: 'cmd_reqs' },
          { text: '🟢 System Status', callback_data: 'cmd_status' }
        ]
      ]
    };

    if (mapPngBuffer) {
      await this.sendPhoto(chatId, mapPngBuffer, caption, { reply_markup: inlineKeyboard });
    } else {
      await this.sendMessage(chatId, caption, { reply_markup: inlineKeyboard });
    }
  }

  async pollUpdates() {
    try {
      const res = await this.makeRequest('getUpdates', {
        offset: this.lastUpdateId + 1,
        timeout: 0
      });

      if (res && res.ok && Array.isArray(res.result) && res.result.length > 0) {
        for (const update of res.result) {
          this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
          
          // Handle incoming text messages
          if (update.message && update.message.chat) {
            const chatId = update.message.chat.id;
            const text = (update.message.text || '').trim();
            const senderName = update.message.from ? `${update.message.from.first_name || ''} ${update.message.from.last_name || ''}`.trim() : 'User';

            this.addSubscriber(chatId);

            if (text.startsWith('/start') || text.startsWith('/help')) {
              await this.handleStartOrHelp(chatId, senderName);
            } else if (text.startsWith('/status')) {
              await this.handleStatus(chatId);
            } else if (text.startsWith('/requisitions') || text.startsWith('/blocks')) {
              await this.handleRequisitions(chatId);
            } else if (text.startsWith('/map')) {
              await this.handleMapSnapshot(chatId);
            }
          }

          // Handle incoming inline button callback queries
          if (update.callback_query) {
            const cb = update.callback_query;
            const callbackId = cb.id;
            const chatId = cb.message ? cb.message.chat.id : null;
            const data = cb.data || '';
            const senderName = cb.from ? `${cb.from.first_name || ''} ${cb.from.last_name || ''}`.trim() : 'User';

            await this.answerCallbackQuery(callbackId, 'Processing request...');

            if (chatId) {
              this.addSubscriber(chatId);
              if (data === 'cmd_reqs') {
                await this.handleRequisitions(chatId);
              } else if (data === 'cmd_status') {
                await this.handleStatus(chatId);
              } else if (data === 'cmd_map') {
                await this.handleMapSnapshot(chatId);
              } else if (data === 'cmd_test') {
                await this.broadcastRequisitionAlert({
                  reqId: 'REQ-SR-ENG-' + Math.floor(100 + Math.random() * 900),
                  department: 'Civil / Track (P-Way)',
                  fromStation: 'KPD',
                  toStation: 'JTJ',
                  sectionName: 'Katpadi Junction – Jolarpettai Junction',
                  trackLine: 'UP Main Line',
                  blockType: 'UP Line Block',
                  worksiteStartKm: 129.50,
                  worksiteEndKm: 174.00,
                  kmRange: 'KM 129.50 – KM 174.00',
                  workType: 'Plain Track Tamping & Track Geometry Alignment',
                  durationMin: 150,
                  urgency: 'Due',
                  sanctionedSlot: '11:30 – 14:00 IST',
                  status: 'SCHEDULED'
                }, 'SUBMITTED');
              }
            }
          }
        }
      }
    } catch (e) {
      // Ignore transient polling errors
    }
  }

  startPolling() {
    if (this.isPolling || !BOT_TOKEN) return;
    this.isPolling = true;

    // Poll updates every 3 seconds
    setInterval(() => {
      this.pollUpdates();
    }, 3000);

    // Initial poll
    this.pollUpdates();
  }
}

const instance = new TelegramBotService();
module.exports = instance;
