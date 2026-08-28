# Fonts

Every face the spec names, plus the five candidates from `proofs/font-proof.html`.
All OFL-1.1; each directory carries its own `OFL.txt`, which must stay with the
fonts if you redistribute them.

```
fonts/
  EB-Garamond/          serif — body text          4 faces, OTF
  Source-Sans-3/        sans  — headings, tables   6 faces, TTF
  IBM-Plex-Mono/        mono  — code               3 faces, TTF
  candidates/           the five faces under consideration
  manifest.json         inventory + OpenType features per family
```

**Static instances only, no variable fonts.** Typst 0.14 exposes a variable font
as its *default weight only* — `typst fonts --variants` lists EB Garamond
`[wght]` as weight 400 and nothing else — so every other weight would be
synthesised (faux bold) with no warning. One file per weight avoids that.

## Using them with Typst

**Web app (typst.app):** drag the family folders you need into the project's file
tree. Typst picks fonts up by family name, so no configuration is needed —
`#set text(font: "EB Garamond")` just resolves.

**CLI:**

```sh
typst compile --font-path fonts implementations/example-essay.typ essay.pdf
typst fonts --font-path fonts --variants   # confirm every weight is seen
```

Verified: both `example-essay.typ` and `example-two-column.typ` compile with
**zero** unknown-font warnings against this directory.

## Weights, and why these ones

| Family | Faces | Why |
|---|---|---|
| EB Garamond | 400, 600, 400i, 600i | Body, `strong`, h5, italic |
| Source Sans 3 | 300, 400, 600, 700, 400i, 600i | h1 is 300, headings 600, callout titles 700, letterhead 400 |
| IBM Plex Mono | 400, 600, 400i | Code and listings |
| Candidates | 400, 600, 400i (+600i) | Enough to judge a body face |

## EB Garamond comes from upstream, not Google Fonts

This is the important thing in this directory.

**Google Fonts' build of EB Garamond has no small caps.** Parsing its GSUB table
shows no `smcp` and no `c2sc` — and no `onum`/`lnum` either. The spec requires
small caps for h5, the byline, abbreviations, labels, enclosures and the
postscript, and requires lining figures for display.

The failure is silent and differs by engine:

- **In CSS**, the browser *synthesises* small caps — scaled-down capitals. It
  looks approximately right, which is why this went unnoticed.
- **In Typst there is no synthesis.** `features: ("smcp",)` against a font with
  no `smcp` does nothing at all, so every small-caps element renders as plain
  lowercase. Conformant-looking source, non-conformant output, no warning.

So EB Garamond here is the **upstream release** ([octaviopardo/EBGaramond12](https://github.com/octaviopardo/EBGaramond12)),
whose OTFs carry 33 features including `smcp`, `c2sc`, `onum`, `lnum`, `pnum`,
`tnum`, `liga`, `dlig` and `frac`. Verified by rendering: real small caps,
old-style figures by default, lining figures on demand, tabular figures that
align, diagonal fractions, and full Portuguese diacritics.

**Consequence for the web pages.** `index.html` and the CSS examples still load
Google's build from the Google Fonts CDN, so their small caps are synthesised
rather than real. Self-hosting from this directory would fix that — see the
Fonts section of the root README.

## The candidates fail the numerals requirement

Feature inventory (see `manifest.json` for the full lists):

| Candidate | Small caps | Old-style figures | Verdict against the spec |
|---|---|---|---|
| Cormorant Garamond | no | **yes** (default; `lnum` to switch) | Numerals OK. Display face — see the proof. |
| Alegreya | no | **yes** (default; `lnum` to switch) | Numerals OK |
| Spectral | no | **no** — lining only | **Cannot meet the numerals rule** |
| Crimson Pro | no | **no** — lining only | **Cannot meet the numerals rule** |
| Literata | no | **no** — lining only | **Cannot meet the numerals rule** |

The spec calls old-style figures in running prose the most visible amateur tell
to get wrong. Three of the five candidates, *as distributed by Google*, cannot
produce them at all: they ship lining figures with no `onum` to switch away from.

None of the five has small caps in Google's build. Before adopting any of them,
check its upstream release — Cormorant and Alegreya both publish separate
small-caps families (`Cormorant SC`, `Alegreya SC`), and upstream OTFs often
carry features Google's builds drop. What is in this directory is enough to judge
a face on paper; it is not necessarily enough to ship it.

## Provenance

Google Fonts serves static TTF instances per weight to a plain user agent, which
is how the TTFs here were fetched:

```sh
curl -sS "https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,600;1,400;1,600"
# → @font-face blocks with .ttf URLs on fonts.gstatic.com
```

`manifest.json` records every file, its size, and its OpenType features.
