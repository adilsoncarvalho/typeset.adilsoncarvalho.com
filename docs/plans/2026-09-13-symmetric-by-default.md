# Symmetric By Default — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Ticket:** NT-symmetric-by-default

**Goal:** Every template's page is symmetric unless it asks for duplex, and every
document's text sits symmetrically inside it.

---

## What the owner said

> About the templates, why only the two-columns has symmetrical margins? That
> should be the default to all templates, and the inner/outer configuration only
> used if planning to have them duplex printed.

and, when told the margins already were symmetric:

> it is not only in the letter. the essay also has asymmetrical margins.

He is right, and the cause is not the margins.

## Measured, 2026-09-13

Queried from the engine, not read from a default:

```
page            210.0mm
margins          20.0mm each side      symmetric, as designed
text area       170.0mm
measure block   128.1mm               33em at 11pt
text spans      20.0mm -> 148.1mm
visual gaps     left 20.0mm   right 61.9mm
```

`typeset()` ends in a **left-aligned** `block(width: measure, doc)`. The measure
is narrower than the text area, so all 42mm of slack falls on the right. Every
single-column document is lopsided while its margins are perfectly symmetric.

`src/demos/page.typ`'s own prose already names the slack — *"Between them lies
170mm of text width, of which the measure claims 128mm and leaves the remainder
as slack"* — and nobody asked where it goes.

## The letter is the second half

| | Typst | CSS |
|---|---|---|
| default document | `margin-standard` — 20mm | `@page { margin: 20mm }` |
| two-column | `margin-standard` — 20mm | same |
| **letter** | **top 32, bottom 28, sides 25** | **`@page ts-letter { margin: 32mm 25mm 28mm }`** |

Not duplex — a bespoke page that predates the named margin system, with
`spec.json` hardcoding `margin_top_mm: 32` as an element property. The owner
chose to keep the deeper top and express it through the system rather than
flatten it.

## Global constraints

- `v1.0.0` stays the only tag.
- Duplex stays opt-in. Nothing in this plan makes a template reach for it.
- Both implementations move together; the naming gate is bidirectional.

---

## Task 1: Centre the measure

**Files:** `implementations/typeset.typ`, `typeset.css`, `spec.json`, `tools/check.mjs`

- [ ] **Step 1: Centre it in both.** The text block sits centred in the text
      area, so the slack splits evenly. On A4 at the standard margin that is
      20 + 21mm each side.

- [ ] **Step 2: Say it in the spec.** `foundation.rhythm` states the measure;
      nothing states where a narrower measure sits inside a wider text area.
      That is the rule this task adds, and it is normative — a conformant
      implementation must not left-align it.

- [ ] **Step 3: Gate it by rendering.** Query the text block's left and right
      edges and assert they are equal within a stated tolerance. A source check
      cannot see this — the current code reads correctly and renders lopsided.

- [ ] **Step 4:** Every example moves. Confirm the essay, the letter and the
      two-column all shift, and that the two-column's *columns* do not change
      width — the column is the measure there, so it has no slack to split.

- [ ] **Step 5: Rebuild, check, commit.**

---

## Task 2: The letter's page through the system

**Files:** `spec.json`, `implementations/typeset.typ`, `typeset.css`, `src/demos/letter.*`, `tools/check.mjs`

The letter keeps its deeper top. It stops being three bespoke numbers.

- [ ] **Step 1: Name the band.** The letter's page is the symmetric default plus
      a letterhead band above the content. Derive the band from the difference
      the current design already encodes, state it in `spec.json` as a named
      value, and let the letter's page be `margin-standard` plus that band.

- [ ] **Step 2: Decide what happens to the other two deltas.** Today the letter
      is also 28mm at the bottom and 25mm at the sides against the standard 20mm.
      Either they were carrying the same intent as the top band and collapse into
      the symmetric default, or they are their own decision and need their own
      name. Work out which from `spec.json`'s own letter principles, and say
      which you chose and why — do not preserve three arbitrary numbers by
      wrapping them in a constant.

- [ ] **Step 3: Both implementations.** `letter-page()` and `@page ts-letter`
      derive from the named values rather than restating them.

- [ ] **Step 4: Gate it.** The letter's rendered page box must match what
      `spec.json` derives. Group 4 built exactly this check for the six named
      margins — read it before writing a second one.

- [ ] **Step 5: Rebuild, check, commit.**

---

## Task 3: The pull request

- [ ] Full green. All three examples compile. Both bundles and the previews build.
- [ ] The description carries the measurement above, before and after, and says
      plainly that every rendered example moved.
- [ ] **Do not tag.**

---

## Self-review

- **Coverage.** Both halves of what he said: Task 1 is the essay, Task 2 is the
  letter.
- **Ordering.** Centring first, because it changes every document including the
  letter, and the letter's own page should be judged after it.
- **Counts verified 2026-09-13:** measure 128.1mm, text area 170mm, slack 41.9mm,
  letter 32/28/25, 37 gates. Re-derive rather than trusting these.
- **Known risk.** This moves every rendered page in the repo. Byte-identity is
  not available as a guard here; the guard is the rendered symmetry check in
  Task 1 Step 3 plus reading the three examples as pages.
