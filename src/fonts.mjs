/* Where a font family is read from when a template is assembled — the one
   expression that decides which side of the CSS-bundle boundary a family
   sits on.

   A family fonts/manifest.json marks `role: "spec"` is the specification's,
   and a template consumes it from downloads/typeset-css.zip rather than from
   this repository's own fonts/: reading it here would give the template a
   second, silently drifting copy of exactly what the bundle exists to be the
   one copy of. Every other role is the template's own and reads from fonts/
   directly, the same way its iawriter.css and page.css do.

   It lives here rather than inside tools/build-iawriter.mjs so that
   tools/check.mjs can call it and assert where a path lands, instead of
   reading the builder's source and hoping the spelling implies the
   behaviour. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const FONT_MANIFEST = 'fonts/manifest.json';

export const fontManifest = () => JSON.parse(readFileSync(FONT_MANIFEST, 'utf8'));

/* The directory `dir`'s faces are read from, given the directory a CSS bundle
   has been unpacked into. Throws for a directory the manifest does not list:
   an unlisted family has no role, so nothing here can say which side of the
   boundary it belongs on, and guessing is how a spec family ends up shipping
   from the repository root. */
export function resolveFontDir(dir, bundleDir, manifest = fontManifest()) {
  const entry = manifest.families.find((f) => f.dir === dir);
  if (!entry) {
    throw new Error(`${dir} is not listed in ${FONT_MANIFEST} — cannot tell whether it ships `
      + "from the CSS bundle or the template's own fonts/");
  }
  return entry.role === 'spec' ? join(bundleDir, dir) : dir;
}
