/* Rewrites 1.x class names and Typst symbols to their 2.0.0 names, then
   rewrites 2.0.0 plural ids to the singular ids that replaced them, in place.

   Run: node tools/codemod-names.mjs <file> [<file> ...]
        node tools/codemod-names.mjs --dry-run <file>
*/

import { readFileSync, writeFileSync } from 'node:fs';

const map = JSON.parse(readFileSync('tools/rename-map.json', 'utf8'));
const singularMap = JSON.parse(readFileSync('tools/rename-map-2.0-singular.json', 'utf8'));

/* Every key is interpolated straight into a RegExp source below. This holds
   only while a key is a plain identifier — a key carrying a regex
   metacharacter would change what the pattern matches, silently. */
const assertSafeKey = (k) => {
  if (!/^[a-z0-9-]+$/.test(k)) throw new Error(`unsafe rename-map key: ${k}`);
};
for (const k of Object.keys(map.classes)) assertSafeKey(k);
for (const k of Object.keys(map.sections)) assertSafeKey(k);
for (const k of Object.keys(singularMap.sections)) assertSafeKey(k);
for (const k of Object.keys(singularMap.elements)) assertSafeKey(k);

/* Longest first: ts-break--asterism must be rewritten before ts-break, or the
   shorter match eats its prefix and leaves "s-asterism" behind. */
const pairs = Object.entries(map.classes)
  .sort(([a], [b]) => b.length - a.length);
const sectionPairs = Object.entries(map.sections)
  .sort(([a], [b]) => b.length - a.length);

/* The singular map's element rows and section rows are merged into one
   longest-first list, rather than run as two separate passes like the pairs
   above: an element id here is always its own section id plus a suffix
   (quotes-epigraph contains quotes), so the element row must run first or
   the section row consumes its prefix and leaves quote-epigraph half done.
   A single sorted list guarantees that ordering without relying on two
   passes staying in the right sequence relative to each other. */
const singularPairs = [
  ...Object.entries(singularMap.elements),
  ...Object.entries(singularMap.sections),
].sort(([a], [b]) => b.length - a.length);

export function rewrite(text) {
  let out = text;
  for (const [from, to] of pairs) {
    /* Word-boundary on both ends so ts-note does not match inside
       ts-noteref. A CSS custom property (--ts-h1) reuses the same bare
       token as its class-name counterpart, so the leading-double-hyphen
       guard keeps the rewrite off the token scale. A single hyphen is not
       enough of a signal to skip: this tool also runs on Typst source and
       HTML documents, where a class name can legitimately sit right after
       one hyphen — a compound id, a filename, a Typst identifier — and
       those still need rewriting. */
    out = out.replace(new RegExp(`(?<!--)\\b${from}\\b(?!-)`, 'g'), to);
  }
  /* A section id is rewritten under the same rules as a class name: longest
     first, so a shorter id cannot consume a longer one's prefix, and the same
     two guards, so it is left alone inside a custom property or a longer
     hyphenated token. */
  for (const [from, to] of sectionPairs) {
    out = out.replace(new RegExp(`(?<!--)\\b${from}\\b(?!-)`, 'g'), to);
  }
  /* Chained after the 1.x map above, not merged into it: tools/rename-map.json
     is frozen at 1.x -> 2.0.0, so a 1.x document has nothing for the singular
     map to match until the two passes above have already turned its old
     names into current 2.0.0 plural ones. A document already on 2.0.0 plural
     names passes through the two passes above unchanged and is singularised
     here directly — so one run carries either document the rest of the way. */
  for (const [from, to] of singularPairs) {
    out = out.replace(new RegExp(`(?<!--)\\b${from}\\b(?!-)`, 'g'), to);
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
