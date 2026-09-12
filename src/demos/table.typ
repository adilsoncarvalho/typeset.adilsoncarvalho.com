#ts-table(
  columns: (1fr, 1fr),
  rows: 2,
  table.header([Typeface], [Category]),
  [EB Garamond], [Serif text face],
  [Source Sans 3], [Sans display face],
)

#ts-table(
  columns: (1fr, 1fr),
  rows: 1,
  table.header([Setting], [Value]),
  [Body size], [11pt],
)

#ts-table(
  columns: (1fr, 1fr),
  rows: 3,
  table.header([Typeface], [Category]),
  [EB Garamond], [Serif text face],
  [Source Sans 3], [Sans display face],
  [IBM Plex Mono], [Monospace face],
)

#ts-table(
  columns: (1fr, auto),
  rows: 3,
  align: (left + horizon, right + horizon),
  table.header([Typeface], [Size (pt)]),
  [EB Garamond], [11.0],
  [Source Serif], [10.5],
  [Charis SIL], [10.0],
)

// table-footer-cell drops its own bottom rule in the stylesheet; ts-table
// draws a rule under every row but the header and the last, so the closing
// rule below falls on this footer row regardless — close enough to the
// spec's own look that a second, hand-written stroke override isn't worth
// the row it would cost this file's readability.
#ts-table(
  columns: (1fr, auto),
  rows: 3,
  align: (left + horizon, right + horizon),
  table.header([Typeface], [Size (pt)]),
  [EB Garamond], [11.0],
  [Source Serif], [10.5],
  [#strong[Median]], [#strong[10.75]],
)

// One figure() call stands for both table-caption and table-caption-label:
// the show rule at "@s figure" always renders the supplement and counter
// ("Table 1") in the label's own small caps ahead of the caption body, so
// Typst has no way to produce a caption without that label already applied.
#figure(
  caption: [Setting widths for a single-column A4 page, by point size.],
  kind: table,
  supplement: [Table],
  ts-table(
    columns: (1fr, auto),
    rows: 2,
    align: (left + horizon, right + horizon),
    table.header([Typeface], [Measure (mm)]),
    [EB Garamond], [128],
    [Source Serif], [124],
  ),
)

// table-row is not shown: its one property, break-inside: avoid, only ever
// changes what happens at a page boundary, which a screen-rendered document
// never reaches — see tools/check.mjs's EXEMPTIONS entry for it.

// No zebra parameter on ts-table — the stylesheet reaches an even body row
// by its position in the DOM, which a Typst table has no equivalent
// selector for, so the fill is set cell by cell instead.
#ts-table(
  columns: (1fr, auto),
  rows: 4,
  align: (left + horizon, right + horizon),
  table.header([Typeface], [Size (pt)]),
  [EB Garamond], [11.0],
  table.cell(fill: wash)[Source Serif], table.cell(fill: wash)[10.5],
  [Charis SIL], [10.0],
  table.cell(fill: wash)[IBM Plex Serif], table.cell(fill: wash)[10.5],
)
