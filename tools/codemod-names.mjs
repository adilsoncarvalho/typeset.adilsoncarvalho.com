/* Rewrites 1.x class names and Typst symbols to their 2.0.0 names, then
   rewrites 2.0.0 plural ids to the singular ids that replaced them, in place.

   Run: node tools/codemod-names.mjs <file> [<file> ...]
        node tools/codemod-names.mjs --dry-run <file>
*/

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/* Resolved against this file, not the working directory: check.mjs imports
   rewrite() and a future caller need not be rooted at the repo. */
const here = dirname(fileURLToPath(import.meta.url));
const map = JSON.parse(readFileSync(resolve(here, 'rename-map.json'), 'utf8'));
const singularMap = JSON.parse(readFileSync(resolve(here, 'rename-map-2.0-singular.json'), 'utf8'));

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

/* Element rows are always their own section id plus a suffix
   (quotes-epigraph contains quotes), so they are rewritten before any
   section-level pass runs — a section pass that ran first and somehow
   touched the prefix would leave quote-epigraph half done. In practice the
   section pass's own structural guards (below) already keep it off a
   hyphenated compound, but the ordering costs nothing and removes any
   dependence on that guard alone. */
const elementPairs = Object.entries(singularMap.elements)
  .sort(([a], [b]) => b.length - a.length);
const sectionPairsSingular = Object.entries(singularMap.sections)
  .sort(([a], [b]) => b.length - a.length);

/* A bare section id (`notes`, `tables`, `figures`, ...) is also an ordinary
   English word, and unlike a compound element id (`quotes-epigraph`) it
   collides constantly with ordinary prose: "a hyphen breaks a word", "Two
   paragraphs set by...", "the stylesheet a reader links". A blind
   \b<word>\b replace over a file that mixes identifiers with hand-written
   comments and JSON prose cannot tell the two apart, and Task 2 of the
   singular-names plan found this out by hand — 32 corrupted `"notes": [...]`
   schema keys, 13 corrupted `"numerals": "..."` property keys, and dozens of
   sentences with broken subject-verb agreement, none of them caught by any
   gate because nothing reads prose.

   So a bare section id is rewritten only where it appears in one of the
   handful of STRUCTURED positions it actually occupies as an identifier,
   never as a free \b-bounded match over the whole file:

     - the sole content of a quoted string ("notes", 'notes') that is not a
       key — never a multi-word value ("Section breaks", "all headings"),
       because those have more content than just the id between the quotes,
       and never a token immediately followed by a colon, because that is a
       JSON or JS key naming a property rather than an id naming a section.
       The key guard is the one the damage above needed and did not have:
       `"notes": [...]` and `"numerals": "lining tabular"` are exactly as
       many characters between quotes as `"id": "notes"` is, so the earlier
       rule read all three as ids;
     - the sole content of a backtick span (`notes`) — an inline-code id
       citation in a doc comment;
     - the token right after a "@s " marker (a CSS "bang" comment opening
       "@s notes :: ...", or a Typst "// @s notes" line comment) —
       deliberately only that token, so the CSS
       marker's trailing ":: Label" text is untouched even when the label
       itself is the plural display name ("Pagination utilities") that is
       meant to stay plural;
     - a bare `ts-<id>` token (a CSS class selector or counter name that is
       exactly the section, not a longer compound already handled by the
       element pass) — reusing the same --custom-property and
       no-trailing-hyphen guards the class pass uses, so `--ts-notes` and
       `ts-notes-marker` are both left alone;
     - a demo-file-shaped token, `<id>` immediately before `.html`, `.typ` or
       `.fullrow` — `notes.fullrow.html`, `src/demos/notes.typ`.

   Everything else — a bare word standing in a sentence, a multi-word quoted
   value, a markdown heading — is prose, and this pass does not touch it. A
   file that needs a heading like "Footnotes and endnotes" singularised has
   to have that judged by hand; the ambiguity is the same one that caused
   the damage above, and no regex resolves it safely.

   One position stays genuinely ambiguous and is NOT resolved here: a bare
   quoted entry in an array literal. `['tokens', ..., 'utilities']` is a list
   of section ids and has to be rewritten; `new Set(['name', 'opt_in',
   'use_for', 'notes'])` is a list of schema-key names and must not be. The
   two are the same shape, and no syntactic rule separates them. So this pass
   rewrites both and reports each one it rewrote, by line, for a human to
   read back — a rewrite the caller is told about is a different hazard from
   one it is not. */
function rewriteBareSectionIds(text, sortedPairs, ambiguous) {
  let out = text;
  for (const [from, to] of sortedPairs) {
    out = out
      .replace(new RegExp(`(["'])${from}\\1`, 'g'), (match, quote, offset, whole) => {
        /* A key names a property, never a section. This is the guard the
           32 `"notes": [...]` and 13 `"numerals": "..."` keys above needed. */
        if (/^\s*:/.test(whole.slice(offset + match.length))) return match;
        /* A value sits after `:` (JSON, a JS object literal) or `=` (an HTML
           attribute). Anything else reaching here is a bare array entry, the
           position the comment above calls ambiguous. */
        if (ambiguous && !/[:=]\s*$/.test(whole.slice(0, offset))) {
          ambiguous.push({ line: whole.slice(0, offset).split('\n').length, from, to });
        }
        return quote + to + quote;
      })
      .replace(new RegExp('(`)' + from + '\\1', 'g'), `$1${to}$1`)
      .replace(new RegExp(`(@s\\s+)${from}\\b`, 'g'), `$1${to}`)
      .replace(new RegExp(`(?<!--)\\bts-${from}\\b(?!-)`, 'g'), `ts-${to}`)
      .replace(new RegExp(`\\b${from}(?=\\.(?:html|typ|fullrow)\\b)`, 'g'), to);
  }
  return out;
}

export function rewrite(text, ambiguous) {
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
  /* A frozen 1.x section id is a bare word under the same rules as the
     singular section pass below — structured positions only, never a free
     \b-bounded match over prose. tools/rename-map.json's one section row
     (figures-numeric) happens to be a compound already, but the rule is the
     same rule either way, not a special case for this map. */
  out = rewriteBareSectionIds(out, sectionPairs, ambiguous);
  /* Element rows are blind \b-bounded matches, same as the 1.x classes pass
     above: every one is a compound id (section id plus a leaf), which does
     not collide with ordinary prose the way a bare section word does. */
  for (const [from, to] of elementPairs) {
    out = out.replace(new RegExp(`(?<!--)\\b${from}\\b(?!-)`, 'g'), to);
  }
  /* Chained after the 1.x map above, not merged into it: tools/rename-map.json
     is frozen at 1.x -> 2.0.0, so a 1.x document has nothing for the singular
     map to match until the two passes above have already turned its old
     names into current 2.0.0 plural ones. A document already on 2.0.0 plural
     names passes through the two passes above unchanged and is singularised
     here directly — so one run carries either document the rest of the way. */
  out = rewriteBareSectionIds(out, sectionPairsSingular, ambiguous);
  return out;
}

/* Importing this module must not rewrite files: tools/check.mjs imports
   rewrite() to run the chain proof over tools/fixtures/, and an unguarded
   CLI body would read that importer's own argv as a list of paths to
   overwrite in place. */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  for (const path of args.filter((a) => a !== '--dry-run')) {
    const before = readFileSync(path, 'utf8');
    const ambiguous = [];
    const after = rewrite(before, ambiguous);
    if (before === after) { console.log(`  unchanged  ${path}`); continue; }
    if (dry) {
      const n = before.split('\n').filter((l, i) => l !== after.split('\n')[i]).length;
      console.log(`  ${String(n).padStart(4)} lines  ${path}`);
    } else {
      writeFileSync(path, after);
      console.log(`  rewritten  ${path}`);
    }
    for (const a of ambiguous) {
      console.log(`     review  ${path}:${a.line} rewrote the array entry '${a.from}' `
        + `to '${a.to}' — check it is a section id and not a property name`);
    }
  }
}
