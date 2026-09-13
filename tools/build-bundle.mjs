/* Builds the Typst bundle: the implementation, the example documents, and the
   font files Typst cannot fetch from a URL.

   The bundle is derived from the repository, exactly like index.html, so it is
   never committed — it is built by CI into the Pages deploy and attached to a
   tagged release. `downloads/` is gitignored; run this to get it locally.

   Run: node tools/build-bundle.mjs
*/

import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXAMPLES } from '../src/examples.mjs';

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

/* The manifest lines for typeset.typ and fonts/ stay literal here — they
   are not shipped examples, so src/examples.mjs has no entry for them.
   Column widths are computed rather than hand-aligned, so a longer example
   path never leaves the descriptions ragged. */
const MANIFEST_ENTRIES = [
  { file: 'implementations/typeset.typ', description: 'the implementation' },
  ...EXAMPLES.map(({ file, description }) => ({ file, description })),
  { file: 'fonts/', description: 'the three families the spec names' },
];
const manifestPathWidth = Math.max(...MANIFEST_ENTRIES.map((e) => e.file.length));
const manifestLines = MANIFEST_ENTRIES
  .map((e) => `  ${e.file.padEnd(manifestPathWidth)}  ${e.description}`)
  .join('\n');

/* The compile line names one example rather than all three, so it needs that
   one by id. Every other lookup in this file reports what to fix by name; a
   bare property read on `undefined` would not. */
const compileExample = EXAMPLES.find((e) => e.id === 'essay');
if (!compileExample) {
  throw new Error('src/examples.mjs has no "essay" entry — the bundle README\'s compile '
    + 'line names it; point that line at another example, or restore the id');
}

const README = `typeset — Typst bundle ${spec.version}
${spec.canonical_url}

${manifestLines}

Compile:
  typst compile --font-path fonts ${compileExample.file} essay.pdf

Typst web app: drag the unzipped folder into a project. Fonts resolve by name.

Static instances, one file per weight — Typst exposes a variable font as its
default weight only, and would synthesise the rest without warning.

Fonts are OFL-1.1. Each family directory carries its OFL.txt; keep it.

spec.json is the normative source. If this implementation and the spec
disagree, the spec is right.
`;

mkdirSync('downloads', { recursive: true });
rmSync(OUT, { force: true });

/* Staged outside downloads/ rather than written there and deleted after the
   zip is made. tools/legacy-urls.mjs derives what downloads/ will contain by
   reading the paths these builders name — that is what lets a pull request,
   where downloads/ is empty, tell whether a link to a bundle resolves — and a
   file that only ever exists mid-build would be registered as shipping. */
const stage = mkdtempSync(join(tmpdir(), 'typeset-typst-bundle-'));
const readmePath = join(stage, 'BUNDLE.txt');
writeFileSync(readmePath, README);

/* -X drops extra file attributes, which keeps the archive a little more
   comparable between machines. Timestamps still vary, so the zip is not
   bit-reproducible — its contents are, which is what matters. */
execFileSync('zip', [
  '-qrX', OUT,
  'implementations/typeset.typ',
  ...EXAMPLES.map((e) => e.file),
  ...FONT_DIRS,
  '-x', '.*', '-x', '*/.*',
], { stdio: 'inherit' });
execFileSync('zip', ['-qjX', OUT, readmePath], { stdio: 'inherit' });
rmSync(stage, { recursive: true, force: true });

const list = execFileSync('unzip', ['-l', OUT], { encoding: 'utf8' });
const files = Number(list.trim().split('\n').pop().trim().split(/\s+/)[1]);
const mb = (statSync(OUT).size / 1048576).toFixed(1);
console.log(`${OUT} — ${files} files, ${mb} MB, spec ${spec.version}`);

/* The versioned name the release asset uses. */
console.log(`release asset name: typeset-typst-${spec.version}.zip`);
