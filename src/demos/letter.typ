// letter-page's #show call opens the document itself, in place of the
// boilerplate's own #show: typeset — a letter's page (a deeper top margin,
// no running head, no folio) cannot be set from inside a container, so one
// replaces the other rather than nesting under it.
#show: letter-page

#letter-sender[
  Adilson Carvalho \
  10 Wentworth Avenue \
  Surry Hills NSW 2010 \
  Australia
]

// letter-address-label is the address block's own "To" caption — its
// label: parameter, not a symbol of its own.
#letter-address-block(label: [To])[
  The Registrar \
  Institute of Typographic Studies \
  88 Rundle Street \
  Adelaide SA 5000
]

// letter-date, letter-salutation and letter-closing carry no symbol of
// their own: each is plain text, left aligned, at the same rhythm as any
// other paragraph in the letter.
27 August 2026
#letter-date-note[St Monica, mother of St Augustine Bishop, ora pro nobis]

Dear Registrar,

I am writing about the setting of the Institute's annual report, which arrived
this morning and which I read with more attention to its margins than to its
contents. I hope that is taken in the spirit intended.

// letter-footnote has no symbol either: it is Typst's own footnote,
// set at the foot of the page where the engine can — which on a one-page
// letter is the numbered-note fallback this spec asks for anyway.
The text column runs to something near a hundred and ten
characters.#footnote[Measured on page four, between the outer margins: 168mm at
a 10pt body, which is about 112 characters.] By the second page I had lost my
place twice, and by the fourth I had stopped reading and started measuring.

This is a cheap problem to fix, and I would be glad to send the specification I
use for my own documents.

Yours sincerely,

#letter-signature[Adilson Carvalho]

#letter-enclosures[typeset.typ; two specimen pages]

#letter-postscript[The tables were excellent — tabular figures throughout, which
is more than most annual reports manage.]
