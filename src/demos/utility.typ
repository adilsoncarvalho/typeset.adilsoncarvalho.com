/ `utility-keep-together`: Never split this element across pages. For a short
  table, a signature block, a callout.
/ `utility-tie`: Keep a figure with its unit: #utility-tie[11 pt],
  #utility-tie[§2.1], #utility-tie[Fig. 1].
/ `set text(hyphenate: false)`: Stop a hyphen the dictionary puts in the wrong
  place. Hyphenation is a text setting, so there is no separate utility.
/ `pagebreak()`: Start the next element on a new page. It is refused inside a
  container, so a document that leaves the measure set has no way to reach it.
