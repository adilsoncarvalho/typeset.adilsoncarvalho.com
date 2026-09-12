#ragged-right[
  Typographical craftsmanship consists in the appropriate use of the
  incomparable resources of a well-designed typeface, and in the discipline
  required to leave those resources alone when the content does not need them.
  Justification is one such resource: expensive, occasionally beautiful, and
  demanding of the hyphenation dictionary that makes it possible.
]

#justified[
  Typographical craftsmanship consists in the appropriate use of the
  incomparable resources of a well-designed typeface, and in the discipline
  required to leave those resources alone when the content does not need them.
  Justification is one such resource: expensive, occasionally beautiful, and
  demanding of the hyphenation dictionary that makes it possible.
]

#justified(lang: none)[
  Typographical craftsmanship consists in the appropriate use of the
  incomparable resources of a well-designed typeface, and in the discipline
  required to leave those resources alone when the content does not need them.
  Justification is one such resource: expensive, occasionally beautiful, and
  demanding of the hyphenation dictionary that makes it possible.
]

// `justified` also names a parameter of `typeset()` — the document-wide
// default. The two are not the same knob: this whole demo sits in a document
// left at that default (ragged), so every `#justified[...]` block above is
// already the per-block override winning over it. The reverse direction —
// `#ragged-right` winning inside a block that is itself justified — nests
// the same way, with no document-wide setting involved at all:
#justified[
  A justified block can carry its own exception, the same as the document
  can. This sentence is stretched to the measure like the ones above it.

  #ragged-right[
    This paragraph is nested inside the justified block above and still reads
    ragged right — the override reaches through surrounding context in either
    direction, not only against the document's own default.
  ]
]
