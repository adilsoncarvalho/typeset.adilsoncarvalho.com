// Typst has no counterpart to the lede. The CSS implementation sets the opening
// words of this paragraph in small caps with .ts-dropcap-lede; dropcap() takes
// the whole paragraph as one body and offers no way to mark a run inside it.
//
// dropcap() reads body.text, which exists only where the body is a single text
// element. Typst splits markup into a sequence at a colon, at an apostrophe or
// a quotation mark, and at a dash shorthand, and the call is then refused with
// `sequence does not have field "text"`. The CSS implementation punctuates the
// sentence below with a colon — "a practical reason: in a manuscript" — and
// this one cannot.

#dropcap[There is nothing especially modern about wanting a document to look considered. The drop cap descends from the illuminated initial, which existed for a practical reason. In a manuscript with no title page and no table of contents, a large decorated letter was the only way to tell the reader that something had begun.]

The practical reason is gone. The signal is not.
