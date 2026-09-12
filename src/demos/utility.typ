Keep a figure with its unit: #utility-tie[11 pt], #utility-tie[§2.1],
#utility-tie[Fig. 1] — none of them ever break across a line.

// utility-break-before, utility-break-after, utility-keep-together and
// utility-color-adjust are not shown here: each only changes something at a
// page boundary or inside a print dialog's own ink-saving pass, neither of
// which a screen render reaches — see tools/check.mjs's EXEMPTIONS entries
// for the one-sentence reason each carries. pagebreak(), utility-keep-together()
// and their CSS counterparts still exist for a document that is actually
// paginated; this file just has nothing paginated to show them against.

#measured(width: measure-narrow)[
  #justified[
    The village of Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch
    sits on Anglesey, and this justified paragraph is left to hyphenate its
    name wherever the dictionary allows, the same as any other word here.
  ]
]

#measured(width: measure-narrow)[
  #justified[
    The village of #text(hyphenate: false)[Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch]
    sits on Anglesey, and this justified paragraph must never hyphenate that
    one name, however freely it hyphenates every other word here.
  ]
]
