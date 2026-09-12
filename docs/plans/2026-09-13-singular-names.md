# Singular Names and the Quote API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Ticket:** NT-singular-names

**Goal:** Every section id and element id is singular, across `spec.json`, `typeset.css` and `implementations/typeset.typ`. Quotations get one `#quote(type:)` function instead of four.

**Architecture:** A second rename map, chained after the frozen 1.x map, driving the codemod Group 1 already built. The spec changes first and the implementations follow it, because the naming gate is bidirectional and will not tolerate a half-applied rename.

---

## Why, and why now

The owner asked for it on 2026-09-11: *"let's make them all singular, even if that mean to touch the json spec and the CSS … it is not about fixing something solely for typst, but it is a concept that should be applied across the board."* He then fixed the timing himself: *"when I mentioned later, it is later to this effort we are going through. That means still within 2.0.0 that we will ship."*

So this is a breaking change made **before** 2.0.0 ships, not a 3.0. That only holds while no tagged release exists. `v1.0.0` is still the only tag and must stay that way.

## Measured scope, 2026-09-13

Counts from commands, re-run rather than trusted:

```bash
node -e 'const s=require("./spec.json");const p=s.sections.filter(x=>/s$/.test(x.id));console.log(p.length, p.reduce((n,sec)=>n+(sec.elements||[]).filter(e=>e.id.startsWith(sec.id+"-")).length,0))'
grep -rohE "\b(headings|paragraphs|links|quotes|lists|tables|figures|callouts|breaks|notes|numerals|utilities)-" . --include=*.json --include=*.css --include=*.typ --include=*.html --include=*.md --include=*.mjs | wc -l
```

**12 plural sections, 58 elements, 527 call sites** — 67 in `spec.json`, 94 in `typeset.css`, 15 in `typeset.typ`, 351 across `src/`, `examples/`, `docs/`, `proofs/`.

| plural | singular | elements |
|---|---|---|
| tables | table | 9 |
| headings | heading | 7 |
| lists | list | 7 |
| utilities | utility | 7 |
| quotes | quote | 5 |
| numerals | numeral | 4 |
| breaks | break | 4 |
| notes | note | 4 |
| links | link | 3 |
| figures | figure | 3 |
| callouts | callout | 3 |
| paragraphs | paragraph | 2 |

All twelve. `numerals` and `utilities` name a class rather than a repeated element and read slightly oddly in the singular, but the owner's stated reason was consistency across the board, and a rule with two exceptions is not a rule.

## Global constraints

- `v1.0.0` stays the only tag. No release, no assets.
- `spec.json` is the source of truth; the naming gate is bidirectional, so a rename lands in the spec and both implementations together or the checker goes red.
- Every gate must be watched failing.
- No exemption lists.

---

## Task 1: The second rename map

**Files:** `tools/rename-map-2.0-singular.json` (create), `tools/build-singular-map.mjs` (create), `tools/codemod-names.mjs`

`tools/rename-map.json` is **frozen** at 1.x → 2.0.0 and its own note says it describes spec 1.0.0 ids that `spec.json` no longer carries. Do not edit it. Adding singular rows there would rewrite a 1.x document onto a name that never existed in it, silently breaking the migration path this repo promises.

- [ ] **Step 1: Generate, do not type.** Write `tools/build-singular-map.mjs` that derives every row from the current `spec.json` — for each section id ending in `s`, the singular id, and for each element id carrying that prefix, its rewritten id. A generated map cannot drift from the spec; a typed one can.

- [ ] **Step 2: Refuse an incomplete map.** Group 1's generator shipped a map missing six classes and the failure was silent. Exit non-zero unless every plural section and every element under one has a row. Print what is missing.

- [ ] **Step 3: Chain, do not merge.** `codemod-names.mjs` applies the 1.x map. Extend it to apply the singular map *after*, so a 1.x document migrates through both in one run and a 2.0 document migrates through the second alone. Keep the longest-first ordering and the safe-key assertion already there.

- [ ] **Step 4: Prove the chain on a 1.x fixture.** Take a document written against 1.x names, run the codemod once, and confirm it lands on singular 2.0 names with nothing left in between. Commit the fixture as a test input.

- [ ] **Step 5: Commit.**

---

## Task 2: Rename the spec, and both implementations, in one commit

**Files:** `spec.json`, `typeset.css`, `implementations/typeset.typ`, `tools/check.mjs`

Group 1 learned this the hard way: a section rename split across tasks makes `build-site.mjs` throw, because the section id is a key the builder reads. Spec and implementations move together or not at all.

- [ ] **Step 1: Apply the generated map** to all three files.

- [ ] **Step 2: Watch what the naming gate says.** It is bidirectional — it will tell you about every class or symbol whose spelling no longer matches its element. Work its list to zero rather than guessing what moved.

- [ ] **Step 3: The `IMPLEMENTS` map moves too.** It maps author-facing symbols to element ids; every value is about to change. Its own gate asserts each value is a real element id, so it will catch a missed row.

- [ ] **Step 4: `INTERNAL_SYMBOLS` and the spanning lists.** `TYPST_RENDER_CHECKED`, `TYPST_EXEMPT_CARRIED_BY_TITLE_BLOCK` and `templates.two-column.spanning.always` all carry element ids.

- [ ] **Step 5: Rebuild and commit.** `node tools/build-spec.mjs` then `node tools/build-site.mjs`, that order.

---

## Task 3: Sweep everything else

**Files:** `src/**`, `examples/**`, `proofs/**`, `README.md`, `docs/migrating-to-2.0.md`

- [ ] **Step 1: Run the codemod** over every file outside the three in Task 2.

- [ ] **Step 2: Search the whole tree afterwards**, not a subtree:

```bash
grep -rn --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.superpowers \
  -E "\b(headings|paragraphs|links|quotes|lists|tables|figures|callouts|breaks|notes|numerals|utilities)-" .
```

A search's *scope* has been the defect five times in this project, more often than its pattern. Report the full hit list.

- [ ] **Step 3: `docs/specs/` and `docs/plans/` are point-in-time records.** Do not rewrite them. A plan that said `quotes-epigraph` was correct when written.

- [ ] **Step 4: `docs/migrating-to-2.0.md` is the exception** — it describes the migration and must gain the singular rename, including the full class table. A reader on 1.x now migrates two steps in one.

- [ ] **Step 5: Commit.**

---

## Task 4: One quote function

**Files:** `implementations/typeset.typ`, `spec.json`, `src/demos/quotes.*`, `typeset.css`, `tools/check.mjs`

The owner asked: *"Can we have a function `#quote` that binds to the markdown `>` and assume a default value, but when invoked with the parameter `type`, the user can choose `verse`, `pullquote`, etc?"*

**One premise in that needs correcting, and it was verified against the compiler on 2026-09-13, not assumed.** Typst has no markdown `>` blockquote syntax. `typst query` on a document containing `> a line` returns `[]` — no element of any kind. Typst's own equivalent is the native `quote` element, produced by `#quote[…]`. On the CSS side the binding the owner means does exist, because markdown `>` becomes `<blockquote>`, which the stylesheet already styles.

So: bind to Typst's native `quote`, which is the engine's `>`.

**Shadowing works, and was verified.** Saving the builtin under another name before redefining `quote` compiles, and the default path still produces a real native `quote` element:

```typst
#let _native-quote = quote
#let quote(type: none, attribution: none, body) = { … }
```

- [ ] **Step 1: One function, four behaviours.** `type: none` is the ordinary block quote; `"epigraph"`, `"pullquote"` and `"verse"` select the variants that today are `quotes-epigraph`, `quotes-pullquote` and `quotes-verse`. Read those three functions and preserve exactly what they do.

- [ ] **Step 2: Reject an unknown type loudly.** `#quote(type: "pullqoute")` must panic naming the valid values, not silently fall through to the default. A typo that renders as an ordinary quote is the worst outcome available here.

- [ ] **Step 3: `epigraph-right`.** It exists today as a symbol with no spec element, listed in `INTERNAL_SYMBOLS`. Decide whether it becomes `quote(type: "epigraph", align: right)` or stays. Say why.

- [ ] **Step 4: Keep the old names working, or do not — but decide.** Four functions are disappearing into one. Either leave the three as thin wrappers that call `quote(type:)`, or remove them and rely on the codemod plus the migration note. Removing is cleaner and this is a pre-release breaking change; wrappers are kinder. Pick one, record the reason, and make the migration note say what you picked.

- [ ] **Step 5: Convert the demo** so it shows one function with four calls rather than four functions.

- [ ] **Step 6: Gate it.** The unknown-type panic, and that each `type` produces the styling its element declares. Watch each fail.

- [ ] **Step 7: Commit.**

---

## Task 5: The pull request

- [ ] Full green from clean; all three examples compile; every gate watched failing at least once and listed.
- [ ] Confirm `grep` across the whole tree finds no plural id outside `docs/specs/` and `docs/plans/`.
- [ ] The description carries: the twelve renames, the element count, the chained codemod and why the 1.x map stayed frozen, the `#quote(type:)` API, and the `>` premise correction.
- [ ] **Do not tag.**

---

## Self-review

- **Coverage.** The owner asked for two things — singular everywhere (Tasks 1-3) and one quote function (Task 4). Both are here.
- **Ordering.** The map is generated and proven before anything is renamed; the spec and both implementations move in one commit because the naming gate is bidirectional; everything else follows; the quote API lands last because it is the only part that is not mechanical.
- **Counts verified 2026-09-13:** 12 sections, 58 elements, 527 call sites, 103 elements total, 27 gates. Re-derive rather than trusting these.
- **Known risk.** Task 2 is a large mechanical change gated by a bidirectional checker. If the checker itself carries a plural id in a string literal, it will fail in a way that looks like a rename error. Read its failures carefully before editing the spec back.
