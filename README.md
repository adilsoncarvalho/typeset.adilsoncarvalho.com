# typeset

A normative **typographic specification** for printed documents — essays,
letters, reports. Anything destined for paper or a PDF.

Live at **[typeset.adilsoncarvalho.com](https://typeset.adilsoncarvalho.com)**.

This is not a CSS library. `spec.json` is the source of truth; CSS and Typst are
conformant implementations of it. Point a rendering engine — or an AI wiring one
up — at the spec and the output should match. Where an implementation and the
spec disagree, **the spec is right and the implementation is broken.**

## Files

| File | What it is |
|---|---|
| `spec.json` | **Normative.** Every length absolute. Section and element counts are generated onto the masthead by `tools/build-site.mjs`, not hand-maintained here. |
| `SPEC.md` | The spec as prose, generated from `spec.json`. For pasting into a model's context. |
| `llms.txt` | What a machine should read first, and in what order. |
| `index.html` | **Generated.** The specimen page. Do not edit — edit `src/` and rebuild. |
| `typeset.css` | Reference implementation — CSS. |
| `implementations/typeset.typ` | Reference implementation — Typst. |
| `implementations/example-essay.typ` | The essay set in Typst. A conformance sample. |
| `implementations/example-letter.typ` | The letter set in Typst — ragged right, real page-foot footnote. |
| `examples/essay.html`, `examples/letter.html` | The same documents in CSS, paginated with Paged.js. |
| `examples/two-column.html` | The two-column template in CSS. Prints from the browser — see below. |
| `implementations/example-two-column.typ` | The two-column template in Typst. |
| `implementations/iawriter/` | The iA Writer templates — one bundle for the letter, one for two columns. |
| `implementations/iawriter/iawriter.css` | The layer between iA Writer's Markdown output and `typeset.css`. |
| `specimen.css`, `specimen.js` | Chrome for the specimen page. Never shipped in a document. |
| `files/*.html` | **Generated.** One viewer page per downloadable file. |
| `src/sections.json` | The section manifest: order, group, title, prose, which panel to render. |
| `src/demos/<id>.html` | The rendered example for each section. The HTML pane is extracted from it, so the two cannot disagree. |
| `src/demos/<id>.typ` | The Typst snippet for each section — hand-written, and compiled by the checker under the boilerplate the page publishes. |
| `src/extract.mjs` | Pulls a demo's document fragment out of the page apparatus around it. |
| `src/boilerplate.mjs` | The Typst boilerplate the masthead prints and the checker compiles against — one source for both. |
| `src/panels.mjs`, `src/highlight.mjs` | Build-time panel rendering and syntax highlighting. |
| `src/masthead.html`, `src/footer.html`, `src/nav-*.html`, `src/viewers.json` | Page furniture. |
| `tools/build-site.mjs` | Generates `index.html` and `files/*.html` from all of the above. |
| `downloads/` | **Build output, gitignored.** The Typst bundle and the two iA Writer templates. |
| `tools/build-bundle.mjs` | Builds the Typst bundle from `implementations/` and `fonts/`. |
| `tools/build-iawriter.mjs` | Builds the two iA Writer template bundles from `implementations/iawriter/`, `typeset.css` and `fonts/`. |
| `.github/workflows/deploy.yml` | Checks, builds every bundle, deploys Pages; on a tag, publishes the release assets. |
| `proofs/font-proof.html` | Six body-face candidates, one per A4 page, for printing. |
| `examples/preview-bar.js` | The back bar for example documents. See the Paged.js notes below. |
| `tools/build-spec.mjs` | Generates `SPEC.md` from `spec.json`. |
| `tools/check.mjs` | Verifies the implementations still match the spec. |

Each section's panel carries three tabs beside the rendered example.

- **Spec** is rendered from `spec.json`.
- **HTML** is the markup that produces the example beside it, extracted from
  `src/demos/<id>.html` rather than transcribed, and held to that file by a
  round-trip gate — so it cannot drift. Three Foundations sections state values
  rather than demonstrate a document, so they publish **CSS** in that slot
  instead, quoted from the `/*! @s id :: Title */` marker pairs in `typeset.css`.
- **Typst** is `src/demos/<id>.typ`, one hand-written snippet per section. It is
  *not* extracted, so nothing makes it match the example on its own; what holds
  it is that the checker compiles every snippet under the exact boilerplate the
  masthead publishes.

Both code panes link back to the region of the full source they came from, by a
line number read from the file rather than kept by hand.

## The site is generated

`index.html` and `files/*.html` are **build output**. Editing them by hand is
wasted work — the next build overwrites it, and `tools/check.mjs` fails if the
committed pages do not match what the sources produce.

```sh
node tools/build-site.mjs   # regenerate the pages
node tools/check.mjs        # fails if anything is stale or inconsistent
```

Everything is resolved at build time: the spec tables, both code panels, and the
syntax highlighting are plain markup in the published page, and the Spec /
HTML / Typst tabs are radio inputs driven by CSS. **The page renders completely with
JavaScript disabled**, and opens straight from the filesystem — the two scripts
that remain (about 1.8 KB together) exist only for the copy buttons.

What this bought, concretely: the 30% of `index.html` that was repeated scaffold
is gone; the nav is derived from the section list so it cannot drift; section
numbers come from position rather than being typed (which immediately surfaced a
duplicate `09` that had been sitting in the page); and the four viewer pages come
from one template instead of four near-identical files.

To add a section: add an entry to `src/sections.json`, write
`src/demos/<id>.html` and `src/demos/<id>.typ`, add the `@s` marker pairs in
`typeset.css` and `implementations/typeset.typ`, give each element a `.ts-<id>`
class or a `/* @style <id> */` marker, rebuild, and run the checker. The checker
names a missing demo or snippet before the build trips over it.

Naming the elements: an element id is either the bare section id or
`<section-id>-<leaf>`. A section built around one style gives its principal
element the bare section id (`dropcap`, `codeblock`, `toc`, `table`) and hangs
any others off it (`dropcap-lede`, `toc-entry`, `table-cell`); a section that
enumerates a family of variants has no bare id of its own and gives every
element a leaf (`heading-h1` … `heading-h6`, `list-ordered`,
`list-unordered`).

## Working on it

**`typst` must be on `PATH`.** `check.mjs` compiles every Typst snippet, and
exits 1 with an install pointer rather than skipping when it cannot find one.
Otherwise Node and nothing else: there is no `package.json` and nothing to
install. `.github/workflows/deploy.yml` names the version CI runs.

```sh
node tools/build-spec.mjs   # regenerate SPEC.md after editing spec.json
node tools/build-site.mjs   # regenerate index.html and files/*.html from src/
node tools/check.mjs        # verify everything, including that the pages are current
python3 -m http.server      # optional — the pages also open straight from disk
```

`check.mjs` fails when a token in `typeset.css` no longer matches `spec.json`,
when a spec section has no panel or no CSS marker, when `SPEC.md` is stale, or
when a generated page is out of date. It also holds the demos and the panes they
produce:

- Every manifest section has a demo and a Typst snippet, and nothing in
  `src/demos` is unreferenced.
- Every Typst snippet compiles under the boilerplate the masthead publishes —
  the same text, composed by the same function, so the two cannot be different
  environments.
- Extraction is lossless: each demo file is rebuilt from what the extractor
  returned and compared byte for byte, and the count of extracted examples must
  equal the count of `pair__label` paragraphs, so a silently dropped example
  fails rather than passing as nothing-to-compare.
- A `<pre>` or a verse stanza survives extraction verbatim, checked against the
  demo file itself rather than through the mask the extractor uses.
- The published pane is the extracted fragment with only the declared apparatus
  removed, and apparatus is held to what the word means: furniture this website
  adds, which `typeset.css` never defines.
- A pane never names a class `typeset.css` does not define, so a reader who
  copies it gets markup that renders as shown.
- Every element `spec.json` declares has exactly one labelled example: a
  `pair__label` somewhere under `src/demos` whose `data-element` attribute
  names that element's id. An element with no pane fails, and so does one with
  two. See **Adding an element** below.
- The handful of elements that cannot carry a pane are named in `check.mjs`'s
  own `EXEMPTIONS` map, each with the one-sentence reason a reviewer needs to
  accept it on sight. An entry with no reason fails; so does one naming an id
  `spec.json` does not declare; and so does one that has since been given a
  pane anyway, which is how an exemption stops outliving its reason.
- The scale labels in both tokens demos are `spec.json`'s own values, in both
  directions.
- The letter section's page diagram is drawn to `letter-page`'s own margins,
  states them in words in the same three numbers, and leaves out the running
  head and the folio that element declares it has none of — each checked
  against `spec.json`, the same way the page section's diagram is.
- `SPEC.md` is regenerated from `spec.json` and compared byte for byte, so a
  stale property table fails rather than passing on a matching version line.
- The migration path is held to the release it describes: one run of
  `tools/codemod-names.mjs` carries `tools/fixtures/1.x-migration-sample.html`
  from 1.x class names to 2.0 ones and lands every class on a name this
  release carries, a second run changes nothing further, the two rename maps
  point only at live names, running the codemod over `spec.json` moves no
  schema key, and `docs/migrating-to-2.0.md`'s class table and its five counts
  are re-derived from the maps rather than trusted.

Run it before pushing.

### Adding an element

A new element in `spec.json` needs a labelled example before the build is
green. Add a pane to the section's demo file, and bind it:

```html
<p class="pair__label" data-element="table-zebra">8 · Zebra striping</p>
<p class="demo-note">What to look at in the example below.</p>
<div class="paper typeset">
  <!-- the markup a reader copies -->
</div>
```

The label's text is the word a person reads and is free to say whatever reads
best; `data-element` is the machine key, and it is what the coverage gate
matches on. The id must be one `spec.json` declares and one no other pane has
already claimed — the gate fails on both mistakes, and the pane above is the
shape to copy, not the id.

Add the Typst counterpart to the section's `.typ` file so both panes show the
same document — or, where Typst cannot express it, say so in a comment in that
file, naming the pane and the reason.

If the element genuinely cannot be shown, add it to `EXEMPTIONS` in
`tools/check.mjs` with a reason. "It only happens in print" is not one on its
own: `src/demos/page.html` draws a page on screen, and `src/demos/link.html`
says in place what a printer will do with the sample above it.

## Templates

A template sets the page and the scale. Everything else — the palette, the rule
weights, the numeral conventions, the pagination rules — is identical across
them: a template does not get its own typography.

| Template | Base | Measure | Opt-in |
|---|---|---|---|
| Single column (default) | 11pt / 1.45 | 33em ≈ 66 characters | — |
| Two column, equal | 9.5pt / 1.4 | 82mm ≈ 49 characters | `typeset--two-column` |

**The two-column base is derived, not chosen.** A4 less the standard 20mm margin
on each side leaves 170mm; a 6mm gutter divides it into two 82mm columns. At 11pt
that carries 42 characters — below the 45-character floor the spec sets for
prose. 10.5pt still falls short, at 44. 9.5pt restores 49. `tools/check.mjs`
recomputes this and fails if the stated numbers stop agreeing, so changing the
page size, the default margin or the gutter cannot silently break the measure.

Two columns also change what is allowed: **justification stops being optional**
(at 49 characters a ragged edge serrates the column), and **sidenotes are
forbidden** (there is no margin left, so they degrade to an inline aside).

### Margins

Either template also takes one of six named margins, on `foundation.page.margins`
in `spec.json`:

| Name | Symmetric | Duplex (inner / outer) |
|---|---|---|
| `narrow` | 10mm | 13mm / 7mm |
| `standard` (default) | 20mm | 23mm / 17mm |
| `wide` | 30mm | 33mm / 27mm |

Symmetric is the same value on all four sides. Duplex is the explicit opt-in
for a document that will be bound: top and bottom stay at the symmetric
value, left and right split into an inner (binding) edge and an outer one,
mirrored by page parity — the pair always sums to twice the symmetric value,
so a document keeps the same text width and the same line breaks whichever
of the two it chooses.

In CSS, ask for one with a `typeset--margin-<name>` class, for example
`typeset--margin-duplex-standard`. In Typst, pass the matching `margin-<name>`
value to `margin:`, for example `margin-duplex-standard` — or pass any
length or Typst margin dictionary directly, for a page box the spec does not
name. `tools/check.mjs` holds both implementations' six named values, and
`paper-sizes-mm`/`sizes_mm`, to `spec.json`.

## Changing the spec

1. Edit `spec.json`. Bump `version` and `updated`.
2. `node tools/build-spec.mjs`.
3. Update every implementation that the change touches.
4. `node tools/check.mjs` until it passes.

Adding an engine means adding an implementation that hits the values in
`spec.json`, plus `// @s <section-id>` marker pairs so the site can link into
it, plus a snippet per section under `src/demos/` so each panel can show the
engine doing the thing the section is about. The snippets are what surface the
gaps: writing 25 of them against 25 HTML examples is the most systematic
comparison of two implementations this project has run, and it found three live
bugs in `typeset.typ` that compiling three example documents never could.

## The Typst bundle is built, not committed

Typst has no equivalent of a CSS font URL: a font is either in the project or it
is silently substituted. So the implementation is distributed as a zip carrying
the three font families the spec names — verified by extracting it and compiling
all three example documents with `--font-path fonts` and nothing else present.

**It is derived from the repository, so it is not committed** — the same argument
that makes `index.html` generated. `downloads/` is gitignored:

```sh
node tools/build-bundle.mjs      # ~1.7 MB, 24 files
```

Two published forms, both from `.github/workflows/deploy.yml`:

| | URL | Versioning |
|---|---|---|
| Pages deploy, every push to `master` | `typeset.adilsoncarvalho.com/downloads/typeset-typst.zip` | always current |
| Release asset, on a `v*` tag | `github.com/…/releases/download/v1.0.0/typeset-typst-1.0.0.zip` | immutable, named for the spec version |

The workflow runs `tools/check.mjs` first, so a commit whose generated pages are
stale fails before it can deploy.

**Not Git LFS.** GitHub Pages does not serve LFS objects — it serves the pointer
file, so the download link would hand people a few lines of text claiming to be a
zip. **Not GitHub Packages** either: it has no generic file registry, and its npm
registry requires a token even for public packages, which makes a
click-to-download link impossible.

All bundled fonts are OFL-1.1 and each family directory carries its `OFL.txt`,
which is what the licence requires for redistribution. `build-bundle.mjs` fails
if one is missing, or if `typeset.typ` stops naming one of the three families.

## The iA Writer template

iA Writer is a Markdown editor, and Markdown is a small vocabulary: headings,
body text, bold, italic, tables, footnotes, and one quoting construct. That is
the whole of it. So the template implements exactly that much of the spec, and
does not pretend to the rest — the signature block, callouts, sidenotes and drop
caps all need markup Markdown has no way to write.

`typeset-letter.iatemplate` is A4 at 20mm on all four sides, ragged right at the
11pt base, filling the 170mm the margins leave. It is `typeset.css` plus
`implementations/iawriter/iawriter.css`, which binds the bundled fonts to the
family names the spec asserts and maps the MultiMarkdown constructs that have no
counterpart in a hand-written document (footnotes, citations, task lists, column
alignment). It adds no typography. What the letter wants for itself — the page,
the display quote and the letterhead — is in `letter/page.css`.

```sh
node tools/build-iawriter.mjs   # ~2.1 MB
```

### What the letter sets for itself

| Markdown | Set as |
|---|---|
| `> a quote` | Cormorant Garamond Light Italic, centred, 1.3x the base, no rule |
| a tab- or four-space-indented block | Cormorant Garamond Light upright at 11pt, as the letterhead address |

Markdown has no letterhead, so the two constructs that fall at the top of a
letter get the job: the level-1 heading is the name, and an indented block
beneath it is the address. That block is Markdown's code block, and the template
strips every mark of code off it — the wash, the rule, the padding and the
monospaced face — keeping only `white-space: pre-wrap`, which is the whole reason
the construct is usable here: it preserves the line breaks an address is written
with, where a paragraph would collapse them. The consequence is the one the
"typography only" approach always has: an indented block anywhere else in a
letter is an address too, because there is no second construct to distinguish.

Both letterhead elements are Cormorant Garamond — the italic for the quote, the
upright for the address — so the letter speaks in one voice at two sizes. It is
not part of `spec.json`; it is the template's own choice, bound in
`letter/page.css`, and `build-iawriter.mjs` derives the bundle's font families
from the `@font-face` rules the stylesheets actually link.

### There is no two-column iA Writer template

One was built and withdrawn. **WebKit's print path ignores CSS multi-column
entirely** — `column-count`, `column-width`, `columns`, the `-webkit-` forms,
`column-fill: auto` and an explicit height all render a single column on export,
on the body or on a wrapper div. The *screen* path honours all of them, so a
template previews in two columns and exports in one, and nothing reports the
difference. Chrome prints the same file in two columns, which is what makes this
easy to miss.

Laying the columns out in JavaScript instead — plain fixed-height page boxes with
`break-before: page`, which WebKit does print correctly — worked in every harness
it was tested through, including a `WKWebView` print operation, and still did not
work in iA Writer itself. Two columns belong to an engine that can paginate them:
Typst does it natively, and `examples/two-column.html` prints from a browser.

### Three things the format decides for you

- **`@page` is the whole page mechanism, and it excludes the alternative.** iA
  Writer renders the header and the footer as separate HTML documents and reserves
  space for them by setting the page margins *itself*, to the depths given by
  `IATemplateHeaderHeight` and `IATemplateFooterHeight`. A `@page` margin in the
  template therefore **replaces** those margins rather than adding to them. Declare
  both and the band has no space left to draw in; declare `@page { margin: 0 }` and
  the page loses its top and bottom margins altogether. So the template declares
  `@page` and no bands.
- **Which costs the running head and the folio.** They lived in those bands. The
  spec resolves a running head from the current level-2 heading during layout,
  which needs a paged-media engine; WebKit implements none of CSS Paged Media, so
  the band could only ever have shown the document title.
- **An `<html>` background paints the page content box, not the sheet.** Set one
  and an export comes out with a tinted rectangle inset by the page margin and a
  white border around it — and `typeset.css` sets `print-color-adjust: exact`,
  which stops the print pipeline dropping it to save ink. The Preview tint is
  therefore scoped to `@media screen`, and paper supplies its own ground.

### The letter departs from the measure, deliberately

A4 at 20mm leaves 170mm, which at the 11pt base carries about 88 characters —
past the 75-character ceiling `foundation.rhythm` sets, and the measure is the
rule this spec says everything else is downstream of. The letter template lifts
the cap anyway and fills the page, because a 12.8cm column inside 2cm margins
reads as a column adrift on a sheet.

This is the one place the template knowingly contradicts `spec.json`, and it is
asserted in `tools/check.mjs` rather than left to drift back silently.

Fonts ship inside the bundle. A template is a local page with no network, and
WebKit substitutes a missing face without saying so — the same argument that makes
the Typst bundle carry them. `build-iawriter.mjs` fails if an `@font-face` points
at a file that does not exist, if an `OFL.txt` is missing, or if the bundle
declares a version other than the spec's. `tools/check.mjs` additionally fails if
any family, weight or style the template asks for has no face bound for it.

## Engine capability

Some of the spec needs an engine that can measure the page while laying it out.
This is not optional detail — it decides what you can implement.

| Feature | Typst / LaTeX | WeasyPrint 53+ / Prince | Chrome print | WebKit print |
|---|---|---|---|---|
| Running heads, folios | native | yes | **no** | **no** |
| Footnotes at the page foot | native | yes | **no** — degrades to endnotes | **no** |
| TOC page numbers | native | yes | **no** — omits the number | **no** |
| Repeating table headers | native | yes | yes | yes |
| Three-line drop-cap wrap | **no** (needs `droplet`) | yes | yes | yes |
| Two equal columns | native | yes | yes — but **not** under Paged.js | **no** — see below |

**WebKit prints no CSS columns at all.** Every multi-column property is honoured
on screen and ignored on export, so a document previews in two columns and prints
in one with nothing to say it changed. This is the column of the table that
matters for iA Writer, which renders and exports through WebKit, and it is why
there is no two-column iA Writer template.

The CSS implementation loads [Paged.js](https://pagedjs.org) in the essay and
letter examples to cover the first three rows.

**Paged.js and CSS columns are mutually exclusive.** Paged.js paginates by moving
content between page boxes and cannot split a column flow, so a `columns: 2`
document run through it produces **zero pages** — a blank output, with no error.
The two-column CSS example therefore drops Paged.js: it simulates one sheet on
screen and lets the browser's own print do the pagination, which handles multicol
fragmentation natively. The cost is the running head and folio, which return
under WeasyPrint or Prince.

## Paged.js is more hostile than it looks

Four separate defects here came from Paged.js, and they share a shape: it
rewrites the document's stylesheets through its own parser and re-hosts the
content inside its page boxes, so things that are true of a normal page are not
true under it.

- **It cannot parse `:is()` or `:has()`.** It splits the selector on the commas
  inside the argument list, emits a fragment like `.ts-callout)+p`, and that
  throws on `querySelectorAll` — aborting pagination entirely. Blank document, no
  error on the page. Keep selector lists flat.
- **It applies `@media print` rules unconditionally**, since that is how it builds
  a print preview on screen. Anything marked screen-only disappears.
- **It drops rules from the stylesheets it rewrites.** The `.preview-bar` rule and
  a whole `@media print` block both vanished. Screen chrome is therefore styled
  inline by `preview-bar.js`, and the print reset is applied as inline styles as
  well, because inline styles cannot be dropped.
- **It moves every child of `<body>` into its page boxes**, navigation included,
  and its `after` hook did not reliably put it back — so the bar is mounted only
  once pagination has produced pages.

And separately: **headless `--print-to-pdf` races Paged.js.** It snapshots before
pagination finishes, so page counts come back as 1, 2 or 3 for the same document
across runs and content is silently truncated. Verify pagination with a tall
screenshot, not with a printed page count.

## Three traps worth knowing

All of these shipped here before they were caught, and none reproduces in an
unpaginated preview:

- **`text-align` inherits.** Setting `justify` on the document container also
  justifies the subtitle, byline, captions, address blocks and table cells. Every
  block that must stay flush declares its own alignment, so a new block is never
  silently opted in.
- **The last line must be explicitly flush.** A paginating engine fragments the
  text, so the visual last line of a paragraph stops looking like the end of one
  and gets stretched to the measure. This is the most visible print defect there
  is.
- **Last-line alignment inherits too.** A centred block — a pull quote, a section
  break — must restore its own `text-align-last`, or the document's justification
  flushes its last line, which for a one-line block is its only line, to the left.

## Fonts

EB Garamond (body), Source Sans 3 (headings, tables), IBM Plex Mono (code). All
OFL. The pages here load them from Google Fonts for convenience.

**For a document you send, self-host the files and embed them.** A PDF that
fetches fonts at print time is not reproducible, and one that falls back to Times
has lost every decision in the spec.

## Deploying

GitHub Pages from `master`, root directory. `CNAME` is committed, so the custom
domain survives redeploys. DNS is a `CNAME` on `typeset` managed in Route 53.
