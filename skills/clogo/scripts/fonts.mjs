// Google Fonts loader + text-to-outline conversion (opentype.js).
import opentype from 'opentype.js';
import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, ensureDir } from './lib.mjs';

const FONT_CACHE = path.join(CACHE_DIR, 'fonts');

/**
 * Load a font. `family` is a Google Fonts family name (e.g. "Space Grotesk"),
 * or pass `file` for a local .ttf/.otf.
 */
export async function loadFont({ family = 'Inter', weight = 400, italic = false, file } = {}) {
  if (file) return opentype.parse(toArrayBuffer(fs.readFileSync(file)));
  weight = Number(weight) || 400;
  const slug = `${family.replace(/\s+/g, '_')}-${weight}${italic ? 'i' : ''}.ttf`;
  const cached = path.join(FONT_CACHE, slug);
  if (fs.existsSync(cached)) return opentype.parse(toArrayBuffer(fs.readFileSync(cached)));

  const fam = encodeURIComponent(family).replace(/%20/g, '+');
  const url = `https://fonts.googleapis.com/css2?family=${fam}:ital,wght@${italic ? 1 : 0},${weight}`;
  // A non-browser user agent makes Google Fonts serve TrueType, which opentype.js parses directly.
  const res = await fetch(url, { headers: { 'User-Agent': 'clogo' } });
  if (!res.ok) {
    throw new Error(`Google Fonts has no "${family}" at weight ${weight}${italic ? ' italic' : ''} (HTTP ${res.status}). ` +
      'Check the family name at fonts.google.com and pick a weight it ships.');
  }
  const css = await res.text();
  const src = css.match(/src:\s*url\(([^)]+)\)/);
  if (!src) throw new Error(`could not find a font URL in Google Fonts CSS for "${family}"`);
  const fontRes = await fetch(src[1]);
  if (!fontRes.ok) throw new Error(`font download failed: HTTP ${fontRes.status}`);
  const buf = Buffer.from(await fontRes.arrayBuffer());
  ensureDir(FONT_CACHE);
  fs.writeFileSync(cached, buf);
  return opentype.parse(toArrayBuffer(buf));
}

function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/**
 * Lay out `text` as a single outlined path.
 * tracking: extra letter spacing in em (e.g. -0.02 tight, 0.1 wide).
 * Returns { d, bbox:{x1,y1,x2,y2}, advance }.
 */
export function textToPath(font, text, { size = 100, tracking = 0, kerning = true } = {}) {
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(text);
  const out = new opentype.Path();
  let x = 0;
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    out.extend(g.getPath(x, 0, size));
    x += (g.advanceWidth || 0) * scale;
    if (kerning && i < glyphs.length - 1) x += font.getKerningValue(g, glyphs[i + 1]) * scale;
    if (i < glyphs.length - 1) x += tracking * size;
  }
  const bb = out.getBoundingBox();
  return { d: out.toPathData(2), bbox: { x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2 }, advance: x };
}

/** Convenience: label text as an SVG <path> (used for preview-sheet captions). */
export function labelPath(font, text, x, y, size, fill = '#555') {
  const { d } = textToPath(font, text, { size });
  return `<path transform="translate(${x} ${y})" fill="${fill}" d="${d}"/>`;
}

let _labelFont;
/** Font for captions on contact/preview sheets. Falls back gracefully offline. */
export async function captionFont() {
  if (_labelFont !== undefined) return _labelFont;
  try { _labelFont = await loadFont({ family: 'Inter', weight: 500 }); }
  catch { _labelFont = null; }
  return _labelFont;
}
