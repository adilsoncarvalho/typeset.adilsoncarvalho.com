# Example Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Jira Ticket:** NT-no-ticket (personal project)

**Goal:** Replace the CSS and Typst *configuration* panels with the *source that produces the example beside them*, in both rendering mechanisms, compile-verified.

**Architecture:** The HTML pane is extracted from the demo file that already renders the example, so it cannot drift from what the reader sees. The Typst pane comes from a new per-section snippet, compiled in CI against `implementations/typeset.typ`. Both panes show a document fragment; the boilerplate that makes a fragment run appears once on the page, not in 26 panels.

**Tech Stack:** Node 22 (no dependencies), `typst` (new CI dependency), the existing `tools/*.mjs` build-and-check scripts.

**Design doc:** `docs/specs/2026-09-11-NT-typeset-restructure-design.md` — Group 2 of five. Group 1 (`feat/named-styles`) is merged; the spec is at 2.0.0 and `node tools/check.mjs` passes.

---

## Decisions already taken — implement exactly these

| Question | Decision |
|---|---|
| What the HTML pane shows | The document fragment only — the markup inside the `.paper` wrapper, no container. |
| Sections with several examples | All of them, each under an HTML comment carrying the same name the rendering uses. |
| CI | `typst` is installed, snippets are compiled, and the workflow gains a `pull_request` trigger so the checker runs before merge rather than after. |
| Tabs | **Spec · HTML · Typst**. |

## Amendment, after reviewing the first panes

The panes exposed something nobody had had to look at before: **the demos were
written as website furniture, not as exemplary documents.** Read as source, they
are full of inline CSS, and several demonstrate their point through a class the
fragment-only rule strips. Shipping them as "source you can copy" would defeat
the group, so the demos are reworked here rather than later.

Five decisions taken with the repo's owner after seeing the panes:

1. **No inline CSS in an example.** Styling comes from classes. Inline CSS stays
   acceptable only in the website's *emulation chrome* — the scaled `.paper`,
   `.mini` sheet and page diagram that exist to show a document on a web page —
   because that is not the document.
2. **Include the container when it carries a modifier.** Six demos put the
   demonstrated thing on the wrapper: `justification`, `paragraphs`, `numbering`,
   `letter`, `two-column`, `notes.fullrow`. Fragment-only loses the point there —
   the justification pane currently shows three *identical* paragraphs under
   three different labels. Rule: include the wrapper when it carries any class
   beyond `paper typeset`; otherwise keep the fragment alone.
3. **Start at the element carrying `typeset`.** `two-column` nests its document
   two levels inside `.mini` page chrome. The pane starts at the `.typeset`
   element and goes inward.
4. **Foundations keep a CSS pane.** `tokens`, `foundation` and `page` illustrate
   the spec rather than demonstrate a document — there is no markup a reader
   would paste, and the values *are* the subject. Those three keep Spec · CSS ·
   Typst; every other section gets Spec · HTML · Typst. The pane kind is
   declared per section in `src/sections.json`, not inferred.
5. **Section breaks become `<hr>`.** It is the semantic element for a thematic
   break and the stylesheet already styles it — `.typeset .ts-breaks-asterism::before`
   at (0,2,1) beats `.typeset hr::before` at (0,1,2), so the variant wins with no
   CSS change. Verified before adopting.

## What this group must not break

`node tools/check.mjs` passes on `master` today. It must pass at every commit here.

**The invariant has changed.** The original plan said no demo may change. Reworking
the demos is now the point, so that is replaced by: **every demo change is
deliberate, enumerated in the task report, and its rendered result verified.** A
demo that changes without being named is still a defect — the protection is now a
list you can check rather than a diff that must be empty.

Group 1 left three standing invariants; a change that moves any of them is a defect:

- The naming gate reports **0 failures** in all its directions.
- Element count **102**, ids unique and matching `<section-id>` or `<section-id>-<leaf>`.
- The generated pages match what the sources produce, byte for byte.

## Two hazards this repo has already proved

Both cost real rework in Group 1. They apply directly here.

1. **Never bound a class or id name with `\b`.** A hyphen is a non-word character, so `ts-toc\b` matches inside `ts-toc-leader`. Use `(?![a-z0-9-])`, or an explicit `[^a-z0-9-]` guard. POSIX ERE has no `\b` at all, so `grep -E '\b…'` matches *nothing* and reports success.
2. **A check nobody has watched fail is not a check.** Every gate this plan adds must be seen to fail on a deliberately injected violation, then reverted. Isolate *which* failure fires — editing any source file makes the generated pages stale, so the checker goes red for an unrelated reason and a naive "does it fail?" reads as a pass.

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/demos/*.html` | Renders each section's example | Unchanged — the extractor reads them as they are |
| `src/demos/*.typ` | The Typst snippet for each section | **Create, 25 files** |
| `src/extract.mjs` | Pulls the document fragment out of a demo file | Create |
| `src/panels.mjs` | Builds the Spec/HTML/Typst panel | Modify — new panes |
| `tools/build-site.mjs` | Generates the pages | Modify — wire the extractor, add the boilerplate block |
| `tools/check.mjs` | The gate | Modify — round-trip gate, snippet-coverage gate, compile gate |
| `src/masthead.html` | Page furniture | Modify — the boilerplate block |
| `specimen.css` | Chrome | Modify — style the boilerplate block |
| `.github/workflows/deploy.yml` | CI | Modify — install `typst`, add `pull_request` |

There are 26 files in `src/demos/` but only 25 sections: `notes.fullrow.html` is a second demo for the `notes` section. Derive the snippet list from `src/sections.json`, not from a directory listing.

---

### Task 1: Extract the document fragment, losslessly

The extractor is the foundation. If it is lossy the HTML pane quietly misrepresents the example, and nothing downstream notices — the pane is generated, so it always looks plausible.

**Files:**
- Create: `src/extract.mjs`
- Modify: `tools/check.mjs` — the round-trip gate

- [ ] **Step 1: Read what you are parsing before you write the parser**

```bash
head -14 src/demos/quotes.html
head -6 src/demos/callouts.html
grep -c 'class="paper' src/demos/*.html | grep -v ':1$'
```

Every example sits inside `<div class="paper typeset">…</div>`, preceded by a `<p class="pair__label">` and sometimes a `<p class="demo-note">`. Most sections have one; `quotes` has four, `justification` three, `paragraphs` and `notes` two. The wrappers contain nested `<div>`s, so finding the closing tag needs a depth count, not a search for the next `</div>`.

- [ ] **Step 2: Write the extractor**

`src/extract.mjs` exports one function taking a demo file's text and returning an array of `{ label, html }`:

- `label` — the text of the `pair__label` immediately preceding the wrapper, with any leading `N · ` ordinal stripped, and `null` where the label is the generic `How it must look` (a single-example section needs no comment).
- `html` — the wrapper's inner markup, dedented by its common indent, trimmed.

Drop `demo-note` paragraphs: they explain the typography to a reader of the page, and are not part of the document.

Depth-count `<div` and `</div>` to find the wrapper's end. Do not use a non-greedy regex to the next `</div>` — the first nested element breaks it.

- [ ] **Step 3: Make the extractor prove itself — the round-trip gate**

An extractor is correct when it is *invertible*. Add to `tools/check.mjs`: for every demo file, re-indent each extracted fragment, wrap it in its `<div class="paper typeset">`, reassemble with the labels and notes in their original positions, and compare against the file on disk. Any difference means the extractor lost or altered something.

Where an exact textual round-trip proves impractical, weaken the comparison to *content* rather than *bytes* — strip whitespace between tags on both sides — and say so in a comment naming what the weakened form no longer catches. Do not silently drop the gate.

- [ ] **Step 4: Watch it fail**

Add a stray attribute to one wrapper's inner markup in a scratch copy, confirm the gate names that file, revert. Run `node tools/check.mjs 2>&1 | grep '✗'` and confirm the round-trip failure is present and distinguishable from the staleness failures.

- [ ] **Step 5: Commit**

```bash
git add src/extract.mjs tools/check.mjs
git commit -m "feat(build): extract a demo's document fragment, invertibly"
```

---

### Task 2: Swap the CSS pane for the HTML pane

**Files:**
- Modify: `src/panels.mjs`, `tools/build-site.mjs`
- Modify: `specimen.css` if the tab labels need width

- [ ] **Step 1: Replace the pane**

In `src/panels.mjs`, the second tab becomes **HTML** and its pane shows the extracted fragments rather than the `typeset.css` marker region. Where a section has several fragments, emit each preceded by an HTML comment naming it:

```html
<!-- Epigraph -->
<blockquote class="ts-quotes-epigraph">
  …
</blockquote>
```

A section with one unlabelled fragment gets no comment.

- [ ] **Step 2: Keep the full stylesheet reachable**

The CSS pane is what a reader used to use to find the rule. Replace that affordance rather than removing it: each section links to its region in `files/typeset-css.html`, which already carries `id="L<n>"` anchors on every line.

`tools/build-site.mjs` knows each section's `@s` marker region. Compute the line number the region starts at and emit a link to `files/typeset-css.html#L<n>`. Derive the number from the file; do not hand-maintain a table.

- [ ] **Step 3: Rebuild and compare the rendered examples**

```bash
node tools/build-site.mjs
```

The rendered column must be untouched — this task changes a *panel*, not a demo. Confirm:

```bash
git show master:index.html > /tmp/before.html
strip() { sed -E 's/class="[^"]*"//g; s/ id="[^"]*"//g; s/<[^>]+>//g' "$1" | tr -s ' \n' ' \n'; }
strip /tmp/before.html > /tmp/a.txt; strip index.html > /tmp/b.txt
diff /tmp/a.txt /tmp/b.txt | head -40
```

Expect the diff to be confined to the panels. Any change in a *demo's* text is a defect — report it.

- [ ] **Step 4: Commit**

```bash
git add src/panels.mjs tools/build-site.mjs specimen.css index.html files
git commit -m "feat(site): show the markup that produces each example"
```

---

### Task 2b: Extraction rules the first pass got wrong

**Files:** `src/extract.mjs`, `src/panels.mjs`, `src/sections.json`, `tools/check.mjs`

- [ ] **Step 1: Per-section pane kind**

Add a field to each entry in `src/sections.json` declaring which second pane it
gets — the markup source, or the CSS region. `tokens`, `foundation` and `page`
take the CSS pane; the other 22 take HTML. Declare it; do not infer it from the
group name, which would break the moment a section moves group.

- [ ] **Step 2: Include the container when it carries a modifier**

The extractor currently returns the wrapper's inner markup. Where the wrapper
carries a class beyond `paper typeset` — `typeset--justified`, `typeset--indented`,
`typeset--numbered`, `typeset--ragged` — that class is the demonstration, and the
pane must include the element. Emit it as `<div class="typeset typeset--justified">`:
drop `paper`, which is website chrome, and keep the rest.

Preserve any other attribute the wrapper carries. `justification.html` sets
`lang="en"`, which is not decoration — hyphenation requires a declared language,
and the section's own prose says so.

- [ ] **Step 3: Start at the element carrying `typeset`**

`two-column` and `notes.fullrow` nest the document inside `.mini` page chrome.
Where the `.paper` wrapper does not itself carry `typeset`, descend to the
element that does and take that. Verify every demo still extracts, and that the
25 unaffected ones produce byte-identical fragments to before.

- [ ] **Step 4: The justification pane must now differ between examples**

It is the proof this task worked. Extract the three fragments and confirm they
are no longer identical. Paste all three into the report.

- [ ] **Step 5: Gate it**

A pane that is supposed to demonstrate a difference must contain one. Add a
check: within a section, no two extracted fragments may be byte-identical. Watch
it fail — revert one wrapper to bare `paper typeset` in a scratch edit, confirm
the check names the section, revert.

---

### Task 2c: Rework the demos so the examples are exemplary

The largest task in the group, and the one that changes rendered output.

**Files:** `src/demos/*.html`, `specimen.css`, `examples/*.html`

- [ ] **Step 1: Enumerate what you are changing, before changing it**

```bash
grep -c 'style="' src/demos/*.html | grep -v ':0$'
grep -rn 'ts-break' src/demos/ examples/
grep -rn 'style="margin-top:0"' src/demos/ examples/
```

Write the list into your report first. Every entry gets a line saying what it
became and why. A demo that changes without appearing on that list is a defect.

- [ ] **Step 2: Inline CSS out of the examples**

For each inline style, decide which it is:

- **Document styling** — must become a class. If no class exists, that is a
  finding: either the spec is missing an element, or the example is
  demonstrating something the stylesheet does not support. `justification.html`'s
  third example uses `style="text-align:justify;text-align-last:left;hyphens:manual"`
  to show justification *without* hyphenation — the mistake the section warns
  about. There is no class for it. Report it and propose one rather than
  inventing a class name unilaterally.
- **Website emulation chrome** — may stay inline, but prefer a class in
  `specimen.css` where one is natural. The page diagram in `page.html` and the
  scale rows and swatches in `tokens.html` are chrome; those two sections no
  longer publish their markup as source, so the bar is readability, not
  pasteability. Move the repeated hardcoded colours onto the existing
  `--ts-*` custom properties: a swatch showing `--ts-ink` should read from it,
  not restate `#1a1a1a`, or the page can disagree with the stylesheet it documents.

- [ ] **Step 3: `margin-top:0` becomes a class**

Three sites: `toc.html`, `bibliography.html`, `notes.fullrow.html`. Each suppresses
the top margin on a heading that opens a demo. That is a chrome concern — the
document would not do it — so the class belongs in `specimen.css`, not in the spec.

- [ ] **Step 4: Section breaks become `<hr>`**

`<div class="ts-break ts-breaks-asterism">` becomes `<hr class="ts-breaks-asterism">`.
Confirmed to render identically before adopting: `.typeset .ts-breaks-asterism::before`
at specificity (0,2,1) beats `.typeset hr::before` at (0,1,2).

Check whether `.ts-break` remains necessary once every break is an `<hr>` — the
base rule already targets `hr`. **Do not remove it if anything still uses it**;
report what you find and leave the removal to a decision, since it is a second
change to the class surface so soon after 2.0.0.

- [ ] **Step 5: The verse fragment**

`.ts-quotes-verse` uses `white-space: pre-line`, so its content sits at column 0
while its tag sits at 8, and the common indent degrades to 0 — the same shape as
the `codeblock` bug, one layer deeper, because the mask only knows `<pre>` tags.

Fix the mask to cover elements whose CSS makes whitespace significant, or fix the
demo so it does not depend on source indentation. Say which you chose and why.
The `<pre>`-interior gate from Task 1 is the model: whatever you change, the
verse content must still match its source verbatim.

- [ ] **Step 6: Verify the rendered result, not just the source**

This task changes rendered output. For each changed demo, state what moved and
confirm it is equivalent or better. Where a change is meant to be invisible — the
`<hr>` swap, the `margin-top` class — prove it by comparing computed effect, not
by asserting it.

Rebuild, run the checker, and re-run Task 1's three extractor gates.

---

### Task 3: The Typst snippet harness, the gates, and CI

Build the machinery before writing 25 snippets, so each one is verified the moment it lands rather than all of them at the end.

**Files:**
- Create: `src/demos/tokens.typ` — one snippet, as the pilot
- Modify: `tools/check.mjs`, `.github/workflows/deploy.yml`

- [ ] **Step 1: Decide and record the harness**

A snippet is a *fragment*, matching the HTML decision — no import, no `#show`. To compile it, the checker wraps it:

```typst
#import "../../implementations/typeset.typ": *
#show: typeset
<the snippet>
```

Write the harness once in `tools/check.mjs`. Compile to a temporary file; do not leave PDFs in the tree. Check `typst` is on `PATH` and **fail with a clear message if it is not** — a silently skipped compile check is worse than none.

- [ ] **Step 2: Write one snippet, `src/demos/tokens.typ`**

Pick the simplest section first to shake out the harness. The snippet must produce what the HTML example produces — read `src/demos/tokens.html` and write the Typst that renders the same thing.

**Take values from `spec.json` and `implementations/typeset.typ`, never from this plan.** Group 1 shipped four briefs whose inline values were wrong; the implementations are the source of truth.

- [ ] **Step 3: Add the compile gate, and watch it fail**

Every `src/demos/*.typ` compiles under the harness. Prove it: introduce `#undefined-symbol()` into the pilot snippet, confirm the gate names the file and the error, revert.

- [ ] **Step 4: Add the coverage gate, and watch it fail**

Every section in `src/sections.json` must have a snippet. Since only one exists, this gate starts red listing 24 sections — that is correct, and Task 4 drives it green. Commit it red, exactly as the naming gate was committed red in Group 1.

Note `notes.fullrow.html` is a second demo for one section: the gate keys on section ids, not filenames.

- [ ] **Step 5: CI**

In `.github/workflows/deploy.yml`:
- Install `typst` before the check step, pinned to an exact version — an unpinned compiler means a snippet can start failing because the toolchain moved.
- Add a `pull_request` trigger so the checker runs before merge. The build and deploy jobs must stay on `push` only: guard them so a pull request runs the check and nothing else. Getting this wrong either skips the gate or attempts a deploy from a PR.

- [ ] **Step 6: Commit**

```bash
git add src/demos/tokens.typ tools/check.mjs .github/workflows/deploy.yml
git commit -m "feat(check): compile every Typst snippet, and gate PRs on the checker"
```

---

### Task 4: Write the remaining Typst snippets

The bulk of the group. The coverage gate from Task 3 is the work queue and it shrinks visibly.

**Files:**
- Create: `src/demos/<id>.typ` for every section still listed by the gate

- [ ] **Step 1: Take the queue from the gate, not from a list in this plan**

```bash
node tools/check.mjs 2>&1 | grep 'no Typst snippet' | sed 's/.*section "\([a-z0-9-]*\)".*/\1/'
```

- [ ] **Step 2: For each, read three things before writing**

1. `src/demos/<id>.html` — what the example actually shows.
2. The section's elements in `spec.json` — what the styles are called and what they declare.
3. The matching region of `implementations/typeset.typ` — what the Typst implementation actually provides.

The snippet renders the same document as the HTML demo. Where Typst reaches a style through a native element and a show rule, use the native element — the point is what a reader would type, not a demonstration of the library's API.

**Where the Typst implementation cannot express what the HTML example shows, do not fake it.** Write the snippet for what Typst does provide and report the gap: that is a real finding about the two implementations diverging, and this group exists partly to surface exactly that. Group 1 found one such gap (`typeset.css` does not implement the letter page at all); there may be more in the other direction.

- [ ] **Step 3: Compile as you go**

```bash
node tools/check.mjs 2>&1 | grep -E 'no Typst snippet|does not compile' | wc -l
```

Watch it fall. Do not batch 24 files and compile once.

- [ ] **Step 4: Commit in batches by section group**

Commit per group from `src/sections.json` — Foundations, Structure, Prose, Blocks, Apparatus, Documents — rather than one commit of 24 files or 24 commits of one. Message: `feat(demos): add the Typst snippet for the <group> sections`.

- [ ] **Step 5: The gate goes green**

```bash
node tools/check.mjs
```

Expect zero snippet failures. Report any section where the Typst snippet and the HTML example render meaningfully different documents.

---

### Task 4b: Show the snippets, and unblock the two they route around

Two gaps, one blocking the other.

**The plan never wired the Typst pane to the snippets.** Task 2 wired the HTML
pane; nothing wired Typst. `src/panels.mjs:183` still builds that pane from
`typMap` — the `@s` marker regions of `implementations/typeset.typ` — so 24
snippets exist, compile, and are gated, but no reader sees one.

**And two of them route around broken library functions**, which a pane teaching
"what you would write" must not do:

- `toc()` **does not compile**: `outline(fill:)` moved to `outline.entry` in
  Typst 0.14. Verified: `error: unexpected argument: fill` at
  `implementations/typeset.typ:583`. Nothing had ever called it, so no gate saw it.
- `typeset(numbered: true)` is **dead**: its `set heading(numbering:)` sits inside
  an `if` block, so it never applies. Verified with
  `typst query … 'heading' --field numbering` → `[null,null]`.

`src/demos/toc.typ` and `src/demos/numbering.typ` each inline the working
equivalent. That is correct output from a broken library, and the wrong thing to
publish as an example.

**Files:** `src/panels.mjs`, `tools/build-site.mjs`, `implementations/typeset.typ`,
`src/demos/toc.typ`, `src/demos/numbering.typ`, `tools/check.mjs`

- [ ] **Step 1: Fix the two functions**

`toc()` — move `fill` onto `outline.entry`, matching what the snippet already
proves works. `typeset(numbered:)` — lift the `set` out of the `if` so the
parameter reaches the document.

Both are small. Neither changes a value the spec declares: `spec.json`'s
`numbering` section states the format, and the fix makes the implementation
honour it rather than altering it.

- [ ] **Step 2: Prove each fix, and that nothing else moved**

Compile a document calling `toc()`; it must produce an outline with dot leaders.
Compile one with `typeset.with(numbered: true)`; `typst query` must report the
numbering rather than `null`. Then recompile all three example documents and
confirm they are byte-identical — neither fix may disturb a document that did
not use the broken path.

- [ ] **Step 3: Simplify the two snippets to use the API**

They should now show `#toc()` and `typeset.with(numbered: true)` — what a reader
would actually write. Both must still compile under the gate.

- [ ] **Step 4: Wire the pane**

`renderPanel` takes the snippet for the section and shows it, the way the HTML
pane takes its fragments. Keep the marker-region fallback only where a section
genuinely has no snippet — and since the coverage gate now requires one for every
section, say whether that fallback is still reachable. If it is dead, remove it.

- [ ] **Step 5: The full source stays reachable**

The Typst pane was the way to find the implementation, as the CSS pane was. Give
each section a deep link into `files/typeset-typ.html`, derived from the file the
way Task 2 derived the CSS links. Do not hand-maintain line numbers.

- [ ] **Step 6: Rebuild and verify**

The rendered example column must not move. The Typst pane of every section must
now show that section's snippet. Quote three.

---

### Task 5: The boilerplate, once

**Files:**
- Modify: `src/masthead.html`, `specimen.css`, `tools/build-site.mjs`

- [ ] **Step 1: Write the block**

One block on the page, above the sections, saying what a reader must add around any snippet to make it run:

- **HTML** — link `typeset.css`, put the fragment inside an element with `class="typeset"`, and load the three font families. Point at `files/typeset-css.html` for the stylesheet and `fonts/` for the faces.
- **Typst** — the `#import` and `#show` lines, in the parenthesised form. A bare `#import "…": a, b,` list does **not** continue onto a second line: it parses, silently drops every name after the first line, and fails later at the call site with a misleading hint. Copy the working form from the top of `implementations/typeset.typ`.

- [ ] **Step 2: Verify both, by running them — not by reading them**

- Build a scratch HTML file: the boilerplate plus one snippet copied from a panel. Open it and confirm it renders styled, or at minimum confirm the stylesheet link resolves and the class matches a real selector.
- Build a scratch `.typ`: the boilerplate plus one snippet. `typst compile --font-path fonts`. It must build.

Delete both scratch files. Paste both commands and their results into your report. This repo has already shipped one copy-pasteable snippet that could not run.

- [ ] **Step 3: Commit**

```bash
git add src/masthead.html specimen.css tools/build-site.mjs index.html files
git commit -m "docs(site): state the boilerplate once, not in every panel"
```

---

### Task 6: Rebuild, verify, open the PR

- [ ] **Step 1: Full green from clean**

```bash
node tools/build-site.mjs && node tools/check.mjs && echo GREEN
git status --short
```

`GREEN` and an empty status. A modified `index.html` here means the committed page is stale.

- [ ] **Step 2: Account for every demo the group changed**

The amendment above reworks the demos rather than freezing them, so this is no
longer a "no output" check. List what moved and name the decision behind each
one:

```bash
for f in src/demos/*.html; do
  git diff --quiet master..HEAD -- "$f" || echo "CHANGED: $f"
done
```

Every file listed must trace to one of the amendment's five decisions, to a
defect the group fixed in the demo itself, or to a pane carrying this website's
furniture into markup a reader copies. A change that traces to none of those is
a defect.

- [ ] **Step 3: Confirm Group 1's invariants still hold**

Naming gate 0 failures; element count 102; all three Typst examples compile.

- [ ] **Step 4: Open the PR**

Use the `sdlc-tools:create-pr` skill. The description must carry:

- What the tabs show now and why the configuration panes went.
- That the HTML pane is extracted from the demo that renders the example, so it cannot drift.
- That every Typst snippet is compile-verified in CI, and that compiling proves a snippet *runs* — not that it renders the same document as the HTML example. State that limit plainly rather than implying parity.
- Any implementation gap Task 4 surfaced.
- That the workflow now runs the checker on pull requests.

---

## Self-review

- **Spec coverage.** Design doc Group 2 asks for: the HTML pane extracted with chrome stripped (Task 1, 2), per-section Typst snippets (Tasks 3, 4), boilerplate shown once (Task 5), `typst` in CI compiling every snippet (Task 3), and deep links to the full source so the configuration stays reachable (Task 2 Step 2). All covered.
- **Ordering.** The extractor is proved invertible before anything consumes it; the compile and coverage gates land before the 24 snippets they verify, so each is checked as it arrives rather than in a lump at the end.
- **Counts stated.** 25 sections in `src/sections.json`, 26 files in `src/demos/` — the extra is `notes.fullrow.html`, a second demo for one section. Both verified against the tree on 2026-09-11; re-derive rather than trusting them.
- **Known limit carried forward.** A compiled snippet is not a snippet verified to render the same document as its HTML sibling. Nothing in this repo can check that today. It is stated in the PR rather than left implied.
