# typeset — restructure design

**Date:** 2026-09-11
**Ticket:** NT (no ticket — personal project)

Progress is tracked by the branches and pull requests named below, not by a
status line here.

Five pieces of work, each a feature branch merged to `master` before the next
begins. No two branches open at once.

---

## Why

Five problems with the site as it stands, in the order they get fixed:

1. **Styles are named inconsistently.** `spec.json` gives every element a human
   name, but the name is not load-bearing. The demo labels are typed by hand,
   the CSS reaches some styles through a bare element selector and others
   through a class whose name does not match the spec, and Typst uses a third
   vocabulary again. Nothing stops the three drifting apart.
2. **The code panels show the wrong thing.** The CSS and Typst tabs show how
   the style is *configured*. A reader downloads the whole stylesheet, so the
   configuration is not what they need — they need the source that produces the
   example beside it, ready to paste.
3. **The basics are under-demonstrated.** Eleven named inline styles share one
   prose paragraph. A reader cannot see small caps on its own, or find the
   markup that produced it.
4. **Templates are mixed in with the specification.** A template consumes the
   typeset; it is not part of it. Templates are also bounded by the technology
   they target, and those bounds differ sharply — CSS and Typst can express the
   whole spec, iA Writer can express a Markdown subset of it.
5. **Margins are mirrored, and usually should not be.** `foundation.page`
   hardcodes a 28mm inner and 22mm outer margin. Mirrored margins are right for
   bound duplex work and wrong for nearly everything else, and the templates
   inherit the wrong default.

## Decisions taken

| Question | Decision |
|---|---|
| Class naming scheme | Derived mechanically from the `spec.json` element id: `.ts-<element-id>`, with element ids normalised to `<section>-<style>`. The Typst symbol uses the same name. |
| Migration for old class names | Hard cutover. Major version bump, full old→new table in the release notes, plus a codemod script that rewrites a document. |
| Document-level modifiers | Out of scope. All 9 of them — `.typeset--justified`, `--indented`, `--numbered`, `--sidenotes`, `--two-column`, `--ragged`, `--measure-narrow`, `--measure-wide`, `--column-rule` — stay as they are. They are document options, not element styles. |
| Page layout naming | Two named layouts, `symmetric` and `mirrored`. `symmetric` is the default. |
| Templates | Split by path inside this repository rather than extracted to a second one. The template builds consume the built bundle rather than raw source, which makes a later extraction a rename. |
| Typst example snippets | Compile-verified in CI. `typst` joins the deploy workflow. |

## Constraints that hold across every group

- `spec.json` stays normative. Where an implementation and the spec disagree,
  the spec is right.
- `index.html` and `files/*.html` stay generated. `tools/check.mjs` stays the
  gate that fails a stale commit.
- The published page keeps rendering with JavaScript disabled and keeps opening
  from the filesystem.
- Bare semantic markup keeps working. `<blockquote>` inside `.typeset` styles
  itself; the new class is a handle and a name, not a requirement.

---

## Group 1 — `feat/named-styles`

One canonical name per style, carried into all three representations and
enforced by the checker.

**Spec.** Normalise every element id to `<section>-<style>`. There are 95 of
them, counted on 2026-09-11 with

```sh
node -e "const s=require('./spec.json'); console.log(s.sections.reduce((n,x)=>n+x.elements.length,0))"
```

Some already have this shape (`break-asterisks`, `callout-warning`,
`util-tie`); others do not (`epigraph`, `pullquote`, `verse`, `attribution`).
Each element keeps its human `name` alongside the id.

**CSS.** The class for an element is `.ts-<element-id>`, derived, never chosen.
There are 57 distinct `.ts-*` classes to map today
(`grep -o '\.ts-[a-z0-9-]*' typeset.css | sort -u | wc -l`, 2026-09-11), plus
the 9 document modifiers that stay as they are. Worked examples:

```
.ts-epigraph      → .ts-quote-epigraph
.ts-pullquote     → .ts-quote-pullquote
.ts-verse         → .ts-quote-verse
.ts-attribution   → .ts-quote-attribution
.ts-sc            → .ts-inline-small-caps
.ts-ps            → .ts-letter-postscript
.ts-tie           → .ts-util-tie
(bare blockquote) → .ts-quote-blockquote, alongside the bare selector
```

**Typst.** One exported symbol per named style, named for the element id.
`break-scene(kind: "asterism")` becomes four symbols — `break-asterisks`,
`break-asterism`, `break-fleuron`, `break-rule` — because the spec names four
styles; an internal helper may still back all four. Document- and
template-level entry points (`typeset`, `letter-page`, `two-column`, `toc`)
are the Typst counterpart of the document modifiers and stay as they are.

**Checker.** `tools/check.mjs` gains a bidirectional naming gate: a spec
element with no matching CSS class or no matching Typst symbol fails the build,
and so does a `.ts-*` class or exported symbol with no spec element behind it.

One wrinkle to settle while implementing: the stylesheet carries helper classes
that are not elements in their own right — `.ts-num`, `.ts-leader`, `.ts-label`,
`.ts-bare`, `.ts-span`, `.ts-note`, `.ts-noteref` among them. Each is either
promoted to a spec element with a name of its own, or declared internal in a
short list the checker reads. Promote where the thing is genuinely a named
style a reader would reach for; declare internal only where it is plumbing.

**Consumers to update in the same branch.** Enumerated on 2026-09-11 with

```sh
git grep -lE 'ts-[a-z0-9-]+' | grep -v -e '^index.html$' -e '^files/' -e '^typeset.css$' -e '^docs/'
git grep -lE '(epigraph|pullquote|verse|callout|break-scene|dropcap|sidenote)' -- '*.typ'
```

which together return 35 files — re-run both before starting, since the list moves. The
ones worth calling out because they are easy to miss:

- 19 of the 26 files under `src/demos/`.
- `examples/essay.html`, `examples/letter.html`, `examples/two-column.html`.
- `proofs/font-proof.html`.
- `implementations/iawriter/iawriter.css` and
  `implementations/iawriter/letter/page.css`.
- All four `.typ` files, `implementations/typeset.typ` included.
- `specimen.css` and `examples/preview-bar.js` — page furniture that reaches
  into document classes, and the least obvious hits in the list.
- `src/sections.json`, `tools/check.mjs`, `README.md`, `SPEC.md` — prose and
  configuration that name classes rather than use them.

**Migration.** `tools/codemod-names.mjs` rewrites old names to new in a
document given on the command line. It covers CSS classes and Typst symbols
alike, which is why it is named for names rather than for classes. `spec.json`
goes to `2.0.0`, `SPEC.md` is regenerated, and the migration note carries the
complete old→new table.

**Done when:** the checker enforces the mapping in both directions, every
in-repo document uses the new names, and the rendered site is visually
unchanged — this group renames things, it does not restyle them.

---

## Group 2 — `feat/example-source`

The panel tabs become **Spec · HTML · Typst**, and the two code tabs show the
source that produces the rendered example beside them rather than the
configuration behind it.

**HTML pane.** Extracted from `src/demos/<id>.html` with the specimen chrome
removed — `pair__label`, `demo-note` and the `.paper .typeset` wrapper are page
furniture, not document source. This needs a marker convention inside the demo
files so the extraction takes exactly the document fragment. Follow the
convention already established by `/*! @s id :: Title */` in the CSS.

**Typst pane.** Needs `src/demos/<id>.typ`, one per section. None exist today —
the repository has three whole example documents and no per-section snippets.
This is the bulk of the group.

**Boilerplate.** Shown once on the page — how to link the stylesheet, how to
import the template — never repeated in a panel.

**Verification.** `typst` is added to `.github/workflows/deploy.yml`, and
`tools/check.mjs` compiles every `src/demos/*.typ` snippet against
`implementations/typeset.typ`. A snippet that does not run cannot ship.

**The configuration does not disappear.** `files/typeset-css.html` and
`files/typeset-typ.html` already publish the full implementation with line
numbers. Each section gains a deep link to the relevant line range there, so
what the tabs stop showing is still one click away.

**Done when:** every section shows runnable HTML and runnable Typst for its own
example, CI compiles all of it, and no panel repeats the boilerplate.

---

## Group 3 — `feat/basics-coverage`

One labelled example per named style, in the pattern the quotations section
already uses, with the label generated from the spec rather than typed.

**Priority order**, worst first: `inline` (11 named styles in a single prose
blob, counted from `spec.json` on 2026-09-11), `numerals`, `lists`, `utilities`, `links`, `headings`.

Plain HTML and plain Typst elements are fine as the demonstrated source — the
point is that the layout configuration does the work in the background, and the
reader should see exactly what they would type.

**Checker.** A coverage gate: every element in `spec.json` must either appear
in a demo or be listed, with a reason, in an explicit exemptions list the
checker reads. A few elements state a prohibition rather than a style —
`justified-exclusions` names what is *never* justified — and cannot be
demonstrated in isolation. The exemption must be written down rather than
silently tolerated, so the list stays short and visible.

**Done when:** every named style has its own labelled example with source or a
recorded reason why it cannot, and the checker enforces that.

---

## Group 4 — `feat/page-layouts`

`foundation.page` gains a `layout` key with two named values.

- **`symmetric`** — the default. 25mm on all four sides of A4. This gives a
  160mm text block, which is exactly what the current mirrored margins give
  (210 − 28 − 22 = 160; 210 − 25 − 25 = 160), so the measure, the scale and
  every value derived from them are unchanged. This is a page-box switch and
  nothing more.
- **`mirrored`** — opt-in. The current 28mm inner, 22mm outer, for bound or
  duplex-printed work where the gutter must stay put.

**CSS.** `@page` carries the symmetric margins; `:left` and `:right` margin
boxes apply only under the mirrored opt-in.

**Typst.** `page(margin: 25mm)` against `page(margin: (inside: 28mm, outside:
22mm))`.

**Consumers.** Examples and templates move to `symmetric`. The letter in
particular: a letter is not bound, and mirrored margins on it are simply wrong.

**A conformance gap this group must close, found while naming the styles in
Group 1.** `spec.json` declares `letter-page` as 32mm top, 28mm bottom, 25mm
sides, with no running head and no folio. `implementations/typeset.typ:501-508`
honours all five unconditionally. **`typeset.css` implements none of them** — it
has no letter-specific `@page` rule at all, so a letter rendered through the
stylesheet comes out on the document's default mirrored page, carrying a running
head and a folio it is not supposed to have.

This is not an engine-capability limit — `@page` selectors are exactly what the
CSS implementation already uses for the default page — so it does not belong in
the element's `fallback` field, which reads on the site as "Where unsupported"
and would present the gap as an acceptable degradation. It is simply unwritten
CSS, and this group is where the page box gets restructured, so this is where it
gets written.

**Verification.** The arithmetic above is checked against `spec.json` but must
be confirmed against a rendered page before the values land — compile an
example in both layouts and measure the text block.

**Done when:** both layouts are named in the spec, both implementations honour
the switch, `symmetric` is what a document gets without asking, and the checker
verifies the margin values in both.

---

## Group 5 — `feat/templates-split`

**Paths.** The site splits into `/spec/` — the specification and the specimen
page — and `/templates/`. A small home page at `/` routes between them and
points at the downloads. Old anchors redirect.

**Boundary.** `src/templates/` becomes self-contained. The template builds
(`tools/build-iawriter.mjs` today) consume the built bundle in `downloads/`
rather than reaching into `typeset.css` and `fonts/` directly. This is the
change that matters: once a template consumes a published artifact rather than
its neighbour's source, extracting `/templates/` into its own repository is a
rename rather than a redesign.

**Capability matrix.** Published on the templates page, stating plainly what
each technology can express:

| | CSS + Paged.js | Typst | iA Writer |
|---|---|---|---|
| Full spec vocabulary | yes | yes | Markdown subset only |
| Paginated two columns | no (Paged.js cannot fragment a column flow) | yes | no (WebKit ignores multi-column on print) |
| Running head and folio | yes, via Paged Media | yes, natively | no (iA Writer owns the page margins) |
| True page-foot footnotes | WeasyPrint and Prince only | yes, natively | no |

**Done when:** the two paths are separate, the home page routes between them,
the template builds consume the bundle, the matrix is published, and a reader
landing on `/` can tell in one screen whether they want a specification or a
template.

---

## Risks

- **Group 1 is the breaking change** and every later group rides on the names it
  establishes. It must land clean before Group 2 opens.
- **Group 2 puts the first binary dependency into CI.** `typst` in the workflow
  is new; a version pin is required so a snippet cannot start failing because
  the compiler moved under it.
- **Group 4's arithmetic is stated, not yet observed.** Confirm the 160mm text
  block on a rendered page before the values are committed.
- **Group 3 is large but shallow.** 95 examples is a lot of content; the risk is
  fatigue rather than difficulty, and the coverage gate is what stops it being
  left half-done.

## Working agreement

One branch at a time. Each group opens a draft PR, goes green in CI, is marked
ready, and is reviewed and merged to `master` before the next branch is cut.
No parallel branches.

## Carried forward

Found while implementing a group, deliberately not fixed there. Each names the
group that owns it, so nothing here is homeless. The per-group ledgers under
`.superpowers/` are scratch and get deleted when a group closes — this list is
committed because these items must outlive them.

**Owned by the API group** (rides with the singular rename, before Group 5):

- **A bibliography heading has no element.** `templates.two-column.spanning.always`
  named one, but the `bibliography` section holds exactly `bibliography-entry`,
  and the entry contradicted `spanning.never`'s "heading 2 and below". Group 4
  dropped it from the list rather than invent an element inside a page-layouts
  task. The `#references` block this group is building is the natural owner of a
  heading, and both implementations should span it once it exists. Until then an
  author marks it with `.ts-span` / `#span()`, which still works.

**Owned by Group 3** (handholding — an example for every style):

- **Nine spec elements have no Typst implementation.** They pass the CSS side of
  the conformance check and have nothing to compile on the other. The coverage
  gate Group 3 builds is what will surface them as a list rather than a
  recollection.

**Unowned — decide before 2.0.0 ships:**

- **`dropcap()` reads `body.text`**, which holds only when the body is a bare
  string. Any markup and the cap is taken from the wrong character, silently.
- **`typeset()` ends in `block(width: measure, doc)`**, and a container is a
  place where `set page()` cannot take effect. That is what broke the letter
  page: `#show: letter-page` then `#show: typeset` put the page rules inside the
  block. The fix is a design question about how `typeset` should assert a
  measure, not a patch.
- **`notes-sidenote` is fixed at 13em**, so a sidenote does not follow a clamped
  measure on A5. Group 4 found it and left it, because sizing a sidenote against
  the margin it lives in is its own piece of work.
- **`tools/check.mjs`'s CSS conformance checks assert source text; its Typst
  checks measure a render.** Three rounds of adversarial review against the
  two-column spanning gate (Group 4) each found a construction that passed a
  CSS-side assertion while breaking the feature it was meant to guarantee — a
  missing combinator, a retargeted ancestor, an unchecked container — and each
  fix closed that one hole. The Typst side held against the same style of
  attack, including attempts the reviewers did not name in advance, because it
  renders the document with `typst compile` and reads the actual output rather
  than the source that is meant to produce it. This is structural, not an
  oversight in any one gate: this toolchain has no headless browser, so a CSS
  assertion can only ever read source text next to the behaviour, and a source
  read can be walked around by any construction its author did not anticipate.
  Closing it for CSS the way the Typst side is closed would mean adding a
  headless-browser dependency to the check (for example Playwright or
  Puppeteer, driving Paged.js the way the site itself does) and asserting
  computed layout instead of declared rules. That is a real dependency and
  maintenance decision, not a task-sized patch, so it is recorded here rather
  than decided inside a page-layouts task. Whoever owns `tools/check.mjs`
  should decide whether that dependency is worth paying for before 2.0.0 ships;
  until it is, expect the CSS arm of any future conformance gate to have the
  same shape of blind spot the spanning gate did.
