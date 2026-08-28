/* Renders the Spec / CSS / Typst panel for one section, at build time.
   Ported from the browser code it replaces: same output, no fetch, no runtime. */

import { byLang, esc } from './highlight.mjs';

/* Three page sections describe foundation groups rather than document elements,
   so they read out of spec.foundation instead of spec.sections. */
const FOUNDATION_PANELS = {
  tokens: ['fonts', 'scale', 'color'],
  foundation: ['rhythm'],
  page: ['page'],
};

/* Sections whose Typst values are set globally rather than per element: point
   at the region that carries them instead of showing an empty tab. */
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

const label = (k) => k.replace(/_/g, ' ');

function renderValue(v) {
  if (Array.isArray(v)) return v.map((x) => `<code>${esc(x)}</code>`).join(', ');
  if (v === true) return 'yes';
  if (v === false) return 'no';
  if (v && typeof v === 'object') {
    return Object.entries(v).map(([k, x]) => `${esc(label(k))}: <code>${esc(x)}</code>`).join('<br>');
  }
  if (typeof v === 'number') return `<code>${v}</code>`;
  /* A token name, a length or a colour is a value; a sentence is prose. */
  return /^[a-z0-9_.#%+-]+(\s(pt|mm|em))?$/i.test(v) || String(v).length < 26
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

function renderTemplate(t) {
  const bits = [];
  if (t.opt_in) bits.push(`<p class="spec-optin-line">Opt-in · <code>${esc(t.opt_in)}</code></p>`);
  bits.push(`<p class="spec-note"><b>Use for</b> — ${esc(t.use_for)}</p>`);

  const ORDER = ['derivation', 'requirements', 'page', 'scale', 'rhythm', 'spanning',
    'forbidden', 'element_overrides'];
  const skip = new Set(['name', 'opt_in', 'use_for', 'notes']);
  const keys = [...ORDER.filter((k) => k in t),
    ...Object.keys(t).filter((k) => !ORDER.includes(k) && !skip.has(k))];

  for (const k of keys) {
    const v = t[k];
    bits.push(`<h3 class="spec-group">${esc(label(k))}</h3>`);
    if (Array.isArray(v)) {
      bits.push('<ul class="spec-rules">' + v.map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>');
    } else if (v && typeof v === 'object') {
      const flat = Object.fromEntries(
        Object.entries(v).filter(([, x]) => !x || typeof x !== 'object' || Array.isArray(x)));
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

export function renderSpec(spec, ids) {
  if (ids.includes(',')) {
    return ids.split(',').map((raw) => {
      const id = raw.trim();
      const sec = spec.sections.find((x) => x.id === id);
      return (sec ? `<h3 class="spec-group">${esc(sec.title)}</h3>` : '') + renderSpec(spec, id);
    }).join('');
  }

  const template = spec.templates?.[ids];
  if (template && typeof template === 'object') return renderTemplate(template);

  const groups = FOUNDATION_PANELS[ids];
  if (groups) {
    return groups.map((g) => {
      const data = spec.foundation[g];
      const flat = Object.fromEntries(
        Object.entries(data).filter(([, v]) => !v || typeof v !== 'object' || Array.isArray(v)));
      const nested = Object.entries(data)
        .filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v))
        .map(([k, v]) => `<h4 class="spec-el">${esc(label(k))}</h4>${propTable(v)}`);
      return `<h3 class="spec-group">${esc(label(g))}</h3>`
        + (Object.keys(flat).length ? propTable(flat) : '')
        + nested.join('');
    }).join('');
  }

  const sec = spec.sections.find((x) => x.id === ids);
  if (!sec) throw new Error(`no section, template or foundation group "${ids}" in spec.json`);

  const bits = [];
  if (sec.opt_in) bits.push(`<p class="spec-optin-line">Opt-in · <code>${esc(sec.opt_in)}</code></p>`);
  if (sec.principles) {
    bits.push('<ul class="spec-rules">'
      + sec.principles.map((p) => `<li>${esc(p)}</li>`).join('') + '</ul>');
  }
  bits.push(sec.elements.map(renderElement).join(''));
  return bits.join('');
}

export function codePane(source, lang, note) {
  const head = note ? `<p class="code-note">${esc(note)}</p>` : '';
  const body = source ? `<pre>${byLang(lang, source)}</pre>` : '';
  const copy = source
    ? `<button class="copy" type="button" data-copy>Copy</button>`
    : '';
  return `<div class="codewrap">${head}${body}${copy}</div>`;
}

export function renderPanel({ spec, cssMap, typMap, specIds, cssKeys, id }) {
  const missing = cssKeys.filter((k) => !cssMap.has(k));
  if (missing.length) throw new Error(`typeset.css has no section marker for ${missing.join(', ')}`);

  const cssSource = cssKeys.map((k) => cssMap.get(k)).join('\n\n');

  let typstPane;
  if (typMap.has(id)) {
    typstPane = codePane(typMap.get(id), 'typst');
  } else {
    const via = TYPST_ELSEWHERE[id];
    typstPane = (via && typMap.has(via))
      ? codePane(typMap.get(via), 'typst',
          `Set globally rather than per element — this is the “${via}” region of typeset.typ.`)
      : codePane('', 'typst', NO_TYPST);
  }

  /* Tabs are radio inputs so the panel works with no JavaScript at all. The
     pane shown is selected by sibling position, which is why the three panes
     must be the only <div> children here — see .tabs in specimen.css. */
  const n = `tab-${id.replace(/[^a-z0-9-]/g, '')}`;
  return `<div class="panel">
  <div class="tabs">
    <input type="radio" name="${n}" id="${n}-spec" checked>
    <label for="${n}-spec">Spec</label>
    <input type="radio" name="${n}" id="${n}-css">
    <label for="${n}-css">CSS</label>
    <input type="radio" name="${n}" id="${n}-typst">
    <label for="${n}-typst">Typst</label>
    <span class="tabs__rule"></span>
    <div class="tabs__pane tabs__pane--spec"><div class="spec">${renderSpec(spec, specIds)}</div></div>
    <div class="tabs__pane">${codePane(cssSource, 'css')}</div>
    <div class="tabs__pane">${typstPane}</div>
  </div>
</div>`;
}
