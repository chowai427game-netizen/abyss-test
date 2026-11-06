const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "assets/combat/monsters/manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const expectedCount = 36;
const expectedWidth = 2304;
const expectedHeight = 1536;
const maxTotalBytes = 116_000_000;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function paethPredictor(left, up, upperLeft) {
  const p = left + up - upperLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upperLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upperLeft;
}

function inspectPng(filePath) {
  const png = fs.readFileSync(filePath);
  assert.ok(png.length >= 8, `${filePath}: file is too short to be a PNG`);
  assert.deepEqual(png.subarray(0, 8), pngSignature, `${filePath}: invalid PNG signature`);

  let offset = 8;
  let header = null;
  let sawEnd = false;
  const imageData = [];

  while (offset < png.length) {
    assert.ok(offset + 12 <= png.length, `${filePath}: truncated PNG chunk header`);
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;
    assert.ok(crcEnd <= png.length, `${filePath}: truncated ${type} chunk`);

    const chunkTypeAndData = png.subarray(offset + 4, dataEnd);
    const expectedCrc = png.readUInt32BE(dataEnd);
    assert.equal(crc32(chunkTypeAndData), expectedCrc, `${filePath}: ${type} CRC mismatch`);

    if (type === "IHDR") {
      assert.equal(length, 13, `${filePath}: invalid IHDR length`);
      header = {
        width: png.readUInt32BE(dataStart),
        height: png.readUInt32BE(dataStart + 4),
        bitDepth: png[dataStart + 8],
        colorType: png[dataStart + 9],
        compression: png[dataStart + 10],
        filter: png[dataStart + 11],
        interlace: png[dataStart + 12],
      };
    } else if (type === "IDAT") {
      imageData.push(png.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      sawEnd = true;
      assert.equal(length, 0, `${filePath}: invalid IEND length`);
      assert.equal(crcEnd, png.length, `${filePath}: data found after IEND`);
      break;
    }
    offset = crcEnd;
  }

  assert.ok(header, `${filePath}: missing IHDR`);
  assert.ok(sawEnd, `${filePath}: missing IEND`);
  assert.ok(imageData.length > 0, `${filePath}: missing IDAT`);
  assert.equal(header.width, expectedWidth, `${filePath}: unexpected width`);
  assert.equal(header.height, expectedHeight, `${filePath}: unexpected height`);
  assert.equal(header.bitDepth, 8, `${filePath}: expected 8-bit channels`);
  assert.equal(header.colorType, 6, `${filePath}: expected RGBA PNG to retain alpha`);
  assert.equal(header.compression, 0, `${filePath}: unsupported PNG compression method`);
  assert.equal(header.filter, 0, `${filePath}: unsupported PNG filter method`);
  assert.equal(header.interlace, 0, `${filePath}: expected non-interlaced PNG`);

  const bytesPerPixel = 4;
  const rowBytes = header.width * bytesPerPixel;
  const decoded = zlib.inflateSync(Buffer.concat(imageData));
  assert.equal(decoded.length, header.height * (rowBytes + 1), `${filePath}: decoded data length mismatch`);

  // Reconstruct only the alpha channel. PNG filters operate bytewise, and each
  // alpha byte depends only on neighboring alpha bytes at the same channel.
  let previousAlpha = new Uint8Array(header.width);
  let transparentPixels = 0;
  let visiblePixels = 0;
  let alphaMin = 255;
  let alphaMax = 0;
  for (let y = 0; y < header.height; y += 1) {
    const rowStart = y * (rowBytes + 1);
    const filterType = decoded[rowStart];
    assert.ok(filterType <= 4, `${filePath}: invalid PNG row filter ${filterType} at row ${y}`);
    const currentAlpha = new Uint8Array(header.width);
    for (let x = 0; x < header.width; x += 1) {
      const byteIndex = rowStart + 1 + x * bytesPerPixel + 3;
      const raw = decoded[byteIndex];
      const left = x > 0 ? currentAlpha[x - 1] : 0;
      const up = previousAlpha[x];
      const upperLeft = x > 0 ? previousAlpha[x - 1] : 0;
      let predictor = 0;
      if (filterType === 1) predictor = left;
      else if (filterType === 2) predictor = up;
      else if (filterType === 3) predictor = Math.floor((left + up) / 2);
      else if (filterType === 4) predictor = paethPredictor(left, up, upperLeft);
      const alpha = (raw + predictor) & 0xff;
      currentAlpha[x] = alpha;
      if (alpha === 0) transparentPixels += 1;
      if (alpha > 0) visiblePixels += 1;
      if (alpha < alphaMin) alphaMin = alpha;
      if (alpha > alphaMax) alphaMax = alpha;
    }
    previousAlpha = currentAlpha;
  }
  assert.ok(transparentPixels > 0, `${filePath}: expected transparent background pixels`);
  assert.ok(visiblePixels > 0, `${filePath}: expected visible subject pixels`);
  assert.ok(alphaMin < 255, `${filePath}: alpha channel appears fully opaque`);
  return { bytes: png.length, alphaMin, alphaMax, transparentPixels };
}

assert.equal(manifest.totalMonsters, expectedCount, "manifest totalMonsters contract changed");
assert.equal(manifest.portraits.length, expectedCount, `expected ${expectedCount} portrait entries`);
const seenPaths = new Set();
let totalBytes = 0;
for (const entry of manifest.portraits) {
  assert.ok(entry.path.startsWith("assets/combat/monsters/"), `${entry.id}: path left the stable monster asset directory`);
  assert.ok(entry.path.endsWith(".png"), `${entry.id}: expected PNG asset`);
  assert.ok(!seenPaths.has(entry.path), `${entry.id}: duplicate portrait path`);
  seenPaths.add(entry.path);
  const filePath = path.join(root, entry.path);
  assert.ok(fs.existsSync(filePath), `${entry.id}: missing asset ${entry.path}`);
  const result = inspectPng(filePath);
  totalBytes += result.bytes;
}
assert.ok(totalBytes <= maxTotalBytes, `portrait PNG budget exceeded: ${totalBytes.toLocaleString()} > ${maxTotalBytes.toLocaleString()} bytes`);
console.log(`PASS: ${expectedCount} monster portraits decode as ${expectedWidth}x${expectedHeight} 8-bit RGBA PNGs with transparency.`);
console.log(`PASS: all PNG chunk CRCs, decoded scanlines, alpha samples and stable manifest paths are valid.`);
console.log(`PASS: total PNG payload is ${(totalBytes / 1_000_000).toFixed(2)} MB (budget ${(maxTotalBytes / 1_000_000).toFixed(2)} MB).`);
