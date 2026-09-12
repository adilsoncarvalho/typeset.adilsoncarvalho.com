/* Verifies that the implementations still match spec.json, and that the site
   can render every section. spec.json is normative: a mismatch means the
   implementation is broken, not the spec.
   Run: node tools/check.mjs */

import { readFileSync, existsSync, readdirSync, writeFileSync, rmSync, mkdtempSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildAll } from './build-site.mjs';
import { extractDemos, verbatimLineMask } from '../src/extract.mjs';
import { APPARATUS_ELEMENTS, APPARATUS_CLASSES } from '../src/extract.mjs';
import { typstBoilerplate, typstDocument } from '../src/boilerplate.mjs';

const spec = JSON.parse(readFileSync('spec.json', 'utf8'));
const css = readFileSync('typeset.css', 'utf8');
const typ = readFileSync('implementations/typeset.typ', 'utf8');
const html = readFileSync('index.html', 'utf8');
const specMd = readFileSync('SPEC.md', 'utf8');

const fail = [];
const warn = [];

/* Prints every accumulated failure and stops. Used both where a missing demo
   file would otherwise crash a later step instead of reporting cleanly, and
   at the end of a clean run. */
function reportFailuresAndExit() {
  console.error(`\n${fail.length} conformance failure${fail.length > 1 ? 's' : ''}:`);
  for (const f of fail) console.error(`  ✗ ${f}`);
  process.exit(1);
}

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
   implementations must actually constrain it — not just declare the page.
   Gate 9 checks that measure-standard's own value tracks spec.json; this
   checks that typeset()'s default parameter actually applies that binding,
   rather than a hand-copied literal a future edit could drift from it. */
if (!typ.includes('measure: measure-standard,')) {
  fail.push("typeset.typ: typeset()'s default measure is not measure-standard — "
    + 'the flow would fill the full text width, or use an untracked literal');
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

/* Tracked separately from fail[] so the check below can stop before
   buildAll(): section() there reads every manifest section's demo files
   unconditionally, and a missing one crashes it with a raw ENOENT instead of
   the message this gate already produced. */
let missingDemo = false;

for (const s of manifest) {
  const demo = `src/demos/${s.id}.html`;
  if (!existsSync(demo)) { fail.push(`${demo} is missing`); missingDemo = true; }
  if (s.fullrow && !existsSync(`src/demos/${s.id}.fullrow.html`)) {
    fail.push(`src/demos/${s.id}.fullrow.html is declared but missing`);
    missingDemo = true;
  }
}
const declared = new Set(manifest.map((s) => s.id));
for (const f of readdirSync('src/demos').filter((f) => f.endsWith('.html'))) {
  const id = f.replace(/\.(fullrow\.)?html$/, '');
  if (!declared.has(id)) warn.push(`src/demos/${f} is not referenced by src/sections.json`);
}

/* ---- 3g. Every manifest section must have a Typst snippet, and vice versa */

/* src/demos/<id>.typ is the fragment a reader would drop into a document
   that imports typeset.typ — the third tab's counterpart to the HTML/CSS
   pane checked above. Keyed on section ids, not filenames: notes.fullrow.html
   is a second HTML demo for the "notes" section, not a second section, and
   src/demos now holds both file types side by side. */

for (const s of manifest) {
  const snippet = `src/demos/${s.id}.typ`;
  if (!existsSync(snippet)) {
    fail.push(`${snippet}: no Typst snippet for section "${s.id}"`);
    missingDemo = true;
  }
}
for (const f of readdirSync('src/demos').filter((f) => f.endsWith('.typ'))) {
  const id = f.replace(/\.typ$/, '');
  if (!declared.has(id)) warn.push(`src/demos/${f} is not referenced by src/sections.json`);
}

/* Stop here, before anything below reaches a missing file: buildAll() (3d)
   reads every manifest section's demo files unconditionally, so it would
   crash on the same file this gate just reported missing, with a raw stack
   trace instead of this gate's own message. */
if (missingDemo) reportFailuresAndExit();

/* ---- 3h. Every Typst snippet must compile under the PUBLISHED boilerplate  */

/* A snippet is a fragment — no import — the same decision the HTML demos make
   about publishing markup rather than a full document. What a reader adds
   above it is the masthead's boilerplate block, and this compiles exactly
   that: src/boilerplate.mjs composes the document here and renders the block
   there, so a snippet cannot pass this gate under an import the page never
   prints. A private harness would only prove that some environment works.

   The compile happens in a system temp directory holding a copy of
   typeset.typ, because that is a reader's own directory: the import the
   masthead prints is the relative `typeset.typ`, and it has to resolve to a
   sibling file for the published text to be literally what is compiled.
   Nothing is written into the repository, so a run that is interrupted leaves
   no scratch file behind in a tracked directory. */

function typstAvailable() {
  try {
    execFileSync('typst', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const typstSnippets = readdirSync('src/demos').filter((f) => f.endsWith('.typ'));

if (typstSnippets.length > 0 && !typstAvailable()) {
  console.error('typst is not on PATH — cannot verify that the Typst snippets compile.');
  console.error('Install typst (https://typst.app) and re-run node tools/check.mjs.');
  process.exit(1);
}

if (typstSnippets.length > 0) {
  const readerDir = mkdtempSync(join(tmpdir(), 'typeset-check-'));
  copyFileSync('implementations/typeset.typ', join(readerDir, 'typeset.typ'));
  const fontPath = resolve('fonts');
  for (const file of typstSnippets) {
    const snippetPath = `src/demos/${file}`;
    const docPath = join(readerDir, `doc-${file}`);
    writeFileSync(docPath, typstDocument(readFileSync(snippetPath, 'utf8')));
    try {
      execFileSync(
        'typst',
        ['compile', '--font-path', fontPath, docPath, join(readerDir, `${file}.pdf`)],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch (err) {
      const detail = (err.stderr ? err.stderr.toString() : String(err.message)).trim();
      fail.push(`${snippetPath} does not compile under the boilerplate the masthead `
        + `publishes:\n${detail}`);
    }
  }
  rmSync(readerDir, { recursive: true, force: true });
}

/* Every class name typeset.css defines, comment text excluded. Read once here
   because two gates need it from opposite directions: the apparatus check in
   3c holds what is stripped OUT of a pane against it, and 3e holds what is
   left IN. */
const cssClassNames = new Set(
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.(-?[A-Za-z_][\w-]*)/g)]
    .map((m) => m[1]));

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

/* The apparatus the specimen page adds inside a demo's document markup, named
   here rather than imported from extract.mjs. That duplication is the point:
   the pane publishes demo.html, which is demo.source with these names taken
   out, and a gate that read extract.mjs's own list would agree with whatever
   that list happened to say. Adding a document class to it — ts-callouts-title,
   say — would then strip real styling out of every published pane and this
   file would still print "all checks passed".

   Adding apparatus is therefore a two-file change, and the second file is the
   gate. The check below it holds the same two lists to what apparatus means:
   furniture this website adds, which typeset.css never defines. */
const SPECIMEN_ELEMENTS = ['demo-note', 'demo-print-note', 'ts-folio'];
const SPECIMEN_CLASSES = ['demo-aside', 'ts-toc--demo'];

/* Rebuilds the published fragment from the extracted one: apparatus elements
   come out whole, apparatus classes come off the elements that keep their
   place, and a line left holding nothing but its own indent goes with them.
   Element removal runs first, so a class list naming one of each resolves as
   the element it is. Boundaries are found with this file's own indexOf
   scanner, not extract.mjs's regex one. */
function stripSpecimenApparatus(fragment) {
  let out = fragment;
  for (;;) {
    const openTag = /<([a-z][a-z0-9]*)\b[^>]*>/gi;
    let cut = null;
    let m;
    while ((m = openTag.exec(out)) !== null) {
      if (!classTokens(m[0]).some((c) => SPECIMEN_ELEMENTS.includes(c))) continue;
      const close = findMatchingClose(out, openTag.lastIndex, m[1]);
      if (close === -1) break;
      cut = [m.index, close + `</${m[1]}>`.length];
      break;
    }
    if (!cut) break;
    out = out.slice(0, cut[0]) + out.slice(cut[1]);
  }

  out = out.replace(/(\s*)class="([^"]*)"/g, (whole, space, cls) => {
    const kept = cls.split(/\s+/).filter(Boolean).filter((c) => !SPECIMEN_CLASSES.includes(c));
    return kept.length ? `${space}class="${kept.join(' ')}"` : '';
  });

  return out.split('\n').filter((line) => !/^[ \t]+$/.test(line)).join('\n')
    .replace(/^\n+/, '').replace(/\n+$/, '');
}

/* Apparatus is this website's own furniture, so typeset.css — the stylesheet a
   reader links — must not define it. A name on either list that typeset.css
   does define is document styling, and stripping it hands the reader markup
   that renders differently from the example beside it. This is the inverse of
   3e below, which holds what the pane publishes to the same stylesheet: that
   one cannot see a removal, and this one cannot see an addition. */
for (const name of [...APPARATUS_ELEMENTS, ...APPARATUS_CLASSES]) {
  if (cssClassNames.has(name)) {
    fail.push(`src/extract.mjs: "${name}" is stripped from every published pane as `
      + 'apparatus, but typeset.css defines it — it is document styling, and a reader '
      + 'who copies the pane gets markup that renders differently from the example');
  }
}

/* Where two texts first stop agreeing, as a line and column with what each
   side holds from there. A demo file runs to dozens of lines of dense markup,
   so "the extractor lost or altered content" on its own leaves a reader
   diffing by eye for a change that is usually one character. */
function firstDifference(expected, actual) {
  let i = 0;
  while (i < expected.length && i < actual.length && expected[i] === actual[i]) i += 1;
  const before = expected.slice(0, i);
  const line = before.split('\n').length;
  const column = i - (before.lastIndexOf('\n') + 1) + 1;
  const show = (text) => JSON.stringify(text.slice(i, i + 40)) + (text.length > i + 40 ? '…' : '');
  return `at line ${line}, column ${column}:\n      file       ${show(expected)}`
    + `\n      round trip ${show(actual)}`;
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

  /* The pane publishes demo.html, not demo.source, so the round trip below —
     which reconstructs the file from demo.source — proves nothing about what a
     reader actually copies. This closes that gap: it rebuilds the published
     fragment from the extracted one using this file's own apparatus lists, and
     requires the result to be what extractDemos() returned. Any difference
     between the two artifacts must therefore be attributable to a name
     SPECIMEN_ELEMENTS or SPECIMEN_CLASSES declares, and a name only
     extract.mjs knows about fails here instead of silently thinning the pane. */
  for (const demo of demos) {
    const expected = stripSpecimenApparatus(demo.source);
    if (demo.html !== expected) {
      fail.push(`${demoPath}: the pane for "${demo.label ?? '(unlabelled)'}" is not the `
        + 'extracted fragment with the declared apparatus removed — extract.mjs took out '
        + 'something tools/check.mjs does not know is apparatus, or left something in');
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
      + `the extractor lost or altered content ${firstDifference(original, rebuilt)}`);
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

/* ---- 3f. The scale demos' labels must be the spec's own values ----------- */

/* Both tokens demos name each size in text beside the sample it stands for —
   <b>24pt</b> in the HTML, [24pt] in the Typst — so each file reads on its own,
   without opening a stylesheet or spec.json. That makes every label a second
   copy of a number spec.json owns, and a second copy can go stale in silence:
   the sample is set from the step and moves with it, while the text beside it
   sits still, in the one section whose whole subject is that the page and the
   implementations cannot disagree.

   The labels stay literal text — templating them would buy drift-safety by
   making the demos unreadable on their own, which is the property worth
   keeping. This check is what stops a stale label shipping instead.

   Both directions are checked for each file, so a step that gains a row with
   the wrong label and a step that loses its row both fail. */

const scaleSteps = spec.foundation.scale.steps;

const SCALE_DEMOS = [
  {
    /* A row is bound to its step by the sample's own class: scale-h1 for h1,
       and no class at all for base, which takes the body size .typeset already
       sets. Binding on the class rather than on row order means reordering the
       rows, which is a legitimate edit, cannot silently re-point every label. */
    file: 'src/demos/tokens.html',
    re: /<div class="scale-row"><b>([^<]*)<\/b>\s*<span(?: class="([^"]*)")?>/g,
    step: (m) => (m[2] ?? 'scale-base').replace(/^scale-/, ''),
    label: (m) => m[1],
    names: (step) => `--ts-${step}`,
  },
  {
    /* A row names its step directly, as a field of the scale the template
       supplies. */
    file: 'src/demos/tokens.typ',
    re: /\(scale-single-column\.([a-z0-9]+),\s*\[([^\]]*)\]/g,
    step: (m) => m[1],
    label: (m) => m[2],
    names: (step) => `scale-single-column.${step}`,
  },
];

for (const demo of SCALE_DEMOS) {
  const shown = new Set();
  for (const m of readFileSync(demo.file, 'utf8').matchAll(demo.re)) {
    const step = demo.step(m);
    const label = demo.label(m).trim();
    const expected = scaleSteps[step];
    if (expected === undefined) {
      fail.push(`${demo.file}: the scale row labelled "${label}" is bound to `
        + `"${step}", which spec.foundation.scale.steps does not define`);
      continue;
    }
    shown.add(step);
    if (label !== expected) {
      fail.push(`${demo.file}: the scale row for ${demo.names(step)} is labelled `
        + `"${label}" but spec.json sets that step to "${expected}" — the label `
        + 'and the sample beside it no longer agree');
    }
  }

  for (const step of Object.keys(scaleSteps)) {
    if (!shown.has(step)) {
      fail.push(`${demo.file}: spec.foundation.scale.steps defines "${step}" `
        + 'but the scale demo has no row for it');
    }
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

/* The two-column derivation is arithmetic, so recompute it — from foundation.page,
   which is where the paper and the margins live. Reading the derivation's own
   declarations back would only prove that they agree with themselves, and every
   number below is a function of the page: move a margin and either these follow
   or this goes red. The one number the derivation still chooses is the gutter. */
const two = spec.templates['two-column'];
if (two) {
  const d = two.derivation;
  const page = spec.foundation.page;
  const rhythm = spec.foundation.rhythm;
  const papers = page.sizes_mm;
  const symmetric = page.margins.symmetric_mm;
  const paper = page.size;
  const marginName = page.margins.default;

  /* Characters per millimetre at the 11pt base, taken from the foundation
     measure: 66 characters in 128mm. Every count in the template is this
     scaled by the column width and by the ratio of 11pt to the base in use. */
  const perMm = rhythm.measure_chars / rhythm.measure_mm;
  const columnMm = (paperName, margin) => (papers[paperName][0] - 2 * symmetric[margin] - d.column_gap_mm) / 2;
  const charsIn = (colMm, basePt) => Math.round(perMm * colMm * (11 / basePt));
  const basePt = parseFloat(two.scale.base);

  if (!papers[paper]) {
    fail.push(`spec.json: foundation.page.size is "${paper}", which foundation.page.sizes_mm does not list`);
  } else if (!(marginName in symmetric)) {
    fail.push(`spec.json: foundation.page.margins.default is "${marginName}", which symmetric_mm does not name`);
  } else {
    const col = columnMm(paper, marginName);
    const margin = symmetric[marginName];
    const arithmetic = `${paper} ${papers[paper][0]}mm at ${marginName} ${margin}mm leaves ${papers[paper][0] - 2 * margin}mm of text, so a column is (${papers[paper][0] - 2 * margin} - ${d.column_gap_mm}) / 2 = ${col}mm`;

    if (Math.abs(col - d.column_width_mm) > 0.5) {
      fail.push(`spec.json: two-column derivation.column_width_mm is ${d.column_width_mm}mm — ${arithmetic}`);
    }
    if (two.page.column_gap_mm !== d.column_gap_mm) {
      fail.push(`spec.json: two-column page.column_gap_mm is ${two.page.column_gap_mm}mm, derivation.column_gap_mm is ${d.column_gap_mm}mm`);
    }
    if (Math.abs(col - two.page.column_width_mm) > 0.5) {
      fail.push(`spec.json: two-column page.column_width_mm is ${two.page.column_width_mm}mm — ${arithmetic}`);
    }

    for (const [size, stated] of Object.entries(d.characters_per_line)) {
      const computed = charsIn(col, parseFloat(size));
      if (computed !== stated) {
        fail.push(`spec.json: two-column characters_per_line[${size}] is ${stated}, but a ${col}mm column carries ${computed} — ${arithmetic}`);
      }
    }

    /* The floor is the point of the whole derivation: a combination that cannot
       reach it is refused rather than set badly. The refusal is computed, so a
       paper added to sizes_mm is covered on the day it is added. */
    const atBase = charsIn(col, basePt);
    if (two.rhythm.measure_chars !== atBase) {
      fail.push(`spec.json: two-column rhythm.measure_chars is ${two.rhythm.measure_chars}, but a ${col}mm column at ${two.scale.base} carries ${atBase}`);
    }
    const viable = Object.keys(symmetric).filter((m) => charsIn(columnMm(paper, m), basePt) >= d.floor);
    if (atBase < d.floor) {
      const alternatives = viable.length
        ? `${viable.join(' and ')} would reach it`
        : `no named margin on ${paper} reaches it — this paper cannot carry two columns at ${two.scale.base}`;
      fail.push(`spec.json: two columns are refused on ${paper} at the ${marginName} margin — a ${col}mm column at ${two.scale.base} carries ${atBase} characters, below the ${d.floor} floor (${arithmetic}; ${alternatives})`);
    }
    const declared = d.margins_supported;
    if (declared.join(',') !== viable.join(',')) {
      const shown = viable.map((m) => `${m} ${columnMm(paper, m)}mm ${charsIn(columnMm(paper, m), basePt)}ch`).join(', ');
      fail.push(`spec.json: two-column margins_supported is [${declared.join(', ')}], but on ${paper} at ${two.scale.base} the margins reaching the ${d.floor}-character floor are [${viable.join(', ')}] (${shown || 'none'})`);
    }

    /* CSS cannot refuse a paper/margin combination the way Typst panics on one:
       nothing stops a document combining typeset--two-column with a margin
       class outside margins_supported, and the columns render anyway, silently
       below the floor. Scan every demo and example for that combination
       instead, on the class attribute that actually carries both classes
       together — reading the supported sizes from the spec, not repeating them
       here, so a paper or floor change moves this check with it. */
    const marginClassSize = (cls) => cls.match(/^typeset--margin-(?:duplex-)?(narrow|standard|wide)$/)?.[1] ?? null;
    for (const dir of ['src/demos', 'examples']) {
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.html'))) {
        const path = `${dir}/${file}`;
        for (const attr of readFileSync(path, 'utf8').matchAll(/class="([^"]*)"/g)) {
          const tokens = attr[1].split(/\s+/).filter(Boolean);
          if (!tokens.includes('typeset--two-column')) continue;
          for (const token of tokens) {
            const size = marginClassSize(token);
            if (size === null || d.margins_supported.includes(size)) continue;
            const col = columnMm(paper, size);
            const chars = charsIn(col, basePt);
            fail.push(`${path}: "${token}" combines typeset--two-column with a margin `
              + `templates.two-column.derivation.margins_supported does not list — `
              + `[${d.margins_supported.join(', ')}] on ${paper} — a ${size} margin `
              + `leaves a ${col}mm column, carrying ${chars} characters at ${two.scale.base}, `
              + `below the ${d.floor}-character floor`);
          }
        }
      }
    }

    /* Lines per column comes off the same page box, through the template's own
       baseline advance. Top and bottom take the symmetric value on either
       margin style, so one number covers both. */
    const advanceMm = parseFloat(two.rhythm.baseline_advance) * (25.4 / 72);
    const textHeight = papers[paper][1] - 2 * margin;
    const lines = Math.floor(textHeight / advanceMm);
    if (two.page.lines_per_column !== lines) {
      fail.push(`spec.json: two-column lines_per_column is ${two.page.lines_per_column}, but ${paper} at ${marginName} ${margin}mm leaves ${textHeight}mm and a ${two.rhythm.baseline_advance} advance is ${advanceMm.toFixed(3)}mm, so ${lines} lines fit`);
    }
  }

  const advance = +(basePt * two.rhythm.line_height).toFixed(2);
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

/* ---- 3i. The iA Writer template ----------------------------------------- */

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

/* ---- 3j. The page-setup demo's margin labels and diagram must be the spec's
           own values ---------------------------------------------------- */

/* src/demos/page.html draws a diagram of the default page and labels the
   margin twice in text beside it — once on the gauge, once in the caption —
   for the same reason the scale demos' labels are checked in 3f above: the
   diagram is drawn from a percentage that moves with the margin, while
   these two labels are literal text that would not, and a literal label is
   a second copy of a value spec.json owns. Both directions matter here just
   as they do in 3f, so a margin that gains a new default name and a label
   that is simply never updated both fail.

   The diagram itself is drawn in specimen.css, not in the demo file, as the
   `.pagemap__margins` inset — a percentage of the A4 sheet, one axis per
   side. That geometry is checked here too, independently against
   foundation.page.sizes_mm, rather than trusted because the labels beside
   it happen to read correctly: a label is typed text and the inset is a
   separately-maintained CSS rule, so nothing stops one from moving without
   the other, and only checking the label leaves exactly this diagram
   uncovered. This is why the failure messages below can honestly end
   "the label and the diagram no longer agree" — every one of label, caption
   and inset is checked against spec.json independently, so a wrong diagram
   drawn against a correctly-labelled margin is caught here rather than
   inferred from the label having passed. */

{
  const marginName = spec.foundation.page.margins.default;
  const marginMm = spec.foundation.page.margins.symmetric_mm[marginName];
  const paper = spec.foundation.page.size;
  const [paperWidthMm, paperHeightMm] = spec.foundation.page.sizes_mm[paper];
  const pageDemo = readFileSync('src/demos/page.html', 'utf8');

  const gaugeLabel = pageDemo.match(/<span class="pagemap__gauge-label">([^<]*)<\/span>/)?.[1];
  const expectedGauge = `${marginMm}mm`;
  if (gaugeLabel !== expectedGauge) {
    fail.push(`src/demos/page.html: the margin gauge is labelled "${gaugeLabel}" but `
      + `spec.json's default margin (foundation.page.margins.default = "${marginName}") `
      + `is ${expectedGauge} — the label and the diagram no longer agree`);
  }

  const caption = pageDemo.match(/<div class="pagemap__caption">([^<]*)<\/div>/)?.[1];
  const expectedCaption = `${paper} · ${expectedGauge}, symmetric`;
  if (caption !== expectedCaption) {
    fail.push(`src/demos/page.html: the page caption reads "${caption}" but `
      + `spec.json's default page is "${expectedCaption}" — the label and the `
      + 'diagram no longer agree');
  }

  /* The inset is declared to one decimal place, so the closest a correctly
     rounded value can sit from the exact percentage is 0.05 points either
     way. 0.06 clears that rounding slack with a little headroom for
     floating-point noise, while staying far tighter than the gap a doubled
     margin opens up (single-digit points) — so a correctly rounded value
     always passes and a margin drawn at roughly twice the real one always
     fails. */
  const TOLERANCE_PCT = 0.06;

  const inset = readFileSync('specimen.css', 'utf8')
    .match(/\.pagemap__margins\s*\{[^}]*\binset:\s*([\d.]+)%\s+([\d.]+)%/);
  const expectedVerticalPct = (marginMm / paperHeightMm) * 100;
  const expectedHorizontalPct = (marginMm / paperWidthMm) * 100;

  if (!inset) {
    fail.push('specimen.css: no .pagemap__margins inset found — the page-setup diagram cannot be checked');
  } else {
    const verticalPct = Number(inset[1]);
    const horizontalPct = Number(inset[2]);
    if (Math.abs(verticalPct - expectedVerticalPct) > TOLERANCE_PCT
      || Math.abs(horizontalPct - expectedHorizontalPct) > TOLERANCE_PCT) {
      fail.push(`specimen.css: .pagemap__margins inset is "${verticalPct}% ${horizontalPct}%" but `
        + `spec.json's default margin (${marginMm}mm on ${paper}, ${paperWidthMm}×${paperHeightMm}mm) `
        + `draws as "${expectedVerticalPct.toFixed(1)}% ${expectedHorizontalPct.toFixed(1)}%" — `
        + 'the label and the diagram no longer agree');
    }
  }

  /* .pagemap__margins was the only sibling checked here, because it was the
     one the diagram gate was written for. Three others in the same
     stylesheet carry the same margin-derived geometry: .pagemap__lines
     (left/right, the same horizontal inset) and .pagemap__gauge
     (top/bottom, the same vertical inset) were updated by hand and are
     correct; .mini__sheet — the scaled full-page preview .pagemap does not
     itself replace, used by src/demos/two-column.html and
     src/demos/notes.fullrow.html — was not, and pads the 1.x page (25mm
     22mm 25mm 28mm) while the prose beside it now reads 170mm text width. */
  const specimenCss = readFileSync('specimen.css', 'utf8');
  const blockOf = (selector) => specimenCss.match(new RegExp(`${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`))?.[1];

  const linesBlock = blockOf('.pagemap__lines');
  if (!linesBlock) {
    fail.push('specimen.css: no .pagemap__lines block found — the page-setup diagram cannot be checked');
  } else {
    const left = Number(linesBlock.match(/\bleft:\s*([\d.]+)%/)?.[1]);
    const right = Number(linesBlock.match(/\bright:\s*([\d.]+)%/)?.[1]);
    if (Math.abs(left - expectedHorizontalPct) > TOLERANCE_PCT || Math.abs(right - expectedHorizontalPct) > TOLERANCE_PCT) {
      fail.push(`specimen.css: .pagemap__lines is left: ${left}% right: ${right}%, but spec.json's `
        + `default margin draws as ${expectedHorizontalPct.toFixed(1)}% horizontally — the diagram's `
        + 'text block no longer agrees with .pagemap__margins');
    }
  }

  const gaugeBlock = blockOf('.pagemap__gauge');
  if (!gaugeBlock) {
    fail.push('specimen.css: no .pagemap__gauge block found — the page-setup diagram cannot be checked');
  } else {
    const top = Number(gaugeBlock.match(/\btop:\s*([\d.]+)%/)?.[1]);
    const bottom = Number(gaugeBlock.match(/\bbottom:\s*([\d.]+)%/)?.[1]);
    if (Math.abs(top - expectedVerticalPct) > TOLERANCE_PCT || Math.abs(bottom - expectedVerticalPct) > TOLERANCE_PCT) {
      fail.push(`specimen.css: .pagemap__gauge is top: ${top}% bottom: ${bottom}%, but spec.json's `
        + `default margin draws as ${expectedVerticalPct.toFixed(1)}% vertically — the gauge no longer `
        + 'points at the margin it is labelling');
    }
  }

  /* .mini__sheet is plain mm padding, not a percentage — the comment above
     the rule says why: "real A4 at real point sizes, scaled down". Parsed
     as a CSS box shorthand (1-4 values) rather than assumed to be a single
     value, so a future asymmetric mistake is caught on whichever side it's
     on, not just when the shorthand happens to collapse to one number. */
  const sheetBlock = blockOf('.mini__sheet');
  if (!sheetBlock) {
    fail.push('specimen.css: no .mini__sheet block found — the page preview cannot be checked');
  } else {
    const paddingValue = sheetBlock.match(/\bpadding:\s*([^;]+);/)?.[1];
    const tokens = paddingValue?.trim().split(/\s+/) ?? [];
    const mmTokens = tokens.map((t) => (/^[\d.]+mm$/.test(t) ? parseFloat(t) : null));
    const [a, b = a, c = a, d = b] = mmTokens;
    const sides = { top: a, right: b, bottom: c, left: d };
    if (tokens.length === 0 || tokens.length > 4 || mmTokens.some((v) => v === null)) {
      fail.push(`specimen.css: .mini__sheet's padding ("${paddingValue}") is not a plain 1-4-value mm `
        + 'box shorthand this check can compare to spec.json');
    } else {
      const wrong = Object.entries(sides).filter(([, v]) => Math.abs(v - marginMm) > 0.01);
      if (wrong.length > 0) {
        fail.push(`specimen.css: .mini__sheet padding is "${paddingValue}" (${wrong.map(([s, v]) => `${s}: ${v}mm`).join(', ')} `
          + `≠ ${marginMm}mm) — spec.json's default margin (foundation.page.margins.default = `
          + `"${marginName}") is symmetric at ${marginMm}mm, but the site's page preview still pads `
          + 'an old, asymmetric margin');
      }
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

/* Observes the exported Typst surface. Every symbol is a named style, is
   written down here as internal, or is mapped in IMPLEMENTS below as an
   author-facing name for a spec element — so a new export has to be a
   deliberate choice among the three. This set is only for a symbol with no
   spec element behind it at all; one that implements an element under a
   different name belongs in IMPLEMENTS instead, never here. */
const INTERNAL_SYMBOLS = new Set([
  /* the palette, the scales and the spacing unit a template reads */
  'ink', 'ink-muted', 'ink-faint', 'rule-color', 'rule-strong', 'wash', 'accent',
  'serif', 'sans', 'mono',
  'scale-single-column', 'scale-two-column', 'base-size', 'sm', 'xs', 'sp',
  /* the page: six named margins and the paper table they apply to */
  'margin-narrow', 'margin-standard', 'margin-wide',
  'margin-duplex-narrow', 'margin-duplex-standard', 'margin-duplex-wide',
  'paper-sizes-mm',
  /* the measure: three named widths, the derived full-text-block width, and
     the function that applies one */
  'measure-standard', 'measure-narrow', 'measure-wide', 'measure-full', 'measured',
  /* helpers the styles are built from */
  'leading-for', 'smcp', 'oldstyle', 'lining', 'tabular', '_break-mark',
  /* the spacing/indent pair behind typeset()'s own `indented` option AND
     block-spaced/block-indented below — not a style itself */
  '_paragraphs-rule',
  /* document and template entry points */
  'typeset', 'two-column', 'span',
  /* two-column's own spanning.always state, read by frontmatter-title-block,
     frontmatter-abstract and frontmatter-colophon — not a style itself */
  'ts-two-column-body',
  /* epigraph-right has no element behind it at all */
  'epigraph-right',
]);

/* Symbols named for what they do rather than for the spec element id they
   implement — an author-facing name, not the spec's own taxonomy, and (for
   block-spaced/block-indented) a name that does not have to change the day
   paragraphs-* is renamed to paragraph-*. This is NOT the same list as
   INTERNAL_SYMBOLS: every value here is a real implements-relationship, so a
   symbol belongs in exactly one of the two lists, never both. Gated below:
   every value must resolve to an id spec.json actually declares, or a typo
   here would silence a real "no symbol" coverage warning forever. */
const IMPLEMENTS = new Map([
  ['block-spaced', 'paragraphs-spaced'],
  ['block-indented', 'paragraphs-indented'],
  /* ts-table implements element tables-table under its 1.x spelling, which
     the migration note discloses. */
  ['ts-table', 'tables-table'],
  /* key is the author-facing name for inline-kbd — the owner asked for it
     by that name, and an author reaching for a keycap does not know the
     spec's own element id. */
  ['key', 'inline-kbd'],
  /* The block-level overrides for the document's own `justified` default —
     named for the choice they make, not for the spec's own
     justification-justified/justification-ragged element ids. */
  ['justified', 'justification-justified'],
  ['ragged-right', 'justification-ragged'],
  /* reference composes one entry — the author-facing name for
     bibliography-entry, an author reaching for it thinks "a reference", not
     "the spec's bibliography-entry id". */
  ['reference', 'bibliography-entry'],
  /* references renders the literal bibliography-heading content (a real
     level-2 heading) and also sets up the entries' shared typography — it is
     not only the heading, but the heading is the one piece of it that is a
     spec element in its own right and needs a name resolving to one, the
     same shape as ts-table above. */
  ['references', 'bibliography-heading'],
]);

for (const [sym, id] of IMPLEMENTS) {
  if (!specIds.has(id)) {
    fail.push(`tools/check.mjs: IMPLEMENTS maps "${sym}" to "${id}", which spec.json does not `
      + 'declare as an element id — a typo here would silence a real "no symbol or marker '
      + 'region" coverage warning forever');
  }
}

for (const sym of typSymbols) {
  if (INTERNAL_SYMBOLS.has(sym) || specIds.has(sym) || IMPLEMENTS.has(sym)) continue;
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
const implementedIds = new Set(IMPLEMENTS.values());
for (const id of specIds) {
  if (!typSymbols.has(id) && !implementedIds.has(id) && !new RegExp(`//\\s*@s\\s+${id}\\s*\\n`).test(typ))
    warn.push(`typeset.typ: no symbol or marker region named "${id}"`);
}

/* ---- 6. templates.two-column.spanning.always must actually span, in both - */

/* spanning.always is element ids (see the block's own note in spec.json),
   because it is the one arm of `spanning` this checker can hold both
   implementations to; `optional` and `never` stay prose describing author
   choice and default flow, which nothing enforces.

   This gate asserts the whole property per element — left edge at the page
   margin, width equal to the full text width, and vertical position at the
   top or the bottom of the page, never mid-column, which templates.two-column.requirements
   demands — rather than one axis each. Two rounds of adversarial review each
   found a single-token mutation that passed a gate asserting only part of
   the property (an ancestor swap the selector-substring check never saw; a
   width-only check blind to an element rendered at the wrong x). A pile of
   one-axis assertions can always be walked around one axis at a time; this
   gate does not leave an axis unchecked to walk around. */
const spanningAlways = spec.templates['two-column'].spanning.always;

for (const id of spanningAlways) {
  if (!specIds.has(id)) {
    fail.push(`spec.json: templates.two-column.spanning.always names "${id}", which is not a spec element id`);
  }
}

/* Every geometry number below comes from spec.json — paper size and margin
   included, so the probe's own page setup cannot drift from the numbers the
   gate checks it against. */
const mmToPt = (mm) => mm * 72 / 25.4;
const twoColumnTemplate = spec.templates['two-column'];
const twoColumnDerivation = twoColumnTemplate.derivation;
const paperName = spec.foundation.page.size;
const marginName = spec.foundation.page.margins.default;
const marginSymbol = `margin-${marginName}`;
const marginPt = mmToPt(spec.foundation.page.margins.symmetric_mm[marginName]);
const columnWidthPt = mmToPt(twoColumnDerivation.column_width_mm);
const gutterPt = mmToPt(twoColumnDerivation.column_gap_mm);
const textWidthPt = columnWidthPt * 2 + gutterPt;
const column2Pt = marginPt + columnWidthPt + gutterPt;
const pageHeightPt = mmToPt(spec.foundation.page.sizes_mm[paperName][1]);
const pageBottomContentPt = pageHeightPt - marginPt;
const GEOMETRY_TOLERANCE_PT = 0.5;
const closeTo = (a, b) => Math.abs(a - b) < GEOMETRY_TOLERANCE_PT;

/* How far a spanning element's marker may sit from the exact top or bottom
   line before this gate calls it mid-column, derived from the two-column
   rhythm rather than picked by feel: four lines of two-column body text is
   generous headroom for a block's own padding above a top-anchored marker,
   or below a bottom-anchored one, and is nowhere near the height of an
   actual column (templates.two-column.page.lines_per_column, 54 of these lines) — so it
   cannot be mistaken for "somewhere in the column" by a mutation this gate
   is trying to catch. Verified empirically while building this probe: every
   correctly-spanning marker measured within about 20pt of its edge, and
   every mutated one measured several hundred points away. */
const VERTICAL_TOLERANCE_PT = 4 * parseFloat(twoColumnTemplate.rhythm.baseline_advance);
const inBand = (y, edge) => Math.abs(y - edge) <= VERTICAL_TOLERANCE_PT;

/* Subtitle, byline and dateline are parameters of frontmatter-title-block,
   not standalone Typst functions — there is no way to call them on their
   own, so they are not rendered independently below. They span because the
   title block spans, which the frontmatter-title-block check does cover.
   This exemption list is named so that an id on spanning.always which is
   neither here nor in the render-checked list below fails loudly, rather
   than silently shipping unchecked on the Typst side the day it is added —
   see the loop just before the render check. */
const TYPST_EXEMPT_CARRIED_BY_TITLE_BLOCK = ['frontmatter-subtitle', 'frontmatter-byline', 'frontmatter-dateline'];
const TYPST_RENDER_CHECKED = [
  'frontmatter-title-block', 'frontmatter-abstract', 'frontmatter-colophon', 'headings-h1',
  'bibliography-heading',
];

for (const id of spanningAlways) {
  if (!TYPST_RENDER_CHECKED.includes(id) && !TYPST_EXEMPT_CARRIED_BY_TITLE_BLOCK.includes(id)) {
    fail.push(`tools/check.mjs: templates.two-column.spanning.always names "${id}", which this `
      + 'check neither renders nor exempts as carried by frontmatter-title-block (subtitle, byline, '
      + 'dateline) — update TYPST_RENDER_CHECKED or TYPST_EXEMPT_CARRIED_BY_TITLE_BLOCK');
  }
}
for (const id of TYPST_RENDER_CHECKED) {
  if (!spanningAlways.includes(id)) {
    fail.push(`tools/check.mjs: "${id}" is in TYPST_RENDER_CHECKED, but templates.two-column.spanning.always `
      + 'no longer names it — update this check');
  }
}

/* CSS: every id on spanning.always is a standalone class (typeset.css's @s
   frontmatter block gives subtitle, byline and dateline their own rules,
   siblings of the title block's) except headings-h1, styled through the bare
   `h1` selector rather than a class — handled as its own case below, not
   folded into a count of "how many are classes", which spec.json already
   owns via spanning.always itself. So a document may use any of the class-
   backed ones as a direct child of the multicol container. `column-span`
   requires a direct child, so the selector matched must carry the `>`
   combinator: a descendant selector, or an ancestor other than
   `.typeset--two-column`, satisfies a substring search but never spans in a
   browser. So this matches the WHOLE selector, ancestor and combinator
   included, against every rule in the stylesheet that sets `column-span` at
   all — including inside @media and @supports, which a regex keyed to
   `[^{}]` alone would silently skip — and requires exactly one such rule per
   selector, declaring `all`. Zero rules means the selector was never given
   the declaration (an id dropped, or retargeted to some other ancestor);
   more than one means some other rule also touches it, which is exactly the
   shape of a later override winning the cascade. */
function extractCssLeafRules(text) {
  const rules = [];
  const stack = [];
  let preludeStart = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      stack.push({ prelude: text.slice(preludeStart, i), bodyStart: i + 1 });
      preludeStart = i + 1;
    } else if (ch === '}') {
      const top = stack.pop();
      if (!top) continue; // stray brace — ignore rather than crash on malformed input
      const body = text.slice(top.bodyStart, i);
      /* A body containing its own "{" is an at-rule wrapper (@media, @supports):
         its nested rules were already captured as their own leaf entries while
         scanning reached their closing braces, so the wrapper itself is not a
         selector and is not pushed. */
      if (!body.includes('{')) rules.push({ selectors: top.prelude, decls: body });
      preludeStart = i + 1;
    }
  }
  return rules;
}

const cssLeafRules = extractCssLeafRules(cssNoComments);
const columnSpanValuesBySelector = new Map();
for (const rule of cssLeafRules) {
  const m = /column-span\s*:\s*([^;]+);/.exec(rule.decls);
  if (!m) continue;
  const value = m[1].trim();
  for (const raw of rule.selectors.split(',')) {
    const selector = raw.replace(/\s+/g, ' ').trim();
    if (!selector) continue;
    if (!columnSpanValuesBySelector.has(selector)) columnSpanValuesBySelector.set(selector, []);
    columnSpanValuesBySelector.get(selector).push(value);
  }
}

for (const id of spanningAlways) {
  const selector = id === 'headings-h1' ? '.typeset--two-column > h1' : `.typeset--two-column > .ts-${id}`;
  const values = columnSpanValuesBySelector.get(selector) || [];
  if (values.length === 0) {
    fail.push(`typeset.css: templates.two-column.spanning.always names "${id}", but no rule declares `
      + `column-span on "${selector}"`);
  } else if (values.length > 1) {
    fail.push(`typeset.css: "${selector}" has column-span declared in ${values.length} separate rules `
      + `(${values.join(', ')}) — templates.two-column.spanning.always names "${id}", so exactly one, `
      + 'declaring "all", is expected');
  } else if (values[0] !== 'all') {
    fail.push(`typeset.css: "${selector}" declares column-span: ${values[0]}, not "all" `
      + `(templates.two-column.spanning.always names "${id}")`);
  }
}

/* The container itself: every check above asks whether an element spans,
   which presupposes `.typeset--two-column` is a multicol box in the first
   place. It is not asserted anywhere else in this file. Delete `columns: 2`
   from it and every `column-span: all` below becomes a no-op — the whole
   template renders as one column, silently, which is worse than any single
   element failing to span. Found the same way as the per-id selectors: the
   leaf rule whose own selector (not a descendant of it) is exactly
   `.typeset--two-column`. Column count and gutter are both derived from
   spec.json, not hardcoded, for the same reason as the rest of this gate. */
const parseDeclarations = (decls) => {
  const map = new Map();
  for (const raw of decls.split(';')) {
    const idx = raw.indexOf(':');
    if (idx === -1) continue;
    const prop = raw.slice(0, idx).trim();
    if (!prop) continue;
    map.set(prop, raw.slice(idx + 1).trim());
  }
  return map;
};
const normalizeSelector = (raw) => raw.replace(/\s+/g, ' ').trim();

const containerRule = cssLeafRules.find((r) => r.selectors.split(',')
  .some((s) => normalizeSelector(s) === '.typeset--two-column'));

if (!containerRule) {
  fail.push('typeset.css: no rule selects exactly .typeset--two-column — the multicol container '
    + 'rule was not found');
} else {
  const containerDecls = parseDeclarations(containerRule.decls);
  const expectedColumns = twoColumnTemplate.page.columns;
  const columnsValue = containerDecls.get('columns');
  if (columnsValue === undefined) {
    fail.push('typeset.css: .typeset--two-column does not declare `columns`, so it is not a multicol '
      + 'container and every column-span below it is a no-op');
  } else if (Number(columnsValue) !== expectedColumns) {
    fail.push(`typeset.css: .typeset--two-column declares columns: ${columnsValue}, but `
      + `templates.two-column.page.columns is ${expectedColumns}`);
  }

  const columnGapValue = containerDecls.get('column-gap');
  if (columnGapValue === undefined) {
    fail.push('typeset.css: .typeset--two-column does not declare `column-gap`');
  } else {
    const varRef = /^var\((--[\w-]+)\)$/.exec(columnGapValue);
    const resolved = varRef ? containerDecls.get(varRef[1]) : columnGapValue;
    const resolvedMm = resolved && /^[\d.]+mm$/.test(resolved.trim()) ? parseFloat(resolved) : null;
    if (resolvedMm === null) {
      fail.push(`typeset.css: .typeset--two-column's column-gap (${columnGapValue}`
        + `${varRef ? ` → ${resolved ?? 'undefined'}` : ''}) does not resolve to a plain mm value this `
        + 'check can compare to templates.two-column.derivation.column_gap_mm');
    } else if (Math.abs(resolvedMm - twoColumnDerivation.column_gap_mm) > 0.001) {
      fail.push(`typeset.css: .typeset--two-column's column-gap resolves to ${resolved}, but `
        + `templates.two-column.derivation.column_gap_mm is ${twoColumnDerivation.column_gap_mm}mm`);
    }
  }
}

/* The manual affordance: spanning.optional (figure, table, code block, pull
   quote) names no element ids to loop over, but .ts-span is the one CSS
   selector it depends on — checked through the same declaration-first path
   as the seven always-list ids above, and never gated before this round.
   The always list got the task's attention; the opt-in list had nothing
   watching it on either implementation. */
const spanSelector = '.typeset--two-column > .ts-span';
const spanValues = columnSpanValuesBySelector.get(spanSelector) || [];
if (spanValues.length === 0) {
  fail.push('typeset.css: templates.two-column.spanning.optional depends on .ts-span, but no rule '
    + `declares column-span on "${spanSelector}"`);
} else if (spanValues.length > 1) {
  fail.push(`typeset.css: "${spanSelector}" has column-span declared in ${spanValues.length} separate `
    + `rules (${spanValues.join(', ')}) — exactly one, declaring "all", is expected`);
} else if (spanValues[0] !== 'all') {
  fail.push(`typeset.css: "${spanSelector}" declares column-span: ${spanValues[0]}, not "all" `
    + '(templates.two-column.spanning.optional depends on it)');
}

/* Typst: render a probe, don't read the source next to it. Reuses gate 3h's
   harness — a mkdtemp reader directory, a copy of typeset.typ, `typst compile
   --font-path` — but as one small document per checked id rather than one
   document holding all of them. Isolation matters here: Typst stacks
   multiple top-anchored floats on the same page one below the last, so a
   second float's marker sits well below the page's exact top margin even
   when it is spanning correctly. Testing one id per compile keeps "is this
   marker at the page's own top or bottom line" a clean question, rather than
   "at the top of the page, or one float-height further down" — which is what
   the stacked-probe version of this gate would have to ask instead. */
function svgShapesByFill(svgText, fill) {
  /* A hand-rolled walk rather than an XML library: Typst's own SVG output is
     simple and regular (self-closing <path>, nested <g transform="matrix(...)">
     with no other element carrying layout-relevant attributes), so a small
     tag-and-stack scanner is enough, and it keeps this file dependency-free. */
  const tagRe = /<([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>|<\/([a-zA-Z][\w:-]*)>/g;
  const attrRe = /([\w:-]+)="([^"]*)"/g;
  const parseMatrix = (t) => {
    const m = /matrix\(([^)]+)\)/.exec(t);
    return m ? m[1].trim().split(/[\s,]+/).map(Number) : null;
  };
  const multiply = (m1, m2) => {
    const [a1, b1, c1, d1, e1, f1] = m1;
    const [a2, b2, c2, d2, e2, f2] = m2;
    return [
      a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
      a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
      a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1,
    ];
  };
  const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

  const stack = [[1, 0, 0, 1, 0, 0]];
  const shapes = [];
  let match;
  while ((match = tagRe.exec(svgText))) {
    const [, openTag, attrsText, selfClose, closeTag] = match;
    if (closeTag) {
      if (closeTag === 'g') stack.pop();
      continue;
    }
    const attrs = {};
    if (attrsText) {
      attrRe.lastIndex = 0;
      let am;
      while ((am = attrRe.exec(attrsText))) attrs[am[1]] = am[2];
    }
    let matrix = stack[stack.length - 1];
    if (attrs.transform) {
      const mm = parseMatrix(attrs.transform);
      if (mm) matrix = multiply(matrix, mm);
    }
    if (openTag === 'g') {
      if (!selfClose) stack.push(matrix);
    } else if (openTag === 'path' && attrs.fill === fill) {
      const d = attrs.d || '';
      /* Every shape this gate looks for is a marker `rect()` this file wrote
         itself (never a natural stroke, whose start point and winding
         direction vary by which side of a block it strokes, so `abs[0]`
         would not consistently mean "left edge" the way the review found).
         A `rect()`'s own drawing routine always starts at its local origin
         and draws right then down, so the local origin IS the top-left
         corner — Typst omits the "m dx dy" relative-moveto prefix entirely
         when that origin is (0,0), which is why the fallback below is a
         known-correct default here rather than a silent guess. */
      const originMatch = /M\s*0\s+0m\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(d);
      const [lx, ly] = originMatch ? [Number(originMatch[1]), Number(originMatch[2])] : [0, 0];
      const widthMatch = /h\s*(-?[\d.]+)/.exec(d);
      shapes.push({ abs: apply(matrix, lx, ly), width: widthMatch ? Math.abs(Number(widthMatch[1])) : null });
    }
  }
  return shapes;
}

/* 700 lorem words reliably fills column 1 and pushes anything after it into
   column 2 — verified directly while building this probe, for every id
   below, both correctly spanning (where it makes no difference: a float's
   position never depends on how much normal content precedes it) and under
   each mutation this gate exists to catch (where it is exactly what makes
   the broken position land somewhere other than the page's left margin).
   Without it, column 1 and the spanning region share a left edge, and an
   unspanned element in column 1 would read as passing by coincidence — which
   is why frontmatter-colophon's probe below also carries its own control
   marker, rather than trusting this comment alone. */
const LEADING_FILLER = '#lorem(700)';
const TRAILING_FILLER = '#lorem(200)';
const markerRect = (fill) => `rect(width: 100%, height: 8pt, fill: rgb("${fill}"))`;
/* Typst's own page(paper:) wants its lower-case enum spelling
   ("a4"); spec.json's foundation.page.size is prose-cased ("A4") for
   SPEC.md and the site. Lower-casing here is a spelling convention, not a
   derived value — the size itself still comes from spec.json. */
const docPreamble = `#import "typeset.typ": *\n\n#show: two-column.with(`
  + `paper: "${paperName.toLowerCase()}", margin: ${marginSymbol})\n\n`;

const HEADING_FILL = '#e10001';
const ABSTRACT_FILL = '#e10002';
const TITLE_BLOCK_FILL = '#e10003';
const COLOPHON_FILL = '#e10004';
const COLOPHON_CONTROL_FILL = '#e100c0';
const BIBLIOGRAPHY_HEADING_FILL = '#e10005';

/* Every probe is its own document: one id, checked on its own page, so a
   stacked second float never has to be told apart from a broken one (see the
   comment above svgShapesByFill). frontmatter-colophon's carries a second,
   unwrapped marker of its own — not spanning, not floated — as a control:
   it proves the filler actually reached column 2 at the point the real
   check depends on that, so a trimmed-down filler fails loudly on the
   control rather than silently passing the real check for the wrong reason. */
const typstProbes = [
  {
    id: 'headings-h1',
    source: `${docPreamble}${LEADING_FILLER}\n\n#heading(level: 1)[#${markerRect(HEADING_FILL)}]\n`,
    fill: HEADING_FILL,
    vertical: 'top',
    checkWidth: true,
  },
  {
    id: 'frontmatter-abstract',
    source: `${docPreamble}${LEADING_FILLER}\n\n#frontmatter-abstract(width: 100%)[#${markerRect(ABSTRACT_FILL)}]\n`,
    fill: ABSTRACT_FILL,
    vertical: 'top',
    checkWidth: true,
  },
  {
    id: 'frontmatter-title-block',
    source: `${docPreamble}${LEADING_FILLER}\n\n#frontmatter-title-block(title: [#${markerRect(TITLE_BLOCK_FILL)}])\n`,
    fill: TITLE_BLOCK_FILL,
    vertical: 'top',
    checkWidth: true,
  },
  {
    id: 'frontmatter-colophon',
    source: `${docPreamble}${LEADING_FILLER}\n\n`
      + `#rect(width: 4pt, height: 4pt, fill: rgb("${COLOPHON_CONTROL_FILL}"))\n\n`
      + `#frontmatter-colophon[#${markerRect(COLOPHON_FILL)}]\n\n${TRAILING_FILLER}\n`,
    fill: COLOPHON_FILL,
    vertical: 'bottom',
    checkWidth: false,
    control: { fill: COLOPHON_CONTROL_FILL, expectedX: column2Pt },
  },
  {
    id: 'bibliography-heading',
    source: `${docPreamble}${LEADING_FILLER}\n\n#references(title: [#${markerRect(BIBLIOGRAPHY_HEADING_FILL)}])[]\n`,
    fill: BIBLIOGRAPHY_HEADING_FILL,
    vertical: 'top',
    checkWidth: true,
  },
];

const spanProbeDir = mkdtempSync(join(tmpdir(), 'typeset-span-check-'));
try {
  copyFileSync('implementations/typeset.typ', join(spanProbeDir, 'typeset.typ'));

  for (const probe of typstProbes) {
    const probeTypPath = join(spanProbeDir, `${probe.id}.typ`);
    const probeSvgPattern = join(spanProbeDir, `${probe.id}-{n}.svg`);
    writeFileSync(probeTypPath, probe.source);

    let svg;
    try {
      execFileSync(
        'typst',
        ['compile', '--font-path', resolve('fonts'), probeTypPath, probeSvgPattern],
        { stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 },
      );
      svg = readFileSync(join(spanProbeDir, `${probe.id}-1.svg`), 'utf8');
    } catch (err) {
      const detail = (err.stderr ? err.stderr.toString() : String(err.message || err)).trim();
      fail.push(`typeset.typ: the two-column spanning probe for "${probe.id}" failed to compile:\n${detail}`);
      continue;
    }

    if (probe.control) {
      const controlShapes = svgShapesByFill(svg, probe.control.fill);
      if (controlShapes.length === 0) {
        fail.push(`tools/check.mjs: the "${probe.id}" spanning probe's own filler control marker was not `
          + 'found — update the probe in this gate');
      } else if (!closeTo(controlShapes[0].abs[0], probe.control.expectedX)) {
        fail.push(`tools/check.mjs: the "${probe.id}" spanning probe's filler no longer reaches column 2 — `
          + `its control marker rendered at x=${controlShapes[0].abs[0].toFixed(2)}pt, expected `
          + `${probe.control.expectedX.toFixed(2)}pt. Increase the probe's filler in this gate; until then, `
          + `the "${probe.id}" check below cannot tell a working implementation from a broken one.`);
      }
    }

    const shapes = svgShapesByFill(svg, probe.fill);
    if (shapes.length === 0) {
      fail.push(`typeset.typ: the two-column spanning probe found no shape for "${probe.id}" — `
        + 'update the probe in this gate');
      continue;
    }
    const shape = shapes[0];
    const problems = [];
    if (!closeTo(shape.abs[0], marginPt)) {
      problems.push(`left edge at x=${shape.abs[0].toFixed(2)}pt, expected the page margin ${marginPt.toFixed(2)}pt`);
    }
    if (probe.checkWidth && !closeTo(shape.width, textWidthPt)) {
      problems.push(`width ${shape.width?.toFixed(2)}pt, expected the full text width ${textWidthPt.toFixed(2)}pt`);
    }
    const verticalEdge = probe.vertical === 'top' ? marginPt : pageBottomContentPt;
    if (!inBand(shape.abs[1], verticalEdge)) {
      problems.push(`vertical position y=${shape.abs[1].toFixed(2)}pt, expected within `
        + `${VERTICAL_TOLERANCE_PT.toFixed(2)}pt of the page's ${probe.vertical} (${verticalEdge.toFixed(2)}pt) `
        + '— never mid-column, per templates.two-column.requirements');
    }
    if (problems.length > 0) {
      fail.push(`typeset.typ: "${probe.id}" does not span both columns under the two-column body — `
        + `${problems.join('; ')} (spec: templates.two-column.spanning.always)`);
    }
  }
} finally {
  rmSync(spanProbeDir, { recursive: true, force: true });
}

/* ---- 7. The named margins and paper sizes are hand-copied into both
           implementations, and gated in neither ------------------------- */

/* spec.json owns symmetric_mm, duplex_inner_mm, duplex_outer_mm and
   sizes_mm. Both implementations restate every one of these as literal
   numbers — typeset.typ as margin-* dictionaries plus paper-sizes-mm, the
   66/128 character constant and the two-column floor; typeset.css as
   @page margin declarations — and nothing before this gate compared either
   copy to spec.json. Demonstrated: setting margin-narrow to 14mm in
   typeset.typ while spec.json stayed at 10mm left `node tools/check.mjs`
   reporting only a stale generated page, and passing clean once the site
   was rebuilt. Only the default (standard, symmetric) margin was covered,
   and only incidentally, because the two-column spanning probe above
   renders through it — the other five names, in both implementations,
   were free to drift. */

const marginNames = ['narrow', 'standard', 'wide'];
const symmetricMm = spec.foundation.page.margins.symmetric_mm;
const duplexInnerMm = spec.foundation.page.margins.duplex_inner_mm;
const duplexOuterMm = spec.foundation.page.margins.duplex_outer_mm;
const sizesMm = spec.foundation.page.sizes_mm;
const MARGIN_TOLERANCE_MM = 0.001;
const mmClose = (a, b) => a !== null && b !== null && Math.abs(a - b) < MARGIN_TOLERANCE_MM;

/* The spec's own stated invariant — "inner plus outer equal to twice the
   symmetric value" — is prose in foundation.page.margins.note with nothing
   checking it. A duplex pair that stops preserving its symmetric total
   silently reflows every document that switches between duplex and
   symmetric, so this is asserted against spec.json's own numbers,
   independently of either implementation. */
for (const name of marginNames) {
  const total = duplexInnerMm[name] + duplexOuterMm[name];
  if (!mmClose(total, 2 * symmetricMm[name])) {
    fail.push(`spec.json: foundation.page.margins duplex_inner_mm.${name} (${duplexInnerMm[name]}mm) + `
      + `duplex_outer_mm.${name} (${duplexOuterMm[name]}mm) = ${total}mm, not twice symmetric_mm.${name} `
      + `(${symmetricMm[name]}mm) — the margins note's own invariant no longer holds`);
  }
}

/* Typst: six margin-* dictionaries. */
const marginDictSource = (name) => {
  const m = new RegExp(`#let margin-${name} = \\(([^)]*)\\)`).exec(typ);
  if (!m) return null;
  const dict = {};
  for (const pair of m[1].matchAll(/(top|bottom|left|right|inside|outside)\s*:\s*(-?[\d.]+)mm/g)) {
    dict[pair[1]] = Number(pair[2]);
  }
  return dict;
};

for (const name of marginNames) {
  const dict = marginDictSource(name);
  if (!dict) {
    fail.push(`typeset.typ: #let margin-${name} was not found`);
  } else {
    for (const side of ['top', 'bottom', 'left', 'right']) {
      if (!mmClose(dict[side], symmetricMm[name])) {
        fail.push(`typeset.typ: margin-${name}.${side} is ${dict[side]}mm, but `
          + `foundation.page.margins.symmetric_mm.${name} is ${symmetricMm[name]}mm`);
      }
    }
  }

  const duplexDict = marginDictSource(`duplex-${name}`);
  if (!duplexDict) {
    fail.push(`typeset.typ: #let margin-duplex-${name} was not found`);
  } else {
    for (const side of ['top', 'bottom']) {
      if (!mmClose(duplexDict[side], symmetricMm[name])) {
        fail.push(`typeset.typ: margin-duplex-${name}.${side} is ${duplexDict[side]}mm, but `
          + `foundation.page.margins.symmetric_mm.${name} is ${symmetricMm[name]}mm`);
      }
    }
    if (!mmClose(duplexDict.inside, duplexInnerMm[name])) {
      fail.push(`typeset.typ: margin-duplex-${name}.inside is ${duplexDict.inside}mm, but `
        + `foundation.page.margins.duplex_inner_mm.${name} is ${duplexInnerMm[name]}mm`);
    }
    if (!mmClose(duplexDict.outside, duplexOuterMm[name])) {
      fail.push(`typeset.typ: margin-duplex-${name}.outside is ${duplexDict.outside}mm, but `
        + `foundation.page.margins.duplex_outer_mm.${name} is ${duplexOuterMm[name]}mm`);
    }
  }
}

/* Typst: paper-sizes-mm, both directions — a paper named in one place and
   not the other is exactly as wrong as one named in both with different
   numbers. "us-letter" is Typst's own name for the spec's "Letter"; every
   other key is the spec's own name lower-cased. */
const PAPER_NAME_TO_SPEC = { a4: 'A4', a5: 'A5', 'us-letter': 'Letter' };
const paperDictMatch = /#let paper-sizes-mm = \(\n([\s\S]*?)\n\)/.exec(typ);
if (!paperDictMatch) {
  fail.push('typeset.typ: #let paper-sizes-mm was not found');
} else {
  const typPapers = {};
  for (const entry of paperDictMatch[1].matchAll(/"([\w-]+)":\s*\((-?[\d.]+)mm,\s*(-?[\d.]+)mm\)/g)) {
    typPapers[entry[1]] = [Number(entry[2]), Number(entry[3])];
  }
  for (const [typKey, specKey] of Object.entries(PAPER_NAME_TO_SPEC)) {
    if (!(typKey in typPapers)) {
      fail.push(`typeset.typ: paper-sizes-mm has no "${typKey}" entry, but foundation.page.sizes_mm names "${specKey}"`);
    } else {
      const [w, h] = typPapers[typKey];
      const [specW, specH] = sizesMm[specKey];
      if (!mmClose(w, specW) || !mmClose(h, specH)) {
        fail.push(`typeset.typ: paper-sizes-mm.${typKey} is (${w}mm, ${h}mm), but `
          + `foundation.page.sizes_mm.${specKey} is (${specW}mm, ${specH}mm)`);
      }
    }
  }
  for (const typKey of Object.keys(typPapers)) {
    if (!(typKey in PAPER_NAME_TO_SPEC)) {
      fail.push(`typeset.typ: paper-sizes-mm has a "${typKey}" entry with no known spec.json counterpart `
        + '— add it to PAPER_NAME_TO_SPEC in this gate');
    }
  }
  for (const specKey of Object.keys(sizesMm)) {
    if (!Object.values(PAPER_NAME_TO_SPEC).includes(specKey)) {
      fail.push(`typeset.typ: foundation.page.sizes_mm names "${specKey}", which PAPER_NAME_TO_SPEC in `
        + 'this gate does not map to a paper-sizes-mm entry');
    }
  }
}

/* Typst: the foundation measure (66 characters in 128mm), inlined into
   two-column()'s own chars-in formula, and the two-column floor. */
const charsMatch = /calc\.round\((-?[\d.]+)\s*\/\s*(-?[\d.]+)\s*\*/.exec(typ);
if (!charsMatch) {
  fail.push('typeset.typ: the 66/128 characters-per-mm constant was not found in two-column()');
} else {
  if (Number(charsMatch[1]) !== spec.foundation.rhythm.measure_chars) {
    fail.push(`typeset.typ: two-column()'s characters constant is ${charsMatch[1]}, but `
      + `foundation.rhythm.measure_chars is ${spec.foundation.rhythm.measure_chars}`);
  }
  if (Number(charsMatch[2]) !== spec.foundation.rhythm.measure_mm) {
    fail.push(`typeset.typ: two-column()'s mm constant is ${charsMatch[2]}, but `
      + `foundation.rhythm.measure_mm is ${spec.foundation.rhythm.measure_mm}`);
  }
}

const floorMatch = /let floor = (-?[\d.]+)/.exec(typ);
if (!floorMatch) {
  fail.push("typeset.typ: two-column()'s `floor` constant was not found");
} else if (Number(floorMatch[1]) !== twoColumnDerivation.floor) {
  fail.push(`typeset.typ: two-column()'s floor is ${floorMatch[1]}, but `
    + `templates.two-column.derivation.floor is ${twoColumnDerivation.floor}`);
}

/* CSS: the same six margins, as @page rules. `columnSpanValuesBySelector`'s
   sibling here is a plain-declaration lookup — the margin gate needs actual
   mm values, not a column-span keyword — over the same leaf-rule scan. */
const cssPageDecls = (selector) => {
  const rule = cssLeafRules.find((r) => normalizeSelector(r.selectors) === selector);
  return rule ? parseDeclarations(rule.decls) : null;
};
const mmOf = (value) => (value && /^[\d.]+mm$/.test(value.trim()) ? parseFloat(value) : null);

for (const name of marginNames) {
  const symmetricDecls = cssPageDecls(`@page ts-margin-${name}`);
  if (!symmetricDecls) {
    fail.push(`typeset.css: @page ts-margin-${name} was not found`);
  } else {
    const value = symmetricDecls.get('margin');
    const mm = mmOf(value);
    if (mm === null) {
      fail.push(`typeset.css: @page ts-margin-${name}'s margin ("${value}") is not a plain mm value `
        + 'this check can compare to spec.json');
    } else if (!mmClose(mm, symmetricMm[name])) {
      fail.push(`typeset.css: @page ts-margin-${name} declares margin: ${value}, but `
        + `foundation.page.margins.symmetric_mm.${name} is ${symmetricMm[name]}mm`);
    }
  }

  const baseDecls = cssPageDecls(`@page ts-margin-duplex-${name}`);
  const rightDecls = cssPageDecls(`@page ts-margin-duplex-${name}:right`);
  const leftDecls = cssPageDecls(`@page ts-margin-duplex-${name}:left`);
  if (!baseDecls || !rightDecls || !leftDecls) {
    fail.push(`typeset.css: @page ts-margin-duplex-${name} (its base rule, :right and :left) were `
      + 'not all found');
  } else {
    const top = mmOf(baseDecls.get('margin-top'));
    const bottom = mmOf(baseDecls.get('margin-bottom'));
    if (!mmClose(top, symmetricMm[name])) {
      fail.push(`typeset.css: @page ts-margin-duplex-${name} declares margin-top: `
        + `${baseDecls.get('margin-top')}, but foundation.page.margins.symmetric_mm.${name} is `
        + `${symmetricMm[name]}mm`);
    }
    if (!mmClose(bottom, symmetricMm[name])) {
      fail.push(`typeset.css: @page ts-margin-duplex-${name} declares margin-bottom: `
        + `${baseDecls.get('margin-bottom')}, but foundation.page.margins.symmetric_mm.${name} is `
        + `${symmetricMm[name]}mm`);
    }

    /* :right is the recto — the binding (inner) edge is on the left in a
       left-to-right page. :left is the verso, mirrored. */
    const rectoInner = mmOf(rightDecls.get('margin-left'));
    const rectoOuter = mmOf(rightDecls.get('margin-right'));
    const versoOuter = mmOf(leftDecls.get('margin-left'));
    const versoInner = mmOf(leftDecls.get('margin-right'));
    if (!mmClose(rectoInner, duplexInnerMm[name]) || !mmClose(versoInner, duplexInnerMm[name])) {
      fail.push(`typeset.css: @page ts-margin-duplex-${name}'s inner (binding) edge is `
        + `${rightDecls.get('margin-left')} on the recto and ${leftDecls.get('margin-right')} on the `
        + `verso, but foundation.page.margins.duplex_inner_mm.${name} is ${duplexInnerMm[name]}mm`);
    }
    if (!mmClose(rectoOuter, duplexOuterMm[name]) || !mmClose(versoOuter, duplexOuterMm[name])) {
      fail.push(`typeset.css: @page ts-margin-duplex-${name}'s outer edge is `
        + `${rightDecls.get('margin-right')} on the recto and ${leftDecls.get('margin-left')} on the `
        + `verso, but foundation.page.margins.duplex_outer_mm.${name} is ${duplexOuterMm[name]}mm`);
    }
  }
}

/* ---- 8. A .tabs input positioned absolute must be pinned inside .tabs ---- */

/* An absolutely positioned element with no offset of its own falls back to
   its static position, which — inside a flex container — comes from the
   container's own alignment rather than from its nearest positioned
   ancestor. .tabs's input is position: absolute so it can hide without
   display: none breaking the :checked~ sibling selectors the panel relies
   on; if .tabs itself is not a positioned ancestor, that radio's static
   position resolves against .tabs's align-items: flex-end instead, landing
   at the bottom of .tabs — which is also the bottom of the visible pane.
   Focusing the radio (a label click does this natively, no JS involved)
   then scrolls that point into view, jumping the page to the end of the
   example. This gate asserts the fix — .tabs positioned, its input pinned
   with explicit offsets — holds, rather than trusting it stays in place
   the next time either rule is touched. */
{
  const specimenCss = readFileSync('specimen.css', 'utf8');
  const cssBlock = (selector) => specimenCss
    .match(new RegExp(`${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`))?.[1];

  const tabsInputBlock = cssBlock('.tabs input');
  if (!tabsInputBlock) {
    fail.push('specimen.css: no .tabs input block found — the tab-focus-scroll gate cannot run');
  } else if (/\bposition:\s*absolute\b/.test(tabsInputBlock)) {
    const tabsBlock = cssBlock('.tabs');
    if (!tabsBlock || !/\bposition:\s*relative\b/.test(tabsBlock)) {
      fail.push('specimen.css: .tabs input is position: absolute but .tabs does not declare '
        + 'position: relative — the radio takes its static position from .tabs\'s flex '
        + 'alignment (align-items: flex-end) instead, at the bottom of the pane, so focusing '
        + 'it (a label click) scrolls the page to the end of the example');
    }

    const hasTop = /\btop:\s*[^;]+;/.test(tabsInputBlock);
    const hasLeft = /\bleft:\s*[^;]+;/.test(tabsInputBlock);
    if (!hasTop || !hasLeft) {
      fail.push(`specimen.css: .tabs input is position: absolute but does not declare both `
        + `top and left (top: ${hasTop ? 'yes' : 'missing'}, left: ${hasLeft ? 'yes' : 'missing'}) `
        + '— without explicit offsets it falls back to its flex-derived static position at '
        + 'the bottom of .tabs');
    }
  }
}

/* ---- 9. The exported measures must equal what spec.json derives --------- */

/* foundation.rhythm states the measure and its two variants directly, in em
   — measure-standard, measure-narrow and measure-wide restate those same
   three literals, so a plain string match against spec.json's own text
   holds them to it. measure-full has no literal counterpart: it is the
   default paper width less twice the default margin, so it is checked by
   compiling a probe against the real typeset.typ and reading back the
   value it actually resolves to, rather than trusting that this file's
   arithmetic still matches spec.json's. (typst is already required by gate
   3h above, which exits before this point if it is missing.) */

const measureLiterals = [
  ['measure-standard', spec.foundation.rhythm.measure],
  ['measure-narrow', spec.foundation.rhythm.measure_variants.narrow],
  ['measure-wide', spec.foundation.rhythm.measure_variants.wide],
];
for (const [name, expected] of measureLiterals) {
  const m = new RegExp(`#let ${name}\\s*=\\s*([^\\n]+)`).exec(typ);
  if (!m) {
    fail.push(`typeset.typ: #let ${name} was not found`);
  } else if (m[1].trim() !== expected) {
    fail.push(`typeset.typ: ${name} is ${m[1].trim()}, but foundation.rhythm's own value is ${expected}`);
  }
}

/* sizesMm and symmetricMm are spec.json's own numbers, already declared for
   the margin/paper gate above — reused here rather than read a second time. */
const measureFullExpectedMm = sizesMm[spec.foundation.page.size][0]
  - 2 * symmetricMm[spec.foundation.page.margins.default];

const measureProbeDir = mkdtempSync(join(tmpdir(), 'typeset-measure-check-'));
try {
  copyFileSync('implementations/typeset.typ', join(measureProbeDir, 'typeset.typ'));
  const probePath = join(measureProbeDir, 'measure-full.typ');
  writeFileSync(probePath, '#import "typeset.typ": measure-full\n\n'
    + '#context [#metadata(measure-full.to-absolute() / 1mm) <measure-full>]\n');
  try {
    const out = execFileSync(
      'typst',
      ['query', probePath, '<measure-full>', '--field', 'value', '--one', '--font-path', resolve('fonts')],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const actualMm = Number(JSON.parse(out.toString()));
    if (!mmClose(actualMm, measureFullExpectedMm)) {
      fail.push(`typeset.typ: measure-full resolves to ${actualMm}mm, but the default paper `
        + `(${spec.foundation.page.size}, ${sizesMm[spec.foundation.page.size][0]}mm wide) less twice the `
        + `default margin (${spec.foundation.page.margins.default}, `
        + `${symmetricMm[spec.foundation.page.margins.default]}mm) is ${measureFullExpectedMm}mm`);
    }
  } catch (err) {
    const detail = (err.stderr ? err.stderr.toString() : String(err.message || err)).trim();
    fail.push(`typeset.typ: measure-full could not be resolved:\n${detail}`);
  }
} finally {
  rmSync(measureProbeDir, { recursive: true, force: true });
}

/* ---- 10. measure_mm must not drift from measure, the canonical value ----- */

/* foundation.rhythm.measure ("33em") is canonical; measure_mm is a derived
   millimetre convenience for readers who think in paper dimensions, not a
   second source of truth. Recompute it from measure and the 11pt base, the
   same conversion the note describes, and fail if the declared value has
   drifted — the two disagreeing by rounding is exactly how this task started. */

const measureEmMatch = /^([\d.]+)em$/.exec(spec.foundation.rhythm.measure);
if (!measureEmMatch) {
  fail.push(`spec.json: foundation.rhythm.measure is "${spec.foundation.rhythm.measure}", expected an em value`);
} else {
  const measureEm = Number(measureEmMatch[1]);
  const basePt = parseFloat(spec.foundation.scale.steps.base);
  const expectedMm = Math.round(measureEm * basePt * (25.4 / 72));
  if (spec.foundation.rhythm.measure_mm !== expectedMm) {
    fail.push(`spec.json: foundation.rhythm.measure_mm is ${spec.foundation.rhythm.measure_mm}, but `
      + `measure (${spec.foundation.rhythm.measure}) at the ${spec.foundation.scale.steps.base} base is `
      + `${expectedMm}mm — measure is canonical, measure_mm must follow it`);
  }
}

/* ---- 11. block-spaced / block-indented must match the spec, and the indent
            must actually be suppressed only where the spec says ----------- */

/* The literal values first. _paragraphs-rule backs both typeset()'s own
   `indented` option and the two standalone functions, so a hand-copied number
   drifting in any one of the three call sites shows up here as a mismatch
   against spec.json's own paragraphs-spaced/paragraphs-indented elements —
   the elements block-spaced/block-indented implement, per IMPLEMENTS above. */

const paragraphsSpec = spec.sections.find((s) => s.id === 'paragraphs');
const specEl = (id) => paragraphsSpec.elements.find((e) => e.id === id).properties;
const spacedProps = specEl('paragraphs-spaced');
const indentedProps = specEl('paragraphs-indented');

const rule = /#let _paragraphs-rule\(indented, leading: [\d.]+\) = if indented \{([^}]*)\} else \{([^}]*)\}/.exec(typ);
if (!rule) {
  fail.push('typeset.typ: _paragraphs-rule was not found in the shape this gate expects — '
    + 'update the gate if the function was deliberately restructured');
} else {
  const [, indentedBranch, spacedBranch] = rule;

  const spacedIndent = /first-line-indent:\s*([^\n,)}]+)/.exec(spacedBranch)?.[1]?.trim();
  if (spacedIndent !== '0pt') {
    fail.push(`typeset.typ: block-spaced's first-line-indent is ${spacedIndent}, but `
      + `spec.json's paragraphs-spaced.first_line_indent is "${spacedProps.first_line_indent}" (0) `
      + '— every line flush');
  }
  const spacedSpacing = /spacing:\s*([^\n,)}]+)/.exec(spacedBranch)?.[1]?.trim();
  if (spacedSpacing !== 'sp') {
    fail.push(`typeset.typ: block-spaced's spacing is "${spacedSpacing}", expected the module's `
      + `own \`sp\` (${spacedProps.space_after}, spec.json's paragraphs-spaced.space_after)`);
  }

  const indentedAmount = /first-line-indent:\s*\(amount:\s*([^,]+),\s*all:\s*(true|false)\)/.exec(indentedBranch);
  if (!indentedAmount) {
    fail.push('typeset.typ: block-indented does not set first-line-indent as an '
      + '(amount: .., all: ..) dictionary — without `all`, Typst cannot know to withhold the '
      + 'indent after a heading, blockquote, figure or break, or from the document\'s first paragraph');
  } else {
    if (indentedAmount[1].trim() !== indentedProps.first_line_indent) {
      fail.push(`typeset.typ: block-indented's first-line-indent amount is `
        + `${indentedAmount[1].trim()}, but spec.json's paragraphs-indented.first_line_indent is `
        + `"${indentedProps.first_line_indent}"`);
    }
    if (indentedAmount[2] !== 'false') {
      fail.push('typeset.typ: block-indented sets first-line-indent all: true — this applies '
        + "the indent even after a heading, blockquote, figure or break, and to the document's "
        + 'first paragraph, contradicting the note on spec.json\'s paragraphs-indented element: '
        + `"${paragraphsSpec.elements.find((e) => e.id === 'paragraphs-indented').notes[0]}"`);
    }
  }
  const indentedSpacing = /spacing:\s*([^\n,)}]+)/.exec(indentedBranch)?.[1]?.trim();
  if (!/^leading-for\(/.test(indentedSpacing ?? '')) {
    fail.push(`typeset.typ: block-indented's spacing is "${indentedSpacing}", expected `
      + `leading-for(..) — spec.json's paragraphs-indented.space_after is "${indentedProps.space_after}" `
      + '(no gap beyond the ordinary line leading)');
  }
}

/* The behaviour second. A gate that only reads the source text back would
   pass an implementation that sets the right dictionary and STILL gets the
   result wrong — the most likely way, per this task's own brief: wrapping
   `body` in a layout block() rather than a plain code-block scope. A
   block() is itself a non-paragraph element, so Typst's `all: false` would
   then withhold the indent from the wrapper's own first paragraph even when
   nothing inside the wrapper precedes it — silently flushing prose that is
   not actually after a heading, a blockquote, a figure or a break. So this
   renders a probe through the real typeset.typ and reads back where the
   glyphs actually land, the same way gate 6 holds two-column spanning to the
   rendered page rather than to the source that describes it. */

const PARA_MARGIN_PT = 20;
const paraBasePt = parseFloat(spec.foundation.scale.steps.base);
const indentEm = parseFloat(indentedProps.first_line_indent);
const paraIndentPt = indentEm * paraBasePt;
const paraMarker = (fill) => `#box(rect(width: 4pt, height: 4pt, fill: rgb("${fill}")))`;

const AFTER_HEADING_FILL = '#d20001';
const MID_FLOW_FILL = '#d20002';
const WRAPPER_FIRST_FILL = '#d20003';
const SPACED_FIRST_FILL = '#d20004';
const SPACED_SECOND_FILL = '#d20005';

const paraProbeSource = `#import "typeset.typ": *\n\n`
  + `#set page(width: 300pt, height: auto, margin: ${PARA_MARGIN_PT}pt)\n`
  + `#set text(font: serif, size: ${paraBasePt}pt)\n\n`
  + `= Heading\n`
  + `#block-indented[\n`
  + `  ${paraMarker(AFTER_HEADING_FILL)}Flush: this paragraph follows the heading directly.\n\n`
  + `  ${paraMarker(MID_FLOW_FILL)}Indented: this paragraph follows an ordinary paragraph.\n`
  + `]\n\n`
  + `Ordinary prose that precedes the next wrapper, so ITS first paragraph is not the `
  + `document's first paragraph and does not follow a heading, a blockquote, a figure or a break.\n\n`
  + `#block-indented[\n`
  + `  ${paraMarker(WRAPPER_FIRST_FILL)}Indented: the wrapper's own first paragraph, which a `
  + `block() wrapper would wrongly flush.\n`
  + `]\n\n`
  + `#block-spaced[\n`
  + `  ${paraMarker(SPACED_FIRST_FILL)}Flush: block-spaced never indents.\n\n`
  + `  ${paraMarker(SPACED_SECOND_FILL)}Flush: still no indent, even mid-flow.\n`
  + `]\n`;

const paraProbeDir = mkdtempSync(join(tmpdir(), 'typeset-paragraphs-check-'));
try {
  copyFileSync('implementations/typeset.typ', join(paraProbeDir, 'typeset.typ'));
  const paraProbePath = join(paraProbeDir, 'paragraphs-probe.typ');
  const paraProbeSvgPath = join(paraProbeDir, 'paragraphs-probe.svg');
  writeFileSync(paraProbePath, paraProbeSource);

  try {
    execFileSync(
      'typst',
      ['compile', '--font-path', resolve('fonts'), paraProbePath, paraProbeSvgPath],
      { stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 },
    );
    const svg = readFileSync(paraProbeSvgPath, 'utf8');

    const xOf = (fill, label) => {
      const shapes = svgShapesByFill(svg, fill);
      if (shapes.length === 0) {
        fail.push(`tools/check.mjs: the paragraphs probe found no marker for "${label}" — `
          + 'update the probe in this gate');
        return null;
      }
      return shapes[0].abs[0];
    };

    const checks = [
      [AFTER_HEADING_FILL, 'after a heading', PARA_MARGIN_PT],
      [MID_FLOW_FILL, 'mid-flow inside block-indented', PARA_MARGIN_PT + paraIndentPt],
      [WRAPPER_FIRST_FILL, "block-indented's own first paragraph, not after a heading", PARA_MARGIN_PT + paraIndentPt],
      [SPACED_FIRST_FILL, "block-spaced's first paragraph", PARA_MARGIN_PT],
      [SPACED_SECOND_FILL, "block-spaced's second paragraph", PARA_MARGIN_PT],
    ];
    for (const [fill, label, expectedX] of checks) {
      const x = xOf(fill, label);
      if (x === null) continue;
      if (Math.abs(x - expectedX) > 0.5) {
        fail.push(`typeset.typ: the paragraph marked "${label}" rendered at x=${x.toFixed(2)}pt, `
          + `expected ${expectedX.toFixed(2)}pt (page margin ${PARA_MARGIN_PT}pt`
          + `${expectedX !== PARA_MARGIN_PT ? ` + ${paraIndentPt}pt indent` : ', flush'})`);
      }
    }
  } catch (err) {
    const detail = (err.stderr ? err.stderr.toString() : String(err.message || err)).trim();
    fail.push(`typeset.typ: the paragraphs probe failed to compile:\n${detail}`);
  }
} finally {
  rmSync(paraProbeDir, { recursive: true, force: true });
}

/* ---- 12. justified() / ragged-right() — stated alignment, compose, last
            line, and hyphenation tied to `lang` ------------------------- */

/* spec.json's justification section pairs two principles that only bite
   together: "alignment inherits, and so does last-line alignment" and "a
   block that sets its own alignment must also set its own last-line
   alignment, or the document's justification flushes its last line ... to
   the left". Typst has no separate "last line" parameter to set — a
   paragraph's last line is resolved against the same ambient alignment as
   every other line, so the only way for `justified`/`ragged-right` to state
   their OWN alignment (and, by construction, their own last-line alignment)
   is to set that ambient alignment themselves, not merely `justify`. A
   function relying on Typst's own left default is indistinguishable from one
   that states it, right up until something nests it inside another
   alignment — so this gate does that nesting, rather than trusting the
   source. */

const justificationSpec = spec.sections.find((s) => s.id === 'justification');
const raggedProps = justificationSpec.elements.find((e) => e.id === 'justification-ragged').properties;
const justifiedProps = justificationSpec.elements.find((e) => e.id === 'justification-justified').properties;

/* ---- 12a. Literal shape: each function's own source states what it must -- */

const raggedSigMatch = /#let ragged-right\(([^)]*)\) = \{\n([\s\S]*?)\n\}/.exec(typ);
const justifiedSigMatch = /#let justified\(([^)]*)\) = \{\n([\s\S]*?)\n\}/.exec(typ);

if (!raggedSigMatch) {
  fail.push('typeset.typ: ragged-right was not found in the shape this gate expects — update the '
    + 'gate if the function was deliberately restructured');
} else {
  const [, sig, body] = raggedSigMatch;
  if (!/^indented: false, lang: "en", body$/.test(sig.trim())) {
    fail.push(`typeset.typ: ragged-right's parameters are (${sig.trim()}) — expected exactly `
      + '(indented: false, lang: "en", body), so hyphenation is never exposed as a parameter '
      + 'independent of `lang`');
  }
  if (!/set align\(left\)/.test(body)) {
    fail.push('typeset.typ: ragged-right does not `set align(left)` — Typst resolves a paragraph\'s '
      + 'last line against the ambient alignment, so without this the block is only ragged, and its '
      + 'last line only flush left, where it happens to already be nested in a left-aligned context');
  }
  if (!/justify:\s*false/.test(body)) {
    fail.push(`typeset.typ: ragged-right does not set justify: false, contradicting `
      + `justification-ragged.align ("${raggedProps.align}")`);
  }
  if (!/set text\(hyphenate:\s*false\)/.test(body)) {
    fail.push(`typeset.typ: ragged-right does not unconditionally set hyphenate: false, contradicting `
      + `justification-ragged.hyphenation ("${raggedProps.hyphenation}") — hyphenation exists to serve `
      + 'justification, so ragged text must never hyphenate, `lang` or not');
  }
}

if (!justifiedSigMatch) {
  fail.push('typeset.typ: justified was not found in the shape this gate expects — update the gate '
    + 'if the function was deliberately restructured');
} else {
  const [, sig, body] = justifiedSigMatch;
  if (!/^indented: false, lang: "en", body$/.test(sig.trim())) {
    fail.push(`typeset.typ: justified's parameters are (${sig.trim()}) — expected exactly `
      + '(indented: false, lang: "en", body), so hyphenation is never exposed as a parameter '
      + 'independent of `lang`');
  }
  if (!/set align\(left\)/.test(body)) {
    fail.push('typeset.typ: justified does not `set align(left)` — Typst resolves a paragraph\'s '
      + 'last line against the ambient alignment, so without this the block is only flush left, on '
      + 'its last line or its only line, where it happens to already be nested in a left-aligned '
      + `context, contradicting justification-justified.align_last_line ("${justifiedProps.align_last_line}")`);
  }
  if (!/justify:\s*true/.test(body)) {
    fail.push(`typeset.typ: justified does not set justify: true, contradicting `
      + `justification-justified.align ("${justifiedProps.align}")`);
  }
  if (!/set text\(hyphenate:\s*lang\s*!=\s*none\)/.test(body)) {
    fail.push('typeset.typ: justified does not tie hyphenate to `lang != none` — spec.json states '
      + 'hyphenation is per-language and requires the document language to be declared, so `justified` '
      + `must derive hyphenation from \`lang\` alone (justification-justified.hyphenation: `
      + `"${justifiedProps.hyphenation}")`);
  }
}

/* The four hyphenation-tuning numbers justification-justified declares have
   no Typst parameter behind them at all — `text()` takes only
   `hyphenate: bool`, confirmed by compiling `#set text(hyphenation_min_word_chars: 6)`
   and reading back "unexpected argument" from the compiler itself, not
   assumed from documentation. There is no code to gate here, only prose — so
   this gate holds typeset.typ's own account of the gap to spec.json's
   numbers, the same way a fallback note is gated elsewhere in this file,
   rather than letting the two drift apart silently. */
const HYPHENATION_TUNING_KEYS = [
  'hyphenation_min_word_chars', 'hyphenation_min_chars_before_break',
  'hyphenation_min_chars_after_break', 'max_consecutive_hyphens',
];
for (const key of HYPHENATION_TUNING_KEYS) {
  const value = justifiedProps[key];
  if (!new RegExp(`${key} \\(${value}\\)`).test(typ)) {
    fail.push(`typeset.typ: no comment near justified()/ragged-right() documents `
      + `justification-justified.${key} as ${value} — spec.json and the file's own account of what `
      + 'Typst cannot enforce have drifted apart');
  }
}

/* ---- 12b. Rendered proof: ambient alignment must not survive nesting ----- */

/* Reuses gate 6's stack-based matrix walk (svgShapesByFill), but for the
   paragraph text itself rather than a marker rect: every <g class="typst-text">
   run, with its absolute origin and its glyphs' absolute x. Grouped by line
   (rounded y) because a hyphenated line renders as two runs — the word and
   its hyphen — sharing one y. */
function svgTextRuns(svgText) {
  const tagRe = /<([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>|<\/([a-zA-Z][\w:-]*)>/g;
  const attrRe = /([\w:-]+)="([^"]*)"/g;
  const parseMatrix = (t) => {
    const m = /matrix\(([^)]+)\)/.exec(t);
    return m ? m[1].trim().split(/[\s,]+/).map(Number) : null;
  };
  const multiply = (m1, m2) => {
    const [a1, b1, c1, d1, e1, f1] = m1;
    const [a2, b2, c2, d2, e2, f2] = m2;
    return [
      a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
      a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
      a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1,
    ];
  };
  const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

  const stack = [[1, 0, 0, 1, 0, 0]];
  const runs = [];
  let openRun = null;
  let match;
  while ((match = tagRe.exec(svgText))) {
    const [, openTag, attrsText, selfClose, closeTag] = match;
    if (closeTag) {
      if (closeTag === 'g') {
        if (openRun && stack.length - 1 === openRun.depth) {
          runs.push(openRun);
          openRun = null;
        }
        stack.pop();
      }
      continue;
    }
    const attrs = {};
    if (attrsText) {
      attrRe.lastIndex = 0;
      let am;
      while ((am = attrRe.exec(attrsText))) attrs[am[1]] = am[2];
    }
    let matrix = stack[stack.length - 1];
    if (attrs.transform) {
      const mm = parseMatrix(attrs.transform);
      if (mm) matrix = multiply(matrix, mm);
    }
    if (openTag === 'g') {
      if (!selfClose) {
        stack.push(matrix);
        if (openRun === null && attrs.class === 'typst-text') {
          openRun = { depth: stack.length - 1, matrix, glyphs: [] };
        }
      }
    } else if (openTag === 'use' && openRun !== null) {
      const x = Number(attrs.x ?? '0');
      openRun.glyphs.push(apply(openRun.matrix, x, 0)[0]);
    }
  }
  const byLine = new Map();
  for (const r of runs) {
    const y = Math.round(r.matrix[5] * 100) / 100;
    const line = byLine.get(y) ?? { y, count: 0, lastX: -Infinity, firstX: Infinity };
    line.count += r.glyphs.length;
    if (r.glyphs.length) {
      line.lastX = Math.max(line.lastX, r.glyphs[r.glyphs.length - 1]);
      line.firstX = Math.min(line.firstX, r.matrix[4]);
    }
    byLine.set(y, line);
  }
  return [...byLine.values()].sort((a, b) => a.y - b.y);
}

function compileSvgProbe(dir, name, source) {
  const path = join(dir, `${name}.typ`);
  const svgPath = join(dir, `${name}.svg`);
  writeFileSync(path, source);
  execFileSync(
    'typst',
    ['compile', '--font-path', resolve('fonts'), path, svgPath],
    { stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 },
  );
  return readFileSync(svgPath, 'utf8');
}

const alignProbeDir = mkdtempSync(join(tmpdir(), 'typeset-justification-check-'));
try {
  copyFileSync('implementations/typeset.typ', join(alignProbeDir, 'typeset.typ'));

  /* A one-liner is its own last line — exactly the case the spec's own
     example names ("its only line, for a one-liner"). Nested inside an
     ambient #align(center), a function that never states its own alignment
     would centre this line; one that states align(left) will not, no matter
     what surrounds it. */
  const ambientSource = (fn) => `#import "typeset.typ": *\n`
    + `#set page(width: 200pt, height: auto, margin: 0pt)\n#set text(size: 10pt)\n`
    + `#align(center, ${fn}[Short line.])\n`;

  for (const fn of ['ragged-right', 'justified']) {
    try {
      const svg = compileSvgProbe(alignProbeDir, `ambient-${fn}`, ambientSource(fn));
      const lines = svgTextRuns(svg);
      if (lines.length !== 1) {
        fail.push(`tools/check.mjs: the ambient-alignment probe for ${fn} rendered `
          + `${lines.length} lines, expected exactly 1 — update the probe`);
      } else if (Math.abs(lines[0].firstX) > 0.5) {
        fail.push(`typeset.typ: ${fn}[...] nested inside #align(center, ..) starts at `
          + `x=${lines[0].firstX.toFixed(2)}pt instead of flush left (x=0) — its alignment (and, for `
          + 'a one-liner, its last-line alignment) is following the ambient #align rather than its '
          + 'own explicit `set align(left)`');
      }
    } catch (err) {
      const detail = (err.stderr ? err.stderr.toString() : String(err.message || err)).trim();
      fail.push(`typeset.typ: the ambient-alignment probe for ${fn} failed to compile:\n${detail}`);
    }
  }

  /* ---- 12c. Rendered proof: compose with typeset(justified: ..), and the
              last line is never stretched ----------------------------- */

  /* One sentence, one width (`measure: 200pt` on the real typeset(), not a
     bare #set page — so this exercises the actual document-wide parameter
     Step 3 names), long enough to wrap into exactly two lines with a
     deliberately raggy natural break: `lang: none` on every call here so
     hyphenation never moves the break point, keeping this probe reasoning
     about alignment alone. Reused, unmodified, by the hyphenation probe
     below via its own `lang: "en"` variant. */
  const COMPOSE_TEXT = 'Alpha bravo charlie delta echo incomprehensibility zulu.';
  const composeDoc = (setup, call) => `#import "typeset.typ": *\n`
    + `#show: typeset.with(measure: 200pt${setup})\n#${call}[${COMPOSE_TEXT}]\n`;

  const raggedInJustifiedSvg = compileSvgProbe(
    alignProbeDir, 'compose-ragged-in-justified',
    composeDoc(', justified: true', 'ragged-right(lang: none)'),
  );
  const justifiedInRaggedSvg = compileSvgProbe(
    alignProbeDir, 'compose-justified-in-ragged',
    composeDoc('', 'justified(lang: none)'),
  );

  const raggedLines = svgTextRuns(raggedInJustifiedSvg);
  const justifiedLines = svgTextRuns(justifiedInRaggedSvg);

  if (raggedLines.length !== 2 || justifiedLines.length !== 2) {
    fail.push(`tools/check.mjs: the compose probe wrapped "${COMPOSE_TEXT}" to `
      + `${raggedLines.length} (ragged-right) and ${justifiedLines.length} (justified) lines at `
      + 'measure: 200pt, expected exactly 2 from each — update the probe text or width');
  } else {
    const [raggedFirst, raggedLast] = raggedLines;
    const [justifiedFirst, justifiedLast] = justifiedLines;

    /* Direction 1: #ragged-right inside `typeset(justified: true)` must
       still be ragged — its first line must fall well short of the measure
       that a justified sibling reaches, not merely "somewhat less". */
    /* Direction 2: #justified inside the (ragged) document default must
       reach the measure its ragged-right sibling does not. Checked as one
       comparison: the gap between the two first lines' right edges must be
       large, in the direction justified > ragged, so a mutation that makes
       either function ignore its own setting and follow the document
       default instead collapses this gap rather than merely shrinking it. */
    const gap = justifiedFirst.lastX - raggedFirst.lastX;
    if (gap < 20) {
      fail.push(`typeset.typ: justified()'s first line ends ${justifiedFirst.lastX.toFixed(2)}pt from `
        + `the left and ragged-right()'s ends ${raggedFirst.lastX.toFixed(2)}pt, a gap of only `
        + `${gap.toFixed(2)}pt — expected justified() to reach measurably further right, proving it `
        + 'stretches its non-last line to the measure regardless of the document default, and that '
        + 'ragged-right() does not, regardless of typeset(justified: true)');
    }

    /* The last line is never stretched — spec.json states this explicitly,
       naming the exact failure mode (a paginating engine fragments the text
       so the true last line stops looking like one and gets justified
       anyway). Both probes wrap the same words to the same two lines, so
       their LAST lines must end at the same x: if justify reached the last
       line here, justifiedLast would move right of raggedLast. */
    const lastLineDrift = Math.abs(justifiedLast.lastX - raggedLast.lastX);
    if (lastLineDrift > 1) {
      fail.push(`typeset.typ: justified()'s last line ends ${justifiedLast.lastX.toFixed(2)}pt from `
        + `the left, ragged-right()'s ends ${raggedLast.lastX.toFixed(2)}pt (both wrapping `
        + `"${COMPOSE_TEXT}" at measure: 200pt) — the last line of a justified paragraph must never `
        + 'be stretched, so the two should end at the same place');
    }
  }

  /* ---- 12d. Rendered proof: hyphenation is tied to `lang`, not a knob ---- */

  /* Same sentence and width, `justified(lang: "en")` this time: a real
     English hyphenation dictionary is now available, so "incomprehensibility"
     can break and leave less of itself on the wrapped (last) line than the
     `lang: none` variant above does. ragged-right(lang: "en") must NOT
     hyphenate even though a language is declared — hyphenation exists only
     to serve justification. */
  const justifiedEnSvg = compileSvgProbe(
    alignProbeDir, 'hyphenation-justified-en',
    composeDoc('', 'justified(lang: "en")'),
  );
  const raggedEnSvg = compileSvgProbe(
    alignProbeDir, 'hyphenation-ragged-en',
    composeDoc('', 'ragged-right(lang: "en")'),
  );
  const justifiedEnLines = svgTextRuns(justifiedEnSvg);
  const raggedEnLines = svgTextRuns(raggedEnSvg);

  if (justifiedEnLines.length !== 2 || raggedEnLines.length !== 2) {
    fail.push('tools/check.mjs: the hyphenation probe did not wrap to 2 lines for both '
      + `justified(lang: "en") (${justifiedEnLines.length}) and ragged-right(lang: "en") `
      + `(${raggedEnLines.length}) — update the probe text or width`);
  } else {
    const justifiedNoneLast = justifiedLines[1];
    const hyphenatedDrop = justifiedNoneLast.count - justifiedEnLines[1].count;
    if (hyphenatedDrop < 5) {
      fail.push(`typeset.typ: justified(lang: "en")'s last line carries ${justifiedEnLines[1].count} `
        + `glyphs against justified(lang: none)'s ${justifiedNoneLast.count} at the same measure — `
        + 'expected "incomprehensibility" to hyphenate and leave markedly fewer glyphs on the wrapped '
        + 'line when a language is declared, proving hyphenation is actually reading `lang`');
    }
    const raggedEnDrop = Math.abs(raggedEnLines[1].count - raggedLines[1].count);
    if (raggedEnDrop > 2) {
      fail.push(`typeset.typ: ragged-right(lang: "en")'s last line carries ${raggedEnLines[1].count} `
        + `glyphs against ragged-right(lang: none)'s ${raggedLines[1].count} — expected them to match, `
        + 'since ragged text must never hyphenate regardless of `lang`');
    }
  }
} finally {
  rmSync(alignProbeDir, { recursive: true, force: true });
}

/* ---- 12e. The demo must cover the case, not configure around it --------- */

const justificationDemo = readFileSync('src/demos/justification.typ', 'utf8');
if (/#set par|#set text/.test(justificationDemo)) {
  fail.push('src/demos/justification.typ: uses #set par or #set text directly — the point of '
    + 'justified()/ragged-right() is that an author never has to');
}

const bibliographyDemo = readFileSync('src/demos/bibliography.typ', 'utf8');
if (/#set par|#set text/.test(bibliographyDemo)) {
  fail.push('src/demos/bibliography.typ: uses #set par or #set text directly — the point of '
    + 'references()/reference() is that an author never has to');
}

/* ---- 13. key() must match inline-kbd, bottom edge strictly heavier than
            the other three ------------------------------------------------ */

/* A keycap's whole visual signature is that one edge, per inline-kbd's
   border vs border_bottom — a stroke that goes back to one flat weight on
   all four sides renders as a plain bordered box, not a keycap, so this
   gate asserts the inequality itself and not just that the two numbers are
   present somewhere in the function. */

const inlineSpec = spec.sections.find((s) => s.id === 'inline');
const kbdProps = inlineSpec.elements.find((e) => e.id === 'inline-kbd').properties;

const keyMatch = /#let key\(body\) = box\(\n([\s\S]*?)\n\)/.exec(typ);
if (!keyMatch) {
  fail.push('typeset.typ: key() was not found in the shape this gate expects — update the gate if '
    + 'the function was deliberately restructured');
} else {
  const body = keyMatch[1];
  const [specPadY, specPadX] = kbdProps.padding.split(' ');

  const insetMatch = /inset:\s*\(x:\s*([^,]+),\s*y:\s*([^)]+)\)/.exec(body);
  const gotInset = insetMatch && `${insetMatch[1].trim()}|${insetMatch[2].trim()}`;
  if (gotInset !== `${specPadX}|${specPadY}`) {
    fail.push(`typeset.typ: key()'s inset is ${insetMatch ? `(x: ${insetMatch[1].trim()}, y: ${insetMatch[2].trim()})` : 'missing'}, `
      + `expected (x: ${specPadX}, y: ${specPadY}) from inline-kbd.padding ("${kbdProps.padding}")`);
  }

  if (!new RegExp(`radius:\\s*${kbdProps.radius}\\b`).test(body)) {
    fail.push(`typeset.typ: key()'s radius does not match inline-kbd.radius ("${kbdProps.radius}")`);
  }

  const sizeMatch = /text\(font: sans, size:\s*([\d.]+em),/.exec(body);
  if (sizeMatch?.[1] !== kbdProps.size) {
    fail.push(`typeset.typ: key()'s text size is ${sizeMatch ? sizeMatch[1] : 'missing'}, expected `
      + `inline-kbd.size ("${kbdProps.size}")`);
  }

  const strokeMatch = /stroke:\s*\(rest:\s*([\d.]+)pt \+ rule-color, bottom:\s*([\d.]+)pt \+ rule-color\)/
    .exec(body);
  if (!strokeMatch) {
    fail.push('typeset.typ: key()\'s stroke is not the dictionary form (rest: <N>pt + rule-color, '
      + 'bottom: <N>pt + rule-color) that lets one edge carry a different weight than the other three');
  } else {
    const [, restWidth, bottomWidth] = strokeMatch;
    const specBorder = /^([\d.]+)pt rule$/.exec(kbdProps.border)?.[1];
    const specBorderBottom = /^([\d.]+)pt rule$/.exec(kbdProps.border_bottom)?.[1];
    if (restWidth !== specBorder) {
      fail.push(`typeset.typ: key()'s stroke is ${restWidth}pt on the other three sides, expected `
        + `inline-kbd.border ("${kbdProps.border}")`);
    }
    if (bottomWidth !== specBorderBottom) {
      fail.push(`typeset.typ: key()'s bottom stroke is ${bottomWidth}pt, expected inline-kbd.border_bottom `
        + `("${kbdProps.border_bottom}")`);
    }
    if (Number(bottomWidth) <= Number(restWidth)) {
      fail.push(`typeset.typ: key()'s bottom stroke (${bottomWidth}pt) is not heavier than its other `
        + `three sides (${restWidth}pt) — a keycap reads by that asymmetry alone, so a flattened stroke `
        + 'renders as a plain bordered box');
    }
  }
}

/* ---- 14. reference() must not double the punctuation between an author's
            own facts and the template's own -------------------------------- */

/* references()/reference() compose the punctuation between the facts an
   author supplies — author roman, title italic, the rest in order, "the
   punctuation between them the template's business and not the author's".
   A parameter an author supplies with its own trailing mark (an
   `edition: [4th ed.]`, a `publisher: [Hyphen Press.]`) therefore produces a
   doubled one once composed: this class of bug shipped once, in the demo
   itself, caught only by rendering it and reading the result, not by any
   gate. This is that gate.

   It has to read RENDERED text, not typeset.typ's source: the doubling is a
   property of the composed content tree at the point two adjacent runs of
   text meet, which no regex over a #let's own source could see — the
   template's own period is written once, in one place, regardless of how
   many times an author's value happens to collide with it.

   `typst query` serializes a labelled region of the compiled document to
   JSON; every leaf run of text is {"func": "text", "text": "..."} and every
   literal space is {"func": "space"}, both in reading order, so walking that
   tree and rejoining them reconstructs exactly what a reader sees — without
   a PDF/SVG text-extraction dependency this file would otherwise need.

   references() itself opens on `context` (it reads ts-two-column-body), and
   a label on unresolved context content queries as the raw, unevaluated
   context node rather than its rendered children — so this probes
   reference()'s own composition directly: the demo's `#references[...]`
   wrapper is stripped down to its entries, which are plain, immediately-
   resolvable content (no context of their own), and re-wrapped in a label
   this gate can query. */

function collectQueryText(node, out) {
  if (Array.isArray(node)) {
    for (const child of node) collectQueryText(child, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.func === 'text' && typeof node.text === 'string') {
    out.push(node.text);
    return;
  }
  if (node.func === 'space') {
    out.push(' ');
    return;
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') collectQueryText(value, out);
  }
}

if (typstAvailable()) {
  const bibliographyDemo = readFileSync('src/demos/bibliography.typ', 'utf8');
  const entriesMatch = /^#references(?:\([^\n]*\))?\[\n([\s\S]*)\n\]\n?$/.exec(bibliographyDemo);
  if (!entriesMatch) {
    fail.push('tools/check.mjs: src/demos/bibliography.typ is not in the shape this gate expects '
      + '(a single #references[ ... ] wrapping the entries) — update the gate if the demo was '
      + 'deliberately restructured');
  } else {
    const bibProbeDir = mkdtempSync(join(tmpdir(), 'typeset-bib-punct-check-'));
    try {
      copyFileSync('implementations/typeset.typ', join(bibProbeDir, 'typeset.typ'));
      const probeDoc = typstDocument(`#[\n${entriesMatch[1]}\n] <bib-punctuation-check>`);
      const probePath = join(bibProbeDir, 'bib-punctuation-check.typ');
      writeFileSync(probePath, probeDoc);

      let queryResult;
      try {
        const out = execFileSync(
          'typst',
          ['query', '--font-path', resolve('fonts'), probePath, '<bib-punctuation-check>'],
          { stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 },
        );
        queryResult = JSON.parse(out.toString());
      } catch (err) {
        const detail = (err.stderr ? err.stderr.toString() : String(err.message || err)).trim();
        fail.push(`src/demos/bibliography.typ: could not query the compiled reference text:\n${detail}`);
        queryResult = null;
      }

      if (queryResult) {
        const textPieces = [];
        collectQueryText(queryResult, textPieces);
        const text = textPieces.join('');
        const doubled = text.match(/([.,])\1|\.,|,\./g);
        if (doubled) {
          fail.push('src/demos/bibliography.typ: the rendered reference text contains doubled '
            + `punctuation (${[...new Set(doubled)].join(', ')}) in "${text.trim()}" — `
            + "reference() composes the punctuation between an author's facts, so a fact supplied "
            + 'with its own trailing "." or "," produces a doubled mark; check every reference() '
            + 'call\'s author, title, edition, publisher, year and note for one');
        }
      }
    } finally {
      rmSync(bibProbeDir, { recursive: true, force: true });
    }
  }
}

/* ---- Report ------------------------------------------------------------- */

const elements = spec.sections.reduce((n, s) => n + s.elements.length, 0);
console.log(`typeset spec ${spec.version} — ${spec.sections.length} sections, ${elements} elements`);
console.log(`  css markers ${cssIds.size} · typst markers ${typIds.size} · panels ${panelAttrs.length} · generated pages ${output.size}`);
for (const wn of warn) console.log(`  note: ${wn}`);
if (fail.length) reportFailuresAndExit();
console.log('\nall checks passed');
