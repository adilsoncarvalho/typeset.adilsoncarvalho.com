# Nav Scrollspy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Ticket:** NT-nav-scrollspy

**Goal:** As a reader scrolls the specification, the left nav marks where they
are and brings that entry into view.

---

## What the owner asked for

> Can you make the left side menu bar select and scroll to the selected entry as
> the user scroll the main page with the specifications?

Two behaviours: **select** (mark the current section) and **scroll** (keep that
entry visible in a nav that has its own scrollbar).

## Measured, 2026-09-13

```
spec/index.html      27 nav links with #fragment targets, all resolving
                     10 nav groups
.nav                 position: sticky; top: 0; height: 100vh; overflow-y: auto
specimen.js          23 lines, clipboard copy only — no scroll behaviour at all
```

The nav already scrolls independently, which is why the second half of the ask
is needed: on a long specification the active entry can be off the nav's own
viewport.

## Global constraints

- `v1.0.0` stays the only tag.
- **Progressive enhancement.** The nav works today with no JavaScript; it must
  still work. This adds marking, not navigation.
- `specimen.css` hides `.nav` in print. Nothing here changes that.
- The page carries 78 `tab-*` radio ids that are linkable *state*, not sections.
  Track only the nav's own targets.

---

## Task 1: Mark and reveal

**Files:** `specimen.js`, `specimen.css`, `tools/check.mjs`

- [ ] **Step 1: Choose the active section by reading, not by guessing.** A reader
      is "at" the section whose heading last crossed the top of the viewport.
      `IntersectionObserver` is the mechanism; the detail that matters is the
      root margin, because a naive observer makes a short section flicker
      between two entries.

- [ ] **Step 2: Handle the two ends.** At the very top, `#top` is active. At the
      bottom, the last section must become active even though it may never reach
      the top of the viewport — a document that ends mid-section leaves the last
      nav entry permanently unreachable otherwise.

- [ ] **Step 3: Reveal without yanking.** Scroll the nav only when the active
      entry is not already visible, and by the smallest amount that shows it.
      `scrollIntoView({ block: 'nearest' })` is the shape. A nav that
      re-centres on every section is worse than one that never moves.

- [ ] **Step 4: Do not fight the reader.** If they are scrolling the nav itself,
      leave it alone. Decide how to detect that and say what you chose.

- [ ] **Step 5: `prefers-reduced-motion`.** Smooth scrolling is a motion effect.
      Honour the setting.

- [ ] **Step 6: The marked state must be visible and legible.** `.nav li a` has
      a hover style already; the active state must be distinguishable from hover,
      and must meet contrast against both themes if the site has them.

- [ ] **Step 7: Gate what can be gated.** The nav's targets must all resolve —
      that may already be covered by the link gate this repo gained yesterday;
      check before writing a second one. If the only honest gate is "the script
      parses and the ids match", say so rather than inventing a fake one.

- [ ] **Step 8: Commit.**

---

## Task 2: The pull request

- [ ] Full green. All four builders run. Every snapshotted URL resolves.
- [ ] **Do not tag.**

---

## Self-review

- **Coverage.** Both halves of the ask: select, and scroll-into-view.
- **Known risk.** This is the first behaviour on this site that responds to
  scrolling. It cannot be gated by rendering the way the typographic work was —
  the honest verification is a browser, and the report should say what was
  actually observed rather than what the code implies.
