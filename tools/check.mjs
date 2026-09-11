/* Verifies that the implementations still match spec.json, and that the site
   can render every section. spec.json is normative: a mismatch means the
   implementation is broken, not the spec.
   Run: node tools/check.mjs */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { buildAll } from './build-site.mjs';
import { extractDemos, verbatimLineMask } from '../src/extract.mjs';

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

/* ---- 3c. A demo's document fragment must round-trip losslessly ----------- */

/* src/extract.mjs pulls the document markup out of a demo file's page
   apparatus. It is correct only if it is invertible: this rebuilds each
   demo file from what it extracted and diffs the result against the file
   on disk. Any difference means the extractor lost or altered something —
   silently, since the panel that will consume this output is generated and
   always looks plausible.

   The boundary-finder below is written independently of extract.mjs's own
   (index-of scanning here, a combined regex there), so a bug in how one of
   them walks the tag stream — an off-by-one, a wrong cursor advance, the
   classic non-greedy match to the next "</div>" — surfaces as a mismatch
   instead of being invisible to both. Neither scanner distinguishes markup
   from text, so the one thing this does not catch is literal "<div"/"</div>"
   characters inside an element's own text content: both would parse that
   the same wrong way and agree with each other. */

function findMatchingClose(source, from, tag = 'div') {
  const openNeedle = `<${tag}`;
  const closeNeedle = `</${tag}>`;
  let depth = 1;
  let i = from;
  while (i < source.length) {
    const open = source.indexOf(openNeedle, i);
    const close = source.indexOf(closeNeedle, i);
    if (close === -1) return -1;
    if (open !== -1 && open < close) {
      depth += 1;
      i = source.indexOf('>', open) + 1;
    } else {
      depth -= 1;
      if (depth === 0) return close;
      i = close + closeNeedle.length;
    }
  }
  return -1;
}

function findMatchingDivClose(source, from) {
  return findMatchingClose(source, from, 'div');
}

/* Splits a tag's own class attribute into its space-separated tokens, the
   same way extract.mjs's classesOf() does — but written again here rather
   than imported, so a mistake in either one's parsing surfaces as a
   mismatch instead of being invisible to both. */
function classTokens(openTag) {
  const m = openTag.match(/class="([^"]*)"/);
  return m ? m[1].split(/\s+/).filter(Boolean) : [];
}

function carriesModifier(openTag) {
  return classTokens(openTag).some((c) => c !== 'paper' && c !== 'typeset');
}

const TAG_OPEN_RE = /<([a-z][a-z0-9]*)\b([^>]*)>/g;

/* Walks forward from `from` (bounded by `to`) for the first descendant tag
   whose class list carries the literal token "typeset" — the same target
   extract.mjs's own resolveTarget() descends to for two-column and
   notes.fullrow, found here independently. */
function findTypesetTag(source, from, to) {
  TAG_OPEN_RE.lastIndex = from;
  let m;
  while ((m = TAG_OPEN_RE.exec(source)) !== null && m.index < to) {
    if (classTokens(m[0]).includes('typeset')) {
      return { tag: m[1], openTag: m[0], contentStart: TAG_OPEN_RE.lastIndex };
    }
  }
  return null;
}

/* Makes the same "which element, and does it carry a modifier" decision
   extract.mjs's resolveTarget() makes, independently, and reduces it to the
   span the round trip below needs: "inner", the wrapper's untouched inner
   markup, or "container", the whole target element — open tag through
   close tag — that extractDemos() returns with "paper" dropped wherever
   the element carries a class beyond "paper" and "typeset". */
function resolveSpan(source, wrapperOpenTag, contentStart, closeIndex) {
  let el = classTokens(wrapperOpenTag).includes('typeset')
    ? { tag: 'div', openTag: wrapperOpenTag, contentStart, closeIndex }
    : null;

  if (!el) {
    const found = findTypesetTag(source, contentStart, closeIndex);
    const innerClose = found && findMatchingClose(source, found.contentStart, found.tag);
    el = (found && innerClose !== -1)
      ? { tag: found.tag, openTag: found.openTag, contentStart: found.contentStart, closeIndex: innerClose }
      : { tag: 'div', openTag: wrapperOpenTag, contentStart, closeIndex };
  }

  if (!carriesModifier(el.openTag)) {
    return { kind: 'inner', contentStart: el.contentStart, closeIndex: el.closeIndex };
  }
  return {
    kind: 'container',
    tag: el.tag,
    hadPaper: classTokens(el.openTag).includes('paper'),
    openStart: el.contentStart - el.openTag.length,
    closeIndex: el.closeIndex,
  };
}

/* Finds the same label → note → wrapper triples extract.mjs finds, but
   returns the raw span each fragment must round-trip against instead of
   processed output, so extractDemos()'s html can be spliced back into an
   otherwise untouched copy of the file. */
function locateWrapperContents(source) {
  const spans = [];
  let i = 0;
  while (true) {
    const labelOpen = source.indexOf('<p class="pair__label"', i);
    if (labelOpen === -1) break;
    const labelClose = source.indexOf('</p>', labelOpen) + '</p>'.length;

    let cursor = labelClose;
    if (/^\s*<p class="demo-note"/.test(source.slice(cursor))) {
      cursor = source.indexOf('</p>', cursor) + '</p>'.length;
    }

    const wrapperMatch = source.slice(cursor).match(/^\s*<div\b[^>]*>/);
    if (!wrapperMatch) { i = labelClose; continue; }
    const wrapperOpenTag = wrapperMatch[0].replace(/^\s*/, '');
    const contentStart = cursor + wrapperMatch[0].length;

    const closeIndex = findMatchingDivClose(source, contentStart);
    if (closeIndex === -1) { i = labelClose; continue; }

    spans.push(resolveSpan(source, wrapperOpenTag, contentStart, closeIndex));
    i = closeIndex + '</div>'.length;
  }
  return spans;
}

/* Matches extract.mjs's dedent(): a line inside a verbatim region — a <pre>,
   or an element the stylesheet gives significant whitespace — carries content
   in its leading whitespace, not markup indentation, so it is excluded from
   the shared-amount computation the same way dedent() excludes it from the
   stripping. This is reused from extract.mjs rather than re-derived, because
   it is not the boundary-finding this file keeps independent — it is the
   inverse of a specific, deterministic text transform, and a second,
   separately-maintained copy could only drift from the one it must invert. */
function commonIndent(text) {
  const lines = text.split('\n');
  const verbatim = verbatimLineMask(text);
  let common = Infinity;
  for (let i = 0; i < lines.length; i += 1) {
    if (verbatim[i] || lines[i].trim() === '') continue;
    common = Math.min(common, lines[i].match(/^ */)[0].length);
  }
  return Number.isFinite(common) ? common : 0;
}

/* The interiors that must survive extraction byte-for-byte: every <pre>, and
   every element the stylesheet gives significant whitespace. Found here with
   this file's own tag scanner rather than extract.mjs's region finder, so a
   bug in that finder surfaces as a failure instead of being agreed with.

   The class is matched by splitting the attribute into whole tokens, the way
   classTokens() above does and for the same reason src/extract.mjs documents:
   "\bts-quotes-verse\b" also matches "ts-quotes-verse-x" and
   "my-ts-quotes-verse", because a hyphen is not a word character. */
function verbatimInteriors(fragment) {
  const found = [];
  const pre = /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi;
  let m;
  while ((m = pre.exec(fragment)) !== null) found.push(m[1]);

  const openTag = /<([a-z][a-z0-9]*)\b[^>]*>/gi;
  while ((m = openTag.exec(fragment)) !== null) {
    if (!classTokens(m[0]).includes('ts-quotes-verse')) continue;
    const close = findMatchingClose(fragment, openTag.lastIndex, m[1]);
    if (close !== -1) found.push(fragment.slice(openTag.lastIndex, close));
  }
  return found;
}

/* Reverses extract.mjs's dedent: pads every non-blank, non-verbatim line
   back out by the amount it was originally indented, and leaves a verbatim
   line exactly as extractDemos() returned it. */
function reindent(fragment, amount) {
  const pad = ' '.repeat(amount);
  const lines = fragment.split('\n');
  const verbatim = verbatimLineMask(fragment);
  return lines.map((line, i) => (verbatim[i] || line === '' ? line : pad + line)).join('\n');
}

for (const file of readdirSync('src/demos').filter((f) => f.endsWith('.html'))) {
  const demoPath = `src/demos/${file}`;
  const original = readFileSync(demoPath, 'utf8');
  const demos = extractDemos(original);

  /* Both boundary-finders above share one model of HTML: neither
     distinguishes tag context from text or comment context. A wrapper
     hidden in a comment, a self-closing <div … /> that never returns the
     depth counter to zero, or a label with no wrapper right after it all
     make extractDemos() quietly drop that example — and both scanners
     agree on nothing being there, so the round-trip below stays silent.
     A literal count of "pair__label" paragraphs needs no tag-matching at
     all, so it is not subject to that shared blind spot: every demo file
     here has exactly one example per label, so any shortfall is a bug.

     Everything below reads demo.source, the fragment exactly as the file
     holds it, except the duplicate check — that one is about what the pane
     shows, so it reads demo.html, from which the apparatus is gone. */
  const labelCount = (original.match(/<p class="pair__label"/g) ?? []).length;
  if (labelCount > 0 && demos.length !== labelCount) {
    fail.push(`${demoPath}: has ${labelCount} pair__label paragraph(s) but extractDemos() `
      + `returned ${demos.length} example(s) — it dropped at least one silently`);
    continue;
  }

  /* A pane exists to show what a wrapper's own class demonstrates, so two
     labelled examples in the same file must not extract byte-identical
     markup — that would mean the wrapper carries nothing that tells them
     apart, and the pane would show the same fragment under two different
     labels (see the "justification" demo before this file's own gate). */
  const seenHtml = new Map();
  for (const demo of demos) {
    const label = demo.label ?? '(unlabelled)';
    const dupeOf = seenHtml.get(demo.html);
    if (dupeOf !== undefined) {
      fail.push(`${demoPath}: "${dupeOf}" and "${label}" extract byte-identical markup — `
        + 'the pane cannot demonstrate a difference that is not there');
    } else {
      seenHtml.set(demo.html, label);
    }
  }

  /* The round-trip below and dedent()/reindent() share verbatimLineMask():
     if the mask ever wrongly marked a verbatim line as ordinary, dedent
     would strip it, reindent would pad it back by the same amount, and the
     round-trip would agree with itself — a wrong mask can corrupt a code
     sample or a stanza and stay invisible, because neither side of that
     comparison ever consults the source file. This check does: it takes each
     verbatim interior straight out of the extracted fragment and requires it
     to occur verbatim in the demo file on disk, with no mask and no inverse
     in between.

     The two shapes are matched here by a plain tag-pair regex rather than by
     extract.mjs's own region scanner, so a bug in that scanner surfaces as a
     failure instead of being agreed with. The second arm keys on the class,
     not on the tag, so it holds if the verse demo is ever set in a different
     element; the interior is always the match's last group. */
  for (const demo of demos) {
    for (const interior of verbatimInteriors(demo.source)) {
      if (!original.includes(interior)) {
        fail.push(`${demoPath}: a verbatim interior in the extracted fragment does not `
          + 'appear verbatim in the source file — extraction altered preformatted content');
      }
    }
  }

  const spans = locateWrapperContents(original);

  if (demos.length !== spans.length) {
    fail.push(`${demoPath}: extractDemos() found ${demos.length} example(s), `
      + `the round-trip scanner found ${spans.length} — they must find the same wrappers`);
    continue;
  }

  let rebuilt = '';
  let cursor = 0;
  for (let k = 0; k < spans.length; k += 1) {
    const span = spans[k];
    if (span.kind === 'inner') {
      const { contentStart, closeIndex } = span;
      const originalContent = original.slice(contentStart, closeIndex);
      const indent = commonIndent(originalContent);
      const trailing = originalContent.slice(originalContent.lastIndexOf('\n') + 1);
      rebuilt += original.slice(cursor, contentStart)
        + `\n${reindent(demos[k].source, indent)}\n${trailing}`;
      cursor = closeIndex;
    } else {
      /* A "container" fragment is the whole target element, with "paper"
         dropped from its class attribute where it carried that class at
         all — two-column and notes.fullrow descend to an <article> that
         never did. Reversing the drop means padding every line back out
         to the element's true source indentation — found the same way
         extract.mjs finds it, as the run of spaces and tabs immediately
         before the tag — and putting "paper" back as the first class
         token wherever it was there to begin with. */
      const { tag, hadPaper, openStart, closeIndex } = span;
      const closeTagEnd = closeIndex + `</${tag}>`.length;
      let ws = openStart;
      while (ws > 0 && (original[ws - 1] === ' ' || original[ws - 1] === '\t')) ws -= 1;
      const indent = commonIndent(original.slice(ws, closeTagEnd));
      const withPaper = hadPaper
        ? demos[k].source.replace(/class="([^"]*)"/, (_, cls) => `class="paper ${cls}"`)
        : demos[k].source;
      rebuilt += original.slice(cursor, ws) + reindent(withPaper, indent);
      cursor = closeTagEnd;
    }
  }
  rebuilt += original.slice(cursor);

  if (rebuilt !== original) {
    fail.push(`${demoPath}: extractDemos() round-trip does not reproduce the file — `
      + 'the extractor lost or altered content');
  }
}

/* ---- 3e. A published pane must only name classes typeset.css defines ----- */

/* The HTML pane carries a Copy button, so its markup is a promise: paste this
   into a document that links typeset.css, and it renders as shown. A class
   that lives only in specimen.css breaks that promise silently — the pane
   still looks right on this page, because this page has specimen.css.

   Section 5 below checks the other direction, that every ts-* class in
   typeset.css has a spec element behind it. Neither implies this one: a class
   the stylesheet never defines is invisible to both.

   Only sections whose second pane is HTML are checked. tokens, foundation and
   page publish CSS instead, so their fragments are extracted and round-tripped
   but never shown, and page's wrapper legitimately carries specimen chrome. */

const cssClassNames = new Set(
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.(-?[A-Za-z_][\w-]*)/g)]
    .map((m) => m[1]));

for (const section of manifest.filter((s) => s.panel.pane === 'html')) {
  const files = [`src/demos/${section.id}.html`];
  if (section.fullrow) files.push(`src/demos/${section.id}.fullrow.html`);
  for (const file of files.filter((f) => existsSync(f))) {
    for (const demo of extractDemos(readFileSync(file, 'utf8'))) {
      const seen = new Set();
      for (const attr of demo.html.matchAll(/class="([^"]*)"/g)) {
        for (const token of attr[1].split(/\s+/).filter(Boolean)) {
          if (cssClassNames.has(token) || seen.has(token)) continue;
          seen.add(token);
          fail.push(`${file}: the pane for "${demo.label ?? section.id}" publishes `
            + `class "${token}", which typeset.css does not define — a reader who `
            + 'copies it gets markup that cannot render as shown');
        }
      }
    }
  }
}

/* ---- 3f. The scale demo's labels must be the spec's own values ----------- */

/* tokens.html names each size in text beside the sample it stands for —
   <b>24pt</b> — so the demo file reads on its own, without opening either the
   stylesheet or spec.json. That makes the label a second copy of a number
   spec.json owns, and a second copy can go stale in silence: the sample is
   set from --ts-h1 and would move with it, while the text beside it would sit
   still, in the one section whose whole subject is that the page and the
   stylesheet cannot disagree.

   The label stays literal text — templating it would buy drift-safety by
   making the demo unreadable on its own, which is the property worth keeping.
   This check is what stops a stale label shipping instead.

   Each row is bound to its step by the sample's own class: scale-h1 for h1,
   and no class at all for base, which takes the body size .typeset already
   sets. Both directions are checked, so a step that gains a row with the
   wrong label and a step that loses its row both fail. */

const SCALE_ROW_RE = /<div class="scale-row"><b>([^<]*)<\/b>\s*<span(?: class="([^"]*)")?>/g;
const scaleSteps = spec.foundation.scale.steps;
const scaleShown = new Set();

for (const [, label, sampleClass] of
     readFileSync('src/demos/tokens.html', 'utf8').matchAll(SCALE_ROW_RE)) {
  const step = (sampleClass ?? 'scale-base').replace(/^scale-/, '');
  const expected = scaleSteps[step];
  if (expected === undefined) {
    fail.push(`src/demos/tokens.html: the scale row labelled "${label}" is bound to `
      + `"${step}", which spec.foundation.scale.steps does not define`);
    continue;
  }
  scaleShown.add(step);
  if (label.trim() !== expected) {
    fail.push(`src/demos/tokens.html: the scale row for --ts-${step} is labelled `
      + `"${label.trim()}" but spec.json sets that step to "${expected}" — the label `
      + 'and the sample beside it no longer agree');
  }
}

for (const step of Object.keys(scaleSteps)) {
  if (!scaleShown.has(step)) {
    fail.push(`src/demos/tokens.html: spec.foundation.scale.steps defines "${step}" `
      + 'but the scale demo has no row for it');
  }
}

/* ---- 3d. The generated pages must be current ----------------------------- */

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
    'links', 'code-inline', 'utilities'].includes(id);
  const isTemplate = Object.keys(spec.templates).includes(id);
  if (!spec.sections.some((s) => s.id === id) && !isFoundation && !isTemplate) {
    warn.push(`typeset.css: section "${id}" has no counterpart in spec.json`);
  }
}
const noTypst = spec.sections.filter((s) => !typIds.has(s.id)).map((s) => s.id);
if (noTypst.length) warn.push(`typeset.typ: no marked region for ${noTypst.join(', ')} (the page falls back to a pointer or a note)`);

/* ---- 3e. The iA Writer template ----------------------------------------- */

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

   Not every element can carry a class. Many are styled through a bare
   semantic selector (h1, strong, sub), and a few describe a rule rather than
   a selector at all: justification-exclusions says what is never justified,
   numbering-h2 is counter-generated content with no element to mark. A class
   is a name and a handle, not a requirement — so the gate accepts either, and
   checks that the canonical name is *present where a reader editing that rule
   will see it*, not that a class exists.

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
   a class attribute, so a misspelling in a demo, an example, a proof, a
   template or a script renders unstyled and reports nothing.

   The predicate for a document is resolution, not naming: the class must
   appear as a selector in one of the stylesheets. Naming a spec element is
   too weak, because most of an element's names reach it through a bare
   semantic selector and never become a class — so a document writing one of
   those names matches no rule at all while satisfying a check that asked only
   whether the name existed. */

/* Chrome for the specimen page: these dress a demo so it reads in a browser
   and never appear in a document, so they are the only .ts- selectors
   specimen.css may carry with no spec element behind them. */
const SPECIMEN_CHROME = new Set(['ts-toc--demo', 'ts-folio']);

/* A class name is written in three shapes across these files: a class
   attribute, a selector, and a bare quoted token in a script or in JSON
   prose. The attribute pattern reads escaped quotes too, because the site
   manifest carries markup inside JSON strings. */
const classesIn = (text) => new Set([
  ...[...text.replace(/\\"/g, '"').matchAll(/class=["']([^"']*)["']/g)]
    .flatMap((m) => m[1].trim().split(/\s+/)),
  ...[...text.matchAll(/\.(ts-[a-z0-9-]+)/g)].map((m) => m[1]),
  ...[...text.matchAll(/['"`](ts-[a-z0-9-]+)['"`]/g)].map((m) => m[1]),
].filter((c) => c.startsWith('ts-')));

const documentFiles = ['specimen.css', 'src/sections.json'];
const collectDocuments = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) collectDocuments(path);
    else if (/\.(html|css|js)$/.test(path)) documentFiles.push(path);
  }
};
for (const dir of ['src/demos', 'examples', 'proofs', 'implementations/iawriter']) {
  collectDocuments(dir);
}

const sheets = ['typeset.css', ...documentFiles.filter((f) => f.endsWith('.css'))];
const definedSelectors = new Set(sheets.flatMap((f) =>
  [...readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.(ts-[a-z0-9-]+)/g)]
    .map((m) => m[1])));

for (const path of documentFiles) {
  const used = classesIn(readFileSync(path, 'utf8'));
  for (const cls of used) {
    /* A stylesheet's own .ts- occurrences are mostly definitions, so asking
       whether they resolve is circular — they are held to the spec instead,
       the way the gate above holds typeset.css. */
    if (sheets.includes(path)) {
      if (specIds.has(cls.replace(/^ts-/, ''))) continue;
      if (INTERNAL_CLASSES.has(cls) || SPECIMEN_CHROME.has(cls)) continue;
      fail.push(`${path}: .${cls} is a selector with no spec element behind it`);
    } else {
      if (definedSelectors.has(cls)) continue;
      fail.push(`${path}: ${cls} matches no .ts- selector in any stylesheet, so it renders unstyled`);
    }
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
  /* document and template entry points */
  'typeset', 'two-column', 'span',
  /* ts-table implements element tables-table under its 1.x spelling, which the
     migration note discloses; epigraph-right has no element behind it at all */
  'ts-table', 'epigraph-right',
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
