#!/usr/bin/env node
// Export a finished logo into every file a web app needs, optimised, plus the <head> snippet.
//
//   node export.mjs --mark mark.svg [--logo logo.svg] [--logo-dark logo-dark.svg]
//                   [--tile "#1c1412"] [--theme "#b4572e"] [--name "Brewly"] [--short-name "Brewly"]
//                   [--out public] [--base /]
//
// --tile: background colour for icons that cannot be transparent (apple-touch-icon, maskable PWA icon).
//         Pick the brand's dark or primary colour so the mark has contrast on it.
import fs from 'node:fs';
import path from 'node:path';
import { optimize } from 'svgo';
import { parseArgs, die, writeFile, renderPng, parseSvg, nestSvg } from './lib.mjs';

const args = parseArgs();
if (!args.mark) die('usage: export.mjs --mark mark.svg [--logo logo.svg] [--tile "#hex"] [--theme "#hex"] [--name "App"] [--out public]');
const outDir = args.out || 'public';
const name = args.name || 'App';
const shortName = args['short-name'] || name;
const tile = args.tile || '#ffffff';
const theme = args.theme || tile;
// --base: URL prefix the files are served from (default '/'; use '' or 'assets/' for relative paths).
const base = args.base === undefined ? '/' : String(args.base === true ? '' : args.base);

// SVGO's convertPathData occasionally crashes on font-outline paths; retry without it rather than fail.
const svgo = (s) => {
  const run = (overrides) => optimize(s, {
    multipass: true,
    plugins: [{ name: 'preset-default', params: { overrides: { removeViewBox: false, ...overrides } } }],
  }).data;
  try { return run({}); } catch {
    try { return run({ convertPathData: false }); } catch { return s; }
  }
};

/** Place an SVG centred in a square canvas, scaled to `content` (0..1) of the side, optional background. */
function square(svg, side, content = 1, bg) {
  const vb = parseSvg(svg).viewBox;
  const aspect = vb.w / vb.h;
  const box = side * content;
  const w = aspect >= 1 ? box : box * aspect, h = aspect >= 1 ? box / aspect : box;
  const rect = bg ? `<rect width="${side}" height="${side}" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}">${rect}${nestSvg(svg, (side - w) / 2, (side - h) / 2, w, h)}</svg>`;
}

/** ICO container holding PNG images (supported by all modern browsers). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, png }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o); dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(png.length, o + 8); dir.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.png)]);
}

try {
  const markRaw = fs.readFileSync(args.mark, 'utf8');
  if (/currentColor/.test(markRaw)) console.error('warning: mark uses currentColor — it will render black in favicons. Bake in the brand colour.');
  const mark = svgo(markRaw);
  const written = [];
  const put = (f, data) => { writeFile(path.join(outDir, f), data); written.push(f); };

  put('favicon.svg', svgo(square(mark, 512, 1)));
  const icoPngs = [16, 32, 48].map((s) => ({ size: s, png: renderPng(square(mark, s, 1), { width: s }).png }));
  put('favicon.ico', ico(icoPngs));
  put('apple-touch-icon.png', renderPng(square(mark, 180, 0.7, tile), { width: 180 }).png);
  put('icon-192.png', renderPng(square(mark, 192, 0.9), { width: 192 }).png);
  put('icon-512.png', renderPng(square(mark, 512, 0.9), { width: 512 }).png);
  put('icon-maskable-512.png', renderPng(square(mark, 512, 0.6, tile), { width: 512 }).png);

  if (args.logo) {
    const logo = svgo(fs.readFileSync(args.logo, 'utf8'));
    put('logo.svg', logo);
    const vb = parseSvg(logo).viewBox;
    put('logo.png', renderPng(logo, { width: Math.min(2048, Math.round(1200 * Math.max(1, vb.w / vb.h) / 2)) }).png);
  }
  if (args['logo-dark']) put('logo-dark.svg', svgo(fs.readFileSync(args['logo-dark'], 'utf8')));

  const manifest = {
    name, short_name: shortName,
    icons: [
      { src: base + 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: base + 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: base + 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    theme_color: theme, background_color: tile, display: 'standalone',
  };
  put('site.webmanifest', JSON.stringify(manifest, null, 2) + '\n');

  const head = [
    `<link rel="icon" href="${base}favicon.ico" sizes="32x32">`,
    `<link rel="icon" href="${base}favicon.svg" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="${base}apple-touch-icon.png">`,
    `<link rel="manifest" href="${base}site.webmanifest">`,
    `<meta name="theme-color" content="${theme}">`,
  ].join('\n') + '\n';
  put('head-snippet.html', head);

  console.log(`exported to ${outDir}/:\n  ${written.join('\n  ')}\n\nAdd to <head> (see head-snippet.html):\n${head}`);
} catch (e) {
  if (process.env.DEBUG) console.error(e.stack);
  die(e.message);
}
