// frontmatter-subtitle, frontmatter-byline and frontmatter-dateline carry no
// symbol of their own: frontmatter-title-block composes all three itself, by
// name, from the params below — there is no way to call for just one line
// of the block.
#frontmatter-title-block(
  title: [On the Measure of a Line],
  subtitle: [Why the width of a text column is the first decision, and the font is the last],
  author: [Adilson Carvalho],
  place-date: [Sydney, 28 August 2026],
)

// frontmatter-abstract always sets the "ABSTRACT" caption itself, so
// frontmatter-abstract-label has no symbol of its own and — unlike
// letter-address-block's `label:` — no way to be left off. The HTML file
// shows the block both ways, unlabelled and labelled; only the labelled one
// below is reachable from here.
#frontmatter-abstract[
  Every argument about typefaces is downstream of an argument about column
  width. This essay makes the case that a document set at the wrong measure
  cannot be rescued by any choice of face, and that a document set at the right
  one is nearly indifferent to it.
]

The claim is not original, and it is not complicated…

#frontmatter-colophon[
  Set in EB Garamond, with Source Sans 3 for headings and IBM Plex Mono for
  code. Composed and paginated in Typst. A4, 11 on 16 points.
]
