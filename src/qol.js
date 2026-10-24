// Small things that make roblox.com quicker to get around.
(() => {
  if (window.__rgQol) return;
  window.__rgQol = true;
  const R = window.Rogen;

  /* Back to top: shows up once you've scrolled a long way down (game lists, catalog, friends) */
  let btn = null;
  const ensure = () => {
    if (btn) return btn;
    btn = R.h(`<button class="rg-top" type="button" aria-label="Back to top" title="Back to top"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>`);
    btn.onclick = () => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    document.body.appendChild(btn);
    return btn;
  };
  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const show = scrollY > 1400 && R.feat("backToTop");
      if (show) ensure();
      if (btn) btn.classList.toggle("show", show);
    });
  }, { passive: true });
})();
