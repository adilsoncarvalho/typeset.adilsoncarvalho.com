/* Builds the Typst bundle: the implementation, the example documents, and the
   font files Typst cannot fetch from a URL.

   The bundle is derived from the repository, exactly like index.html, so it is
   never committed — it is built by CI into the Pages deploy and attached to a
   tagged release. `downloads/` is gitignored; run this to get it locally.

   Run: node tools/build-bundle.mjs
*/

import { readFileSync, mkdirSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const spec = JSON.parse(readFileSync('spec.json', 'utf8'));
const OUT = 'downloads/typeset-typst.zip';

/* Only the three families the implementation actually names. fonts/candidates/
   exists for the printed font proof and has no business in a bundle whose
   purpose is to make typeset.typ compile. */
const FONT_DIRS = ['fonts/EB-Garamond', 'fonts/Source-Sans-3', 'fonts/IBM-Plex-Mono'];

const typ = readFileSync('implementations/typeset.typ', 'utf8');
for (const family of ['EB Garamond', 'Source Sans 3', 'IBM Plex Mono']) {
  if (!typ.includes(`"${family}"`)) {
    throw new Error(`typeset.typ no longer names "${family}" — the bundle's font list is out of date`);
  }
}
for (const dir of FONT_DIRS) {
  if (!existsSync(dir)) throw new Error(`${dir} is missing — cannot build the bundle`);
  if (!existsSync(`${dir}/OFL.txt`)) throw new Error(`${dir}/OFL.txt is missing; the licence must ship with the fonts`);
}

const README = `typeset — Typst bundle ${spec.version}
${spec.canonical_url}

  implementations/typeset.typ             the implementation
  implementations/example-essay.typ       single column, justified
  implementations/example-letter.typ      letter, ragged right, page-foot footnote
  implementations/example-two-column.typ  two columns, equal
  fonts/                                  the three families the spec names

Compile:
  typst compile --font-path fonts implementations/example-essay.typ essay.pdf

Typst web app: drag the unzipped folder into a project. Fonts resolve by name.

Static instances, one file per weight — Typst exposes a variable font as its
default weight only, and would synthesise the rest without warning.

Fonts are OFL-1.1. Each family directory carries its OFL.txt; keep it.

spec.json is the normative source. If this implementation and the spec
disagree, the spec is right.
`;

mkdirSync('downloads', { recursive: true });
rmSync(OUT, { force: true });
writeFileSync('downloads/BUNDLE.txt', README);

/* -X drops extra file attributes, which keeps the archive a little more
   comparable between machines. Timestamps still vary, so the zip is not
   bit-reproducible — its contents are, which is what matters. */
execFileSync('zip', [
  '-qrX', OUT,
  'implementations/typeset.typ',
  'implementations/example-essay.typ',
  'implementations/example-letter.typ',
  'implementations/example-two-column.typ',
  ...FONT_DIRS,
  '-x', '.*', '-x', '*/.*',
], { stdio: 'inherit' });
execFileSync('zip', ['-qjX', OUT, 'downloads/BUNDLE.txt'], { stdio: 'inherit' });
rmSync('downloads/BUNDLE.txt');

const list = execFileSync('unzip', ['-l', OUT], { encoding: 'utf8' });
const files = Number(list.trim().split('\n').pop().trim().split(/\s+/)[1]);
const mb = (statSync(OUT).size / 1048576).toFixed(1);
console.log(`${OUT} — ${files} files, ${mb} MB, spec ${spec.version}`);

/* The versioned name the release asset uses. */
console.log(`release asset name: typeset-typst-${spec.version}.zip`);
