/* The navigation bar for an example document.

   It is built here rather than written into the markup because Paged.js moves
   every child of <body> into its page boxes — the bar included, where its own
   reset hides it. Its `after` hook did not reliably put it back, so the bar is
   never in the DOM while Paged.js is working: it is mounted once pagination has
   produced its pages. Documents that do not use Paged.js get it immediately. */

(function () {
  const script = document.currentScript;
  const label = script.dataset.label || document.title;
  const note = script.dataset.note || '';

  /* Styled inline, and with no `ts-screen-only` class.

     Paged.js applies `@media print` rules unconditionally in order to build its
     preview, so anything marked screen-only disappears under it; and its
     stylesheet rewriting dropped the .preview-bar rule from preview.css
     outright. Inline styles are immune to both, and printing is handled by
     removing the element rather than by a media query. */
  const BAR = 'position:fixed;top:0;left:0;right:0;z-index:10;display:flex;'
    + 'align-items:center;gap:1rem;padding:0.5rem 1rem;background:#24211e;'
    + 'color:#e8e3db;font:400 0.8125rem/1.4 "Source Sans 3",sans-serif;';
  const LINK = 'color:#e8e3db;text-decoration:none;border-bottom:1px solid #6b6560;';
  const HINT = 'color:#a09890;margin-left:auto;';

  function build() {
    const bar = document.createElement('div');
    bar.className = 'preview-bar';
    bar.setAttribute('style', BAR);

    const back = document.createElement('a');
    back.href = '../spec/index.html';
    back.textContent = '← typeset';
    back.setAttribute('style', LINK);

    const name = document.createElement('b');
    name.textContent = label;

    const hint = document.createElement('span');
    hint.textContent = note;
    hint.setAttribute('style', HINT);

    bar.append(back, name, hint);
    return bar;
  }

  function mount() {
    if (document.querySelector('body > .preview-bar')) return true;
    const bar = build();
    document.body.prepend(bar);

    /* Neither the bar nor the rest of the screen chrome may print, and no media
       query can be trusted to remove it: Paged.js rewrites preview.css and
       drops rules from it, the @media print block included. Left in place, the
       wrapper's screen padding paints a grey band above the first sheet and
       pushes a blank page off the end. So the reset is applied as inline styles,
       which nothing can drop, and undone afterwards. */
    const screenOnly = [];

    const stash = (el, prop, value) => {
      if (!el) return;
      screenOnly.push([el, prop, el.style.getPropertyValue(prop)]);
      el.style.setProperty(prop, value);
    };

    window.addEventListener('beforeprint', () => {
      bar.remove();
      stash(document.documentElement, 'background', 'none');
      stash(document.body, 'background', 'none');
      for (const el of document.querySelectorAll('.pagedjs_pages')) {
        stash(el, 'margin', '0');
        stash(el, 'padding', '0');
      }
      for (const el of document.querySelectorAll('.pagedjs_page')) {
        stash(el, 'margin', '0');
        stash(el, 'box-shadow', 'none');
      }
    });

    window.addEventListener('afterprint', () => {
      for (const [el, prop, value] of screenOnly.reverse()) {
        if (value) el.style.setProperty(prop, value);
        else el.style.removeProperty(prop);
      }
      screenOnly.length = 0;
      document.body.prepend(bar);
    });

    return true;
  }

  function whenReady() {
    /* No Paged.js on this page: nothing will move the bar, so mount now. */
    if (!window.PagedPolyfill && !window.PagedConfig) { mount(); return; }

    /* Otherwise wait for pagination to have produced at least one page. */
    const started = Date.now();
    const timer = setInterval(() => {
      if (document.querySelector('.pagedjs_pages')) {
        clearInterval(timer);
        mount();
      } else if (Date.now() - started > 20000) {
        /* Pagination failed or is not coming. A document with no way back is
           worse than one with a bar in an odd place, so mount regardless. */
        clearInterval(timer);
        mount();
      }
    }, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', whenReady);
  } else {
    whenReady();
  }
})();
