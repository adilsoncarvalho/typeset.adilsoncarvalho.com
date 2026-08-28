// A conformance check for the two-column template.
#import "typeset.typ": *

#show: two-column.with(
  front: [
    #title-block(
      title: [The Measure of a Column],
      subtitle: [What changes when a page is divided in two, and what must not],
      author: [Adilson Carvalho],
      place-date: [Sydney, 28 August 2026],
    )
    #abstract(width: 100%)[
      Dividing an A4 page into two equal columns leaves 77mm of measure. At the
      single-column base of 11pt that carries 40 characters — below the floor at
      which a line of prose stays readable. This note works through what a
      two-column template must therefore change, and what it must leave alone.
    ]
  ],
)

== The arithmetic

A4 is 210mm wide. Take off the 28mm inner margin and the 22mm outer margin and
160mm of text width remains. A 6mm gutter divides it into two columns of 77mm.

At 11pt, a 77mm column carries about 40 characters. This specification sets 45
as the floor for a line of prose, so 11pt is not available here. Dropping the
base to 9.5pt restores 47 characters, and every other step in the scale comes
down with it.

=== What follows from the size change

Leading tightens from 1.45 to 1.4. A shorter line needs less vertical separation
for the return sweep to stay unambiguous, and the saving is real: at 13.3pt of
advance a column holds 52 lines instead of 47.

Headings come down hardest. A 24pt level-2 heading inside a 77mm column spends
three lines saying two words, so the scale runs 20/13/11/9.5 and the level-1
heading keeps display size only because it spans both columns.

#callout(title: [What does not change])[
  The colour palette, the rule weights, the numeral conventions, the treatment of
  quotations and the pagination rules are all identical. A template sets the page
  and the scale; it does not get its own typography.
]

== Justification stops being optional

At 47 characters a ragged right edge serrates the column visibly, and the word
gaps in an unhyphenated justified column read as rivers. Both faults are
tolerable at 66 characters and neither is tolerable here.

#pullquote[This is the one place the spec removes a choice it otherwise offers.]

So the two-column template asserts justification rather than accepting it as a
parameter. An implementation that offers ragged-right two columns is not
conformant.

=== Spanning

An element spans both columns fully or neither. Spanning costs a break in both
columns, so it is opt-in per instance and belongs at the top or the bottom of a
page — interrupting both columns mid-page makes the reader find their place
twice.

#span(at-bottom: true)[
  #figure(
    caption: [Characters per line for a 77mm column, by base size. The floor is 45.],
    ts-table(
      columns: (1fr, auto, auto, auto, auto, auto),
      rows: 2,
      table.header[Base size][11pt][10.5pt][10pt][9.5pt][9pt],
      [Characters], [40], [42], [44], [47], [49],
      [Conformant], [no], [no], [no], [yes], [yes],
    ),
  )
]

== What the template forbids

Sidenotes have nowhere to go: there is no margin left. They become footnotes or
endnotes, and an implementation should degrade them visibly rather than
positioning them off the page.

A three-line drop cap at 3.05em is 29pt — a quarter of the column width for one
letter. The opening words go in small caps instead.

#colophon[
  Set in EB Garamond, 9.5 on 13.3 points, two columns of 77mm with a 6mm gutter.
  Composed in Typst.
]
