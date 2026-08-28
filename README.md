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
| `spec.json` | **Normative.** 22 sections, 93 elements, every length absolute. |
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
| `specimen.css`, `specimen.js` | Chrome for the specimen page. Never shipped in a document. |
| `files/*.html` | **Generated.** One viewer page per downloadable file. |
| `src/sections.json` | The section manifest: order, group, title, prose, which panel to render. |
| `src/demos/*.html` | The rendered example for each section — one file per section. |
| `src/panels.mjs`, `src/highlight.mjs` | Build-time panel rendering and syntax highlighting. |
| `src/masthead.html`, `src/footer.html`, `src/nav-*.html`, `src/viewers.json` | Page furniture. |
| `tools/build-site.mjs` | Generates `index.html` and `files/*.html` from all of the above. |
| `downloads/` | **Build output, gitignored.** The Typst bundle. `node tools/build-bundle.mjs`. |
| `tools/build-bundle.mjs` | Builds the Typst bundle from `implementations/` and `fonts/`. |
| `.github/workflows/deploy.yml` | Checks, builds the bundle, deploys Pages; on a tag, publishes a release asset. |
| `proofs/font-proof.html` | Six body-face candidates, one per A4 page, for printing. |
| `highlight.js` | The syntax highlighter, shared by the specimen page and the viewers. |
| `examples/preview-bar.js` | The back bar for example documents. See the Paged.js notes below. |
| `tools/build-spec.mjs` | Generates `SPEC.md` from `spec.json`. |
| `tools/check.mjs` | Verifies the implementations still match the spec. |

The site quotes real code: every CSS and Typst panel is extracted from the marker
pairs in the source files (`/*! @s id :: Title */` and `// @s id`). Nothing is
transcribed, so a panel cannot drift from the file it describes.

## The site is generated

`index.html` and `files/*.html` are **build output**. Editing them by hand is
wasted work — the next build overwrites it, and `tools/check.mjs` fails if the
committed pages do not match what the sources produce.

```sh
node tools/build-site.mjs   # regenerate the pages
node tools/check.mjs        # fails if anything is stale or inconsistent
```

Everything is resolved at build time: the spec tables, both code panels, and the
syntax highlighting are plain markup in the published page, and the Spec / CSS /
Typst tabs are radio inputs driven by CSS. **The page renders completely with
JavaScript disabled**, and opens straight from the filesystem — the two scripts
that remain (about 1.8 KB together) exist only for the copy buttons.

What this bought, concretely: the 30% of `index.html` that was repeated scaffold
is gone; the nav is derived from the section list so it cannot drift; section
numbers come from position rather than being typed (which immediately surfaced a
duplicate `09` that had been sitting in the page); and the four viewer pages come
from one template instead of four near-identical files.

To add a section: add an entry to `src/sections.json`, write
`src/demos/<id>.html`, add the marker pairs in `typeset.css` and
`implementations/typeset.typ`, rebuild, and run the checker.

## Working on it

```sh
node tools/build-spec.mjs   # regenerate SPEC.md after editing spec.json
node tools/build-site.mjs   # regenerate index.html and files/*.html from src/
node tools/check.mjs        # verify everything, including that the pages are current
python3 -m http.server      # optional — the pages also open straight from disk
```

`check.mjs` fails when a token in `typeset.css` no longer matches `spec.json`,
when a spec section has no panel or no CSS marker, when a demo file is missing,
when `SPEC.md` is stale, or when a generated page is out of date. Run it before
pushing.

## Templates

A template sets the page and the scale. Everything else — the palette, the rule
weights, the numeral conventions, the pagination rules — is identical across
them: a template does not get its own typography.

| Template | Base | Measure | Opt-in |
|---|---|---|---|
| Single column (default) | 11pt / 1.45 | 33em ≈ 66 characters | — |
| Two column, equal | 9.5pt / 1.4 | 77mm ≈ 47 characters | `typeset--two-column` |

**The two-column base is derived, not chosen.** A4 less the 28mm inner and 22mm
outer margin leaves 160mm; a 6mm gutter divides it into two 77mm columns. At 11pt
that carries 40 characters — below the 45-character floor the spec sets for
prose. 9.5pt restores 47. `tools/check.mjs` recomputes this and fails if the
stated numbers stop agreeing, so changing the page size or the gutter cannot
silently break the measure.

Two columns also change what is allowed: **justification stops being optional**
(at 47 characters a ragged edge serrates the column), and **sidenotes are
forbidden** (there is no margin left, so they degrade to an inline aside).

## Changing the spec

1. Edit `spec.json`. Bump `version` and `updated`.
2. `node tools/build-spec.mjs`.
3. Update every implementation that the change touches.
4. `node tools/check.mjs` until it passes.

Adding an engine means adding an implementation that hits the values in
`spec.json`, plus `// @s <section-id>` marker pairs so the site can quote it.

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

## Engine capability

Some of the spec needs an engine that can measure the page while laying it out.
This is not optional detail — it decides what you can implement.

| Feature | Typst / LaTeX | WeasyPrint 53+ / Prince | Browser print |
|---|---|---|---|
| Running heads, folios | native | yes | **no** |
| Footnotes at the page foot | native | yes | **no** — degrades to endnotes |
| TOC page numbers | native | yes | **no** — omits the number |
| Repeating table headers | native | yes | yes |
| Three-line drop-cap wrap | **no** (needs `droplet`) | yes | yes |
| Two equal columns | native | yes | yes — but **not** under Paged.js |

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
