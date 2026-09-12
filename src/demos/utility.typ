// utility-break-before and utility-break-after are not shown here, and cannot
// be: both are Typst's own #pagebreak(), and a pagebreak is refused inside a
// container. typeset() holds the flow to the measure by wrapping the whole
// document in a block(width: …), so every document set under the boilerplate
// the masthead publishes is inside one — `#show: typeset` then `#pagebreak()`
// fails with "pagebreaks are not allowed inside of containers". The same
// document under `typeset.with(measure: none)` compiles, which is the whole
// of the difference. The text below is the two panes the HTML file breaks
// across pages, running on without the break.
…and that is the last that needs saying about the measure.

== Leading

A shorter line needs less separation between baselines for the return sweep to
stay unambiguous, which is why the two decisions cannot be taken apart.

The three rules are the whole of the table style, and the rest follows from
them.

#frontmatter-abstract[
  In short: rules and not grids, sans at 9.5pt, numbers on their right edge.
]

The argument for each of the three takes the rest of this chapter.

The measurements are worth reading as one set, so they are held to one page.

#utility-keep-together[
  #ts-table(
    columns: (1fr, auto),
    rows: 3,
    align: (left + horizon, right + horizon),
    table.header([Margin], [Millimetres]),
    [Narrow], [10],
    [Standard], [20],
    [Wide], [30],
  )
]

#measured(width: measure-narrow)[
  #justified[
    The village of Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch
    sits on Anglesey, and this justified paragraph is left to hyphenate its
    name wherever the dictionary allows, the same as any other word here.
  ]
]

#measured(width: measure-narrow)[
  #justified[
    The village of #text(hyphenate: false)[Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch]
    sits on Anglesey, and this justified paragraph must never hyphenate that
    one name, however freely it hyphenates every other word here.
  ]
]

Keep a figure with its unit: #utility-tie[11 pt], #utility-tie[§2.1],
#utility-tie[Fig. 1] — none of them ever break across a line.

// utility-print-only and utility-color-adjust have no counterpart here
// either, for the opposite reason: both name a difference between two media,
// and Typst composes for one. There is no screen rendering of this document
// for a sentence to be absent from, and no print dialog between the compiler
// and the paper to drop a background on the way — so the two sentences the
// HTML file swaps would both simply be written, and the fills below are in
// the PDF because they were set.
#ts-table(
  columns: (1fr, auto, auto),
  rows: 4,
  align: (left + horizon, right + horizon, right + horizon),
  table.header([Margin], [Top], [Sides]),
  [Narrow], [10], [10],
  table.cell(fill: wash)[Standard], table.cell(fill: wash)[20], table.cell(fill: wash)[20],
  [Wide], [30], [30],
  table.cell(fill: wash)[Letter], table.cell(fill: wash)[32], table.cell(fill: wash)[25],
)
