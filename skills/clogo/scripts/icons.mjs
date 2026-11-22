#!/usr/bin/env node
// Search and fetch open-source icons from the Iconify API (275k+ icons, no API key).
//
//   node icons.mjs search <query> [--limit 40] [--style stroke|fill|any] [--sets lucide,tabler]
//                                 [--per-set 6] [--allow-attribution] [--sheet sheet.png] [--json]
//   node icons.mjs get <prefix:name> [--color "#hex"] [--stroke-width 1.75] [--out icon.svg]
//
// Licensing: by default only icon sets that need no attribution in the product UI are returned
// (MIT, ISC, Apache-2.0, BSD, CC0, Unlicense, OFL). Brand-logo and emoji sets are always excluded,
// because a logo built on someone else's trademark or an emoji glyph is not a usable brand mark.
import { parseArgs, die, writeFile, renderPng, nestSvg } from './lib.mjs';
import { captionFont, labelPath } from './fonts.mjs';

const API = process.env.ICONIFY_API || 'https://api.iconify.design';

const PERMISSIVE = /^(MIT|ISC|Apache-2\.0|BSD-[23]-Clause|CC0-1\.0|Unlicense|OFL-1\.1|0BSD)$/i;
const ATTRIBUTION = /^CC-BY-(3\.0|4\.0)$/i; // usable only if you credit the author somewhere
const EXCLUDED_CATEGORIES = /logos|brand|emoji|flags|archive|unmaintained/i;
const EXCLUDED_PREFIXES = new Set(['simple-icons', 'logos', 'skill-icons', 'devicon', 'devicon-plain', 'vscode-icons',
  'fa-brands', 'fa6-brands', 'cib', 'bxl', 'mdi-light', 'openmoji', 'twemoji', 'noto', 'noto-v1', 'emojione',
  'emojione-v1', 'emojione-monotone', 'fxemoji', 'streamline-emojis', 'fluent-emoji', 'fluent-emoji-flat',
  'fluent-emoji-high-contrast', 'flag', 'flagpack', 'circle-flags', 'cryptocurrency', 'cryptocurrency-color',
  'token-branded', 'token', 'line-md', 'svg-spinners', 'arcticons', 'file-icons', 'catppuccin', 'material-icon-theme', 'unjs', 'brandico']);

// Hand-picked sets with consistent, high-quality geometry. Earlier = preferred.
const PREFERRED = ['lucide', 'tabler', 'ph', 'iconoir', 'mingcute', 'hugeicons', 'ri', 'material-symbols', 'mdi',
  'carbon', 'fluent', 'heroicons', 'akar-icons', 'radix-icons', 'majesticons', 'basil', 'humbleicons', 'pepicons-pop',
  'game-icons', 'healthicons', 'icon-park-outline', 'icon-park-solid', 'gravity-ui', 'mynaui', 'proicons'];

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function licenseOk(spdx, allowAttribution) {
  if (!spdx) return false;
  return PERMISSIVE.test(spdx) || (allowAttribution && ATTRIBUTION.test(spdx));
}

/** Fetch icon bodies for many icons, grouped per prefix. Returns Map id -> {body,width,height,left,top}. */
async function fetchBodies(ids) {
  const byPrefix = new Map();
  for (const id of ids) {
    const [p, n] = id.split(':');
    if (!byPrefix.has(p)) byPrefix.set(p, []);
    byPrefix.get(p).push(n);
  }
  const out = new Map();
  await Promise.all([...byPrefix].map(async ([prefix, names]) => {
    const data = await getJson(`${API}/${prefix}.json?icons=${names.join(',')}`);
    for (const n of names) {
      let ic = data.icons?.[n];
      let alias = data.aliases?.[n];
      if (!ic && alias) ic = { ...data.icons?.[alias.parent], ...alias };
      if (!ic?.body) continue;
      out.set(`${prefix}:${n}`, {
        body: ic.body,
        width: ic.width ?? data.width ?? 16,
        height: ic.height ?? data.height ?? 16,
        left: ic.left ?? data.left ?? 0,
        top: ic.top ?? data.top ?? 0,
      });
    }
  }));
  return out;
}

function iconSvg(ic, { color, strokeWidth } = {}) {
  let body = ic.body;
  if (color) body = body.replaceAll('currentColor', color);
  if (strokeWidth) body = body.replace(/stroke-width="[\d.]+"/g, `stroke-width="${strokeWidth}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ic.left} ${ic.top} ${ic.width} ${ic.height}">${body}</svg>`;
}

const styleOf = (body) => (/stroke="currentColor"|stroke-width/.test(body) && /fill="none"/.test(body) ? 'stroke' : 'fill');

async function search(args) {
  const query = args._.slice(1).join(' ');
  if (!query) die('usage: icons.mjs search <query>');
  const limit = Number(args.limit) || 40;
  const perSet = Number(args['per-set']) || 4;
  const style = args.style || 'any';
  const sets = args.sets ? new Set(String(args.sets).split(',')) : null;

  const params = new URLSearchParams({ query, limit: '999' });
  if (sets) params.set('prefixes', [...sets].join(','));
  const data = await getJson(`${API}/search?${params}`);
  const cols = data.collections || {};

  let candidates = (data.icons || []).filter((id) => {
    const [prefix] = id.split(':');
    const c = cols[prefix];
    if (!c || EXCLUDED_PREFIXES.has(prefix)) return false;
    if (EXCLUDED_CATEGORIES.test(c.category || '')) return false;
    if (c.palette) return false; // multicolour sets can't be recoloured to the brand palette
    return licenseOk(c.license?.spdx, !!args['allow-attribution']);
  });

  const rank = (id) => { const i = PREFERRED.indexOf(id.split(':')[0]); return i === -1 ? PREFERRED.length : i; };
  candidates = candidates
    .map((id, i) => ({ id, i }))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.i - b.i)
    .map((x) => x.id);

  // Diversity: collapse style variants (coffee-bold, coffee-outline-rounded…) and cap icons per set family,
  // so the list shows many different drawings rather than one drawing in six weights.
  const VARIANT = /(-(bold|fill|filled|duotone|light|thin|outline|outlined|rounded|round|sharp|solid|twotone|line|regular|broken|linear|bulk|baseline|duocolor|duo|alt|two-tone|10|12|16|20|24|28|32|48))+$/;
  const VARIANT_PREFIX = /^((baseline|outline|round|sharp|twotone)-)+/;
  const family = (p) => p.replace(/-(light|outline|outlined|solid|rounded|round|sharp|twotone|baseline|filled|bold)$/, '');
  const perSetCount = {}, seenVariant = {};
  candidates = candidates.filter((id) => {
    const [p, n] = id.split(':');
    const fam = family(p);
    const key = `${fam}:${n.replace(VARIANT_PREFIX, '').replace(VARIANT, '')}`;
    seenVariant[key] = (seenVariant[key] || 0) + 1;
    if (seenVariant[key] > 2) return false; // at most 2 weights of the same drawing
    perSetCount[fam] = (perSetCount[fam] || 0) + 1;
    return perSetCount[fam] <= perSet;
  });

  const bodies = await fetchBodies(candidates.slice(0, limit * (style === 'any' ? 2 : 5)));
  let results = candidates
    .filter((id) => bodies.has(id))
    .map((id) => {
      const [prefix] = id.split(':');
      const c = cols[prefix];
      return { id, set: c.name, license: c.license?.spdx, style: styleOf(bodies.get(id).body), ...bodies.get(id) };
    });
  if (style !== 'any') results = results.filter((x) => x.style === style);
  results = results.slice(0, limit);

  if (!results.length) {
    console.log(`No permissively licensed icons for "${query}". Try a synonym or a more concrete noun ` +
      '(e.g. "leaf" instead of "sustainability"), or --allow-attribution.');
    return;
  }

  if (args.json) {
    console.log(JSON.stringify(results.map(({ body, ...rest }) => rest), null, 2));
  } else {
    console.log(`${results.length} icons for "${query}" (license-filtered, preferred sets first):\n`);
    results.forEach((x, n) => console.log(`${String(n + 1).padStart(3)}  ${x.id.padEnd(42)} ${x.style.padEnd(6)} ${x.license.padEnd(11)} ${x.set}`));
    if (results.some((x) => ATTRIBUTION.test(x.license))) console.log('\nNote: CC-BY icons require crediting the author (e.g. in a footer or credits page).');
  }

  if (args.sheet) {
    await contactSheet(results, args.sheet, query);
    console.log(`\ncontact sheet: ${args.sheet}  (numbers match the list above — view it to choose by eye)`);
  }
}

async function contactSheet(results, out, title) {
  const font = await captionFont();
  const cols = 8, cell = 128, icon = 64, pad = 24, head = 48;
  const rows = Math.ceil(results.length / cols);
  const W = cols * cell + pad * 2, H = rows * cell + pad * 2 + head;
  const parts = [`<rect width="${W}" height="${H}" fill="#fafafa"/>`];
  if (font) parts.push(labelPath(font, `"${title}" — ${results.length} icons`, pad, pad + 20, 20, '#111'));
  results.forEach((x, n) => {
    const cx = pad + (n % cols) * cell, cy = pad + head + Math.floor(n / cols) * cell;
    parts.push(`<rect x="${cx + 4}" y="${cy + 4}" width="${cell - 8}" height="${cell - 8}" rx="12" fill="#fff" stroke="#e5e5e5"/>`);
    parts.push(nestSvg(iconSvg(x, { color: '#111' }), cx + (cell - icon) / 2, cy + 18, icon, icon));
    if (font) {
      parts.push(labelPath(font, String(n + 1), cx + 12, cy + 26, 14, '#999'));
      const short = x.id.length > 20 ? x.id.slice(0, 19) + '…' : x.id;
      parts.push(labelPath(font, short, cx + 10, cy + cell - 16, 11, '#666'));
    }
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
  writeFile(out, renderPng(svg, { width: W }).png);
}

async function get(args) {
  const id = args._[1];
  if (!id || !id.includes(':')) die('usage: icons.mjs get <prefix:name> [--color "#hex"] [--out file.svg]');
  const [prefix] = id.split(':');
  const bodies = await fetchBodies([id]);
  const ic = bodies.get(id);
  if (!ic) die(`icon not found: ${id}`);
  const meta = await getJson(`${API}/collections?prefixes=${prefix}`).catch(() => ({}));
  const c = meta[prefix];
  const svg = iconSvg(ic, { color: args.color, strokeWidth: args['stroke-width'] });
  if (args.out) {
    writeFile(args.out, svg + '\n');
    console.log(`saved ${args.out}`);
  } else console.log(svg);
  if (c) {
    console.error(`source: ${id} — ${c.name} by ${c.author?.name ?? 'unknown'} — license ${c.license?.spdx ?? c.license?.title ?? 'unknown'}`);
    if (!licenseOk(c.license?.spdx, true)) console.error('warning: this license is not permissive; do not use it in a logo.');
    else if (ATTRIBUTION.test(c.license?.spdx)) console.error('note: CC-BY requires crediting the author.');
  }
  console.error(`style: ${styleOf(ic.body)}  viewBox: ${ic.left} ${ic.top} ${ic.width} ${ic.height}`);
}

const args = parseArgs();
const cmd = args._[0];
try {
  if (cmd === 'search') await search(args);
  else if (cmd === 'get') await get(args);
  else die('usage: icons.mjs search <query> [...] | icons.mjs get <prefix:name> [...]');
} catch (e) {
  if (process.env.DEBUG) console.error(e.stack);
  die(e.message);
}
