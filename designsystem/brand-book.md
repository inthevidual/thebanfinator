# Svenska CP-Tjänst — Brand & Design System

The complete design system behind **lrstats.cptjanst.se** (Poddstatistik ·
Ledarredaktionen), written so that Claude can reimplement it faithfully in
another web app.

Every value here was read out of the running source, not remembered. Where a
rule has a reason, the reason is given — a rule you can't justify is a rule
someone will "improve" away. Where something **fails** a check, it says so.

**Written in English; every literal string, token name and copy example stays
verbatim in Swedish**, because those are the actual artefacts.

---

## 0. How to use this file

| You are… | Read |
|---|---|
| Porting the whole look | §1 → §8, then §11 checklist |
| Just need colors | §2 (and §7 if there are charts) |
| Just need charts | §7, plus §2.4 for the tokens |
| Deciding what you're allowed to copy | **§3.0 — licensing. Read this first.** |
| Wondering why something is the way it is | §9 (honesty rules) and §10 (anti-patterns) |

Three things are load-bearing. If you keep only three, keep these:

1. **§2.2 — the three-scope theme rule.** Get it wrong and dark mode breaks in a
   way that is invisible until a user reports it.
2. **§7.2 — categorical color is assigned by entity identity, never by rank**,
   and the scale is validated, not chosen by eye.
3. **§9 — a missing answer must never render as a zero answer.** This is the
   spine of the whole product.

---

## 1. Voice

The product is an internal statistics tool for a newspaper's editorial page
podcast. It is used by the people whose work it measures. That fact sets the
tone: **precise, plain, and never congratulatory.**

### 1.1 Language rules

- **Swedish throughout** — UI strings, code comments, commit messages.
- **Sentence case everywhere.** Never Title Case. `Räckvidd per vecka`, not
  `Räckvidd Per Vecka`.
- **Small caps via CSS, not typing.** Label caps come from
  `uppercase tracking-wide`, never from writing `ARBETSTID`.
- **No exclamation marks. No emoji in the UI.** (The Slack bot is the one
  deliberate exception — it has a persona; the dashboard does not.)
- **Say the number, then what it means.** `1 338 poster · 13 programledare`.
- **Explain a measure where it is shown**, not in a help page. Reach can't be
  summed, so the Lyssnare page says so in prose, once, under the figures.
- **Name the limitation in the same breath as the number.** "Uppmätt ~~251 290~~
  · används **82 501**" beats a silent correction.

### 1.2 Words this product uses

| Term | Means | Never call it |
|---|---|---|
| **avsnitt** | a published episode | "podcast", "show" |
| **inläsning** | a read-aloud piece (< 10 min) | "clip" |
| **kringarbete** | production work attributed to no host | "overhead" |
| **räckvidd** | unique devices reached in a week | "listeners" (it isn't people) |
| **starter** | individual play events | "plays" |
| **arbetskvot** | work time per broadcast hour | "efficiency" |
| **avvikelse** | a noted problem on a record | "error" |

### 1.3 Empty, failed, and absent

Three different states, three different sentences. Never reuse one for another.

| State | Copy pattern | Example |
|---|---|---|
| Genuinely empty | what's missing + how to change it | `Inga poster i urvalet` / `Prova att vidga perioden eller rensa filtren.` |
| Fetch failed | what failed + the reason + a way back | `Siffrorna kunde inte hämtas` / *server message* / `Försök igen` |
| Not measured yet | why it's absent + when it arrives | `Inga lyssnarsiffror ännu` / `Siffrorna hämtas från Poddindex och fylls på vid nästa körning.` |

---

## 2. Color

### 2.1 Architecture

Two layers, and **components may only touch the second one**:

1. **Raw ramps** — the brand's scales, named `--blue-400`, `--brown-200`, …
   These are constants. They are declared once, in `:root`, and are the *same
   in both themes*.
2. **Semantic roles** — `--color-text-primary`, `--color-action`, … These are
   what components reference. They are redefined per theme.

> A component that writes `var(--gray-600)` has hard-coded a light-mode
> assumption. It must write `var(--color-text-secondary)`.

### 2.2 The three theme scopes — get this exactly right

The theme has **three states**, not two: explicit light, explicit dark, and
"follow the OS" (the default, which stamps no attribute). That requires three
CSS blocks in this order:

```css
:root { /* complete LIGHT palette — every token defined here */ }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { /* only the tokens that CHANGE */ }
}

:root[data-theme='dark'] { /* the same overrides again */ }
```

Rules that fall out of this, all of them non-negotiable:

- **Every token gets its only unconditional definition in bare `:root`.** A
  color first defined inside a media query is undefined for half your users.
- **The `:not([data-theme='light'])` guard is what makes the toggle win** in
  the light direction. Without it, a user on a dark OS who picks light gets a
  broken half-dark page.
- **The `[data-theme='dark']` block duplicates the media block.** Yes, it is
  duplication. It is the only way an explicit choice beats the OS in *both*
  directions with plain CSS. Keep them in sync or dark mode silently rots.
- `color-scheme: light` / `dark` is set in each block so form controls and
  scrollbars follow.
- **`body` gets an explicit token background.** A transparent body borrows the
  host's color and looks wrong the moment it's embedded anywhere.

Toggle order is `light → dark → system`, persisted to `localStorage` under
`lr.theme`, applied by setting/removing `data-theme` on `document.documentElement`.

### 2.3 Raw ramps

```css
--blue-100:#ECF3FA;  --blue-200:#42C0F0;  --blue-300:#0098DA;  --blue-400:#0D4C80;
--blue-500:#144166;  --blue-600:#00355F;  --blue-700:#0B2337;  --blue-800:#031420;
--gray-100:#F7F6F5;  --gray-200:#EBEBEB;  --gray-300:#D9D9D9;  --gray-400:#C3C2C1;
--gray-500:#918F8D;  --gray-600:#605E5D;  --gray-700:#2E2E2E;  --gray-800:#1D1D1B;
--brown-100:#FCF4EC; --brown-200:#F4EBE2; --brown-300:#EEDECE; --brown-400:#E4CCB3;
--brown-500:#8F6D62; --brown-600:#5C403C; --brown-700:#2A1E22; --brown-800:#0C090A;
--green-300:#52C18C; --green-400:#27B16F; --green-500:#1F8E59; --green-600:#176A43;
--orange-300:#F57238; --orange-500:#F25538; --orange-600:#923C0D;
--red-400:#EE747B;   --red-500:#EA515A;   --red-600:#BB4148;   --red-700:#8C3136;
--yellow-400:#FFE400; --yellow-500:#CCB600; --yellow-600:#998900;
--purple-300:#AE98E8; --purple-400:#7557D8; --purple-500:#6148B5;
--indigo-300:#97A2E8; --indigo-400:#556CD8; --indigo-500:#465AB6;
--pink-400:#E83183;  --pink-500:#B7236D;
--cyan-400:#4B9ACC;
```

The palette's character comes from **a warm cream ground against cold navy
ink** — brown/cream backgrounds, blue text and actions. Not a neutral gray
dashboard. If you port this, keep the warm ground; it is the single most
recognisable thing about the surface.

### 2.4 Semantic roles

| Token | Light | Dark |
|---|---|---|
| `--color-background-primary` | `#FFFFFF` | `--blue-800` `#031420` |
| `--color-background-secondary` | `--brown-100` `#FCF4EC` | `--blue-700` `#0B2337` |
| `--color-background-tertiary` | `--brown-200` `#F4EBE2` | `#12314B` |
| `--color-surface-raised` | `#FFFFFF` | `--blue-700` `#0B2337` |
| `--color-text-primary` | `--gray-800` `#1D1D1B` | `#FFFFFF` |
| `--color-text-secondary` | `--gray-600` `#605E5D` | `#B9C7D4` |
| `--color-text-muted` | `--gray-500` `#918F8D` | `#8A9BAB` |
| `--color-border-primary` | `#E5E2E1` | `rgba(255,255,255,0.16)` |
| `--color-border-secondary` | `#F2EFEE` | `rgba(255,255,255,0.09)` |
| `--color-action` | `--blue-400` `#0D4C80` | `--blue-300` `#0098DA` |
| `--color-action-hover` | `--blue-500` `#144166` | `--blue-200` `#42C0F0` |
| `--color-action-text` | `#FFFFFF` | `#031420` |
| `--color-focus` | `--blue-300` `#0098DA` | `--blue-200` `#42C0F0` |
| `--color-good` | `--green-500` `#1F8E59` | `--green-400` `#27B16F` |
| `--color-warning` | `--yellow-600` `#998900` | `--yellow-500` `#CCB600` |
| `--color-critical` | `--red-600` `#BB4148` | `--red-500` `#EA515A` |

Note the inversion: **`background-secondary` is the page ground and
`surface-raised` is the card** — in light mode cards are *lighter* than the
page (white on cream); in dark mode they are *lighter* too (`#0B2337` on
`#031420`). The relationship, not the absolute value, is what carries.

**Status colors are reserved.** `good` / `warning` / `critical` never get
reused as a chart series, and never appear without an icon or a word beside
them. Color alone is not a state.

### 2.5 Global base rules

```css
* { border-color: var(--color-border-primary); }   /* so bare `border` works */

body {
  background: var(--color-background-secondary);
  color: var(--color-text-primary);
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
  font-feature-settings: 'tnum' 0;   /* proportional by default */
  -webkit-font-smoothing: antialiased;
}

.tabular { font-variant-numeric: tabular-nums; }   /* opt in, see §6.1 */

:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
::selection { background: var(--blue-200); color: var(--blue-800); }
```

---

## 3. Typography & assets

### 3.0 Licensing — read before copying anything

> **The typefaces and the wordmark are Svenska Dagbladet's property.** They are
> self-hosted here because this is an internal SvD tool.
>
> **Do not copy `public/fonts/*.woff2` or the wordmark into a project outside
> that license.** For an unrelated app, keep every rule in this document and
> substitute the families — the type *system* (a serif display, a serif UI
> heading, a serif body, a sans for chrome) is what carries the look, and it
> survives a substitution. Suggested free stand-ins that preserve the
> structure: **Playfair Display** (display), **Source Serif 4** (head/body),
> **Inter** (UI).
>
> The color system, spacing, components, chart rules and honesty rules in this
> document carry no such restriction.

### 3.1 Families

| Tailwind | Family | Weights shipped | Job |
|---|---|---|---|
| `font-display` | **SvD Ester Blenda**, Georgia, serif | 400, 500, 700 | The login lockup. Nothing else. |
| `font-head` | **Sueca Hd**, Georgia, serif | 300, 600, 700 | Every heading, and every large number |
| `font-body` | **Sueca Tx**, Georgia, serif | 400, 400 italic, 800 | Long-form prose — **declared but currently unused**, see below |
| `font-ui` | Inter, system-ui, -apple-system, Segoe UI, Helvetica Neue, Arial | — | Labels, buttons, tables, chrome |
| `font-mono` | ui-monospace, SFMono-Regular, Menlo | — | Rare; keyboard hints |

**Two known gaps in the current build.** Both are stated here rather than
tidied away, because a spec that describes an intention instead of the artefact
is worse than no spec.

1. **`Inter` is named first in `body` and in `font-ui`, but no Inter file is
   self-hosted.** On any machine without Inter installed the UI renders in
   `system-ui`. That is an acceptable fallback and the design tolerates it —
   but don't assume the live site is showing Inter. If you want it, ship it.
2. **`font-body` / Sueca Tx is referenced by no component.** Three font files
   (~92 kB: regular, italic, extrabold) are declared and downloadable but never
   applied; prose currently renders in the UI sans at `text-[13px]`. Either
   apply `font-body` to prose blocks or drop the three `@font-face` rules — but
   decide, don't inherit the ambiguity.

Neither gap is load-bearing. Port the *structure* — a serif for headings and
numbers, a sans for chrome — and these resolve themselves.

The big-number style is the system's signature: **a serif at large size, tight
tracking, tabular figures**. Numbers are set in `font-head`, never in the UI
sans. That single choice is why the dashboard reads like a newspaper rather
than an admin panel.

### 3.2 Loading

Self-hosted `woff2`, content-hashed filenames, `font-display: swap`, all
declared at the top of the stylesheet — no `@import`, no font CDN.

```css
@font-face { font-family:'Sueca Hd'; src:url('/fonts/sueca-web-hd-semibold_c8feba36.woff2') format('woff2'); font-weight:600; font-display:swap; }
```

Files (`public/fonts/`, ~26–33 kB each, 9 files):

```
SvDEsterBlenda-Regular_4d499fd4.woff2      400
SvDEsterBlenda-Medium_ce71f11f.woff2       500
SvDEsterBlenda-Bold_2775ffc4.woff2         700
sueca-web-hd-light_30d82c42.woff2          300
sueca-web-hd-semibold_c8feba36.woff2       600
sueca-web-hd-bold_af5dba33.woff2           700
sueca-text-regular_593d3599.woff2          400
sueca-text-regular-italic_51117951.woff2   400 italic
sueca-text-extrabold_ae7fcb27.woff2        800
```

### 3.3 The scale as actually used

Sizes are written as arbitrary pixel values (`text-[13px]`), not Tailwind
steps, because the scale is typographic rather than modular. Copy the table,
don't re-derive it.

| Role | Spec |
|---|---|
| Page title (`h1`) | `font-head text-2xl font-semibold tracking-[-0.02em]` |
| Card / figure title (`h3`) | `font-head text-[15px] font-semibold leading-tight tracking-[-0.01em]` |
| Card description | `text-[13px] leading-snug text-[var(--color-text-secondary)]` |
| Body / page intro | `text-[13px]`, `max-w-2xl` or `max-w-prose` |
| Hero number (stat tile) | `tabular font-head text-[26px] font-semibold leading-none tracking-[-0.02em]` |
| Hero number (month card) | `tabular font-head text-[32px] font-semibold leading-none tracking-[-0.02em]` |
| Field label (small caps) | `text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]` |
| Stat tile label | `text-[12px] font-medium leading-tight text-[var(--color-text-secondary)]` |
| Table header | `h-9 px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]` |
| Table body | `text-sm` (14px), `.tabular` on numeric bodies |
| Nav item | `text-[13px] font-medium` |
| Badge | `text-[11px] font-medium leading-4` |
| Chart legend | `text-[12px] text-[var(--color-text-secondary)]` |
| Tooltip | label `text-[12px] font-semibold`; rows `text-[12px]`; footer `text-[11px]` |
| Version stamp | `text-[10px] text-[var(--color-text-muted)]/70` |

**Negative tracking scales with size**: `-0.02em` at 24px and above, `-0.01em`
at 15px, none below. Serif display type set loose looks accidental.

### 3.4 Marks

| Asset | File | Use |
|---|---|---|
| Wordmark | `public/brand/svenska-cp-tjanst.svg` | Header, login lockup |
| Square mark | `public/brand/cp-mark.svg` (512×512) | Favicon, touch icon |
| Favicon | `public/favicon.svg` | copy of the square mark |
| Touch icon | `public/apple-touch-icon.png` (180 px) | generated from the SVG |
| Share image | `public/og.png` (1200×630) | og:image / twitter:image |

**The wordmark is inlined as JSX, not loaded as `<img>`.** The source SVG
colors its paths via a `--logoColor` custom property; inlining lets that
resolve to `currentColor`, so the mark is black on light and white on dark
**with one file and no filters**. This is the correct pattern for any
single-color mark — copy it.

```tsx
<svg viewBox="0 0 242.4 32" role="img" aria-labelledby={titleId}
     style={{ ['--logoColor' as string]: 'currentColor', ...style }}>
  <title id={titleId}>Svenska CP-Tjänst</title>
  <g fill="var(--logoColor, #000)">…</g>
</svg>
```

The square mark keeps its own cream plate baked in (`#F8EFE9`) and so is used
as an `<img>` — it must not follow the text color. `#F8EFE9` is also the
light-mode `theme-color`; dark is `#031420`.

**The login lockup** is the one piece of pure typography in the product:
wordmark, a 2px rounded rule at 20% opacity, then `Poddstatistik` in
`font-display font-bold tracking-[-0.02em]`. It scales as a unit because every
dimension is in `em` off one clamp:

```tsx
<div style={{ fontSize: 'clamp(19px, 5.2vw, 50px)', gap: '0.56em' }}>
  <Wordmark style={{ height: '0.9em' }} />
  <span style={{ width: '2px', height: '1.23em' }} />
  <span className="font-display font-bold">Poddstatistik</span>
</div>
```

### 3.5 Portraits

Host portraits are **cut out against transparency**, so they cannot float on
the page — they sit on a tinted plate:

```css
.avatar-plate { background: linear-gradient(160deg, var(--color-background-tertiary), var(--color-background-secondary)); }
```

Stored as `.webp` at two sizes (full + `@160`), `object-cover object-top`
(top-anchored so heads don't crop), circular, with two-letter initials as the
fallback. Sizes in use: `h-6` in dense lists, `h-7` beside a count, `h-11`
solo, `h-12` on a profile card.

---

## 4. Space, shape, elevation

### 4.1 Radius

`sm 6px` · `md 8px` · `lg 10px` · `rounded-full` for avatars and badges.
Cards, tiles and figures are `lg`. Buttons `md` (`xs` size drops to `sm`).
Small color swatches use `rounded-[3px]`, tooltip swatches `rounded-[2px]` —
a 10px radius on a 10px square is a circle, which reads as a different mark.

### 4.2 Spacing

| Context | Value |
|---|---|
| Section → section | `mb-5` |
| Card / figure padding | `p-5` (header `p-5 pb-3`, content `p-5 pt-0`) |
| Stat tile padding | `p-4` |
| Tile grid gap | `gap-3` |
| Card & chart grid gap | `gap-4` |
| Main padding | `px-4 py-5 sm:px-6` |
| Divider above a field group | `border-t pt-3.5` with `mt-4` |

### 4.3 Elevation

Deliberately flat. Only three shadows exist:

- Card: `shadow-[0_1px_2px_rgba(0,0,0,0.04)]` — barely there
- Tooltip: `shadow-md`
- Popover / chart tooltip: `shadow-lg`

Everything else separates with a border. **Depth is not a design element here;**
adding shadows to make hierarchy is the wrong lever — use the surface tokens.

### 4.4 Layout shell

```
max-w-[1400px] centered
├── header   sticky top-0  z-40  h-14  border-b  bg-background-primary
├── sidebar  w-56
│     desktop: lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:z-30
│     mobile:  fixed left-0 top-14 bottom-0 z-40, -translate-x-full when closed
│              pb-[calc(1rem+env(safe-area-inset-bottom))]
├── backdrop fixed inset-0 top-14 z-30 bg-black/30 lg:hidden
└── main     min-w-0 flex-1 px-4 py-5 sm:px-6
      └── filter bar  sticky top-14 z-20  (translucent, see below)
```

**The z-scale is a fixed ladder. Do not improvise within it:**

| z | What |
|---|---|
| 20 | Filter bar |
| 30 | Mobile backdrop, desktop sidebar |
| 40 | Header, mobile sidebar drawer |
| 50 | Popover, tooltip, dialog |

Two bugs this ladder exists to prevent, both of which actually happened:

- **`inset-y-14` sets top *and* bottom.** The mobile drawer stopped a
  header-height above the screen edge with the page showing through. Use
  `top-14 bottom-0` plus `lg:bottom-auto`.
- **Two siblings at the same z.** The translucent filter bar and the sidebar
  were both `z-30`; the later one in the DOM won and covered the nav. Anything
  translucent must be explicitly *below* what it might overlap.

The filter bar is translucent so content scrolling under it stays legible:

```
sticky top-14 z-20 -mx-4 mb-5 border-b px-4 py-2.5
bg-[var(--color-background-primary)]/92 backdrop-blur
supports-[backdrop-filter]:bg-[var(--color-background-primary)]/75
sm:-mx-6 sm:px-6
```

Note `top-14`, not `top-0` — a sticky element under a fixed header must clear
it, or it hides behind the header at every viewport width.

### 4.5 Motion

Almost none, and all of it fast.

```js
'fade-in': from { opacity:0, transform:translateY(2px) } → none   // 0.18s ease-out
'accordion-down' / 'accordion-up'                                  // 0.2s ease-out
```

Everything else is `transition-colors` on hover/focus. **No motion on data.**
Charts don't animate in; a number that slides into place is a number you can't
read yet.

---

## 5. Components

### 5.1 Button

Base: `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md
text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring
focus-visible:ring-offset-1 disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0`

| Variant | Spec |
|---|---|
| `default` | `bg-[var(--color-action)] text-[var(--color-action-text)] hover:bg-[var(--color-action-hover)]` |
| `outline` | `border bg-[var(--color-surface-raised)] hover:bg-[var(--color-background-tertiary)]` |
| `ghost` | `hover:bg-[var(--color-background-tertiary)]` |
| `subtle` | `bg-[var(--color-background-tertiary)] hover:bg-[var(--color-border-primary)]` |
| `destructive` | `bg-[var(--color-critical)] text-white hover:opacity-90` |
| `link` | `text-[var(--color-action)] underline-offset-4 hover:underline` |

| Size | Spec |
|---|---|
| `default` | `h-9 px-4 py-2` |
| `sm` | `h-8 px-3 text-[13px]` |
| `xs` | `h-7 px-2 text-xs rounded` |
| `lg` | `h-10 px-6` |
| `icon` | `h-9 w-9` |

`[&_svg]:size-4` means icons are never sized at the call site. Pass the icon
bare.

### 5.2 Card / Figure

```
rounded-lg border bg-[var(--color-surface-raised)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]
```

A chart uses the semantic `<figure>` / `<figcaption>` equivalent with the same
skin (`ChartFrame`, §7.5). Same visual, correct semantics.

### 5.3 Badge

`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4`

Variants: `default` (tertiary bg), `outline`, and the three status tints —
`good` at `/12`, `warning` at `/14`, `critical` at `/12` opacity over the
status color, with the status color as text.

### 5.4 StatTile

The workhorse. Label, hero number, and a change indicator.

```
rounded-lg border bg-[var(--color-surface-raised)] p-4
label   text-[12px] font-medium text-secondary   (icon right, text-muted)
value   tabular font-head text-[26px] font-semibold leading-none tracking-[-0.02em], mt-2
meta    mt-2 min-h-[16px] text-[11px]  — change arrow + hint
```

Two details that matter more than they look:

- **`min-h-[16px]` on the meta row.** Tiles with and without a change figure
  must be the same height or the grid comb goes ragged.
- **`direction` decides the arrow color, not the sign.** `up-good`, `up-bad`,
  `neutral`. A rising *arbetskvot* is bad news; a rising episode count is good;
  a rising average length is neither. The component must be told which — it
  cannot infer it, and guessing produces confidently wrong green.

Dead zone: changes within ±0.05 % render as neutral, not as a direction.

Clickable tiles swap `<div>` for `<button>` (`w-full text-left`) and gain
`hover:bg-[var(--color-background-tertiary)]/70` plus a focus ring. **The whole
tile is the hit target** — never a small link inside a number.

### 5.5 Table

- Header cell: `h-9 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]`
- Row: `border-b border-[var(--color-border-secondary)] hover:bg-[var(--color-background-tertiary)]/60`
- Body: `text-sm`; add `.tabular` to any numeric `<tbody>`
- Wrapper: `relative w-full overflow-x-auto` — **tables scroll inside
  themselves; the page never scrolls sideways**
- Numeric columns are right-aligned; first column gets `pl-5`, last `pr-5` to
  line up with card padding

### 5.6 Empty

```tsx
<div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
  <span className="text-[var(--color-text-muted)]">{icon ?? <Inbox className="h-6 w-6" />}</span>
  <p className="font-medium">{title}</p>
  {hint && <p className="max-w-sm text-[13px] text-[var(--color-text-secondary)]">{hint}</p>}
</div>
```

**Dashed border = "nothing here".** Solid = "something here". Keep the
distinction; it does real work once a page has both.

### 5.7 LoadError

Same silhouette as `Empty` — because a failed panel *is* empty — but with a
critical-colored icon and a way out.

```tsx
<div role="alert" className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
  <AlertCircle className="h-5 w-5 text-[var(--color-critical)]" aria-hidden />
  <p className="font-medium">Siffrorna kunde inte hämtas</p>
  <p className="max-w-sm text-[13px] leading-snug text-[var(--color-text-secondary)]">{error.message}</p>
  <button className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-action)] hover:underline">
    <RotateCw className="h-3.5 w-3.5" />Försök igen
  </button>
</div>
```

**The icon carries the alarm; the container stays calm.** When a whole page
fails you get six or seven of these side by side — six red-filled boxes read as
panic and stop being informative. One red glyph each reads as a list of facts.

### 5.8 Skeleton

`animate-pulse rounded-md bg-[var(--color-background-tertiary)]` at the
**exact height of the content it stands in for** (`h-[380px]` for a trend
chart, `h-[104px]` for a stat tile, `h-[270px]` for a month card). A skeleton
of the wrong height is worse than no skeleton — the page jumps twice.

### 5.9 Tooltip & popover

Tooltip: `z-50 max-w-xs rounded-md border px-2.5 py-1.5 text-xs shadow-md
bg-[var(--color-surface-raised)]`, `delayDuration={120}`, `animate-fade-in`.
Popover: `z-50 w-72 rounded-lg border p-3 shadow-lg`, `align="start"`,
`sideOffset={6}`.

---

## 6. Numbers, dates, durations

All Swedish locale (`sv-SE`), which means **space as thousands separator and
comma as decimal**: `1 338`, `2,45`.

### 6.1 The tabular-figures rule

Body text sets `font-feature-settings: 'tnum' 0` — proportional figures, which
look better in prose. Tabular figures are **opt-in** via `.tabular`.

Apply `.tabular` to: stat tile values, table numeric columns, chart tooltips,
legends with values, any number in a list that must line up vertically.
Do *not* apply it to numbers inside a sentence.

### 6.2 Formatters

| Function | Output | Rule |
|---|---|---|
| `num(v, d=0)` | `1 338` | non-finite → `–` |
| `percent(v, d=0)` | `12 %` | note the space; null → `–` |
| `ratio(v)` | `2,45×` | always 2 decimals |
| `signed(v)` | `+12` / `−12` | **U+2212 minus, not a hyphen** |
| `humanDuration(s)` | `1 h 30 min` | see below |
| `clockDuration(s)` | `0:45:30` | matches the source CSV |
| `longDate(iso)` | `4 mars 2026` | |
| `shortDate(iso)` | `4 mar 2026` | |
| `weekdayName(iso)` | `måndag` | lowercase, as Swedish requires |

**`humanDuration` drops minutes at scale**, and this is a deliberate design
decision, not a rounding bug: in `2 215 h 15 min` the trailing digits carry no
information but double the string length and force a wrap inside a stat tile.
Minutes are dropped at `h >= 100`, or at `h >= 10` with `{ short: true }`.

### 6.3 The em-dash placeholder

**A missing value is `–` (en dash), never `0`, never `N/A`, never blank.** Every
formatter returns it for null/NaN/non-finite input. This is the smallest
expression of §9 and it is enforced at the formatter, so no call site can get
it wrong.

---

## 7. Charts

The chart layer follows the `dataviz` skill's method. What follows is this
project's *instance* of it, plus its measured results.

### 7.1 Chart tokens

| Token | Light | Dark |
|---|---|---|
| `--chart-surface` | `#FFFFFF` | `#0B2337` |
| `--chart-grid` | `#EBEBEB` | `rgba(255,255,255,0.12)` |
| `--chart-axis` | `#605E5D` | `#B9C7D4` |

```css
.recharts-cartesian-axis-tick text { fill: var(--chart-axis); font-size: 11px; }
.recharts-cartesian-grid line     { stroke: var(--chart-grid); }
.recharts-surface                 { overflow: visible; }
```

### 7.2 The categorical scale

**Fixed order. Assigned by entity, never cycled, never re-assigned by rank.**

| Slot | Light | Dark |
|---|---|---|
| 1 | `#0098DA` | `#0098DA` |
| 2 | `#EA515A` | `#EA515A` |
| 3 | `#6148B5` | `#7557D8` |
| 4 | `#923C0D` | `#F25538` |
| 5 | `#465AB6` | `#556CD8` |
| 6 | `#998900` | `#998900` |
| 7 | `#E83183` | `#E83183` |
| other | `#918F8D` | `#8A9BAB` |

```ts
// The index comes from the person's place in the FIXED list — never from their
// place in a sorted or filtered view. Otherwise a filter repaints the
// survivors and the same person is blue in one chart and red in the next.
export function hostColor(slug: string, allSlugs: readonly string[]): string {
  const i = allSlugs.indexOf(slug)
  return i >= 0 && i < SERIES_MAX ? SERIES[i] : OTHER_COLOR
}
```

An 8th entity is **never** a generated hue. It folds into `other`.

#### Validation status — measured, and partly failing

Run: `node scripts/validate_palette.js "<hex,…>" --mode light|dark --surface "#…"`

| Palette | Adjacent pairs | All pairs |
|---|---|---|
| 7-slot categorical, light (`#FFFFFF`) | **PASS** | **FAIL** |
| 7-slot categorical, dark (`#0B2337`) | **PASS** | **FAIL** |
| Category trio, both modes | PASS | **PASS** |
| Reach + starts pair, both modes | PASS | **PASS** |

The all-pairs failures, exactly:

- **Light, slot 3 ↔ slot 5** (`#6148B5` purple ↔ `#465AB6` indigo):
  ΔE **5.5** normal vision (floor is 15), **1.2** deutan.
- **Dark, slot 3 ↔ slot 5** (`#7557D8` ↔ `#556CD8`): ΔE **1.3** deutan.
- **Dark, slot 2 ↔ slot 4** (`#EA515A` ↔ `#F25538`): ΔE **4.3** normal vision.

> **What this means in practice.** The scale is safe up to about **four
> concurrent series**, where adjacency and all-pairs coincide. Past that, two
> slots on screen at once are effectively the same color. This is reachable in
> the current app — the host bar chart paints one bar per host and there are 13
> hosts.
>
> **The mitigation that makes it acceptable** is that in both places host color
> appears, identity is *also* carried by something else: the bar chart
> direct-labels every bar on the axis, and the listening tooltip shows the
> face and the name. **The standing rule is therefore: past four concurrent
> series, color may reinforce identity but must never be its only carrier.**
> If you need five or more series where color *is* the key, re-step the scale
> against `--pairs all` or facet into small multiples. Don't just add hues.

### 7.3 Other scales

**Semantic category colors** (these override slot order, because a category's
color is part of its meaning):

```
avsnitt       #0098DA / #0098DA     (blue, same both modes)
inläsningar   #923C0D / #F25538     (burnt orange)
kringarbete   #6148B5 / #7557D8     (purple)
```

**Listening reach** gets its own token `--reach` (`#6148B5` / `#7557D8`)
specifically because blue already means *avsnitt*, and both appear in the same
figure. When two encodings would collide, the newcomer moves.

**Sequential heat ramp** — one hue, light → dark, six steps:

```
light: #F2EFEE #CDE2FB #9EC5F4 #5598E7 #2A78D6 #184F95
dark:  rgba(255,255,255,0.06) #104281 #184F95 #256ABF #3987E5 #86B6EF
```

Step 0 is the empty state; values map to steps 1–5. Never a rainbow, never a
hue at a diverging midpoint.

**Text-safe variants.** Chart colors are validated for 3:1 (graphical objects)
and are *not* legal for colored text. A parallel `--text-1…7` scale hits 4.5:1:

```
light: #0D4C80 #BB4148 #7557D8 #923C0D #556CD8 #665B00 #B7236D  (other #605E5D)
dark:  #0098DA #EE747B #AE98E8 #F25538 #97A2E8 #998900 #FF74C7  (other #B9C7D4)
```

Use `hostColor()` for a mark, `hostTextColor()` for a number set in that
person's color. **Never the same value for both.**

### 7.4 Hard chart rules

1. **One y-axis. Never two.** Two measures of different scale become two
   charts, small multiples, or an indexed common base.
2. **Legend whenever there are ≥ 2 series; none for a single series** (the
   title names it).
3. **A table view is not a feature, it is the accessibility requirement.**
   Identity must never be carried by color alone.
4. **Thin marks.** Bars get 4px rounded ends and a 2px surface gap
   (`rx={4}`, `y+1`, `height-2`). Lines 2px. Markers ≥ 8px.
5. **No number on every point.** Direct-label selectively.
6. **Recessive grid and axes**, 11px tick text.
7. **Text wears text tokens.** A value never takes the series color; a colored
   swatch beside it carries identity.
8. **Every time-series chart is a navigation surface.** Clicking a week or
   month sets the filter *and* navigates to the episode list. Half of that —
   setting the filter without navigating — is a bug that looks like nothing
   happened.

### 7.5 ChartFrame

Every figure is wrapped in one component that supplies title, description,
legend, and the table toggle:

```
<figure className="rounded-lg border bg-[var(--color-surface-raised)] p-5">
  <figcaption>  h3 + description ......... right-hand controls + table toggle
  <ul>          legend, only when series.length > 1
  {showTable ? <table> : children}
```

`tableOnly` columns exist for a real problem: **numbers shown in the tooltip
but not drawn as a series still have to be readable without hovering.** They
join the table without gaining a legend swatch.

Cross-panel hover uses Recharts `syncId`. Corrected/estimated points get a
custom `dot` renderer rather than a separate series.

---

## 8. Interaction

### 8.1 Every number is a door

The core interaction idea. Any figure that summarises rows is a button to
those rows: it sets the filter and navigates to the list.

```tsx
const openEpisodes = (f: Filters) => { setFilters(f); navigate('/avsnitt') }
```

- **The whole surface is the target**, not a link inside the digits.
  `-m-1 p-1 rounded-md hover:bg-[var(--color-background-tertiary)]/70`.
- **Buttons can't nest.** A group made of buttons (a host list) is passed
  *without* an outer `onOpen`; the container becomes a plain `<div>`.
- Every one carries a `title` saying where it goes: `Visa avsnitt som rader`.
- Minimum touch target 44px — hence `min-h-11` on value rows.

### 8.2 Filters

One row, above the content, sticky. Period presets in a popover; host and
category as multi-select toggles; free text search; grain switch
(vecka/månad/kvartal/år). Filter state lives in the app store, so it survives
navigation — which is what makes §8.1 work.

Empty arrays are normalised to `undefined` so an empty filter never
round-trips as a constraint.

### 8.3 Keyboard

`Cmd/Ctrl+K` opens a command palette. Focus is always visible
(`:focus-visible` outline, or `ring-2 ring-ring ring-offset-1` on controls).
Nothing is reachable by pointer only.

### 8.4 Session handling

- Any `401 {code:'unauthenticated'}` from the API flips the session state
  **synchronously** and redirects to login. Synchronously matters: a
  round-trip is long enough for the views to paint zeroes first.
- The redirect carries `return_to` (the page you were on) and a plain
  explanation. Paths beginning `//` are dropped.
- A backgrounded tab re-validates on focus (throttled 30 s) — **by asking the
  server, not by counting down `expires_at`.** That timestamp is the server's
  clock; interpreting it in the browser logs people out early whenever the two
  disagree.
- Login errors (wrong password, expired code) are also 401s. Key the global
  handler on the **code**, not the status, or logging in wrongly logs you out.

---

## 9. Honesty rules

These are the principles the product is actually *about*. They are what makes
it a statistics tool rather than a dashboard.

### 9.1 A missing answer must never look like a zero answer

The single most important rule. Every async panel is a **three-way** branch —
pending, failed, ready — never two:

```tsx
{gate(load, 'h-[380px]') ?? <TrendChart data={load.data ?? []} … />}
```

`gate()` returns a skeleton while pending, a `LoadError` on failure, and `null`
when ready. Because a failed request never reaches the chart, the ubiquitous
`data ?? []` can no longer turn a 500 into a zero.

Corollaries, all of them learned the hard way:

- **Per panel, not per page.** One failed fetch among six must not blank the
  other five.
- **401 is routed past this** to the login redirect — a failure card flashing
  on the way out is noise.
- **Prose counts obey it too.** `{!stats.error && <>{rows.length} personer i
  urvalet. </>}` — "0 personer" is a confident wrong answer to a question that
  was never answered.
- **Data read from shared app state obeys it too.** Errors there must be kept,
  not swallowed with `catch { setX(null) }`, or an unanswered fetch becomes
  "inga händelser".

### 9.2 Never sum what cannot be summed

Weekly reach counts unique devices; the same listener recurs, so adding weeks
double-counts. Reach is reported as **average, peak and latest — never a
total.** Starts are discrete events and do sum.

Encode the constraint everywhere it could be violated: in the schema comment,
in the API method, and in user-facing prose on the page. A rule that lives in
one head is a rule that gets broken at the next feature.

### 9.3 Known-bad data is a named exception, not a detector

One week's figures were bad. The fix is a hardcoded list:

```php
private const CORRECTED_WEEKS = ['2023-06-08' => '…reason…'];
```

**Not** an outlier threshold. A threshold that isolates this week today will
eventually smooth a real event — the genuine season restart that legitimately
tripled starts would have been "corrected" away. The corrected value is
computed at read time from the two neighbouring weeks either side, the measured
value is kept, and the UI shows both with a ⚠ marker and a note.

### 9.4 Show the reason, not just the symptom

Error copy carries the server's own message. "Något gick fel" is not a design;
it's a shrug.

---

## 10. Anti-patterns

Check every screen against this list.

| Don't | Because |
|---|---|
| Dual y-axes | Two scales in one frame invite false correlation. Two charts instead. |
| Cycle categorical hues past slot 7 | Two entities in one color is worse than a gray "other". |
| Re-assign colors after a filter | The survivors get repainted and identity breaks across views. |
| Recolor a chart color for text | 3:1 is for shapes; text needs 4.5:1. Use `--text-*`. |
| A status color as a series | `critical` must keep meaning *critical*. |
| Color as the sole carrier of identity | Legend + direct label + table, always. |
| A red-filled box per failed panel | Seven of them is panic, not information. Icon carries the alarm. |
| `data ?? []` behind an ungated fetch | §9.1. This is the bug this system exists to prevent. |
| A skeleton whose height ≠ the content | The page jumps twice instead of once. |
| A number rendered `0` when it is unknown | Use `–`. |
| Title Case | The product is Swedish and speaks plainly. |
| Motion on data | A number sliding into place can't be read. |
| A token defined only inside a media query | Undefined for half your users. |
| `inset-y-*` on a full-height drawer | Sets top *and* bottom; it will hover off the edge. |
| Two overlapping siblings at equal z | DOM order decides, and it will decide wrong. |
| A sticky element at `top-0` under a fixed header | It hides behind the header at every width. |

---

## 11. Porting checklist

1. **Read §3.0.** Substitute the typefaces unless you hold the SvD license.
   Keep the *structure*: serif display, serif headings, serif body, sans chrome.
2. Copy the raw ramps and semantic roles (§2.3, §2.4) into one stylesheet.
   Keep the warm ground / cold ink relationship even if you change the hues.
3. Build the **three theme scopes** exactly as §2.2 specifies. Verify by
   toggling on a dark-OS machine *and* a light-OS machine.
4. Set the base rules (§2.5): universal border color, body background from a
   token, `tnum 0`, `.tabular`, focus-visible, selection.
5. Configure Tailwind: the semantic color aliases, the four font families,
   `borderRadius` 6/8/10, `fade-in`, `darkMode: ['class','[data-theme="dark"]']`.
6. Port the components in §5 in order — Button, Card, Badge, StatTile, Table,
   Empty, LoadError, Skeleton. They have no dependencies on this product's data.
7. Port `format.ts` (§6) wholesale, adjusting the locale. **Keep the `–`
   return for non-finite input.**
8. If there are charts: tokens (§7.1), then the scale (§7.2), then **run the
   validator on your actual hues before drawing anything.** Record the result
   in your own version of §7.2 — including the failures.
9. Wire the shell and the z-ladder (§4.4).
10. Implement `gate()` and the three-way branch (§9.1) **before** building
    pages, not after. Retrofitting it means touching every panel — this project
    had to, across 9 pages and 20 call sites.
11. Final pass against §10.

### What is portable vs. what is SvD's

| Portable, no restriction | SvD's property |
|---|---|
| Color system & token architecture | The typefaces (`public/fonts/*`) |
| Spacing, radius, elevation, z-ladder | The wordmark & CP mark |
| Every component in §5 | The host portraits |
| Formatters & the `–` rule | The name "Svenska CP-Tjänst" |
| All chart rules & the validated scale | |
| Every honesty rule in §9 | |

---

## 12. Reference

**Stack.** React 18 + TypeScript + Vite, Tailwind + shadcn/ui + Radix, Recharts,
`lucide-react` icons, `class-variance-authority` for variants,
`tailwind-merge` via `cn()` so later classes win conflicts. Built static into
`public/`; PHP 8 + MySQL API behind `/api`.

**Asset caching** (`.htaccess`): content-hashed `css|js|woff2|webp` get
`max-age=31536000, immutable`; HTML gets `no-cache, must-revalidate`;
`og.png`/`favicon.svg`/`apple-touch-icon.png` get 24 h; `robots.txt` and
`sitemap.xml` 5 min.

**Build stamp.** `__BUILD_ID__` = `YYYY.MM.<random 4>`, computed once per build
and printed at the foot of the sidebar at `text-[10px]`, so you can see which
version is actually live.

**Document head.** `lang="sv"`, `noindex, nofollow` (internal tool), split
`theme-color` per color scheme, full Open Graph + Twitter card against
`og.png` at 1200×630.

**Source of truth for each chapter:**

| Chapter | Files |
|---|---|
| §2 Color | `app/src/index.css`, `app/tailwind.config.js` |
| §3 Type & assets | `app/src/index.css`, `app/src/components/Brand.tsx`, `public/fonts/`, `public/brand/` |
| §4 Layout | `app/src/components/Layout.tsx`, `app/src/components/FilterBar.tsx` |
| §5 Components | `app/src/components/ui/`, `StatTile.tsx`, `Empty.tsx`, `LoadState.tsx` |
| §6 Formatting | `app/src/lib/format.ts` |
| §7 Charts | `app/src/lib/palette.ts`, `app/src/components/charts/` |
| §8 Interaction | `app/src/lib/store.tsx`, `app/src/lib/api.ts`, `app/src/App.tsx` |
| §9 Honesty | `app/src/components/LoadState.tsx`, `api/lib/Stats.php` |
