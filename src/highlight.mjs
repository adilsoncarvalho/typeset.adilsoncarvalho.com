/* One syntax highlighter, used by the build. Deliberately small and
 dependency-free: it colours the four languages this site actually publishes,
 and nothing else.

 This runs at build time only — the published pages ship highlighted markup
 and no highlighter. */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);

/* ---- CSS: line-oriented, with one piece of cross-line state ------------ */

function cssLine(line) {
  if (!line.trim()) return esc(line);
  const at = line.match(/^(\s*)(@[\w-]+)(.*)$/);
  if (at) return esc(at[1]) + `<span class="c-at">${esc(at[2])}</span>` + esc(at[3]);
  const decl = line.match(/^(\s*)([-\w]+)(\s*:\s*)(.+?)(;?)$/);
  if (decl) {
    return esc(decl[1]) + `<span class="c-prop">${esc(decl[2])}</span>` + esc(decl[3])
      + `<span class="c-val">${esc(decl[4])}</span>` + esc(decl[5]);
  }
  if (/[{,]\s*$/.test(line) || /^\s*\}/.test(line)) return `<span class="c-sel">${esc(line)}</span>`;
  return esc(line);
}

function css(src) {
  let inBlock = false;
  return src.split('\n').map((line) => {
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end === -1) return `<span class="c-comment">${esc(line)}</span>`;
      inBlock = false;
      return `<span class="c-comment">${esc(line.slice(0, end + 2))}</span>` + cssLine(line.slice(end + 2));
    }
    const start = line.indexOf('/*');
    if (start !== -1) {
      const end = line.indexOf('*/', start + 2);
      if (end === -1) {
        inBlock = true;
        return cssLine(line.slice(0, start)) + `<span class="c-comment">${esc(line.slice(start))}</span>`;
      }
      return cssLine(line.slice(0, start))
        + `<span class="c-comment">${esc(line.slice(start, end + 2))}</span>`
        + cssLine(line.slice(end + 2));
    }
    return cssLine(line);
  }).join('\n');
}

/* ---- Typst ------------------------------------------------------------- */

function typst(src) {
  return src.split('\n').map((line) => {
    const c = line.match(/^(\s*)(\/\/.*)$/);
    if (c) return esc(c[1]) + `<span class="c-comment">${esc(c[2])}</span>`;
    let out = esc(line);
    out = out.replace(/\b(let|set|show|import|if|else|context|assert|none|auto|true|false)\b/g,
      '<span class="c-at">$1</span>');
    out = out.replace(/([\w-]+)(:)/g, '<span class="c-prop">$1</span>$2');
    out = out.replace(/(\d+(?:\.\d+)?(?:pt|mm|em|%)?)/g, '<span class="c-val">$1</span>');
    return out;
  }).join('\n');
}

/* ---- JSON -------------------------------------------------------------- */

function json(src) {
  return src.split('\n').map((line) => {
    const kv = line.match(/^(\s*)("(?:[^"\\]|\\.)*")(\s*:\s*)(.*)$/);
    if (kv) {
      return esc(kv[1]) + `<span class="c-prop">${esc(kv[2])}</span>` + esc(kv[3]) + jsonValue(kv[4]);
    }
    return jsonValue(line);
  }).join('\n');
}

function jsonValue(v) {
  const trailing = v.match(/^(.*?)(,?)$/);
  const body = trailing[1], comma = trailing[2];
  if (/^\s*"(?:[^"\\]|\\.)*"\s*$/.test(body)) return `<span class="c-val">${esc(body)}</span>` + comma;
  if (/^\s*-?\d/.test(body)) return `<span class="c-num">${esc(body)}</span>` + comma;
  if (/^\s*(true|false|null)\s*$/.test(body)) return `<span class="c-at">${esc(body)}</span>` + comma;
  return esc(v);
}

/* ---- Markdown ---------------------------------------------------------- */

function markdown(src) {
  let inFence = false;
  return src.split('\n').map((line) => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return `<span class="c-comment">${esc(line)}</span>`; }
    if (inFence) return esc(line);
    if (/^#{1,6}\s/.test(line)) return `<span class="c-sel">${esc(line)}</span>`;
    if (/^\s*\|/.test(line)) return `<span class="c-prop">${esc(line)}</span>`;
    if (/^\s*[-*]\s/.test(line)) {
      const m = line.match(/^(\s*[-*]\s)(.*)$/);
      return `<span class="c-at">${esc(m[1])}</span>` + inlineMd(m[2]);
    }
    if (/^>/.test(line)) return `<span class="c-comment">${esc(line)}</span>`;
    return inlineMd(line);
  }).join('\n');
}

function inlineMd(s) {
  return esc(s)
    .replace(/(`[^`]+`)/g, '<span class="c-val">$1</span>')
    .replace(/(\*\*[^*]+\*\*)/g, '<span class="c-prop">$1</span>');
}

function byLang(lang, src) {
  if (lang === 'css') return css(src);
  if (lang === 'typst') return typst(src);
  if (lang === 'json') return json(src);
  if (lang === 'markdown' || lang === 'md') return markdown(src);
  return esc(src);
}

export { css, typst, json, markdown, byLang, esc };
