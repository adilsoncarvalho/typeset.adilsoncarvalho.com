# Migrating to typeset 2.0

Every style now has one canonical name: the CSS class, the Typst symbol and
the `spec.json` element id are the same word. Before 2.0 they were three
separate vocabularies — a class could drift from its symbol, or either could
drift from the spec, with nothing to catch it. `tools/check.mjs` now fails
when they disagree.

Renaming is the mechanical change every document needs. The default page
margin also changed — see below — so a migrated document does not sit on
quite the same page it did in 1.x.

## Margins

1.x had one page margin, and it was always the mirrored kind: 25mm top and
bottom, 28mm on the binding edge, 22mm on the outside. 2.0 defaults instead to
a symmetric margin — `standard`, 20mm on all four sides — and keeps the
mirrored scheme as an explicit opt-in, now called duplex, for a document that
will be bound. Duplex `standard` is 23mm inner, 17mm outer: not the same
numbers 1.x used, because the pair now derives from the symmetric value it
sits alongside (preserving the total, 40mm, and shifting the gutter by 3mm)
rather than being chosen on its own.

Neither the class-name codemod nor the Typst rename table below touches this.
A 1.x document that migrates cleanly on both still reflows onto a different
page: the text width moves from 160mm to 170mm, a two-column document's
columns move from 77mm to 82mm, and the running head and folio move with the
margin that carries them. `narrow` and `wide` exist alongside `standard` for a
document that wants a different page than the new default. None of the three
named duplex sizes reproduces the 1.x 28mm/22mm split exactly — each one is
now derived from its symmetric counterpart rather than chosen on its own — so
a document that must keep its old 1.x page needs a custom margin override.

A different pair of classes, spelled confusingly close to the margin names
above, did rename: `.typeset--narrow` and `.typeset--wide` were 1.x's names
for the measure variants — a narrower or wider text column, an axis with
nothing to do with the page margin. They are `.typeset--measure-narrow` and
`.typeset--measure-wide` in 2.0, precisely so `narrow`/`wide` cannot mean two
different things once a margin can be named that too. Unlike the margin
classes, this one is a straight rename and the codemod below rewrites both;
an unmigrated document that still carries the 1.x class keeps a name 2.0
does not style, and silently falls back to the 33em default measure — no
error, no visual cue, just the wrong line length.

## Migrating an HTML or CSS document

    node tools/codemod-names.mjs path/to/document.html

The codemod rewrites every 1.x `ts-*` class name to its 2.0 name, in place.
Run it against each document. It is idempotent against this map, so a second
run over an already-migrated file finds nothing left to rewrite and reports it
unchanged. Three things the rewrite does not settle on its own:

### Section breaks

1.x used a base class plus a modifier: `class="ts-break ts-break--asterism"`.
2.0 gives each variant its own class standing alone over the same internal
base: `class="ts-break ts-break-asterism"`.

The case that bites: a bare `class="ts-break"`, with no modifier, rendered
three asterisks in 1.x — the base class's own `::before` carried that
default. In 2.0 the default lives on `.ts-break-asterisks` instead, and the
base carries no mark of its own. An unmigrated bare `ts-break` renders as
**empty white space**, not three asterisks. Add `ts-break-asterisks`,
`ts-break-asterism`, `ts-break-fleuron` or `ts-break-rule` explicitly.

Either element carries the variant. `<div class="ts-break ts-break-asterism">`
is what the codemod leaves behind and stays correct; `<hr class="ts-break-asterism">`
is the form the examples on the site use, because `<hr>` is the element HTML
already has for a thematic break, and a reader of the markup gets the meaning
without the class. The four variants render the same either way, as does the
paragraph that follows one. The single difference is that a browser's own
stylesheet gives `<hr>` `overflow: hidden`, so a document that also clamps the
mark's `height` or `line-height` tightly enough for the glyph to spill out of
its box would see it clipped on the `<hr>` and not on the `<div>`. No variant
is exposed to it as shipped: three leave the height `auto` so the box grows to
fit the mark, and `.ts-break-rule` does set `height: 0` but renders no mark to
clip. So this is a reason to be careful when overriding, not a reason to prefer
one element. There is no need to convert a migrated document.

### Labels

1.x used one `.ts-label` hook, styled entirely by its ancestor — a table
caption, a figure caption, the abstract, a letter's address block each gave
it different rules through the surrounding selector. 2.0 keeps `.ts-label`
as a shared base (small caps, weight, tracking) but moves what makes each
one different onto four named variants chosen by context:
`ts-table-caption-label`, `ts-figure-caption-label`,
`ts-frontmatter-abstract-label`, `ts-letter-address-label`. A `.ts-label`
left bare, with no variant, renders with only the shared treatment and none
of the context-specific styling it had in 1.x.

### Collapsed spellings

1.x spelled a number of rules more than one way, so 52 of its class names
collapse onto 25 names in 2.0. The codemod resolves every one of them inside
the documents you point it at.

Two are worth knowing about by name. `ts-nowrap` and `ts-tie` were two 1.x
names for one rule, and `ts-page-break-avoid` and `ts-keep-together` were two
names for another; 2.0 keeps `ts-utility-tie` and
`ts-utility-keep-together`. If your own stylesheet or scripts select on the
1.x spellings, update those selectors by hand — the codemod rewrites documents,
not the code that reads them.

The remaining collapses are alias spellings of a single rule — `ts-sc` beside
`ts-small-caps`, `ts-break--rule` beside `ts-break-rule` — and need no
attention beyond running the tool.

## Migrating a Typst document

The codemod above only rewrites `ts-`-prefixed class names in CSS and HTML.
It does not touch Typst source. Rename these symbols by hand:

| 1.x | 2.0 |
|---|---|
| `epigraph` | `quote-epigraph` |
| `pullquote` | `quote-pullquote` |
| `verse` | `quote-verse` |
| `break-scene(kind: "asterisks")` | `break-asterisks()` |
| `break-scene(kind: "asterism")` | `break-asterism()` |
| `break-scene(kind: "fleuron")` | `break-fleuron()` |
| `break-scene(kind: "rule")` | `break-rule()` |
| `title-block` | `frontmatter-title-block` |
| `abstract` | `frontmatter-abstract` |
| `colophon` | `frontmatter-colophon` |
| `letterhead` | `letter-sender` |
| `date-note` | `letter-date-note` |
| `address` | `letter-address-block` |
| `signature` | `letter-signature` |
| `enclosures` | `letter-enclosures` |
| `postscript` | `letter-postscript` |
| `sidenote` | `note-sidenote` |
| `keep-together` | `utility-keep-together` |
| `tie` | `utility-tie` |

`break-scene` took a `kind:` argument selecting one of four looks; 2.0 gives
each look its own zero-argument function. `callout`, `dropcap`, `toc`,
`ts-table`, `two-column`, `span` and `epigraph-right` keep their 1.x names, with no
change to how they're called.

`letter-page` also keeps its 1.x name, but not its 1.x usage — the name
surviving is what makes this easy to miss. A letter now opens with
`#show: letter-page` alone: the function calls `typeset.with()` itself, where
1.x needed a separate `#show: typeset` line beneath it. That 1.x form now
hard-errors — `page configuration is not allowed inside of containers`,
pointing into the library rather than at the line to delete. Delete the
`#show: typeset` line beneath `#show: letter-page` and the document compiles
again.

## The full class table

84 classes change name between 1.x and 2.0 — 82 named-style classes, plus
the two measure variants from Margins above, `.typeset--narrow` and
`.typeset--wide`. 42 more named-style classes are spelled identically in
both and are not listed below: 15 always were (`ts-dropcap`,
`ts-code-inline`, `ts-toc`, the numerals classes and others), and 27 more —
`ts-table`, `ts-figure`, `ts-callout`, `ts-link`, every `ts-list-*` and
`ts-break-*` variant, and a handful of others — arrive back at their 1.x
spelling because the singular rename undoes the pluralisation the 2.0.0 name
briefly carried. `.ts-print-only` and `.ts-screen-only` are unchanged in 2.0
as well.

| 1.x | 2.0 |
|---|---|
| `.ts-abbr` | `.ts-inline-abbr` |
| `.ts-abstract` | `.ts-frontmatter-abstract` |
| `.ts-address` | `.ts-letter-address-block` |
| `.ts-address-block` | `.ts-letter-address-block` |
| `.ts-attribution` | `.ts-quote-attribution` |
| `.ts-bare` | `.ts-link-bare` |
| `.ts-bibliography` | `.ts-bibliography-entry` |
| `.ts-blockquote` | `.ts-quote-blockquote` |
| `.ts-break--asterism` | `.ts-break-asterism` |
| `.ts-break--fleuron` | `.ts-break-fleuron` |
| `.ts-break--rule` | `.ts-break-rule` |
| `.ts-byline` | `.ts-frontmatter-byline` |
| `.ts-callout--warning` | `.ts-callout-warning` |
| `.ts-closing` | `.ts-letter-closing` |
| `.ts-colophon` | `.ts-frontmatter-colophon` |
| `.ts-date` | `.ts-letter-date` |
| `.ts-date-note` | `.ts-letter-date-note` |
| `.ts-dateline` | `.ts-frontmatter-dateline` |
| `.ts-definition-description` | `.ts-list-definition-description` |
| `.ts-definition-term` | `.ts-list-definition-term` |
| `.ts-deleted` | `.ts-inline-deleted` |
| `.ts-emphasis` | `.ts-inline-emphasis` |
| `.ts-emphasis-nested` | `.ts-inline-emphasis-nested` |
| `.ts-enclosures` | `.ts-letter-enclosures` |
| `.ts-endnotes` | `.ts-note-endnotes` |
| `.ts-epigraph` | `.ts-quote-epigraph` |
| `.ts-footnote` | `.ts-note-footnote` |
| `.ts-frac` | `.ts-numeral-fractions` |
| `.ts-h1` | `.ts-heading-h1` |
| `.ts-h2` | `.ts-heading-h2` |
| `.ts-h3` | `.ts-heading-h3` |
| `.ts-h4` | `.ts-heading-h4` |
| `.ts-h5` | `.ts-heading-h5` |
| `.ts-h6` | `.ts-heading-h6` |
| `.ts-highlight` | `.ts-inline-highlight` |
| `.ts-inserted` | `.ts-inline-inserted` |
| `.ts-justified-exclusions` | `.ts-justification-exclusions` |
| `.ts-justified-prose` | `.ts-justification-justified` |
| `.ts-kbd` | `.ts-inline-kbd` |
| `.ts-keep-together` | `.ts-utility-keep-together` |
| `.ts-leader` | `.ts-toc-leader` |
| `.ts-lede` | `.ts-dropcap-lede` |
| `.ts-letterhead` | `.ts-letter-sender` |
| `.ts-no-hyphens` | `.ts-utility-no-hyphens` |
| `.ts-note` | `.ts-note-footnote` |
| `.ts-noteref` | `.ts-note-marker` |
| `.ts-nowrap` | `.ts-utility-tie` |
| `.ts-num` | `.ts-table-cell-numeric` |
| `.ts-number-h2` | `.ts-numbering-h2` |
| `.ts-number-h3` | `.ts-numbering-h3` |
| `.ts-nums-lining` | `.ts-numeral-display` |
| `.ts-nums-oldstyle` | `.ts-numeral-prose` |
| `.ts-nums-tabular` | `.ts-numeral-tabular` |
| `.ts-page-break-after` | `.ts-utility-break-after` |
| `.ts-page-break-avoid` | `.ts-utility-keep-together` |
| `.ts-page-break-before` | `.ts-utility-break-before` |
| `.ts-paragraph` | `.ts-paragraph-spaced` |
| `.ts-postscript` | `.ts-letter-postscript` |
| `.ts-ps` | `.ts-letter-postscript` |
| `.ts-pullquote` | `.ts-quote-pullquote` |
| `.ts-ragged-prose` | `.ts-justification-ragged` |
| `.ts-run-in` | `.ts-heading-run-in` |
| `.ts-salutation` | `.ts-letter-salutation` |
| `.ts-sc` | `.ts-inline-small-caps` |
| `.ts-sidenote` | `.ts-note-sidenote` |
| `.ts-signature` | `.ts-letter-signature` |
| `.ts-small-caps` | `.ts-inline-small-caps` |
| `.ts-strong` | `.ts-inline-strong` |
| `.ts-subscript` | `.ts-inline-subscript` |
| `.ts-subtitle` | `.ts-frontmatter-subtitle` |
| `.ts-superscript` | `.ts-inline-superscript` |
| `.ts-tie` | `.ts-utility-tie` |
| `.ts-title-block` | `.ts-frontmatter-title-block` |
| `.ts-titleblock` | `.ts-frontmatter-title-block` |
| `.ts-toc-2` | `.ts-toc-entry-2` |
| `.ts-util-break-after` | `.ts-utility-break-after` |
| `.ts-util-break-before` | `.ts-utility-break-before` |
| `.ts-util-color-adjust` | `.ts-utility-color-adjust` |
| `.ts-util-keep-together` | `.ts-utility-keep-together` |
| `.ts-util-no-hyphens` | `.ts-utility-no-hyphens` |
| `.ts-util-tie` | `.ts-utility-tie` |
| `.ts-verse` | `.ts-quote-verse` |
| `.typeset--narrow` | `.typeset--measure-narrow` |
| `.typeset--wide` | `.typeset--measure-wide` |
