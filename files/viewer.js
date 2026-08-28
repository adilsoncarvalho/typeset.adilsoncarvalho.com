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
});
