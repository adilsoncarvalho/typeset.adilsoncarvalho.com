// typeset — Typst implementation of https://typeset.adilsoncarvalho.com
//
// The normative source is spec.json. Every value below is taken from it. Where
// this file and the spec disagree, the spec is right.
//
// Usage:
//   #import "typeset.typ": typeset, letter, epigraph, pullquote, callout, break-scene
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

#let base-size = 11pt
#let sm = 9.5pt
#let xs = 8pt

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
  justified: false,
  indented: false,
  numbered: false,
  running-head: true,
  folio: true,
  measure: 33em,
  doc,
) = {
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
    size: base-size,
    fill: ink,
    top-edge: 1em,
    bottom-edge: 0pt,
    ..oldstyle,
  )

  set par(
    leading: leading-for(1.45),
    spacing: if indented { leading-for(1.45) } else { sp },
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

  show heading.where(level: 1): set text(size: 24pt, weight: 300, tracking: -0.015em)
  show heading.where(level: 1): it => block(above: 0pt, below: sp * 0.5, sticky: true, it)
  show heading.where(level: 2): set text(size: 18pt, weight: 600, tracking: -0.01em)
  show heading.where(level: 3): set text(size: 14pt, weight: 600)
  show heading.where(level: 4): set text(size: 12pt, weight: 600)
  show heading.where(level: 5): set text(
    font: serif, size: base-size, weight: 600, tracking: 0.06em, ..smcp,
  )
  show heading.where(level: 6): set text(
// @e
    font: serif, size: base-size, weight: 400, style: "italic",
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
      set text(size: 10.5pt)
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
    { set text(size: 8.5pt); set par(leading: leading-for(1.45), justify: false); it },
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
  doc
}

// ── Blocks the spec names but no engine provides ────────────────────────────

#let epigraph(attribution: none, body) = block(
  above: 0pt, below: sp * 2, width: 24em,
  {
    set align(left)
    set text(size: 10pt, style: "italic", fill: ink-muted)
    set par(justify: false, first-line-indent: 0pt)
    body
    if attribution != none {
      block(above: sp * 0.5, text(style: "normal", size: sm)[— #attribution])
    }
  },
)
#let epigraph-right(attribution: none, body) = align(right, epigraph(attribution: attribution, body))

#let pullquote(body) = block(
  above: sp * 1.5, below: sp * 1.5, width: 100%,
  inset: (y: sp),
  stroke: (top: 1.5pt + rule-strong, bottom: 0.5pt + rule-color),
  {
    set text(font: sans, size: 15pt, weight: 300)
    set par(leading: leading-for(1.3), justify: false, first-line-indent: 0pt)
    align(center, body)
  },
)

#let verse(body) = block(
  above: sp * 1.25, below: sp * 1.25,
  inset: (left: sp * 2),
  {
    set par(justify: false, first-line-indent: 0pt, hanging-indent: 1.5em)
    body
  },
)

// @s callouts
#let callout(title: none, warning: false, body) = block(
  above: sp * 1.25, below: sp * 1.25, width: 100%,
  fill: wash,
  stroke: (
    rest: 0.5pt + rule-color,
    left: 2.5pt + (if warning { accent } else { rule-strong }),
  ),
  inset: (x: 1em, y: 0.75em),
  breakable: false,
  {
    set text(size: 10pt)
    if title != none {
      block(below: 0.35em, text(
        font: sans, size: xs, weight: 700, tracking: 0.09em,
        fill: if warning { accent } else { ink-muted },
        upper(title),
      ))
    }
    body
  },
)
// @e

// Section breaks. A blank line cannot survive a page break, so the mark is
// always visible.
// @s breaks
#let break-scene(kind: "asterisks") = block(above: sp * 1.5, below: sp * 1.5, sticky: true, width: 100%, align(center, {
  if kind == "asterisks" { box(text(size: 10pt, fill: ink-faint, tracking: 0.6em)[\* \* \*]) }
  else if kind == "asterism" { box(text(size: 14pt, fill: ink-faint)[⁂]) }
  else if kind == "fleuron" { box(text(size: 12pt, fill: accent)[❦]) }
  else if kind == "rule" { line(length: 100%, stroke: 0.5pt + rule-color) }
}))
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

// ── Front matter ────────────────────────────────────────────────────────────

// @s frontmatter
#let title-block(title: none, subtitle: none, author: none, place-date: none) = block(
  below: sp * 3, width: 100%,
  inset: (bottom: sp),
  stroke: (bottom: 0.5pt + rule-color),
  {
    set par(justify: false, first-line-indent: 0pt)
    if title != none { heading(level: 1, outlined: false, title) }
    if subtitle != none {
      block(below: sp, text(font: sans, size: 14pt, weight: 300, fill: ink-muted, subtitle))
    }
    if author != none { text(size: base-size, tracking: 0.08em, ..smcp, author) }
    if place-date != none {
      block(above: 0.2em, text(font: sans, size: sm, fill: ink-muted, place-date))
    }
  },
)
// @e

#let abstract(body) = block(below: sp * 2, width: 30em, {
  set text(size: 10pt, fill: ink-muted)
  set par(justify: false, leading: leading-for(1.45), first-line-indent: 0pt)
  block(below: 0.3em, text(font: sans, size: xs, weight: 700, tracking: 0.1em, fill: ink-faint)[ABSTRACT])
  body
})

#let colophon(body) = block(
  above: sp * 3, width: 26em,
  inset: (top: sp),
  stroke: (top: 0.5pt + rule-color),
  {
    set text(size: sm, style: "italic", fill: ink-muted)
    set par(justify: false, first-line-indent: 0pt)
    body
  },
)

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

#let letterhead(name: none, contact: none) = block(below: sp * 2.5, {
  set par(justify: false, first-line-indent: 0pt)
  text(font: sans, size: 14pt, weight: 600, tracking: -0.01em, name)
  if contact != none {
    block(above: 0.3em, {
      set par(leading: leading-for(1.5))
      text(font: sans, size: xs, fill: ink-muted, contact)
    })
  }
})

#let address(label: none, body) = block(below: sp * 1.5, {
  set par(justify: false, leading: leading-for(1.35), first-line-indent: 0pt)
  if label != none {
    block(below: 0.25em, text(font: sans, size: xs, tracking: 0.1em, fill: ink-faint, upper(label)))
  }
  body
})

#let signature(name) = block(above: sp * 3, breakable: false, {
  set par(justify: false, first-line-indent: 0pt)
  block(width: 16em, inset: (top: 0.3em), stroke: (top: 0.5pt + rule-strong), text(size: sm, name))
})

#let enclosures(body) = block(above: sp * 2, {
  set par(justify: false, first-line-indent: 0pt)
  set text(size: sm, fill: ink-muted)
  text(fill: ink, weight: 600, tracking: 0.06em, ..smcp)[Enc.]
  [ ]
  body
})

#let postscript(body) = block(above: sp, {
  set par(justify: false, first-line-indent: 0pt)
  set text(size: sm)
  text(weight: 600, tracking: 0.08em, ..smcp)[P.S.]
  [ ]
  body
})

// ── Apparatus ───────────────────────────────────────────────────────────────

// @s toc
#let toc() = {
  show outline.entry: set text(font: sans, size: sm)
  outline(title: none, fill: repeat(gap: 0.4em)[.], indent: 1.5em)
}
// @e

// @s notes
#let sidenote(body) = place(
  right,
  dx: 14em,
  dy: -0.3em,
  block(width: 12em, {
    set text(font: sans, size: xs, fill: ink-muted)
    set par(justify: false, leading: leading-for(1.4), first-line-indent: 0pt)
    body
  }),
)
// @e

// ── Utilities ───────────────────────────────────────────────────────────────

// @s utilities
#let keep-together(body) = block(breakable: false, body)
#let tie(body) = box(body)
// @e
