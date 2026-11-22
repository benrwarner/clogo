# Logo archetypes + SVG construction recipes

Build 2–3 concepts from **different** archetypes so the comparison is meaningful.
Every concept = a square **mark** (favicon/app icon) + a **lockup** (mark + wordmark).

## 1. Icon + wordmark (most common, safest)
Take a fetched icon, recolour, normalise stroke, optionally add one twist, compose with a wordmark.
```bash
node scripts/icons.mjs get lucide:coffee --color "#b4572e" --stroke-width 2.25 --out .logo/a-mark.svg
node scripts/text-to-path.mjs --text "Brewly" --font "Fraunces" --weight 700 --tracking -0.015 --color "#3b2416" --out .logo/a-word.svg
node scripts/compose.mjs --mark .logo/a-mark.svg --wordmark .logo/a-word.svg --out .logo/a-logo.svg
```
Twist ideas: replace a detail (steam → a loop arrow for "subscription"), fill one region with
the accent colour, cut a shape out with a mask.

## 2. Icon inside a container (app-icon friendly)
A shape (squircle, circle, shield, hexagon, speech bubble) filled with the primary colour, with
the icon knocked out in white or ink. Distinct from the placeholder because the inner glyph is a
meaningful symbol, and the container shape itself can carry meaning (bubble = chat, shield = security).
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <!-- squircle-ish container -->
  <path fill="#0f766e" d="M32 2c19 0 30 11 30 30S51 62 32 62 2 51 2 32 13 2 32 2z"/>
  <!-- icon (24-unit) scaled into the middle 60% -->
  <svg x="13" y="13" width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#ecfdf5"
       stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">…icon body…</svg>
</svg>
```
For a true **knockout** (icon becomes transparent so the page shows through) use a mask:
```svg
<defs><mask id="k"><rect width="64" height="64" fill="#fff"/>
  <svg x="13" y="13" width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.25">…</svg>
</mask></defs>
<path fill="#0f766e" mask="url(#k)" d="…container…"/>
```

## 3. Modified lettermark / monogram
Outline the initial(s) with `text-to-path.mjs` (pick a font with character — heavy geometric or
a high-contrast serif), then **alter it so it carries meaning**: replace the counter with a shape,
extend a stroke into an arrow, slice it diagonally, merge two letters sharing a stem.
```bash
node scripts/text-to-path.mjs --text "B" --font "Unbounded" --weight 800 --color "#111" --out .logo/b-letter.svg
```
Then edit the SVG: put the letter path in a `<mask>` and subtract a circle/bean/leaf from it, or add
a geometric element that interlocks. A bare letter (even in a nice font) on a tile fails lint.

## 4. Abstract geometric
Construct from primitives on a grid (e.g. 24 or 48 units): circles, quarter-circles, rounded bars,
triangles. Derive it from the concept: stacked bars → layers/data; two overlapping circles →
connection; a broken ring → loop/sync; a node graph → network/AI. Keep to 2–4 primitives.
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <circle cx="18" cy="24" r="14" fill="#2563eb"/>
  <circle cx="30" cy="24" r="14" fill="#22d3ee" fill-opacity=".85"/>
</svg>
```
Note: overlap transparency is a legitimate use of opacity — make sure it still reads in one flat colour.

## 5. Emblem / badge
Circle or shield border + icon + optionally a short word on the ring. Good for food, outdoors,
gaming, craft. The full badge is the "large" logo; extract the inner icon (or the badge without
text) as the favicon mark, because text on the ring is illegible at small sizes.

## 6. Wordmark with a detail (no separate symbol)
Outlined wordmark where one glyph carries the idea: the dot of an i becomes a leaf, an o becomes
a target, a ligature connects two letters, a letter is cut by a slash. The favicon mark is then
that single modified glyph. Best for luxury, media and personal brands with distinctive names.

## Combining two icons
Fetch both, place them in one viewBox with nested `<svg>` elements, and normalise: same
stroke-width, same caps/joins, same colour. Overlap them deliberately (one partially in front of
the other with a background-coloured **mask gap**, not a painted outline) or use one as a container.

## Making variants
- `logo-dark.svg`: swap ink to off-white; lighten the primary if it falls below 3:1 on dark.
- `mark-mono.svg`: one colour (ink or white) — check it still reads.
- Never rely on `currentColor` in exported files (it renders black as a favicon/`<img>`); it is
  fine only for an inline React/Vue logo component where you intend it to inherit text colour.
