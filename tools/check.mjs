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

/* ---- 3d. The iA Writer template ----------------------------------------- */

/* A template is a packaging of typeset.css, not a second implementation, so what
   is checked here is the page it declares and the modifier it opts into — the
   two things a bundle states for itself. Everything else it inherits, and
   tools/build-iawriter.mjs refuses to package a bundle whose files, fonts or
   version do not line up.

   There is one template. A two-column one was built and withdrawn: WebKit's
   print path ignores every CSS multi-column property, so it previewed in two
   columns and exported in one. Two columns belong to an engine that paginates
   them — see the engine capability table in README.md. */

const IAW = 'implementations/iawriter';

const plistValue = (plist, key) =>
  plist.match(new RegExp(`<key>${key}</key>\\s*<(?:string|integer)>([^<]+)</`))?.[1] ?? null;

/* The page margin. iA Writer reserves its header and footer bands by setting the
   page margins itself, so a `@page` margin replaces them rather than adding to
   them — which makes `@page` the whole mechanism, and makes a template that
   declares a band as well a template whose header has no space to draw in. */
const letterPage = readFileSync(`${IAW}/letter/page.css`, 'utf8');
const pageMargin = letterPage.match(/@page\s*\{[^}]*?\bmargin:\s*([\d.]+)mm\s*;/);
if (!pageMargin) {
  fail.push(`${IAW}/letter/page.css: no @page margin — the export would have no page margins at all`);
}

const plist = readFileSync(`${IAW}/letter/Info.plist`, 'utf8');
const doc = readFileSync(`${IAW}/letter/document.html`, 'utf8');

if (plistValue(plist, 'CFBundleShortVersionString') !== spec.version) {
  fail.push(`${IAW}/letter/Info.plist: version is ${plistValue(plist, 'CFBundleShortVersionString')}, spec.json says ${spec.version}`);
}
if (!doc.includes('data-document')) {
  fail.push(`${IAW}/letter/document.html: no data-document element — iA Writer would render an empty page`);
}
if (!doc.includes('class="typeset')) {
  fail.push(`${IAW}/letter/document.html: the document element does not carry .typeset, so none of the stylesheet applies`);
}
for (const key of ['IATemplateHeaderFile', 'IATemplateHeaderHeight',
                   'IATemplateFooterFile', 'IATemplateFooterHeight']) {
  if (plistValue(plist, key) !== null) {
    fail.push(`${IAW}/letter/Info.plist: ${key} is set, but the band it reserves replaces the @page margin in page.css rather than adding to it`);
  }
}

/* The letter deliberately lets the text fill the page rather than stopping at
   the measure, so the cap must actually be lifted — with the cap in place the
   column would sit adrift with the margins asked for. This is the one place a
   template departs from the spec, so it is asserted rather than left to drift
   back silently. */
if (!/max-width:\s*none/.test(letterPage)) {
  fail.push(`${IAW}/letter/page.css: the measure cap is not lifted, so the column will not fill the page the margins leave`);
}

/* A letter is set ragged right; the spec forbids justifying one. */
if (!doc.includes('typeset--ragged')) {
  fail.push(`${IAW}/letter/document.html: a letter is set ragged right — typeset--ragged is missing`);
}
if (doc.includes('typeset--justified') || doc.includes('typeset--two-column')) {
  fail.push(`${IAW}/letter/document.html: a letter must not be justified`);
}

/* Every family/weight/style the template asks for must have a face bound for it.
   This is the failure the bundle exists to prevent and the one that never
   announces itself: asked for a weight it does not have, WebKit synthesises —
   a smeared bold, or an italic obtained by shearing an upright — and reports
   nothing. It is invisible on screen at small sizes and obvious in print.

   The families reached through a token are resolved through typeset.css, so a
   rule written as `font-family: var(--ts-sans)` is checked like a literal one. */

const tokenFamily = Object.fromEntries(
  [...css.matchAll(/--ts-(serif|sans|mono):\s*"([^"]+)"/g)].map((m) => [`--ts-${m[1]}`, m[2]]));

/* Declaration blocks, flattened. Good enough for stylesheets with no nesting,
   which is what these are. Comments come out first, or every selector arrives
   with the paragraph above it attached. */
const blocks = (text) => [...text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*)\{([^{}]*)\}/g)]
  .map((m) => ({ selector: m[1].trim().replace(/\s+/g, ' '), body: m[2] }));

const decl = (body, prop) => body.match(new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+)`))?.[1].trim();

{
  const sheets = ['iawriter.css', 'letter/page.css']
    .map((f) => readFileSync(`${IAW}/${f}`, 'utf8')).join('\n');

  const bound = blocks(sheets)
    .filter((b) => b.selector.endsWith('@font-face'))
    .map((b) => ({
      family: decl(b.body, 'font-family')?.replace(/["']/g, ''),
      weight: decl(b.body, 'font-weight') ?? '400',
      style: decl(b.body, 'font-style') ?? 'normal',
    }));

  for (const b of blocks(sheets)) {
    if (b.selector.endsWith('@font-face')) continue;
    const raw = decl(b.body, 'font-family');
    if (!raw) continue;
    const first = raw.split(',')[0].trim();
    const family = first.startsWith('var(')
      ? tokenFamily[first.slice(4, -1).trim()]
      : first.replace(/["']/g, '');
    if (!family || first === 'inherit') continue;
    /* Only families this template binds itself are checked. The rest come from
       typeset.css, whose own faces are covered by the token checks above. */
    if (!bound.some((f) => f.family === family)) continue;

    const weight = decl(b.body, 'font-weight') ?? '400';
    const style = decl(b.body, 'font-style') ?? 'normal';
    if (!bound.some((f) => f.family === family && f.weight === weight && f.style === style)) {
      fail.push(`${IAW}/letter: "${b.selector}" asks for ${family} ${weight} ${style}, `
        + `but no @font-face binds that face — WebKit would synthesise it silently`);
    }
  }
}

/* ---- 4. SPEC.md must be current ----------------------------------------- */

if (!specMd.includes(`Version ${spec.version} · updated ${spec.updated}`)) {
  fail.push('SPEC.md is stale — run node tools/build-spec.mjs');
}
for (const sec of spec.sections) {
  if (!specMd.includes(`\`${sec.id}\``)) fail.push(`SPEC.md is missing section "${sec.id}" — regenerate`);
}

/* ---- 5. Every named style is findable in the stylesheet by its name ------ */

/* The contract: a style is named either by a .ts-<id> class, or by a
   /* @style <id> *\/ marker comment above the rule that implements it.

   Not every element can carry a class. 73 of them are styled through a bare
   semantic selector (h1, strong, sub), and a few describe a rule rather than
   a selector at all: justification-exclusions says what is never justified,
   numbering-h2 is counter-generated content with no element to mark. A class
   is a name and a handle, not a requirement — so the gate checks that the
   canonical name is *present where a reader editing that rule will see it*,
   not that a class exists.

   Both directions are checked: an element with neither class nor marker
   fails, and a class or marker naming no element fails. */

const INTERNAL_CLASSES = new Set([
  'ts-label',        // shared base under the four caption/label variants
  'ts-break',        // shared base under the four section-break variants
  'ts-span',         // two-column template, not a document style
  'ts-print-only',   // paired with ts-screen-only under one spec element
  'ts-screen-only',
]);

const specIds = new Set(
  spec.sections.flatMap((s) => s.elements.map((e) => e.id)));

/* Markers live inside comments, so they are read before comments are
   stripped for the class extraction below — stripping first would silently
   empty this set. */
const styleMarkers = new Set(
  [...css.matchAll(/\/\*\s*@style\s+([a-z0-9-]+)/g)].map((m) => m[1]));

const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

const cssClasses = new Set(
  [...cssNoComments.matchAll(/\.(ts-[a-z0-9-]+)/g)].map((m) => m[1]));

const typSymbols = new Set(
  [...typ.matchAll(/^#let\s+([a-z0-9_-]+)\s*[=(]/gm)].map((m) => m[1]));

for (const id of specIds) {
  if (!cssClasses.has(`ts-${id}`) && !styleMarkers.has(id))
    fail.push(`typeset.css: style "${id}" has neither a .ts-${id} class nor a @style marker`);
}

for (const cls of cssClasses) {
  if (INTERNAL_CLASSES.has(cls)) continue;
  if (!specIds.has(cls.replace(/^ts-/, '')))
    fail.push(`typeset.css: .${cls} has no spec element behind it`);
}

for (const id of styleMarkers) {
  if (!specIds.has(id))
    fail.push(`typeset.css: @style ${id} names no spec element`);
}

/* Observes the shape of an element id: either the bare section id, or the
   section id followed by a leaf. specIds above is a Set, so a repeated id
   collapses into one entry rather than announcing itself — the uniqueness
   check therefore counts the array. */
const specIdList = spec.sections.flatMap((s) => s.elements.map((e) => e.id));
const seenIds = new Set();
for (const id of specIdList) {
  if (seenIds.has(id)) fail.push(`spec.json: element id "${id}" appears more than once`);
  seenIds.add(id);
}
for (const sec of spec.sections) {
  for (const el of sec.elements) {
    if (el.id !== sec.id && !el.id.startsWith(`${sec.id}-`)) {
      fail.push(`spec.json: element "${el.id}" is in section "${sec.id}", so its id must be `
        + `"${sec.id}" or "${sec.id}-<leaf>"`);
    }
  }
}

/* Observes the class names spec.json publishes. An opt_in is rendered into
   SPEC.md and onto the site as the class a reader is told to type, so one that
   names no rule is an instruction to write something inert. Values that are
   not a bare class name — a document modifier, or a sentence — are left alone. */
const optIns = [
  ...spec.sections.map((s) => [s.id, s.opt_in]),
  ...spec.sections.flatMap((s) => s.elements.map((e) => [e.id, e.opt_in])),
];
for (const [id, value] of optIns) {
  if (typeof value !== 'string' || !/^ts-[a-z0-9-]+$/.test(value)) continue;
  if (!cssClasses.has(value)) {
    fail.push(`spec.json: ${id} publishes opt_in "${value}", which is not a selector in typeset.css`);
  }
}

/* Observes the classes the documents in this repo actually write. The gates
   above read the stylesheet and the spec against each other; neither looks at
   a class attribute, so a misspelling in a demo, an example, a proof or a
   template renders unstyled and reports nothing. */

/* Chrome for the specimen page: these dress a demo so it reads in a browser,
   and never appear in a document. */
const SPECIMEN_CHROME = new Set(['ts-toc--demo', 'ts-folio']);

const documentFiles = ['specimen.css'];
const collectDocuments = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) collectDocuments(path);
    else if (path.endsWith('.html') || path.endsWith('.css')) documentFiles.push(path);
  }
};
for (const dir of ['src/demos', 'examples', 'proofs', 'implementations/iawriter']) {
  collectDocuments(dir);
}

for (const path of documentFiles) {
  const text = readFileSync(path, 'utf8');
  const used = new Set([
    ...[...text.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].trim().split(/\s+/)),
    ...[...text.matchAll(/\.(ts-[a-z0-9-]+)/g)].map((m) => m[1]),
  ].filter((c) => c.startsWith('ts-')));
  for (const cls of used) {
    if (specIds.has(cls.replace(/^ts-/, ''))) continue;
    if (INTERNAL_CLASSES.has(cls) || SPECIMEN_CHROME.has(cls)) continue;
    fail.push(`${path}: ${cls} names neither a spec element nor a declared-internal class`);
  }
}

/* Observes the exported Typst surface. Every symbol is either a named style or
   written down here, so a new export has to be a deliberate choice between the
   two. */
const INTERNAL_SYMBOLS = new Set([
  /* the palette, the scales and the spacing unit a template reads */
  'ink', 'ink-muted', 'ink-faint', 'rule-color', 'rule-strong', 'wash', 'accent',
  'serif', 'sans', 'mono',
  'scale-single-column', 'scale-two-column', 'base-size', 'sm', 'xs', 'sp',
  /* helpers the styles are built from */
  'leading-for', 'smcp', 'oldstyle', 'lining', 'tabular', '_break-mark',
  /* document and template entry points, and the two styles a document reaches
     through a shape of its own rather than through an element name */
  'typeset', 'two-column', 'span', 'toc', 'ts-table', 'epigraph-right',
]);

for (const sym of typSymbols) {
  if (INTERNAL_SYMBOLS.has(sym) || specIds.has(sym)) continue;
  fail.push(`typeset.typ: #let ${sym} names no spec element and is not listed as internal`);
}

/* Typst covers a subset by design — many styles are show rules on native
   elements rather than exported functions. Only the styles a document has to
   call by name need a symbol; those are the ones carrying a CSS class that is
   not a plain element alias. A missing one is a warning, not a failure — the
   list of styles that must expose a callable Typst symbol is not final, and
   promoting this direction means settling every one of the notes it prints
   first. The reverse direction above is a failure, because an export with no
   name behind it is a decision someone can write down in one line. */
for (const id of specIds) {
  if (!typSymbols.has(id) && !new RegExp(`//\\s*@s\\s+${id}\\s*\\n`).test(typ))
    warn.push(`typeset.typ: no symbol or marker region named "${id}"`);
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
