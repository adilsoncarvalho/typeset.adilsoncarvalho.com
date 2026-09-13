/* Builds index.html and files/*.html from src/ plus spec.json and the two
   implementations. Everything the pages show is resolved here, at build time:
   the published site fetches nothing to render its content. The Typst example
   viewer pages are the one place that still reaches for JavaScript at load
   time — to swap in a message when previews/ has not been built, since this
   script has no compiler on PATH and so cannot tell at build time whether it
   has (see tools/build-previews.mjs).

   Run: node tools/build-site.mjs
   Verify: node tools/check.mjs
*/

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderPanel } from '../src/panels.mjs';
import { byLang, esc } from '../src/highlight.mjs';
import { EXAMPLES } from '../src/examples.mjs';
import { TEMPLATES, bundleZip } from '../src/templates.mjs';
import { extractDemos, verbatimLineMask } from '../src/extract.mjs';
import { typstBoilerplate } from '../src/boilerplate.mjs';

/* The whole file is highlighted in one pass — a multi-line CSS comment needs
   state that carries between lines — and only then split for numbering. */
function lineNumbered(source, lang) {
  const text = source.replace(/\n$/, '');
  const html = byLang(lang, text).split('\n');
  return text.split('\n').map((_, i) =>
    `<div class="line" id="L${i + 1}"><span class="no">${i + 1}</span>`
    + `<span class="src">${html[i] ?? ''}</span></div>`).join('');
}

const read = (p) => readFileSync(p, 'utf8');

/* The weight a face's filename names, where it names it in words. A file whose
   suffix is numeric carries the weight directly. */
const WEIGHT_NAMES = {
  '': 400, Thin: 100, ExtraLight: 200, Light: 300, Regular: 400,
  Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900,
};

/* The font-weight and font-style descriptors a face file must be bound with,
   read from the part of its name after the family: "-SemiBoldItalic", "-400",
   "-300", "-Italic". Returns null for a name this cannot read, which the
   caller turns into a build failure — a face bound with the wrong descriptors,
   or with none, is exactly the defect this block exists to prevent. Exported
   for tools/check.mjs, which holds implementations/iawriter/iawriter.css's
   hand-written @font-face block to the same derivation. */
export function faceDescriptors(file) {
  const stem = file.replace(/\.(otf|ttf|woff2?)$/i, '');
  const suffix = stem.slice(stem.indexOf('-') + 1);
  const italic = suffix.endsWith('Italic');
  const token = italic ? suffix.slice(0, -'Italic'.length) : suffix;
  const weight = /^\d+$/.test(token) ? Number(token) : WEIGHT_NAMES[token];
  if (weight === undefined) return null;
  return { weight, style: italic ? 'italic' : 'normal' };
}

/* ---- Where a page lives -------------------------------------------------- */

/* The specification and its specimens are served from /spec/, the templates
   from /templates/, and / is a router between the two. Every link inside the
   fragments under src/ is written as the site root sees it — "spec.json",
   "files/typeset-css.html" — because that is the form a reader reads, the form
   tools/check.mjs's reachability gates match against, and the form that stays
   correct if a page is ever served from somewhere else again. This is the one
   place that knows where a page was emitted. */
/* Named down to the index file rather than left as a directory: a bare
   "spec/" is served as the page by GitHub Pages but opens as a directory
   listing over file://, and this repository's pages are meant to open straight
   from a checkout. A reader who types /spec/ still gets the page. */
export const SPEC_PAGE = 'spec/index.html';
export const TEMPLATES_PAGE = 'templates/index.html';

/* Returns every generated file as path -> contents. Nothing is written here, so
   tools/check.mjs can rebuild in memory and compare against what is committed —
   which makes a stale generated page a build failure rather than a surprise. */
export function buildAll() {
const spec = JSON.parse(read('spec.json'));
const sections = JSON.parse(read('src/sections.json'));
const output = new Map();

/* ---- Marker extraction, the same contract the sources declare ------------- */

function markers(source, re, group) {
  const found = new Map();
  let m;
  while ((m = re.exec(source)) !== null) {
    found.set(m[1], m[group].replace(/\n{3,}/g, '\n\n').trim());
  }
  return found;
}

/* Full CSS source per "@s" region, for the sections whose panel.pane in
   sections.json is "css" rather than "html" — they state values rather
   than demonstrate a document, so there is no markup for a reader to copy
   and the values themselves are the thing on show. */
const cssMap = markers(read('typeset.css'),
  /\/\*!\s*@s\s+([a-z0-9-]+)\s*::[^\n]*\*\/\n([\s\S]*?)\/\*!\s*@e\s*\*\//g, 2);

/* The 1-based source line each "@s" marker starts at, for linking a section's
   HTML pane back to its region in files/typeset-css.html — which anchors
   every line with id="L<n>" (see lineNumbered() below). Read from the file
   itself rather than a hand-maintained table, so a line added above any
   marker cannot leave a stale link behind. */
function markerLines(source, re) {
  const found = new Map();
  let m;
  while ((m = re.exec(source)) !== null) {
    found.set(m[1], source.slice(0, m.index).split('\n').length);
  }
  return found;
}

const cssLines = markerLines(read('typeset.css'), /\/\*!\s*@s\s+([a-z0-9-]+)\s*::/g);

/* The same, for typeset.typ's "@s" markers, so a section's Typst pane can
   link into files/typeset-typ.html the way its HTML pane links into
   files/typeset-css.html. Not every section marks a region of its own —
   src/panels.mjs falls back from there. */
const typLines = markerLines(read('implementations/typeset.typ'), /\/\/\s*@s\s+([a-z0-9-]+)\s*\n/g);

/* ---- Page shell ---------------------------------------------------------- */

const FONTS = 'https://fonts.googleapis.com/css2'
  + '?family=EB+Garamond:ital,wght@0,400..800;1,400..800'
  + '&family=Source+Sans+3:ital,wght@0,300..700;1,300..700'
  + '&family=IBM+Plex+Mono:ital,wght@0,400;0,600;1,400&display=swap';

function shell({ title, description, head = '', preamble = '', body, scripts = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${preamble}<title>${title}</title>
<meta name="description" content="${esc(description)}">
<!-- Generated by tools/build-site.mjs from src/. Do not edit by hand. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
${head}</head>
<body>
${body}
${scripts}</body>
</html>
`;
}

/* Rewrites every site-internal href and src on a finished page so it resolves
   from a page nested `prefix` deep instead of from the site root. Left alone:
   a fragment-only href, which names a place on this page and would otherwise
   be sent to the root; an absolute URL; and anything escaped, because an
   escaped href sits inside a <pre> a reader copies — the boilerplate block
   links typeset.css from beside the reader's own file, not from this site. */
function relocate(html, prefix) {
  return html.replace(/(href|src)="([^"]+)"/g, (whole, attr, url) =>
    (/^(#|\/\/|[a-z][a-z0-9+.-]*:)/i.test(url) ? whole : `${attr}="${prefix}${url}"`));
}

/* The script that keeps every anchor the specification page ever published
   working after it moved to /spec/.

   GitHub Pages serves static files and has no redirects, and the one
   server-free alternative — <meta http-equiv="refresh"> — navigates to
   exactly the URL it names and drops the fragment the reader arrived with.
   Measured, not assumed: a reader following /#quote-epigraph through a meta
   refresh lands at the top of a very long page with nothing to say anything
   went wrong. location.replace() carries location.hash through verbatim, and
   replaces rather than pushes so Back leaves the site instead of bouncing.

   The allowlist is every id the specification page carries, read out of the
   built page itself, so an id added or renamed there moves this list with it.
   It is an allowlist rather than a blanket forward because / is a page in its
   own right now: a fragment it does not recognise belongs to whatever a
   reader was actually pointing at, and is left alone.

   The data-fragment-forward attribute and the `ids` literal are what
   tools/legacy-urls.mjs reads to answer whether an old anchor still resolves,
   without executing anything. */
function fragmentForwarder(page, to) {
  const ids = [...new Set([...page.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))].sort();
  const lines = [];
  for (const id of ids) {
    const quoted = `${JSON.stringify(id)},`;
    if (!lines.length || lines[lines.length - 1].length + quoted.length > 76) lines.push('    ');
    lines[lines.length - 1] += quoted;
  }
  return `<script data-fragment-forward="${to}">
/* Every anchor the specification page published before it moved to ${to} —
   generated by tools/build-site.mjs, gated by tools/check.mjs. */
(function () {
  var ids = [
${lines.join('\n').replace(/,$/, '')}
  ];
  var hash = location.hash.slice(1);
  if (!hash) return;
  if (ids.indexOf(decodeURIComponent(hash)) === -1) return;
  location.replace(${JSON.stringify(to)} + location.hash);
})();
</script>
`;
}

/* ---- What /spec/ is assembled from: its nav, its sections, its masthead -- */

function nav() {
  const groups = [...new Set(sections.map((s) => s.group))];
  const blocks = groups.map((g) => {
    /* The nav uses a shorter label than the section title where one is given:
       a sidebar entry has less room than a heading. */
    const items = sections.filter((s) => s.group === g)
      .map((s) => `    <li><a href="#${s.id}">${s.nav || s.title}</a></li>`).join('\n');
    return `  <p class="nav__group">${g}</p>\n  <ol>\n${items}\n  </ol>`;
  });
  /* The Conformance group names the same three documents twice, once per
     engine, and every row opens a page that renders one. Derived from
     src/examples.mjs rather than hand-typed here: while it was hand-typed the
     list lost "Letter, in Typst" entirely, ran the two engines interleaved,
     and pointed its Typst rows at raw .typ files a browser downloads. */
  const conformance = read('src/nav-bottom.html').trimEnd()
    .replace(/ *<li data-nav-examples="(css|typst)"><\/li>/g, (_, engine) =>
      EXAMPLES.map((e) => `    <li><a href="${EXAMPLE_PAGE[engine](e.id)}">`
        + `${exampleLabel(e.id)}, in ${engine === 'css' ? 'CSS' : 'Typst'} →</a></li>`).join('\n'));

  return [read('src/nav-top.html').trimEnd(), ...blocks, conformance].join('\n\n');
}

/* Sets a demo file at the depth the page nests it to, without touching a line
   whose leading whitespace is content rather than markup indentation. A <pre>
   is the case that matters: src/demos/codeblock.html holds a CSS sample whose
   own lines are indented two spaces, and prefixing those lines publishes the
   section about setting code with its own example misindented. Which lines
   those are is decided by src/extract.mjs's mask, so the demo column and the
   pane beside it agree about where whitespace is content. */
function indentMarkup(source, pad) {
  const text = source.trimEnd();
  const verbatim = verbatimLineMask(text);
  return text.split('\n')
    .map((line, i) => (line && !verbatim[i] ? pad + line : line))
    .join('\n');
}

function section(s, index) {
  const num = String(index + 1).padStart(2, '0');
  const prose = s.prose.map((p) => `    ${p}`).join('\n');
  const note = s.note ? `  ${s.note}\n` : '';
  const demoSource = read(`src/demos/${s.id}.html`);
  const demo = indentMarkup(demoSource, '      ');
  const fullrow = s.fullrow
    ? `\n${indentMarkup(read(`src/demos/${s.id}.fullrow.html`), '  ')}\n`
    : '';
  /* Left at its own indent, not re-indented line by line like demo/fullrow
     below: the panel's HTML and Typst panes hold <pre> content a reader
     copies, where whitespace is part of what gets copied, and prefixing
     every line would corrupt it. */
  const panel = renderPanel({
    spec, cssLines, cssMap, typLines, id: s.id,
    specIds: s.panel.spec,
    pane: s.panel.pane,
    cssKeys: (s.panel.css || s.panel.spec).split(',').map((k) => k.trim()),
    fragments: extractDemos(demoSource),
    typSource: read(`src/demos/${s.id}.typ`).trimEnd(),
  });

  return `<section class="section" id="${s.id}">
  <div class="section__head">
    <p class="section__num">${num} — ${s.group}</p>
    <h2>${s.title}</h2>
${prose}
  </div>
${note}  <div class="pair">
    <div>
${demo}
    </div>
    <div>
${panel}
    </div>
  </div>
${fullrow}</section>`;
}

const elementCount = spec.sections.reduce((n, s) => n + s.elements.length, 0);

/* "Page templates", not "templates": /templates/ uses the word for a document
   you write in, and this counts spec.json's page layouts — single-column and
   two-column. A reader who starts at the specification meets the number here
   and the route there, and nothing else on either page separates the two. */
const counts = (() => {
  const templates = Object.keys(spec.templates)
    .filter((k) => k !== 'default' && k !== 'note').length;
  return `${spec.sections.length} sections, ${elementCount} elements, ${templates} page templates`;
})();

/* ---- Masthead boilerplate -------------------------------------------------
   The block every reader needs once, above the sections: what to add around
   a copied HTML or Typst snippet to make it run. Both halves are read from
   the files that already own the values they state, so the block can never
   drift from the fonts fonts/ actually carries or the import shape
   typeset.typ actually declares. */

/* Every face the three spec families carry, each bound with the descriptors
   its own filename declares. A @font-face rule with no font-weight and no
   font-style tells the browser the file is the family's 400 upright, so it
   answers a request for 600 or for italic by slanting and smearing that one
   file — and typeset.css asks for sans 300/600/700 and for serif italic and
   semibold. Faux bold and faux italic on the front page of a typographic
   specification is the failure the specification exists to prevent, so the
   list is derived from fonts/manifest.json rather than hand-kept: a face that
   is added, renamed or removed moves this block with it. */
function boilerplateHtml() {
  const manifest = JSON.parse(read('fonts/manifest.json'));
  const blocks = ['serif', 'sans', 'mono'].map((role) => {
    const { family } = spec.foundation.fonts[role];
    const entry = manifest.families.find((f) => f.family === family && f.role === 'spec');
    if (!entry) {
      throw new Error(`fonts/manifest.json has no "spec" entry for ${family}, which `
        + `spec.foundation.fonts.${role} names — regenerate the manifest`);
    }
    return entry.faces.map((face) => {
      const d = faceDescriptors(face.file);
      if (!d) {
        throw new Error(`fonts/manifest.json: cannot read a weight and style out of `
          + `"${face.file}" — teach faceDescriptors() in tools/build-site.mjs its shape, `
          + 'or the masthead would bind it with no descriptors and the browser would '
          + 'synthesise every other weight from it');
      }
      return { ...d, src: `${entry.dir}/${face.file}`, family };
    })
      .sort((a, b) => (a.style === b.style ? a.weight - b.weight : (a.style === 'normal' ? -1 : 1)))
      .map((f) => `  @font-face { font-family: "${f.family}"; font-weight: ${f.weight};`
        + ` font-style: ${f.style}; src: url("${f.src}"); }`)
      .join('\n');
  });
  return esc(`<link rel="stylesheet" href="typeset.css">
<style>
${blocks.join('\n\n')}
</style>

<div class="typeset">
  <!-- the fragment from any HTML pane goes here -->
</div>`);
}

/* The same text tools/check.mjs compiles every snippet under, from the same
   function — so the block a reader is told to paste above a snippet and the
   block the gate proves a snippet runs under cannot be two different things. */
function boilerplateTypst() {
  return byLang('typst', typstBoilerplate());
}

/* "two-column" → "Two column". */
function exampleLabel(id) {
  return id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/* Where each engine renders a given example document. The three documents
   exist in both, which is what makes them conformance samples rather than
   demos, so one id names a page in each. */
const EXAMPLE_PAGE = {
  css: (id) => `examples/${id}.html`,
  typst: (id) => `files/example-${id}.html`,
};

/* One button per shipped example, in src/examples.mjs's own order, under the
   engine that renders it — the same source the viewer pages below come from,
   so an example added, renamed or reordered there moves here with it rather
   than needing a second, hand-kept button list. */
function exampleButtons(engine) {
  return EXAMPLES.map((e) => `<a class="btn" href="${EXAMPLE_PAGE[engine](e.id)}">`
    + `${exampleLabel(e.id)}</a>`).join('\n        ');
}

const masthead = read('src/masthead.html').trimEnd()
  .replace('<span data-spec-counts>every value</span>', counts)
  .replace('<span data-spec-version>—</span>', `${spec.version} · ${spec.updated}`)
  .replace('<span data-css-examples></span>', exampleButtons('css'))
  .replace('<span data-typst-examples></span>', exampleButtons('typst'))
  .replace('<code data-boilerplate="html"></code>', `<code data-boilerplate="html">${boilerplateHtml()}</code>`)
  .replace('<code data-boilerplate="typst"></code>', `<code data-boilerplate="typst">${boilerplateTypst()}</code>`);

/* ---- /spec/ — the specification and its specimens ----------------------- */

const specPage = shell({
  title: 'The specification — typeset',
  description: "Adilson Carvalho's typographic specification for printed documents: "
    + 'essays, letters, reports. Rendered examples beside the values every engine must hit.',
  head: `<link rel="stylesheet" href="typeset.css">\n<link rel="stylesheet" href="specimen.css">\n`,
  body: `<div class="shell">

<nav class="nav">
  <p class="nav__brand"><a href="index.html">typeset</a></p>
  <p class="nav__tagline">A typographic standard for printed documents.</p>

${nav()}
</nav>

<main class="main" id="top">

${masthead}

${sections.map(section).join('\n\n')}

${read('src/footer.html').trimEnd()}

</main>
</div>`,
  scripts: '<script src="specimen.js" defer></script>\n',
});

output.set(SPEC_PAGE, relocate(specPage, '../'));

/* ---- /templates/ — what you can write in ------------------------------- */

/* The iA Writer letter is the one template that ships. Its own page —
   files/iawriter-css.html, built from src/viewers.json below — carries the
   full account of what Markdown can and cannot express and what the bundle
   contains; this page names the template, offers the download, and sends a
   reader there rather than keeping a second copy of that prose.

   The bundle filename itself comes from src/templates.mjs, the one place
   that names it — see that file's own comment for the other readers. */
const letterTemplate = TEMPLATES.find((t) => t.dir === 'letter');
const TEMPLATE_BUNDLE = `downloads/${bundleZip(letterTemplate)}`;

/* ---- The capability matrix ----------------------------------------------- */

/* What each conformant engine can express, published so a reader can tell
   which template to reach for before downloading one — and, sometimes, that
   the honest answer is "not this one". A "no" states why in the same breath,
   and every cell points at where this repository already proves it rather
   than asserting it fresh. tools/check.mjs section 28 holds every cell to
   that rule, because the one shape it forbids — a bare word — reads as
   perfectly plausible and nothing else here looks at a cell at all:

   - "Every element expressible" counts spec.json's elements and its
     `fallback` fields: a fallback prefixed "in Typst:" names a property that
     engine cannot honour, and section 3m of tools/check.mjs holds the two of
     them to what Typst actually renders. Counted rather than asserted because
     spec.json, llms.txt and README.md's engine-capability table each already
     answer this, and a fourth answer written by hand here would be the one
     nothing checks.
   - The footnote row quotes spec.json's own "note" section — its principles
     explain which engines can place a footnote at the page foot, and its
     note-footnote element's `fallback` names what a note degrades to where
     they can't. Both are read here, not retyped.
   - "Paginated two columns" and "Running head and folio" link straight into
     the marked @s region of typeset.css or typeset.typ that implements the
     row — the same cssLines/typLines markers section() uses above — so the
     claim points at the working code instead of a description of it.
   - Every iA Writer cell links to files/iawriter-css.html, whose own prose
     (src/viewers.json) and README.md's "Engine capability" section already
     carry the WebKit and margin-reservation reasons in full; this table
     states the same facts at table length, not a second, drifting account
     of them. */
function capabilityMatrix() {
  const noteSection = spec.sections.find((s) => s.id === 'note');
  /* Matched on what the sentence says, not on its position in the array: the
     cell publishes this as the reason WeasyPrint and Prince are the only CSS
     engines that place a note at the page foot, and a principle inserted at
     the front of the section would otherwise republish a different sentence
     as that reason with nothing to notice. */
  const footnoteWhy = noteSection.principles.find((p) => /WeasyPrint/.test(p) && /Prince/.test(p));
  if (!footnoteWhy) {
    throw new Error('spec.json: the "note" section has no principle naming WeasyPrint and '
      + 'Prince — the capability matrix quotes it as the reason those two engines are '
      + 'required, and must not fall back to quoting whichever principle comes first');
  }
  const footnoteFallback = noteSection.elements.find((e) => e.id === 'note-footnote').fallback;
  const cssAt = (id) => `files/typeset-css.html#L${cssLines.get(id)}`;
  const typAt = (id) => `files/typeset-typ.html#L${typLines.get(id)}`;
  const IAW = 'files/iawriter-css.html';

  /* Which elements fall short, and in which engine, comes off spec.json's own
     `fallback` fields rather than being asserted here: a fallback prefixed
     "in Typst:" names a property that engine cannot honour, and the rest name
     what an engine that cannot measure the page as it lays it out degrades to.
     tools/check.mjs section 3m holds the two Typst ones to what Typst actually
     renders, so the day one comes off spec.json this row follows it. */
  const withFallback = spec.sections.flatMap((s) => s.elements
    .filter((e) => e.fallback)
    .map((e) => ({ section: s.id, id: e.id, name: e.name, fallback: e.fallback })));
  const typstShort = withFallback.filter((e) => /^in Typst:/i.test(e.fallback));
  const pagedShort = withFallback.filter((e) => !/^in Typst:/i.test(e.fallback));
  /* Named by spec.json's own element id rather than by the element's display
     name: two of the six are called "Entry" and two are called "Footnote", so
     the names alone do not say which element a reader should go and read. */
  const specLink = (e) => `<a href="${SPEC_PAGE}#${e.section}"><code>${esc(e.id)}</code></a>`;
  const list = (els) => els.map(specLink)
    .reduce((acc, x, i, all) => acc + (i === 0 ? '' : i === all.length - 1 ? ' and ' : ', ') + x, '');

  const rows = [
    {
      /* Named for what it measures. "Every element" is a question about the
         vocabulary — whether the engine has a form for the thing at all — and
         the three rows under it are the question about depth. Stated as one
         row of "yes" it read as both, and the repository answers the second
         one differently in four places. */
      feature: 'Every element expressible',
      css: `<a href="files/typeset-css.html">all ${elementCount}</a> — every element the `
        + 'specification names has a form in CSS. How much of one reaches the page is a '
        + 'question about the engine, and the three rows below are where that gap is widest; '
        + `${pagedShort.length} elements carry a <code>fallback</code> in `
        + '<a href="spec.json">spec.json</a> naming what they degrade to where an engine '
        + `cannot honour them in full — ${list(pagedShort)}.`,
      typst: `<a href="files/typeset-typ.html">all ${elementCount}</a> — every element has a `
        + `Typst form; ${typstShort.length} fall short of the full property set: `
        + `${list(typstShort)} lose their runover indent, per each one's <code>fallback</code> `
        + `in spec.json. The <a href="${typAt('dropcap')}">drop cap</a> is set in the margin `
        + 'rather than wrapped, because Typst has no float.',
      iawriter: `<a href="${IAW}">Markdown subset only</a> — headings, body text, bold, `
        + `italic, tables and footnotes; not the ${elementCount} elements the specification `
        + 'names, and not signature blocks, callouts, sidenotes or drop caps, which Markdown '
        + 'has no markup for.',
    },
    {
      feature: 'Paginated two columns',
      css: `<a href="${cssAt('two-column')}">no</a> — Paged.js paginates by moving content `
        + 'between page boxes and cannot fragment a column flow; '
        + '<a href="examples/two-column.html">the two-column example</a> drops Paged.js '
        + "entirely and lets the browser's own print produce the columns instead.",
      typst: `<a href="${typAt('two-column')}">yes, natively</a>`,
      iawriter: `<a href="${IAW}">no</a> — WebKit's print path ignores every CSS `
        + 'multi-column property, so a two-column template previews correctly on screen '
        + 'and exports as a single column.',
    },
    {
      feature: 'Running head and folio',
      css: `<a href="${cssAt('page')}">yes, via CSS Paged Media</a> — Chrome's own print `
        + 'dialog ignores the margin boxes a running head and folio need; only a '
        + 'paged-media engine (Paged.js, WeasyPrint, Prince) renders them.',
      typst: `<a href="${typAt('page')}">yes, natively</a>`,
      iawriter: `<a href="${IAW}">no</a> — iA Writer reserves the top and bottom bands `
        + "itself, by setting the page margins directly; a template's own @page margin "
        + 'would replace that reservation rather than add to it.',
    },
    {
      feature: 'True page-foot footnotes',
      css: `<a href="${cssAt('note')}">WeasyPrint and Prince only</a> — per spec.json: `
        + `“${esc(footnoteWhy)}”`,
      typst: `<a href="${typAt('note')}">yes, natively</a>`,
      iawriter: `<a href="${IAW}">no</a> — Markdown has no page-position construct for a `
        + `note, so it degrades to ${esc(footnoteFallback)}.`,
    },
  ];

  const body = rows.map((r) => `      <tr>
        <th scope="row">${r.feature}</th>
        <td>${r.css}</td>
        <td>${r.typst}</td>
        <td>${r.iawriter}</td>
      </tr>`).join('\n');

  return `<section class="matrix-section">
  <p class="card__label">Capability matrix</p>
  <h2>What each technology can express</h2>
  <p>The specification is one vocabulary; three engines implement it, each to a different
    depth. This is how far each one reaches, and where a "no" says why — so you can tell
    which template to reach for before you download one.</p>
  <div class="matrix-wrap">
    <table class="matrix">
      <thead>
        <tr><th scope="col"></th><th scope="col">CSS + Paged.js</th><th scope="col">Typst</th>
          <th scope="col">iA Writer</th></tr>
      </thead>
      <tbody>
${body}
      </tbody>
    </table>
  </div>
</section>`;
}

output.set(TEMPLATES_PAGE, relocate(shell({
  title: 'Templates — typeset',
  description: 'Ready-made documents set to the typeset specification: the iA Writer '
    + 'letter template, and what each technology can and cannot express.',
  head: `<link rel="stylesheet" href="specimen.css">\n`,
  body: `<div class="page">
<main class="main">

<header class="masthead">
  <p class="crumb"><a href="index.html">typeset</a></p>
  <h1>Templates</h1>
  <p>A template is a document you write in. <a href="${SPEC_PAGE}">The specification</a> is the
    contract it keeps: a template sets the page and the scale and nothing else, and takes its
    typography from the published stylesheet rather than carrying a second copy of it.</p>
</header>

${capabilityMatrix()}

<section class="card">
  <p class="card__label">iA Writer</p>
  <h2>The letter</h2>
  <p>A letter on A4 at 20mm on all four sides. EB Garamond at 11pt, ragged right, filling the
    page the margins leave. Markdown only, so it covers headings, body text, bold, italic,
    tables and footnotes — <a href="files/iawriter-css.html">its own page</a> states what that
    vocabulary reaches and what it does not, including why there is no two-column iA Writer
    template.</p>
  <div class="btnrow">
    <a class="btn" href="${TEMPLATE_BUNDLE}" download>Download the letter template</a>
    <a class="btn" href="files/iawriter-css.html">iawriter.css</a>
  </div>
</section>

<div class="feeds">
  <p class="feeds__label">Building one of your own</p>
  <ul>
    <li><a href="files/typeset-css.html"><code>typeset.css</code></a> — link it, add
      <code>class="typeset"</code>, bind every face. The
      <a href="downloads/typeset-css.zip" download>CSS bundle</a> carries both.</li>
    <li><a href="files/typeset-typ.html"><code>typeset.typ</code></a> — for anything paginated:
      page-foot footnotes, running heads, table-of-contents page numbers, two columns.</li>
    <li><a href="spec.json"><code>spec.json</code></a> — the values themselves, if you are
      teaching a third engine.</li>
  </ul>
</div>

<footer class="footer">
  <p><b>typeset</b> — Adilson Carvalho. A template overrides the page and the scale and nothing
    else; where a template and <a href="spec.json">spec.json</a> disagree, the specification is
    right.</p>
</footer>

</main>
</div>`,
}), '../'));

/* ---- / — the router ----------------------------------------------------- */

/* Two routes and the downloads, above the fold, so a reader arriving with no
   idea which half they want can tell in one screen. It also carries the
   fragment forwarder: every anchor the specification page published from here
   before it moved is still pointed at this page, and this is what sends one
   on. See fragmentForwarder() above for why that cannot be a meta refresh. */
const DOWNLOADS = [
  ['downloads/typeset-typst.zip',
    'the Typst implementation, all three example documents and the three spec families. '
    + 'Typst cannot fetch a font from a URL, so a bundle is the only way to hand it over complete.'],
  [TEMPLATE_BUNDLE,
    'the iA Writer letter template, carrying typeset.css and every font face it binds.'],
  ['downloads/typeset-css.zip',
    'the stylesheet and the three spec families with their licences — what a template consumes, '
    + 'and what to self-host for a document you send.'],
];

output.set('index.html', shell({
  title: 'typeset — a typographic specification',
  description: "Adilson Carvalho's typographic specification for printed documents: "
    + 'essays, letters, reports. The specification, and templates set to it.',
  head: `<link rel="stylesheet" href="specimen.css">\n`,
  preamble: fragmentForwarder(specPage, SPEC_PAGE),
  body: `<div class="page">
<main class="main">

<header class="masthead">
  <h1>type<b>set</b></h1>
  <p>A <b>typographic specification</b> for printed documents — essays, letters, reports.
    Anything destined for paper or a PDF.</p>
  <div class="meta">
    <span><b>Serif</b> ${spec.foundation.fonts.serif.family}</span>
    <span><b>Sans</b> ${spec.foundation.fonts.sans.family}</span>
    <span><b>Mono</b> ${spec.foundation.fonts.mono.family}</span>
    <span><b>Spec</b> ${spec.version} · ${spec.updated}</span>
  </div>
</header>

<div class="routes">
  <a class="route" href="${SPEC_PAGE}">
    <p class="route__label">The specification</p>
    <p>${spec.sections.length} sections, ${elementCount} elements. Every value an engine must
      hit, each beside a rendered specimen and the same value expressed in CSS and in Typst.
      Read this if you are implementing.</p>
    <p class="route__go">Read the specification →</p>
  </a>
  <a class="route" href="${TEMPLATES_PAGE}">
    <p class="route__label">Templates</p>
    <p>Documents already set to the specification, to write in rather than to implement.
      One today: the iA Writer letter.</p>
    <p class="route__go">Browse the templates →</p>
  </a>
</div>

<div class="feeds">
  <p class="feeds__label">Raw files, for a machine</p>
  <ul>
    <li><a href="spec.json"><code>spec.json</code></a> — the normative source. Every length
      absolute.</li>
    <li><a href="SPEC.md"><code>SPEC.md</code></a> — the same thing as prose, generated from
      <code>spec.json</code>. Paste this into a model's context.</li>
    <li><a href="llms.txt"><code>llms.txt</code></a> — what to read first, and in what
      order.</li>
  </ul>
</div>

<div class="feeds">
  <p class="feeds__label">Downloads</p>
  <ul>
${DOWNLOADS.map(([href, lede]) =>
    `    <li><a href="${href}" download><code>${basename(href)}</code></a> — ${lede}</li>`).join('\n')}
  </ul>
</div>

<footer class="footer">
  <p><b>typeset</b> — Adilson Carvalho. <a href="spec.json">spec.json</a> is normative; CSS and
    Typst are conformant implementations of it, not the definition. If an implementation and the
    specification disagree, the specification is right.</p>
</footer>

</main>
</div>`,
}));

/* ---- files/*.html — one viewer per downloadable, plus one per shipped
   Typst example with its rendered preview above the source ---------------- */

/* The sticky bar, source pane and (when given) preview block every viewer
   page shares — src/viewers.json's five entries and src/examples.mjs's three
   examples are different kinds of row, but they render through the one
   function, so they cannot drift into two different page shapes. */
function viewerBody({ name, href, lede, extra, source, lang, preview = '' }) {
  const lines = source.replace(/\n$/, '').split('\n').length;
  const kb = (Buffer.byteLength(source, 'utf8') / 1024).toFixed(1);
  return `<div class="vbar">
  <a class="back" href="../${SPEC_PAGE}">← typeset</a>
  <span class="name">${name}</span>
  <span class="actions">
    <button class="vbtn" type="button" data-copy>Copy</button>
    <a class="vbtn" href="${href}" download>Download</a>
  </span>
</div>

<main>
  <h1>${name}</h1>
  <p class="lede">${lede}</p>
${preview}${extra ? `  <div class="extra">\n    ${extra}\n  </div>\n` : ''}  <p class="meta">${lines} lines · ${kb} KB</p>
  <div class="filebody">${lineNumbered(source, lang)}</div>
</main>`;
}

const VIEWERS = JSON.parse(read('src/viewers.json'));

/* src/viewers.json's "extra" prose names the iA Writer bundle by a
   {{TEMPLATE_BUNDLE}} token rather than the path itself, so the filename
   src/templates.mjs owns has one fewer place to go stale in — files/ pages
   sit one level below the site root, hence the "../" this substitution adds
   and TEMPLATE_BUNDLE (root-relative, used on templates/index.html and
   index.html) does not carry itself. */
for (const v of VIEWERS) {
  output.set(`files/${v.slug}.html`, shell({
    title: `${v.name} — typeset`,
    description: v.description,
    head: `<link rel="stylesheet" href="../specimen.css">\n<link rel="stylesheet" href="viewer.css">\n`,
    body: viewerBody({
      name: v.name, href: v.href, lede: v.lede,
      extra: (v.extra || '').replaceAll('{{TEMPLATE_BUNDLE}}', `../${TEMPLATE_BUNDLE}`),
      source: read(v.source), lang: v.lang,
    }),
    scripts: '<script src="viewer.js" defer></script>\n',
  }));
}

/* One page per shipped Typst example, derived from src/examples.mjs.

   The rendered preview goes first, above the source: previews/<id>-<n>.svg is
   built separately, by tools/build-previews.mjs, because it needs Typst and
   this script must not. So every <img> ships unconditionally — regenerating
   this page never depends on whether previews/ happens to exist on the
   machine running it — and viewer.js swaps in the "not built" message only if
   the first page actually fails to load. */
for (const e of EXAMPLES) {
  const name = basename(e.file);
  const lede = `A conformance sample for the Typst implementation — ${e.description}. Rendered `
    + `below from <a href="typeset-typ.html">typeset.typ</a>; the checker compiles it fresh on `
    + 'every commit.';
  const pages = Array.from({ length: e.pages }, (_, i) => i + 1)
    .map((n) => `      <img src="../previews/${e.id}-${n}.svg" alt="${e.id}, page ${n}"`
      + `${n > 1 ? ' loading="lazy"' : ''}>`)
    .join('\n');
  const preview = `  <section class="preview" data-preview>
    <p class="preview__missing" hidden>The rendered pages are not available here — the
      source is below. To build them in a checkout, run
      <code>node tools/build-previews.mjs</code> with Typst on <code>PATH</code>.</p>
    <div class="preview__pages">
${pages}
    </div>
  </section>
`;

  output.set(`files/example-${e.id}.html`, shell({
    title: `${name} — typeset`,
    description: `A Typst conformance sample: ${e.description}. One of the three example `
      + 'documents typeset.typ ships with.',
    head: `<link rel="stylesheet" href="../specimen.css">\n<link rel="stylesheet" href="viewer.css">\n`,
    body: viewerBody({ name, href: `../${e.file}`, lede, source: read(e.file), lang: 'typst', preview }),
    scripts: '<script src="viewer.js" defer></script>\n',
  }));
}

  return { output, stats: {
    sections: sections.length,
    navLinks: nav().match(/<li>/g).length,
    viewers: VIEWERS.length + EXAMPLES.length,
    cssMarkers: cssLines.size,
    typstMarkers: typLines.size,
  } };
}

/* CLI */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { output, stats } = buildAll();
  for (const [path, contents] of output) {
    if (path.includes('/')) mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true });
    writeFileSync(path, contents);
  }
  console.log(`spec/index.html — ${stats.sections} sections, ${stats.navLinks} nav links`);
  console.log('index.html, templates/index.html — the router and the templates page');
  console.log(`files/ — ${stats.viewers} viewer pages`);
  console.log(`markers resolved — css ${stats.cssMarkers}, typst ${stats.typstMarkers}`);
}
