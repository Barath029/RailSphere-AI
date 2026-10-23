const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Minimal 5x7 ASCII Bitmap Font for crisp rendering on PNG maps
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
  '[': [0x0E, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0E],
  ']': [0x0E, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0E]
};

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
    let clean = hex.replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    const num = parseInt(clean, 16);
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
    const str = String(text).toUpperCase();
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

// Generate complete visual map snapshot card
const png = new PureNodePNG(900, 500, '#0b1329');

// Header Banner
png.fillRect(0, 0, 900, 60, '#1e293b');
png.drawText('SOUTHERN RAILWAY - MAINTENANCE BLOCK MAP', 20, 18, '#38bdf8', 2);
png.drawText('LIVE CORRIDOR WORKSITE SNAPSHOT', 600, 22, '#94a3b8', 1);

// Outer Frame
png.fillRect(20, 80, 860, 400, '#151e32');

// Text Details Card
png.fillRect(40, 100, 820, 90, '#1e293b');
png.drawText('REQ ID: REQ-SR-CIVIL-129', 55, 115, '#f1f5f9', 2);
png.drawText('DEPT: CIVIL / TRACK (P-WAY)', 450, 115, '#38bdf8', 2);
png.drawText('CORRIDOR: KATPADI (KPD) - JOLARPETTAI (JTJ)', 55, 145, '#fbbf24', 2);
png.drawText('SLOT: 16:30 - 19:00 IST', 580, 145, '#4ade80', 2);

// Railway Track Lines
png.drawText('UP MAIN LINE', 40, 220, '#38bdf8', 1);
png.drawLine(40, 240, 860, 240, '#0284c7', 4);

png.drawText('DOWN MAIN LINE', 40, 310, '#c084fc', 1);
png.drawLine(40, 330, 860, 330, '#9333ea', 4);

// Worksite Highlight Box (KM 129.50 - 174.00)
png.fillRect(320, 225, 300, 120, '#ef4444', 160);
png.drawLine(320, 240, 620, 240, '#f87171', 6);
png.drawText('WORKSITE: KM 129.50 - KM 174.00', 335, 275, '#ffffff', 2);
png.drawText('STATUS: SCHEDULED (OPTIMIZED)', 340, 305, '#fef08a', 2);

// Station Nodes
const stations = [
  { name: 'MAS', x: 80 },
  { name: 'AJJ', x: 220 },
  { name: 'KPD', x: 360 },
  { name: 'JTJ', x: 580 },
  { name: 'SA',  x: 720 },
  { name: 'ED',  x: 840 }
];

stations.forEach(s => {
  png.drawCircle(s.x, 240, 10, '#ffffff');
  png.drawCircle(s.x, 240, 6, '#0f172a');
  png.drawText(s.name, s.x - 12, 205, '#f8fafc', 2);
});

// Train positions
png.drawCircle(260, 240, 8, '#38bdf8');
png.drawText('#20643', 245, 260, '#38bdf8', 1);

png.drawCircle(780, 330, 8, '#c084fc');
png.drawText('#12675', 765, 350, '#c084fc', 1);

// Footer watermark
png.drawText('RAILFLOW DECISION SUPPORT SYSTEM - TELEGRAM @TRACK_PLAN_BOT', 220, 465, '#64748b', 1);

const outBuf = png.toBuffer();
fs.writeFileSync(path.join(__dirname, 'test_map_card.png'), outBuf);
console.log('Generated test_map_card.png! Size:', outBuf.length, 'bytes');
