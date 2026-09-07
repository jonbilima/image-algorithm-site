/* v2.3: touch-friendly, progressively enhanced section entrances.
   No WebGL, pointer/hover detection, network calls, storage, or dependencies. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root.classList.contains('app-ready') || window.IA_REVEALS) return;
  const selectors = [
    '.path-intro > h2', '.path-intro > div', '.path-choice',
    '.interlude > p', '.interlude-line', '.chapter-heading-row > h2',
    '.chapter-heading-row > p', '.chapter-browser > div',
    '.reading-left', '.paper-preview', '.author-grid > blockquote',
    '.author-grid > div', '.questions > div', '.final-copy'
  ];
  const elements = [...document.querySelectorAll(selectors.join(','))];
  // Animate leaves, not overlapping parent/child groups or sticky story containers.
  const targets = elements.filter(el => !elements.some(other => other !== el && other.contains(el)));
  const pending = new Set();
  const seen = new WeakSet();
  const running = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let observer = null, enabled = false, frame = 0, entered = 0;
  const supported = 'IntersectionObserver' in window && typeof Element.prototype.animate === 'function';
  const allowed = () => supported && !reduced.matches && !root.classList.contains('motion-paused');
  const bottom = () => Math.min(innerHeight, window.visualViewport?.height || innerHeight);
  function visible(el, inset = 24) {
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.top < bottom() - inset && box.bottom > 0;
  }
  function finish(el) {
    const animation = running.get(el);
    running.delete(el);
    if (animation) animation.cancel();
    el.classList.remove('ia-reveal-pending');
    el.dataset.iaReveal = 'done';
  }
  function enter(el, delay = 0, immediate = false) {
    if (!pending.has(el)) return;
    pending.delete(el);
    observer?.unobserve(el);
    seen.add(el);
    el.classList.remove('ia-reveal-pending');
    if (immediate || !allowed()) { el.dataset.iaReveal = 'done'; return; }
    // Read the original transform AFTER removing the hiding class: this preserves
    // the paper's two-degree rotation and any other original resting transform.
    const style = getComputedStyle(el);
    const rest = style.transform === 'none' ? '' : style.transform;
    try {
      const animation = el.animate([
        { opacity: 0, transform: `translate3d(0, 32px, 0) ${rest}`.trim() },
        { opacity: style.opacity, transform: rest || 'none' }
      ], {
        duration: 900, delay, easing: 'cubic-bezier(0.22, 0.7, 0.2, 1)', fill: 'both'
      });
      running.set(el, animation);
      el.dataset.iaReveal = 'entering';
      entered++;
      animation.onfinish = () => finish(el);
      animation.oncancel = () => {
        if (running.get(el) === animation) running.delete(el);
        el.dataset.iaReveal = 'done';
      };
    } catch (_) { finish(el); } // unsupported animation must never hide content
  }
  function revealBatch(items) {
    const visibleItems = items.filter(el => pending.has(el) && visible(el));
    visibleItems.sort((a, b) => {
      const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      return Math.abs(ar.top - br.top) > 12 ? ar.top - br.top : ar.left - br.left;
    });
    visibleItems.forEach((el, i) => enter(el, Math.min(i * 85, 255)));
  }
  function check() {
    frame = 0;
    if (!enabled || document.hidden) return;
    revealBatch([...pending]);
  }
  function schedule() {
    if (enabled && pending.size && !frame) frame = requestAnimationFrame(check);
  }
  function reset() {
    observer?.disconnect();
    observer = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    pending.forEach(el => { el.classList.remove('ia-reveal-pending'); el.dataset.iaReveal = 'ready'; });
    pending.clear();
    [...running.keys()].forEach(finish);
  }
  function configure() {
    const next = allowed();
    if (next === enabled) return;
    enabled = next;
    reset();
    if (!enabled) return;
    try {
      observer = new IntersectionObserver(entries => {
        revealBatch(entries.filter(entry => entry.isIntersecting).map(entry => entry.target));
      }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
      targets.forEach(el => {
        if (seen.has(el)) return;
        const box = el.getBoundingClientRect();
        if (!box.width || !box.height) return;
        // Keep restored deep links / already-visible content readable on arrival.
        if (box.top < bottom()) { seen.add(el); el.dataset.iaReveal = 'done'; return; }
        el.classList.add('ia-reveal-pending');
        el.dataset.iaReveal = 'pending';
        pending.add(el);
        observer.observe(el);
      });
      schedule();
    } catch (_) { enabled = false; reset(); }
  }
  // A small rAF-coalesced position check also handles momentum scrolling and
  // changing browser chrome; entrances never depend solely on an observer callback.
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('focusin', event => {
    for (const el of pending) {
      if (el === event.target || el.contains(event.target)) enter(el, 0, true);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) [...running.keys()].forEach(finish);
    else schedule();
  });
  addEventListener('pageshow', () => { configure(); schedule(); });
  reduced.addEventListener('change', configure);
  new MutationObserver(configure).observe(root, { attributes: true, attributeFilter: ['class'] });
  window.IA_REVEALS = {
    version: '2.3',
    get enabled() { return enabled; },
    get pending() { return pending.size; },
    get running() { return running.size; },
    get entered() { return entered; },
    get targets() { return targets.length; }
  };
  root.dataset.revealVersion = '2.3';
  configure();
})();
