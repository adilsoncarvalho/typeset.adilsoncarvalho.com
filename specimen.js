/* The only script the specimen page needs.

   Everything else is resolved at build time by tools/build-site.mjs: the spec
   tables, both code panels and the syntax highlighting are plain markup in the
   page, and the Spec / CSS / Typst tabs are radio inputs driven by CSS. This
   file supplies the two things a build step cannot: copy buttons, and the
   nav's scrollspy. Both are progressive enhancement — the copy buttons fall
   back to manual selection, and the nav's fragment links work with no script
   and no marking. */

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

  initScrollspy();
});

/* Marks the nav entry for the section currently at the top of the viewport,
   and keeps that entry visible inside the nav's own scrollable list. Reads
   its targets from the nav's own "#id" links, so it tracks exactly the ids
   the nav publishes — not the page's tab-state radio ids, and not anything
   a future nav entry doesn't yet name. No-ops without IntersectionObserver,
   leaving the nav's plain fragment links working as they do today. */
function initScrollspy() {
  const nav = document.querySelector('.nav');
  const main = document.getElementById('top');
  if (!nav || !main || !('IntersectionObserver' in window)) return;

  const navLinks = [...nav.querySelectorAll('a[href^="#"]')];
  const sections = navLinks
    .map((link) => ({ link, id: link.getAttribute('href').slice(1) }))
    .filter(({ id }) => id !== 'top')
    .map(({ link, id }) => ({ link, id, el: document.getElementById(id) }))
    .filter(({ el }) => el);
  if (!sections.length) return;

  const linkById = new Map(sections.map(({ id, link }) => [id, link]));
  const topLink = navLinks.find((link) => link.getAttribute('href') === '#top');
  if (topLink) linkById.set('top', topLink);

  function paint(id) {
    for (const [linkId, link] of linkById) {
      if (linkId === id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }

  let navGesture = false;
  let navGestureTimer;
  for (const type of ['wheel', 'touchstart', 'pointerdown']) {
    nav.addEventListener(type, () => {
      navGesture = true;
      clearTimeout(navGestureTimer);
      navGestureTimer = setTimeout(() => { navGesture = false; }, 1000);
    }, { passive: true });
  }

  function reveal(link) {
    /* Skip when the nav has no scroll of its own to yank (the narrow-viewport
       layout puts it back in normal document flow), and skip while the reader
       is working the nav's own scrollbar — a wheel, a touch drag, or a
       pointer down on the thumb, each caught above. */
    if (!link || navGesture || nav.scrollHeight <= nav.clientHeight) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    link.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  let activeId = null;
  function setActive(id) {
    if (id === activeId || !linkById.has(id)) return;
    activeId = id;
    paint(id);
    reveal(linkById.get(id));
  }

  /* The line a heading must cross to become "the current section": a little
     below the very top of the viewport, not the top half of it. A wide band
     lets a short section's heading and the next one's both sit inside it at
     once, and a scrollspy that goes by which headings are inside the band
     flickers between the two. A single line has no such ambiguity — exactly
     one heading is ever the last one to have crossed it. */
  const LINE_FRACTION = 0.15;

  /* Reads live geometry rather than trusting the observer entries' own
     order: an instant jump — a nav link, the browser's own "scroll to
     fragment", Home/End — can cross several headings in one callback, and
     the entries for that batch arrive in no particular order. Recomputing
     from scratch is what makes the result the same regardless of how many
     boundaries were crossed to get there, or in what order the browser
     happened to report them. Sections are in document order and never
     overlap, so the first one below the line ends the scan. */
  function currentSection() {
    const line = window.innerHeight * LINE_FRACTION;
    let current = 'top';
    for (const { id, el } of sections) {
      if (el.getBoundingClientRect().top <= line) current = id; else break;
    }
    return current;
  }

  const refresh = () => setActive(currentSection());
  refresh();

  /* A thin band ending exactly at the line, not straddling it: a zero-height
     root leaves every intersection ratio at 0, so a heading passing exactly
     through the line could go unreported, which is why this needs area at
     all. But a band centred on the line has the same dead zone a wide band
     does, just narrower — a heading whose top moves from one side of the
     line to the other without ever crossing either edge of the band changes
     currentSection()'s answer with no callback to read it. Ending the band
     at the line rather than around it means the two can never disagree:
     every crossing of the line is a crossing of this edge. */
  const thickness = 2;
  const sectionObserver = new IntersectionObserver(refresh, {
    rootMargin: `-${LINE_FRACTION * 100 - thickness}% 0px -${100 - LINE_FRACTION * 100}% 0px`,
  });
  for (const { el } of sections) sectionObserver.observe(el);

  /* An instant jump that lands past the line without the observed band ever
     reporting a crossing fires no observer callback, and leaves the previous
     section marked active — Home/End and the browser's own scroll
     restoration on Back can both land exactly that way. One rAF-throttled
     scroll listener closes the gap regardless of how the reader got there. */
  let scrollScheduled = false;
  window.addEventListener('scroll', () => {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(() => { scrollScheduled = false; refresh(); });
  }, { passive: true });

  /* The last section's heading may never reach the line on its own — the
     page can end shortly after it, with too little left below to push it
     that far up the viewport. A sentinel at the very end of the document
     answers a different, always-decidable question instead: has the reader
     scrolled to the bottom. When they have, the last nav entry is correct
     regardless of where its heading sits. */
  const lastId = sections[sections.length - 1].id;
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.height = '1px';
  main.appendChild(sentinel);
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) setActive(lastId);
  }).observe(sentinel);
}
