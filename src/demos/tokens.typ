#let steps = (
  (scale-single-column.h1, [24pt], [Heading one]),
  (scale-single-column.h2, [18pt], [Heading two]),
  (scale-single-column.h3, [14pt], [Heading three]),
  (scale-single-column.h4, [12pt], [Heading four]),
  (scale-single-column.base, [11pt], [Body text — EB Garamond]),
  (scale-single-column.sm, [9.5pt], [Captions, footnotes, tables]),
  (scale-single-column.xs, [8pt], [Labels and running heads]),
)

#for (size, label, sample) in steps [
  #grid(
    columns: (3em, 1fr),
    column-gutter: 0.75em,
    align(horizon + right)[#text(font: sans, size: xs, weight: 700, label)],
    align(horizon)[#text(size: size, sample)],
  )
  #v(0.3em)
]

#v(1em)

#let swatches = (
  (ink, [ink]),
  (ink-muted, [muted]),
  (ink-faint, [faint]),
  (rule-color, [rule]),
  (wash, [wash]),
  (accent, [accent]),
)

#grid(
  columns: (auto,) * swatches.len(),
  column-gutter: 1em,
  ..swatches.map(pair => align(horizon)[
    #rect(width: 1em, height: 1em, fill: pair.at(0), radius: 2pt)
    #h(0.35em)
    #text(font: sans, size: xs, fill: ink-muted, pair.at(1))
  ])
)
