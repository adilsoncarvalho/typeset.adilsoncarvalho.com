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

/* Removes each line's shared leading whitespace. A blank line contributes
   nothing to the shared amount and is left empty, never padded. Preformatted
   content (a <pre><code> block whose own lines are indented on their own
   terms) can pull the shared amount down to zero; when it does, every line
   keeps its original indentation rather than being torn out from under it. */
function dedent(text) {
  const lines = text.split('\n');
  let common = Infinity;
  for (const line of lines) {
    if (line.trim() === '') continue;
    common = Math.min(common, line.match(/^ */)[0].length);
  }
  if (!Number.isFinite(common)) common = 0;
  return lines.map((line) => (line.trim() === '' ? '' : line.slice(common))).join('\n');
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
