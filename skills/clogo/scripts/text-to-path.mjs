#!/usr/bin/env node
// Turn text into an outlined SVG wordmark using a real Google Font (or a local font file).
// Outlined paths render identically everywhere — no dependency on installed fonts.
//
//   node text-to-path.mjs --text "Brewly" --font "Fraunces" --weight 700 \
//        [--tracking -0.02] [--case upper|lower|title] [--color "#1c1917"] [--italic]
//        [--font-file ./MyFont.ttf] [--size 100] [--out wordmark.svg]
//
// --tracking is letter spacing in em: -0.03 (tight, modern) … 0 … 0.15 (airy, luxe, all-caps).
import { parseArgs, die, writeFile, r } from './lib.mjs';
import { loadFont, textToPath } from './fonts.mjs';

const args = parseArgs();
let text = args.text ?? args._.join(' ');
if (!text) die('usage: text-to-path.mjs --text "Name" --font "Family" [--weight 700] [--out wordmark.svg]');
if (!String(text).trim()) die('text is empty');
if (args.case === 'upper') text = text.toUpperCase();
else if (args.case === 'lower') text = text.toLowerCase();
else if (args.case === 'title') text = text.replace(/\b\w/g, (c) => c.toUpperCase());

const family = args.font || 'Inter';
const weight = Number(args.weight) || 700;
const size = Number(args.size) || 100;
const tracking = Number(args.tracking) || 0;
const color = args.color || '#111111';

try {
  const font = await loadFont({ family, weight, italic: !!args.italic, file: args['font-file'] });
  const missing = [...text].filter((ch) => ch.trim() && font.charToGlyphIndex(ch) === 0);
  if (missing.length) console.error(`warning: font has no glyphs for: ${[...new Set(missing)].join(' ')}`);

  const { d, bbox } = textToPath(font, text, { size, tracking });
  const w = bbox.x2 - bbox.x1, h = bbox.y2 - bbox.y1;
  // Cap height & baseline help when aligning the wordmark next to a mark.
  const scale = size / font.unitsPerEm;
  const capHeight = (font.tables.os2?.sCapHeight || font.ascender * 0.7) * scale;
  const xHeight = (font.tables.os2?.sxHeight || capHeight * 0.7) * scale;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r(bbox.x1, 2)} ${r(bbox.y1, 2)} ${r(w, 2)} ${r(h, 2)}">` +
    `<path fill="${color}" d="${d}"/></svg>\n`;
  const out = args.out || 'wordmark.svg';
  writeFile(out, svg);
  const name = font.names?.fullName?.en || family;
  console.log(JSON.stringify({
    out, text, font: name, weight, tracking,
    width: r(w, 1), height: r(h, 1),
    baselineFromTop: r(-bbox.y1, 1), capHeight: r(capHeight, 1), xHeight: r(xHeight, 1),
    note: args['font-file'] ? 'local font — check its license allows logo use' : 'Google Fonts are SIL OFL / Apache — fine for logos',
  }, null, 2));
} catch (e) {
  if (process.env.DEBUG) console.error(e.stack);
  die(e.message);
}
