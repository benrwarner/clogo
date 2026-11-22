// Shared helpers for the clogo scripts.
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CACHE_DIR = process.env.CLOGO_CACHE || path.join(os.homedir(), '.cache', 'clogo');

/** Minimal argv parser: positional args + --key value + --flag. */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) { args[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true;
      else { args[key] = next; i++; }
    } else args._.push(a);
  }
  return args;
}

export function die(msg, code = 1) {
  console.error(`error: ${msg}`);
  process.exit(code);
}

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function writeFile(p, data) {
  ensureDir(path.dirname(path.resolve(p)));
  fs.writeFileSync(p, data);
  return p;
}

/** Parse the root <svg> element of an SVG string. */
export function parseSvg(svg) {
  const m = svg.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i);
  if (!m) throw new Error('not an SVG document (no root <svg> element)');
  const attrs = {};
  for (const a of m[1].matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    attrs[a[1]] = a[3] ?? a[4];
  }
  let vb = null;
  if (attrs.viewBox) {
    const n = attrs.viewBox.trim().split(/[\s,]+/).map(Number);
    if (n.length === 4 && n.every(Number.isFinite)) vb = { x: n[0], y: n[1], w: n[2], h: n[3] };
  } else if (attrs.width && attrs.height) {
    const w = parseFloat(attrs.width), h = parseFloat(attrs.height);
    if (w && h) vb = { x: 0, y: 0, w, h, implicit: true };
  }
  return { attrs, inner: m[2], viewBox: vb };
}

const NON_INHERITED = new Set(['xmlns', 'width', 'height', 'x', 'y', 'viewBox', 'version', 'id', 'class', 'preserveAspectRatio']);

/**
 * Wrap an SVG document as a nested <svg> placed at (x, y) with size (w, h).
 * Root presentation attributes (fill, stroke, stroke-width…) are preserved.
 */
export function nestSvg(svg, x, y, w, h) {
  const { attrs, inner, viewBox } = parseSvg(svg);
  if (!viewBox) throw new Error('SVG has no viewBox or width/height');
  const keep = Object.entries(attrs)
    .filter(([k]) => !NON_INHERITED.has(k) && !k.startsWith('xmlns'))
    .map(([k, v]) => ` ${k}="${v}"`).join('');
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;
  return `<svg x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" viewBox="${vb}"${keep}>${inner}</svg>`;
}

export const r = (n, d = 3) => Number(n.toFixed(d));

/** Render an SVG string to a PNG buffer. fit: {width} or {height}. */
export function renderPng(svg, fit = { width: 512 }, { background } = {}) {
  const opts = { font: { loadSystemFonts: false }, shapeRendering: 2, textRendering: 2 };
  if (fit.width) opts.fitTo = { mode: 'width', value: Math.round(fit.width) };
  else if (fit.height) opts.fitTo = { mode: 'height', value: Math.round(fit.height) };
  if (background) opts.background = background;
  const resvg = new Resvg(svg, opts);
  const img = resvg.render();
  return { png: img.asPng(), width: img.width, height: img.height, pixels: img.pixels };
}

export const pngDataUri = (buf) => `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;

// ---------- colour utilities ----------
const NAMED = {
  white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff',
  gray: '#808080', grey: '#808080', yellow: '#ffff00', orange: '#ffa500', purple: '#800080',
  navy: '#000080', teal: '#008080', silver: '#c0c0c0', maroon: '#800000', transparent: null,
};

export function parseColor(c) {
  if (!c) return null;
  c = c.trim().toLowerCase();
  if (c in NAMED) c = NAMED[c] ?? '';
  let m;
  if ((m = c.match(/^#([0-9a-f]{3,8})$/))) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  if ((m = c.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/))) {
    return { r: +m[1], g: +m[2], b: +m[3] };
  }
  return null;
}

export function luminance({ r: R, g: G, b: B }) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(R) + 0.7152 * f(G) + 0.0722 * f(B);
}

export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const toHex = ({ r: R, g: G, b: B }) => '#' + [R, G, B].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
