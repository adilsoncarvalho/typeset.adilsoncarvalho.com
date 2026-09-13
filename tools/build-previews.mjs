/* Renders each shipped Typst example to SVG, one file per page, into a
   gitignored previews/ directory — the pages a Typst viewer page shows so a
   reader can see the rendered document without installing Typst themselves.

   previews/ is derived, never committed, the same as downloads/: it is built
   by CI into the Pages deploy. Run this to get it locally.

   Run: node tools/build-previews.mjs
*/

import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

/* The three shipped examples. Kept in sync by hand with
   tools/build-bundle.mjs's own zip file list and tools/check.mjs's
   EXAMPLE_TYP_FILES — neither of those exposes a shared, importable
   constant, so this is a third hand-maintained copy of the same three
   paths rather than a derivation from either. */
const EXAMPLES = [
  { id: 'essay', file: 'implementations/example-essay.typ' },
  { id: 'letter', file: 'implementations/example-letter.typ' },
  { id: 'two-column', file: 'implementations/example-two-column.typ' },
];

function typstAvailable() {
  try {
    execFileSync('typst', ['--version'], { stdio: 'ignore', timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

if (!typstAvailable()) {
  console.error('typst is not on PATH — cannot render the example previews.');
  console.error('Install typst (https://typst.app) and re-run node tools/build-previews.mjs.');
  process.exit(1);
}

const OUT_DIR = 'previews';
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

for (const { id, file } of EXAMPLES) {
  if (!existsSync(file)) {
    console.error(`${file} is missing — cannot render its preview`);
    process.exit(1);
  }
  /* --creation-timestamp 0 keeps the SVG bytes reproducible across runs;
     --format svg with a "{n}" output path gives one file per page. */
  execFileSync('typst', [
    'compile', '--font-path', 'fonts', '--creation-timestamp', '0', '--format', 'svg',
    file, `${OUT_DIR}/${id}-{n}.svg`,
  ], { stdio: 'inherit' });
}

console.log(`previews/ built for ${EXAMPLES.length} examples.`);
