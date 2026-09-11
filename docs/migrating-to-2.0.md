# Migrating to typeset 2.0

Every style now has one canonical name: the CSS class, the Typst symbol and
the `spec.json` element id are the same word. Before 2.0 they were three
separate vocabularies — a class could drift from its symbol, or either could
drift from the spec, with nothing to catch it. `tools/check.mjs` now fails
when they disagree.

Nothing about the typography changed. This release renames things.

## Migrating an HTML or CSS document

    node tools/codemod-names.mjs path/to/document.html

The codemod rewrites every 1.x `ts-*` class name to its 2.0 name, in place.
Run it against each document. Three things it cannot decide for you:

### Section breaks

1.x used a base class plus a modifier: `class="ts-break ts-break--asterism"`.
2.0 gives each variant its own class standing alone over the same internal
base: `class="ts-break ts-breaks-asterism"`.

The case that bites: a bare `class="ts-break"`, with no modifier, rendered
three asterisks in 1.x — the base class's own `::before` carried that
default. In 2.0 the default lives on `.ts-breaks-asterisks` instead, and the
base carries no mark of its own. An unmigrated bare `ts-break` renders as
**empty white space**, not three asterisks. Add `ts-breaks-asterisks`,
`ts-breaks-asterism`, `ts-breaks-fleuron` or `ts-breaks-rule` explicitly.

### Labels

1.x used one `.ts-label` hook, styled entirely by its ancestor — a table
caption, a figure caption, the abstract, a letter's address block each gave
it different rules through the surrounding selector. 2.0 keeps `.ts-label`
as a shared base (small caps, weight, tracking) but moves what makes each
one different onto four named variants chosen by context:
`ts-tables-caption-label`, `ts-figures-caption-label`,
`ts-frontmatter-abstract-label`, `ts-letter-address-label`. A `.ts-label`
left bare, with no variant, renders with only the shared treatment and none
of the context-specific styling it had in 1.x.

### The two collapsed pairs

`ts-nowrap` collapsed onto `ts-utilities-tie`, and `ts-page-break-avoid`
collapsed onto `ts-utilities-keep-together` — each pair named the same rule
twice in 1.x, and 2.0 keeps one name. The codemod rewrites both old spellings
to the surviving name, so no action is needed beyond running it.

## Migrating a Typst document

The codemod above only rewrites `ts-`-prefixed class names in CSS and HTML.
It does not touch Typst source. Rename these symbols by hand:

| 1.x | 2.0 |
|---|---|
| `epigraph` | `quotes-epigraph` |
| `pullquote` | `quotes-pullquote` |
| `verse` | `quotes-verse` |
| `callout` | `callouts-callout` |
| `break-scene(kind: "asterisks")` | `breaks-asterisks()` |
| `break-scene(kind: "asterism")` | `breaks-asterism()` |
| `break-scene(kind: "fleuron")` | `breaks-fleuron()` |
| `break-scene(kind: "rule")` | `breaks-rule()` |
| `title-block` | `frontmatter-title-block` |
| `abstract` | `frontmatter-abstract` |
| `colophon` | `frontmatter-colophon` |
| `letterhead` | `letter-sender` |
| `date-note` | `letter-date-note` |
| `address` | `letter-address-block` |
| `signature` | `letter-signature` |
| `enclosures` | `letter-enclosures` |
| `postscript` | `letter-postscript` |
| `toc` | `toc-entry` |
| `sidenote` | `notes-sidenote` |
| `keep-together` | `utilities-keep-together` |
| `tie` | `utilities-tie` |

`break-scene` took a `kind:` argument selecting one of four looks; 2.0 gives
each look its own zero-argument function. `dropcap`, `ts-table`,
`two-column`, `span`, `letter-page` and `epigraph-right` keep their 1.x
names.

## The full class table

111 classes change name between 1.x and 2.0. 14 more — `ts-dropcap`,
`ts-code-inline`, the numerals classes and others — are spelled identically
in both and are not listed below.

| 1.x | 2.0 |
|---|---|
| `.ts-abbr` | `.ts-inline-abbr` |
| `.ts-abstract` | `.ts-frontmatter-abstract` |
| `.ts-address` | `.ts-letter-address-block` |
| `.ts-address-block` | `.ts-letter-address-block` |
| `.ts-attribution` | `.ts-quotes-attribution` |
| `.ts-bare` | `.ts-links-bare` |
| `.ts-bibliography` | `.ts-bibliography-entry` |
| `.ts-blockquote` | `.ts-quotes-blockquote` |
| `.ts-break--asterism` | `.ts-breaks-asterism` |
| `.ts-break--fleuron` | `.ts-breaks-fleuron` |
| `.ts-break--rule` | `.ts-breaks-rule` |
| `.ts-break-asterisks` | `.ts-breaks-asterisks` |
| `.ts-break-asterism` | `.ts-breaks-asterism` |
| `.ts-break-fleuron` | `.ts-breaks-fleuron` |
| `.ts-break-rule` | `.ts-breaks-rule` |
| `.ts-byline` | `.ts-frontmatter-byline` |
| `.ts-callout` | `.ts-callouts-callout` |
| `.ts-callout--warning` | `.ts-callouts-warning` |
| `.ts-callout-title` | `.ts-callouts-title` |
| `.ts-callout-warning` | `.ts-callouts-warning` |
| `.ts-closing` | `.ts-letter-closing` |
| `.ts-colophon` | `.ts-frontmatter-colophon` |
| `.ts-date` | `.ts-letter-date` |
| `.ts-date-note` | `.ts-letter-date-note` |
| `.ts-dateline` | `.ts-frontmatter-dateline` |
| `.ts-definition-description` | `.ts-lists-definition-description` |
| `.ts-definition-term` | `.ts-lists-definition-term` |
| `.ts-deleted` | `.ts-inline-deleted` |
| `.ts-emphasis` | `.ts-inline-emphasis` |
| `.ts-emphasis-nested` | `.ts-inline-emphasis-nested` |
| `.ts-enclosures` | `.ts-letter-enclosures` |
| `.ts-endnotes` | `.ts-notes-endnotes` |
| `.ts-epigraph` | `.ts-quotes-epigraph` |
| `.ts-figure` | `.ts-figures-figure` |
| `.ts-figure-caption` | `.ts-figures-caption` |
| `.ts-footnote` | `.ts-notes-footnote` |
| `.ts-frac` | `.ts-numerals-fractions` |
| `.ts-h1` | `.ts-headings-h1` |
| `.ts-h2` | `.ts-headings-h2` |
| `.ts-h3` | `.ts-headings-h3` |
| `.ts-h4` | `.ts-headings-h4` |
| `.ts-h5` | `.ts-headings-h5` |
| `.ts-h6` | `.ts-headings-h6` |
| `.ts-heading-run-in` | `.ts-headings-run-in` |
| `.ts-highlight` | `.ts-inline-highlight` |
| `.ts-inserted` | `.ts-inline-inserted` |
| `.ts-justified-exclusions` | `.ts-justification-exclusions` |
| `.ts-justified-prose` | `.ts-justification-justified` |
| `.ts-kbd` | `.ts-inline-kbd` |
| `.ts-keep-together` | `.ts-utilities-keep-together` |
| `.ts-leader` | `.ts-toc-leader` |
| `.ts-lede` | `.ts-dropcap-lede` |
| `.ts-letterhead` | `.ts-letter-sender` |
| `.ts-link` | `.ts-links-link` |
| `.ts-link-print-url` | `.ts-links-print-url` |
| `.ts-list-ordered` | `.ts-lists-ordered` |
| `.ts-list-ordered-nested` | `.ts-lists-ordered-nested` |
| `.ts-list-tight` | `.ts-lists-tight` |
| `.ts-list-unordered` | `.ts-lists-unordered` |
| `.ts-list-unordered-nested` | `.ts-lists-unordered-nested` |
| `.ts-no-hyphens` | `.ts-utilities-no-hyphens` |
| `.ts-note` | `.ts-notes-footnote` |
| `.ts-note-marker` | `.ts-notes-marker` |
| `.ts-noteref` | `.ts-notes-marker` |
| `.ts-nowrap` | `.ts-utilities-tie` |
| `.ts-num` | `.ts-tables-cell-numeric` |
| `.ts-number-h2` | `.ts-numbering-h2` |
| `.ts-number-h3` | `.ts-numbering-h3` |
| `.ts-nums-lining` | `.ts-numerals-display` |
| `.ts-nums-oldstyle` | `.ts-numerals-prose` |
| `.ts-nums-tabular` | `.ts-numerals-tabular` |
| `.ts-page-break-after` | `.ts-utilities-break-after` |
| `.ts-page-break-avoid` | `.ts-utilities-keep-together` |
| `.ts-page-break-before` | `.ts-utilities-break-before` |
| `.ts-paragraph` | `.ts-paragraphs-spaced` |
| `.ts-paragraph-indented` | `.ts-paragraphs-indented` |
| `.ts-postscript` | `.ts-letter-postscript` |
| `.ts-ps` | `.ts-letter-postscript` |
| `.ts-pullquote` | `.ts-quotes-pullquote` |
| `.ts-ragged-prose` | `.ts-justification-ragged` |
| `.ts-run-in` | `.ts-headings-run-in` |
| `.ts-salutation` | `.ts-letter-salutation` |
| `.ts-sc` | `.ts-inline-small-caps` |
| `.ts-sidenote` | `.ts-notes-sidenote` |
| `.ts-signature` | `.ts-letter-signature` |
| `.ts-small-caps` | `.ts-inline-small-caps` |
| `.ts-strong` | `.ts-inline-strong` |
| `.ts-subscript` | `.ts-inline-subscript` |
| `.ts-subtitle` | `.ts-frontmatter-subtitle` |
| `.ts-superscript` | `.ts-inline-superscript` |
| `.ts-table` | `.ts-tables-table` |
| `.ts-table-caption` | `.ts-tables-caption` |
| `.ts-table-cell` | `.ts-tables-cell` |
| `.ts-table-cell-numeric` | `.ts-tables-cell-numeric` |
| `.ts-table-footer-cell` | `.ts-tables-footer-cell` |
| `.ts-table-header-cell` | `.ts-tables-header-cell` |
| `.ts-table-row` | `.ts-tables-row` |
| `.ts-table-zebra` | `.ts-tables-zebra` |
| `.ts-tie` | `.ts-utilities-tie` |
| `.ts-title-block` | `.ts-frontmatter-title-block` |
| `.ts-titleblock` | `.ts-frontmatter-title-block` |
| `.ts-toc` | `.ts-toc-entry` |
| `.ts-toc-2` | `.ts-toc-entry-2` |
| `.ts-util-break-after` | `.ts-utilities-break-after` |
| `.ts-util-break-before` | `.ts-utilities-break-before` |
| `.ts-util-color-adjust` | `.ts-utilities-color-adjust` |
| `.ts-util-keep-together` | `.ts-utilities-keep-together` |
| `.ts-util-no-hyphens` | `.ts-utilities-no-hyphens` |
| `.ts-util-print-only` | `.ts-utilities-print-only` |
| `.ts-util-tie` | `.ts-utilities-tie` |
| `.ts-verse` | `.ts-quotes-verse` |
