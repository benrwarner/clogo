// Smoke tests for the Clogo scripts. Run: npm test (from skills/clogo/scripts).
// Network-dependent tests (Iconify, Google Fonts) are skipped when CLOGO_OFFLINE=1.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSvg, parseColor, contrast, nestSvg } from '../lib.mjs';

const DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'clogo-test-'));
const offline = process.env.CLOGO_OFFLINE === '1';

const script = (name, args) => spawnSync(process.execPath, [path.join(DIR, name), ...args], { encoding: 'utf8' });
const run = (name, args) => execFileSync(process.execPath, [path.join(DIR, name), ...args], { encoding: 'utf8' });
const fixture = (name, svg) => { const p = path.join(TMP, name); fs.writeFileSync(p, svg); return p; };

const MARK = fixture('mark.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="#b4572e" stroke-width="2.25" stroke-linecap="round" d="M10 2v2m4-2v2m2 4a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1M6 2v2"/></svg>');
const WORD = fixture('word.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -70 300 90"><path fill="#3b2416" d="M0 0h40v-70H0zM60 0h40v-70H60z"/></svg>');
const PLACEHOLDER = fixture('placeholder.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#6366f1"/><text x="32" y="42" fill="#fff">B</text></svg>');

describe('lib', () => {
  test('parseSvg reads viewBox, attributes and survives an XML prolog', () => {
    const { viewBox, attrs } = parseSvg('<?xml version="1.0"?>\n<!-- c --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20" fill="red"><g/></svg>');
    assert.deepEqual(viewBox, { x: 0, y: 0, w: 10, h: 20 });
    assert.equal(attrs.fill, 'red');
  });
  test('colour parsing and WCAG contrast', () => {
    assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255 });
    assert.deepEqual(parseColor('rgb(1, 2, 3)'), { r: 1, g: 2, b: 3 });
    assert.equal(Math.round(contrast(parseColor('#000'), parseColor('#fff'))), 21);
  });
  test('nestSvg keeps inherited presentation attributes including style', () => {
    const out = nestSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="fill:#e11d48" stroke="#000"><path/></svg>', 0, 0, 10, 10);
    assert.match(out, /style="fill:#e11d48"/);
    assert.match(out, /stroke="#000"/);
    assert.doesNotMatch(out, /xmlns/);
  });
});

describe('lint', () => {
  test('flags the coloured-tile-with-initial placeholder and exits 1', () => {
    const r = script('lint.mjs', [PLACEHOLDER]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /generic placeholder/);
    assert.match(r.stdout, /<text> found/);
  });
  test('passes a clean mark', () => {
    const r = script('lint.mjs', [MARK]);
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /0 error\(s\), 0 warning\(s\)/);
  });
  test('a single solid shape is not the placeholder pattern', () => {
    const r = script('lint.mjs', [fixture('dot.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#123"/></svg>')]);
    assert.doesNotMatch(r.stdout, /placeholder/);
  });
  test('shapes inside <mask> do not count as a visible tile', () => {
    const r = script('lint.mjs', [fixture('masked.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><mask id="m"><rect width="64" height="64" fill="#fff"/><circle cx="40" cy="24" r="6"/></mask></defs><path fill="#111" mask="url(#m)" d="M10 54 32 8l22 46z"/></svg>')]);
    assert.doesNotMatch(r.stdout, /placeholder/);
  });
  test('warns when a logo vanishes on a dark background', () => {
    const r = script('lint.mjs', [WORD, '--bg', '#0f0f12']);
    assert.match(r.stdout, /vanish/);
  });
});

describe('compose, render, export', () => {
  test('compose builds a horizontal lockup', () => {
    const out = path.join(TMP, 'logo.svg');
    run('compose.mjs', ['--mark', MARK, '--wordmark', WORD, '--out', out]);
    const { viewBox } = parseSvg(fs.readFileSync(out, 'utf8'));
    assert.ok(viewBox.w > viewBox.h * 2, 'lockup should be wide');
  });
  test('render writes a PNG preview sheet', () => {
    const out = path.join(TMP, 'preview.png');
    run('render.mjs', [MARK, path.join(TMP, 'logo.svg'), '--out', out]);
    const sig = fs.readFileSync(out).subarray(0, 8);
    assert.deepEqual([...sig], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });
  test('export writes the full icon set with valid ICO and manifest', () => {
    const out = path.join(TMP, 'public');
    run('export.mjs', ['--mark', MARK, '--logo', path.join(TMP, 'logo.svg'), '--tile', '#1c1412', '--name', 'Test', '--out', out]);
    for (const f of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png',
      'icon-maskable-512.png', 'logo.svg', 'logo.png', 'site.webmanifest', 'head-snippet.html']) {
      assert.ok(fs.existsSync(path.join(out, f)), `${f} missing`);
    }
    const ico = fs.readFileSync(path.join(out, 'favicon.ico'));
    assert.equal(ico.readUInt16LE(4), 3);
    assert.deepEqual([ico[6], ico[22], ico[38]], [16, 32, 48]);
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'site.webmanifest'), 'utf8'));
    assert.equal(manifest.icons[0].src, '/icon-192.png');
    assert.match(fs.readFileSync(path.join(out, 'favicon.svg'), 'utf8'), /viewBox/);
  });
  test('export --base writes relative paths for subfolder deployments', () => {
    const out = path.join(TMP, 'assets');
    run('export.mjs', ['--mark', MARK, '--out', out, '--base', 'assets/']);
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'site.webmanifest'), 'utf8'));
    assert.equal(manifest.icons[0].src, 'assets/icon-192.png');
    assert.match(fs.readFileSync(path.join(out, 'head-snippet.html'), 'utf8'), /href="assets\/favicon\.svg"/);
  });
});

describe('dark-mode favicon', () => {
  test('export --mark-dark writes a favicon.svg that switches with prefers-color-scheme', () => {
    const masked = (fill) => fixture(`m-${fill.slice(1)}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><mask id="m"><rect width="64" height="64" fill="#fff"/><circle cx="32" cy="32" r="10"/></mask></defs><rect width="64" height="64" rx="16" fill="${fill}" mask="url(#m)"/></svg>`);
    const out = path.join(TMP, 'dark');
    run('export.mjs', ['--mark', masked('#0c1a26'), '--mark-dark', masked('#e8f1f2'), '--out', out]);
    const svg = fs.readFileSync(path.join(out, 'favicon.svg'), 'utf8');
    assert.match(svg, /@media \(prefers-color-scheme:dark\)/);
    assert.match(svg, /class="l"/);
    assert.match(svg, /class="d"/);
    assert.match(svg, /#0c1a26/);
    assert.match(svg, /#e8f1f2/);
    const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids}`);
  });
});

describe('network: fonts and icons', { skip: offline && 'CLOGO_OFFLINE=1' }, () => {
  test('text-to-path outlines a Google Font into a path with no <text>', () => {
    const out = path.join(TMP, 'wordmark.svg');
    const info = JSON.parse(run('text-to-path.mjs', ['--text', 'Clogo', '--font', 'Inter', '--weight', '700', '--out', out]));
    const svg = fs.readFileSync(out, 'utf8');
    assert.ok(info.width > 0 && info.height > 0);
    assert.match(svg, /<path [^>]*d="M/);
    assert.doesNotMatch(svg, /<text/);
  });
  test('text-to-path rejects empty text', () => {
    const r = script('text-to-path.mjs', ['--text', '   ', '--out', path.join(TMP, 'blank.svg')]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /empty/);
  });
  test('icon search returns only permissively licensed, non-brand icons', () => {
    const results = JSON.parse(run('icons.mjs', ['search', 'coffee', '--limit', '20', '--json']));
    assert.ok(results.length >= 10);
    for (const r of results) {
      assert.match(r.license, /^(MIT|ISC|Apache-2\.0|BSD-[23]-Clause|CC0-1\.0|Unlicense|OFL-1\.1|0BSD)$/);
      assert.ok(!r.id.startsWith('simple-icons:') && !r.id.startsWith('logos:'));
    }
  });
  test('icon get recolours currentColor', () => {
    const out = path.join(TMP, 'icon.svg');
    run('icons.mjs', ['get', 'lucide:coffee', '--color', '#123456', '--out', out]);
    const svg = fs.readFileSync(out, 'utf8');
    assert.match(svg, /#123456/);
    assert.doesNotMatch(svg, /currentColor/);
  });
});
