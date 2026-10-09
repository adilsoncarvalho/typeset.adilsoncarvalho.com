// A conformance check for the letter template. Ragged right, no running head,
// no folio, and a real footnote at the foot of the page.
#import "typeset.typ": *

#show: letter-page      // ragged right, no running head, no folio

#letter-addresses[
  #letter-sender[
    Adilson Carvalho \
    10 Wentworth Avenue \
    Surry Hills NSW 2010 \
    Australia
  ]

  #letter-address-to[
    The Registrar \
    Institute of Typographic Studies \
    88 Rundle Street \
    Adelaide SA 5000
  ]
]

#letter-date([27 August 2026], saint: [St Monica, mother of St Augustine Bishop])

#letter-salutation[Dear Registrar,]

I am writing about the setting of the Institute's annual report, which arrived
this morning and which I read with rather more attention to its margins than to
its contents.

The text column runs to something near a hundred and ten
characters.#footnote[Measured on page four, between the outer margins: 168mm at
a 10pt body, which is about 112 characters.] By the second page I had lost my
place twice, and by the fourth I had stopped reading and started measuring.

This is a cheap problem to fix. Narrowing the column to sixty-six characters
costs one afternoon and no money, and the space it frees on the right can carry
the marginal notes that are currently crowded into footnotes.

#letter-closing[Yours sincerely,]

#letter-signature[Adilson Carvalho]

#letter-enclosures[typeset.css; two specimen pages]

#letter-postscript[The tables were excellent — tabular figures throughout.]
