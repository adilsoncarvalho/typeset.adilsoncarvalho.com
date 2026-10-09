#import "typeset.typ": *

// letter() for the page and the phrase rules only. Every part is left out,
// closing: none included, and the letter sets each one itself.
#show: letter.with(
  closing: none,
  accent: ("good and faithful servant",),
  smallcaps: ("non sum dignus",),
)

#letter-addresses[
  #letter-address-from[
    Adilson Carvalho \
    10 Saddlers Rd, Wadalba NSW 2259
  ]
  #letter-address-to[
    Rev. Fr Lai Nguyen \
    St Anne's Chapel, Auckland
  ]
]

#letter-date("8 October 2026", saint: "St Pelagia, virgin and martyr of Antioch")

#letter-salutation[Fr Lai]

I stood up right after the non sum dignus and dashed to the end of the queue.
I pray you will one day hear Him call you _good and faithful servant_.

#letter-closing[In Christ]

#letter-signature[Adilson C]
