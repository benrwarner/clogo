#!/usr/bin/env node
// Render one or more logo SVGs to a single PNG preview sheet you can LOOK at (Read the PNG).
// Every logo is shown on each background, at large size and at real small sizes
// (16/32px rendered at true resolution, then enlarged with hard pixels) plus a browser-tab mock.
//
//   node render.mjs concept-a.svg concept-b.svg [--out preview.png] [--bg "#ffffff,#0f0f12,#f4efe6"]
//
// Square-ish SVGs are treated as marks/favicons; wide ones as lockups (header sizes 96/32/20px tall).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, die, writeFile, renderPng, pngDataUri, parseSvg, parseColor, luminance } from './lib.mjs';
import { captionFont, labelPath } from './fonts.mjs';

const args = parseArgs();
const files = args._;
if (!files.length) die('usage: render.mjs a.svg [b.svg ...] [--out preview.png] [--bg "#fff,#111"]');
const bgs = String(args.bg || '#ffffff,#0f0f12').split(',').map((s) => s.trim()).filter(Boolean);
const out = args.out || 'preview.png';
const font = await captionFont();

const caption = (t, x, y, bg, size = 11) => {
  if (!font) return '';
  const c = parseColor(bg);
  const fill = c && luminance(c) < 0.4 ? '#a1a1aa' : '#71717a';
  return labelPath(font, t, x, y, size, fill);
};

// Embed a rendered PNG. With `scale` > 1 the true-resolution render is redrawn as one rect per pixel
// (hard nearest-neighbour enlargement — resvg ignores image-rendering), so real favicon pixels are visible.
function img(svg, fitW, fitH, x, y, scale = 1) {
  const { png, width, height, pixels } = fitW ? renderPng(svg, { width: fitW }) : renderPng(svg, { height: fitH });
  if (scale <= 1) {
    return { el: `<image x="${x}" y="${y}" width="${width}" height="${height}" href="${pngDataUri(png)}"/>`, width, height };
  }
  const rects = [];
  for (let py = 0; py < height; py++) {
    let run = null;
    const flush = () => { if (run) rects.push(`<rect x="${x + run.x0 * scale}" y="${y + py * scale}" width="${run.n * scale}" height="${scale}" fill="${run.fill}"${run.a < 1 ? ` fill-opacity="${run.a}"` : ''}/>`); run = null; };
    for (let px = 0; px < width; px++) {
      const i = (py * width + px) * 4;
      const a = pixels[i + 3];
      if (!a) { flush(); continue; }
      // resvg pixels are premultiplied alpha
      const un = (v) => Math.min(255, Math.round((v * 255) / a));
      const fill = `rgb(${un(pixels[i])},${un(pixels[i + 1])},${un(pixels[i + 2])})`;
      const op = +(a / 255).toFixed(3);
      if (run && run.fill === fill && run.a === op) run.n++;
      else { flush(); run = { x0: px, n: 1, fill, a: op }; }
    }
    flush();
  }
  return { el: `<g shape-rendering="crispEdges">${rects.join('')}</g>`, width: width * scale, height: height * scale };
}

function fitBox(aspect, box) {
  return aspect >= 1 ? { w: box, h: box / aspect } : { w: box * aspect, h: box };
}

function markPanel(svg, aspect, bg, ox, oy) {
  const W = 440, H = 230;
  const p = [`<rect x="${ox}" y="${oy}" width="${W}" height="${H}" fill="${bg}"/>`, caption(bg, ox + 12, oy + 18, bg, 10)];
  const big = fitBox(aspect, 160);
  p.push(img(svg, Math.round(big.w), null, ox + 24 + (160 - big.w) / 2, oy + 34 + (160 - big.h) / 2).el);
  p.push(caption('large', ox + 24, oy + 216, bg));
  const s32 = fitBox(aspect, 32), s16 = fitBox(aspect, 16);
  p.push(img(svg, Math.max(1, Math.round(s32.w)), null, ox + 216, oy + 34, 3).el);
  p.push(caption('32px ×3', ox + 216, oy + 148, bg));
  p.push(img(svg, Math.max(1, Math.round(s16.w)), null, ox + 336, oy + 34, 4).el);
  p.push(caption('16px ×4', ox + 336, oy + 116, bg));
  // Browser-tab mock with the favicon at true 16px.
  const c = parseColor(bg);
  const tab = c && luminance(c) < 0.4 ? '#27272a' : '#f4f4f5';
  p.push(`<rect x="${ox + 216}" y="${oy + 164}" width="200" height="34" rx="8" fill="${tab}"/>`);
  p.push(img(svg, Math.max(1, Math.round(s16.w)), null, ox + 228, oy + 173).el);
  p.push(caption('Tab title — actual size', ox + 252, oy + 185, tab, 11));
  return { svg: p.join(''), W, H };
}

function lockupPanel(svg, aspect, bg, ox, oy) {
  const w96 = 96 * aspect, w32 = 32 * aspect, w20 = 20 * aspect;
  const W = Math.max(440, Math.round(w96 + 48), Math.round(w32 + w20 + 80)), H = 230;
  const p = [`<rect x="${ox}" y="${oy}" width="${W}" height="${H}" fill="${bg}"/>`, caption(bg, ox + 12, oy + 18, bg, 10)];
  p.push(img(svg, null, 96, ox + 24, oy + 34).el);
  p.push(caption('96px tall', ox + 24, oy + 146, bg));
  p.push(img(svg, null, 32, ox + 24, oy + 160).el);
  p.push(img(svg, null, 20, ox + 24 + w32 + 32, oy + 166).el);
  p.push(caption('32px / 20px tall — header sizes, actual', ox + 24, oy + 216, bg));
  return { svg: p.join(''), W, H };
}

try {
  const rows = [];
  let sheetW = 0, y = 16;
  for (const f of files) {
    const svg = fs.readFileSync(f, 'utf8');
    const vb = parseSvg(svg).viewBox;
    if (!vb) die(`${f}: no viewBox`);
    const aspect = vb.w / vb.h;
    const isMark = aspect > 0.7 && aspect < 1.45;
    const parts = [caption(`${path.basename(f)}  —  ${isMark ? 'mark / favicon' : 'lockup'}  (${(+vb.w.toFixed(1))}×${(+vb.h.toFixed(1))})`, 16, y + 14, '#ffffff', 13)];
    let x = 16, h = 0;
    for (const bg of bgs) {
      const panel = (isMark ? markPanel : lockupPanel)(svg, aspect, bg, x, y + 24);
      parts.push(panel.svg);
      x += panel.W + 12; h = Math.max(h, panel.H);
    }
    sheetW = Math.max(sheetW, x + 4);
    rows.push(parts.join(''));
    y += 24 + h + 20;
  }
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sheetW} ${y}"><rect width="${sheetW}" height="${y}" fill="#ffffff"/>${rows.join('')}</svg>`;
  writeFile(out, renderPng(sheet, { width: sheetW }).png);
  console.log(`preview: ${out}  — open it with your image viewer / Read tool and critique it.`);
} catch (e) {
  if (process.env.DEBUG) console.error(e.stack);
  die(e.message);
}
