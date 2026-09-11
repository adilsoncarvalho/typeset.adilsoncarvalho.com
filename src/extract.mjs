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
   opening tag back to zero. */

const LABEL_RE = /<p class="pair__label"[^>]*>([\s\S]*?)<\/p>/g;
const NOTE_RE = /^\s*<p class="demo-note"[^>]*>[\s\S]*?<\/p>/;
const WRAPPER_OPEN_RE = /^\s*(<div\b[^>]*>)/;
const DIV_TAG_RE = /<div\b[^>]*>|<\/div>/g;
const ORDINAL_RE = /^\d+\s*·\s*/;
const GENERIC_LABEL = 'How it must look';

const PRE_TAG_RE = /<pre\b[^>]*>|<\/pre>/gi;

/* Returns one boolean per line of `text` split on "\n": true where that
   line's own start sits inside an open <pre>…</pre> region. A line where
   <pre> opens partway through is false — its leading whitespace is still
   HTML indentation — and a line where </pre> closes partway through is
   true — it was still preformatted content when it began. */
export function preLineMask(text) {
  const tags = [];
  let m;
  PRE_TAG_RE.lastIndex = 0;
  while ((m = PRE_TAG_RE.exec(text)) !== null) {
    tags.push({ index: m.index, open: !m[0].startsWith('</') });
  }
  const lines = text.split('\n');
  const mask = [];
  let depth = 0;
  let tagPos = 0;
  let offset = 0;
  for (const line of lines) {
    while (tagPos < tags.length && tags[tagPos].index < offset) {
      depth += tags[tagPos].open ? 1 : -1;
      tagPos += 1;
    }
    mask.push(depth > 0);
    offset += line.length + 1;
  }
  return mask;
}

/* Removes each line's shared leading whitespace. A blank line contributes
   nothing to the shared amount and is left empty, never padded. A line
   inside a <pre> is excluded from both the shared-amount computation and
   the stripping itself: its leading whitespace is code content, not markup
   indentation, so it is carried through byte-for-byte. Without that
   exclusion, one under-indented code sample would pull the shared amount
   for the whole fragment down — for every other line, not just its own. */
function dedent(text) {
  const lines = text.split('\n');
  const inPre = preLineMask(text);
  let common = Infinity;
  for (let i = 0; i < lines.length; i += 1) {
    if (inPre[i] || lines[i].trim() === '') continue;
    common = Math.min(common, lines[i].match(/^ */)[0].length);
  }
  if (!Number.isFinite(common)) common = 0;
  return lines
    .map((line, i) => {
      if (inPre[i]) return line;
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

/* Finds the <div> matching the one that has just opened, by walking forward
   and counting nested opens and closes. Returns the index of the matching
   "</div>", or -1 if the markup never closes it. */
function findMatchingClose(source, fromIndex) {
  DIV_TAG_RE.lastIndex = fromIndex;
  let depth = 1;
  let match;
  while ((match = DIV_TAG_RE.exec(source)) !== null) {
    if (match[0] === '</div>') {
      depth -= 1;
      if (depth === 0) return match.index;
    } else {
      depth += 1;
    }
  }
  return -1;
}

/* Takes a demo file's text and returns one { label, html } per example.
   label is the pair__label text with any leading "N · " ordinal stripped,
   or null where the label is the generic "How it must look". html is the
   wrapper's inner markup, dedented to its common indent and trimmed. */
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

    const closeIndex = findMatchingClose(source, contentStart);
    if (closeIndex === -1) continue;

    const html = trimBlock(dedent(source.slice(contentStart, closeIndex)));

    const labelText = labelMatch[1].trim().replace(ORDINAL_RE, '');
    const label = labelText === GENERIC_LABEL ? null : labelText;

    demos.push({ label, html });

    LABEL_RE.lastIndex = closeIndex + '</div>'.length;
  }
  return demos;
}
