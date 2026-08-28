// A conformance check for the letter template. Ragged right, no running head,
// no folio, and a real footnote at the foot of the page.
#import "typeset.typ": *

#show: letter-page
#show: typeset          // justified: false — a letter is set ragged right

#letterhead[
  Adilson Carvalho \
  10 Wentworth Avenue \
  Surry Hills NSW 2010 \
  Australia
]

#address(label: [To])[
  The Registrar \
  Institute of Typographic Studies \
  88 Rundle Street \
  Adelaide SA 5000
]

27 August 2026
#date-note[St Monica, mother of St Augustine Bishop, ora pro nobis]

Dear Registrar,

I am writing about the setting of the Institute's annual report, which arrived
this morning and which I read with rather more attention to its margins than to
its contents. I hope that is taken in the spirit intended.

The text column runs to something near a hundred and ten
characters.#footnote[Measured on page four, between the outer margins: 168mm at
a 10pt body, which is about 112 characters.] By the second page I had lost my
place twice, and by the fourth I had stopped reading and started measuring.

This is a cheap problem to fix. Narrowing the column to sixty-six characters
costs one afternoon and no money, and the space it frees on the right can carry
the marginal notes that are currently crowded into footnotes.

If it would be useful, I am glad to set one section of next year's report as a
demonstration.

Yours sincerely,

#signature[Adilson Carvalho]

#enclosures[typeset.css; two specimen pages]

#postscript[The tables were excellent — tabular figures throughout, which is
more than most annual reports manage.]
