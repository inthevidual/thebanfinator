# Brand assets — v4

Everything here is generated from `banfa-source.svg` by
`node brand/tools/build-banfa.mjs`. Edit the source, re-run the script; don't
hand-edit the outputs.

| File | Size (raw / gzip) | Use |
|---|---|---|
| `banfa-source.svg` | 390 KB / 149 KB | Illustrator export. Master artwork, not for the web. |
| `banfa.svg` | 263 KB / 100 KB | Full portrait. Hero / large display only. |
| `banfa-mark.svg` | 47 KB / 18 KB | Square head crop. Header, small UI. |
| `favicon.svg` | 47 KB / 18 KB | Copy of the mark. |
| `favicon-{16,32,48}.png`, `apple-touch-icon.png` | — | Raster fallbacks. |
| `wordmark.svg` | 9 KB | *Svenska CP-Tjänst* wordmark. Inlined in the markup, never `<img>` — see below. |
| `og.png` | 1200×630 | Share image. Built by `node brand/tools/build-og.mjs`. |

## Cache busting

`index.htm` references local assets as `path?v=<8-char content hash>`. Run

```
node brand/tools/stamp-assets.mjs
```

after touching anything under `styles/`, `script.js` or `brand/`.

The token used to be the marketing version, `?v=4.1`. It stayed put across three
commits that changed the CSS, so browsers kept serving a stale stylesheet and the
layout selector rendered with the old rules — the bug looked like a CSS bug and
was not one. A content hash changes exactly when the file changes.

## What the build does

1. **svgo at 0.1-unit precision.** The Illustrator export carries ~6 decimals
   on a 1057-unit viewBox — roughly a thousand times finer than any screen.
   This is the bulk of the saving. Measured against the source at 1024 px the
   result is 0.87 % RMSE: sub-pixel, invisible.
2. **Collapses two colour pairs.** `#fcb531`→`#fcb633` (ΔE 0.68) and
   `#063e69`→`#063b64` (ΔE 1.74) are below the perceptual threshold, so the
   palette drops 16→14. The wider steps are *not* touched: `#fcb229` (ΔE 2.4
   from the base orange) carries the halftone shading, and the four creams
   `#fceecb → #fce2ac` are a deliberate ramp on the sweater. Flattening those
   would visibly kill the shading.
3. **Hoists fills into one-letter classes** in a `<style>` block. Modest on
   bytes, but it makes the palette a single editable block at the top of the
   file rather than 1000-odd inline attributes — which is what you want when
   the v4 tokens land.
4. **Crops the mark and deletes what falls outside it.** Cropping by viewBox
   alone still ships every path of the body. Dropping the 727 off-canvas
   elements is what takes the mark from 263 KB to 47 KB.

## Why the portrait is not the favicon

At 32 px the full portrait is mush — the head is about eight pixels tall. The
head crop reads: the sunglasses and hair silhouette survive. That is what
`favicon.svg` is.

This departs from brand book §3.4, which assigns the favicon to the square
`cp-mark.svg` ("CP" letterform). Decided the other way here: Banfa is the
product's face and the wordmark carries the sender, so the header shows both —
the Banfa mark, then *Svenska CP-Tjänst* · The Banfinator.

## The wordmark

`wordmark.svg` colours its paths through `var(--logoColor, #000)`. It is pasted
into `index.htm` as inline SVG, not loaded as `<img>`, so `--logoColor`
resolves to `currentColor` and the mark is ink on cream and white on navy from
one file with no filters (§3.4). If you ever re-inline it, copy **all 15
paths** — dropping the last one silently turns "Svenska CP-Tjänst" into
"Svenska CP-Tjäns".

## Why SVG and not webp

The brand book stores portraits as webp. For this one the SVG wins: webp at
800 px is 182 KB against the SVG's 100 KB gzipped, and the SVG is
resolution-independent. The dense halftone and floral pattern are expensive
for a lossy codec. Keep the SVG.


## Fonts

`fonts/` holds the nine SvD woff2 faces, self-hosted. Brand book §3.0 warns
against copying these outside SvD's licence; Jesper confirmed on 2026-08-30
that this use is covered and the faces are already public on SvD's own site.

§3.1 flags two gaps in lrstats. Both are closed here rather than inherited:

- **Inter** is named first in `--font-ui` but not shipped, so the UI renders in
  `system-ui`. That is deliberate and the design tolerates it.
- **Sueca Tx** was declared and never applied. It is now applied, via `.prose`,
  to the instructional copy.
