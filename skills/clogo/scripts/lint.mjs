#!/usr/bin/env node
// Objective checks for a logo SVG. Run after every revision; fix ERRORs, weigh WARNs.
//
//   node lint.mjs logo.svg [--role mark|lockup] [--bg "#ffffff,#0f0f12"]
//
// Exit code 1 if any ERROR.
import fs from 'node:fs';
import { parseArgs, die, parseSvg, renderPng, parseColor, contrast } from './lib.mjs';

const args = parseArgs();
const file = args._[0];
if (!file) die('usage: lint.mjs logo.svg [--role mark|lockup] [--bg "#fff,#111"]');
const svg = fs.readFileSync(file, 'utf8');
const bgs = String(args.bg || '#ffffff,#0f0f12').split(',').map((s) => s.trim());
const results = [];
const err = (m) => results.push(['ERROR', m]);
const warn = (m) => results.push(['WARN ', m]);
const ok = (m) => results.push(['ok   ', m]);

let parsed;
try { parsed = parseSvg(svg); } catch (e) { die(e.message); }
const { viewBox: vb, attrs } = parsed;

// ---- structure ----
if (!attrs.viewBox) err('root <svg> has no viewBox — it will not scale. Add viewBox="0 0 W H".');
else ok(`viewBox ${attrs.viewBox}`);
if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svg)) err('missing xmlns="http://www.w3.org/2000/svg" (breaks <img src> and favicons).');
const aspect = vb ? vb.w / vb.h : 1;
const role = args.role || (aspect > 0.7 && aspect < 1.45 ? 'mark' : 'lockup');
if (role === 'mark' && vb && Math.abs(aspect - 1) > 0.02) warn(`mark is not square (${vb.w}×${vb.h}); favicons/app icons are square — use a square viewBox.`);

if (/<text[\s>]/i.test(svg)) err('<text> found — fonts may not be installed where this is shown. Outline text with text-to-path.mjs.');
if (/@font-face|font-family/i.test(svg)) warn('font references found — outline all type into paths.');
if (/<image[\s>]/i.test(svg)) err('<image> found — logos must be pure vector (no embedded rasters).');
if (/<script|<foreignObject|on\w+\s*=/i.test(svg)) err('script / foreignObject / event handler found — not allowed in a logo.');
if (/href\s*=\s*"(https?:)?\/\//i.test(svg)) err('external reference found — the SVG must be self-contained.');
if (/<filter[\s>]/i.test(svg)) warn('filter effects (blur/shadow) — often render inconsistently and turn to mush at favicon size.');

const size = Buffer.byteLength(svg);
if (size > 25_000) warn(`file is ${(size / 1024).toFixed(1)} KB — logos should usually be < 10 KB. Simplify paths; export.mjs will also optimise.`);
else ok(`size ${(size / 1024).toFixed(1)} KB`);

// ---- palette ----
const colours = new Set();
for (const m of svg.matchAll(/(?:fill|stroke|stop-color|color)\s*[=:]\s*"?\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-zA-Z]+)/g)) {
  const v = m[1].toLowerCase();
  if (['none', 'currentcolor', 'transparent', 'inherit', 'url'].includes(v)) continue;
  if (parseColor(v)) colours.add(v);
}
if (colours.size > 4) warn(`${colours.size} distinct colours (${[...colours].join(', ')}) — strong logos use 1–3.`);
else ok(`${colours.size} colour(s): ${[...colours].join(', ') || '(none / currentColor)'}`);
if (/currentColor/.test(svg)) warn('uses currentColor — fine inline in HTML, but as a favicon/<img> it renders black. Bake in real colours for exported files.');

// ---- placeholder detector: "letter in a coloured square" ----
const visible = svg.replace(/<(defs|mask|clipPath|symbol)\b[\s\S]*?<\/\1>/gi, '');
const shapes = (visible.match(/<(path|rect|circle|ellipse|polygon|polyline|line|text)\b/gi) || []).length;
let tile = false;
if (vb) {
  const area = vb.w * vb.h;
  const num = (v, ref) => (v == null ? 0 : String(v).endsWith('%') ? (parseFloat(v) / 100) * ref : parseFloat(v));
  for (const m of visible.matchAll(/<rect\b([^>]*)>/gi)) {
    const a = Object.fromEntries([...m[1].matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map((x) => [x[1], x[2]]));
    if (num(a.width, vb.w) * num(a.height, vb.h) >= area * 0.8) tile = true;
  }
  for (const m of visible.matchAll(/<circle\b([^>]*)>/gi)) {
    const rr = parseFloat((m[1].match(/\br\s*=\s*"([\d.]+)"/) || [])[1]);
    if (rr && Math.PI * rr * rr >= area * 0.6) tile = true;
  }
}
if (tile && (shapes === 2 || /<text[\s>]/i.test(svg))) {
  err('looks like the generic placeholder (coloured tile + single letter/glyph). Build a real mark: an icon-derived symbol, ' +
    'a custom monogram with a modification, or a meaningful shape — see references/logo-archetypes.md.');
}

// ---- pixel checks ----
if (vb) {
  const renderAt = (w) => renderPng(svg, { width: Math.max(1, Math.round(aspect >= 1 ? w : w * aspect)) });
  const at64 = renderAt(role === 'mark' ? 64 : 256);
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  const ink = [];
  for (let y = 0; y < at64.height; y++) for (let x = 0; x < at64.width; x++) {
    const i = (y * at64.width + x) * 4, a = at64.pixels[i + 3];
    if (a < 24) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    if (a > 200) {
      const un = (v) => Math.min(255, Math.round((v * 255) / a));
      ink.push({ r: un(at64.pixels[i]), g: un(at64.pixels[i + 1]), b: un(at64.pixels[i + 2]) });
    }
  }
  if (maxX < 0) err('renders as empty — nothing visible.');
  else {
    const fillW = (maxX - minX + 1) / at64.width, fillH = (maxY - minY + 1) / at64.height;
    if (role === 'mark') {
      if (Math.max(fillW, fillH) < 0.7) warn(`content only fills ${(Math.max(fillW, fillH) * 100).toFixed(0)}% of the canvas — too much padding; it will look tiny as a favicon. Aim for 85–100%.`);
      else ok(`content fills ${(Math.max(fillW, fillH) * 100).toFixed(0)}% of the canvas`);
    }
    if (minX > 0.25 * at64.width || minY > 0.25 * at64.height) warn('content is off-centre / viewBox has a large empty margin — crop the viewBox to the artwork.');

    // contrast of the visible ink against each background
    for (const bgStr of bgs) {
      const bg = parseColor(bgStr);
      if (!bg || !ink.length) continue;
      const good = ink.filter((c) => contrast(c, bg) >= 3).length / ink.length;
      if (good < 0.5) warn(`on ${bgStr} only ${(good * 100).toFixed(0)}% of the logo has ≥3:1 contrast — it will vanish there. Make a variant for this background (e.g. logo-dark.svg) or use a tile.`);
      else ok(`contrast on ${bgStr}: ${(good * 100).toFixed(0)}% of ink ≥3:1`);
    }
  }

  if (role === 'mark') {
    const at16 = renderAt(16);
    let solid = 0;
    for (let i = 3; i < at16.pixels.length; i += 4) if (at16.pixels[i] > 128) solid++;
    const frac = solid / (at16.width * at16.height);
    if (frac < 0.12) warn(`only ${(frac * 100).toFixed(0)}% of pixels are solid at 16px — the favicon will look faint. Thicken strokes (≥2px at 24-unit scale) or simplify.`);
    else ok(`16px density ${(frac * 100).toFixed(0)}%`);
  }
}

for (const [lvl, msg] of results) console.log(`${lvl}  ${msg}`);
const errors = results.filter((x) => x[0] === 'ERROR').length;
const warns = results.filter((x) => x[0] === 'WARN ').length;
console.log(`\n${file}: ${errors} error(s), ${warns} warning(s) [role: ${role}]`);
process.exit(errors ? 1 : 0);
