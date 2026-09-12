#let s = measure-standard / 400

// A placeholder standing in for an image, the same crossed box the HTML file
// draws in SVG — the pane it belongs to is about the figure block and its
// caption, not about what is in the frame.
#figure(
  caption: [A figure and its caption never split across a page break.],
  block(width: 300 * s, height: 120 * s, {
    place(rect(width: 300 * s, height: 120 * s, stroke: 0.75pt + rule-strong))
    place(line(start: (0pt, 0pt), end: (300 * s, 120 * s), stroke: 0.75pt + rule-color))
    place(line(start: (300 * s, 0pt), end: (0pt, 120 * s), stroke: 0.75pt + rule-color))
  }),
)

#figure(
  caption: [
    Reading comfort against line length. The plateau between 55 and 75
    characters is why the measure, not the font size, is the first decision.
  ],
  block(width: 400 * s, height: 150 * s, {
    place(dx: 150 * s, dy: 20 * s,
      rect(width: 90 * s, height: 100 * s, stroke: none, fill: accent.transparentize(93%)))
    place(dx: 30 * s, dy: 120 * s, line(length: 350 * s, stroke: 0.75pt + rule-strong))
    place(dx: 30 * s, dy: 15 * s, line(angle: 90deg, length: 105 * s, stroke: 0.75pt + rule-strong))
    place(curve(
      stroke: 1.2pt + accent,
      curve.move((40 * s, 112 * s)),
      curve.cubic((90 * s, 100 * s), (120 * s, 40 * s), (175 * s, 32 * s)),
      curve.cubic((230 * s, 26 * s), (260 * s, 34 * s), (300 * s, 62 * s)),
      curve.cubic((335 * s, 88 * s), (355 * s, 106 * s), (375 * s, 114 * s)),
    ))
    place(dx: 145 * s, dy: 128 * s,
      box(width: 100 * s, align(center, text(font: sans, size: xs, fill: ink-muted)[characters per line])))
    place(dx: 145 * s, dy: 4 * s,
      box(width: 100 * s, align(center, text(font: sans, size: xs, fill: accent)[55–75])))
    place(dx: 40 * s, dy: 124 * s, text(font: mono, size: 7pt, fill: ink-faint)[30])
    place(dx: 358 * s, dy: 124 * s, text(font: mono, size: 7pt, fill: ink-faint)[120])
  }),
)

// The third figure, for figure-caption-label. In the HTML file that pane is
// the first one that writes a label into its caption by hand; here every
// caption already carries one, because the show rule at "@s figure" renders
// the supplement and the counter — "FIGURE 3" — in the label's small caps
// ahead of every caption body, and a Typst figure cannot be set without it.
#figure(
  caption: [The label that a cross-reference in the text points back to.],
  block(width: 300 * s, height: 120 * s, {
    place(rect(width: 300 * s, height: 120 * s, stroke: 0.75pt + rule-strong))
    place(line(start: (0pt, 0pt), end: (300 * s, 120 * s), stroke: 0.75pt + rule-color))
    place(line(start: (300 * s, 0pt), end: (0pt, 120 * s), stroke: 0.75pt + rule-color))
  }),
)
