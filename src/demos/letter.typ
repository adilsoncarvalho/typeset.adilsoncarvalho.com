// letter-page's #show call opens the document itself, in place of the
// boilerplate's own #show: typeset — a letter's page (a deeper top margin,
// no running head, no folio) cannot be set from inside a container, so one
// replaces the other rather than nesting under it.
#show: letter-page

// letter-crest takes the image itself. A crest kept as a file is read from
// the document and recoloured with svg-recolor:
//   #letter-crest(svg-recolor(read("crest.svg"), width: 100%))
#letter-crest(image(bytes(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 48'>"
    + "<path d='M4 4h32v18c0 12-8 20-16 24C12 42 4 34 4 22z' fill='none' stroke='#7a1f1f' stroke-width='1.5'/>"
    + "</svg>"
), width: 100%))

// letter-address-label is reached through letter-address-block's `label:`
// parameter rather than through a symbol of its own. The first line of each
// block is the name, set in small caps; the lines after it a step smaller.
#letter-addresses[
  #letter-sender[
    Adilson Carvalho \
    10 Wentworth Avenue \
    Surry Hills NSW 2010 \
    Australia
  ]

  #letter-address-block(label: [To])[
    The Registrar \
    Institute of Typographic Studies \
    88 Rundle Street \
    Adelaide SA 5000
  ]
]

#letter-date([27 August 2026], saint: [St Monica, mother of St Augustine Bishop])

#letter-salutation[Dear Registrar,]

I am writing about the setting of the Institute's annual report, which arrived
this morning and which I read with more attention to its margins than to its
contents. I hope that is taken in the spirit intended.

// letter-footnote has no symbol: it is Typst's own footnote, set at the foot
// of the page where the engine can — which on a one-page letter is the
// numbered-note fallback this spec asks for anyway.
The text column runs to something near a hundred and ten
characters.#footnote[Measured on page four, between the outer margins: 168mm at
a 10pt body, which is about 112 characters.] By the second page I had lost my
place twice, and by the fourth I had stopped reading and started measuring.

// Inside letter-page every block quote is a letter-quote.
#quote[Set the column to sixty-six characters, and the margins will look after themselves.]

This is a cheap problem to fix, and I would be glad to send the specification I
use for my own documents.

#letter-closing[Yours sincerely,]

#letter-signature[Adilson Carvalho]

#letter-enclosures[typeset.typ; two specimen pages]

#letter-postscript[The tables were excellent — tabular figures throughout, which
is more than most annual reports manage.]
