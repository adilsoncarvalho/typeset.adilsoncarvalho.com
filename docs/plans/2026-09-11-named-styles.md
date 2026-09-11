# Named Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Jira Ticket:** NT-no-ticket (personal project)

**Goal:** Give every style in the spec one canonical name, carried identically into `typeset.css` and `implementations/typeset.typ`, and make `tools/check.mjs` fail the build when the three disagree.

**Architecture:** `spec.json` element ids become the canonical names, normalised to `<section-id>-<leaf>`. The CSS class is always `.ts-<element-id>` and the Typst symbol is always `<element-id>`, both derived rather than chosen — so a new naming gate in `tools/check.mjs` can verify the mapping in both directions. A frozen `tools/rename-map.json` records the old→new table and drives a codemod for documents written against the old names.

**Tech Stack:** Node 22 (no dependencies), plain CSS, Typst, the existing `tools/*.mjs` build-and-check scripts.

**Design doc:** `docs/specs/2026-09-11-NT-typeset-restructure-design.md` — this is Group 1 of five.

---

## Naming rules (settled — implement exactly these)

1. **Element id** is `<section-id>-<leaf>`. The section id is used verbatim: `headings-h1`, `utilities-tie`, `frontmatter-byline`.
2. **A leading leaf token that merely restates the section is dropped.** `util-tie` in section `utilities` is `utilities-tie`, not `utilities-util-tie`.
3. **The principal element of a section** — the one whose id equals the section id — keeps the bare section id: `dropcap`, `codeblock`, `code-inline`.
4. **Five leaves need a word rather than a truncation**, because the old id restates the section in a form no prefix rule catches:

   | Section | Old element id | Leaf |
   |---|---|---|
   | `paragraphs` | `paragraph` | `spaced` |
   | `justification` | `ragged-prose` | `ragged` |
   | `justification` | `justified-prose` | `justified` |
   | `justification` | `justified-exclusions` | `exclusions` |
   | `letter` | `letterhead` | `sender` |

5. **One section id is itself wrong and is fixed in this pass:** `figures-numeric` → `numerals`. It describes numerals, not figures, and collides with the `figures` section.
6. **Three mild stutters are kept rather than special-cased:** `tables-table`, `figures-figure`, `callouts-callout`. These are the section's principal element where the section id is plural. They are the three least likely to be typed, because the bare element selector already covers them.
7. **CSS class** = `.ts-<element-id>`. **Typst symbol** = `<element-id>`. No exceptions.
8. **Bare semantic selectors keep working.** `<blockquote>` inside `.typeset` still styles itself. The class is a name and a handle, not a requirement.
9. **Document modifiers are out of scope.** All nine `.typeset--*` classes stay exactly as they are.

## What is not a simple rename

Six items need a decision encoded, not just a substitution. Each has its own task.

- **`.ts-label` is four different styles sharing one hook.** Splits into four named classes carrying what differs, over a shared `.ts-label` base carrying what they have in common.
- **`.ts-nowrap` and `.ts-tie` are byte-identical declarations.** Collapse to `.ts-utilities-tie`; `.ts-nowrap` is dropped and mapped in the codemod.
- **`.ts-page-break-avoid` is a near-duplicate of `.ts-keep-together`** (`break-inside: avoid` against the same plus `page-break-inside: avoid`). Collapse to `.ts-utilities-keep-together`.
- **`.ts-bare`** (a link opting out of its printed URL) has no spec element. Promote to `links-bare`.
- **`.ts-leader`** (the TOC dot leader) has no spec element. Promote to `toc-leader`.
- **`break-scene(kind: "asterism")`** is one Typst function behind four named styles. Split into four symbols.

## File structure

| File | Responsibility | Change |
|---|---|---|
| `spec.json` | Normative source; element ids are the canonical names | Modify — 81 ids, one section id, 6 new elements, version to `2.0.0` |
| `tools/build-rename-map.mjs` | Derives the old→new table once, from the rules above | Create |
| `tools/rename-map.json` | The frozen table. Read by the codemod and the checker's deprecation gate | Create (generated, committed) |
| `tools/codemod-names.mjs` | Rewrites old class names and Typst symbols in a file | Create |
| `tools/check.mjs` | Build gate | Modify — add the bidirectional naming gate |
| `src/panels.mjs` | Build-time panel rendering | Modify — the `TYPST_ELSEWHERE` map keys on section ids |
| `typeset.css` | CSS implementation | Modify — 57 classes renamed, 2 pairs collapsed, 6 added, ~73 `@style` markers |
| `implementations/typeset.typ` | Typst implementation | Modify — symbols renamed, `break-scene` split |
| `SPEC.md` | Generated prose | Regenerate |
| 35 consumer files | Documents, furniture, tooling that name classes | Modify — via codemod, then verified by hand |

Re-derive the consumer list before starting; it moves:

```sh
git grep -lE 'ts-[a-z0-9-]+' | grep -v -e '^index.html$' -e '^files/' -e '^typeset.css$' -e '^docs/'
git grep -lE '(epigraph|pullquote|verse|callout|break-scene|dropcap|sidenote)' -- '*.typ'
```

---

### Task 1: Derive and freeze the rename map

**Files:**
- Create: `tools/build-rename-map.mjs`
- Create: `tools/rename-map.json` (generated by the above, committed)

- [ ] **Step 1: Write the generator**

`tools/build-rename-map.mjs`:

```js
/* Derives the old -> new element-id table for the 2.0.0 rename, from the
   naming rules in docs/plans/2026-09-11-named-styles.md. Run once; the output
   is committed and then frozen, because it must keep describing 1.x even after
   spec.json has moved on.

   Run: node tools/build-rename-map.mjs > tools/rename-map.json
*/

import { readFileSync } from 'node:fs';

const spec = JSON.parse(readFileSync('spec.json', 'utf8'));

/* Rule 5: one section id is itself wrong. */
const SECTION_RENAME = { 'figures-numeric': 'numerals' };

/* Rule 4: leaves that need a word rather than a truncation. */
const LEAF = {
  'paragraphs/paragraph': 'spaced',
  'justification/ragged-prose': 'ragged',
  'justification/justified-prose': 'justified',
  'justification/justified-exclusions': 'exclusions',
  'letter/letterhead': 'sender',
};

/* Rule 2: drop a leading leaf token that merely restates the section. */
function stripStutter(secId, leaf) {
  const tokens = leaf.split('-');
  const head = tokens[0];
  if (tokens.length > 1 && (secId.startsWith(head) || head.startsWith(secId.replace(/s$/, ''))))
    return tokens.slice(1).join('-');
  return leaf;
}

export function newId(secId, elId) {
  const target = SECTION_RENAME[secId] ?? secId;
  const override = LEAF[`${secId}/${elId}`];
  if (override) return `${target}-${override}`;
  if (elId === secId) return target;                       // rule 3
  let leaf = elId.startsWith(target + '-') ? elId.slice(target.length + 1) : elId;
  leaf = stripStutter(target, leaf);
  return leaf ? `${target}-${leaf}` : target;
}

/* Classes that never had a spec element, and the two pairs that collapse. */
const EXTRA_CLASSES = {
  'ts-bare': 'ts-links-bare',
  'ts-leader': 'ts-toc-leader',
  'ts-nowrap': 'ts-utilities-tie',
  'ts-page-break-avoid': 'ts-utilities-keep-together',
  'ts-num': 'ts-tables-cell-numeric',
  'ts-lede': 'ts-dropcap-lede',
  'ts-note': 'ts-notes-footnote',
  'ts-noteref': 'ts-notes-marker',
  'ts-titleblock': 'ts-frontmatter-title-block',
  'ts-ps': 'ts-letter-postscript',
  'ts-sc': 'ts-inline-small-caps',
  'ts-date': 'ts-letter-date',
  'ts-address': 'ts-letter-address-block',
  'ts-toc': 'ts-toc-entry',
  'ts-toc-2': 'ts-toc-entry-2',
  'ts-run-in': 'ts-headings-run-in',
  'ts-frac': 'ts-numerals-fractions',
  'ts-nums-oldstyle': 'ts-numerals-prose',
  'ts-nums-lining': 'ts-numerals-display',
  'ts-nums-tabular': 'ts-numerals-tabular',
  'ts-callout--warning': 'ts-callouts-warning',
  'ts-break--asterism': 'ts-breaks-asterism',
  'ts-break--fleuron': 'ts-breaks-fleuron',
  'ts-break--rule': 'ts-breaks-rule',
  /* ts-break is deliberately absent. It means the shared base in the
     stylesheet and three asterisks in a document, so any single mapping
     corrupts one of the two. Both are migrated by hand — Task 5 Step 4
     and Task 7 Step 3. */
};

const elements = {};
for (const sec of spec.sections)
  for (const el of sec.elements) elements[el.id] = newId(sec.id, el.id);

const classes = { ...EXTRA_CLASSES };
for (const [oldId, nid] of Object.entries(elements)) {
  const oldClass = `ts-${oldId}`;
  if (!(oldClass in classes)) classes[oldClass] = `ts-${nid}`;
}

console.log(JSON.stringify({
  note: 'Frozen at the 1.x -> 2.0.0 rename. Describes spec 1.0.0 ids, which no '
    + 'longer exist in spec.json. Do not regenerate against a later spec.',
  sections: SECTION_RENAME,
  elements,
  classes,
}, null, 2));
```

- [ ] **Step 2: Generate and eyeball the table**

```bash
node tools/build-rename-map.mjs > tools/rename-map.json
node -e "const m=require('./tools/rename-map.json');
  const v=Object.values(m.elements);
  console.log('elements', v.length, '| changed', Object.entries(m.elements).filter(([k,n])=>k!==n).length);
  const d=v.filter((x,i)=>v.indexOf(x)!==i);
  console.log('collisions:', d.length?d:'none');"
```

Expected: `elements 95 | changed 81` and `collisions: none`.

- [ ] **Step 3: Assert the invariant the rest of the plan depends on**

Any collision means two styles would share a class. Stop and resolve before continuing — do not proceed past a non-empty collision list.

- [ ] **Step 4: Commit**

```bash
git add tools/build-rename-map.mjs tools/rename-map.json
git commit -m "chore(tools): derive the 2.0.0 style-name rename map"
```

---

### Task 2: Add the naming gate to the checker, and watch it fail

The gate is the test for this whole branch. It goes in first, red, and everything after it drives the gate green.

**Files:**
- Modify: `tools/check.mjs` — append a new numbered section before the summary

- [ ] **Step 1: Add the gate**

Append to `tools/check.mjs`, before the block that counts elements and prints the summary:

```js
/* ---- N. Every named style is findable in the stylesheet by its name ------ */

/* The contract: a style is named either by a .ts-<id> class, or by a
   /* @style <id> *\/ marker comment above the rule that implements it.

   Not every element can carry a class. 73 of them are styled through a bare
   semantic selector (h1, strong, sub), and a few describe a rule rather than
   a selector at all: justification-exclusions says what is never justified,
   numbering-h2 is counter-generated content with no element to mark. Rule 8
   says a class is a name and a handle, not a requirement — so the gate checks
   that the canonical name is *present where a reader editing that rule will
   see it*, not that a class exists.

   Both directions are checked: an element with neither class nor marker
   fails, and a class or marker naming no element fails. */

const INTERNAL_CLASSES = new Set([
  'ts-label',        // shared base under the four caption/label variants
  'ts-break',        // shared base under the four section-break variants
  'ts-span',         // two-column template, not a document style
  'ts-print-only',   // paired with ts-screen-only under one spec element
  'ts-screen-only',
]);

const specIds = new Set(
  spec.sections.flatMap((s) => s.elements.map((e) => e.id)));

const cssClasses = new Set(
  [...css.matchAll(/\.(ts-[a-z0-9-]+)/g)].map((m) => m[1]));

const styleMarkers = new Set(
  [...css.matchAll(/\/\*\s*@style\s+([a-z0-9-]+)\s*\*\//g)].map((m) => m[1]));

const typSymbols = new Set(
  [...typ.matchAll(/^#let\s+([a-z0-9-]+)\s*[=(]/gm)].map((m) => m[1]));

for (const id of specIds) {
  if (!cssClasses.has(`ts-${id}`) && !styleMarkers.has(id))
    fail.push(`typeset.css: style "${id}" has neither a .ts-${id} class nor a @style marker`);
}

for (const cls of cssClasses) {
  if (INTERNAL_CLASSES.has(cls)) continue;
  if (!specIds.has(cls.replace(/^ts-/, '')))
    fail.push(`typeset.css: .${cls} has no spec element behind it`);
}

for (const id of styleMarkers) {
  if (!specIds.has(id))
    fail.push(`typeset.css: @style ${id} names no spec element`);
}

/* Typst covers a subset by design — many styles are show rules on native
   elements rather than exported functions. Only the styles a document has to
   call by name need a symbol; those are the ones carrying a CSS class that is
   not a plain element alias. A missing one is a warning, not a failure, until
   Group 2 pins the list down. */
for (const id of specIds) {
  if (!typSymbols.has(id) && !typ.includes(`// @s ${id}`))
    warn.push(`typeset.typ: no symbol or marker region named "${id}"`);
}
```

- [ ] **Step 2: Run it and capture the failure list**

```bash
node tools/check.mjs 2>&1 | tee /tmp/naming-gate-before.txt | tail -20
```

Expected: FAIL, with roughly 95 `has neither a .ts-<id> class nor a @style marker` lines (no element is named yet) and roughly 50 `has no spec element behind it` lines (every current class still uses a 1.x name). This list is the work.

**Do not redeclare an existing binding.** `tools/check.mjs` already declares `const elements` near the summary. Run `grep -n '^const ' tools/check.mjs` and confirm none of `specIds`, `cssClasses`, `styleMarkers`, `typSymbols`, `INTERNAL_CLASSES` collides before adding the block.

- [ ] **Step 3: Commit the red gate**

```bash
git add tools/check.mjs
git commit -m "test(check): gate that every named style has a class and a symbol

Red on purpose: no style is named yet. The rename commits that follow
drive this green."
```

---

### Task 3: Rewrite the element ids in spec.json

**Files:**
- Modify: `spec.json` — 81 element ids, one section id
- Modify: `SPEC.md` — regenerated

- [ ] **Step 1: Apply the map**

```bash
node -e '
const fs = require("fs");
const map = JSON.parse(fs.readFileSync("tools/rename-map.json", "utf8"));
const spec = JSON.parse(fs.readFileSync("spec.json", "utf8"));
for (const sec of spec.sections) {
  if (map.sections[sec.id]) sec.id = map.sections[sec.id];
  for (const el of sec.elements) el.id = map.elements[el.id] ?? el.id;
}
fs.writeFileSync("spec.json", JSON.stringify(spec, null, 2) + "\n");
'
```

- [ ] **Step 2: Verify every id now matches the rule**

```bash
node -e '
const s = require("./spec.json");
const bad = [];
for (const sec of s.sections)
  for (const el of sec.elements)
    if (el.id !== sec.id && !el.id.startsWith(sec.id + "-")) bad.push(sec.id + " / " + el.id);
console.log(bad.length ? bad : "every id is <section-id> or <section-id>-<leaf>");
'
```

Expected: `every id is <section-id> or <section-id>-<leaf>`.

- [ ] **Step 3: Land the section rename everywhere it is keyed, in this commit**

A section id is a join key across six files. Renaming it in `spec.json` alone leaves the tree **unbuildable**, not merely inconsistent: `src/panels.mjs:122` throws `no section, template or foundation group "figures-numeric" in spec.json`, `tools/check.mjs:119` calls `buildAll()`, so `node tools/check.mjs` dies with a stack trace instead of reporting failures — and every task from here to Task 9 needs to run it. Verified by simulation before this plan was amended.

So the section rename is atomic. Find every key:

```bash
git grep -n 'figures-numeric'
```

Fix all of them now:

1. `src/sections.json` — the section's `"id"` and its `"panel": {"spec": …}`.
2. `src/demos/figures-numeric.html` → rename the file:
   ```bash
   git mv src/demos/figures-numeric.html src/demos/numerals.html
   ```
3. `src/panels.mjs` — the `TYPST_ELSEWHERE` map keys on section ids:
   ```js
   const TYPST_ELSEWHERE = {
     paragraphs: 'foundation',
     justification: 'foundation',
     numbering: 'headings',
     'code-inline': 'codeblock',
     links: 'inline',
     numerals: 'foundation',
   };
   ```
4. `typeset.css` — the marker comment. `renderPanel` looks the section up by this id and throws if it is absent:
   ```
   /*! @s figures-numeric :: Figures */   →   /*! @s numerals :: Numerals */
   ```

`implementations/typeset.typ` has no `@s figures-numeric` marker — confirm with `grep -n '@s ' implementations/typeset.typ` rather than assuming.

- [ ] **Step 3b: Confirm the tree still builds**

```bash
node tools/build-site.mjs && echo "BUILD OK"
git grep -n 'figures-numeric' || echo "no key left"
```

Expected: `BUILD OK` and `no key left`. A stack trace here means a key was missed — find it before going further, because every later task needs a runnable checker.

The checker itself will still be red (the naming gate from Task 2, plus stale generated pages). That is expected. What must not happen is a crash.

- [ ] **Step 4: Regenerate SPEC.md**

```bash
node tools/build-spec.mjs
git diff --stat SPEC.md
```

Expected: `SPEC.md` changes, and only in id-bearing lines.

- [ ] **Step 5: Commit**

```bash
git add spec.json SPEC.md src/sections.json src/panels.mjs src/demos typeset.css
git commit -m "feat(spec)!: normalise element ids to <section>-<leaf>

Every style now has one canonical name. figures-numeric becomes numerals:
it describes numerals, not figures, and collided with the figures section.

A section id is a join key across spec.json, src/sections.json, the demo
filename, src/panels.mjs and the typeset.css marker, so it moves in one
commit — renaming it in spec.json alone makes tools/build-site.mjs throw,
which takes the checker down with it.

BREAKING CHANGE: 81 element ids change. See tools/rename-map.json."
```

---

### Task 4: Promote the six unnamed styles to spec elements

Six hooks in the stylesheet style something real but have no element in the spec, so the gate has nothing to match them against. Give each a name.

**Files:**
- Modify: `spec.json` — add elements to `links`, `toc`, `tables`, `figures`, `frontmatter`, `letter`
- Modify: `SPEC.md` — regenerated

- [ ] **Step 1: Add `links-bare`**

Into the `links` section's `elements` array, after `links-print-url`:

```json
{
  "id": "links-bare",
  "name": "Link — URL suppressed",
  "properties": {
    "print_url": false
  },
  "notes": [
    "Opt-out for a link whose URL would be noise in print: a shortened URL, a tracking URL, or one the surrounding sentence already gives."
  ]
}
```

- [ ] **Step 2: Add `toc-leader`**

Into the `toc` section's `elements` array:

```json
{
  "id": "toc-leader",
  "name": "Dot leader",
  "properties": {
    "content": "dotted 0.5pt rule",
    "color": "rule",
    "baseline_offset": "-0.15em",
    "fills": "the space between the title and the page number"
  }
}
```

- [ ] **Step 3: Add the four label variants**

The shared `.ts-label` base is not a style in its own right — it carries only what the four have in common — so it gets no spec element and is declared internal in the checker. Each of the four does get one.

Into `tables`:

```json
{
  "id": "tables-caption-label",
  "name": "Caption label",
  "properties": {
    "weight": 600,
    "caps": "all small caps",
    "tracking": "0.06em"
  }
}
```

Into `figures`:

```json
{
  "id": "figures-caption-label",
  "name": "Figure caption label",
  "properties": {
    "weight": 600,
    "color": "ink",
    "caps": "all small caps",
    "tracking": "0.06em"
  },
  "notes": [
    "Carries the cross-reference target: a mention in the text points at this, so it must be the thing a reader scans for."
  ]
}
```

Into `frontmatter`:

```json
{
  "id": "frontmatter-abstract-label",
  "name": "Abstract label",
  "properties": {
    "font": "sans",
    "size": "xs",
    "weight": 700,
    "tracking": "0.1em",
    "caps": "uppercase",
    "color": "ink_faint"
  }
}
```

Into `letter`:

```json
{
  "id": "letter-address-label",
  "name": "Address label",
  "properties": {
    "display": "block",
    "font": "sans",
    "size": "xs",
    "tracking": "0.1em",
    "caps": "uppercase",
    "color": "ink_faint"
  }
}
```

- [ ] **Step 4: Confirm the count and regenerate**

```bash
node -e 'const s=require("./spec.json");console.log("elements",s.sections.reduce((n,x)=>n+x.elements.length,0))'
node tools/build-spec.mjs
```

Expected: `elements 101` — 95 plus the six added here. (`.ts-nowrap` and `.ts-page-break-avoid` add no element; they collapse onto existing ones.)

- [ ] **Step 5: Commit**

```bash
git add spec.json SPEC.md
git commit -m "feat(spec): name the six styles that had a class but no element

The bare link, the TOC dot leader and the four caption/label treatments
were styled but unnamed, so nothing could check them."
```

---

### Task 5: Rename the classes in typeset.css

**Files:**
- Modify: `typeset.css` — 57 classes renamed, 3 collapsed, 6 added, 2 marker ids changed

- [ ] **Step 1: Write the codemod, since seven later tasks need it too**

`tools/codemod-names.mjs`:

```js
/* Rewrites 1.x class names and Typst symbols to their 2.0.0 names, in place.

   Run: node tools/codemod-names.mjs <file> [<file> ...]
        node tools/codemod-names.mjs --dry-run <file>
*/

import { readFileSync, writeFileSync } from 'node:fs';

const map = JSON.parse(readFileSync('tools/rename-map.json', 'utf8'));

/* Longest first: ts-break--asterism must be rewritten before ts-break, or the
   shorter match eats its prefix and leaves "s-asterism" behind. */
const pairs = Object.entries(map.classes)
  .sort(([a], [b]) => b.length - a.length);

export function rewrite(text) {
  let out = text;
  for (const [from, to] of pairs) {
    /* Word-boundary on both ends so ts-note does not match inside
       ts-noteref, and the CSS counter named ts-note is left alone. */
    out = out.replace(new RegExp(`\\b${from}\\b(?!-)`, 'g'), to);
  }
  for (const [from, to] of Object.entries(map.sections)) {
    out = out.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  }
  return out;
}

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
for (const path of args.filter((a) => a !== '--dry-run')) {
  const before = readFileSync(path, 'utf8');
  const after = rewrite(before);
  if (before === after) { console.log(`  unchanged  ${path}`); continue; }
  if (dry) {
    const n = before.split('\n').filter((l, i) => l !== after.split('\n')[i]).length;
    console.log(`  ${String(n).padStart(4)} lines  ${path}`);
  } else {
    writeFileSync(path, after);
    console.log(`  rewritten  ${path}`);
  }
}
```

- [ ] **Step 2: Dry-run it against the stylesheet**

```bash
node tools/codemod-names.mjs --dry-run typeset.css
```

Expected: a line count in the low hundreds. If it reports `unchanged`, the map or the regex is wrong — stop and fix before writing anything.

- [ ] **Step 3: Apply it**

```bash
node tools/codemod-names.mjs typeset.css
```

- [ ] **Step 4: Fix the three things the codemod cannot do**

The codemod is a blind substitution; these three need judgement.

First, the `@s` marker id for the renamed section:

```
/*! @s figures-numeric :: Figures */   →   /*! @s numerals :: Numerals */
```

Second, the breaks region. `ts-break` is deliberately absent from the rename map, so the codemod left the region alone — it means the shared base here and three asterisks in a document, and no single mapping is right for both. Migrate it by hand: keep `.ts-break` as the base carrying the shared block-level rules, and give each of the four variants its named class over it.

```css
/* The shared base: block geometry every section break needs. Not a style in
   its own right — always written alongside one of the four below. */
.typeset .ts-break { /* unchanged from 1.x */ }

.typeset .ts-breaks-asterisks::before { content: "* * *"; letter-spacing: 0.4em; }
.typeset .ts-breaks-asterism::before { content: "⁂"; letter-spacing: 0; font-size: 14pt; }
.typeset .ts-breaks-fleuron::before { content: "❦"; letter-spacing: 0; font-size: 12pt; color: var(--ts-accent); }
.typeset .ts-breaks-rule::before { content: none; }
.typeset .ts-breaks-rule { border-top: 0.5pt solid var(--ts-rule); height: 0; }
```

Note the 1.x default: a bare `.ts-break` rendered three asterisks through its own `::before`. That default moves onto `.ts-breaks-asterisks`, so the base renders nothing on its own. Check `.typeset .ts-break + p` and `.typeset .ts-callout + p` — the sibling rules in the paragraphs region — still match; they key on the base, which survives.

Third, the shared label base. `.ts-label` is now internal: it carries only what the four variants share, and each variant must be able to stand alone. Add the four rules:

```css
/* The shared base: what all four labels have in common. Not a style in its
   own right — always written alongside one of the four below. */
.typeset .ts-label {
  font-weight: 600;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.06em;
}
.typeset .ts-tables-caption-label { }
.typeset .ts-figures-caption-label { color: var(--ts-ink); }
.typeset .ts-frontmatter-abstract-label {
  font-family: var(--ts-sans);
  font-size: var(--ts-xs);
  font-weight: 700;
  font-variant-caps: normal;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ts-ink-faint);
}
.typeset .ts-letter-address-label {
  display: block;
  font-family: var(--ts-sans);
  font-size: var(--ts-xs);
  font-weight: 400;
  font-variant-caps: normal;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ts-ink-faint);
}
```

Delete the four old contextual rules (`caption .ts-label`, `figcaption .ts-label`, `.ts-abstract .ts-label`, `.ts-address .ts-label`) — the codemod will have renamed their ancestor selectors but left the rules themselves in place.

An empty `.ts-tables-caption-label { }` is correct: the base already carries everything it needs, and the empty rule is what makes the name real and the gate pass.

- [ ] **Step 5: Confirm every 1.x class name is gone**

Check both halves of each collapsed pair, not just the half named in the commit message — the earlier version of this step checked `ts-nowrap` and `ts-page-break-avoid` but not `ts-tie` and `ts-keep-together`, which is how six uncovered classes stayed invisible to the plan's own gate.

The leading `[^a-z-]` matters: a bare `ts-keep-together` also matches inside `ts-utilities-keep-together`, so a naive grep reports a false positive on the correctly-renamed name.

```bash
grep -nE '(^|[^a-z-])ts-(nowrap|tie|keep-together|no-hyphens|page-break-(before|after|avoid)|sc|frac|num|lede|note|noteref|leader|bare|ps|date|address|toc|toc-2|run-in|titleblock|bibliography|nums-[a-z]+)([^a-z-]|$)' typeset.css
```

Expected: no output. Every 1.x spelling has been replaced.

The authoritative version of this check is the coverage gate inside `tools/build-rename-map.mjs`, which refuses to emit a map that misses any class occurring in the stylesheet. This grep is the cheap confirmation that the map was actually applied.

- [ ] **Step 5b: Name the bare-selector styles with `@style` markers**

73 of the styles are reached through a bare semantic selector and carry no class. Each needs its canonical name written above the rule that implements it, so a reader editing that rule sees which named style they are changing. This is the substance of the group, not bookkeeping.

The marker goes immediately above the selector, on its own line:

```css
/* @style headings-h1 */
.typeset h1 {
  font-family: var(--ts-sans);
  /* … */
}

/* @style inline-strong */
.typeset strong { font-weight: 600; }

/* @style inline-emphasis */
.typeset em { font-style: italic; }
```

Where one rule implements two styles, mark both:

```css
/* @style inline-superscript */
/* @style inline-subscript */
.typeset sup,
.typeset sub { font-size: 0.7em; line-height: 0; position: relative; }
```

A style that states a prohibition rather than a selector — `justification-exclusions`, which names what is never justified — marks the rule that enforces it:

```css
/* @style justification-exclusions
   Every block that must stay flush declares its own text-align, rather than
   relying on an exception list here: text-align inherits. */
.typeset .ts-frontmatter-subtitle,
.typeset .ts-frontmatter-byline,
.typeset figcaption { text-align: left; }
```

Work through the gate's failure list rather than the stylesheet top to bottom:

```bash
node tools/check.mjs 2>&1 | grep 'has neither' | sed 's/.*style "\([a-z0-9-]*\)".*/\1/'
```

Each line is one style still unnamed. The list is the work queue; it shrinks as you go.

- [ ] **Step 6: Add the two new bases to the checker's internal list**

In `tools/check.mjs`, `INTERNAL_CLASSES` must now read:

```js
const INTERNAL_CLASSES = new Set([
  'ts-label',        // shared base under the four caption/label variants
  'ts-break',        // shared base under the four section-break variants
  'ts-span',         // two-column template, not a document style
  'ts-print-only',   // paired with ts-screen-only under one spec element
  'ts-screen-only',
]);
```

- [ ] **Step 7: Run the gate**

```bash
node tools/check.mjs 2>&1 | grep 'typeset.css:' | head -20
node tools/check.mjs 2>&1 | grep -c 'typeset.css:' || echo 0
```

Expected: `0`. Every CSS failure from Task 2 is now gone — every style has a class or a marker, and every class and marker names a real element. Typst warnings and stale-page failures remain; Tasks 6 and 9 clear those.

- [ ] **Step 8: Commit**

```bash
git add typeset.css tools/codemod-names.mjs tools/check.mjs
git commit -m "feat(css)!: rename every class to .ts-<element-id>

Collapses two duplicate pairs (ts-nowrap/ts-tie, ts-page-break-avoid/
ts-keep-together) and splits the four-way .ts-label hook into four named
classes over a shared base.

BREAKING CHANGE: every .ts-* class is renamed. Run tools/codemod-names.mjs
over a document to migrate it."
```

---

### Task 6: Rename the symbols in typeset.typ

**Files:**
- Modify: `implementations/typeset.typ` — exported symbols and `@s` marker ids

- [ ] **Step 1: List what is exported today**

```bash
grep -n '^#let [a-z-]*' implementations/typeset.typ
```

- [ ] **Step 2: Rename the symbols by hand — the codemod cannot do this**

`tools/codemod-names.mjs` applies `map.classes` (every key is `ts-`-prefixed) and `map.sections`. A Typst symbol is a **bare identifier** — `epigraph`, `pullquote` — so no key matches and the tool rewrites nothing. It loads `map.elements`, which is the table you need, and never uses it. Running the codemod over this file is a no-op that looks like success; do not rely on it.

Applying `map.elements` blindly would also be wrong: it maps `link → links-link` and `table → tables-table`, which would wreck any prose or identifier containing those words.

**The 13 symbols the map renames** — apply exactly these:

```
epigraph      -> quotes-epigraph          title-block -> frontmatter-title-block
pullquote     -> quotes-pullquote         abstract    -> frontmatter-abstract
verse         -> quotes-verse             colophon    -> frontmatter-colophon
callout       -> callouts-callout         letterhead  -> letter-sender
sidenote      -> notes-sidenote           date-note   -> letter-date-note
signature     -> letter-signature         enclosures  -> letter-enclosures
postscript    -> letter-postscript
```

**Four more that name a style but sit outside the map**, because their symbol name never matched their element id:

```
address          -> letter-address-block
toc              -> toc-entry
keep-together    -> utilities-keep-together
tie              -> utilities-tie
```

**Symbols that are NOT styles and keep their names.** These are the Typst counterpart of the CSS custom properties and the `.typeset--*` document modifiers, both of which this branch leaves alone:

```
ink  ink-muted  ink-faint  rule-color  rule-strong  wash  accent
serif  sans  mono  scale-single-column  scale-two-column
base-size  sm  xs  sp  leading-for  oldstyle  lining  tabular  smcp
typeset  two-column  letter-page  span  ts-table  epigraph-right
```

`dropcap` and `letter-page` already match their element ids — leave them.

`break-scene` is handled in Step 3.

- [ ] **Step 2b: Fix the marker ids**

```bash
grep -n '// @s ' implementations/typeset.typ
```

Every `// @s <id>` must name a section id that exists in `spec.json`. Task 3 confirmed this file has no `@s figures-numeric` marker, so there should be nothing to change — verify rather than assume.

- [ ] **Step 3: Split `break-scene` into four named symbols**

The spec names four break styles, so four symbols. Replace the single `break-scene` definition with:

```typst
// The four section breaks. One helper backs all of them; the four names are
// the interface, because the spec names four styles and a caller should not
// have to know a string literal to pick one.
#let _break-mark(mark, size: 11pt, color: ink) = block(
  above: sp * 1.5, below: sp * 1.5, sticky: true, width: 100%,
  align(center, text(size: size, fill: color, mark)),
)

#let breaks-asterisks() = _break-mark("* * *")
#let breaks-asterism()  = _break-mark("⁂", size: 14pt)
#let breaks-fleuron()   = _break-mark("❦", size: 12pt, color: accent)
#let breaks-rule()      = block(above: sp * 1.5, below: sp * 1.5, width: 100%,
  line(length: 100%, stroke: 0.5pt + rule-color))
```

- [ ] **Step 4: Update the usage comment at the top of the file**

The header comment names the old symbols:

```typst
//   #import "typeset.typ": typeset, letter, epigraph, pullquote, callout, break-scene
```

It must name the new ones, and it must be true — import exactly what the examples import:

```typst
//   #import "typeset.typ": (
//     typeset, letter-page, quotes-epigraph, quotes-pullquote,
//     callouts-callout, breaks-asterisks,
//   )
```

**The parentheses are load-bearing.** A bare `#import "...": a, b,` list does not
continue onto a second line. Without them the import succeeds silently, drops
every name after the first line, and fails much later at the call site as
`unknown variable` with a "did you mean subtraction" hint. Compile the snippet
in a scratch file before trusting it — reading it is not enough, because the
broken form parses.

- [ ] **Step 4b: Confirm no call site was missed**

A renamed symbol with a surviving call site is a compile error, which Step 5 catches. A renamed symbol whose OLD name still exists as a different binding is not. Check that no old name survives:

```bash
grep -nE '\b(epigraph|pullquote|verse|callout|sidenote|signature|postscript|enclosures|letterhead|date-note|title-block|abstract|colophon|address|toc|keep-together|tie|break-scene)\b' implementations/*.typ
```

Every hit must be part of a NEW name (`quotes-epigraph` contains `epigraph`) or prose in a comment. A bare old identifier is a miss.

- [ ] **Step 5: Check every symbol resolves**

```bash
which typst || echo "typst not installed — install it before this step"
typst compile --font-path fonts implementations/example-essay.typ /tmp/essay.pdf
typst compile --font-path fonts implementations/example-letter.typ /tmp/letter.pdf
typst compile --font-path fonts implementations/example-two-column.typ /tmp/two.pdf
```

Expected: three PDFs, no errors. An `unknown variable` error names a symbol the codemod missed.

- [ ] **Step 6: Commit**

```bash
git add implementations/typeset.typ implementations/example-*.typ
git commit -m "feat(typst)!: rename every symbol to its element id

break-scene(kind:) splits into four named symbols, because the spec names
four break styles and a caller should not need a string literal to choose.

BREAKING CHANGE: every exported symbol is renamed."
```

---

### Task 7: Migrate the documents

**Files:**
- Modify: `src/demos/*.html` (19 of 26), `examples/*.html` (3), `proofs/font-proof.html`
- Modify: `implementations/iawriter/iawriter.css`, `implementations/iawriter/letter/page.css`, `implementations/iawriter/letter/document.html`, `implementations/iawriter/letter/example.md`

- [ ] **Step 1: Dry-run over every document**

```bash
node tools/codemod-names.mjs --dry-run \
  src/demos/*.html examples/*.html proofs/font-proof.html \
  implementations/iawriter/iawriter.css \
  implementations/iawriter/letter/page.css \
  implementations/iawriter/letter/document.html \
  implementations/iawriter/letter/example.md
```

Expected: a changed-line count for each. A file reported `unchanged` that you expected to change means it uses a name not in the map — investigate before applying.

- [ ] **Step 2: Apply**

```bash
node tools/codemod-names.mjs \
  src/demos/*.html examples/*.html proofs/font-proof.html \
  implementations/iawriter/iawriter.css \
  implementations/iawriter/letter/page.css \
  implementations/iawriter/letter/document.html \
  implementations/iawriter/letter/example.md
```

- [ ] **Step 3: Migrate the break markup by hand**

`ts-break` is absent from the rename map (it means the base in the stylesheet and three asterisks in a document), so the codemod rewrote the three modifier classes and left the base untouched. Every break site now needs the base plus exactly one named variant.

```bash
grep -rn 'ts-break' src/demos/ examples/ proofs/ implementations/
```

Rewrite each hit:

| 1.x markup | 2.0 markup |
|---|---|
| `class="ts-break"` | `class="ts-break ts-breaks-asterisks"` |
| `class="ts-break ts-breaks-asterism"` | unchanged — already correct |
| `class="ts-break ts-breaks-fleuron"` | unchanged |
| `class="ts-break ts-breaks-rule"` | unchanged |

The first row is the one that matters: a bare `.ts-break` used to render three asterisks through the base's own `::before`, and that default now lives on `.ts-breaks-asterisks`. Miss it and the break renders as empty space — which is exactly the failure the breaks section exists to prevent, so it will not be obvious in a screenshot.

- [ ] **Step 3b: Add the four label variant classes to the markup**

Task 4 named the four label treatments and Task 5 styled them, but the documents still carry only the shared base. Each site needs the base plus its variant:

```bash
grep -rn 'ts-label' src/demos/ examples/ proofs/ implementations/
```

Rewrite each hit by the element it sits in:

| Context | 2.0 markup |
|---|---|
| inside `<caption>` | `class="ts-label ts-tables-caption-label"` |
| inside `<figcaption>` | `class="ts-label ts-figures-caption-label"` |
| inside `.ts-frontmatter-abstract` | `class="ts-label ts-frontmatter-abstract-label"` |
| inside `.ts-letter-address-block` | `class="ts-label ts-letter-address-label"` |

The contextual selectors that used to do this work were deleted in Task 5 Step 4, so a site left on the bare base renders with the shared small-caps treatment and none of its own.

- [ ] **Step 4: Confirm no old name survives in a document**

**Do not use `\b` here.** POSIX ERE has no word-boundary escape, so `git grep -E '\b...'` matches *nothing* and reports clean whether or not old names survive — the check would pass by failing. Guard with an explicit character class instead, which is portable ERE:

```bash
node -e '
const map = require("./tools/rename-map.json");
const { execSync } = require("child_process");
/* Longest first so a short key cannot match inside a longer one, and the
   surrounding [^a-z0-9-] guards stop a 1.x name matching inside its own 2.0
   replacement. Ten keys have that shape — ts-note inside ts-notes-footnote,
   ts-table inside ts-tables-table, ts-link inside ts-links-link, ts-callout
   inside ts-callouts-callout, and six more. Without the guards every one of
   them reports a false hit on correctly-migrated markup. */
const olds = Object.keys(map.classes).sort((a, b) => b.length - a.length).join("|");
const re = `(^|[^a-z0-9-])(${olds})([^a-z0-9-]|$)`;
const hits = execSync(
  `git grep -nE ${JSON.stringify(re)} -- src/demos examples proofs implementations || true`
).toString();
console.log(hits || "clean");
'
```

Expected: `clean`.

Prove the check can fail before you trust it passing: append `class="ts-epigraph"` to any demo, re-run, confirm it is reported, then revert. A verification you have never seen fail is not a verification.

- [ ] **Step 5: Commit**

```bash
git add src/demos examples proofs implementations
git commit -m "refactor: migrate every document to the new style names"
```

---

### Task 8: Migrate the furniture and the tooling

These are the files a class rename is most often left out of, because they name classes without being documents.

**Files:**
- Modify: `specimen.css`, `examples/preview-bar.js`, `src/sections.json`, `tools/check.mjs`, `README.md`

- [ ] **Step 1: Find what still names an old class**

```bash
git grep -nE 'ts-(sc|ps|frac|num|bare|lede|note|noteref|leader|label|titleblock|address|date|toc|toc-2|run-in|nowrap|break|nums-[a-z]+|page-break-[a-z]+)\b' \
  -- specimen.css examples/preview-bar.js src/sections.json README.md tools/
```

- [ ] **Step 2: Apply the codemod to the three that are pure substitution**

```bash
node tools/codemod-names.mjs specimen.css examples/preview-bar.js src/sections.json
```

- [ ] **Step 3: Confirm the section rename is still complete**

Task 3 landed the `figures-numeric` → `numerals` rename across `spec.json`, `src/sections.json`, `src/demos/`, `src/panels.mjs` and `typeset.css`, because splitting it left the tree unbuildable. Nothing should remain:

```bash
git grep -n 'figures-numeric' || echo "no key left"
```

Expected: `no key left`. A hit here is a key Task 3 missed.

- [ ] **Step 4: Update the README file table**

`README.md` describes the site's marker contract and the `src/demos/*.html` convention. Check the two lines naming `figures-numeric` and any prose naming an old class. Grep for the claim's subject, not just the line you spot:

```bash
grep -n 'figures-numeric\|ts-' README.md
```

- [ ] **Step 5: Commit**

```bash
git add specimen.css examples/preview-bar.js README.md
git commit -m "refactor: migrate the page furniture to the new names"
```

---

### Task 9: Rebuild, go green, and confirm nothing moved on the page

**Files:**
- Modify: `index.html`, `files/*.html` — regenerated

- [ ] **Step 1: Capture the rendered page before the rebuild**

The branch renames things; it must not restyle them. Keep a reference:

```bash
git show master:index.html > /tmp/index-before.html
```

- [ ] **Step 2: Rebuild**

```bash
node tools/build-site.mjs
```

- [ ] **Step 3: Run the full checker**

```bash
node tools/check.mjs
```

Expected: PASS, no failures. Warnings about Typst symbols are acceptable at this stage and are listed in Step 5.

- [ ] **Step 4: Diff the rendered text, ignoring the names**

Class names changed, so the files differ. What must not differ is the visible text:

```bash
strip() { sed -E 's/class="[^"]*"//g; s/ id="[^"]*"//g; s/<[^>]+>//g' "$1" | tr -s ' \n' ' \n' ; }
strip /tmp/index-before.html > /tmp/a.txt
strip index.html > /tmp/b.txt
diff /tmp/a.txt /tmp/b.txt && echo "text identical"
```

Expected: `text identical`, or a diff confined to the spec tables, where the element ids are shown on purpose.

- [ ] **Step 5: Review the remaining Typst warnings**

```bash
node tools/check.mjs 2>&1 | grep 'typeset.typ:'
```

Each warning names a style with no Typst symbol and no marker region. Most are correct — Typst provides the behaviour natively, or the style is a show rule on a native element. Confirm each one is in that category rather than a symbol the rename dropped. Record the list in the PR description.

- [ ] **Step 6: Commit**

```bash
git add index.html files
git commit -m "build: regenerate the site for the renamed styles"
```

---

### Task 10: Version the break and write the migration note

**Files:**
- Modify: `spec.json` — `version`, `updated`
- Modify: `SPEC.md` — regenerated
- Create: `docs/migrating-to-2.0.md`

- [ ] **Step 1: Bump the version**

```bash
node -e '
const fs = require("fs");
const s = JSON.parse(fs.readFileSync("spec.json", "utf8"));
s.version = "2.0.0";
s.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync("spec.json", JSON.stringify(s, null, 2) + "\n");
'
node tools/build-spec.mjs
```

- [ ] **Step 2: Generate the migration table**

```bash
node -e '
const map = require("./tools/rename-map.json");
const rows = Object.entries(map.classes)
  .filter(([o, n]) => o !== n)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([o, n]) => `| \`.${o}\` | \`.${n}\` |`);
console.log("| 1.x | 2.0 |\n|---|---|");
console.log(rows.join("\n"));
' > /tmp/migration-table.md
wc -l /tmp/migration-table.md
```

- [ ] **Step 3: Write `docs/migrating-to-2.0.md`**

Open with what changed and why in three sentences, then the command, then the table from Step 2:

```markdown
# Migrating to typeset 2.0

Every style now has one canonical name, and the CSS class, the Typst symbol
and the `spec.json` element id are the same word. Before 2.0 they were three
different vocabularies, so a stylesheet could drift from the specification
with nothing to catch it; `tools/check.mjs` now fails when they disagree.

Nothing about the typography changed. This release renames things.

## Migrating a document

    node tools/codemod-names.mjs path/to/document.html

Two cases the codemod cannot decide for you:

- **Section breaks** were a base class plus a modifier
  (`class="ts-break ts-break--asterism"`). Each variant now stands alone over
  the internal base: `class="ts-break ts-breaks-asterism"`.
- **`.ts-nowrap` and `.ts-page-break-avoid`** duplicated `.ts-tie` and
  `.ts-keep-together`. Both collapse onto the surviving name.

## The full table
```

Then append `/tmp/migration-table.md`.

- [ ] **Step 4: Rebuild and check**

```bash
node tools/build-site.mjs && node tools/check.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add spec.json SPEC.md docs/migrating-to-2.0.md index.html files
git commit -m "feat(spec)!: release 2.0.0

BREAKING CHANGE: every element id, CSS class and Typst symbol is renamed.
See docs/migrating-to-2.0.md."
```

---

### Task 11: Open the pull request

- [ ] **Step 1: Re-run the whole gate from clean**

```bash
node tools/build-site.mjs && node tools/check.mjs && echo "GREEN"
```

Expected: `GREEN`. Do not open the PR on a red checker.

- [ ] **Step 2: Confirm the working tree is clean**

```bash
git status --short
```

Expected: no output. A modified `index.html` here means the committed page is stale.

- [ ] **Step 3: Open the draft PR**

Use the `sdlc-tools:create-pr` skill. The description must carry:

- What changed and that no typography moved.
- The verification: three Typst examples compile, the checker is green, the
  rendered text diff from Task 9 Step 4 is empty.
- The Typst warning list from Task 9 Step 5, with a line saying why each is
  expected.
- A link to `docs/migrating-to-2.0.md`.

---

## Self-review

- **Spec coverage.** Design doc Group 1 asks for: canonical ids (Task 3), derived classes (Task 5), derived Typst symbols (Task 6), the bidirectional gate (Tasks 2 and 5), consumer migration (Tasks 7 and 8), the codemod (Task 5 Step 1), the major bump and old→new table (Task 10). The helper-class wrinkle the design flagged is Task 4. All covered.
- **Ordering.** The gate lands red in Task 2 and is driven green by Tasks 5, 7 and 8, so every rename commit has a test that fails without it.
- **Names used consistently.** `tools/codemod-names.mjs` and `tools/rename-map.json` throughout, and the design doc uses the same two names. `INTERNAL_CLASSES` is defined in Task 2 and extended in Task 5 Step 6 — check the second list includes every entry from the first.
- **Known gap carried forward.** The Typst symbol check is a warning rather than a failure, because the set of styles that genuinely need a callable symbol is not pinned down until Group 2 writes a per-section Typst snippet for each. Group 2 promotes it to a failure.
