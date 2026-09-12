#show: two-column.with(
  front: [
    #frontmatter-title-block(
      title: [The Measure of a Column],
      subtitle: [What changes when a page is divided in two, and what must not],
      author: [Adilson Carvalho],
      place-date: [Sydney, 28 August 2026],
    )
    #frontmatter-abstract(width: 100%)[
      Dividing an A4 page into two equal columns leaves 82mm of measure. At the
      single-column base of 11pt that carries 42 characters — below the floor at
      which a line of prose stays readable.
    ]
  ],
)

== The arithmetic

A4 is 210mm wide. Take off the standard margin, 20mm on each side, and 170mm of
text width remains. A 6mm gutter divides it into two columns of 82mm.

At 11pt, an 82mm column carries about 42 characters. This specification sets 45
as the floor for a line of prose, so neither 11pt nor 10.5pt (44) is available
here. Dropping the base to 9.5pt restores 49 characters. The template derives
all of this from the paper and the margin, and refuses the page outright where
the arithmetic does not reach the floor.

=== What follows

Leading tightens from 1.45 to 1.4. A shorter line needs less vertical
separation for the return sweep to stay unambiguous, and the saving is real: at
13.3pt of advance a column holds 54 lines instead of 45.

Headings come down hardest. A 24pt level-2 heading inside an 82mm column spends
three lines saying two words, so the scale runs 20/13/11/9.5.

#callouts-callout(title: [What does not change])[
  The palette, the rule weights, the numeral conventions and the pagination
  rules are all identical.
]

== Justification

At 49 characters a ragged right edge serrates the column visibly, and the word
gaps in an unhyphenated justified column read as rivers. Both faults are
tolerable at 66 characters and neither is tolerable here.

#quotes-pullquote[The one place the spec removes a choice.]

So the template asserts justification rather than offering it as an option.

#span(figure(
  caption: [Characters per line for an 82mm column.],
  kind: table,
  supplement: [Table],
  ts-table(
    columns: (1fr, auto, auto, auto, auto),
    rows: 2,
    align: (left + horizon,) + (right + horizon,) * 4,
    table.header([Base], [11pt], [10pt], [9.5pt], [9pt]),
    [Characters], [42], [47], [49], [52],
    [Conformant], [no], [yes], [yes], [yes],
  ),
))

== What the template forbids

Sidenotes have nowhere to go: there is no margin left. They become footnotes or
endnotes, and an implementation should degrade them visibly rather than
positioning them off the page and losing them.

A three-line drop cap at 3.05em is 29pt — 10mm of the column given to one
letter. The cap is neutralised and the opening words carry the signal in small
caps instead.

=== Spanning

An element spans both columns fully or neither. Spanning costs a break in both
columns, so it is opt-in per instance and belongs at the top or the bottom of a
page.

#frontmatter-colophon[
  Set in EB Garamond, 9.5 on 13.3 points, two columns of 82mm with a 6mm
  gutter.
]
