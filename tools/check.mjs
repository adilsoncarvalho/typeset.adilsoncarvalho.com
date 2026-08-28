/* Verifies that the implementations still match spec.json, and that the site
   can render every section. spec.json is normative: a mismatch means the
   implementation is broken, not the spec.
   Run: node tools/check.mjs */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { buildAll } from './build-site.mjs';

const spec = JSON.parse(readFileSync('spec.json', 'utf8'));
const css = readFileSync('typeset.css', 'utf8');
const typ = readFileSync('implementations/typeset.typ', 'utf8');
const html = readFileSync('index.html', 'utf8');
const specMd = readFileSync('SPEC.md', 'utf8');

const fail = [];
const warn = [];

/* ---- 1. Foundation tokens must appear in the CSS with the spec's values --- */

const cssVar = (name) => {
  const m = css.match(new RegExp(`--ts-${name}:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
};

const tokenChecks = [
  ['base', spec.foundation.scale.steps.base],
  ['sm', spec.foundation.scale.steps.sm],
  ['xs', spec.foundation.scale.steps.xs],
  ['h1', spec.foundation.scale.steps.h1],
  ['h2', spec.foundation.scale.steps.h2],
  ['h3', spec.foundation.scale.steps.h3],
  ['h4', spec.foundation.scale.steps.h4],
  ['leading', String(spec.foundation.rhythm.line_height)],
  ['leading-tight', String(spec.foundation.rhythm.line_height_tight)],
  ['space', spec.foundation.rhythm.space],
  ['measure', spec.foundation.rhythm.measure],
  ['ink', spec.foundation.color.ink.hex],
  ['ink-muted', spec.foundation.color.ink_muted.hex],
  ['ink-faint', spec.foundation.color.ink_faint.hex],
  ['rule', spec.foundation.color.rule.hex],
  ['rule-strong', spec.foundation.color.rule_strong.hex],
  ['wash', spec.foundation.color.wash.hex],
  ['accent', spec.foundation.color.accent.hex],
];

for (const [name, expected] of tokenChecks) {
  const actual = cssVar(name);
  if (actual === null) fail.push(`typeset.css: --ts-${name} is missing (spec says ${expected})`);
  else if (actual !== expected) fail.push(`typeset.css: --ts-${name} is ${actual}, spec says ${expected}`);
}

for (const [key, font] of Object.entries(spec.foundation.fonts)) {
  if (key === 'embedding') continue;
  if (!css.includes(`"${font.family}"`)) fail.push(`typeset.css: ${key} family "${font.family}" not found`);
  if (!typ.includes(`"${font.family}"`)) fail.push(`typeset.typ: ${key} family "${font.family}" not found`);
}

/* ---- 2. The Typst leading derivation must match the spec's advance -------- */

const { line_height, baseline_advance } = spec.foundation.rhythm;
const base = parseFloat(spec.foundation.scale.steps.base);
const expectedAdvance = +(base * line_height).toFixed(2);
if (Math.abs(parseFloat(baseline_advance) - expectedAdvance) > 0.01) {
  fail.push(`spec.json: rhythm.baseline_advance is ${baseline_advance}, but base × line_height = ${expectedAdvance}pt`);
}
if (!typ.includes('leading-for(line-height) = (line-height - 1) * 1em')) {
  fail.push('typeset.typ: the leading derivation named in conformance is missing');
}
if (!typ.includes('top-edge: 1em') || !typ.includes('bottom-edge: 0pt')) {
  fail.push('typeset.typ: the line box is not pinned to baseline..1em, so the advance is font-dependent');
}

/* The measure is the rule everything else is downstream of, so both
   implementations must actually constrain it — not just declare the page. */
const measureMm = spec.foundation.rhythm.measure_mm;
if (!typ.includes(`${measureMm}mm`)) {
  fail.push(`typeset.typ: the measure (${measureMm}mm) is never applied — the flow would fill the full text width`);
}
if (!css.includes('max-width: var(--ts-measure)')) {
  fail.push('typeset.css: the measure is never applied to the text column');
}

/* ---- 3. Every spec section must be reachable from the page --------------- */

const marker = (src, re) => {
  const found = new Set();
  let m;
  while ((m = re.exec(src)) !== null) found.add(m[1]);
  return found;
};
const cssIds = marker(css, /\/\*!\s*@s\s+([a-z0-9-]+)\s*::/g);
const typIds = marker(typ, /\/\/\s*@s\s+([a-z0-9-]+)\s*\n/g);
const manifest = JSON.parse(readFileSync('src/sections.json', 'utf8'));
const panelAttrs = manifest.map((s) => s.panel.spec);
const panelIds = new Set(panelAttrs.flatMap((a) => a.split(',').map((s) => s.trim())));

for (const sec of spec.sections) {
  if (!cssIds.has(sec.id)) fail.push(`typeset.css: no section marker for "${sec.id}"`);
  if (!panelIds.has(sec.id)) fail.push(`src/sections.json: no panel for spec section "${sec.id}"`);
}

/* ---- 3b. Every manifest section must have a demo, and vice versa --------- */

for (const s of manifest) {
  const demo = `src/demos/${s.id}.html`;
  if (!existsSync(demo)) fail.push(`${demo} is missing`);
  if (s.fullrow && !existsSync(`src/demos/${s.id}.fullrow.html`)) {
    fail.push(`src/demos/${s.id}.fullrow.html is declared but missing`);
  }
}
const declared = new Set(manifest.map((s) => s.id));
for (const f of readdirSync('src/demos')) {
  const id = f.replace(/\.(fullrow\.)?html$/, '');
  if (!declared.has(id)) warn.push(`src/demos/${f} is not referenced by src/sections.json`);
}

/* ---- 3c. The generated pages must be current ----------------------------- */

const { output } = buildAll();
for (const [path, contents] of output) {
  if (readFileSync(path, 'utf8') !== contents) {
    fail.push(`${path} is stale — run node tools/build-site.mjs`);
  }
}

/* A template must be implemented in both engines and shown on the page. The
   default template is the base stylesheet, so it needs no marker of its own. */
const templateIds = Object.keys(spec.templates).filter((k) => k !== 'default' && k !== 'note');
for (const id of templateIds) {
  if (id === spec.templates.default) continue;
  if (!cssIds.has(id)) fail.push(`typeset.css: no section marker for template "${id}"`);
  if (!typIds.has(id)) fail.push(`typeset.typ: no marked region for template "${id}"`);
  if (!panelIds.has(id)) fail.push(`index.html: no panel for template "${id}"`);
}

/* The two-column derivation is arithmetic, so check the arithmetic. */
const two = spec.templates['two-column'];
if (two) {
  const d = two.derivation;
  const col = (d.text_width_mm - d.column_gap_mm) / 2;
  if (Math.abs(col - d.column_width_mm) > 0.5) {
    fail.push(`spec.json: two-column width is ${d.column_width_mm}mm, but (${d.text_width_mm} - ${d.column_gap_mm}) / 2 = ${col}mm`);
  }
  const chars = (base) => Math.round((66 / 126) * col * (11 / base));
  for (const [size, stated] of Object.entries(d.characters_per_line)) {
    const computed = chars(parseFloat(size));
    if (computed !== stated) fail.push(`spec.json: characters_per_line[${size}] is ${stated}, computed ${computed}`);
  }
  const atBase = chars(parseFloat(two.scale.base));
  if (atBase < d.floor) fail.push(`spec.json: the two-column base of ${two.scale.base} yields ${atBase} characters, below the ${d.floor} floor`);
  const advance = +(parseFloat(two.scale.base) * two.rhythm.line_height).toFixed(2);
  if (Math.abs(parseFloat(two.rhythm.baseline_advance) - advance) > 0.01) {
    fail.push(`spec.json: two-column baseline_advance is ${two.rhythm.baseline_advance}, computed ${advance}pt`);
  }
}
for (const id of cssIds) {
  const isFoundation = ['tokens', 'foundation', 'page', 'justification', 'numbering', 'dropcap',
    'links', 'code-inline', 'figures-numeric', 'utilities'].includes(id);
  const isTemplate = Object.keys(spec.templates).includes(id);
  if (!spec.sections.some((s) => s.id === id) && !isFoundation && !isTemplate) {
    warn.push(`typeset.css: section "${id}" has no counterpart in spec.json`);
  }
}
const noTypst = spec.sections.filter((s) => !typIds.has(s.id)).map((s) => s.id);
if (noTypst.length) warn.push(`typeset.typ: no marked region for ${noTypst.join(', ')} (the page falls back to a pointer or a note)`);

/* ---- 4. SPEC.md must be current ----------------------------------------- */

if (!specMd.includes(`Version ${spec.version} · updated ${spec.updated}`)) {
  fail.push('SPEC.md is stale — run node tools/build-spec.mjs');
}
for (const sec of spec.sections) {
  if (!specMd.includes(`\`${sec.id}\``)) fail.push(`SPEC.md is missing section "${sec.id}" — regenerate`);
}

/* ---- Report ------------------------------------------------------------- */

const elements = spec.sections.reduce((n, s) => n + s.elements.length, 0);
console.log(`typeset spec ${spec.version} — ${spec.sections.length} sections, ${elements} elements`);
console.log(`  css markers ${cssIds.size} · typst markers ${typIds.size} · panels ${panelAttrs.length} · generated pages ${output.size}`);
for (const wn of warn) console.log(`  note: ${wn}`);
if (fail.length) {
  console.error(`\n${fail.length} conformance failure${fail.length > 1 ? 's' : ''}:`);
  for (const f of fail) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('\nall checks passed');
