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

## What this group must not break

`node tools/check.mjs` passes on `master` today. It must pass at every commit here.
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

- [ ] **Step 2: Confirm the rendered examples never moved**

This group changes panels, adds snippets and adds a boilerplate block. It must not have altered a single demo.

```bash
for f in src/demos/*.html; do
  git diff --quiet master..HEAD -- "$f" || echo "CHANGED: $f"
done
```

Expect no output. A changed demo is a defect unless you can name why.

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
