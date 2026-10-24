// Reads Roblox's own colors off the page, so everything RoGen draws uses the same
// background, panel color and text color as the rest of roblox.com.
(() => {
  const R = window.Rogen;
  const root = document.documentElement;
  const clear = (c) => !c || c === "transparent" || /rgba\([^)]*,\s*0\)$/.test(c);
  const bgOf = (el) => { const c = el && getComputedStyle(el).backgroundColor; return clear(c) ? "" : c; };
  const pick = (sels, ok) => {
    for (const s of sels) {
      for (const el of document.querySelectorAll(s)) {
        if (el.closest(".rg-page, .rg-section, .rg-finder, .rg-sq")) continue;
        const c = bgOf(el);
        if (c && (!ok || ok(c))) return c;
      }
    }
    return "";
  };
  const lum = (c) => { const m = (c || "").match(/[\d.]+/g); if (!m) return -1; const [r, g, b] = m.map(Number); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const sameSide = (a, b) => a && b && (lum(a) < 0.5) === (lum(b) < 0.5);
  let last = "";
  function read() {
    const body = document.body;
    if (!body) return;
    const page = bgOf(body) || bgOf(root) || bgOf(document.querySelector("#wrap, #container-main, .content"));
    // the first Roblox surface that's on the same side (dark/light) as the page
    const panel = pick([".section-content", ".rbx-left-col", "#header", ".rbx-header", ".dropdown-menu"], (c) => !page || sameSide(page, c));
    let text = getComputedStyle(body).color;
    if (page && text && sameSide(page, text)) text = "";              // text must contrast with the page
    const key = page + "|" + panel + "|" + text;
    if (key === last) return;
    last = key;
    const set = (k, v) => (v ? root.style.setProperty(k, v) : root.style.removeProperty(k));
    set("--rg-n-page", page);
    set("--rg-n-panel", panel && panel !== page ? panel : "");
    set("--rg-n-text", text);
  }
  R.native = read;
  const start = () => {
    read();
    new MutationObserver(read).observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
    let n = 0;
    const t = setInterval(() => { read(); if (++n > 10) clearInterval(t); }, 1500);
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
