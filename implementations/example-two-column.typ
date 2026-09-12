// A conformance check for the two-column template.
#import "typeset.typ": *

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
      single-column base of 11pt that carries 43 characters — below the floor at
      which a line of prose stays readable. This note works through what a
      two-column template must therefore change, and what it must leave alone.
    ]
  ],
)

== The arithmetic

A4 is 210mm wide. Take off the standard margin, 20mm on each side, and 170mm of
text width remains. A 6mm gutter divides it into two columns of 82mm.

At 11pt, an 82mm column carries about 43 characters. This specification sets 45
as the floor for a line of prose, so 11pt is not available here. Dropping the
base to 9.5pt restores 50 characters, and every other step in the scale comes
down with it.

=== What follows from the size change

Leading tightens from 1.45 to 1.4. A shorter line needs less vertical separation
for the return sweep to stay unambiguous, and the saving is real: at 13.3pt of
advance a column holds 54 lines instead of 45.

Headings come down hardest. A 24pt level-2 heading inside an 82mm column spends
three lines saying two words, so the scale runs 20/13/11/9.5 and the level-1
heading keeps display size only because it spans both columns.

#callouts-callout(title: [What does not change])[
  The colour palette, the rule weights, the numeral conventions, the treatment of
  quotations and the pagination rules are all identical. A template sets the page
  and the scale; it does not get its own typography.
]

== Justification stops being optional

At 50 characters a ragged right edge serrates the column visibly, and the word
gaps in an unhyphenated justified column read as rivers. Both faults are
tolerable at 66 characters and neither is tolerable here.

#quotes-pullquote[This is the one place the spec removes a choice it otherwise offers.]

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
    caption: [Characters per line for an 82mm column, by base size. The floor is 45, and 10.5pt reaches it exactly — a floor is not a target.],
    ts-table(
      columns: (1fr, auto, auto, auto, auto, auto),
      rows: 2,
      table.header[Base size][11pt][10.5pt][10pt][9.5pt][9pt],
      [Characters], [43], [45], [47], [50], [52],
      [Conformant], [no], [at floor], [yes], [yes], [yes],
    ),
  )
]

== What the template forbids

Sidenotes have nowhere to go: there is no margin left. They become footnotes or
endnotes, and an implementation should degrade them visibly rather than
positioning them off the page.

A three-line drop cap at 3.05em is 29pt — 10mm of the column given to one
letter. The opening words go in small caps instead.

#frontmatter-colophon[
  Set in EB Garamond, 9.5 on 13.3 points, two columns of 82mm with a 6mm gutter.
  Composed in Typst.
]
