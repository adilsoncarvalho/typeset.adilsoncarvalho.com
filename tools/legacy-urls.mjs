/* The URLs this site published before the specification moved to /spec/, and
   the resolver that says whether one of them still resolves.

   tools/check.mjs holds every URL in tools/legacy-urls.json against
   resolveUrl() below, so a restructure that quietly drops an inbound link
   fails a pull request instead of a reader's bookmark. The site is linked
   from llms.txt — the file this project publishes for machines — and from a
   GitHub release, so a URL that stops resolving is a regression whatever it
   tidies.

   The snapshot is derived, never hand-written: every href and src on every
   published page, every absolute site URL in llms.txt and README.md, every
   id on a page that carries prose anchors, and one entry per directory index.
   Each entry records the status it had when the snapshot was taken, so a URL
   that was already broken (fonts/ has no index and directory listing is off)
   is held to "no worse than it was" rather than to "fixed".

   Regenerate only to ADD a URL that a release or an external document has
   published. Never to drop one: dropping one is the regression this file
   exists to catch.

   Run: node tools/legacy-urls.mjs          # rewrites tools/legacy-urls.json
   Run: node tools/legacy-urls.mjs --check  # prints what does not resolve
*/

import { readFileSync, existsSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { EXAMPLES } from '../src/examples.mjs';

export const SNAPSHOT = 'tools/legacy-urls.json';

/* Everything rsync'd into _site that a reader can be holding a link to.
   tools/, src/ and docs/ are deliberately absent: they ship, but nothing
   publishes a URL into them, and a file renamed there is ordinary churn
   rather than a broken inbound link. */
const PAGE_DIRS = ['.', 'files', 'examples', 'proofs', 'spec', 'templates'];

/* Line-number anchors on a viewer page — files/typeset-css.html carries one
   per line of the stylesheet. The ones a panel actually links to arrive
   through that link; harvesting the rest would bury the snapshot under four
   thousand entries that no document outside this repository has ever named. */
const LINE_ANCHOR = /^L\d+$/;

const read = (p) => readFileSync(p, 'utf8');

/* ---- Resolution ---------------------------------------------------------- */

/* previews/ and downloads/ are gitignored and built in CI (see
   .github/workflows/deploy.yml), so on a pull request — where this gate runs —
   the filesystem cannot answer for them. The builder that emits each one is
   asked instead: previews/ from the example list tools/build-previews.mjs
   itself derives its filenames from, downloads/ from the tools that name the
   archive they write. */
export function derivedPaths() {
  const paths = new Set();
  for (const e of EXAMPLES) {
    for (let n = 1; n <= e.pages; n += 1) paths.add(`previews/${e.id}-${n}.svg`);
  }
  const tools = readdirSync('tools')
    .filter((f) => f.endsWith('.mjs') && f !== 'legacy-urls.mjs')
    .map((f) => read(`tools/${f}`))
    .join('\n');
  for (const m of tools.matchAll(/['"`]([\w.-]+\.(?:zip|iatemplate\.zip))['"`]/g)) {
    paths.add(`downloads/${m[1]}`);
  }
  for (const m of tools.matchAll(/downloads\/([\w.-]+)/g)) paths.add(`downloads/${m[1]}`);
  return paths;
}

/* "spec/index.html" for "spec/", "index.html" for "". A URL ending in "/" —
   or the site root — is served by the index inside it. */
function documentFor(path) {
  if (path === '' || path.endsWith('/')) return `${path}index.html`;
  if (existsSync(path) && statSync(path).isDirectory()) return `${path}/index.html`;
  return path;
}

/* The allowlist a page forwards fragments with, read out of the page rather
   than executed: tools/build-site.mjs emits the forwarding script with a
   data-fragment-forward attribute naming where it sends them, and the ids it
   will forward as a JSON array literal. A page with no such script forwards
   nothing. */
export function fragmentForward(html) {
  const m = html.match(/<script data-fragment-forward="([^"]*)">([\s\S]*?)<\/script>/);
  if (!m) return null;
  const ids = m[2].match(/\bids\s*=\s*(\[[^\]]*\])/);
  if (!ids) return null;
  return { to: m[1], ids: new Set(JSON.parse(ids[1])) };
}

/* Whether a site URL resolves, and by what route. `how` is reported so a
   snapshot records that a URL used to 404 rather than pretending it did not:
   fonts/ is a directory with no index and .nojekyll turns listing off, which
   is a known defect this gate must not make worse and does not fix. */
export function resolveUrl(url, derived = derivedPaths()) {
  const [rawPath, ...rest] = url.split('#');
  const frag = rest.join('#');
  const path = rawPath.replace(/^\//, '');

  if (derived.has(path)) return frag ? { ok: false, how: 'no-anchor' } : { ok: true, how: 'built' };

  const doc = documentFor(path);
  if (!existsSync(doc) || statSync(doc).isDirectory()) return { ok: false, how: 'missing' };
  if (!frag) return { ok: true, how: 'file' };

  const html = read(doc);
  const id = decodeURIComponent(frag);
  if (html.includes(`id="${id}"`)) return { ok: true, how: 'anchor' };

  const forward = fragmentForward(html);
  if (forward && forward.ids.has(id)) {
    const onward = resolveUrl(`${forward.to}#${frag}`, derived);
    return onward.ok ? { ok: true, how: `forwarded to ${forward.to}` } : { ok: false, how: 'forward-dead' };
  }
  return { ok: false, how: 'no-anchor' };
}

/* ---- Harvesting ---------------------------------------------------------- */

/* Joins a page-relative href onto the directory the page sits in, the way a
   browser does, and returns null for anything that is not a path on this
   site. */
export function siteUrl(fromPage, href) {
  if (/^(https?:|mailto:|data:|javascript:|\/\/)/i.test(href)) {
    const local = href.match(/^https?:\/\/typeset\.adilsoncarvalho\.com\/(.*)$/);
    return local ? local[1] : null;
  }
  if (href.startsWith('#')) return `${fromPage}${href}`;
  const dir = fromPage.includes('/') ? fromPage.slice(0, fromPage.lastIndexOf('/') + 1) : '';
  const joined = `${dir}${href}`;
  const out = [];
  for (const part of joined.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  /* A href ending in "/" names a directory, which is served by the index
     inside it — kept as written so the snapshot records the URL a reader
     actually holds. */
  return out.join('/') + (joined.endsWith('/') ? '/' : '');
}

function pages() {
  const found = [];
  for (const dir of PAGE_DIRS) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.html')) continue;
      found.push(dir === '.' ? name : `${dir}/${name}`);
    }
  }
  return found.sort();
}

export function harvest() {
  const urls = new Set(['']);
  const html = pages();

  for (const page of html) {
    urls.add(page);
    if (page.endsWith('/index.html')) urls.add(page.replace(/index\.html$/, ''));
    const source = read(page);
    for (const m of source.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = siteUrl(page, m[1]);
      if (url !== null) urls.add(url);
    }
    /* Anchors are harvested from the prose pages, where an id is something a
       reader links to. A viewer page's ids are line numbers; see LINE_ANCHOR. */
    for (const m of source.matchAll(/id="([^"]+)"/g)) {
      if (!LINE_ANCHOR.test(m[1])) urls.add(`${page}#${m[1]}`);
    }
  }

  for (const file of ['llms.txt', 'README.md']) {
    for (const m of read(file).matchAll(/https:\/\/typeset\.adilsoncarvalho\.com\/([^\s)"'>]+)/g)) {
      urls.add(m[1].replace(/[.,]$/, ''));
    }
  }

  return [...urls].sort();
}

/* CLI */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const derived = derivedPaths();
  if (process.argv.includes('--check')) {
    const snapshot = JSON.parse(read(SNAPSHOT));
    let bad = 0;
    for (const [url, was] of Object.entries(snapshot.urls)) {
      const now = resolveUrl(url, derived);
      if (!now.ok && was !== 'missing' && was !== 'no-anchor') {
        console.error(`  ✗ ${url || '/'} — was ${was}, now ${now.how}`);
        bad += 1;
      }
    }
    console.log(bad ? `${bad} dead` : `all ${Object.keys(snapshot.urls).length} resolve`);
    process.exit(bad ? 1 : 0);
  }
  const urls = {};
  for (const url of harvest()) urls[url] = resolveUrl(url, derived).how;
  writeFileSync(SNAPSHOT, `${JSON.stringify({ note: JSON.parse(read(SNAPSHOT)).note, urls }, null, 2)}\n`);
  console.log(`${SNAPSHOT} — ${Object.keys(urls).length} URLs`);
}
