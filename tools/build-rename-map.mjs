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
  'ts-bibliography': 'ts-bibliography-entry',
  'ts-tie': 'ts-utilities-tie',
  'ts-keep-together': 'ts-utilities-keep-together',
  'ts-no-hyphens': 'ts-utilities-no-hyphens',
  'ts-page-break-before': 'ts-utilities-break-before',
  'ts-page-break-after': 'ts-utilities-break-after',
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

/* Classes that carry no per-document rename: a layout primitive, a print/screen
   toggle, or the ts-break base covered by the comment above. */
const DECLARED_INTERNAL = new Set([
  'ts-label', 'ts-break', 'ts-span', 'ts-print-only', 'ts-screen-only',
]);

/* Confirms that every ts-* class the stylesheet actually selects on has a key
   in `classes`, so a class spelled differently from its element id cannot
   fall out of the map unnoticed. */
const css = readFileSync('typeset.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const cssClasses = new Set(css.match(/\.ts-[a-zA-Z0-9-]+/g)?.map((m) => m.slice(1)));
const uncovered = [...cssClasses]
  .filter((c) => !DECLARED_INTERNAL.has(c))
  .filter((c) => !(c in classes))
  .sort();

if (uncovered.length) {
  console.error('rename map is missing these classes found in typeset.css:', uncovered);
  process.exit(1);
}

console.log(JSON.stringify({
  note: 'Frozen at the 1.x -> 2.0.0 rename. Describes spec 1.0.0 ids, which no '
    + 'longer exist in spec.json. Do not regenerate against a later spec.',
  sections: SECTION_RENAME,
  elements,
  classes,
}, null, 2));
