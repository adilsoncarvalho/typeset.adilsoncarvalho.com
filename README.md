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
| `index.html` | The specimen: rendered example, spec values, and both implementations, per section. |
| `typeset.css` | Reference implementation — CSS. |
| `implementations/typeset.typ` | Reference implementation — Typst. |
| `implementations/example-essay.typ` | The essay set in Typst. A conformance sample. |
| `examples/essay.html`, `examples/letter.html` | The same documents in CSS, paginated with Paged.js. |
| `examples/two-column.html` | The two-column template in CSS. Prints from the browser — see below. |
| `implementations/example-two-column.typ` | The two-column template in Typst. |
| `specimen.css`, `specimen.js` | Chrome for the specimen page. Never shipped in a document. |
| `tools/build-spec.mjs` | Generates `SPEC.md` from `spec.json`. |
| `tools/check.mjs` | Verifies the implementations still match the spec. |

The site quotes real code: every CSS and Typst panel is extracted at page load
from the marker pairs in the source files (`/*! @s id :: Title */` and
`// @s id`). Nothing is transcribed, so a panel cannot drift from the file it
describes.

## Working on it

```sh
node tools/build-spec.mjs   # regenerate SPEC.md after editing spec.json
node tools/check.mjs        # verify implementations against the spec
python3 -m http.server      # then open http://localhost:8000
```

`check.mjs` fails the build when a token in `typeset.css` no longer matches
`spec.json`, when a spec section has no panel or no CSS marker, or when
`SPEC.md` is stale. Run it before pushing.

The specimen page fetches `spec.json`, `typeset.css` and `typeset.typ`, which
`file://` blocks — serve the directory or every panel reports that it could not
load the spec.

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
