/* Builds the iA Writer letter template: a bundle, zipped one template to an
   archive because that is what the iOS and Windows installers accept.

   There is no two-column template. WebKit's print path ignores every CSS
   multi-column property, so a CSS two-column template previews in two columns
   and exports in one; laying the columns out in JavaScript instead worked in
   both paths under test but not in iA Writer itself. Two columns belong to an
   engine that can paginate them — Typst does it natively.

   A bundle is assembled rather than committed as a zip, for the same reason the
   Typst bundle is: it carries a copy of typeset.css and of every font file, and
   a copy that is committed is a copy that drifts. Assembling it here means the
   template can only ever ship the stylesheet that is in this repository.

   `downloads/` is gitignored; run this to get the bundles locally.

   Run: node tools/build-iawriter.mjs
*/

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

const spec = JSON.parse(readFileSync('spec.json', 'utf8'));
const SRC = 'implementations/iawriter';
const OUT = 'downloads';

/* Which families a bundle carries is derived from the @font-face rules in the
   stylesheets it actually links, not from a list kept here. The letter binds two
   Cormorant faces for its letterhead that the two-column template has no use
   for, and a hand-maintained list would either ship them to both or go stale the
   first time one moves. fonts/candidates/ stays out for free: nothing binds it. */
function familyDirs(sheets) {
  const dirs = new Set();
  for (const css of sheets) {
    for (const m of css.matchAll(/url\("(fonts\/[^"/]+)\/[^"]+"\)/g)) dirs.add(m[1]);
  }
  return [...dirs].sort();
}

const TEMPLATES = [
  {
    dir: 'letter',
    bundle: 'typeset-letter.iatemplate',
    summary: 'A letter on A4 at 20mm on all four sides. EB Garamond at 11pt, ragged right,\n'
      + 'filling the page the margins leave.',
    notes: `The display quote
  A \`>\` quote is set centred in Cormorant Garamond Light Italic at 1.3x the
  body size, with no rule and no indent. Markdown has only one quoting
  construct, so in a letter it does the job a pull quote does. This is
  letter-only: the two-column template keeps the standard block quotation.

The letterhead
  Indent a block by a tab or four spaces and it becomes your address, set in
  Cormorant Garamond Light at 11pt — the same family as the quote, upright
  rather than italic. Markdown calls that construct a code block;
  the letter template strips every mark of code off it — the wash, the rule and
  the monospaced face — because it is the only construct Markdown has that keeps
  your line breaks without a paragraph's indent and justification rules.

      # Adilson Carvalho

          10 Wentworth Avenue
          Surry Hills NSW 2010

  It follows that an indented block anywhere else in the letter is set as an
  address too — there is no second indented construct to tell them apart.
`,
  },
];

/* ---- Guards -------------------------------------------------------------- */

const fail = (msg) => { throw new Error(msg); };

const css = readFileSync('typeset.css', 'utf8');
const adapter = readFileSync(`${SRC}/iawriter.css`, 'utf8');

for (const family of Object.values(spec.foundation.fonts)) {
  if (!family.family) continue;
  if (!css.includes(`"${family.family}"`)) {
    fail(`typeset.css no longer names "${family.family}" — the bundle's font list is out of date`);
  }
}
if (!adapter.includes('@font-face')) {
  fail(`${SRC}/iawriter.css declares no @font-face — the spec's families would not resolve`);
}

mkdirSync(OUT, { recursive: true });

/* Any template bundle in downloads/ that this run does not produce is the
   leftover of a template that has since been removed, and it stays downloadable
   until something deletes it. Withdrawing a template should withdraw its
   download, so the stale ones go here rather than lingering until someone
   notices. Scoped to bundles this tool owns: the Typst zip belongs to
   build-bundle.mjs and is not touched, and a version-stamped copy of a bundle
   this run did build is left alone, because the release job makes those. */
const owned = new Set(TEMPLATES.flatMap((t) => {
  const base = t.bundle.replace(/\.iatemplate$/, '');
  return [`${base}.iatemplate.zip`, `${base}-${spec.version}.iatemplate.zip`];
}));
for (const f of readdirSync(OUT)) {
  if (f.endsWith('.iatemplate.zip') && !owned.has(f)) {
    rmSync(`${OUT}/${f}`);
    console.log(`removed ${OUT}/${f} — no template produces it any more`);
  }
}

/* ---- Assemble ------------------------------------------------------------ */

const built = [];

for (const t of TEMPLATES) {
  const from = `${SRC}/${t.dir}`;
  const stage = `${OUT}/${t.bundle}`;
  const res = `${stage}/Contents/Resources`;

  const plist = readFileSync(`${from}/Info.plist`, 'utf8');
  const version = plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
  if (version !== spec.version) {
    fail(`${from}/Info.plist declares version ${version}, spec.json says ${spec.version}`);
  }

  /* Every page the property list names must exist, and every page must be named
     by it: an orphan HTML file in a bundle is a page iA Writer will never load. */
  const declared = [...plist.matchAll(/<key>IATemplate(?:Document|Title|Header|Footer)File<\/key>\s*<string>([^<]+)<\/string>/g)]
    .map((m) => `${m[1]}.html`);
  const present = readdirSync(from).filter((f) => f.endsWith('.html'));
  for (const f of declared) {
    if (!present.includes(f)) fail(`${from}/Info.plist names ${f}, which does not exist`);
  }
  for (const f of present) {
    if (!declared.includes(f)) fail(`${from}/${f} is not named by any IATemplate*File key`);
  }

  rmSync(stage, { recursive: true, force: true });
  mkdirSync(res, { recursive: true });

  cpSync(`${from}/Info.plist`, `${stage}/Contents/Info.plist`);
  for (const f of present) cpSync(`${from}/${f}`, `${res}/${f}`);
  cpSync(`${from}/example.md`, `${res}/example.md`);

  /* The stylesheets and scripts each page actually asks for, and only those. A
     template that carries a stylesheet nothing links is a template with a
     second, silent definition of the typography. */
  const wanted = new Set();
  const scripts = new Set();
  for (const f of present) {
    const page = readFileSync(`${from}/${f}`, 'utf8');
    for (const m of page.matchAll(/href="([^"]+\.css)"/g)) wanted.add(m[1]);
    for (const m of page.matchAll(/<script[^>]+src="([^"]+\.js)"/g)) scripts.add(m[1]);
  }
  for (const js of scripts) {
    const source = [`${from}/${js}`, `${SRC}/${js}`].find((c) => existsSync(c));
    if (!source) fail(`${from} loads ${js}, which does not exist`);
    cpSync(source, `${res}/${basename(js)}`);
  }
  for (const sheet of wanted) {
    /* Template-local first, then the shared layer, then the stylesheet itself:
       page.css is per template because the two do not share a page, while
       iawriter.css is one file for both. */
    const source = [`${from}/${sheet}`, `${SRC}/${sheet}`, sheet]
      .find((candidate) => existsSync(candidate));
    if (!source) fail(`${from} links ${sheet}, which does not exist`);
    cpSync(source, `${res}/${basename(sheet)}`);
  }

  /* A face WebKit cannot find is substituted without a warning, which is the
     whole failure a bundle exists to prevent — so a broken `src` is caught here
     rather than discovered in a PDF. */
  const sheets = [...wanted].map((sheet) =>
    readFileSync([`${from}/${sheet}`, `${SRC}/${sheet}`, sheet].find((c) => existsSync(c)), 'utf8'));
  const faces = sheets.flatMap((c) => [...c.matchAll(/url\("(fonts\/[^"]+)"\)/g)].map((m) => m[1]));
  if (!faces.length) fail(`${from} links no @font-face at all — every family would fall back`);
  for (const f of faces) {
    if (!existsSync(f)) fail(`${from} binds ${f}, which does not exist`);
  }

  for (const dir of familyDirs(sheets)) {
    if (!existsSync(`${dir}/OFL.txt`)) fail(`${dir}/OFL.txt is missing; the licence must ship with the fonts`);
    cpSync(dir, `${res}/fonts/${basename(dir)}`, { recursive: true });
  }

  writeFileSync(`${res}/README.txt`, `typeset — iA Writer template ${spec.version}
${spec.canonical_url}

${t.summary}

Install
  macOS    double-click the bundle, or drag it onto the iA Writer icon
  iOS      AirDrop the .zip, or "Copy to iA Writer" from Files
  Windows  File > Install Template, and choose the .zip

example.md is the document this template was set against. Open it in iA Writer
and switch the template on to see the whole of it at once.

What Markdown can say
  Headings, body text, bold, italic, tables, footnotes and one quoting
  construct. That is the whole vocabulary, and this template is built for
  exactly it. The specification's signature block, callouts, sidenotes and drop
  caps need markup Markdown has no way to write, so they are not here. What you
  get is the page, the scale and the apparatus — set correctly.

  There is no running head and no folio. iA Writer reserves those bands by
  setting the page margins itself, so a band and the page margin cannot both be
  declared — and the page is the thing worth having.

${t.notes ?? ''}
Fonts are bundled and bound by name in iawriter.css. Static instances, one file
per weight: a face WebKit cannot find is synthesised without a warning.

Fonts are OFL-1.1. Each family directory carries its OFL.txt; keep it.

spec.json is the normative source. If this template and the spec disagree, the
spec is right.
`);

  /* -X drops extra file attributes, which keeps the archive a little more
     comparable between machines. Timestamps still vary, so the zip is not
     bit-reproducible — its contents are, which is what matters. */
  const zip = `${t.bundle}.zip`;
  rmSync(`${OUT}/${zip}`, { force: true });
  execFileSync('zip', ['-qrX', zip, t.bundle, '-x', '.*', '-x', '*/.*'], { cwd: OUT, stdio: 'inherit' });
  rmSync(stage, { recursive: true, force: true });

  const list = execFileSync('unzip', ['-l', `${OUT}/${zip}`], { encoding: 'utf8' });
  const files = Number(list.trim().split('\n').pop().trim().split(/\s+/)[1]);
  const mb = (statSync(`${OUT}/${zip}`).size / 1048576).toFixed(1);
  built.push({ zip, files, mb });
  console.log(`${OUT}/${zip} — ${files} files, ${mb} MB, spec ${spec.version}`);
}

/* The versioned names the release assets use. */
for (const b of built) {
  console.log(`release asset name: ${b.zip.replace('.iatemplate.zip', `-${spec.version}.iatemplate.zip`)}`);
}
