# Page Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Jira Ticket:** NT-no-ticket (personal project)

**Goal:** Symmetric margins by default, in three named sizes, applicable to any paper — with mirrored margins as an explicit opt-in for duplex binding, and the spec's own character floor enforced rather than assumed.

**Architecture:** Margin and paper become orthogonal: six named constants carry millimetre values that hold on any sheet, and the page box is derived rather than written down. The two-column template stops asserting A4's arithmetic and starts computing it, so a paper and margin that cannot reach the 45-character floor is refused by the checker rather than silently set.

**Tech Stack:** Node 22, plain CSS, Typst, the existing `tools/*.mjs` scripts.

**Design doc:** `docs/specs/2026-09-11-NT-typeset-restructure-design.md` — Group 4 of five, brought forward. Groups 1 and 2 are merged.

---

## Decisions taken with the repo's owner

| Question | Decision |
|---|---|
| Default margins | **Symmetric**, `standard` = 20mm on all four sides. Mirrored is an opt-in for duplex binding, not the default. |
| The three sizes | `narrow` 10mm · `standard` 20mm · `wide` 30mm. |
| Duplex counterparts | Preserve the total, shift the gutter +3mm: **13/7 · 23/17 · 33/27**. A document switching between symmetric and duplex keeps its text width and does not reflow — the pattern the existing 28/22 already followed from a 25/25 base. |
| Two columns at `wide` | **Refused.** At 30mm on A4 the columns carry 43.7 characters against a floor of 45, and closing the gap needs a 2.6mm gutter — too narrow to stop the eye jumping between columns. `wide` stays available for single-column documents. |
| Choosing a margin | Named constants, with the millimetre values exported so a document needing 18mm for a specific printer can still say so. |
| Spanning in two columns | The eight elements `spec.json` lists under `spanning.always` are applied **automatically**. The author writes the same document in one column or two. `spanning.optional` stays manual, because optional means the author decides. |

## The thing this group is really about

`spec.json`'s two-column template already carries the formula and the instruction:

```
characters_per_line = 0.524 × column_mm × (11 / base_pt)
recompute_when: "The page size, the margins or the gutter change."
```

**Nothing has ever recomputed it.** The declared table is A4's arithmetic at 28/22 margins, written once and trusted since. This group changes the margins — exactly the trigger that text names — so the numbers must move, and after this group the checker must recompute them rather than believe them.

Measured against the spec's own formula, with a 6mm gutter:

| paper | narrow 10mm | standard 20mm | wide 30mm |
|---|---|---|---|
| A4 210mm | 92mm → 56 | 82mm → 50 | 72mm → **43.7, below the floor** |
| A5 148mm | 61mm → **37** | 51mm → **31** | 42mm → **26** |

**A5 cannot carry two columns at any margin.** Today nothing says so, and a document asking for it would be set with 26-character columns.

## What must not break

`node tools/check.mjs` passes on `master` with fourteen gates. It must pass at every commit here. In particular:

- The naming gate stays at zero in all directions; element count stays 102.
- Every published pane's classes still resolve; every Typst snippet still compiles.
- **The measure does not change.** `foundation.rhythm.measure_mm` is 126mm and stays 126mm — the measure constrains the text column, the margins set the page box, and this group touches only the second. A change to the measure would be a different decision entirely.

## Two hazards this repo has paid for

1. **Never bound a name with `\b` or a bare prefix.** A hyphen is not a word character, and POSIX ERE has no `\b` at all — `grep -E '\b…'` matches nothing and reports success.
2. **A check nobody has watched fail is not a check**, and when watching one fail, isolate *which* failure fires: editing any source makes the generated pages stale, so the checker goes red for an unrelated reason.

## A standing constraint

**Do not push a `v*` tag.** 2.0.0 is deployed but deliberately unreleased until the whole restructure is done; tagging is what publishes the assets, and the owner has withheld it. See the design doc's releasing section.

---

### Task 1: Name the margins in the spec, and make the page box derived

**Files:** `spec.json`, `SPEC.md`

- [ ] **Step 1: Add the six named margins**

`foundation.page` gains a `margins` object naming the three symmetric sizes and their three duplex counterparts, each in millimetres. Symmetric carries one value; duplex carries an inner and an outer. State the rule that ties them — a duplex pair preserves its symmetric total and shifts the gutter by 3mm — so a reader can see the values are derived rather than chosen.

- [ ] **Step 2: Make `standard` the default, and say margins are symmetric unless asked otherwise**

The section's prose currently reads that A4 sits at "25mm head and foot, 28mm on the inside edge and 22mm on the outside … the margins mirror". That describes the opt-in as though it were the default, which is the thing being corrected. Rewrite it: symmetric is what a document gets, duplex is what you ask for when the sheet will be bound.

- [ ] **Step 3: Stop writing down what can be computed**

`text_width_mm: 160` is A4-at-28/22 written as a constant. It is now a function of paper and margin. Either remove it and let consumers derive it, or keep it as a *declared* value for the default and have the checker verify it against the arithmetic. Say which you chose and why — the second is defensible only if something actually checks it.

- [ ] **Step 4: Regenerate and verify nothing else moved**

```bash
node tools/build-spec.mjs
node -e 'const s=require("./spec.json");console.log("measure_mm:",s.foundation.rhythm.measure_mm,"| elements:",s.sections.reduce((n,x)=>n+x.elements.length,0))'
```

Expected: measure still **126**, elements still **102**. A change to either means this task reached past its scope.

- [ ] **Step 5: Commit**

```bash
git add spec.json SPEC.md
git commit -m "feat(spec): name three symmetric margins, and three for duplex binding"
```

---

### Task 2: Recompute the two-column derivation, and gate it

This is the task the group exists for. Do it before either implementation, so both are written against numbers that have been checked.

**Files:** `spec.json`, `tools/check.mjs`

- [ ] **Step 1: Recompute, using the spec's own formula**

`templates.two-column.derivation` carries `characters_per_line = 0.524 × column_mm × (11 / base_pt)` and a table computed for A4 at 28/22. The margins have moved, so the table has too. Recompute it for the new default and replace the declared values.

Use the formula that is already there. Do not substitute an approximation of your own, and do not copy the numbers from this plan — derive them and report what you got.

- [ ] **Step 2: Turn `recompute_when` into something that recomputes**

The spec says "recompute when the page size, the margins or the gutter change" and nothing does. Add a gate: for the declared paper and each named margin, compute the column width and the characters per line, and fail when a combination the spec claims to support falls below the floor.

The failure message must name the paper, the margin, the column width and the character count, so a reader can see the arithmetic rather than just the verdict.

- [ ] **Step 3: Refuse what cannot fit**

Two columns at `wide` on A4 give 43.7 characters. A5 gives 37 at its best. Both must be refused rather than set badly. Decide how the spec expresses that — a supported-combinations list, a minimum paper width, or a derived constraint — and make the gate enforce it.

Prefer the form that keeps working when a paper is added later. A hardcoded "not A5" is a fact about today; a computed floor is a rule.

- [ ] **Step 4: Watch it fail, three ways**

Isolate your own failure message each time, and revert after each:

1. A margin that cannot reach the floor on the declared paper.
2. A paper too narrow to carry two columns at any margin.
3. A character count in the declared table that disagrees with the formula — the drift the gate exists to catch.

The third is the important one: it is the failure that was silently possible for the whole life of this spec.

- [ ] **Step 5: Commit**

```bash
git add spec.json SPEC.md tools/check.mjs
git commit -m "feat(check): recompute the two-column derivation instead of trusting it"
```

---

### Task 3: The CSS implementation

**Files:** `typeset.css`

- [ ] **Step 1: Symmetric by default**

`@page` takes the symmetric `standard` margin. The mirrored `:left`/`:right` rules move behind the duplex opt-in rather than applying unconditionally.

- [ ] **Step 2: The three sizes, and the duplex counterparts**

Six ways to ask, named to match the spec. CSS has no parameters, so these are modifier classes in the `.typeset--*` family — the same family as `--justified` and `--indented`, which are document-level decisions, which this is too.

Check what the existing modifiers are named before you add to them, and follow that pattern rather than inventing a second one.

- [ ] **Step 3: Confirm the measure did not move**

The page box changed; the text column did not. Verify `--ts-measure` is untouched and that a paragraph still sets to 126mm.

- [ ] **Step 4: Commit**

---

### Task 4: The Typst implementation

**Files:** `implementations/typeset.typ`

- [ ] **Step 1: Paper and margin, orthogonal**

`typeset()` takes them separately, so `#show: typeset.with(paper: "a5", margin: narrow)` works without either knowing about the other. The margin values are millimetres and carry across papers unchanged.

- [ ] **Step 2: Six exported constants, values reachable**

Named so a document reads as intent, and exported so `margin: 18mm` still works for a printer that needs it. Follow the file's existing export style.

- [ ] **Step 3: Refuse a combination the spec refuses**

Two columns on a paper and margin that cannot reach the floor must fail at compile time with a message naming the numbers — not render 26-character columns. Typst can `panic()` with a message; use it.

- [ ] **Step 4: Verify against the real compiler**

All three example documents still compile, byte-identical where they do not use a changed feature. **Pin `--creation-timestamp 0`** — Typst embeds a timestamp, so identical source hashes differently between runs without it, and you will otherwise spend an hour explaining a difference that is not there.

Then compile a document at each of the three margins on A4 and on A5, and confirm the page box is what the spec declares.

- [ ] **Step 5: Commit**

---

### Task 5: Span the eight automatically

**Files:** `typeset.css`, `implementations/typeset.typ`, `implementations/example-two-column.typ`, `src/demos/two-column.*`

- [ ] **Step 1: Read what the spec already says**

`templates.two-column.spanning.always` lists eight elements: title block, subtitle, byline, dateline, abstract, heading 1, colophon, bibliography heading. Both implementations currently make the author mark each one — `.ts-span` in CSS, `#span(…)` in Typst — and `example-two-column.typ` calls it by hand.

- [ ] **Step 2: Apply the list, in both**

Under the two-column opt-in, those eight span without being marked. In CSS that is `column-span: all` on the elements themselves; in Typst it is the `place(scope: "parent")` that `span()` already performs, applied by a show rule rather than a call.

`spanning.optional` — figure, table, code block, pull quote — stays manual. The author decides those, and the manual affordance must keep working for them.

- [ ] **Step 3: Take the marks out of the example**

`example-two-column.typ` should stop calling `#span(…)` for anything on the always list. What remains is the document a reader would write.

- [ ] **Step 4: Gate it**

An element on `spanning.always` that does not span under the two-column opt-in is a defect the checker should catch. Add it, and watch it fail by removing one element from the implementation's list.

- [ ] **Step 5: Verify the rendering**

The two-column example must still put those eight across the full width. Compare before and after — the output should be identical, since this changes *how* the spanning is requested, not whether it happens.

- [ ] **Step 6: Commit**

---

### Task 6: Demos, documents, and the prose that describes them

**Files:** `src/demos/*`, `src/sections.json`, `examples/*.html`, `README.md`, `docs/migrating-to-2.0.md`

- [ ] **Step 1: Find every statement of a margin value**

```bash
grep -rnE '\b(2[0-9]|1[0-9]|3[0-9])mm' src/ examples/ README.md docs/ spec.json | grep -v node_modules
```

Every hit is either a value the spec now owns, an argument a sentence is making, or stale. Classify each — the same test as before: *is the value quoted, or used?*

- [ ] **Step 2: The page-setup demo**

`src/demos/page.html` draws a diagram with the margins as percentages and labels them in text. Both must match the new default. The labels are a second copy of a spec value — gate them the way the scale labels are gated, or derive them.

- [ ] **Step 3: The prose**

`src/sections.json`'s page-setup section describes mirrored margins as the default. So does `README.md` if it mentions them. Correct both.

- [ ] **Step 4: The migration note**

`docs/migrating-to-2.0.md` describes what changes between 1.x and 2.0. Margins now change too, and a 1.x document gets a different page. Add it — this is the note's whole purpose, and 2.0 is not released, so it is still one migration rather than two.

- [ ] **Step 5: Rebuild and verify**

```bash
node tools/build-site.mjs && node tools/check.mjs
```

Account for every hunk of the rendered diff. The pages will move — margins change the page box — so the question is not whether they changed but whether each change is one you intended.

- [ ] **Step 6: Commit**

---

### Task 7: Open the pull request

- [ ] **Step 1: Full green from clean**

```bash
node tools/build-site.mjs && node tools/check.mjs && echo GREEN && git status --short
```

- [ ] **Step 2: Confirm the standing invariants**

Measure still 126mm. Elements still 102. Naming gate at zero. Every snippet still compiles. All three example documents still build.

- [ ] **Step 3: Open it**

The description must carry: the six named margins and why duplex preserves the total; that symmetric is now the default and mirrored is asked for; the recomputed two-column table with the formula that produced it; which paper and margin combinations are refused and why, with the character counts; and that the eight spanning elements are now automatic.

**Do not tag.** 2.0.0 stays unreleased until the owner says otherwise.

---

## Self-review

- **Spec coverage.** The design doc's Group 4 asks for named page layouts with symmetric as default (Tasks 1, 3, 4), the letter-page conformance gap recorded in Group 1 (Task 3 — the CSS must now implement a letter's page, which it never did), and the two-column derivation kept honest (Task 2). The owner added the three sizes, the duplex counterparts, any-paper application, and automatic spanning (Tasks 1, 4, 5).
- **Ordering.** The arithmetic is recomputed and gated before either implementation is written against it, so neither can be written against a wrong number.
- **Counts verified on 2026-09-12:** 102 elements, measure 126mm, 14 gates, `templates.two-column.derivation.floor` = 45. Re-derive rather than trusting these.
- **Known limit.** Refusing a combination is not the same as choosing a better one. A document that wants two columns on A5 is told no, not offered a smaller base size. That is the honest answer today; a per-margin two-column scale is a larger change to the derivation and belongs in its own decision.
