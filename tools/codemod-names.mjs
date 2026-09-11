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
       ts-noteref. A custom property (--ts-h1) reuses the same bare token
       as its class-name counterpart, so the leading-dash guard keeps the
       rewrite off the token scale — a class is never itself preceded by
       another hyphen. */
    out = out.replace(new RegExp(`(?<!-)\\b${from}\\b(?!-)`, 'g'), to);
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
