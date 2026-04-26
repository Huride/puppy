import fs from "node:fs";
import path from "node:path";

const WIDTH = 560;
const HEIGHT = 330;
const OUT = path.resolve("assets/demo/pawtrol-bori-demo.gif");

const palette = [
  [246, 248, 251], // 0 background
  [31, 38, 51], // 1 terminal
  [39, 46, 58], // 2 popup
  [255, 255, 255], // 3 white
  [226, 232, 240], // 4 text
  [148, 163, 184], // 5 muted
  [47, 140, 255], // 6 blue
  [255, 176, 32], // 7 orange
  [255, 92, 74], // 8 red
  [39, 122, 70], // 9 green
  [247, 243, 232], // 10 fur
  [239, 229, 214], // 11 ear
  [108, 96, 86], // 12 line
  [166, 216, 121], // 13 sweater
  [78, 63, 48], // 14 shadow
  [16, 23, 42], // 15 panel deep
  [215, 223, 235], // 16 border
  [244, 185, 163], // 17 cheek
  [191, 219, 254], // 18 pale blue
  [237, 242, 247], // 19 light fill
  [255, 244, 214], // 20 warm text
  [219, 234, 254], // 21 pale stroke
  [21, 128, 61], // 22 green dark
  [180, 35, 24], // 23 red dark
  [143, 104, 21], // 24 amber dark
];

while (palette.length < 256) {
  palette.push([0, 0, 0]);
}

const glyphs = {
  " ": ["000", "000", "000", "000", "000", "000", "000"],
  "!": ["1", "1", "1", "1", "1", "0", "1"],
  ".": ["0", "0", "0", "0", "0", "0", "1"],
  ":": ["0", "1", "0", "0", "0", "1", "0"],
  "-": ["000", "000", "000", "111", "000", "000", "000"],
  "/": ["001", "001", "010", "010", "100", "100", "000"],
  "%": ["1001", "1001", "0010", "0100", "1001", "1001", "0000"],
  "0": ["111", "101", "101", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "010", "010", "111"],
  "2": ["111", "001", "001", "111", "100", "100", "111"],
  "3": ["111", "001", "001", "111", "001", "001", "111"],
  "4": ["101", "101", "101", "111", "001", "001", "001"],
  "5": ["111", "100", "100", "111", "001", "001", "111"],
  "6": ["111", "100", "100", "111", "101", "101", "111"],
  "7": ["111", "001", "001", "010", "010", "010", "010"],
  "8": ["111", "101", "101", "111", "101", "101", "111"],
  "9": ["111", "101", "101", "111", "001", "001", "111"],
  A: ["010", "101", "101", "111", "101", "101", "101"],
  B: ["110", "101", "101", "110", "101", "101", "110"],
  C: ["111", "100", "100", "100", "100", "100", "111"],
  D: ["110", "101", "101", "101", "101", "101", "110"],
  E: ["111", "100", "100", "111", "100", "100", "111"],
  F: ["111", "100", "100", "111", "100", "100", "100"],
  G: ["111", "100", "100", "101", "101", "101", "111"],
  H: ["101", "101", "101", "111", "101", "101", "101"],
  I: ["111", "010", "010", "010", "010", "010", "111"],
  J: ["001", "001", "001", "001", "101", "101", "111"],
  K: ["101", "101", "110", "100", "110", "101", "101"],
  L: ["100", "100", "100", "100", "100", "100", "111"],
  M: ["1001", "1111", "1111", "1001", "1001", "1001", "1001"],
  N: ["1001", "1101", "1101", "1011", "1011", "1001", "1001"],
  O: ["111", "101", "101", "101", "101", "101", "111"],
  P: ["111", "101", "101", "111", "100", "100", "100"],
  Q: ["1110", "1001", "1001", "1001", "1011", "1001", "1111"],
  R: ["110", "101", "101", "110", "110", "101", "101"],
  S: ["111", "100", "100", "111", "001", "001", "111"],
  T: ["111", "010", "010", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "101", "101", "111"],
  V: ["101", "101", "101", "101", "101", "101", "010"],
  W: ["1001", "1001", "1001", "1001", "1111", "1111", "1001"],
  X: ["101", "101", "101", "010", "101", "101", "101"],
  Y: ["101", "101", "101", "010", "010", "010", "010"],
  Z: ["111", "001", "001", "010", "100", "100", "111"],
};

function frameBuffer(fill = 0) {
  return new Uint8Array(WIDTH * HEIGHT).fill(fill);
}

function set(buf, x, y, color) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix >= 0 && ix < WIDTH && iy >= 0 && iy < HEIGHT) {
    buf[iy * WIDTH + ix] = color;
  }
}

function rect(buf, x, y, w, h, color) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(WIDTH, Math.round(x + w));
  const y1 = Math.min(HEIGHT, Math.round(y + h));
  for (let yy = y0; yy < y1; yy += 1) {
    buf.fill(color, yy * WIDTH + x0, yy * WIDTH + x1);
  }
}

function roundedRect(buf, x, y, w, h, r, color) {
  rect(buf, x + r, y, w - r * 2, h, color);
  rect(buf, x, y + r, r, h - r * 2, color);
  rect(buf, x + w - r, y + r, r, h - r * 2, color);
  ellipse(buf, x + r, y + r, r, r, color);
  ellipse(buf, x + w - r, y + r, r, r, color);
  ellipse(buf, x + r, y + h - r, r, r, color);
  ellipse(buf, x + w - r, y + h - r, r, r, color);
}

function ellipse(buf, cx, cy, rx, ry, color) {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(WIDTH - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(HEIGHT - 1, Math.ceil(cy + ry));
  const rr = rx * rx * ry * ry;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx * ry * ry + dy * dy * rx * rx <= rr) {
        set(buf, x, y, color);
      }
    }
  }
}

function line(buf, x0, y0, x1, y1, color, thickness = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    ellipse(buf, x, y, thickness, thickness, color);
  }
}

function text(buf, raw, x, y, color, scale = 2) {
  let cursor = x;
  for (const ch of raw.toUpperCase()) {
    const glyph = glyphs[ch] ?? glyphs[" "];
    for (let gy = 0; gy < glyph.length; gy += 1) {
      for (let gx = 0; gx < glyph[gy].length; gx += 1) {
        if (glyph[gy][gx] === "1") {
          rect(buf, cursor + gx * scale, y + gy * scale, scale, scale, color);
        }
      }
    }
    cursor += (glyph[0].length + 1) * scale;
  }
}

function bar(buf, x, y, w, h, pct, color) {
  rect(buf, x, y, w, h, 15);
  rect(buf, x, y, w, 1, 6);
  rect(buf, x, y + h - 1, w, 1, 6);
  rect(buf, x, y, Math.max(2, Math.round(w * pct)), h, color);
}

function drawBase(buf) {
  roundedRect(buf, 24, 24, 512, 278, 18, 1);
  rect(buf, 24, 24, 512, 34, 15);
  ellipse(buf, 46, 41, 5, 5, 8);
  ellipse(buf, 62, 41, 5, 5, 7);
  ellipse(buf, 78, 41, 5, 5, 9);
  text(buf, "PAWTROL SESSION", 104, 34, 4, 2);
  text(buf, "$ PAWTROL WATCH -- CODEX", 50, 78, 5, 2);
  text(buf, "AUTH.SPEC.TS FAILED AGAIN", 50, 106, 5, 2);
  text(buf, "TOKEN ETA 12M   CTX 78%", 50, 134, 5, 2);
  text(buf, "BORI IS PATROLLING...", 50, 162, 5, 2);
}

function drawDog(buf, x, y, phase, mode) {
  const hop = mode === "happy" ? Math.sin(phase * Math.PI * 2) * 4 : Math.sin(phase * Math.PI * 2) * 2;
  const wag = Math.sin(phase * Math.PI * 2) * (mode === "alert" ? 18 : mode === "happy" ? 24 : 10);
  const dx = Math.sin(phase * Math.PI * 2) * 5;

  ellipse(buf, x + 78, y + 112, 68, 9, 14);
  line(buf, x + 116, y + 58 - hop, x + 154, y + 40 - hop - wag * 0.25, 10, 9);
  line(buf, x + 154, y + 40 - hop - wag * 0.25, x + 176, y + 58 - hop, 10, 8);
  ellipse(buf, x + 92, y + 70 - hop, 56, 37, 10);
  ellipse(buf, x + 92, y + 71 - hop, 48, 28, 13);
  ellipse(buf, x + 46 + dx, y + 95 - hop, 10, 22, 10);
  ellipse(buf, x + 82 - dx, y + 98 - hop, 10, 23, 10);
  ellipse(buf, x + 122 + dx, y + 98 - hop, 16, 22, 10);
  ellipse(buf, x + 56, y + 38 - hop, 36, 34, 10);
  ellipse(buf, x + 26, y + 36 - hop, 16, 25, 11);
  ellipse(buf, x + 85, y + 36 - hop, 16, 25, 11);
  ellipse(buf, x + 56, y + 50 - hop, 19, 13, 3);
  ellipse(buf, x + 44, y + 41 - hop, 3, 4, 1);
  ellipse(buf, x + 69, y + 41 - hop, 3, 4, 1);
  ellipse(buf, x + 56, y + 50 - hop, 5, 4, 1);
  line(buf, x + 48, y + 59 - hop, x + 64, y + 59 - hop, 1, 2);
  ellipse(buf, x + 35, y + 53 - hop, 5, 4, 17);
  ellipse(buf, x + 78, y + 53 - hop, 5, 4, 17);
  line(buf, x + 42, y + 26 - hop, x + 48, y + 17 - hop, 12, 2);
  line(buf, x + 48, y + 17 - hop, x + 56, y + 27 - hop, 12, 2);
  line(buf, x + 56, y + 27 - hop, x + 65, y + 17 - hop, 12, 2);

  if (mode === "alert") {
    line(buf, x + 105, y + 15, x + 123, y + 7, 8, 2);
    line(buf, x + 108, y + 30, x + 130, y + 30, 8, 2);
    line(buf, x + 102, y + 44, x + 120, y + 55, 8, 2);
  }
}

function drawBubble(buf, frame) {
  const visible = frame >= 8 && frame <= 34;
  if (!visible) {
    return;
  }
  const alphaStep = Math.min(1, (frame - 8) / 3);
  const y = 118 - Math.round(alphaStep * 8);
  roundedRect(buf, 282, y, 230, 54, 14, 3);
  rect(buf, 478, y + 48, 16, 18, 3);
  text(buf, "BARK! CHECK LOOP", 306, y + 17, 1, 2);
}

function drawPopup(buf, frame) {
  if (frame < 18 || frame > 38) {
    return;
  }
  const slide = Math.max(0, 22 - (frame - 18) * 4);
  const x = 244;
  const y = 42 + slide;
  roundedRect(buf, x, y, 278, 178, 12, 2);
  text(buf, "BORI CHECKUP", x + 18, y + 18, 3, 2);
  roundedRect(buf, x + 202, y + 13, 56, 20, 10, 23);
  text(buf, "RISK", x + 215, y + 18, 3, 1);
  roundedRect(buf, x + 18, y + 49, 242, 40, 8, 15);
  text(buf, "AUTH.SPEC.TS LOOP X3", x + 30, y + 61, 4, 2);
  text(buf, "CTX 78%", x + 30, y + 104, 4, 2);
  bar(buf, x + 102, y + 106, 145, 8, 0.78, 6);
  text(buf, "ETA 12M", x + 30, y + 126, 4, 2);
  bar(buf, x + 102, y + 128, 145, 8, 0.62, 6);
  text(buf, "LOOP 3X", x + 30, y + 148, 4, 2);
  bar(buf, x + 102, y + 150, 145, 8, 0.86, 7);
}

function drawFrame(frame) {
  const buf = frameBuffer();
  drawBase(buf);
  drawBubble(buf, frame);
  drawPopup(buf, frame);
  const mode = frame < 8 ? "walk" : frame < 18 ? "alert" : frame < 32 ? "alert" : "happy";
  const dogX = 365 + Math.sin(frame / 2) * (mode === "walk" ? 8 : 2);
  drawDog(buf, dogX, 183, frame / 8, mode);
  return buf;
}

function wordLE(value) {
  return [value & 0xff, (value >> 8) & 0xff];
}

function packSubBlocks(bytes) {
  const out = [];
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255);
    out.push(chunk.length, ...chunk);
  }
  out.push(0);
  return out;
}

function lzwEncode(indices, minCodeSize = 8) {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  let codeSize = minCodeSize + 1;
  const bits = [];

  function write(code) {
    for (let i = 0; i < codeSize; i += 1) {
      bits.push((code >> i) & 1);
    }
  }

  for (let i = 0; i < indices.length; ) {
    write(clear);
    codeSize = minCodeSize + 1;
    let emitted = 0;
    while (i < indices.length && emitted < 250) {
      write(indices[i]);
      i += 1;
      emitted += 1;
    }
  }

  write(end);

  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) {
      byte |= (bits[i + j] ?? 0) << j;
    }
    bytes.push(byte);
  }
  return bytes;
}

function encodeGif(frames) {
  const out = [];
  const append = (bytes) => {
    for (const byte of bytes) {
      out.push(byte);
    }
  };
  out.push(...Buffer.from("GIF89a"));
  out.push(...wordLE(WIDTH), ...wordLE(HEIGHT));
  out.push(0xf7, 0, 0);
  for (const [r, g, b] of palette) {
    out.push(r, g, b);
  }
  out.push(0x21, 0xff, 0x0b, ...Buffer.from("NETSCAPE2.0"), 0x03, 0x01, 0x00, 0x00, 0x00);

  for (const frame of frames) {
    out.push(0x21, 0xf9, 0x04, 0x08, ...wordLE(16), 0x00, 0x00);
    out.push(0x2c, 0, 0, 0, 0, ...wordLE(WIDTH), ...wordLE(HEIGHT), 0x00);
    out.push(0x08);
    append(packSubBlocks(lzwEncode(frame, 8)));
  }

  out.push(0x3b);
  return Buffer.from(out);
}

const frames = Array.from({ length: 24 }, (_, i) => drawFrame(Math.round((i * 39) / 23)));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, encodeGif(frames));
console.log(`wrote ${OUT}`);
