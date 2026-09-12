# typeset — typographic specification

Version 2.0.0 · updated 2026-09-13 · Adilson Carvalho
Canonical: https://typeset.adilsoncarvalho.com

A normative typographic specification for printed documents — essays, letters, reports. This file is the source of truth. CSS, Typst, LaTeX or any other implementation conforms to it; where an implementation and this file disagree, this file is right.

**Target.** Paper and PDF at 100% scale. Not screens, not reflowing layouts.

## Conformance

- Every length is absolute. Points (pt) and millimetres (mm) mean the same thing in every engine; 1pt = 1/72in.
- A length given in em is relative to the font size of the element it is declared on, not to the document base.
- line_height is a multiple of the element's own font size, and defines the baseline-to-baseline advance. An engine whose leading is measured between line boxes rather than between baselines must derive its value from the resulting advance, stated per element in baseline_advance.
- An implementation MUST reproduce every value under `properties`. It MAY add anything the target engine needs to achieve them.
- Where an engine cannot express a property, it must fail visibly or degrade as named in `fallback` — never silently.
- Colour is sRGB. Ink is never pure black: #000 blooms on laser output and glares in a backlit PDF.
- Deriving leading: where the engine measures the gap between line boxes rather than between baselines, pin the line box to the band from the baseline up to 1em (in Typst: top-edge: 1em, bottom-edge: 0pt). The advance is then 1em + leading, so leading = (line_height - 1) em, independent of the font's own metrics.

## Foundation

### page

| Property | Value |
| --- | --- |
| size | `A4` |
| sizes note | Every paper this spec is set for, width before height. `size` names the one a document gets by default; the others are chosen per document. A paper is added here and nowhere else — every page box, text width and column width in this spec is derived from this table and from `margins`. |
| text width | Not a stated constant: the paper width minus the left and right margins — twice the symmetric value, or inner plus outer for a duplex pair. The two are equal for any one size, by the rule above. |

#### sizes mm

| Property | Value |
| --- | --- |
| A4 | `210`, `297` |
| A5 | `148`, `210` |
| Letter | `215.9`, `279.4` |

#### margins

| Property | Value |
| --- | --- |
| default | `standard` |
| symmetric mm | narrow: `10`; standard: `20`; wide: `30` |
| duplex inner mm | narrow: `13`; standard: `23`; wide: `33` |
| duplex outer mm | narrow: `7`; standard: `17`; wide: `27` |
| note | Symmetric is what a document gets unless it asks otherwise: the named size applies to all four sides. Duplex is the explicit opt-in, for a sheet that will be bound — top and bottom stay at the symmetric value, and left and right split into an inner (binding) edge and an outer edge. A duplex pair preserves its symmetric pair's total, inner plus outer equal to twice the symmetric value, and shifts the gutter by 3mm: 20+20=40 becomes 23+17. A document keeps the same text width whichever it chooses, so switching between symmetric and duplex never reflows it. |

#### running head

| Property | Value |
| --- | --- |
| position | `top centre` |
| content | the current level-2 heading, uppercased |
| font | `sans` |
| size | `8pt` |
| tracking | `0.08em` |
| color | `ink_faint` |
| suppressed on | `first page` |

#### folio

| Property | Value |
| --- | --- |
| position | `bottom centre` |
| content | `page number` |
| font | `serif` |
| size | `9pt` |
| numerals | `oldstyle` |
| color | `ink_muted` |
| suppressed on | `first page` |

### fonts

| Property | Value |
| --- | --- |
| embedding | Font files MUST be embedded in the output. A document that resolves its fonts at print time is not reproducible. |

#### serif

| Property | Value |
| --- | --- |
| role | body text — the reading face |
| family | `EB Garamond` |
| license | `OFL` |
| fallbacks | `Iowan Old Style`, `Palatino`, `Georgia`, `serif` |
| weights | `400`, `600` |
| styles | `normal`, `italic` |
| features | `oldstyle figures`, `small caps`, `standard ligatures`, `kerning` |
| note | Set no smaller than 11pt. Below that the strokes thin out on office laser output. |

#### sans

| Property | Value |
| --- | --- |
| role | headings, tables, captions, labels |
| family | `Source Sans 3` |
| license | `OFL` |
| fallbacks | `Helvetica Neue`, `Helvetica`, `Arial`, `sans-serif` |
| weights | `300`, `600`, `700` |
| styles | `normal`, `italic` |
| note | Humanist, so it sits with an old-style serif instead of fighting it. |

#### mono

| Property | Value |
| --- | --- |
| role | code, listings, technical identifiers |
| family | `IBM Plex Mono` |
| license | `OFL` |
| fallbacks | `SF Mono`, `Menlo`, `Consolas`, `monospace` |
| weights | `400`, `600` |
| styles | `normal`, `italic` |
| features | `ligatures disabled` |
| note | Monospaced faces run optically large beside a serif; every size below is already corrected for it. |

### scale

| Property | Value |
| --- | --- |
| ratio | `1.2` |
| base | `11pt` |

#### steps

| Property | Value |
| --- | --- |
| xs | `8pt` |
| sm | `9.5pt` |
| base | `11pt` |
| h4 | `12pt` |
| h3 | `14pt` |
| h2 | `18pt` |
| h1 | `24pt` |

### rhythm

| Property | Value |
| --- | --- |
| line height | `1.45` |
| line height tight | `1.2` |
| baseline advance | `15.95pt` |
| space | `11pt` |
| space note | One unit of vertical space is 11pt — one line of base leading, near enough. Every gap below is a multiple of it. |
| measure | `33em` |
| measure mm | `128` |
| measure chars | `66` |
| measure note | The single largest legibility lever. Past about 75 characters the return sweep fails and readers re-read lines without noticing; below 45 the eye fixates too often. `measure` is canonical — an em measure follows a type-scale change, where a millimetre one does not. `measure_mm` is derived from it, 33 × the 11pt base, and is kept only as a millimetre convenience for readers who think in paper dimensions; tools/check.mjs asserts the two agree. |

#### measure variants

| Property | Value |
| --- | --- |
| narrow | `27em` |
| wide | `40em` |

### color

#### ink

| Property | Value |
| --- | --- |
| hex | `#1a1a1a` |
| role | `body text` |

#### ink muted

| Property | Value |
| --- | --- |
| hex | `#5a5a5a` |
| role | captions, attributions, secondary text |

#### ink faint

| Property | Value |
| --- | --- |
| hex | `#8a8a8a` |
| role | labels, list markers, running heads |

#### rule

| Property | Value |
| --- | --- |
| hex | `#c9c4bd` |
| role | hairlines, table body rules |

#### rule strong

| Property | Value |
| --- | --- |
| hex | `#6f6a64` |
| role | table header and footer rules, block accents |

#### wash

| Property | Value |
| --- | --- |
| hex | `#f4f1ec` |
| role | code and callout backgrounds |

#### accent

| Property | Value |
| --- | --- |
| hex | `#7a1f1f` |
| role | drop caps, note markers, fleurons |
| note | Oxblood. Chosen to read as a dark grey when printed in greyscale. |

## Templates

A template sets the page and the scale. Everything under `foundation` and `sections` still applies; a template states only what it overrides, and what it forbids.

Default: `single-column`

### Single column

`single-column`

**Use for.** Essays, letters, reports, memoranda — anything read continuously from start to finish.

**page.** as foundation.page

**scale.** as foundation.scale

**rhythm.** as foundation.rhythm

**justification.** optional

#### notes

- The default. Nothing to opt into.

### Two column, equal

`two-column` · opt-in: `typeset--two-column`

**Use for.** Papers, journal articles, newsletters, technical notes — documents that are scanned and referenced as much as read, and where a figure is worth more than an uninterrupted argument.

#### derivation

| Property | Value |
| --- | --- |
| derived for | The paper named in foundation.page.size, at the margin named in foundation.page.margins.default. No copy of either is kept here: every number below is a function of those two and of the gutter. |
| column gap mm | `6` |
| column width mm | `82` |
| floor | `45` |
| margins supported | `narrow`, `standard` |
| conclusion | An 82mm column carries 42 characters at the 11pt base — below the 45-character floor this spec sets for a line of prose. 10.5pt still falls short, at 44. The base therefore DROPS to 10pt, the first step that clears the floor — but only just, at 47, two characters of headroom. The template drops one step further anyway, to 9.5pt and 49: a floor is not a target, and a bare pass is not the same as room to breathe. This is arithmetic, not preference: an implementation that keeps 11pt or 10.5pt in two columns violates the measure rule, which is the rule everything else in this spec is downstream of. |
| refusal | Two columns are refused, not set badly, on any paper and margin whose column falls below the floor. That is a computed rule rather than a list of papers: margins_supported names the margins that reach the floor on the paper in foundation.page.size, and tools/check.mjs recomputes it. The checker fails when this declaration disagrees with the arithmetic, when the default margin cannot reach the floor, or when no named margin on the paper can. |
| recompute when | The paper in foundation.page.size, the default margin, or the gutter. Characters per line = (foundation.rhythm.measure_chars / measure_mm) x column_mm x (11 / base_pt), rounded; column_mm = (paper width - twice the margin - the gutter) / 2. tools/check.mjs recomputes every number here from foundation.page, so a margin cannot move without these following it or the checker going red. |

**characters per line**

| Property | Value |
| --- | --- |
| 11pt | `42` |
| 10.5pt | `44` |
| 10pt | `47` |
| 9.5pt | `49` |
| 9pt | `52` |

#### page

| Property | Value |
| --- | --- |
| size | `as foundation.page.size` |
| margins | as foundation.page.margins, at the default size — symmetric unless the sheet is bound, duplex if it is. A duplex pair leaves the text width unchanged, so a two-column document does not reflow between them. |
| columns | `2` |
| column widths | equal — the two columns are the same width, always |
| column gap mm | `6` |
| column width mm | `82` |
| column rule | none by default; an optional 0.5pt hairline in `rule` where the columns need separating |
| column balance | the final page balances its columns to equal height |
| lines per column | `54` |
| running head | as foundation.page — spans the full text width, not a column |
| folio | `as foundation.page` |

#### scale

| Property | Value |
| --- | --- |
| ratio | `1.2` |
| base | `9.5pt` |
| note | Every step comes down. A 24pt heading inside an 82mm column takes three lines to say two words; 18pt takes two. The h1 keeps display size because it spans both columns. |

**steps**

| Property | Value |
| --- | --- |
| xs | `7pt` |
| sm | `8.5pt` |
| base | `9.5pt` |
| h4 | `9.5pt` |
| h3 | `11pt` |
| h2 | `13pt` |
| h1 | `20pt` |

#### rhythm

| Property | Value |
| --- | --- |
| line height | `1.4` |
| baseline advance | `13.3pt` |
| space | `9.5pt` |
| measure | the column — 82mm, not a character count |
| measure chars | `49` |
| note | Leading tightens with the measure: a shorter line needs less vertical separation to keep the return sweep unambiguous. |

#### requirements

- Justification with hyphenation is MANDATORY, not optional. At 49 characters a ragged right edge produces a visibly serrated column and word gaps wide enough to read as rivers. This is the one place the spec removes a choice it otherwise offers.
- The last line of a paragraph is still flush left. Two columns make a stretched last line more visible, not less.
- Balance the columns on the final page. A last page with one full column and one empty third reads as a printing error.
- A spanning element must span BOTH columns fully or neither. An element that spans one and a half columns has no correct reading order.
- Keep a spanning element at the top or the bottom of the page, never mid-column. Interrupting both columns in the middle forces the reader to find their place twice.

#### spanning

| Property | Value |
| --- | --- |
| always | `frontmatter-title-block`, `frontmatter-subtitle`, `frontmatter-byline`, `frontmatter-dateline`, `frontmatter-abstract`, `heading-h1`, `bibliography-heading`, `frontmatter-colophon` |
| optional | `a figure`, `a table`, `a code block`, `a pull quote` |
| never | `a paragraph`, `a list`, `a block quote`, `a callout`, `heading 2 and below`, `a block of endnotes` |
| note | A wide figure or table opts in per instance. The default is column-width, because a spanning element costs a break in both columns. `always` is element ids, so tools/check.mjs can hold both implementations to it; `optional` and `never` are prose, because they describe author choice and default flow rather than a property either implementation can be held to. Each of those entries is written so that it cannot be read as an id — tools/check.mjs fails if one ever matches an element or section id, which is what keeps the two arms distinguishable by shape now that `figure`, `table`, `list` and `callout` are ids in their own right. `bibliography-heading` is on `always` as its own element, distinct from `heading-h2`: `never`'s "heading 2 and below" names the generic heading levels heading-h2 through heading-h6, not a differently-identified element that happens to share their scale — so a bibliography heading may span both columns while an ordinary section heading may not. |

#### forbidden

| Property | Value |
| --- | --- |
| sidenote | There is no margin to put it in. Use a footnote or an endnote. |
| dropcap | A three-line cap at 3.05em is 29pt in an 82mm column — 10mm of the column given to one letter. Open with small caps instead. |
| measure variants | narrow and wide are meaningless: the column is the measure. |

#### element overrides

**h1**

| Property | Value |
| --- | --- |
| size | `20pt` |
| spans | `both columns` |
| space after | `9.5pt` |

**h2**

| Property | Value |
| --- | --- |
| size | `13pt` |
| space before | `19pt` |
| space after | `4.75pt` |

**h3**

| Property | Value |
| --- | --- |
| size | `11pt` |
| space before | `19pt` |
| space after | `4.75pt` |

**h4**

| Property | Value |
| --- | --- |
| size | `9.5pt` |
| space before | `19pt` |
| space after | `4.75pt` |

**paragraph**

| Property | Value |
| --- | --- |
| size | `9.5pt` |
| line height | `1.4` |
| space after | `0` |
| first line indent | `1.25em` |
| note | Indented paragraphs are the default here, not an option: a blank line costs 3% of a column. |

**blockquote**

| Property | Value |
| --- | --- |
| size | `9pt` |
| indent left | `9.5pt` |

**table**

| Property | Value |
| --- | --- |
| size | `8pt` |
| line height | `1.3` |

**codeblock**

| Property | Value |
| --- | --- |
| size | `7.5pt` |
| line height | `1.4` |

**figure caption**

| Property | Value |
| --- | --- |
| size | `8pt` |

**footnote**

| Property | Value |
| --- | --- |
| size | `8pt` |
| note | Scoped to the page, not the column: one notes area spanning both columns at the page foot. |

**endnotes**

| Property | Value |
| --- | --- |
| size | `8.5pt` |

**pullquote**

| Property | Value |
| --- | --- |
| size | `12pt` |
| note | Column width by default. Spanning both columns turns it into a divider, which is a different and heavier thing. |

**abstract**

| Property | Value |
| --- | --- |
| size | `9pt` |
| max width | the full text width, set apart above the columns |

## Elements

### Structure

#### Headings

`heading`

- Sans against the serif body, so hierarchy reads by contrast rather than by size alone.
- Below level 4 the size stops changing and the register shifts instead — small caps, then italic. Six distinct levels inside a 24pt–11pt range.
- Space above is four times the space below: a heading belongs to what follows it.
- A heading MUST NOT be the last thing on a page. This is the most common defect in printed documents.

##### Heading 1 — document title

| Property | Value |
| --- | --- |
| font | `sans` |
| weight | `300` |
| size | `24pt` |
| line height | `1.2` |
| baseline advance | `28.8pt` |
| tracking | `-0.015em` |
| color | `ink` |
| align | `left` |
| space before | `0` |
| space after | `5.5pt` |
| break after | `avoid` |
| break inside | `avoid` |
| wrap | `balanced` |

##### Heading 2 — section

| Property | Value |
| --- | --- |
| font | `sans` |
| weight | `600` |
| size | `18pt` |
| line height | `1.2` |
| baseline advance | `21.6pt` |
| tracking | `-0.01em` |
| color | `ink` |
| align | `left` |
| space before | `22pt` |
| space after | `5.5pt` |
| break after | `avoid` |
| break inside | `avoid` |
| wrap | `balanced` |
| sets running head | yes |

##### Heading 3 — subsection

| Property | Value |
| --- | --- |
| font | `sans` |
| weight | `600` |
| size | `14pt` |
| line height | `1.2` |
| baseline advance | `16.8pt` |
| color | `ink` |
| align | `left` |
| space before | `22pt` |
| space after | `5.5pt` |
| break after | `avoid` |

##### Heading 4

| Property | Value |
| --- | --- |
| font | `sans` |
| weight | `600` |
| size | `12pt` |
| line height | `1.2` |
| baseline advance | `14.4pt` |
| color | `ink` |
| align | `left` |
| space before | `22pt` |
| space after | `5.5pt` |
| break after | `avoid` |

##### Heading 5

| Property | Value |
| --- | --- |
| font | `serif` |
| weight | `600` |
| size | `11pt` |
| variant | `all small caps` |
| tracking | `0.06em` |
| color | `ink` |
| space before | `22pt` |
| space after | `5.5pt` |
| break after | `avoid` |

> No size change from body — the register carries the level.

##### Heading 6

| Property | Value |
| --- | --- |
| font | `serif` |
| weight | `400` |
| style | `italic` |
| size | `11pt` |
| color | `ink` |
| space before | `22pt` |
| space after | `5.5pt` |
| break after | `avoid` |

##### Run-in heading

| Property | Value |
| --- | --- |
| display | inline with the first line of its paragraph |
| separator | ` · ` |
| separator color | `ink_faint` |
| space before | `0` |
| space after | `0` |

> For dense reports where a full heading line is too much vertical cost.

#### Section numbering

`numbering` · opt-in: `typeset--numbered`

- Numbers are generated by a counter, never typed. A typed number drifts the moment a section moves.
- Reports are numbered; essays and letters are not. It must be one switch.

##### Level-2 number

| Property | Value |
| --- | --- |
| format | `1` |
| separator | `two spaces` |
| color | `ink_faint` |
| numerals | `lining tabular` |
| resets | `the level-3 counter` |

##### Level-3 number

| Property | Value |
| --- | --- |
| format | `1.1` |
| separator | `two spaces` |
| color | `ink_faint` |
| numerals | `lining tabular` |

### Prose

#### Paragraphs

`paragraph`

- Two conventions, one switch. Spaced paragraphs suit documents that get skimmed. Indented paragraphs with no gap suit continuous prose and are the convention of nearly every printed book.
- The first paragraph after any heading, block or break is flush left: the thing above it has already marked the start.

##### Paragraph — spaced (default)

| Property | Value |
| --- | --- |
| font | `serif` |
| weight | `400` |
| size | `11pt` |
| line height | `1.45` |
| baseline advance | `15.95pt` |
| numerals | `oldstyle proportional` |
| color | `ink` |
| space after | `11pt` |
| first line indent | `0` |
| orphans | `2` |
| widows | `2` |
| max width | `33em` |

##### Paragraph — indented (opt-in: `typeset--indented`)

| Property | Value |
| --- | --- |
| space after | `0` |
| first line indent | `1.5em` |
| first line indent after block | `0` |

> Applies after a heading, blockquote, figure or section break, and to the first paragraph of the document.

#### Alignment: ragged or justified

`justification` · opt-in: `typeset--justified`

- Ragged right is the DEFAULT, and it is a choice rather than an absence — a document states it. Justification buys a clean right edge at the cost of uneven word spacing; a ragged setting keeps the spacing even and gives up the edge. Neither is more correct, but the cost lands differently by document.
- Choose ragged right for a letter, a memorandum, a short note — anything addressed to a person rather than to a readership. Justification reads as institutional, and its even edge is the visual signature of print that was set for strangers.
- Choose justification for continuous prose at a full measure: an essay, a report, a paper. It is mandatory in two columns, where a ragged edge at 49 characters serrates the column.
- These are a single decision. Justification without hyphenation opens rivers of white space; hyphenation without justification breaks words for no gain. Take both or neither.
- Hyphenation is per-language and requires the document language to be declared. An English dictionary applied to Portuguese produces confident nonsense.
- The last line of a paragraph is NEVER stretched. State this explicitly — a paginating engine fragments the text, so the visual last line stops looking like the end of a paragraph and gets justified. It does not reproduce in an unpaginated preview.
- Justification applies to prose only. It MUST NOT reach a subtitle, byline, caption, address block, table cell, heading or listing. In an engine where alignment inherits, every such block declares its own alignment rather than relying on an exception list.
- Alignment inherits, and so does last-line alignment. A block that sets its own alignment — a centred pull quote, a centred section break — must also set its own last-line alignment, or the document's justification flushes its last line (its only line, for a one-liner) to the left.

##### Ragged right (default) (opt-in: `typeset--ragged — names the default; no class needed to get it`)

| Property | Value |
| --- | --- |
| align | `left` |
| align last line | `left` |
| hyphenation | `manual — never automatic` |
| line breaking | high effort: avoid a very short last line, and even out the right edge |
| applies to | `paragraph`, `list item`, `blockquote`, `definition description`, `callout` |

> Hyphenation exists to serve justification. Without justification a hyphen breaks a word for no gain, so it stays off.

> The rag itself is the thing to judge: an even rag reads as deliberate, a rag with one very short line and one very long one reads as an accident.

##### Justified

| Property | Value |
| --- | --- |
| align | `justify` |
| align last line | `left` |
| justify method | `inter-word` |
| hyphenation | `automatic` |
| hyphenation min word chars | `6` |
| hyphenation min chars before break | `3` |
| hyphenation min chars after break | `3` |
| max consecutive hyphens | `2` |
| applies to | `paragraph`, `list item`, `blockquote`, `definition description`, `callout` |

Where unsupported: automatic hyphenation, but at the engine's own built-in limits — the four tuning values above are not configurable

##### Never justified

| Property | Value |
| --- | --- |
| align | `left` |
| hyphenation | `manual` |
| applies to | `all headings`, `subtitle`, `byline`, `dateline`, `abstract`, `attribution`, `epigraph`, `verse`, `caption`, `figure caption`, `address block`, `table cell`, `table header`, `code block`, `table of contents`, `bibliography`, `endnotes`, `sidenote`, `letterhead`, `salutation`, `closing`, `signature`, `enclosures`, `postscript`, `definition term` |

#### Drop cap

`dropcap`

- For the opening of an essay or a chapter, and nowhere else.
- The size and line height are tuned together to cover exactly three lines. Change the leading and the cap must be retuned.
- The opening words go in small caps. Without them the jump from 33pt to 11pt is too abrupt and the eye skips the first line.

##### Drop cap

| Property | Value |
| --- | --- |
| font | `serif` |
| weight | `400` |
| size | `3.05em` |
| size pt | `33.55pt` |
| line height | `0.86` |
| color | `accent` |
| float | `left` |
| lines covered | `3` |
| padding right | `0.06em` |
| padding top | `0.02em` |
| first line indent | `0` |

##### Opening words

| Property | Value |
| --- | --- |
| variant | `all small caps` |
| tracking | `0.04em` |
| extent | the first two to four words |

#### Inline emphasis

`inline`

- Nested emphasis FLIPS to roman rather than compounding. This is correct typographic behaviour and most engines get it wrong by default.
- Superscripts and subscripts must not disturb the line's leading.
- Underline is reserved for insertions. On paper it is a typewriter's substitute for italic, and there is no reason to imitate a typewriter.

##### Bold

| Property | Value |
| --- | --- |
| weight | `600` |

> For the load-bearing clause.

##### Italic

| Property | Value |
| --- | --- |
| style | `italic` |

> For a title or a term of art.

##### Nested italic

| Property | Value |
| --- | --- |
| style | `normal` |

##### Small caps

| Property | Value |
| --- | --- |
| variant | `all small caps` |
| tracking | `0.05em` |
| numerals | `oldstyle` |

> Named entities, acronyms, stage directions.

##### Abbreviation

| Property | Value |
| --- | --- |
| variant | `all small caps` |
| tracking | `0.05em` |
| underline | `0.5pt dotted` |
| underline color | `ink_faint` |

##### Superscript

| Property | Value |
| --- | --- |
| size | `0.72em` |
| baseline shift | `+0.45em` |
| line height | `0` |
| affects leading | no |

##### Subscript

| Property | Value |
| --- | --- |
| size | `0.72em` |
| baseline shift | `-0.22em` |
| line height | `0` |
| affects leading | no |

##### Deletion

| Property | Value |
| --- | --- |
| decoration | `line-through` |
| color | `ink_muted` |

##### Insertion

| Property | Value |
| --- | --- |
| decoration | `underline` |
| underline offset | `0.15em` |

##### Highlight

| Property | Value |
| --- | --- |
| background | `wash` |
| bleed | `2pt beyond the glyphs` |

##### Key

| Property | Value |
| --- | --- |
| font | `sans` |
| size | `0.85em` |
| padding | `0.15em 0.35em` |
| border | `0.5pt rule` |
| border bottom | `1.5pt rule` |
| radius | `2pt` |

#### Inline code

`code-inline`

##### Inline code

| Property | Value |
| --- | --- |
| font | `mono` |
| size | `0.86em` |
| ligatures | `disabled` |
| background | `wash` |
| padding | `0.1em 0.28em` |
| radius | `2pt` |
| wrap | `may break within a word` |

> The 0.86em corrects for the monospace face running optically large beside the serif.

> Ligatures off: an arrow rendered as one glyph is charming in an editor and wrong in a document that quotes source.

#### Links in print

`link`

- Paper has no hover and no click. A URL that carries information must be printed.

##### Link

| Property | Value |
| --- | --- |
| color | `inherit` |
| decoration | `underline` |
| underline thickness | `0.5pt` |
| underline offset | `0.14em` |
| skip descenders | yes |

##### Printed URL

| Property | Value |
| --- | --- |
| content | the href in parentheses, after the link text |
| font | `mono` |
| size | `0.82em` |
| color | `ink_muted` |
| wrap | `may break anywhere` |
| applies to | external (http/https) links only |
| excluded | `internal anchors`, `mailto:`, `links marked bare` |

##### Link — URL suppressed

| Property | Value |
| --- | --- |
| print url | no |

> Opt-out for a link whose URL would be noise in print: a shortened URL, a tracking URL, or one the surrounding sentence already gives.

#### Numerals

`numeral`

- Three kinds, three jobs. Getting this wrong is the most visible amateur tell in a set document, and it is one setting.
- Old-style figures have ascenders and descenders and sit inside the x-height. Lining figures are uniform cap height. Tabular figures share one advance width, which is the only reason a column of numbers can align.

##### In running prose

| Property | Value |
| --- | --- |
| numerals | `oldstyle proportional` |

##### In headings and display

| Property | Value |
| --- | --- |
| numerals | `lining proportional` |

##### In tables and columns

| Property | Value |
| --- | --- |
| numerals | `lining tabular` |

##### Fractions

| Property | Value |
| --- | --- |
| form | `diagonal` |

### Blocks

#### Quotations

`quote`

- Four jobs, four treatments. A block quote is evidence. An epigraph opens a chapter. A pull quote is display type lifted from the body. Verse preserves the poet's line breaks.
- A pull quote repeats text that already appears in the body, so it MUST NOT be the only place a claim appears — a skimming reader would get the claim without its qualification.
- Attribution always sits outside the quotation. Inside, it becomes part of what was said.

##### Block quote

| Property | Value |
| --- | --- |
| font | `serif` |
| size | `10.5pt` |
| line height | `1.45` |
| color | `ink` |
| space before | `13.75pt` |
| space after | `13.75pt` |
| indent left | `16.5pt` |
| border left | `1pt rule` |
| break inside | `avoid` |
| last child space after | `0` |

##### Attribution

| Property | Value |
| --- | --- |
| display | `block` |
| align | `left` |
| space before | `5.5pt` |
| size | `9.5pt` |
| style | `normal` |
| color | `ink_muted` |
| prefix | `em dash and a space` |

##### Epigraph

| Property | Value |
| --- | --- |
| font | `serif` |
| style | `italic` |
| size | `10pt` |
| color | `ink_muted` |
| align | `left` |
| block alignment | `flush right` |
| max width | `24em` |
| border | `none` |
| space after | `22pt` |

> Cite inside an epigraph is roman, not italic — the surrounding block is already italic.

##### Pull quote

| Property | Value |
| --- | --- |
| font | `sans` |
| weight | `300` |
| size | `15pt` |
| line height | `1.3` |
| align | `centre` |
| wrap | `balanced` |
| border top | `1.5pt rule_strong` |
| border bottom | `0.5pt rule` |
| padding top | `11pt` |
| padding bottom | `11pt` |
| space before | `16.5pt` |
| space after | `16.5pt` |

##### Verse

| Property | Value |
| --- | --- |
| font | `serif` |
| size | `11pt` |
| align | `left` |
| line breaks | `preserved as authored` |
| indent left | `22pt` |
| runover indent | `1.5em` |
| border | `none` |

Where unsupported: in Typst: the left indent and the authored line breaks, but no runover indent — a wrapped line reads the same as one the poet wrote

> Runover lines indent further than the verse line they continue, so a wrapped line cannot be mistaken for a new one.

#### Lists

`list`

- The marker's colour, weight and width must be under control. A grey marker with black text reads as one thing; a black marker competes with the first word.
- Runover lines align to the text, never to the marker.
- Two levels of nesting is the limit worth designing for.
- Definition lists are underused: they are the right shape for a glossary, a set of terms, or the field-and-value blocks of a letter.

##### Unordered list

| Property | Value |
| --- | --- |
| marker | `·` |
| marker color | `ink_muted` |
| marker weight | `700` |
| marker column width | `1.4em` |
| indent | `1.4em` |
| item space after | `2.75pt` |
| space after | `11pt` |

##### Unordered list, nested

| Property | Value |
| --- | --- |
| marker | `–` |
| marker weight | `400` |
| space before | `2.75pt` |

##### Ordered list

| Property | Value |
| --- | --- |
| marker | `1.` |
| marker color | `ink_muted` |
| numerals | `lining tabular` |
| marker column width | `1.4em` |
| indent | `1.4em` |
| item space after | `2.75pt` |

> Tabular numerals so 9 and 10 align.

##### Ordered list, nested

| Property | Value |
| --- | --- |
| marker | `a.` |

##### Tight list (opt-in: `ts-list-tight`)

| Property | Value |
| --- | --- |
| item space after | `0` |

> For enumerations that are not prose.

##### Definition term

| Property | Value |
| --- | --- |
| font | `sans` |
| weight | `600` |
| size | `9.5pt` |
| align | `left` |
| space before | `6.6pt` |
| space before first | `0` |
| break after | `avoid` |

##### Definition description

| Property | Value |
| --- | --- |
| font | `serif` |
| size | `11pt` |
| indent left | `16.5pt` |
| space after | `0` |

#### Tables

`table`

- Rules, not grids. Vertical rules are almost never needed — the columns already read as columns, and every added line is ink competing with data.
- Three horizontal rules only: above the header, below the header, below the body.
- A table is scanned, not read. Sans at 9.5pt; the serif's job is reading.
- Numbers align on their right edge, on tabular figures. Units go in the header, not in every cell.
- A table that spans pages MUST repeat its header on each. Without it, page two of a table is unreadable.

##### Table

| Property | Value |
| --- | --- |
| font | `sans` |
| size | `9.5pt` |
| line height | `1.35` |
| numerals | `lining tabular` |
| width | `full measure` |
| space before | `13.75pt` |
| space after | `13.75pt` |
| border collapse | yes |

##### Header cell

| Property | Value |
| --- | --- |
| font | `sans` |
| weight | `600` |
| size | `8pt` |
| case | `uppercase` |
| tracking | `0.07em` |
| color | `ink_muted` |
| align | `left` |
| border top | `1pt rule_strong` |
| border bottom | `1pt rule_strong` |
| padding | `0.45em 0.7em 0.45em 0` |
| repeats across pages | yes |

##### Body cell

| Property | Value |
| --- | --- |
| align | `left` |
| vertical align | `baseline` |
| border bottom | `0.5pt rule` |
| padding | `0.45em 0.7em 0.45em 0` |
| last row border bottom | `1pt rule_strong` |

##### Numeric cell

| Property | Value |
| --- | --- |
| align | `right` |
| numerals | `lining tabular` |

##### Footer cell

| Property | Value |
| --- | --- |
| weight | `600` |
| border bottom | `none` |

##### Caption

| Property | Value |
| --- | --- |
| position | `above the table` |
| align | `left` |
| font | `sans` |
| size | `9.5pt` |
| color | `ink` |
| space after | `0.5em` |
| max width | `none` |

##### Row

| Property | Value |
| --- | --- |
| break inside | `avoid` |

##### Zebra striping (opt-in: `ts-table-zebra`)

| Property | Value |
| --- | --- |
| background | `wash on even body rows` |

> For wide, dense tables only. Not a default.

##### Caption label

| Property | Value |
| --- | --- |
| weight | `600` |
| caps | `all small caps` |
| tracking | `0.06em` |

#### Code blocks

`codeblock`

- Paper cannot scroll. Lines wrap; they are never clipped.
- A long listing MUST be allowed to split across pages. Forbidding the break pushes a blank page ahead of it.

##### Code block

| Property | Value |
| --- | --- |
| font | `mono` |
| size | `8.5pt` |
| line height | `1.45` |
| background | `wash` |
| border left | `2pt rule_strong` |
| padding | `0.8em 1em` |
| space before | `13.75pt` |
| space after | `13.75pt` |
| wrap | `soft-wrap long lines` |
| tab size | `2` |
| break inside | avoid on screen, allowed in print |

#### Figures & captions

`figure`

- A caption is not a title: it goes below the figure.
- A figure and its caption stay on one page. This is the one place a no-break rule is unambiguously right.
- The caption carries a small-caps label so a cross-reference in the text has something to point at.

##### Figure

| Property | Value |
| --- | --- |
| space before | `16.5pt` |
| space after | `16.5pt` |
| break inside | `avoid` |
| image max width | `full measure` |

##### Figure caption

| Property | Value |
| --- | --- |
| position | `below the figure` |
| font | `sans` |
| size | `9.5pt` |
| line height | `1.4` |
| color | `ink_muted` |
| align | `left` |
| space before | `0.5em` |
| border top | `0.5pt rule` |
| padding top | `0.4em` |

##### Figure caption label

| Property | Value |
| --- | --- |
| weight | `600` |
| color | `ink` |
| caps | `all small caps` |
| tracking | `0.06em` |

#### Callouts

`callout`

- A callout is an aside the reader may skip without losing the argument. If skipping it would lose the argument, it is a paragraph.
- Two variants only. A document with five callout colours has none.

##### Callout

| Property | Value |
| --- | --- |
| font | `serif` |
| size | `10pt` |
| background | `wash` |
| border | `0.5pt rule` |
| border left | `2.5pt rule_strong` |
| padding | `0.75em 1em` |
| space before | `13.75pt` |
| space after | `13.75pt` |
| break inside | `avoid` |

##### Callout title

| Property | Value |
| --- | --- |
| font | `sans` |
| weight | `700` |
| size | `8pt` |
| case | `uppercase` |
| tracking | `0.09em` |
| color | `ink_muted` |
| space after | `0.35em` |

##### Callout — warning

| Property | Value |
| --- | --- |
| border left | `2.5pt accent` |
| title color | `accent` |

#### Section breaks

`break`

- A blank line cannot survive a page break: if the break falls on the gap, the reader never learns the scene changed. Over a long document this is a certainty, not an accident. The mark MUST be visible.
- Four registers, one per kind of division.

##### Break — three asterisks

| Property | Value |
| --- | --- |
| content | `* * *` |
| size | `10pt` |
| tracking | `0.6em` |
| color | `ink_faint` |
| align | `centre` |
| space before | `16.5pt` |
| space after | `16.5pt` |
| break after | `avoid` |

> The default, for a change of scene in prose.

##### Break — asterism

| Property | Value |
| --- | --- |
| content | `⁂` |
| size | `14pt` |
| color | `ink_faint` |
| align | `centre` |

> A heavier division: a change of part.

##### Break — fleuron

| Property | Value |
| --- | --- |
| content | `❦` |
| size | `12pt` |
| color | `accent` |
| align | `centre` |

> Where the document can afford ornament.

##### Break — rule

| Property | Value |
| --- | --- |
| border top | `0.5pt rule` |
| content | `none` |

> Where it cannot. Reports.

### Apparatus

#### Footnotes, endnotes & sidenotes

`note`

- Bottom-of-page footnotes require an engine that can measure the page while laying it out. Typst and LaTeX do this natively. WeasyPrint 53+ and Prince implement the CSS footnote model. No browser does.
- Where footnotes are unavailable the note text MUST still live in the document, degrading to a numbered endnotes block — never to a lost note.
- Sidenotes are the better default where the page can afford the margin: no page-break arithmetic, and the reader never leaves the sentence they are in.
- The reference mark must not disturb the leading of the line it sits on.

##### Reference mark

| Property | Value |
| --- | --- |
| content | `the note number` |
| size | `0.7em` |
| baseline shift | `+0.45em` |
| line height | `0` |
| color | `accent` |
| numerals | `lining` |
| decoration | `none` |
| brackets | `none` |
| affects leading | no |

##### Footnote

| Property | Value |
| --- | --- |
| position | foot of the page carrying the mark |
| font | `serif` |
| size | `9.5pt` |
| line height | `1.35` |
| separator | a rule above the notes area |

Where unsupported: an endnotes block at the end of the document

##### Endnotes block

| Property | Value |
| --- | --- |
| font | `serif` |
| size | `9.5pt` |
| line height | `1.4` |
| align | `left` |
| space before | `22pt` |
| border top | `0.5pt rule` |
| padding top | `11pt` |
| list indent | `1.8em` |
| item space after | `0.4em` |
| heading | none — the rule above the block is the only mark it needs |

> No 'NOTES' label. In a one-page document the rule plus the numbered list already reads as a notes area, and a heading over two lines of small print is heavier than the thing it labels.

##### Sidenote (opt-in: `typeset--sidenotes`)

| Property | Value |
| --- | --- |
| font | `sans` |
| size | `8pt` |
| line height | `1.4` |
| color | `ink_muted` |
| align | `left` |
| width | `11em` |
| position | the right margin, 2em past the text column's own right edge |
| vertical offset | -0.3em from the marker's line |
| marker prefix | the note number in accent, weight 600 |
| measure when active | `27em` |
| reserved margin | 14em — the gap plus the note, with an em to spare |

> Anchor the note to the text column's right edge, not to the measure. The measure is a maximum: where the reserved margin is the binding constraint the column is narrower than it, and a note offset from the measure lands on top of the text.

> Sidenotes are positioned, not flowed: a long note followed closely by another will overlap it. Keep each note short and consecutive notes apart — one per paragraph, and not in every paragraph. An implementation cannot fix this, and should not pretend to; it is a constraint on the writing.

#### Table of contents

`toc`

- Page numbers require the engine to resolve a cross-reference after pagination. Where it cannot, the entry MUST omit the number rather than print a wrong one — a TOC with wrong numbers is worse than one with none.

##### Table of contents

| Property | Value |
| --- | --- |
| font | `sans` |
| size | `9.5pt` |
| align | `left` |

##### Entry

| Property | Value |
| --- | --- |
| space after | `0.35em` |
| decoration | `none` |
| page number | `resolved after pagination` |
| page number numerals | `lining tabular` |
| page number color | `ink_muted` |

Where unsupported: leaders render, page numbers are omitted

##### Entry — level 2

| Property | Value |
| --- | --- |
| indent left | `1.5em` |

##### Dot leader

| Property | Value |
| --- | --- |
| leader | dotted 0.5pt rule, colour rule, filling the space between title and number |
| baseline offset | `-0.15em` |

#### Bibliography

`bibliography`

- Hanging indent, always. The surname is what is being scanned, so it must be the leftmost thing on the entry.
- The heading is its own element, not an instance of heading-h2, even though it shares h2's scale and weight: the distinct id is what lets it span both columns in the two-column template while an ordinary section heading — heading-h2 through heading-h6 — cannot.

##### Heading

| Property | Value |
| --- | --- |
| font | `sans` |
| weight | `600` |
| size | `18pt` |
| line height | `1.2` |
| baseline advance | `21.6pt` |
| tracking | `-0.01em` |
| color | `ink` |
| align | `left` |
| space before | `22pt` |
| space after | `5.5pt` |
| break after | `avoid` |
| break inside | `avoid` |
| wrap | `balanced` |
| sets running head | yes |

##### Entry

| Property | Value |
| --- | --- |
| font | `serif` |
| size | `9.5pt` |
| line height | `1.4` |
| align | `left` |
| hanging indent | `1.8em` |
| space after | `0.55em` |
| marker | `none` |
| break inside | `avoid` |
| title style | `italic` |

Where unsupported: in Typst: every property here except the hanging indent — a wrapped line sits flush with the surname instead of indented past it

### Documents

#### Front matter

`frontmatter`

- A colophon closes the document, recording how it was made and in what type. It is the one piece of matter that is purely for pleasure, and the cheapest thing here to include.

##### Title block

| Property | Value |
| --- | --- |
| space after | `33pt` |
| padding bottom | `11pt` |
| border bottom | `0.5pt rule` |

##### Subtitle

| Property | Value |
| --- | --- |
| font | `sans` |
| weight | `300` |
| size | `14pt` |
| line height | `1.25` |
| color | `ink_muted` |
| align | `left` |
| wrap | `balanced` |
| space after | `11pt` |

##### Byline

| Property | Value |
| --- | --- |
| font | `serif` |
| size | `11pt` |
| variant | `all small caps` |
| tracking | `0.08em` |
| align | `left` |
| space after | `0` |

##### Dateline

| Property | Value |
| --- | --- |
| font | `sans` |
| size | `9.5pt` |
| color | `ink_muted` |
| align | `left` |
| space before | `0.2em` |

##### Abstract

| Property | Value |
| --- | --- |
| font | `serif` |
| size | `10pt` |
| line height | `1.45` |
| color | `ink_muted` |
| align | `left` |
| max width | `30em` |
| space after | `22pt` |

##### Colophon

| Property | Value |
| --- | --- |
| font | `serif` |
| style | `italic` |
| size | `9.5pt` |
| color | `ink_muted` |
| align | `left` |
| max width | `26em` |
| space before | `33pt` |
| padding top | `11pt` |
| border top | `0.5pt rule` |
| break before | `avoid` |

##### Abstract label

| Property | Value |
| --- | --- |
| display | `block` |
| font | `sans` |
| size | `xs` |
| weight | `700` |
| tracking | `0.1em` |
| caps | `uppercase` |
| color | `ink_faint` |

#### Letter

`letter`

- A letter is set ragged right. It is addressed to a person, and justification reads as institutional.
- The sender block is address data, not a masthead: one style throughout, at body size, in the reading face. Nothing bold, nothing in the sans. A personal letter does not announce itself.
- Address blocks are line-broken data, not prose: tighter leading, never justified, line breaks as authored.
- The signature is the typed name with room above it to sign. No ruled line — a rule is a form to be filled in.
- A letter carries no running head and no folio.
- Footnotes belong in a letter as much as in an essay. Where the engine cannot set them at the page foot, the rule plus the numbered note at the end of a one-page letter reads as a footnote area regardless.

##### Letter page

| Property | Value |
| --- | --- |
| margin top mm | `32` |
| margin bottom mm | `28` |
| margin sides mm | `25` |
| running head | `none` |
| folio | `none` |

> The deeper top margin puts the letterhead where an envelope window expects it.

##### Sender block

| Property | Value |
| --- | --- |
| font | `serif` |
| weight | `400` |
| size | `11pt` |
| line height | `1.35` |
| color | `ink` |
| align | `left` |
| line breaks | as authored — name, street, suburb and postcode, country |
| space after | `27.5pt` |

> Every line is the same style, including the name. Setting the name larger or bolder turns a letter into stationery.

> Omit what you do not use. A personal letter needs no email address and no telephone number.

##### Address block

| Property | Value |
| --- | --- |
| font | `serif` |
| size | `11pt` |
| line height | `1.35` |
| style | `normal` |
| align | `left` |
| line breaks | `as authored` |
| space after | `16.5pt` |

##### Date line

| Property | Value |
| --- | --- |
| numerals | `oldstyle` |
| align | `left` |
| space after | `16.5pt` |

##### Line under the date

| Property | Value |
| --- | --- |
| font | `serif` |
| style | `italic` |
| size | `11pt` |
| color | `ink` |
| align | `left` |
| space before | 0.1em — it belongs to the date, and takes no gap of its own |
| space after | `16.5pt` |

> A dedication, a feast, a devotion — whatever the writer puts under the date. Italic, at body size, immediately beneath.

##### Salutation

| Property | Value |
| --- | --- |
| align | `left` |
| space after | `11pt` |

##### Closing

| Property | Value |
| --- | --- |
| align | `left` |
| space before | `16.5pt` |

##### Signature block

| Property | Value |
| --- | --- |
| font | `serif` |
| size | `11pt` |
| align | `left` |
| space before | `33pt — the room to sign` |
| rule | `none` |
| break inside | `avoid` |
| signature image max height | `16mm` |

> The typed name only. A ruled line above a name is a form; a letter is not a form.

##### Enclosures

| Property | Value |
| --- | --- |
| font | `serif` |
| size | `11pt` |
| align | `left` |
| space before | `22pt` |
| label | same style as the text it introduces — no small caps, no weight change |

> Same reasoning as the postscript: "Enc." introduces a sentence, it does not head a section.

##### Postscript

| Property | Value |
| --- | --- |
| font | `serif` |
| size | `11pt` |
| align | `left` |
| space before | `11pt` |
| label | same style as the text it introduces — no small caps, no weight change |

> A postscript is a sentence that happens to begin with "P.S.". The label is not a heading.

##### Footnote — in a letter

| Property | Value |
| --- | --- |
| marker | as the note marker in Apparatus — superscript, accent, no brackets |
| position | foot of the page where the engine can; otherwise after the signature block |
| font | `serif` |
| size | `9.5pt` |
| separator | 0.5pt rule above the notes area |
| heading | `none` |

Where unsupported: a numbered note after the signature, under a rule — which on a one-page letter is the page foot anyway

##### Address label

| Property | Value |
| --- | --- |
| display | `block` |
| font | `sans` |
| size | `xs` |
| tracking | `0.1em` |
| caps | `uppercase` |
| color | `ink_faint` |

#### Pagination utilities

`utility`

- The small set of overrides reached for while proofing a real document. Every one of them is a manual decision about a specific page, not a style.

##### Break before

| Property | Value |
| --- | --- |
| effect | start this element on a new page |

> Chapter openings.

##### Break after

| Property | Value |
| --- | --- |
| effect | start the next element on a new page |

##### Keep together

| Property | Value |
| --- | --- |
| effect | never split this element across pages |

> A short table, a signature block, a callout.

##### No hyphenation

| Property | Value |
| --- | --- |
| hyphenation | `manual` |

##### Tie

| Property | Value |
| --- | --- |
| effect | `no line break inside` |

> A figure with its unit, an initial with a surname, a section mark with its number.

##### Print only / screen only

| Property | Value |
| --- | --- |
| effect | present in one medium, absent in the other |

> The URL list a page needs and a screen does not; the navigation a screen needs and a page does not.

##### Exact colour

| Property | Value |
| --- | --- |
| effect | backgrounds and rules survive the output device's ink-saving |

> Without it a print dialog can strip every rule in a table.

---

Generated from spec.json by tools/build-spec.mjs. Do not edit this file — edit spec.json and regenerate.
