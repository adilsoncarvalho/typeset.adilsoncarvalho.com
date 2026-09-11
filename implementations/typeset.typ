// typeset — Typst implementation of https://typeset.adilsoncarvalho.com
//
// The normative source is spec.json. Every value below is taken from it. Where
// this file and the spec disagree, the spec is right.
//
// Usage:
//   #import "typeset.typ": (
//     typeset, letter-page, quotes-epigraph, quotes-pullquote,
//     callouts-callout, breaks-asterisks,
//   )
//   #show: typeset.with(justified: true, indented: true)

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

// Two columns: every step comes down. A 77mm column carries 40 characters at
// 11pt — below the 45-character floor — so the base drops to 9.5pt for 47.
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

#let oldstyle = (number-type: "old-style", number-width: "proportional")
#let lining = (number-type: "lining", number-width: "proportional")
#let tabular = (number-type: "lining", number-width: "tabular")
// @e
#let smcp = (features: ("smcp", "c2sc"))

// ── Document ────────────────────────────────────────────────────────────────

#let typeset(
  scale: scale-single-column,
  // Ragged right is the default. Justification buys a clean right edge at the
  // cost of uneven word spacing; choose it for continuous prose at a full
  // measure, and leave it off for a letter or a note addressed to a person.
  justified: false,
  indented: false,
  numbered: false,
  running-head: true,
  folio: true,
  // The measure, not the text width. The page leaves 160mm between its
  // margins; the spec sets the column at 126mm and keeps the remainder as
  // slack, which is where marginalia live. Pass `none` where the column IS
  // the measure, as in two columns.
  measure: 126mm,
  doc,
) = {
  let sm = scale.sm
  let xs = scale.xs
  let sp = scale.space
// @s page
  set page(
    paper: "a4",
    margin: (top: 25mm, bottom: 25mm, inside: 28mm, outside: 22mm),
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
    spacing: if indented { leading-for(scale.leading) } else { sp },
    justify: justified,
    first-line-indent: if indented { (amount: 1.5em, all: false) } else { 0pt },
// @e
    linebreaks: "optimized",
  )

  // Hyphenation is per-language and only ever paired with justification.
  set text(hyphenate: justified)

  // Widow and orphan control: never one line alone at a page edge.
  set block(breakable: true)

  if numbered {
    set heading(numbering: "1.1  ")
  }

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
  // constrained. The block is breakable, so pagination is unaffected.
  if measure == none { doc } else { block(width: measure, doc) }
}

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
#let two-column(
  front: none,
  column-rule: false,
  justified: true,
  numbered: false,
  running-head: true,
  folio: true,
  doc,
) = {
  // Justification is not optional at a 47-character measure.
  assert(justified, message: "two-column requires justification: at 47 characters a ragged edge serrates the column")

  show: typeset.with(
    scale: scale-two-column,
    measure: none,        // the column is the measure
    justified: true,
    indented: true,      // a blank line costs 3% of a column
    numbered: numbered,
    running-head: running-head,
    folio: folio,
  )

  if front != none {
    front
    v(scale-two-column.space, weak: true)
  }

  // A hairline where the columns need separating. Most journals omit it — the
  // gutter is already doing the work. `columns()` has no rule of its own, so it
  // is drawn on the page behind the text, at the centre of the gutter. The
  // offset flips with page parity because the margins mirror for duplex.
  if column-rule {
    set page(background: context {
      let inner = if calc.odd(here().page()) { 28mm } else { 22mm }
      place(
        top + left,
        dx: inner + 77mm + 3mm,
        dy: 25mm,
        line(angle: 90deg, length: 247mm, stroke: 0.5pt + rule-color),
      )
    })
  }

  columns(2, gutter: 6mm, doc)
}

// A level-1 heading spans both columns, which in Typst means it must be a
// parent-scoped float. That works in `front`, before the columns begin. A
// level-1 heading in the BODY has to be wrapped in `span()` explicitly —
// Typst cannot promote it out of the column flow on its own. In a paper the
// body's section headings are level 2 anyway; level 1 is the title.
//
// Spans both columns. A spanning element costs a break in both, so it is opt-in
// per instance and must sit at the top or the bottom of the page — never
// mid-column, which makes the reader find their place twice.
#let span(body, at-bottom: false) = place(
  if at-bottom { bottom } else { top },
  scope: "parent",
  float: true,
  block(width: 100%, body),
)
// @e

// ── Front matter ────────────────────────────────────────────────────────────

// @s frontmatter
#let frontmatter-title-block(title: none, subtitle: none, author: none, place-date: none) = context {
  let u = text.size
  block(
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
}
// @e

#let frontmatter-abstract(width: 30em, body) = context {
  let u = text.size
  block(below: u * 2, width: width, {
    set text(size: u * 0.91, fill: ink-muted)
    set par(justify: false, leading: leading-for(1.45), first-line-indent: 0pt)
    block(below: 0.3em, text(font: sans, size: u * 0.73, weight: 700, tracking: 0.1em, fill: ink-faint)[ABSTRACT])
    body
  })
}

#let frontmatter-colophon(body) = context {
  let u = text.size
  block(
    above: u * 3, width: 26em,
    inset: (top: u),
    stroke: (top: 0.5pt + rule-color),
    {
      set text(size: u * 0.86, style: "italic", fill: ink-muted)
      set par(justify: false, first-line-indent: 0pt)
      body
    },
  )
}

// ── Letter ──────────────────────────────────────────────────────────────────

// @s letter
#let letter-page(doc) = {
  set page(
    margin: (top: 32mm, bottom: 28mm, x: 25mm),
    header: none,
    footer: none,
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
#let toc-entry() = {
  show outline.entry: set text(font: sans, size: sm)
  outline(title: none, fill: repeat(gap: 0.4em)[.], indent: 1.5em)
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
