# An Example For Every Style — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Ticket:** NT-basics-coverage

**Goal:** Every named style in `spec.json` has its own labelled example, or an
explicit written reason why it cannot.

**Architecture:** The coverage gate is built first and fails loudly, listing
every element without an example. That list is the worklist. Sections are then
converted worst-first, and the gate goes quiet as they land.

---

## Why

The owner's words: *"Handhold the user."* A reader who wants to know what an
attribution looks like should see an attribution, labelled, beside the markup
that produced it.

Today 103 elements share about 25 labelled panes. Most sections put every
element they own into a single blob: `inline` shows eleven named styles in one
paragraph, `letter` twelve. A reader cannot tell which part of that paragraph is
`inline-small-caps` and which is `inline-abbr`, and the Typst pane beside it is
one undifferentiated snippet.

## Measured gap, 2026-09-13

```bash
node -e 'const fs=require("fs");const s=JSON.parse(fs.readFileSync("spec.json","utf8"));
for(const sec of s.sections){const f="src/demos/"+sec.id+".html";
const n=fs.existsSync(f)?(fs.readFileSync(f,"utf8").match(/<p class="pair__label"/g)||[]).length:0;
console.log(sec.id, (sec.elements||[]).length, n);}'
```

**103 elements. ~25 labelled panes.** Worst first:

| section | elements | panes |
|---|---|---|
| letter | 12 | 1 |
| inline | 11 | 1 |
| table | 9 | 1 |
| heading | 7 | 1 |
| list | 7 | 1 |
| frontmatter | 7 | 1 |
| utility | 7 | 1 |
| numeral, break, note, toc | 4 each | 1 each |
| link, figure, callout | 3 each | 1 each |
| numbering, dropcap, bibliography | 2 each | 1 each |
| code-inline | 1 | **no demo file at all** |

`quote` (5 elements, 4 panes), `justification` (3, 4) and `paragraph` (2, 2) are
already in the target shape and are the model to copy.

## How a label binds to an element

> **Superseded on the branch.** The design below — match a pane to an element
> by the label's own text — was replaced by an explicit `data-element`
> attribute in `f234bdd` ("bind coverage to an explicit data-element, not
> label text"), because it forced 103 normative `name` fields either to read
> clumsily as labels or to be rewritten to suit a demo file. `tools/check.mjs`
> argues the case at length above its `EXEMPTIONS` map. Task 1 Step 1 below
> states the same superseded rule. Kept as written: this file is the record of
> what was planned, not of what shipped.


`src/extract.mjs` reads `<p class="pair__label">N · Some Name</p>` and strips the
leading ordinal. **The remaining text is the element's `name` field in
`spec.json`** — `quote-epigraph`'s name is "Epigraph" and its label reads
"2 · Epigraph".

So the gate matches on `name`, and a label is not free text: it is the spec's own
word for the thing.

## Global constraints

- `v1.0.0` stays the only tag. No release, no assets.
- Both panes of a section must show the same document — an HTML example with no
  Typst counterpart is half an answer.
- Every new Typst demo compiles under the published boilerplate; gate 3h enforces
  it.
- No exemption without a written reason. The list stays short and visible.

> **Superseded on the branch.** The exemption list this plan produced ran to
> eleven, nine of which rested on one premise — a print or pagination effect
> with nothing to show on a screen — that `src/demos/page.html` and
> `src/demos/link.html` already disproved. A whole-branch review said so, and
> the fix round that followed built panes for nine of the eleven, leaving
> `justification-exclusions` and `table-row`. "No exemption without a written
> reason" turned out to be too weak a constraint: a reason can be written and
> still be untrue. `README.md` now states what a reason may not be.

---

## Task 1: The coverage gate, built to fail

**Files:** `tools/check.mjs`

- [ ] **Step 1: Assert every element has a labelled example.** For each element
      in `spec.json`, its section's demo must carry a `pair__label` whose text,
      ordinal stripped, equals the element's `name`.

- [ ] **Step 2: The exemption list.** Some elements state a prohibition rather
      than a style and cannot be demonstrated alone — `justification-exclusions`
      names what is never justified. Others are a part of another element rather
      than a thing of their own: `quote-attribution` appears inside a block
      quote. Each exemption is a row carrying the element id and a sentence
      saying why. An exemption with no reason is a failure.

- [ ] **Step 3: Let it fail, and keep the output.** Run it. It will name roughly
      78 elements. Paste that list into your report — it is the worklist for
      Tasks 2-6 and the only complete statement of the gap.

- [ ] **Step 4: Gate the gate.** Add an element to `spec.json` with no example
      and confirm it is named. Remove an exemption's reason and confirm that
      fails too. Restore both.

- [ ] **Step 5: Commit,** with the gate failing. This is the one commit in this
      plan that may land red, because it is the worklist. Say so in the message.

---

## Task 2: `inline` and `code-inline`

**Files:** `src/demos/inline.*`, `src/demos/code-inline.*` (create), `src/sections.json`

11 elements in one paragraph, and one section with no demo at all.

- [ ] **Step 1:** One labelled pair per element, in both panes. Read each
      element's properties and notes for what it is *for* — `inline-abbr` carries
      a title attribute, `inline-small-caps` is for named entities.

- [ ] **Step 2:** `code-inline` needs a demo file and a `src/sections.json`
      entry. Its note is worth honouring in the example: ligatures off, because
      "an arrow rendered as one glyph is charming in an editor and wrong in a
      document that quotes source."

- [ ] **Step 3:** Rebuild, check, commit.

---

## Task 3: `letter` and `frontmatter`

**Files:** `src/demos/letter.*`, `src/demos/frontmatter.*`

19 elements between them, 2 panes. These are the two sections whose elements are
most obviously distinct things — a salutation is not a signature — and least
distinguishable in the current demo.

- [ ] One labelled pair per element. Rebuild, check, commit.

---

## Task 4: `table`, `list`, `heading`, `utility`

**Files:** the four demo pairs

30 elements, 4 panes. `utility` is the awkward one: several of its elements are
invisible by nature (`utility-break-before` changes pagination, `utility-print-only`
hides on screen). Show what can be shown, exempt what cannot with a reason, and
do not fake a visual for something that has none.

- [ ] One labelled pair per element or an exemption. Rebuild, check, commit.

---

## Task 5: the remaining sections

**Files:** `numeral`, `break`, `note`, `toc`, `link`, `figure`, `callout`,
`numbering`, `dropcap`, `bibliography` demo pairs

~33 elements. Mechanically the same as Tasks 2-4, smaller each.

- [ ] One labelled pair per element or an exemption. Rebuild, check, commit.

---

## Task 6: Close the gate

- [ ] **Step 1:** The coverage gate passes with no element unaccounted for.
- [ ] **Step 2:** Read the exemption list as a whole. It should be short. If it
      is long, that is the finding — report it rather than accepting it.
- [ ] **Step 3:** Confirm every section's two panes show the same document.
- [ ] **Step 4:** Commit.

---

## Task 7: The pull request

- [ ] Full green from clean. All three examples compile. Both bundles build.
- [ ] The description carries: the before and after counts, the exemption list in
      full with its reasons, and any element whose example required a judgement
      call about what it even looks like.
- [ ] **Do not tag.**

---

## Self-review

- **Coverage.** The owner asked for an example for everything in basic
  typesetting. Task 1 defines "everything" mechanically; Tasks 2-5 supply it;
  Task 6 proves it.
- **Ordering.** The gate first, because it is the worklist and because a gate
  written after the content it checks tends to be written to pass.
- **Counts verified 2026-09-13:** 103 elements, 22 sections, 31 gates, ~25
  labelled panes. Re-derive rather than trusting these.
- **Known risk.** This is the largest content task in the restructure and the
  design doc flags fatigue rather than difficulty as its danger. The gate is what
  stops it being left half-done — which is why it is built first and allowed to
  land red.
