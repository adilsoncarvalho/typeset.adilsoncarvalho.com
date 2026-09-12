// title: none is the default — a callout does not require one.
#callout[
  Point sizes assume the document is printed at 100%. “Fit to page” scaling in a
  print dialog silently invalidates every measurement in this stylesheet.
]

#callout(title: [Note])[
  Fonts must be embedded in the exported PDF, or the recipient's own installed
  fonts silently take over.
]

#callout(title: [Before you send it], warning: true)[
  Check that fonts are embedded in the PDF. A document that falls back to Times
  on the recipient's machine has lost every decision above.
]
