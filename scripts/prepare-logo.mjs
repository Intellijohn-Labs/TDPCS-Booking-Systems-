import fs from 'fs';
import zlib from 'zlib';

// Standard CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, toCrc, crcBuf]);
}

function encodePng(width, height, rgbaBuffer) {
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Scanlines with filter byte 0
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const offset = y * (1 + width * 4);
    scanlines[offset] = 0; // filter None
    rgbaBuffer.copy(scanlines, offset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(scanlines, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([pngSig, ihdrChunk, idatChunk, iendChunk]);
}

function processLogo() {
  const srcPath = 'C:/Users/shaha/.gemini/antigravity/brain/b898d0a2-0d05-4c75-9aa0-a207c7eadfe1/.user_uploaded/media_1792511600374_1f06fd30.png';
  fs.copyFileSync(srcPath, 'public/logo-original.png');

  const buf = fs.readFileSync(srcPath);
  let pos = 8;
  const idatChunks = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IDAT') idatChunks.push(buf.subarray(pos + 8, pos + 8 + len));
    pos += 8 + len + 4;
  }
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const width = 503;
  const height = 640;
  const bpp = 4;
  const stride = 1 + width * bpp;
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * stride];
    const rowStart = y * stride + 1;
    const outRowStart = y * width * bpp;
    const prevOutRowStart = (y - 1) * width * bpp;

    for (let i = 0; i < width * bpp; i++) {
      const rawVal = raw[rowStart + i];
      const a = i >= bpp ? pixels[outRowStart + i - bpp] : 0;
      const b = y > 0 ? pixels[prevOutRowStart + i] : 0;
      const c = (y > 0 && i >= bpp) ? pixels[prevOutRowStart + i - bpp] : 0;

      let val = 0;
      if (filter === 0) val = rawVal;
      else if (filter === 1) val = (rawVal + a) & 0xff;
      else if (filter === 2) val = (rawVal + b) & 0xff;
      else if (filter === 3) val = (rawVal + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
        val = (rawVal + pr) & 0xff;
      }
      pixels[outRowStart + i] = val;
    }
  }

  // Flood fill from borders to make outer white transparent
  const visited = new Uint8Array(width * height);
  const queue = [];

  function isOuterWhite(x, y) {
    const idx = (y * width + x) * 4;
    const r = pixels[idx];
    const g = pixels[idx+1];
    const b = pixels[idx+2];
    return r > 240 && g > 240 && b > 240;
  }

  for (let x = 0; x < width; x++) {
    if (isOuterWhite(x, 0)) { queue.push(x, 0); visited[x] = 1; }
    if (isOuterWhite(x, height - 1)) { queue.push(x, height - 1); visited[(height - 1) * width + x] = 1; }
  }
  for (let y = 0; y < height; y++) {
    if (isOuterWhite(0, y) && !visited[y * width]) { queue.push(0, y); visited[y * width] = 1; }
    if (isOuterWhite(width - 1, y) && !visited[y * width + width - 1]) { queue.push(width - 1, y); visited[y * width + width - 1] = 1; }
  }

  let head = 0;
  while (head < queue.length) {
    const x = queue[head++];
    const y = queue[head++];
    const idx = (y * width + x) * 4;
    pixels[idx + 3] = 0; // transparent

    const neighbors = [
      [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
    ];
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const npos = ny * width + nx;
        if (!visited[npos] && isOuterWhite(nx, ny)) {
          visited[npos] = 1;
          queue.push(nx, ny);
        }
      }
    }
  }

  // Find non-transparent bounds
  let minX = width, maxX = 0, minY = height, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = pixels[(y * width + x) * 4 + 3];
      if (a > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Add slight margin (8px)
  const pad = 8;
  const cropX0 = Math.max(0, minX - pad);
  const cropY0 = Math.max(0, minY - pad);
  const cropX1 = Math.min(width - 1, maxX + pad);
  const cropY1 = Math.min(height - 1, maxY + pad);

  const cropW = cropX1 - cropX0 + 1;
  const cropH = cropY1 - cropY0 + 1;

  const cropped = Buffer.alloc(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    const srcY = cropY0 + y;
    for (let x = 0; x < cropW; x++) {
      const srcX = cropX0 + x;
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * cropW + x) * 4;
      cropped[dstIdx] = pixels[srcIdx];
      cropped[dstIdx + 1] = pixels[srcIdx + 1];
      cropped[dstIdx + 2] = pixels[srcIdx + 2];
      cropped[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }

  const pngData = encodePng(cropW, cropH, cropped);
  fs.writeFileSync('public/logo.png', pngData);
  fs.writeFileSync('app/icon.png', pngData);
  console.log(`Processed logo successfully: ${cropW}x${cropH}, saved to public/logo.png and app/icon.png`);
}

processLogo();
