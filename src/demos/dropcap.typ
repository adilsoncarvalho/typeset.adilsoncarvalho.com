// Typst has no counterpart to the lede. The CSS implementation sets the opening
// words of this paragraph in small caps with .ts-dropcap-lede; dropcap() takes
// the whole paragraph as one body and offers no way to mark a run inside it.
//
// dropcap() reads body.text, so the body must be a single text element. Typst's
// markup parser may split a paragraph into several, and the call is then refused
// with `sequence does not have field "text"` — a colon, a parenthesis, an
// apostrophe and an ellipsis are four marks that split it, not the whole set.
// So this paragraph is written in plain words, where the CSS implementation
// punctuates it "a practical reason: in a manuscript".

#dropcap[There is nothing especially modern about wanting a document to look considered. The drop cap descends from the illuminated initial, which existed for a practical reason. In a manuscript with no title page and no table of contents, a large decorated letter was the only way to tell the reader that something had begun.]

The practical reason is gone. The signal is not.
