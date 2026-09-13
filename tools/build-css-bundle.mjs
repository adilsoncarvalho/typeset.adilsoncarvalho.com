/* Builds the CSS bundle: the implementation, and the three spec font
   families Google Fonts and system stacks cannot be relied on to have —
   with their OFL licences. The CSS counterpart of what tools/build-bundle.mjs
   already does for Typst.

   The bundle is derived from the repository, exactly like index.html, so it is
   never committed — it is built by CI into the Pages deploy. `downloads/` is
   gitignored; run this to get it locally.

   Run: node tools/build-css-bundle.mjs
*/

import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const spec = JSON.parse(readFileSync('spec.json', 'utf8'));
const manifest = JSON.parse(readFileSync('fonts/manifest.json', 'utf8'));
const OUT = 'downloads/typeset-css.zip';

const css = readFileSync('typeset.css', 'utf8');

/* Which families this bundle carries is derived from spec.foundation.fonts,
   not a hand-kept list here: that object is the one place a family is named
   and licensed, and tools/check.mjs, tools/build-iawriter.mjs and
   tools/build-site.mjs already read it (or fonts/manifest.json's "spec"
   entries, which are keyed off it) rather than each keeping their own copy.
   `embedding` carries a policy string, not a family, so it is skipped the
   same way tools/check.mjs skips it. */
const FONT_DIRS = Object.entries(spec.foundation.fonts)
  .filter(([role]) => role !== 'embedding')
  .map(([role, font]) => {
    if (!css.includes(`"${font.family}"`)) {
      throw new Error(`typeset.css no longer names "${font.family}" — the bundle's font list is out of date`);
    }
    const entry = manifest.families.find((f) => f.family === font.family && f.role === 'spec');
    if (!entry) {
      throw new Error(`fonts/manifest.json has no "spec" entry for "${font.family}", which `
        + `spec.foundation.fonts.${role} names — regenerate the manifest`);
    }
    return entry.dir;
  });

for (const dir of FONT_DIRS) {
  if (!existsSync(dir)) throw new Error(`${dir} is missing — cannot build the bundle`);
  if (!existsSync(`${dir}/OFL.txt`)) throw new Error(`${dir}/OFL.txt is missing; the licence must ship with the fonts`);
}

/* The manifest lines for typeset.css and fonts/ stay literal here, the same
   way tools/build-bundle.mjs keeps its own two non-example lines literal:
   neither is a shipped example, so src/examples.mjs has no entry for either.
   Column widths are computed rather than hand-aligned, so a longer path
   never leaves the descriptions ragged. */
const MANIFEST_ENTRIES = [
  { file: 'typeset.css', description: 'the implementation' },
  { file: 'fonts/', description: 'the three families the spec names' },
];
const manifestPathWidth = Math.max(...MANIFEST_ENTRIES.map((e) => e.file.length));
const manifestLines = MANIFEST_ENTRIES
  .map((e) => `  ${e.file.padEnd(manifestPathWidth)}  ${e.description}`)
  .join('\n');

const README = `typeset — CSS bundle ${spec.version}
${spec.canonical_url}

${manifestLines}

Use:
  <link rel="stylesheet" href="typeset.css">

typeset.css names its three families by name and leaves loading them to the
document — it declares no @font-face of its own. Bind each face in fonts/
with its own @font-face rule, at the weight and style its filename carries
(a file WebKit cannot find is synthesised without warning: a smeared bold, or
an italic obtained by shearing an upright).

Fonts are OFL-1.1. Each family directory carries its OFL.txt; keep it.

spec.json is the normative source. If this stylesheet and the spec disagree,
the spec is right.
`;

mkdirSync('downloads', { recursive: true });
rmSync(OUT, { force: true });

/* Staged outside downloads/ rather than written there and deleted after the
   zip is made. tools/legacy-urls.mjs derives what downloads/ will contain by
   reading the paths these builders name — that is what lets a pull request,
   where downloads/ is empty, tell whether a link to a bundle resolves — and a
   file that only ever exists mid-build would be registered as shipping. */
const stage = mkdtempSync(join(tmpdir(), 'typeset-css-bundle-'));
const readmePath = join(stage, 'BUNDLE.txt');
writeFileSync(readmePath, README);

/* -X drops extra file attributes, which keeps the archive a little more
   comparable between machines. Timestamps still vary, so the zip is not
   bit-reproducible — its contents are, which is what matters. */
execFileSync('zip', [
  '-qrX', OUT,
  'typeset.css',
  ...FONT_DIRS,
  '-x', '.*', '-x', '*/.*',
], { stdio: 'inherit' });
execFileSync('zip', ['-qjX', OUT, readmePath], { stdio: 'inherit' });
rmSync(stage, { recursive: true, force: true });

const list = execFileSync('unzip', ['-l', OUT], { encoding: 'utf8' });
const files = Number(list.trim().split('\n').pop().trim().split(/\s+/)[1]);
const mb = (statSync(OUT).size / 1048576).toFixed(1);
console.log(`${OUT} — ${files} files, ${mb} MB, spec ${spec.version}`);

/* The versioned name the release asset would use, printed for parity with
   tools/build-bundle.mjs and tools/build-iawriter.mjs — this bundle is not
   yet attached to a release; see .github/workflows/deploy.yml. */
console.log(`asset name: typeset-css-${spec.version}.zip`);
