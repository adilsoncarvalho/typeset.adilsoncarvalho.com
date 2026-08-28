/* The specimen page reads three files at load: spec.json (normative), and the
   two implementations. Nothing on the page is transcribed by hand, so a panel
   can never drift from the file it quotes. */

const CSS_SECTION_RE = /\/\*!\s*@s\s+([a-z0-9-]+)\s*::\s*(.+?)\s*\*\/([\s\S]*?)\/\*!\s*@e\s*\*\//g;
const TYP_SECTION_RE = /\/\/\s*@s\s+([a-z0-9-]+)\s*\n([\s\S]*?)\/\/\s*@e/g;

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);

/* Foundation groups are not document elements, so three page sections read
   straight out of spec.foundation instead of spec.sections. */
const FOUNDATION_PANELS = {
  tokens: ['fonts', 'scale', 'color'],
  foundation: ['rhythm'],
  page: ['page'],
};

const state = { spec: null, css: new Map(), typ: new Map() };

function parseMarkers(source, re, cssStyle) {
  const out = new Map();
  let m;
  while ((m = re.exec(source)) !== null) {
    out.set(m[1], (cssStyle ? m[3] : m[2]).replace(/\n{3,}/g, '\n\n').trim());
  }
  return out;
}

/* ---- Spec rendering ----------------------------------------------------- */

const label = (k) => k.replace(/_/g, ' ');

function renderValue(v) {
  if (Array.isArray(v)) return v.map((x) => `<code>${esc(x)}</code>`).join(', ');
  if (v === true) return 'yes';
  if (v === false) return 'no';
  if (v && typeof v === 'object') {
    return Object.entries(v).map(([k, x]) => `${esc(label(k))}: <code>${esc(x)}</code>`).join('<br>');
  }
  if (typeof v === 'number') return `<code>${v}</code>`;
  /* A bare token name, a length or a colour is a value; a sentence is prose. */
  return /^[a-z0-9_.#%+-]+(\s(pt|mm|em))?$/i.test(v) || v.length < 26
    ? `<code>${esc(v)}</code>`
    : esc(v);
}

function propTable(props) {
  const rows = Object.entries(props)
    .map(([k, v]) => `<tr><th>${esc(label(k))}</th><td>${renderValue(v)}</td></tr>`)
    .join('');
  return `<table class="spec-table"><tbody>${rows}</tbody></table>`;
}

function renderElement(el) {
  const bits = [`<h4 class="spec-el">${esc(el.name)}`];
  if (el.opt_in) bits.push(` <span class="spec-optin">opt-in · ${esc(el.opt_in)}</span>`);
  bits.push('</h4>');
  if (el.properties) bits.push(propTable(el.properties));
  if (el.fallback) bits.push(`<p class="spec-fallback"><b>Where unsupported</b> — ${esc(el.fallback)}</p>`);
  for (const n of el.notes || []) bits.push(`<p class="spec-note">${esc(n)}</p>`);
  return bits.join('');
}

function renderTemplate(id, t) {
  const bits = [];
  if (t.opt_in) bits.push(`<p class="spec-optin-line">Opt-in · <code>${esc(t.opt_in)}</code></p>`);
  bits.push(`<p class="spec-note"><b>Use for</b> — ${esc(t.use_for)}</p>`);

  const ORDER = ['derivation', 'requirements', 'page', 'scale', 'rhythm', 'spanning', 'forbidden', 'element_overrides'];
  const keys = [...ORDER.filter((k) => k in t), ...Object.keys(t).filter((k) => !ORDER.includes(k)
    && !['name', 'opt_in', 'use_for', 'notes'].includes(k))];

  for (const k of keys) {
    const v = t[k];
    bits.push(`<h3 class="spec-group">${esc(label(k))}</h3>`);
    if (Array.isArray(v)) {
      bits.push('<ul class="spec-rules">' + v.map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>');
    } else if (v && typeof v === 'object') {
      const flat = Object.fromEntries(
        Object.entries(v).filter(([, x]) => !x || typeof x !== 'object' || Array.isArray(x)),
      );
      if (Object.keys(flat).length) bits.push(propTable(flat));
      for (const [k2, v2] of Object.entries(v)) {
        if (v2 && typeof v2 === 'object' && !Array.isArray(v2)) {
          bits.push(`<h4 class="spec-el">${esc(label(k2))}</h4>`, propTable(v2));
        }
      }
    } else {
      bits.push(`<p class="spec-note">${esc(v)}</p>`);
    }
  }
  for (const n of t.notes || []) bits.push(`<p class="spec-note">${esc(n)}</p>`);
  return bits.join('');
}

function renderSpecPanel(ids) {
  if (ids.includes(',')) {
    return ids.split(',').map((i) => {
      const sec = state.spec.sections.find((s) => s.id === i.trim());
      return (sec ? `<h3 class="spec-group">${esc(sec.title)}</h3>` : '') + renderSpecPanel(i.trim());
    }).join('');
  }
  const id = ids;

  /* A template is not a document element: it sets the page and the scale, and
     states what it overrides and what it forbids. */
  const template = state.spec.templates?.[id];
  if (template && typeof template === 'object') return renderTemplate(id, template);

  const groups = FOUNDATION_PANELS[id];
  if (groups) {
    return groups.map((g) => {
      const data = state.spec.foundation[g];
      const inner = Object.entries(data).map(([k, v]) => {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          return `<h4 class="spec-el">${esc(label(k))}</h4>${propTable(v)}`;
        }
        return null;
      }).filter(Boolean);
      const flat = Object.fromEntries(
        Object.entries(data).filter(([, v]) => !v || typeof v !== 'object' || Array.isArray(v)),
      );
      return `<h3 class="spec-group">${esc(label(g))}</h3>`
        + (Object.keys(flat).length ? propTable(flat) : '')
        + inner.join('');
    }).join('');
  }

  const sec = state.spec.sections.find((s) => s.id === id);
  if (!sec) return `<div class="err">No section “${esc(id)}” in spec.json</div>`;

  const bits = [];
  if (sec.opt_in) bits.push(`<p class="spec-optin-line">Opt-in · <code>${esc(sec.opt_in)}</code></p>`);
  if (sec.principles) {
    bits.push('<ul class="spec-rules">' + sec.principles.map((p) => `<li>${esc(p)}</li>`).join('') + '</ul>');
  }
  bits.push(sec.elements.map(renderElement).join(''));
  return bits.join('');
}

/* ---- Code rendering ----------------------------------------------------- */

function highlight(src, lang) {
  const lineComment = lang === 'typst' ? /^(\s*)(\/\/.*)$/ : null;
  let inBlock = false;

  return src.split('\n').map((line) => {
    if (lang === 'typst') {
      const m = line.match(lineComment);
      if (m) return esc(m[1]) + `<span class="c-comment">${esc(m[2])}</span>`;
      return highlightTypst(line);
    }
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end === -1) return `<span class="c-comment">${esc(line)}</span>`;
      inBlock = false;
      return `<span class="c-comment">${esc(line.slice(0, end + 2))}</span>` + highlightCss(line.slice(end + 2));
    }
    const start = line.indexOf('/*');
    if (start !== -1) {
      const end = line.indexOf('*/', start + 2);
      if (end === -1) {
        inBlock = true;
        return highlightCss(line.slice(0, start)) + `<span class="c-comment">${esc(line.slice(start))}</span>`;
      }
      return highlightCss(line.slice(0, start))
        + `<span class="c-comment">${esc(line.slice(start, end + 2))}</span>`
        + highlightCss(line.slice(end + 2));
    }
    return highlightCss(line);
  }).join('\n');
}

function highlightCss(line) {
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

function highlightTypst(line) {
  let out = esc(line);
  out = out.replace(/\b(let|set|show|import|if|else|context|none|auto|true|false)\b/g, '<span class="c-at">$1</span>');
  out = out.replace(/([\w-]+)(:)/g, '<span class="c-prop">$1</span>$2');
  out = out.replace(/(\d+(?:\.\d+)?(?:pt|mm|em|%)?)/g, '<span class="c-val">$1</span>');
  return out;
}

function codePanel(src, lang, note) {
  const wrap = document.createElement('div');
  if (note) {
    const p = document.createElement('p');
    p.className = 'code-note';
    p.textContent = note;
    wrap.append(p);
  }
  const pre = document.createElement('pre');
  pre.innerHTML = highlight(src, lang);
  wrap.append(pre, copyButton(src));
  return wrap;
}

function copyButton(text) {
  const btn = document.createElement('button');
  btn.className = 'copy';
  btn.type = 'button';
  btn.textContent = 'Copy';
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied';
      btn.dataset.done = '1';
    } catch { btn.textContent = 'Press ⌘C'; }
    setTimeout(() => { btn.textContent = 'Copy'; delete btn.dataset.done; }, 1600);
  });
  return btn;
}

/* ---- Panels ------------------------------------------------------------- */

const TYPST_ELSEWHERE = {
  paragraphs: 'foundation',
  justification: 'foundation',
  numbering: 'headings',
  'code-inline': 'codeblock',
  links: 'inline',
  'figures-numeric': 'foundation',
};
const NO_TYPST = 'No Typst-specific code. This section states rules rather than '
  + 'settings, or the engine provides the behaviour natively — see spec.json.';

function buildPanel(host) {
  const specIds = host.dataset.section;
  const id = specIds.split(',').pop().trim();
  const cssKeys = (host.dataset.css || specIds).split(',').map((s) => s.trim());

  const tabs = [
    { key: 'spec', name: 'Spec', build: () => {
      const d = document.createElement('div');
      d.className = 'spec';
      d.innerHTML = renderSpecPanel(specIds);
      return d;
    } },
    { key: 'css', name: 'CSS', build: () => {
      const missing = cssKeys.filter((k) => !state.css.has(k));
      if (missing.length) return errBox(`Not in typeset.css: ${missing.join(', ')}`);
      return codePanel(cssKeys.map((k) => state.css.get(k)).join('\n\n'), 'css');
    } },
    { key: 'typst', name: 'Typst', build: () => {
      if (state.typ.has(id)) return codePanel(state.typ.get(id), 'typst');
      const via = TYPST_ELSEWHERE[id];
      if (via && state.typ.has(via)) {
        return codePanel(
          state.typ.get(via), 'typst',
          `Set globally rather than per element — this is the “${via}” region of typeset.typ.`,
        );
      }
      return codePanel('', 'typst', NO_TYPST);
    } },
  ];

  const bar = document.createElement('div');
  bar.className = 'tabs';
  const body = document.createElement('div');
  body.className = 'tabs__body';

  const show = (key) => {
    for (const b of bar.children) b.setAttribute('aria-selected', String(b.dataset.key === key));
    const tab = tabs.find((t) => t.key === key);
    body.replaceChildren(tab.build());
    body.dataset.kind = key;
  };

  for (const t of tabs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.dataset.key = t.key;
    b.textContent = t.name;
    b.setAttribute('aria-selected', 'false');
    b.addEventListener('click', () => show(t.key));
    bar.append(b);
  }

  host.replaceChildren(bar, body);
  show('spec');
}

function errBox(msg) {
  const d = document.createElement('div');
  d.className = 'err';
  d.textContent = msg;
  return d;
}

async function init() {
  const hosts = [...document.querySelectorAll('[data-section]')];
  if (!hosts.length) return;

  try {
    const [spec, css, typ] = await Promise.all([
      fetch('spec.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`spec.json: HTTP ${r.status}`); return r.json(); }),
      fetch('typeset.css', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`typeset.css: HTTP ${r.status}`); return r.text(); }),
      fetch('implementations/typeset.typ', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`typeset.typ: HTTP ${r.status}`); return r.text(); }),
    ]);
    state.spec = spec;
    state.css = parseMarkers(css, CSS_SECTION_RE, true);
    state.typ = parseMarkers(typ, TYP_SECTION_RE, false);
  } catch (err) {
    /* Most often: opened over file://, where fetch is blocked. Say so rather
       than leaving every panel silently empty. */
    for (const h of hosts) {
      h.innerHTML = `<div class="err">Could not load the spec (${esc(err.message)}).
Serve this directory over HTTP — <b>python3 -m http.server</b> — and reload.</div>`;
    }
    return;
  }

  for (const h of hosts) buildPanel(h);

  const v = document.querySelector('[data-spec-version]');
  if (v) v.textContent = `${state.spec.version} · ${state.spec.updated}`;
}

document.addEventListener('DOMContentLoaded', init);
