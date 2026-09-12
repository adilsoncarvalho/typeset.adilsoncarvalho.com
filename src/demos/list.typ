- An unordered item.
- A second item, long enough to wrap onto a second line so you can see that the
  runover aligns to the text, not to the marker.

- A first-level item, followed by a nested list:
  - The nested marker is an en dash.
  - Two levels is the limit worth designing for.

#enum(start: 8,
  [Eighth item.],
  [Ninth item.],
  [Tenth item — the marker still sits in the same column as the single digits above it.],
  [Eleventh item.],
)

// Nesting is indent-driven here, the same as the unordered list above; this
// file's `set enum(numbering: "1.")` applies at every depth, so the sub-items
// below count 1, 2 rather than switching to lower alpha the way the
// stylesheet's `ol ol` selector does.
+ A first-level item, followed by sub-items:
  + First sub-item.
  + Second sub-item.

#list(tight: true,
  [11pt body],
  [9.5pt table],
  [8pt caption label],
)

/ Measure: The length of a line of type, counted in characters rather than in
  millimetres.
/ Leading: The vertical distance between baselines. Named for the strips of lead
  once inserted between lines of metal type.
