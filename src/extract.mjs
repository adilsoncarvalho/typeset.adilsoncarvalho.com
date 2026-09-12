/* Pulls the document fragment out of a demo file: the markup a reader would
   copy to reproduce the example, with the page's own apparatus (the label
   that names the example, the note that explains it) stripped away.

   A demo file holds one or more examples, each shaped as:

     <p class="pair__label">…</p>
     <p class="demo-note">…</p>        (optional)
     <div …>…</div>                    (the wrapper — may nest further <div>s)

   The wrapper's closing tag cannot be found with a non-greedy regex to the
   next "</div>": a wrapper that nests its own <div>s (a callout, a table of
   figures, a sidenote layout) would close on the first nested one. Finding
   the true end requires counting <div>/</div> depth from the wrapper's own
   opening tag back to zero.

   The wrapper carries "paper" — website chrome with no counterpart in a
   real document — alongside "typeset", the document class with no options
   set. Where it also carries a modifier (typeset--ragged, typeset--numbered
   and so on), that modifier is the thing the example demonstrates, so the
   fragment is the element itself: "paper" dropped, every other class and
   attribute kept. Where the wrapper carries no modifier, the fragment is
   only its inner markup — the element itself would say nothing a plain
   "typeset" class does not already say.

   Two demos, two-column and notes.fullrow, nest the document inside scaled
   .mini page chrome, so the wrapper matched here never carries "typeset"
   itself. There the fragment starts at the first descendant that does. */

const LABEL_RE = /<p class="pair__label"[^>]*>([\s\S]*?)<\/p>/g;
const NOTE_RE = /^\s*<p class="demo-note"[^>]*>[\s\S]*?<\/p>/;
const WRAPPER_OPEN_RE = /^\s*(<div\b[^>]*>)/;
const DIV_TAG_RE = /<div\b[^>]*>|<\/div>/g;
const OPEN_TAG_RE = /<([a-z][a-z0-9]*)\b([^>]*)>/g;
const ORDINAL_RE = /^\d+\s*·\s*/;
const GENERIC_LABEL = 'How it must look';

/* Classes the stylesheet gives significant whitespace to, so that a line
   break inside the element is content rather than source layout. Only
   .ts-quotes-verse qualifies: `white-space: pre-line` is what keeps the
   poet's line breaks, and it is the sole class-declared rule in typeset.css
   that preserves a break. The other is `white-space: pre-wrap` on `.typeset
   pre`, which is the same thing declared by tag and is handled as one.

   The tag alone is not enough to find these. A verse blockquote's own tag
   sits at the fragment's indent while its content sits at column zero, so
   the shared indent collapses to zero and nothing is stripped — the tag
   keeps its source indentation and a reader copies it. */
const VERBATIM_CLASSES = ['ts-quotes-verse'];

const ANY_OPEN_TAG_RE = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;

function opensVerbatimRegion(tagName, attrs) {
  if (tagName.toLowerCase() === 'pre') return true;
  const m = attrs.match(/class="([^"]*)"/);
  if (!m) return false;
  const classes = m[1].split(/\s+/);
  return VERBATIM_CLASSES.some((c) => classes.includes(c));
}

/* The [start, end) interior of every verbatim region in `text`, outermost
   first and nested ones skipped: a region inside another is already covered
   by its parent's span.

   A region that never closes runs to the end of the text. Treating it as no
   region at all would be the worse failure: the content would be dedented
   silently, and the gate that would otherwise catch that cannot fire, because
   finding an interior to compare needs the closing tag this text does not
   have. Running to the end protects the content and leaves the unclosed tag
   to be noticed as a fragment that stops making sense. */
function verbatimRegions(text) {
  const regions = [];
  ANY_OPEN_TAG_RE.lastIndex = 0;
  let m;
  while ((m = ANY_OPEN_TAG_RE.exec(text)) !== null) {
    if (!opensVerbatimRegion(m[1], m[2])) continue;
    const close = findMatchingClose(text, ANY_OPEN_TAG_RE.lastIndex, m[1]);
    regions.push([ANY_OPEN_TAG_RE.lastIndex, close === -1 ? text.length : close]);
    if (close === -1) break;
    ANY_OPEN_TAG_RE.lastIndex = close;
  }
  return regions;
}

/* Returns one boolean per line of `text` split on "\n": true where that
   line's own start sits inside a verbatim region. A line where the region
   opens partway through is false — its leading whitespace is still HTML
   indentation — and a line where the region closes partway through is
   true: it was still verbatim content when it began. */
export function verbatimLineMask(text) {
  const regions = verbatimRegions(text);
  const mask = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    mask.push(regions.some(([start, end]) => start < offset && offset <= end));
    offset += line.length + 1;
  }
  return mask;
}

/* Removes each line's shared leading whitespace. A blank line contributes
   nothing to the shared amount and is left empty, never padded. A line
   inside a verbatim region is excluded from both the shared-amount
   computation and the stripping itself: its leading whitespace is content,
   not markup indentation, so it is carried through byte-for-byte. Without
   that exclusion, one under-indented code sample or verse line would pull
   the shared amount for the whole fragment down — for every other line, not
   just its own. */
function dedent(text) {
  const lines = text.split('\n');
  const verbatim = verbatimLineMask(text);
  let common = Infinity;
  for (let i = 0; i < lines.length; i += 1) {
    if (verbatim[i] || lines[i].trim() === '') continue;
    common = Math.min(common, lines[i].match(/^ */)[0].length);
  }
  if (!Number.isFinite(common)) common = 0;
  return lines
    .map((line, i) => {
      if (verbatim[i]) return line;
      return line.trim() === '' ? '' : line.slice(common);
    })
    .join('\n');
}

/* Strips exactly the one structural newline dedent() leaves at each end — the
   line break right after the wrapper's opening tag, and the one before its
   closing tag's own indent. A plain .trim() would go on to eat a first line
   that still carries indentation after dedent(), which happens whenever the
   block's shared indent is zero (see dedent() above). */
function trimBlock(text) {
  return text.replace(/^\n/, '').replace(/\n[ \t]*$/, '');
}

/* Finds the tag matching the one that has just opened, by walking forward
   and counting nested opens and closes of that same tag name. Returns the
   index of the matching close tag, or -1 if the markup never closes it.
   Defaults to <div>, the tag every wrapper this module reads is built from;
   the two demos that nest their document in <article> instead pass that
   tag name so the depth count tracks the right element. */
function findMatchingClose(source, fromIndex, tag = 'div') {
  const re = tag === 'div' ? DIV_TAG_RE : new RegExp(`<${tag}\\b[^>]*>|<\\/${tag}>`, 'g');
  re.lastIndex = fromIndex;
  let depth = 1;
  let match;
  while ((match = re.exec(source)) !== null) {
    if (match[0].startsWith('</')) {
      depth -= 1;
      if (depth === 0) return match.index;
    } else {
      depth += 1;
    }
  }
  return -1;
}

/* Splits a tag's own class attribute into its space-separated tokens. Never
   matched against with a word-boundary regex: a hyphen is not a word
   character, so "\btypeset\b" matches the first half of "typeset--ragged"
   too. Splitting on whitespace first and comparing whole tokens avoids that
   entirely — there is no substring left for a modifier class to hide in. */
function classesOf(openTag) {
  const m = openTag.match(/class="([^"]*)"/);
  return m ? m[1].split(/\s+/).filter(Boolean) : [];
}

/* True where `classes` carries anything beyond the two structural classes
   every wrapper starts from: "paper" (website chrome) and "typeset" (the
   document class with no options set). Any other class is itself what the
   example demonstrates. */
function hasModifier(classes) {
  return classes.some((c) => c !== 'paper' && c !== 'typeset');
}

/* Removes one token from the first class attribute in `text` — which, for
   every caller here, belongs to the opening tag `text` itself begins with.
   Tokens are compared whole, for the same reason classesOf() splits rather
   than pattern-matches. */
function dropClass(text, token) {
  return text.replace(/class="([^"]*)"/, (_, cls) =>
    `class="${cls.split(/\s+/).filter((c) => c !== token).join(' ')}"`);
}

/* The run of spaces and tabs immediately before `index`, however far back
   it goes — not the whole line it sits on, which could carry other markup
   before it. Reconstructing just this run lets dedent() see the element's
   true source indentation once its opening tag is sliced out on its own. */
function leadingWhitespaceBefore(source, index) {
  let i = index;
  while (i > 0 && (source[i - 1] === ' ' || source[i - 1] === '\t')) i -= 1;
  return source.slice(i, index);
}

/* Walks forward from `from` (bounded by `to`, the outer wrapper's own close)
   for the first descendant tag whose class list carries the literal token
   "typeset". Used only where the wrapper matched by WRAPPER_OPEN_RE is page
   chrome around the document rather than the document element itself. */
function findTypesetElement(source, from, to) {
  OPEN_TAG_RE.lastIndex = from;
  let m;
  while ((m = OPEN_TAG_RE.exec(source)) !== null && m.index < to) {
    if (classesOf(m[0]).includes('typeset')) {
      return { tag: m[1], openTag: m[0], contentStart: OPEN_TAG_RE.lastIndex };
    }
  }
  return null;
}

/* Finds the <div> matching the one that has just opened, by walking forward
   and counting nested opens and closes. Returns the index of the matching
   "</div>", or -1 if the markup never closes it. */
function findMatchingDivClose(source, fromIndex) {
  return findMatchingClose(source, fromIndex, 'div');
}

/* Resolves the element the fragment must be built from: the wrapper itself
   where it carries "typeset" directly, or the first descendant that does,
   for the two demos where the wrapper is .mini page-scaling chrome instead.
   A demo whose wrapper carries no "typeset" anywhere — page.html renders a
   decorative page diagram, not the document — has no modifier to look for
   either, so it falls back to the wrapper itself: the fragment stays its
   plain inner markup, exactly as for any other unmodified wrapper. */
function resolveTarget(source, wrapperOpenTag, contentStart, wrapperClose) {
  if (classesOf(wrapperOpenTag).includes('typeset')) {
    return { tag: 'div', openTag: wrapperOpenTag, contentStart, closeIndex: wrapperClose };
  }
  const found = findTypesetElement(source, contentStart, wrapperClose);
  if (found) {
    const closeIndex = findMatchingClose(source, found.contentStart, found.tag);
    if (closeIndex !== -1) {
      return { tag: found.tag, openTag: found.openTag, contentStart: found.contentStart, closeIndex };
    }
  }
  return { tag: 'div', openTag: wrapperOpenTag, contentStart, closeIndex: wrapperClose };
}

/* Apparatus the specimen page adds inside a demo's document markup. The label
   above an example and the note beside it are already dropped before the
   wrapper is read; this is the same thing one level in, for apparatus that has
   to sit inside the document to render in the right place.

   It attaches in two shapes, so it comes off in two.

   An element that exists only for the specimen comes out whole. The print
   note in the links demo says what a printer will do with the sample above
   it — commentary, true of no document. The folio in the contents demo is a
   hand-written page number standing in for the one `.ts-toc a::after`
   generates with target-counter; spec.json declares no folio element, and
   publishing the span would make a real document set the page number twice.

   A class the specimen adds to an element the document does need comes off on
   its own, and the element stays. `ts-toc--demo` only suppresses that
   generated number so a browser shows one figure rather than two. `demo-aside`
   only sets a document paragraph smaller — and in the numerals demo that
   paragraph carries the sole `.ts-numerals-fractions` in the repo, so taking
   the element would take the demonstration with it. */
export const APPARATUS_ELEMENTS = new Set(['demo-note', 'demo-print-note', 'ts-folio']);
export const APPARATUS_CLASSES = new Set(['demo-aside', 'ts-toc--demo']);

/* Removes both shapes from a fragment. Elements go first, so a class list
   that names one of each resolves as the element it is rather than the class
   it also wears. A line left holding nothing but its own indent goes too:
   dedent() writes an intentionally blank line as the empty string, so a line
   of pure whitespace can only be what a removal left behind. */
export function stripApparatus(fragment) {
  const openTag = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let out = fragment;
  for (;;) {
    openTag.lastIndex = 0;
    let m;
    let cut = null;
    while ((m = openTag.exec(out)) !== null) {
      if (!classesOf(m[0]).some((c) => APPARATUS_ELEMENTS.has(c))) continue;
      const close = findMatchingClose(out, openTag.lastIndex, m[1]);
      if (close === -1) break;
      cut = [m.index, close + `</${m[1]}>`.length];
      break;
    }
    if (!cut) break;
    out = out.slice(0, cut[0]) + out.slice(cut[1]);
  }

  out = out.replace(/(\s*)class="([^"]*)"/g, (whole, space, cls) => {
    const kept = cls.split(/\s+/).filter(Boolean).filter((c) => !APPARATUS_CLASSES.has(c));
    return kept.length ? `${space}class="${kept.join(' ')}"` : '';
  });

  return out.split('\n').filter((line) => !/^[ \t]+$/.test(line)).join('\n')
    .replace(/^\n+/, '').replace(/\n+$/, '');
}

/* Takes a demo file's text and returns one { label, html, source } per
   example. label is the pair__label text with any leading "N · " ordinal
   stripped, or null where the label is the generic "How it must look".

   source is the fragment resolveTarget() finds — the target element with
   "paper" dropped where it carries a modifier, otherwise just its inner
   markup — dedented to its common indent and trimmed. It is exactly what the
   demo file holds, which is what makes the extractor's round trip checkable.

   html is source with the specimen's own apparatus taken out, and is what the
   panel publishes. The two differ because a fragment has two jobs that pull
   apart: proving the extractor lost nothing, and giving a reader markup they
   can paste into a document that has typeset.css and nothing else. */
export function extractDemos(source) {
  const demos = [];
  LABEL_RE.lastIndex = 0;
  let labelMatch;
  while ((labelMatch = LABEL_RE.exec(source)) !== null) {
    let cursor = LABEL_RE.lastIndex;

    const noteMatch = source.slice(cursor).match(NOTE_RE);
    if (noteMatch) cursor += noteMatch[0].length;

    const wrapperMatch = source.slice(cursor).match(WRAPPER_OPEN_RE);
    if (!wrapperMatch) continue;
    const contentStart = cursor + wrapperMatch[0].length;

    const wrapperClose = findMatchingDivClose(source, contentStart);
    if (wrapperClose === -1) continue;

    const target = resolveTarget(source, wrapperMatch[1], contentStart, wrapperClose);

    let html;
    if (hasModifier(classesOf(target.openTag))) {
      const openStart = target.contentStart - target.openTag.length;
      const indent = leadingWhitespaceBefore(source, openStart);
      const closeTagEnd = target.closeIndex + `</${target.tag}>`.length;
      const whole = indent + source.slice(openStart, closeTagEnd);
      html = trimBlock(dedent(dropClass(whole, 'paper')));
    } else {
      html = trimBlock(dedent(source.slice(target.contentStart, target.closeIndex)));
    }

    const labelText = labelMatch[1].trim().replace(ORDINAL_RE, '');
    const label = labelText === GENERIC_LABEL ? null : labelText;

    demos.push({ label, html: stripApparatus(html), source: html });

    LABEL_RE.lastIndex = wrapperClose + '</div>'.length;
  }
  return demos;
}
