# The Templates Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Ticket:** NT-templates-split

**Goal:** A reader landing on `/` can tell in one screen whether they want a
specification or a template. A template consumes a published artifact rather than
its neighbour's source.

**Architecture:** The boundary comes first, because it is the part that decides
whether the split is real. The paths follow it.

---

## What the design doc asks for

> **Boundary.** `src/templates/` becomes self-contained. The template builds
> consume the built bundle in `downloads/` rather than reaching into
> `typeset.css` and `fonts/` directly. This is the change that matters: once a
> template consumes a published artifact rather than its neighbour's source,
> extracting `/templates/` into its own repository is a rename rather than a
> redesign.

## The finding that changes the shape, measured 2026-09-13

**There is no published CSS artifact for a template to consume.** `downloads/`
holds exactly two things after a full build:

```
typeset-typst.zip            the Typst implementation + the three spec families
typeset-letter.iatemplate.zip  the iA Writer template itself
```

`tools/build-iawriter.mjs` reads `spec.json`, **`typeset.css`**, its own
`iawriter.css`, and the letter's files — and copies fonts out of `fonts/`. So the
instruction "consume the built bundle" names an artifact that does not exist.

That reorders the work: the CSS distribution has to exist before anything can
consume it.

## What is already right, and must not be broken

`fonts/README.md` states the boundary the design doc wants, and the letter
already observes it: Cormorant Garamond is **not** part of the specification, it
exists for the iA Writer letter's display quote and letterhead, it is bound in
that template's own `page.css`, and it ships only in that template's bundle. The
three spec families are the only ones `typeset.css` and `typeset.typ` name.

A template with typographic choices of its own is a template working correctly.
Do not "fix" Cormorant into the spec, and do not let the split strand it.

## Global constraints

- `v1.0.0` stays the only tag. No release, no assets.
- Old URLs keep working. This site is linked from `llms.txt` and from a GitHub
  release; a split that 404s an anchor is a regression whatever it tidies.
- `previews/` and `downloads/` are gitignored, built in CI, carried by the
  existing `rsync`. A third artifact follows the same pattern.

---

## Task 1: Publish the CSS distribution

**Files:** `tools/build-css-bundle.mjs` (create), `.gitignore`, `.github/workflows/deploy.yml`, `tools/check.mjs`

- [ ] **Step 1:** A bundle carrying `typeset.css` and the three spec font
      families, with their OFL files — the CSS counterpart of what
      `build-bundle.mjs` already does for Typst. Read that one first; this is its
      sibling, not a new idea.

- [ ] **Step 2:** Derive its contents from the same place the Typst bundle
      derives its own. `src/examples.mjs` is the precedent for a single list read
      by several tools — if the font families are hardcoded in more than one
      place, that is a finding and it belongs in this task.

- [ ] **Step 3: Wire it into CI** beside the other three builders, on the same
      condition, and gitignore its output.

- [ ] **Step 4: Gate it** — the bundle contains every family `spec.json` names,
      each with its licence. Watch it fail.

- [ ] **Step 5: Commit.**

---

## Task 2: The template consumes it

**Files:** `tools/build-iawriter.mjs`, `tools/check.mjs`

- [ ] **Step 1:** `build-iawriter.mjs` takes `typeset.css` and the spec fonts
      from the published CSS bundle rather than from the repository root.

- [ ] **Step 2:** Its own additions — `iawriter.css`, `page.css`, Cormorant —
      keep coming from the template's own directory. That is the line: the
      template owns what is its, and consumes what is the spec's.

- [ ] **Step 3: Prove the boundary.** The built `.iatemplate` must be
      byte-identical to what it was before, or the difference must be explained.
      This is a change of *where* a file comes from, not of what ships.

- [ ] **Step 4: Gate it.** A template build that reads `typeset.css` or `fonts/`
      directly should fail — that is the invariant this whole group exists for,
      and without a gate it regresses the first time someone finds the direct
      path shorter.

- [ ] **Step 5: Commit.**

---

## Task 3: The paths

**Files:** `src/**`, `tools/build-site.mjs`, new redirect stubs

- [ ] **Step 1:** `/spec/` carries the specification and the specimen page.
      `/templates/` carries the templates and the capability matrix. `/` becomes
      a small router.

- [ ] **Step 2: Old anchors redirect.** Enumerate what currently resolves —
      `index.html` and every `#section` on it, `files/*.html`, `examples/*.html`,
      `proofs/`, `downloads/` — and make each keep working. A list derived from
      the tree, not from memory.

- [ ] **Step 3: Gate the redirects.** Every path that resolved before must still
      resolve. This is the gate the group is most likely to need later and least
      likely to be given, because the split looks finished once the new pages
      exist.

- [ ] **Step 4: Commit.**

---

## Task 4: The capability matrix

**Files:** the templates page

- [ ] Publish it, from the design doc's own table: full spec vocabulary,
      paginated two columns, running head and folio, true page-foot footnotes,
      across CSS+Paged.js, Typst and iA Writer.

- [ ] Each cell states what the technology can express, and a "no" says why in
      the same breath — "Paged.js cannot fragment a column flow" teaches; "no"
      does not.

- [ ] Derive what can be derived from `spec.json` rather than restating it.

---

## Task 5: The pull request

- [ ] Full green. Three examples compile, all four builders run, every old path
      resolves.
- [ ] **Do not tag.**

---

## Self-review

- **Coverage.** The design doc's three parts: boundary (Tasks 1-2), paths (Task
  3), matrix (Task 4).
- **Ordering.** The artifact must exist before a template can consume it, and the
  boundary must hold before the paths move — otherwise the split is cosmetic.
- **Counts verified 2026-09-13:** 2 artifacts in `downloads/`, 4 builders, 24
  gates, 3 spec font families plus Cormorant for the letter alone.
- **Known risk.** Task 3 moves every URL this site has. The redirect gate is the
  only thing standing between a tidy structure and a site whose inbound links
  are dead.

---

## Outcome, measured 2026-09-13

**The artifact boundary landed. The repository boundary did not.**

The design doc's claim — "once a template consumes a published artifact rather
than its neighbour's source, extracting `/templates/` into its own repository is
a rename rather than a redesign" — is half met, and the half that is met is the
half that mattered to do first.

What holds: `tools/build-iawriter.mjs` unpacks `downloads/typeset-css.zip` and
resolves every read of `typeset.css` and of a spec font family inside it. The
fallback chain puts the bundle last, so a template-local file always wins.
`tools/check.mjs` section 25 holds the bundle's contents and section 26 holds the
boundary itself, by calling `src/fonts.mjs`'s resolver and asserting which side
of the bundle each family lands on — both on a pull request, where neither
builder runs.

What still reaches across, and would have to move or be republished before
`/templates/` could be extracted:

| Reaches for | For what | Can the bundle answer it? |
|---|---|---|
| `spec.json` | the `Info.plist` version check, `spec.canonical_url` and the `README.txt` header, the `foundation.fonts` family assertion | the version and the canonical URL are in `BUNDLE.txt` as prose; the family list is not published in any machine-readable form |
| `fonts/manifest.json` | `resolveFontDir()` — the role lookup that *is* the boundary | no |
| `fonts/Cormorant-Garamond/` | the letter's own display-quote and letterhead face | no, and correctly so: it is not the specification's. It belongs under `implementations/iawriter/`, not in the spec's font tree |
| `tools/build-site.mjs`, `specimen.css`, `src/masthead.html` | `/templates/` is generated by the same builder, `shell()` and `relocate()` as `/spec/` | n/a — structural |
| `src/viewers.json` | the template's own prose lives on the spec side, on a page under `files/` | n/a — structural |
| `files/typeset-{css,typ}.html#L<n>` | six capability-matrix links, whose line numbers are derived from `typeset.css` and `typeset.typ` | n/a — they cannot survive the move; they would become absolute cross-repo URLs with hardcoded line numbers, or be dropped |

The first three are cheap to close and worth doing before any extraction is
attempted: publish the spec family list and the version in the CSS bundle in a
machine-readable form beside `BUNDLE.txt`, and move `fonts/Cormorant-Garamond/`
under `implementations/iawriter/`. The last three are a redesign, not a rename.

**Owner: Adilson Carvalho.** Nothing here blocks this branch; all six are
recorded so that the next attempt at the extraction starts from what is true
rather than from the design doc's promise.

Also carried forward: the link gate checks paths and not fragments
(`tools/check.mjs` section 29 still does `url.split('#')[0]`). Deleting that
split would surface the nine table-of-contents demo anchors that point at
invented chapters, which want excusing by id — a decision about specimen
content, not a mechanical change.
