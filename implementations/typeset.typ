// typeset — Typst implementation of https://typeset.adilsoncarvalho.com
//
// The normative source is spec.json. Every value below is taken from it. Where
// this file and the spec disagree, the spec is right.
//
// Usage:
//   #import "typeset.typ": *
//   #show: typeset
//
// Every name this file defines is a name a document may need, so the import is
// a star import: a hand-picked list silently denies whichever name the next
// document reaches for, and the failure reads as "unknown variable" rather than
// as a missing import.
//
// typeset() takes the document's options — paper, margin, justified, indented,
// numbered, measure and the rest, declared below. A document that sets any of
// them writes `#show: typeset.with(...)` in place of the bare `#show: typeset`
// above, never underneath it: typeset() sets the page, and set page() is
// refused inside a container, which is what a second call would make of the
// first. So a document on another paper, at another margin, opens with
// `#show: typeset.with(paper: "a5", margin: margin-narrow)` and nothing else.

// ── Foundation ──────────────────────────────────────────────────────────────

// @s tokens
#let ink = rgb("#1a1a1a")
#let ink-muted = rgb("#5a5a5a")
#let ink-faint = rgb("#8a8a8a")
#let rule-color = rgb("#c9c4bd")
#let rule-strong = rgb("#6f6a64")
#let wash = rgb("#f4f1ec")
#let accent = rgb("#7a1f1f")

#let serif = "EB Garamond"
#let sans = "Source Sans 3"
#let mono = "IBM Plex Mono"

// A template supplies one of these. Every size in the document comes from it,
// so nothing downstream has to know which template is in force.
#let scale-single-column = (
  xs: 8pt, sm: 9.5pt, base: 11pt,
  h4: 12pt, h3: 14pt, h2: 18pt, h1: 24pt,
  leading: 1.45, space: 11pt,
)

// Two columns: every step comes down. On A4 at the standard margin an 82mm
// column carries 42 characters at 11pt — below the 45-character floor — so the
// base drops to 9.5pt, which gives 49.
#let scale-two-column = (
  xs: 7pt, sm: 8.5pt, base: 9.5pt,
  h4: 9.5pt, h3: 11pt, h2: 13pt, h1: 20pt,
  leading: 1.4, space: 9.5pt,
)

// Defaults, for the standalone helpers below.
#let base-size = scale-single-column.base
#let sm = scale-single-column.sm
#let xs = scale-single-column.xs

// One unit of vertical space: 11pt, one line of base leading.
#let sp = 11pt

// The spec states line height as a baseline-to-baseline advance. Typst measures
// leading between line boxes, so pinning the box to the band from the baseline
// up to 1em makes the advance font-independent:
//   advance = top-edge - bottom-edge + leading = 1em + leading
// so leading = (line_height - 1) em. 1.45 → 0.45em → 15.95pt at 11pt.
#let leading-for(line-height) = (line-height - 1) * 1em

// Paragraph separation is one decision expressed as two par properties, never
// both at once: a gap (spaced) or an indent (indented). `typeset()`'s own
// `indented` option and the two standalone functions below (block-spaced,
// block-indented) both read this, so the whole-document switch and the
// per-block override can never drift apart into two different 1.5em's.
// `leading` defaults to the single-column scale's own 1.45 for the two
// standalone functions, which have no `scale` to read; typeset() passes its
// own scale's leading, so a document on the two-column scale still gets
// indented spacing equal to ITS leading, not the single-column one's.
#let _paragraphs-rule(indented, leading: 1.45) = if indented {
  (spacing: leading-for(leading), first-line-indent: (amount: 1.5em, all: false))
} else {
  (spacing: sp, first-line-indent: 0pt)
}

#let oldstyle = (number-type: "old-style", number-width: "proportional")
#let lining = (number-type: "lining", number-width: "proportional")
#let tabular = (number-type: "lining", number-width: "tabular")
// @e
#let smcp = (features: ("smcp", "c2sc"))

// ── Page ────────────────────────────────────────────────────────────────────

// Paper and margin are independent choices. A margin is millimetres, and the
// same millimetres on every paper, so
//   #show: typeset.with(paper: "a5", margin: margin-narrow)
// asks for both without either one knowing about the other.
//
// Symmetric is what a document gets unless it asks otherwise: the named size
// on all four sides. Duplex is the opt-in for a sheet that will be bound — top
// and bottom keep the symmetric value, and the sides split into an inner
// (binding) edge and an outer one, which Typst mirrors by page parity. Each
// duplex pair sums to twice its symmetric value, so a document keeps the same
// text width, and the same line breaks, whichever of the two it chooses.
//
// The prefix names the family, matching typeset.css's `typeset--margin-narrow`.
// `narrow` and `wide` also name measure variants, which are a different axis:
// one word must not reach both.
#let margin-narrow = (top: 10mm, bottom: 10mm, left: 10mm, right: 10mm)
#let margin-standard = (top: 20mm, bottom: 20mm, left: 20mm, right: 20mm)
#let margin-wide = (top: 30mm, bottom: 30mm, left: 30mm, right: 30mm)

#let margin-duplex-narrow = (top: 10mm, bottom: 10mm, inside: 13mm, outside: 7mm)
#let margin-duplex-standard = (top: 20mm, bottom: 20mm, inside: 23mm, outside: 17mm)
#let margin-duplex-wide = (top: 30mm, bottom: 30mm, inside: 33mm, outside: 27mm)

// The numbers stay reachable behind the names: `margin` takes any length or
// any Typst margin dictionary, so `margin: 18mm` is there for a printer who
// needs a measurement rather than a name.

// Every paper this spec is set for, width before height, under the name Typst
// knows it by — "us-letter" is the spec's Letter. The two-column derivation is
// arithmetic on this table, so a paper reaches that arithmetic by being added
// here.
#let paper-sizes-mm = (
  "a4": (210mm, 297mm),
  "a5": (148mm, 210mm),
  "us-letter": (215.9mm, 279.4mm),
)

// The measure — one column's ideal line length. Three named widths, matching
// typeset.css's own three measure classes: standard is the default, narrow
// and wide are the modifiers a document opts into. All three are em, the
// axis spec.json states them in and typeset.css already uses; an em measure
// follows a scale change, where an mm one would not.
#let measure-standard = 33em
#let measure-narrow = 27em
#let measure-wide = 40em

// The fourth width, and the only one with no spec.json literal behind it:
// the full text block, derived from the default paper and margin above
// rather than typed. A4 at the standard margin leaves 170mm between the
// margins.
#let measure-full = paper-sizes-mm.at("a4").at(0) - 2 * margin-standard.left

// A document reaches for one of the four names instead of a literal width:
// `#measured[...]` for the default column, `#measured(width:
// measure-wide)[...]` for a modifier, `#measured(width: measure-full)[...]`
// for the full text block.
#let measured(width: measure-standard, body) = block(width: width, body)

// ── Document ────────────────────────────────────────────────────────────────

#let typeset(
  // The paper by its Typst name, and the margin by one of the six names above
  // — or by any length, for a page box the spec does not name.
  paper: "a4",
  margin: margin-standard,
  scale: scale-single-column,
  // Ragged right is the default. Justification buys a clean right edge at the
  // cost of uneven word spacing; choose it for continuous prose at a full
  // measure, and leave it off for a letter or a note addressed to a person.
  justified: false,
  indented: false,
  numbered: false,
  running-head: true,
  folio: true,
  // The measure, not the text width. A4 at the standard margin leaves
  // measure-full (170mm) between its margins; measure-standard is smaller
  // and keeps the remainder as slack, which is where marginalia live. It is
  // a maximum, so a page with less than measure-standard between its
  // margins keeps its margins. Pass `none` where the column IS the measure,
  // as in two columns.
  measure: measure-standard,
  doc,
) = {
  let sm = scale.sm
  let xs = scale.xs
  let sp = scale.space
// @s page
  set page(
    paper: paper,
    margin: margin,
    header: context {
      // The running head follows the current level-2 heading, and is
      // suppressed on the opening page.
      if running-head and here().page() > 1 {
        let seen = query(selector(heading.where(level: 2)).before(here()))
        if seen.len() > 0 {
          set text(font: sans, size: xs, fill: ink-faint, tracking: 0.08em)
          align(center, upper(seen.last().body))
        }
      }
    },
    footer: context {
      if folio and here().page() > 1 {
        set text(font: serif, size: 9pt, fill: ink-muted, ..oldstyle)
        align(center, counter(page).display())
      }
    },
// @e
  )

// @s foundation
  set text(
    font: serif,
    size: scale.base,
    fill: ink,
    top-edge: 1em,
    bottom-edge: 0pt,
    ..oldstyle,
  )

  set par(
    leading: leading-for(scale.leading),
    .._paragraphs-rule(indented, leading: scale.leading),
    justify: justified,
// @e
    linebreaks: "optimized",
  )

  // Hyphenation is per-language and only ever paired with justification.
  set text(hyphenate: justified)

  // Widow and orphan control: never one line alone at a page edge.
  set block(breakable: true)

  set heading(numbering: if numbered { "1.1  " } else { none })

  // ── Headings ──────────────────────────────────────────────────────────────
  // Space above is four times the space below; a heading belongs to what
  // follows it. `sticky` is Typst's break-after: avoid.

// @s headings
  show heading: set text(font: sans, hyphenate: false)
  show heading: set par(justify: false, first-line-indent: 0pt)
  show heading: it => block(
    above: sp * 2,
    below: sp * 0.5,
    sticky: true,
    breakable: false,
    it,
  )

  show heading.where(level: 1): set text(size: scale.h1, weight: 300, tracking: -0.015em)
  show heading.where(level: 1): it => block(above: 0pt, below: sp * 0.5, sticky: true, it)
  show heading.where(level: 2): set text(size: scale.h2, weight: 600, tracking: -0.01em)
  show heading.where(level: 3): set text(size: scale.h3, weight: 600)
  show heading.where(level: 4): set text(size: scale.h4, weight: 600)
  show heading.where(level: 5): set text(
    font: serif, size: scale.base, weight: 600, tracking: 0.06em, ..smcp,
  )
  show heading.where(level: 6): set text(
// @e
    font: serif, size: scale.base, weight: 400, style: "italic",
  )

  // ── Quotations ────────────────────────────────────────────────────────────

// @s quotes
  show quote.where(block: true): it => block(
    above: sp * 1.25,
    below: sp * 1.25,
    inset: (left: sp * 1.5),
    stroke: (left: 1pt + rule-color),
    breakable: false,
    {
      set text(size: 0.955em)
      it.body
      if it.attribution != none {
        set text(size: sm, fill: ink-muted, style: "normal")
        set par(first-line-indent: 0pt, justify: false)
        block(above: sp * 0.5, [— #it.attribution])
      }
    },
  )

// @e
  // ── Lists ─────────────────────────────────────────────────────────────────

// @s lists
  set list(marker: ([#text(fill: ink-muted, weight: 700)[·]], [#text(fill: ink-muted)[–]]), indent: 0pt, body-indent: 1.4em, spacing: sp * 0.25)
  set enum(numbering: "1.", indent: 0pt, body-indent: 1.4em, spacing: sp * 0.25, number-align: left)
  show enum: set text(..tabular)

  set terms(separator: linebreak(), indent: 0pt, hanging-indent: sp * 1.5, spacing: sp * 0.6)
  show terms: set par(first-line-indent: 0pt)
  show terms.item: it => block(above: sp * 0.6, below: 0pt, {
    block(below: 0pt, text(font: sans, size: sm, weight: 600, it.term))
    block(inset: (left: sp * 1.5), it.description)
  })

// @e
  // ── Tables ────────────────────────────────────────────────────────────────
  // Rules, not grids: a rule above the header, below the header, below the body.

// @s tables
  set table(
    stroke: (x, y) => (bottom: if y == 0 { 1pt + rule-strong } else { 0.5pt + rule-color }),
    inset: (left: 0pt, right: 0.7em, top: 0.45em, bottom: 0.45em),
    align: left + horizon,
  )
  show table: set text(font: sans, size: sm, ..tabular)
  show table: set par(justify: false, leading: leading-for(1.35), first-line-indent: 0pt)
  show table.cell.where(y: 0): set text(size: xs, weight: 600, fill: ink-muted, tracking: 0.07em)
  show table.cell.where(y: 0): upper

// @e
  // ── Figures & captions ────────────────────────────────────────────────────

// @s figures
  show figure: set block(above: sp * 1.5, below: sp * 1.5, breakable: false)
  show figure.caption: it => block(
    width: 100%,
    inset: (top: 0.4em),
    stroke: (top: 0.5pt + rule-color),
    {
      set text(font: sans, size: sm, fill: ink-muted)
      set par(justify: false, leading: leading-for(1.4), first-line-indent: 0pt)
      align(left, [#text(fill: ink, weight: 600, tracking: 0.06em, ..smcp)[#it.supplement #context it.counter.display()] — #it.body])
    },
  )

// @e
  // ── Code ──────────────────────────────────────────────────────────────────

// @s codeblock
  show raw: set text(font: mono, size: 0.86em, features: (liga: 0))
  show raw.where(block: false): box.with(fill: wash, inset: (x: 0.28em), outset: (y: 0.1em), radius: 2pt)
  show raw.where(block: true): it => block(
    width: 100%,
    fill: wash,
    stroke: (left: 2pt + rule-strong),
    inset: (x: 1em, y: 0.8em),
    above: sp * 1.25,
    below: sp * 1.25,
    breakable: true,
    { set text(size: 0.773em); set par(leading: leading-for(1.45), justify: false); it },
  )

// @e
  // ── Inline ────────────────────────────────────────────────────────────────

// @s inline
  show strong: set text(weight: 600)
  show link: it => underline(offset: 0.14em, stroke: 0.5pt, it)
  show footnote: set text(fill: accent, size: 0.7em, ..lining)
  set footnote.entry(separator: line(length: 30%, stroke: 0.5pt + rule-color))
  show footnote.entry: set text(size: sm)

// @e

  // Running heads and folios still span the full text width; only the flow is
  // constrained. The block is breakable, so pagination is unaffected. The width
  // is taken against the page actually in force rather than against A4, and the
  // measure is resolved to absolute units first, because it is as often given
  // in ems as in millimetres.
  if measure == none { doc } else {
    layout(size => context {
      block(width: calc.min(measure.to-absolute(), size.width), doc)
    })
  }
}

// ── Inline: key ─────────────────────────────────────────────────────────────

// A keycap's visual signature is its bottom edge, heavier than the other
// three — 1.5pt against 0.5pt, both in rule-color. `stroke`'s dictionary
// form is what lets one edge carry a different weight than its neighbours;
// a single `<length> + <color>` stroke draws all four edges alike.
#let key(body) = box(
  inset: (x: 0.35em, y: 0.15em),
  radius: 2pt,
  stroke: (rest: 0.5pt + rule-color, bottom: 1.5pt + rule-color),
  text(font: sans, size: 0.85em, body),
)

// ── Paragraphs ──────────────────────────────────────────────────────────────

// `typeset()`'s own `indented` option applies one of these two to the whole
// document. These exist for the one block that needs the OTHER convention —
// the same reason `justified`/`ragged-right` exist for alignment. Spaced is
// the document default and so needs no wrapper of its own for that reason,
// but it still gets one: the way back, for one block, in a document set to
// indented.
//
// Named for what they do to the reader's block, not for the spec's own
// paragraphs-spaced/paragraphs-indented element ids: an author reaching for
// one of these is asking "how does this block behave", never "which section
// of the specification is this" — and a name tied to the element id would
// also have to change the day that id does.
//
// `first-line-indent`'s `all: false` is what makes indented prose behave:
// Typst withholds the indent from a paragraph that opens the document, and
// from one right after a heading, a blockquote, a figure or a break, because
// each of those is itself a block and a block resets the same state a
// document start does. A `block()` wrapper here would do that AGAIN to the
// first paragraph *inside* this function — flushing a paragraph that is not
// actually after a heading, a bug this file's own conformance gate compiles
// a probe to catch. So `body` below is scoped by a plain code block, which
// carries no layout identity of its own, never by `block()`.
// @s paragraphs
#let block-spaced(body) = {
  set par(.._paragraphs-rule(false))
  body
}

#let block-indented(body) = {
  set par(.._paragraphs-rule(true))
  body
}
// @e

// ── Alignment ───────────────────────────────────────────────────────────────

// Ragged right is `typeset()`'s own document-wide default (its `justified`
// option). These two exist for the one paragraph, list item, blockquote or
// callout that needs the OTHER convention, so an author reaches for a name
// instead of `#set par(justify: ..)` and `#set text(hyphenate: ..)` by hand —
// the same reason block-spaced/block-indented exist for paragraph spacing.
//
// Justification and hyphenation are a single decision, never two: hyphenate
// is never a parameter here, only `lang`, because hyphenation is per-language
// and requires the document language to be declared. `justified(lang: none)`
// is how a document states that no dictionary is declared for this block —
// honestly, not as a footgun to avoid, since that combination (justified,
// unhyphenated) is exactly what opens rivers of white space down the page.
// `ragged-right` takes the same `lang` parameter for the language-sensitive
// typesetting `hyphenate` is not (quotation marks, spacing rules) — but never
// hyphenates, `lang` or not: a hyphen exists to serve justification, and
// breaks a word for no gain without it.
//
// `set align(left)` is not restating the ambient default. Alignment inherits,
// and Typst resolves a justified paragraph's last line against that same
// inherited alignment — so a block nested inside a centred or right-aligned
// context that only set `justify` would flush its last line, or its only
// line for a one-liner, to whatever alignment surrounds it, correct only
// where that happens to already be left. Stating `align(left)` here is what
// makes both functions' own alignment, and their own last-line alignment,
// hold regardless of where they are nested — never true "by inheritance"
// alone.
//
// Typst's `text()` exposes only `hyphenate: bool`, with no per-language
// tuning surface — no parameter takes justification-justified's own
// hyphenation_min_word_chars (6), hyphenation_min_chars_before_break (3),
// hyphenation_min_chars_after_break (3) or max_consecutive_hyphens (2).
// typeset.css enforces those same four numbers with `hyphenate-limit-chars`
// and `hyphenate-limit-lines`; there is no Typst engine feature this file can
// set in their place.
// @s justification
#let ragged-right(indented: false, lang: "en", body) = {
  set align(left)
  set par(.._paragraphs-rule(indented), justify: false)
  if lang != none { set text(lang: lang) }
  set text(hyphenate: false)
  body
}

#let justified(indented: false, lang: "en", body) = {
  set align(left)
  set par(.._paragraphs-rule(indented), justify: true)
  if lang != none { set text(lang: lang) }
  set text(hyphenate: lang != none)
  body
}
// @e

// ── Blocks the spec names but no engine provides ────────────────────────────

#let quotes-epigraph(attribution: none, body) = context {
  let u = text.size
  block(above: 0pt, below: u * 2, width: 24em, {
    set align(left)
    set text(size: u * 0.91, style: "italic", fill: ink-muted)
    set par(justify: false, first-line-indent: 0pt)
    body
    if attribution != none {
      block(above: u * 0.5, text(style: "normal", size: u * 0.86)[— #attribution])
    }
  })
}
#let epigraph-right(attribution: none, body) = align(right, quotes-epigraph(attribution: attribution, body))

#let quotes-pullquote(body) = context {
  let u = text.size
  block(
    above: u * 1.5, below: u * 1.5, width: 100%,
    inset: (y: u),
    stroke: (top: 1.5pt + rule-strong, bottom: 0.5pt + rule-color),
    {
      set text(font: sans, size: u * 1.36, weight: 300)
      set par(leading: leading-for(1.3), justify: false, first-line-indent: 0pt)
      align(center, body)
    },
  )
}

#let quotes-verse(body) = block(
  above: sp * 1.25, below: sp * 1.25,
  inset: (left: sp * 2),
  {
    set par(justify: false, first-line-indent: 0pt, hanging-indent: 1.5em)
    body
  },
)

// @s callouts
#let callouts-callout(title: none, warning: false, body) = context {
  let u = text.size
  block(
  above: u * 1.25, below: u * 1.25, width: 100%,
  fill: wash,
  stroke: (
    rest: 0.5pt + rule-color,
    left: 2.5pt + (if warning { accent } else { rule-strong }),
  ),
  inset: (x: 1em, y: 0.75em),
  breakable: false,
  {
    set text(size: u * 0.91)
    if title != none {
      block(below: 0.35em, text(
        font: sans, size: u * 0.73, weight: 700, tracking: 0.09em,
        fill: if warning { accent } else { ink-muted },
        upper(title),
      ))
    }
    body
  },
  )
}
// @e

// Section breaks. A blank line cannot survive a page break, so the mark is
// always visible. The spec names four registers, so there are four symbols
// here — a caller should not have to know a string literal to pick one.
// @s breaks
#let _break-mark(mark, size: 10pt, tracking: 0em, color: ink-faint) = block(
  above: sp * 1.5, below: sp * 1.5, sticky: true, width: 100%,
  align(center, box(text(size: size, fill: color, tracking: tracking, mark))),
)

#let breaks-asterisks() = _break-mark([\* \* \*], tracking: 0.6em)
#let breaks-asterism() = _break-mark([⁂], size: 14pt)
#let breaks-fleuron() = _break-mark([❦], size: 12pt, color: accent)
#let breaks-rule() = block(above: sp * 1.5, below: sp * 1.5, sticky: true, width: 100%,
  align(center, line(length: 100%, stroke: 0.5pt + rule-color)))
// @e

// Drop cap. Typst has no float, so the spec's three-line wrap is NOT
// expressible here: text cannot flow around a raised initial. Two honest
// options, and one trap:
//   * `dropcap` below sets the initial in the margin — a marginal initial. The
//     measure stays intact and the opening still gets its signal.
//   * The `droplet` package implements a true wrap by measuring lines. Use it
//     where the three-line wrap is required rather than approximated.
//   * Do NOT put the cap and the paragraph in a two-column grid: that narrows
//     the entire opening paragraph, not just its first three lines.
// @s dropcap
#let dropcap(body) = {
  let letters = body.text
  let initial = letters.first()
  let rest = letters.slice(1)
  block(above: 0pt, {
    place(
      left,
      dx: -1.35em,
      dy: -0.08em,
      text(size: 3.05em, fill: accent, top-edge: "cap-height", bottom-edge: "baseline")[#initial],
    )
    par(first-line-indent: 0pt)[#rest]
  })
}
// @e

// A table that fills the measure and closes with a strong rule. Typst's stroke
// function cannot see the row count, so it is passed in.
#let ts-table(columns: none, rows: none, ..cells) = {
  table(
    columns: columns,
    stroke: (x, y) => (bottom: if y == 0 or y == rows { 1pt + rule-strong } else { 0.5pt + rule-color }),
    ..cells,
  )
}

// @s two-column
// Two columns, equal. Papers, journal articles, newsletters, technical notes.
//
// `front` is set full width before the columns begin — a title block, an
// abstract, a level-1 heading. Everything in `doc` flows in two columns.
//
// Typst's own `page(columns: 2)` fixes the gutter at 4% of the page width
// (8.4mm on A4). The spec says 6mm, so the body goes through `columns()`
// instead, which takes an explicit gutter and still breaks across pages.

// Whether the content being laid out right now is the two-column body (inside
// `columns()`), as opposed to `front` or a single-column template — read by
// frontmatter-title-block, frontmatter-abstract and frontmatter-colophon to
// decide whether they need to promote themselves.
#let ts-two-column-body = state("ts-two-column-body", false)

// Promotes body content to a parent-scoped float spanning both columns. A
// spanning element costs a break in both, so it is opt-in per instance for
// spanning.optional content (figure, table, code block, pull quote) and must
// sit at the top or the bottom of the page — never mid-column, which makes
// the reader find their place twice.
#let span(body, at-bottom: false) = place(
  if at-bottom { bottom } else { top },
  scope: "parent",
  float: true,
  block(width: 100%, body),
)

#let two-column(
  paper: "a4",
  margin: margin-standard,
  front: none,
  column-rule: false,
  justified: true,
  numbered: false,
  running-head: true,
  folio: true,
  doc,
) = {
  // The gutter is the one number this template chooses. The column, the
  // character count and the decision to set at all are functions of the paper
  // and the margin, recomputed here rather than carried as a list of papers
  // that work.
  let gutter = 6mm
  let floor = 45
  let base = scale-two-column.base

  // The foundation measure is 66 characters in 128mm at 11pt. Characters in a
  // column follow from it, by the column's width and by the base in use.
  let chars-in = width => int(calc.round(66 / 128 * (width / 1mm) * (11pt / base)))
  let mm-of = value => {
    let n = calc.round(value / 1mm, digits: 2)
    if n == calc.round(n) { str(int(n)) } else { str(n) }
  }

  let size = paper-sizes-mm.at(lower(paper), default: none)
  if size == none {
    panic("two columns are derived from the paper's width, and \"" + paper
      + "\" is not a paper this spec is set for: "
      + paper-sizes-mm.keys().join(", "))
  }

  // The margin arrives as one of the six names, as a length, or as any Typst
  // margin dictionary. The column needs the two horizontal sides; the optional
  // rule needs all four.
  let sides = if type(margin) == dictionary {
    let rest = margin.at("rest", default: none)
    let x = margin.at("x", default: rest)
    let y = margin.at("y", default: rest)
    (
      top: margin.at("top", default: y),
      bottom: margin.at("bottom", default: y),
      inner: margin.at("inside", default: margin.at("left", default: x)),
      outer: margin.at("outside", default: margin.at("right", default: x)),
    )
  } else {
    (top: margin, bottom: margin, inner: margin, outer: margin)
  }
  for (side, value) in sides {
    if type(value) != length {
      panic("two columns are derived from the margin in millimetres, and `margin` gives "
        + side + " as " + repr(value))
    }
  }

  let text-width = size.at(0) - sides.inner - sides.outer
  let column = (text-width - gutter) / 2
  let chars = chars-in(column)

  // Refused, not set badly. A column below the floor is a measure this spec
  // does not allow, and the numbers that produced it belong in the message:
  // the paper, the margin, the column, the count, the floor.
  if chars < floor {
    let named = (
      ("narrow", margin-narrow),
      ("standard", margin-standard),
      ("wide", margin-wide),
      ("duplex-narrow", margin-duplex-narrow),
      ("duplex-standard", margin-duplex-standard),
      ("duplex-wide", margin-duplex-wide),
    )
    let this-margin = "a " + mm-of(sides.inner) + "mm and " + mm-of(sides.outer) + "mm margin"
    for (name, value) in named {
      if margin == value { this-margin = "the " + name + " margin" }
    }
    // Which margins do reach the floor on this paper. A duplex pair has its
    // symmetric pair's total, so it reaches exactly where that one does.
    let reaching = ()
    for (name, value) in (("narrow", margin-narrow), ("standard", margin-standard), ("wide", margin-wide)) {
      if chars-in((size.at(0) - value.left - value.right - gutter) / 2) >= floor {
        reaching.push(name)
      }
    }
    let alternatives = if reaching.len() > 0 {
      reaching.join(" and ") + " reach it on this paper"
    } else {
      "no named margin reaches it — " + upper(paper) + " cannot carry two columns at " + repr(base)
    }
    panic("two columns are refused on " + upper(paper) + " at " + this-margin + " — "
      + mm-of(size.at(0)) + "mm of paper less " + mm-of(sides.inner) + "mm and "
      + mm-of(sides.outer) + "mm leaves " + mm-of(text-width) + "mm of text, so a column is ("
      + mm-of(text-width) + " - " + mm-of(gutter) + ") / 2 = " + mm-of(column)
      + "mm, carrying " + str(chars) + " characters at " + repr(base) + ", below the "
      + str(floor) + "-character floor; " + alternatives)
  }

  // Justification is not optional at a column measure.
  assert(justified, message: "two-column requires justification: at " + str(chars)
    + " characters a ragged edge serrates the column")

  show: typeset.with(
    paper: paper,
    margin: margin,
    scale: scale-two-column,
    measure: none,        // the column is the measure
    justified: true,
    indented: true,      // a blank line costs 3% of a column
    numbered: numbered,
    running-head: running-head,
    folio: folio,
  )

  // A hairline where the columns need separating. Most journals omit it — the
  // gutter is already doing the work. `columns()` has no rule of its own, so it
  // is drawn on the page behind the text, at the centre of the gutter. The
  // offset flips with page parity because a duplex margin puts the inner edge
  // on the left of an odd page and on the right of an even one.
  //
  // The set rule is unconditional, with the condition inside its argument, and
  // it comes before any content: a set rule inside an `if` block applies only
  // within that block, which holds no content, and a page set rule that follows
  // content starts a new page.
  set page(background: if column-rule {
    context {
      let left-margin = if calc.odd(here().page()) { sides.inner } else { sides.outer }
      place(
        top + left,
        dx: left-margin + column + gutter / 2,
        dy: sides.top,
        line(
          angle: 90deg,
          length: size.at(1) - sides.top - sides.bottom,
          stroke: 0.5pt + rule-color,
        ),
      )
    }
  })

  if front != none {
    front
    v(scale-two-column.space, weak: true)
  }

  // templates.two-column.spanning.always spans without a mark from here on:
  // frontmatter-title-block, frontmatter-abstract and frontmatter-colophon
  // read ts-two-column-body themselves (it carries subtitle, byline and
  // dateline too — they are that block's own parameters, not standalone
  // functions), and a body-level level-1 heading is promoted by the show rule
  // below. Both are scoped to `doc`; `front` above renders before the columns
  // begin, so it is already full width and never needs the wrap.
  ts-two-column-body.update(true)
  show heading.where(level: 1): it => span(it)
  columns(2, gutter: gutter, doc)
}
// @e

// ── Front matter ────────────────────────────────────────────────────────────

// @s frontmatter
#let frontmatter-title-block(title: none, subtitle: none, author: none, place-date: none) = context {
  let u = text.size
  let content = block(
    below: u * 3, width: 100%,
    inset: (bottom: u),
    stroke: (bottom: 0.5pt + rule-color),
    {
      set par(justify: false, first-line-indent: 0pt)
      if title != none { heading(level: 1, outlined: false, title) }
      if subtitle != none {
        block(below: u, text(font: sans, size: u * 1.27, weight: 300, fill: ink-muted, subtitle))
      }
      if author != none { text(tracking: 0.08em, ..smcp, author) }
      if place-date != none {
        block(above: 0.2em, text(font: sans, size: u * 0.86, fill: ink-muted, place-date))
      }
    },
  )
  if ts-two-column-body.get() { span(content) } else { content }
}
// @e

#let frontmatter-abstract(width: 30em, body) = context {
  let u = text.size
  let content = block(below: u * 2, width: width, {
    set text(size: u * 0.91, fill: ink-muted)
    set par(justify: false, leading: leading-for(1.45), first-line-indent: 0pt)
    block(below: 0.3em, text(font: sans, size: u * 0.73, weight: 700, tracking: 0.1em, fill: ink-faint)[ABSTRACT])
    body
  })
  if ts-two-column-body.get() { span(content) } else { content }
}

#let frontmatter-colophon(body) = context {
  let u = text.size
  let content = block(
    above: u * 3, width: 26em,
    inset: (top: u),
    stroke: (top: 0.5pt + rule-color),
    {
      set text(size: u * 0.86, style: "italic", fill: ink-muted)
      set par(justify: false, first-line-indent: 0pt)
      body
    },
  )
  if ts-two-column-body.get() { span(content, at-bottom: true) } else { content }
}

// ── Bibliography ────────────────────────────────────────────────────────────

// @s bibliography
// `references()` owns the block: the entries' size, leading, spacing and
// hanging indent, and the heading — a real level-2 heading, so it takes the
// document's own running-head and numbering behaviour, and spans both
// columns the way frontmatter-title-block and frontmatter-colophon do,
// because bibliography-heading (unlike headings-h2 itself) is on
// templates.two-column.spanning.always. `reference()` composes one entry —
// author roman, title italic, the rest in order — so the punctuation between
// them is this file's business, not the document's.
#let references(title: [References], body) = context {
  let heading-content = heading(level: 2, title)
  if ts-two-column-body.get() { span(heading-content) } else { heading-content }
  {
    set text(size: sm)
    set par(
      justify: false,
      leading: leading-for(1.4),
      first-line-indent: 0pt,
      hanging-indent: 1.8em,
    )
    body
  }
}

// One entry, `break_inside: avoid` — a citation split across a page break
// loses the one thing a hanging indent is for, the surname at a glance — and
// `space_after: 0.55em` between entries, both bibliography-entry's own.
#let reference(
  author: none, title: none, edition: none,
  publisher: none, year: none, note: none,
) = block(breakable: false, below: 0.55em, {
  if author != none [#author. ]
  if title != none [#emph(title). ]
  if edition != none [#edition. ]
  if publisher != none [#publisher]
  if publisher != none and year != none [, ]
  if year != none [#year.]
  if note != none [ #note]
})
// @e

// ── Letter ──────────────────────────────────────────────────────────────────

// @s letter
// A letter's page, and the letter's document setup: a deeper top margin than
// foot or sides, so the sender block sits where an envelope window expects it,
// and no running head or folio. A letter opens with this in place of
// `#show: typeset` — the two cannot be stacked, because typeset() sets the page
// and a page configuration underneath it sits inside a container, where Typst
// refuses one.
#let letter-page(
  paper: "a4",
  margin: (top: 32mm, bottom: 28mm, left: 25mm, right: 25mm),
  doc,
) = {
  show: typeset.with(
    paper: paper,
    margin: margin,
    running-head: false,
    folio: false,
  )
  doc
}
// @e

// The sender block is address data, not a masthead: one style throughout, at
// body size, in the reading face. Nothing bold, nothing in the sans.
#let letter-sender(body) = context {
  let u = text.size
  block(below: u * 2.5, {
    set par(justify: false, leading: leading-for(1.35), first-line-indent: 0pt)
    body
  })
}

// A line under the date — a dedication, a feast, a devotion. It belongs to the
// date, so it takes no gap of its own.
#let letter-date-note(body) = context {
  let u = text.size
  block(above: 0.1em, below: u * 1.5, {
    set par(justify: false, first-line-indent: 0pt)
    text(style: "italic", body)
  })
}

#let letter-address-block(label: none, body) = block(below: sp * 1.5, {
  set par(justify: false, leading: leading-for(1.35), first-line-indent: 0pt)
  if label != none {
    block(below: 0.25em, text(font: sans, size: xs, tracking: 0.1em, fill: ink-faint, upper(label)))
  }
  body
})

// The typed name, with room above it to sign. No rule: a ruled line is a form
// to be filled in, and this is a letter.
#let letter-signature(name) = context {
  let u = text.size
  block(above: u * 3, breakable: false, {
    set par(justify: false, first-line-indent: 0pt)
    name
  })
}

// "Enc." introduces a sentence; it does not head a section.
#let letter-enclosures(body) = context {
  let u = text.size
  block(above: u * 2, {
    set par(justify: false, first-line-indent: 0pt)
    [Enc. ]
    body
  })
}

// A postscript is a sentence that happens to begin with "P.S." — the label is
// not a heading, so it matches the text it introduces exactly.
#let letter-postscript(body) = context {
  let u = text.size
  block(above: u, {
    set par(justify: false, first-line-indent: 0pt)
    [P.S. ]
    body
  })
}

// ── Apparatus ───────────────────────────────────────────────────────────────

// @s toc
#let toc() = {
  show outline.entry: set text(font: sans, size: sm)
  set outline.entry(fill: repeat(gap: 0.4em)[.])
  outline(title: none, indent: 1.5em)
}
// @e

// @s notes
// Anchored past the text column's right edge. In Typst the column width is
// explicit (the `measure` argument), so the offset is taken from it directly.
#let notes-sidenote(body) = place(
  right,
  dx: 13em,
  dy: -0.3em,
  block(width: 11em, {
    set text(font: sans, size: xs, fill: ink-muted)
    set par(justify: false, leading: leading-for(1.4), first-line-indent: 0pt)
    body
  }),
)
// @e

// ── Utilities ───────────────────────────────────────────────────────────────

// @s utilities
#let utilities-keep-together(body) = block(breakable: false, body)
#let utilities-tie(body) = box(body)
// @e
