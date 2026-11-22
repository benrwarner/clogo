---
name: clogo
description: Designs a real, relevant logo (SVG mark + wordmark + favicons + app icons) for a website or app instead of a placeholder. Use whenever you create or scaffold a website, web app, landing page, SaaS, PWA, mobile app, browser extension or any project that needs a logo, favicon, app icon, brand mark, navbar/header logo or site icon — and ALWAYS before writing a placeholder logo such as a coloured square/circle with the product's initial, a generic emoji, or a default framework icon. Also use when the user asks to make, improve, redesign or replace a logo or favicon.
---

# Clogo

Produce a logo that is **relevant, distinctive, simple and well-crafted** — never the
"coloured rounded square with the first initial" placeholder. You work in SVG, build from
professionally drawn open-source icons (Iconify, 275k+ icons) and real Google Fonts outlined
to paths, then **render your work to PNG and look at it** before shipping, revising until it
passes the checklist.

All paths below are relative to this skill's directory (the folder containing this SKILL.md).
Run scripts with `node <skill-dir>/scripts/<script>.mjs`. Work files go in the user project's
`.logo/` folder (keep it — it is the editable source of the logo).

## 0. Setup (first use only)
```bash
[ -d "<skill-dir>/scripts/node_modules" ] || npm install --prefix "<skill-dir>/scripts" --silent --no-audit --no-fund
```
Requires Node 18+ and network access (Iconify API + Google Fonts; fonts are cached in
`~/.cache/clogo`). If offline, you can still hand-write SVG, but use `--font-file`
with a local font and say icon search was unavailable.

## 1. Understand the product (≈1 minute, no questions by default)
Read what exists: README, package.json `name`/`description`, landing-page copy, existing
`tailwind.config.*` / CSS variables / theme files (**reuse existing brand colours and fonts**),
and any old logo. Decide:
- **Name** as it should appear (casing matters: "brewly" vs "Brewly" vs "BREWLY").
- **What it does** in one line, **audience**, and **3 personality adjectives**.

Interaction: if you are scaffolding a project, proceed autonomously — don't stop to ask. If the
user explicitly asked for a logo, you may ask at most 1–2 quick questions (e.g. "any colours or
vibe in mind?") only when the project gives you nothing to go on.

## 2. Write the brief → `.logo/brief.md`
Keep it short:
```markdown
Name: Brewly — coffee-bean subscription for home brewers
Personality: warm, crafted, unpretentious
Metaphors: cup, bean, steam, loop/repeat (subscription), sunrise, kettle
Avoid: generic coffee-cup clichés alone; brown-on-brown low contrast
Palette: primary #b4572e · ink #3b2416 · accent #f2c14e · dark-bg ink #f5efe6
Type: Fraunces 700, tracking -0.015, Title case
Concepts: A) cup whose steam is a loop arrow (icon+wordmark)  B) bean knocked out of a squircle (container)  C) "B" whose counter is a bean (lettermark)
```
Use `references/industry-palettes.md` for category starting points (only when the project has no
brand yet) and `references/logo-archetypes.md` to pick **2–3 different archetypes**.

## 3. Find icon material
```bash
node scripts/icons.mjs search "coffee" --limit 32 --sheet .logo/icons-coffee.png
node scripts/icons.mjs search "repeat" --style stroke --limit 24 --sheet .logo/icons-repeat.png
```
**Read the contact-sheet PNGs** and choose by eye (the numbers match the printed list). Search
2–4 metaphors, using concrete nouns ("leaf", "mountain", "shield", "spark", "wave"). Results are
already filtered to permissive licences (MIT/ISC/Apache/CC0…) and exclude brand-logo and emoji
sets. Fetch what you need:
```bash
node scripts/icons.mjs get ph:coffee-bean-fill --color "#b4572e" --out .logo/bean.svg
```
Prefer sets that match the personality: stroke (lucide, tabler, iconoir) = light/modern;
fill (ph *-fill, mingcute, material-symbols) = bold/small-size friendly. Don't mix styles in one mark.
An icon used as-is is a starting point; the best results add one deliberate twist (combine two
icons, knock out a detail, put it in a meaningful container, swap a part).

## 4. Build 2–3 concepts
For each concept make a square **mark** and a **lockup**:
```bash
node scripts/text-to-path.mjs --text "Brewly" --font "Fraunces" --weight 700 --tracking -0.015 --color "#3b2416" --out .logo/word.svg
node scripts/compose.mjs --mark .logo/a-mark.svg --wordmark .logo/word.svg --layout horizontal --out .logo/a-logo.svg
```
Hand-write/edit SVG freely for combinations, masks and containers (recipes in
`references/logo-archetypes.md`). Rules: square `viewBox` for marks, no `<text>` (outline it),
no rasters, no external refs, ≤3 colours, transparent background, mark fills ~85–100% of its box.

## 5. Render → look → critique → revise (the important part)
```bash
node scripts/render.mjs .logo/a-mark.svg .logo/a-logo.svg .logo/b-mark.svg .logo/b-logo.svg --bg "#ffffff,#0f0f12" --out .logo/preview.png
node scripts/lint.mjs .logo/a-mark.svg      # repeat per file; fix every ERROR
```
**Read `.logo/preview.png`.** Critique each concept honestly against the checklist in
`references/design-principles.md` (relevance, distinctiveness, 16px legibility in the "16px ×4"
cell, balance, weight harmony, contrast on both backgrounds, craft, restraint). Write down the
2–3 concrete problems you see, fix them, re-render. Do **up to 3 rounds**; stop when nothing on
the checklist fails. Common fixes: thicken strokes for 16px, crop the viewBox, nudge the wordmark
to align with the mark's optical centre, drop a colour, simplify a detail, make `logo-dark.svg`.

Then pick the strongest concept (state why in one line). If the user explicitly asked for a logo,
show them the preview sheet path and your pick, and offer the alternatives.

## 6. Variants
- `.logo/logo-dark.svg` if the lockup fails contrast on dark backgrounds (lint tells you).
- `.logo/mark-dark.svg` if the **mark** fails on dark (e.g. a navy hull vanishes in a dark browser
  tab). Pass it to export with `--mark-dark` and `favicon.svg` will switch automatically with the
  user's light/dark theme.
- Bake real colours in — no `currentColor` in exported files.

## 7. Export and wire it in
```bash
node scripts/export.mjs --mark .logo/a-mark.svg --logo .logo/a-logo.svg [--logo-dark .logo/logo-dark.svg] [--mark-dark .logo/mark-dark.svg] \
  --tile "#3b2416" --theme "#b4572e" --name "Brewly" --out public
```
Produces `favicon.svg`, `favicon.ico` (16/32/48), `apple-touch-icon.png` (180, on `--tile`),
`icon-192/512.png`, `icon-maskable-512.png`, `logo.svg`, `logo.png`, `site.webmanifest`,
`head-snippet.html`. Paths default to the site root (`/favicon.svg`); if the files live in a
subfolder or the page is opened from disk, pass `--base assets/` (or `--base ''`) so the manifest and
`<head>` tags use matching relative paths. Choose `--out` and wiring by framework:
- **Next.js (app router)**: export to `public/`, then also copy `favicon.ico` → `app/favicon.ico`,
  `favicon.svg` → `app/icon.svg`, `apple-touch-icon.png` → `app/apple-icon.png` (Next generates the
  tags; delete the default `app/favicon.ico` first). Add `manifest` in `metadata` if it's a PWA.
- **Vite / CRA / plain HTML / Astro / Nuxt / Remix**: `public/` + paste `head-snippet.html` into
  `index.html` / root layout `<head>`, replacing old favicon tags (e.g. Vite's `/vite.svg`).
- **SvelteKit**: `static/` + `src/app.html`. **Django/Rails/etc.**: their static dir + base template.
Then replace any placeholder logo in the header/navbar/footer with the real one — `<img
src="/logo.svg" alt="Brewly" height="32">`, or an inline SVG component. Use `logo-dark.svg` with
`<picture>`/`prefers-color-scheme` or the app's dark-mode class when it exists. Remove default
framework icons that are no longer used.

## 8. Report (brief)
Tell the user: the concept chosen and the idea behind it (one sentence), files created, where
the source lives (`.logo/`), the preview image path, and icon credits (set name + licence; CC-BY
requires visible attribution). Mention that they can ask for another direction.

## Never
- Ship a coloured tile + bare initial, an emoji, or a default framework logo as "the logo".
- Use brand/trademark icons (Simple Icons etc.) as part of a new brand's mark.
- Ship `<text>` elements, embedded raster images, or `currentColor` in exported files.
- Skip the render-and-look step — unseen SVG is usually wrong somewhere.
