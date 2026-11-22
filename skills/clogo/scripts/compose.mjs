#!/usr/bin/env node
// Combine a mark (icon/symbol SVG) and a wordmark SVG into a lockup with consistent spacing.
//
//   node compose.mjs --mark mark.svg --wordmark wordmark.svg [--layout horizontal|stacked]
//                    [--mark-ratio 1.25] [--gap 0.35] [--pad 0] [--out logo.svg]
//
// horizontal: mark height = wordmark height × mark-ratio, gap = mark height × gap, centred vertically.
// stacked:    mark width  = wordmark width × mark-ratio (default 0.45), centred above the wordmark.
// The output is a plain SVG you can (and should) hand-tune afterwards — e.g. optical nudges.
import fs from 'node:fs';
import { parseArgs, die, writeFile, parseSvg, nestSvg, r } from './lib.mjs';

const args = parseArgs();
if (!args.mark || !args.wordmark) die('usage: compose.mjs --mark mark.svg --wordmark wordmark.svg [--layout horizontal|stacked] [--out logo.svg]');

try {
  const mark = fs.readFileSync(args.mark, 'utf8');
  const word = fs.readFileSync(args.wordmark, 'utf8');
  const mv = parseSvg(mark).viewBox, wv = parseSvg(word).viewBox;
  if (!mv || !wv) die('both inputs need a viewBox');
  const layout = args.layout || 'horizontal';
  const pad = Number(args.pad) || 0;
  const mAspect = mv.w / mv.h;
  let parts, W, H;

  if (layout === 'stacked') {
    const ratio = Number(args['mark-ratio']) || 0.45;
    const gap = Number(args.gap) || 0.18;
    const mw = wv.w * ratio, mh = mw / mAspect;
    const g = mh * gap;
    W = Math.max(wv.w, mw); H = mh + g + wv.h;
    parts = [nestSvg(mark, (W - mw) / 2, 0, mw, mh), nestSvg(word, (W - wv.w) / 2, mh + g, wv.w, wv.h)];
  } else {
    const ratio = Number(args['mark-ratio']) || 1.25;
    const gap = Number(args.gap) || 0.35;
    const mh = wv.h * ratio, mw = mh * mAspect;
    const g = mh * gap;
    W = mw + g + wv.w; H = Math.max(mh, wv.h);
    parts = [nestSvg(mark, 0, (H - mh) / 2, mw, mh), nestSvg(word, mw + g, (H - wv.h) / 2, wv.w, wv.h)];
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r(-pad)} ${r(-pad)} ${r(W + pad * 2)} ${r(H + pad * 2)}">` +
    parts.join('') + '</svg>\n';
  const out = args.out || 'logo.svg';
  writeFile(out, svg);
  console.log(`saved ${out}  (${layout}, ${r(W, 1)}×${r(H, 1)})`);
} catch (e) {
  if (process.env.DEBUG) console.error(e.stack);
  die(e.message);
}
