# The Conformance Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Ticket:** NT-conformance-section

**Goal:** The masthead's file list is grouped by type, and every Typst file has a
page where a reader can see the rendered document, read the source, copy it, or
download it.

**Architecture:** Rendered previews are derived artifacts built in CI into a
gitignored directory, exactly as the download bundles already are. No SVG enters
git history.

---

## What the owner asked for

Two things, on 2026-09-13:

> pick a lane: group them by name, or by the type (CSS, or typst)

> for the typst ones, instead of just downloading, create a page that the user
> can visualise them, copy to clipboard or download

He chose **by type**, and **rendered preview plus source** over source alone.

## What is wrong today

The masthead's "Downloadable materials" row reads:

```
spec.json │ SPEC.md │ typeset.css │ typeset.typ + fonts │ iA Writer template
```

Four buttons name a **file**; one names a **product** (`iA Writer template` — the
file is `iawriter.css`); one names a file **plus its bundle** (`typeset.typ +
fonts`). Three lanes in five buttons.

And the asymmetry he is pointing at: `examples/essay.html` lets a reader *see*
the CSS essay. `implementations/example-essay.typ` ships inside a zip with no
page at all — the Typst reader gets a download and a compile command.

## Measured, 2026-09-13

```bash
for f in essay letter two-column; do
  typst compile --font-path fonts --format svg implementations/example-$f.typ "/tmp/$f-{n}.svg"
done
```

| document | pages | SVG |
|---|---|---|
| essay | 2 | 864 KB |
| letter | 1 | 301 KB |
| two-column | 1 | 737 KB |

**1.9 MB total.** That is why previews are not committed: they regenerate from
source on every deploy and would otherwise churn git history on every group that
touches an example.

## Global constraints

- `v1.0.0` stays the only tag. No release, no assets.
- Previews follow `downloads/`: gitignored, built in CI, picked up by the
  existing `rsync` into `_site`.
- `tools/check.mjs` must not require previews to exist — it runs on a pull
  request where they are not built.

---

## Task 1: Render the examples

**Files:** `tools/build-previews.mjs` (create), `.gitignore`, `.github/workflows/deploy.yml`

- [ ] **Step 1: The builder.** Compile each of the three shipped examples to SVG,
      one file per page, into a gitignored `previews/` directory. Derive the list
      from the same place `tools/build-bundle.mjs` derives it, so a fourth example
      cannot appear in one and not the other.

- [ ] **Step 2: Fail loudly on a missing compiler.** `check.mjs` already exits 1
      when `typst` is absent rather than skipping. Match that: a preview build
      that silently produces nothing is how the site ships with broken images.

- [ ] **Step 3: Wire it into CI**, beside the two bundle builds, on the same
      `push`/`workflow_dispatch` condition. `rsync` already carries anything on
      disk into `_site`, so nothing else changes.

- [ ] **Step 4: Gitignore `previews/`,** with the same comment shape
      `downloads/` has — naming the command that rebuilds it.

- [ ] **Step 5: Commit.**

---

## Task 2: A page per Typst file

**Files:** `src/viewers.json`, `src/masthead.html`, `tools/build-site.mjs`, `files/viewer.css`, `files/viewer.js`

Today `src/viewers.json` has five entries and only one is Typst. The three
example documents have no page.

- [ ] **Step 1: Add the three examples** as viewer entries — source, language,
      and a description saying what each document demonstrates.

- [ ] **Step 2: The rendered preview.** A viewer entry that names a preview shows
      the page images above its source. `files/viewer.js` already wires a copy
      button; the download is a plain link to the file itself.

- [ ] **Step 3: Degrade honestly.** On a pull request, and in a local checkout
      that has not run the builder, `previews/` does not exist. The page must say
      so plainly rather than showing a broken image — one line naming the command
      that builds it.

- [ ] **Step 4: Lazy-load.** The essay is two pages and 864 KB. `loading="lazy"`
      on every page image after the first.

- [ ] **Step 5: Commit.**

---

## Task 3: Pick the lane

**Files:** `src/masthead.html`, `specimen.css`

- [ ] **Step 1: Three groups, by type:**

```
The specification     spec.json   SPEC.md   llms.txt
CSS                   typeset.css   iawriter.css
Typst                 typeset.typ   essay   letter   two-column
```

- [ ] **Step 2: Every button names its file.** `iA Writer template` becomes
      `iawriter.css`. `typeset.typ + fonts` becomes `typeset.typ` — the bundle is
      described on the page it leads to, which is where a reader who has decided
      to download is standing.

- [ ] **Step 3: Keep "Live examples" as it is.** It groups by document, not by
      type, and it is the one row where that is right — a reader choosing between
      an essay and a letter is choosing a document.

- [ ] **Step 4: Commit.**

---

## Task 4: Gate it

**Files:** `tools/check.mjs`

- [ ] **Step 1: Every `src/viewers.json` entry resolves** — its `source` exists
      and its `href` points at a real path.

- [ ] **Step 2: The Typst viewer set matches the bundle.** Every `.typ` file
      `build-bundle.mjs` ships has a viewer entry, and every Typst viewer entry is
      in the bundle. A file a reader can see but not download, or download but not
      see, is the defect this closes.

- [ ] **Step 3: The masthead names every viewer.** A viewer page nothing links to
      is unreachable, and nothing today would say so.

- [ ] **Step 4:** Watch each fail. Restore.

- [ ] **Step 5: Commit.**

---

## Task 5: The pull request

- [ ] Full green from clean. Both bundles build, previews build, all three
      examples compile.
- [ ] Confirm the deployed site actually shows the previews — check the built
      `_site` shape or the deploy, not just that the builder ran.
- [ ] **Do not tag.**

---

## Self-review

- **Coverage.** Both of the owner's asks: Task 3 is the lane, Tasks 1-2 are the
  Typst pages. Task 4 stops either regressing.
- **Ordering.** The renderer first, because the viewer pages consume it; the
  regrouping last, because it is the only part a reader sees immediately and it
  should land on top of working pages.
- **Counts verified 2026-09-13:** 5 viewer entries, 3 shipped examples, 4 rendered
  pages, 1.9 MB of SVG, 33 gates. Re-derive rather than trusting these.
- **Known risk.** `build-site.mjs` currently needs no binary. Task 2 must not
  change that — the previews are built by a separate tool, and the site build
  only references them. If a task finds itself adding `typst` to the site build,
  that is the wrong shape and worth reporting.
