#!/usr/bin/env node
// Builds the optimised Banfinator brand assets from the Illustrator export.
//
//   node brand/tools/build-banfa.mjs
//
// Inputs : brand/banfa-source.svg   (Adobe Illustrator export, do not edit by hand)
// Outputs: brand/banfa.svg          full portrait, optimised master
//          brand/banfa-mark.svg     square crop — vector source for the rasters
//                                   below; the page does NOT load it
//          brand/banfa-mark.webp    what the header actually shows
//          brand/favicon-{16,32,48}.png, brand/apple-touch-icon.png
//
// The mark is served as raster, not SVG. It is a traced portrait whose collar
// carries thousands of path nodes, so the vector is 69 KB gzipped while a 160px
// webp covering 3x DPR at the header's 45px is 17 KB — and at 16-48px a favicon
// gains nothing from being vector.
//
// Requires: npx (svgo), inkscape, cwebp.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'banfa-source.svg');
const tmp = fs.mkdtempSync('/tmp/banfa-');
const t = (f) => path.join(tmp, f);
const out = (f) => path.join(root, f);

// Colour pairs whose CIELAB ΔE is under 2 — imperceptible, so they collapse to
// one. The wider steps (#fcb229, and the four-step cream ramp on the sweater)
// are deliberate tonal shading and are left alone.
const MERGE = { '#fcb531': '#fcb633', '#063e69': '#063b64' };

// Square crop, in source viewBox units, sized so the halftone halo sits wholly
// inside it with clear margin — the mark should read as a complete object, not
// a window onto a larger one.
//
// Measured from the artwork: the halo spans x 126..930 and its arch apex sits at
// y=0, hard against the top of the source viewBox. So the crop starts at
// negative y to put transparent air above the apex; without that the halo can
// only ever be flush with the edge. 880 wide centres the halo (centre x 528)
// with ~36 units either side.
//
// The figure's shoulders still leave through the bottom edge, which is correct
// for a bust, and the collar is what makes the file big: its floral motifs are
// cut as negative space in the orange paths.
const CROP = { x: 90, y: -45, w: 880, h: 880 };

const svgo = (input, output, config) => {
  fs.writeFileSync(t('svgo.config.mjs'), config);
  execSync(`npx -y svgo@3 -i "${input}" -o "${output}" --config "${t('svgo.config.mjs')}"`,
    { stdio: ['ignore', 'ignore', 'inherit'] });
};

const pass1 = (merge) => `export default {
  multipass: true,
  plugins: [{ name: 'preset-default', params: { overrides: {
    removeViewBox: false,
    convertPathData: { floatPrecision: 1, transformPrecision: 2 },
    cleanupNumericValues: { floatPrecision: 1 },
    mergePaths: ${merge ? '{ force: true }' : 'false'},
  }}}],
};`;

const PASS2 = `export default {
  multipass: true,
  plugins: [{ name: 'preset-default', params: { overrides: {
    removeViewBox: false,
    inlineStyles: false,
    mergePaths: { force: true },
  }}}],
};`;

/** Collapse the ΔE<2 colours, then hoist every fill into a one-letter class. */
function classifyFills(svg) {
  for (const [from, to] of Object.entries(MERGE)) svg = svg.replaceAll(`fill="${from}"`, `fill="${to}"`);

  const counts = {};
  for (const m of svg.matchAll(/fill="(#[0-9a-fA-F]{3,6})"/g)) counts[m[1]] = (counts[m[1]] || 0) + 1;

  // Shortest names to the most-used colours.
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const alpha = 'abcdefghijklmnopqrstuvwxyz';
  const cls = Object.fromEntries(ranked.map(([c], i) => [c, alpha[i]]));

  svg = svg.replace(/ fill="(#[0-9a-fA-F]{3,6})"/g, (m, c) => (cls[c] ? ` class="${cls[c]}"` : m));
  const css = ranked.map(([c]) => `.${cls[c]}{fill:${c}}`).join('');
  return svg.replace(/(<svg[^>]*>)/, `$1<style>${css}</style>`);
}

/** Drop rules for classes no element uses (matters after cropping). */
function pruneStyles(svg) {
  const used = new Set([...svg.matchAll(/class="([a-z])"/g)].map((m) => m[1]));
  return svg.replace(/<style>([^<]*)<\/style>/, (m, css) => {
    const kept = css.match(/\.[a-z]\{[^}]*\}/g).filter((r) => used.has(r[1]));
    return kept.length ? `<style>${kept.join('')}</style>` : '';
  });
}

/**
 * Reduce to the crop box: rewrite the viewBox and delete every element whose
 * bounding box falls entirely outside it. Without this the "small" mark still
 * ships all 1000-odd paths of the body, just clipped.
 */
function crop(svg, { x, y, w, h }) {
  let n = 0;
  const tagged = svg.replace(/<(path|circle|polygon|rect|ellipse)\b/g, (m, tag) => `<${tag} id="e${n++}"`);
  fs.writeFileSync(t('ids.svg'), tagged);

  const boxes = {};
  for (const line of execFileSync('inkscape', ['--query-all', t('ids.svg')], { maxBuffer: 1 << 28 })
    .toString().split('\n')) {
    const p = line.split(',');
    if (p.length === 5 && /^e\d+$/.test(p[0])) boxes[p[0]] = p.slice(1).map(Number);
  }

  let dropped = 0;
  const cropped = tagged.replace(/<(?:path|circle|polygon|rect|ellipse)\b[^>]*id="(e\d+)"[^>]*\/>/g, (m, id) => {
    const b = boxes[id];
    if (!b) return m.replace(/ id="e\d+"/, '');
    const [bx, by, bw, bh] = b;
    if (bx + bw < x || bx > x + w || by + bh < y || by > y + h) { dropped++; return ''; }
    return m.replace(/ id="e\d+"/, '');
  });
  console.log(`  dropped ${dropped} off-canvas elements`);
  return cropped.replace(/viewBox="[^"]*"/, `viewBox="${x} ${y} ${w} ${h}"`);
}

const title = (svg, text) => svg.replace(/(<svg[^>]*>)/, `$1<title>${text}</title>`);
const kb = (f) => `${(fs.statSync(f).size / 1024).toFixed(1)} KB`;

// ── master ────────────────────────────────────────────────────────────────
console.log('master…');
svgo(src, t('p1.svg'), pass1(true));
fs.writeFileSync(t('cls.svg'), classifyFills(fs.readFileSync(t('p1.svg'), 'utf8')));
svgo(t('cls.svg'), t('master.svg'), PASS2);
fs.writeFileSync(out('banfa.svg'), title(fs.readFileSync(t('master.svg'), 'utf8'), 'The Banfinator'));
console.log(`  brand/banfa.svg ${kb(out('banfa.svg'))}`);

// ── square mark ───────────────────────────────────────────────────────────
// Cull against the UNMERGED geometry. mergePaths fuses the collar's floral
// shapes into single paths spanning the whole sweater, and one such path
// clipping the crop drags the entire pattern in with it — that alone was the
// difference between a 30 KB mark and a 122 KB one. Merge after the cull.
console.log('mark…');
svgo(src, t('p1n.svg'), pass1(false));
fs.writeFileSync(t('clsn.svg'), classifyFills(fs.readFileSync(t('p1n.svg'), 'utf8')));
fs.writeFileSync(t('crop.svg'), crop(fs.readFileSync(t('clsn.svg'), 'utf8'), CROP));
svgo(t('crop.svg'), t('mark.svg'), PASS2);
fs.writeFileSync(out('banfa-mark.svg'), title(pruneStyles(fs.readFileSync(t('mark.svg'), 'utf8')), 'The Banfinator'));
console.log(`  brand/banfa-mark.svg ${kb(out('banfa-mark.svg'))} (source, not served)`);

// ── raster icons ──────────────────────────────────────────────────────────
console.log('icons…');
const png = (size, name) => {
  execFileSync('inkscape', ['--export-type=png', `--export-filename=${out(name)}`,
    '-w', String(size), '-h', String(size), out('banfa-mark.svg')], { stdio: 'ignore' });
};

for (const [size, name] of [[16, 'favicon-16.png'], [32, 'favicon-32.png'], [48, 'favicon-48.png'], [180, 'apple-touch-icon.png']]) {
  png(size, name);
  console.log(`  brand/${name} ${kb(out(name))}`);
}

// 160px covers the header's 45px mark at 3x DPR.
png(160, 'banfa-mark-160.png');
execFileSync('cwebp', ['-q', '88', '-m', '6', out('banfa-mark-160.png'), '-o', out('banfa-mark.webp')],
  { stdio: 'ignore' });
fs.rmSync(out('banfa-mark-160.png'), { force: true });
console.log(`  brand/banfa-mark.webp ${kb(out('banfa-mark.webp'))}`);

fs.rmSync(out('favicon.svg'), { force: true });

fs.rmSync(tmp, { recursive: true, force: true });
