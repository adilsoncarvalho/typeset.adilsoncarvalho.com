/ `utilities-keep-together`: Never split this element across pages. For a short
  table, a signature block, a callout.
/ `utilities-tie`: Keep a figure with its unit: #utilities-tie[11 pt],
  #utilities-tie[§2.1], #utilities-tie[Fig. 1].
/ `set text(hyphenate: false)`: Stop a hyphen the dictionary puts in the wrong
  place. Hyphenation is a text setting, so there is no separate utility.
/ `pagebreak()`: Start the next element on a new page. It is refused inside a
  container, so a document that leaves the measure set has no way to reach it.
