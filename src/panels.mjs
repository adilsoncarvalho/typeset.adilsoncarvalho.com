/* Renders the Spec / HTML-or-CSS / Typst panel for one section, at build
   time. Ported from the browser code it replaces: same output, no fetch,
   no runtime. The second pane is HTML — the markup that produces the
   example — for every section except tokens, foundation and page, which
   state values rather than demonstrate a document and get the CSS that
   sets those values instead; src/sections.json declares which. */

import { byLang, esc } from './highlight.mjs';

/* Three page sections describe foundation groups rather than document elements,
   so they read out of spec.foundation instead of spec.sections. */
const FOUNDATION_PANELS = {
  tokens: ['fonts', 'scale', 'color'],
  foundation: ['rhythm'],
  page: ['page'],
};

/* Sections whose Typst values are set globally rather than per element: the
   snippet itself still shows the section, but the deep link into the full
   source points at the region that carries the setting instead of at the
   section's own name, which typeset.typ never marks. */
const TYPST_ELSEWHERE = {
  numbering: 'headings',
  'code-inline': 'codeblock',
  links: 'inline',
  numerals: 'foundation',
};

const NO_TYPST_REGION = 'No dedicated region in typeset.typ — this section reads off Typst’s '
  + 'own constructs directly, or the engine provides the behaviour natively. See spec.json.';

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

/* Links each of a section's CSS keys to the line its "@s" marker starts at
   in files/typeset-css.html, which carries an id="L<n>" anchor on every
   line — so a reader can find the full rule that styles the fragment. */
function cssRegionNote(cssKeys, cssLines) {
  const links = cssKeys.map((k) =>
    `<a href="files/typeset-css.html#L${cssLines.get(k)}">${esc(k)}</a>`).join(', ');
  return `Full rule${cssKeys.length > 1 ? 's' : ''} in typeset.css — ${links}`;
}

/* Renders the markup that produces the example beside the panel: each
   fragment extract.mjs pulled from the section's demo file, preceded by an
   HTML comment naming it wherever the section shows more than one. */
function htmlPane(fragments, cssKeys, cssLines) {
  const source = fragments
    .map((f) => (f.label ? `<!-- ${f.label} -->\n${f.html}` : f.html))
    .join('\n\n');
  const head = `<p class="code-note">${cssRegionNote(cssKeys, cssLines)}</p>`;
  const body = source ? `<pre>${byLang('html', source)}</pre>` : '';
  const copy = source ? `<button class="copy" type="button" data-copy>Copy</button>` : '';
  return `<div class="codewrap">${head}${body}${copy}</div>`;
}

/* Renders the CSS source for a section that states values rather than
   demonstrating a document — tokens, foundation and page — where there is
   no markup for a reader to copy and the values themselves are the thing
   on show. */
function cssPane(cssKeys, cssMap) {
  const source = cssKeys.map((k) => cssMap.get(k)).join('\n\n');
  return codePane(source, 'css');
}

/* Links a section's Typst snippet back to the region of typeset.typ it
   demonstrates, the way cssRegionNote() links the HTML/CSS pane back to
   typeset.css — except not every section marks its own region there:
   TYPST_ELSEWHERE covers a value set globally rather than per element, and a
   section that does neither reads off Typst's own constructs with no
   dedicated region to point at. */
function typstRegionNote(id, typLines) {
  if (typLines.has(id)) {
    return `Full implementation in typeset.typ — <a href="files/typeset-typ.html#L${typLines.get(id)}">${esc(id)}</a>`;
  }
  const via = TYPST_ELSEWHERE[id];
  if (via && typLines.has(via)) {
    return `Set globally rather than per element — this is the “${esc(via)}” region of typeset.typ: `
      + `<a href="files/typeset-typ.html#L${typLines.get(via)}">${esc(via)}</a>`;
  }
  return NO_TYPST_REGION;
}

/* Renders the Typst snippet that produces the example: src/demos/<id>.typ,
   the fragment a reader would drop into a document that imports typeset.typ
   — the third tab's counterpart to the HTML/CSS pane above. Every section
   has one (tools/check.mjs gates it), so unlike the HTML pane there is no
   empty case to render. */
function typstPane(typSource, id, typLines) {
  const head = `<p class="code-note">${typstRegionNote(id, typLines)}</p>`;
  const body = `<pre>${byLang('typst', typSource)}</pre>`;
  return `<div class="codewrap">${head}${body}<button class="copy" type="button" data-copy>Copy</button></div>`;
}

export function renderPanel({
  spec, cssLines, cssMap, typLines, specIds, cssKeys, id, fragments, typSource, pane,
}) {
  const missing = cssKeys.filter((k) => !cssLines.has(k));
  if (missing.length) throw new Error(`typeset.css has no section marker for ${missing.join(', ')}`);

  const secondPane = pane === 'css' ? cssPane(cssKeys, cssMap) : htmlPane(fragments, cssKeys, cssLines);
  const secondLabel = pane === 'css' ? 'CSS' : 'HTML';

  /* Tabs are radio inputs so the panel works with no JavaScript at all. The
     pane shown is selected by sibling position, which is why the three panes
     must be the only <div> children here — see .tabs in specimen.css. */
  const n = `tab-${id.replace(/[^a-z0-9-]/g, '')}`;
  return `<div class="panel">
  <div class="tabs">
    <input type="radio" name="${n}" id="${n}-spec" checked>
    <label for="${n}-spec">Spec</label>
    <input type="radio" name="${n}" id="${n}-second">
    <label for="${n}-second">${secondLabel}</label>
    <input type="radio" name="${n}" id="${n}-typst">
    <label for="${n}-typst">Typst</label>
    <span class="tabs__rule"></span>
    <div class="tabs__pane tabs__pane--spec"><div class="spec">${renderSpec(spec, specIds)}</div></div>
    <div class="tabs__pane">${secondPane}</div>
    <div class="tabs__pane">${typstPane(typSource, id, typLines)}</div>
  </div>
</div>`;
}
