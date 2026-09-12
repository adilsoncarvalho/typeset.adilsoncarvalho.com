// A conformance check: the essay from typeset.adilsoncarvalho.com, set in Typst.
#import "typeset.typ": *

#show: typeset.with(justified: true, indented: true)

#frontmatter-title-block(
  title: [On the Measure of a Line],
  subtitle: [Why the width of a text column is the first decision, and the typeface is very nearly the last],
  author: [Adilson Carvalho],
  place-date: [Sydney, 28 August 2026],
)

#frontmatter-abstract[
  Every argument about typefaces is downstream of an argument about column
  width. This essay makes the narrow case that a document set at the wrong
  measure cannot be rescued by any choice of face.
]

#epigraph-right(attribution: [Jost Hochuli])[
  Anything but the simplest of documents is an argument about attention.
]

#dropcap[Ask anyone to improve a document and they will change the font. It is the most visible lever and the least effective one. The reader who abandoned your report on page three did not abandon it because Calibri is thin; they abandoned it because each line ran a hundred and ten characters wide.]

This is not a matter of taste. The return sweep — the movement from the end of
one line to the beginning of the next — is a motor task, and like every motor
task it has an error rate that rises with distance.

== The range, and why it is a range

The conventional figure is forty-five to seventy-five characters for a single
column, with sixty-six given as the ideal.#footnote[Robert Bringhurst, _The Elements of Typographic Style_, 4th ed., §2.1.2.]
The width of the range is the interesting part.

#quote(block: true, attribution: [Emil Ruder, _Typographie_, 1967])[
  Typography has one plain duty before it and that is to convey information in
  writing. No argument or consideration can absolve typography from this duty.
]

#quotes-pullquote[No argument can absolve typography from this duty.]

#breaks-asterism()

== What the measure costs

Fixing the measure on A4 means giving up horizontal space. Two answers: a margin
is not empty, and you can put something in it.

#figure(
  caption: [Setting widths for a single column on A4, by point size.],
  ts-table(
    columns: (1fr, auto, auto, auto, auto),
    rows: 3,
    table.header[Typeface][Size (pt)][Leading][Measure (mm)][Chars],
    [EB Garamond], [11.0], [1.45], [128], [66],
    [Source Serif 4], [10.5], [1.42], [124], [64],
    [Charis SIL], [10.0], [1.40], [119], [67],
  ),
)

#callouts-callout(title: [Note])[
  Point sizes assume the document is printed at 100%. Fit-to-page scaling
  silently invalidates every measurement here.
]

- An unordered item, with a grey mid-dot for a marker.
- A second item long enough to wrap, so the runover aligns to the text.

/ Measure: The length of a line of type, counted in characters.
/ Leading: The vertical distance between baselines.

#quotes-verse[
  Whose woods these are I think I know. \
  His house is in the village though;
]

#frontmatter-colophon[
  Set in EB Garamond, 11 on 16 points, with Source Sans 3 for headings.
  Composed in Typst.
]
