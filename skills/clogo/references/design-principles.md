# Logo design principles (what to check every round)

## The bar
A logo is good when it is **relevant** (says something true about the product), **distinctive**
(wouldn't be mistaken for a default/template), **simple** (survives 16px and one colour), and
**well-crafted** (consistent weights, deliberate spacing, optical balance).

The failure mode this skill exists to prevent: a rounded square in a default accent colour
(indigo/violet/blue gradients especially) with the product's first initial in a system font.
It is relevant to nothing, identical to thousands of others, and reads as "unfinished".

## Concept
- Start from **meaning**, not shape. List 5–8 metaphors: literal (coffee → cup, bean),
  adjacent (coffee → steam, morning sun, ritual), and lateral (subscription → loop/arrow, calendar).
  The best marks often combine two: cup + loop arrow = "coffee subscription".
- Prefer **one idea per mark**. Two elements max; if it needs explaining, simplify.
- A **lettermark is fine** only if the letter is *modified* to carry meaning (counter becomes a bean,
  terminal becomes a leaf, stroke becomes a road) — never a bare initial.

## Form
- **Weight consistency**: strokes in the mark should match each other and visually match the
  wordmark's stem weight. When combining icons from different sets, normalise stroke-width.
- **Stroke icons → logo**: at 24-unit icon scale use stroke-width 2–2.5 for favicons; 1.5 looks
  elegant large but disappears at 16px. Round caps/joins feel friendly; square/miter feel technical.
- **Fill vs stroke**: filled marks are bolder and survive small sizes better. Consider filling the
  primary shape and using negative space (mask cutouts) for detail.
- **Negative space**: cut shapes out with `<mask>` rather than painting background-coloured shapes
  on top — painted "holes" break on any other background.
- **Optical balance**: circles and triangles must overshoot squares slightly (~2–4%) to look the
  same size. Visually centre, don't mathematically centre (e.g. a play triangle sits right of centre).
- **Fill the canvas**: a favicon mark should occupy ~85–100% of its square viewBox.
- **Corner radius** sets personality: 0 = precise/serious, small = modern/neutral, large = friendly.
  Keep radii consistent between mark, container and the UI's buttons if known.

## Colour
- 1 primary + 1 ink (near-black, often tinted toward the primary) + optional accent. Max 3.
- Avoid the generic default palette (Tailwind indigo-500 `#6366f1`, violet-to-blue gradients)
  unless the project's own brand uses it.
- **Use the project's colours if they exist** (CSS variables, tailwind config, theme files).
- Gradients: subtle, 2 stops, analogous hues, and only on the mark — never on the wordmark.
  The mark must still work flat in one colour.
- Check both light and dark backgrounds. Produce `logo-dark.svg` when the ink colour fails on dark.
- **Transparency**: logos ship with transparent backgrounds. Only apple-touch-icon and maskable
  PWA icons get a solid tile (export.mjs handles this).

## Type (wordmark)
- Outline it with `text-to-path.mjs` — never ship `<text>`.
- Pairing: the wordmark's personality must match the mark's. Geometric mark ↔ geometric sans;
  organic/hand mark ↔ humanist sans or soft serif.
- Tracking: lowercase/mixed-case at display size usually wants slightly **negative** tracking
  (-0.01 to -0.03 em). ALL CAPS wants **positive** tracking (0.05–0.15 em).
- Weight: 600–800 for most product wordmarks; 400–500 only for luxury/editorial serif looks.
- Lockup: mark height ≈ 1.1–1.5× the wordmark's cap height for horizontal layouts;
  gap ≈ 0.25–0.5× mark height. Align the mark to the cap-height/baseline band, not the bbox
  (descenders like y/g/p make bbox-centring look low — nudge the wordmark up if needed).

## Critique checklist (use on every preview sheet)
1. Relevance — could a stranger guess the product category from the mark? Does it avoid clichés
   the brief said to avoid?
2. Distinctiveness — would it be confused with a generic template or a famous brand?
3. 16px test — in the "16px ×4" cell, is the silhouette still recognisable? Any detail smearing?
4. Balance — is the mark optically centred, the lockup evenly spaced, nothing touching edges?
5. Weight harmony — strokes consistent; mark and wordmark feel the same "volume".
6. Contrast — readable on both backgrounds (lint confirms numerically).
7. Craft — no stray points, accidental overlaps, misaligned joins, wobbly curves.
8. Restraint — could anything be removed without loss? Remove it.
