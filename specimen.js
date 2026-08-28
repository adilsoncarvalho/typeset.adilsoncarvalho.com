/* The only script the specimen page needs.

   Everything else is resolved at build time by tools/build-site.mjs: the spec
   tables, both code panels and the syntax highlighting are plain markup in the
   page, and the Spec / CSS / Typst tabs are radio inputs driven by CSS. So this
   file exists for one reason — copy buttons, which cannot be done without it. */

document.addEventListener('DOMContentLoaded', () => {
  for (const btn of document.querySelectorAll('[data-copy]')) {
    const pre = btn.closest('.codewrap')?.querySelector('pre');
    if (!pre) continue;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pre.textContent);
        btn.textContent = 'Copied';
        btn.dataset.done = '1';
      } catch {
        btn.textContent = 'Press ⌘C';
      }
      setTimeout(() => { btn.textContent = 'Copy'; delete btn.dataset.done; }, 1600);
    });
  }
});
