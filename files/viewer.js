/* The file contents are rendered into the page at build time by
   tools/build-site.mjs, so this only wires up the copy button. */

document.addEventListener('DOMContentLoaded', () => {
  const body = document.querySelector('.filebody');
  if (!body) return;

  /* Read the text back out of the numbered lines, without the line numbers. */
  const text = [...body.querySelectorAll('.line .src')].map((el) => el.textContent).join('\n');

  for (const btn of document.querySelectorAll('[data-copy]')) {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied';
        btn.dataset.done = '1';
      } catch {
        btn.textContent = 'Press ⌘C';
      }
      setTimeout(() => { btn.textContent = 'Copy'; delete btn.dataset.done; }, 1800);
    });
  }

  /* A Typst example page (tools/build-site.mjs) ships every preview <img>
     unconditionally, because that script has no compiler on PATH and cannot
     tell at build time whether tools/build-previews.mjs has been run on this
     checkout. previews/ is rebuilt wholesale on every run, so the first
     page's load result stands for all of them: if it fails, show the message
     that names the command instead of leaving a broken image on the page. */
  const preview = document.querySelector('.preview[data-preview]');
  if (preview) {
    const pages = preview.querySelector('.preview__pages');
    const missing = preview.querySelector('.preview__missing');
    const first = pages.querySelector('img');
    /* `hidden` only suppresses .preview__pages because viewer.css neutralises
       it — see the [hidden] rule at the top of that file for why. */
    const showMissing = () => { pages.hidden = true; missing.hidden = false; };
    /* The image may already have resolved (loaded or failed) by the time this
       deferred script runs — a cached image in particular can beat it — so a
       failure already past is read back from .complete/.naturalWidth rather
       than relying on an "error" event that already fired. */
    if (first.complete) {
      if (first.naturalWidth === 0) showMissing();
    } else {
      first.addEventListener('error', showMissing, { once: true });
    }
  }
});
