# Known limits

What this specification asks for and an implementation does not yet deliver,
and what the checker cannot see. Each entry was verified against the tree on
2026-09-14; re-verify rather than trusting this file, and delete an entry the
moment it stops being true.

Where a limit affects a document's *output*, `spec.json` discloses it on the
element itself as a `fallback`, which the site publishes as "Where unsupported".
This file is for the ones with no single element to hang from.

## Typst

**`#pagebreak()` cannot be called in a `typeset()` document.** The measure is
applied as a block, and a page break is not allowed inside a container:

```
error: pagebreaks are not allowed inside of containers
```

So `utility-break-before` and `utility-break-after` have no reachable Typst
counterpart. Fixing it is a design question about how `typeset()` should assert a
measure, not a patch.

**A hanging indent does not survive a container.** Verified across `block()`,
`block(inset:)` and `pad()` — only a bare paragraph in flow honours it. That is
why `quote-verse`'s runover indent and `bibliography-entry`'s hanging indent both
carry a `fallback`. A faithful implementation means laying the lines out
individually rather than relying on `hanging-indent`.

**A table caption sets below the table**, where `spec.json` says above. `figure`'s
caption is correct; the fix is a kind-aware caption rule rather than a patch to
the one that exists.

**`dropcap()` reads `body.text`**, which only holds when the body is a bare
string. Any markup and the cap is taken from the wrong character, silently.

## The checker

**The CSS arm asserts source text; the Typst arm measures a render.** Three
rounds of adversarial review found constructions that passed a CSS-side assertion
while breaking the feature — a missing combinator, a retargeted ancestor, an
unchecked container. The Typst side held against the same attacks because it
compiles the document and reads the output.

This is structural: there is no headless browser in this toolchain. Closing it
means adding one (Playwright or Puppeteer driving Paged.js, as the site itself
does) and asserting computed layout instead of declared rules. Until then, expect
the CSS arm of any new gate to have the same shape of blind spot.

**The link gate does not check fragments.** It resolves every `href` on every
generated page, but a link to `#a-heading-that-moved` passes.

## The site

**`/fonts/` 404s.** There is no `fonts/index.html` and `.nojekyll` is set, so
directory listing is off. No link points there any more — the two that did were
fixed when the CSS bundle gave them something real to point at — but the path
itself is dead, and `fonts/manifest.json` is the obvious source for a generated
index.

## The templates boundary

`build-iawriter.mjs` consumes the published CSS bundle rather than reaching into
`typeset.css` and `fonts/`, and a gate enforces that. But extracting
`/templates/` into its own repository is **not yet a rename**. Six things still
reach across:

- cheap to close — `spec.json`, `fonts/manifest.json`, `fonts/Cormorant-Garamond/`
- a redesign — the site builder, `src/viewers.json`, and the capability matrix's
  six `#L<n>` anchors into `typeset.typ`

---

*The planning documents that produced 2.0.0 — ten implementation plans and the
restructure design — were removed on 2026-09-14 once the work shipped. They are
in the git history if the reasoning behind a decision is ever wanted;
`docs/migrating-to-2.0.md` is the account written for a reader rather than for
the work.*
