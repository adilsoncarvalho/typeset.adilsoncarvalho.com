#import "typeset.typ": *

// Every default is a parameter: the greeting, the closing words, and the
// page itself.
#show: letter.with(
  margin: 30mm,
  addressee: ("Fabiano and Mari", "Point Chevalier", "Auckland 1022"),
  date: "1 October 2026",
  greeting: "Hey,",
  salutation: "you two",
  closing: [With love],
  signature: "Adilson",
)

Thank you for the warm welcome, the care, the views, the coffees, the meals.
