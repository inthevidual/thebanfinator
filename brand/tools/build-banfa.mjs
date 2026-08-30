#!/usr/bin/env node
// Builds the optimised Banfinator brand assets from the Illustrator export.
//
//   node brand/tools/build-banfa.mjs
//
// Inputs : brand/banfa-source.svg   (Adobe Illustrator export, do not edit by hand)
// Outputs: brand/banfa.svg          full portrait, optimised master
//          brand/banfa-mark.svg     square head crop, for small UI + favicon
//          brand/favicon.svg        copy of the mark
//          brand/favicon-{16,32,48}.png, brand/apple-touch-icon.png
//
// Requires: npx (svgo), inkscape.

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

// Square crop around the head, in source viewBox units. Measured, not eyeballed:
// rendering the figure with the halftone stripped and reading the silhouette
// width per row puts the hair crown at y=0, the jaw at its narrowest (the chin)
// at y~580, the neck at y~600 and the shoulders flaring from y~640. So the head
// occupies y 0..600, and a 620-tall box clears the chin by 20px while taking in
// the top of the collar. x is centred on the head's widest rows (226..790).
// 620 is also right at a size cliff: at 630 one more of the collar's merged
// orange paths falls inside the frame and the mark doubles, 57 KB to 118 KB.
const CROP = { x: 198, y: 0, w: 620, h: 620 };

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
fs.copyFileSync(out('banfa-mark.svg'), out('favicon.svg'));
console.log(`  brand/banfa-mark.svg ${kb(out('banfa-mark.svg'))}`);

// ── raster icons ──────────────────────────────────────────────────────────
console.log('icons…');
for (const [size, name] of [[16, 'favicon-16.png'], [32, 'favicon-32.png'], [48, 'favicon-48.png'], [180, 'apple-touch-icon.png']]) {
  execFileSync('inkscape', ['--export-type=png', `--export-filename=${out(name)}`,
    '-w', String(size), '-h', String(size), out('banfa-mark.svg')], { stdio: 'ignore' });
  console.log(`  brand/${name} ${kb(out(name))}`);
}

fs.rmSync(tmp, { recursive: true, force: true });
