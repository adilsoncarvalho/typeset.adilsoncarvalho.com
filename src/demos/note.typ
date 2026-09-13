// Two examples here, one in the CSS implementation. Typst sets footnotes at the
// foot of the page natively; no browser implements the CSS footnote model, so
// the CSS example degrades to the numbered endnote block the spec names as the
// fallback, and its sidenotes are shown as a separate full-page example.
//
// Sidenotes are paid for out of the measure, so the whole document narrows
// rather than one block inside it: the notes sit in the margin the narrowing
// frees, which is a property of the page, not of a container. `sidenotes:
// true` is what reserves that margin — note-sidenote() below refuses to
// place a note without it, rather than land one wherever the ambient measure
// happens to end.
#show: typeset.with(sidenotes: true)

Bringhurst puts the ideal measure between 45 and 75
characters,#footnote[Robert Bringhurst, _The Elements of Typographic Style_,
4th ed., §2.1.2.] a range narrow enough to be useful and wide enough to survive
a change of typeface. The lower bound matters more in a two-column
layout.#footnote[Below about 40 characters, hyphenation stops being optional.]

== The measure of a line

Bringhurst puts the ideal measure between 45 and 75 characters, a range narrow
enough to be useful and wide enough to survive a change of
typeface.#note-sidenote[_Elements_, 4th ed., §2.1.2.]

The lower bound matters more in a two-column layout, where the column is the
measure and there is no slack to give away.#note-sidenote[Below 40 characters,
hyphenation stops being optional.]

What the range really encodes is the number of fixations the eye makes per
line, which depends on the reader, the difficulty of the prose, and the size of
the type relative to the viewing distance.

=== The cost

Sidenotes are paid for in horizontal space: the text column gives up six ems so
the margin can have twelve.#note-sidenote[Which is why they are forbidden in
two columns: no margin is left to give.] On a single-column A4 page that is
affordable, and the margin was going to be white anyway.

The alternative is a footnote, which asks the reader to travel to the foot of
the page and back. A sidenote asks them to glance right. Over forty pages the
difference is not small.
