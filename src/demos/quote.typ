// The HTML file shows this quotation twice: once bare, for the block quote
// itself, and once attributed, for quote-attribution. Here it appears once,
// attributed — `attribution:` is the whole difference between the two panes,
// and a second copy of the same four lines would teach nothing the parameter
// name does not already say.
Ruder puts the case for restraint more sharply than anyone since:

#quote(attribution: [Emil Ruder, _Typographie_, 1967])[
  Typography has one plain duty before it and that is to convey information in
  writing. No argument or consideration can absolve typography from this duty.
]

Which is a hard standard, and the right one.

#quote(type: "epigraph", attribution: [I. A. Richards])[
  A book is a machine to think with.
]

There is nothing especially modern about wanting a document to look considered…

…the sentence applies with more force to layout than to decoration. An over-wide
column is not an aesthetic misjudgement; it is a failure to convey.

#quote(type: "pullquote")[No argument can absolve typography from this duty.]

And the duty is discharged in the measure long before it is discharged in the
typeface.

// type: "verse" sets the stanza and nothing else: it takes no attribution,
// where the CSS implementation closes the verse with <cite>Robert Frost</cite>.
#quote(type: "verse")[
  Whose woods these are I think I know. \
  His house is in the village though; \
  He will not see me stopping here \
  To watch his woods fill up with snow.
]
