/* The boilerplate a reader needs around a copied Typst snippet, and the rule
   that composes boilerplate and snippet into a document.

   One source, two consumers: tools/build-site.mjs prints what typstBoilerplate()
   returns into the masthead, and tools/check.mjs compiles what typstDocument()
   composes. So the environment the page publishes and the environment the gate
   verifies are the same one by construction, rather than two lists that have to
   be kept agreeing by hand.

   The values themselves come from typeset.typ's own "// Usage:" comment, which
   ships inside the downloadable bundle. That comment is the library's statement
   of how it is used; this module republishes it rather than restating it. */

import { readFileSync } from 'node:fs';

/* The run of indented comment lines under "// Usage:". The indent is what
   marks a line as code rather than commentary: the paragraphs that follow the
   block in typeset.typ explain the two lines, and are addressed to someone
   reading the library, not to the compiler. Requiring the indent keeps them
   out of a block the masthead shows as code and the gate compiles. */
const USAGE_RE = /\/\/ Usage:\n((?:\/\/ {3}.*\n)+)/;

/* The Usage comment's code lines, stripped of their "// " prefixes and their
   shared indent. */
export function typstBoilerplate(source = readFileSync('implementations/typeset.typ', 'utf8')) {
  const m = source.match(USAGE_RE);
  if (!m) {
    throw new Error('implementations/typeset.typ has no "// Usage:" comment to read '
      + 'the boilerplate from');
  }
  const lines = m[1].split('\n').filter(Boolean).map((l) => l.replace(/^\/\/ ?/, ''));
  const indent = Math.min(...lines.map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(indent)).join('\n');
}

/* True where a snippet's first line of code is its own call to typeset().

   Matches only "#show: typeset" as a whole call — followed by ".with(", by
   whitespace before the rest of the line, or by nothing else on the line — so
   a future #show: typesetter or #show: typeset-alt is not mistaken for it.

   Comment lines and blank lines above it are skipped. A snippet may say what
   it demonstrates before it demonstrates it, and a match anchored at the first
   character would read such a snippet as configuring nothing, put the
   boilerplate's own "#show: typeset" above a second call, and fail on
   "page configuration is not allowed inside of containers". */
export function configuresTypeset(fragment) {
  const firstCode = fragment.split('\n')
    .find((line) => line.trim() !== '' && !line.trimStart().startsWith('//'));
  return /^#show:\s*typeset(\.|\s|$)/.test((firstCode ?? '').trimStart());
}

/* A snippet appended to the boilerplate, exactly as the masthead prints it,
   with one substitution the masthead states in prose: a snippet that
   configures typeset() itself replaces the boilerplate's bare "#show: typeset"
   rather than nesting under it. typeset() sets the page, and set page() is
   refused inside a container, which is what a second call would make of the
   first. */
export function typstDocument(fragment) {
  const lines = typstBoilerplate().split('\n');
  const kept = configuresTypeset(fragment)
    ? lines.filter((l) => !/^#show:\s*typeset\s*$/.test(l))
    : lines;
  return `${kept.join('\n')}\n${fragment}`;
}
