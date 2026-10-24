// Look & feel: background (preset / link / uploaded file), accent color, hide Robux, nav entries, shortcuts
(() => {
  const R = window.Rogen;
  const KEYS = ["bgMode", "bgPreset", "bgImage", "bgUpload", "bgDim", "accent", "hideRobux", "blurCards", "tint", "tintStr"];
  // "Match background": the average color of your background picture (or the first color of a gradient)
  const autoCache = {};
  const bgSource = () => (s.bgMode === "preset" ? s.bgPreset : s.bgMode === "upload" ? s.bgUpload : s.bgMode === "image" ? s.bgImage : "") || "";
  function autoTint() {
    const src = bgSource();
    if (!src) return "";
    if (src in autoCache) return autoCache[src];
    autoCache[src] = "";
    if (s.bgMode === "preset") {
      const m = src.match(/#[0-9a-f]{6}|#[0-9a-f]{3}\b|rgba?\([^)]*\)/gi) || [];
      autoCache[src] = m[Math.floor(m.length / 2)] || m[0] || "";
      return autoCache[src];
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas"); c.width = c.height = 24;
        const x = c.getContext("2d"); x.drawImage(img, 0, 0, 24, 24);
        const d = x.getImageData(0, 0, 24, 24).data;
        // average, leaning toward the more colorful pixels so a dark picture still gives its color
        let r = 0, g = 0, b = 0, w = 0;
        for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); const k = 1 + (mx - mn) / 32; r += d[i] * k; g += d[i + 1] * k; b += d[i + 2] * k; w += k; }
        r /= w; g /= w; b /= w;
        // keep the color, lift it so it reads as a color and not just dark grey
        const mx = Math.max(r, g, b, 1), f = Math.min(3, 200 / mx);
        autoCache[src] = `rgb(${Math.round(Math.min(255, r * f))},${Math.round(Math.min(255, g * f))},${Math.round(Math.min(255, b * f))})`;
        apply();
      } catch (e) { /* the site doesn't allow reading its picture */ }
    };
    img.src = src;
    return "";
  }
  R.lookTint = () => (s.tint === "auto" ? autoTint() : s.tint || "");
  let s = {};

  function apply() {
    R.applyThemeAttr();
    let style = document.getElementById("rg-look");
    if (!style) {
      style = document.createElement("style");
      style.id = "rg-look";
      document.documentElement.appendChild(style);
    }
    const dim = Math.min(85, Math.max(0, Number(s.bgDim ?? 35)));
    let bg = "";
    if (s.bgMode === "preset" && s.bgPreset) bg = s.bgPreset;
    if (s.bgMode === "image" && /^https?:\/\//i.test(s.bgImage || "")) bg = `url("${s.bgImage.replace(/"/g, "%22")}") center / cover no-repeat`;
    if (s.bgMode === "upload" && s.bgUpload) bg = `url("${s.bgUpload}") center / cover no-repeat`;
    let css = "";
    if (s.accent) css += `:root{--rg-accent:${s.accent};}`;
    // Panel color: tints RoGen's cards and Roblox's panels to go with your background
    const tint = R.lookTint();
    let tintCss = "";
    if (tint) {
      const k = Math.min(70, Math.max(5, Number(s.tintStr ?? 30)));
      tintCss = `
        :root[data-rg-theme="dark"] { --rg-tint: ${tint}; --rg-card: color-mix(in srgb, ${tint} ${k}%, rgba(18,18,22,.88)); --rg-card2: color-mix(in srgb, ${tint} ${Math.round(k * 0.9)}%, rgba(44,44,50,.92)); --rg-solid: color-mix(in srgb, ${tint} ${k}%, #131317); --rg-line: color-mix(in srgb, ${tint} 35%, rgba(255,255,255,.14)); --rg-line2: color-mix(in srgb, ${tint} 40%, rgba(255,255,255,.2)); }
        :root[data-rg-theme="light"] { --rg-tint: ${tint}; --rg-card: color-mix(in srgb, ${tint} ${Math.round(k * 0.5)}%, rgba(255,255,255,.92)); --rg-card2: color-mix(in srgb, ${tint} ${Math.round(k * 0.6)}%, rgba(240,240,242,.95)); --rg-solid: color-mix(in srgb, ${tint} ${Math.round(k * 0.35)}%, #fff); --rg-line: color-mix(in srgb, ${tint} 30%, rgba(0,0,0,.1)); }
        /* only the UI gets the color: panels, the top bar, the left menu, menus. The page behind stays your background */
        html[data-rg-theme] .section-content:not(.rg-body), html[data-rg-theme] .dropdown-menu, html[data-rg-theme] .popover-content,
        html[data-rg-theme] .rg-tint-top, html[data-rg-theme] .rg-tint-left { background-color: var(--rg-solid) !important; }
        html[data-rg-theme] .rg-tint-top { border-color: var(--rg-line) !important; }
        html[data-rg-theme] .rg-body.section-content { background: var(--rg-card) !important; }
        html[data-rg-theme] .rg-page .rg-side { background: var(--rg-card); border-radius: 16px; padding: 10px; }
        /* no big tinted sheet over the whole page */
        ${bg ? `html:root[data-rg-theme] #container-main > .content { background: transparent !important; backdrop-filter: none !important; }` : ""}
      `;
    }
    if (bg) {
      css += `
        html body, html body#rbx-body { background: ${bg} !important; background-attachment: fixed !important; }
        html body::before { content:""; position:fixed; inset:0; background: rgba(0,0,0,${dim / 100}); pointer-events:none; z-index:-1; }
        #wrap, #container-main, #container-main > .content { background: transparent !important; }
        ${s.blurCards !== false ? `#container-main > .content { border-radius: 14px; }
        :root[data-rg-theme="dark"] #container-main > .content { background: rgba(14,15,18,.55) !important; }
        :root[data-rg-theme="light"] #container-main > .content { background: rgba(255,255,255,.86) !important; }` : ""}
      `;
    }
    style.textContent = css + tintCss;
    document.documentElement.classList.toggle("rg-hide-robux", !!s.hideRobux);
  }

  /* ---------- "RoGen" in Roblox's own menus ---------- */
  function tagChrome() {
    if (!R.lookTint || !R.lookTint()) { document.querySelectorAll(".rg-tint-top, .rg-tint-left").forEach((n) => n.classList.remove("rg-tint-top", "rg-tint-left")); return; }
    const fixedUp = (el, test) => { for (let n = el, i = 0; n && n !== document.body && i < 12; n = n.parentElement, i++) { const cs = getComputedStyle(n); if ((cs.position === "fixed" || cs.position === "sticky") && test(n.getBoundingClientRect())) return n; } return null; };
    // top bar: the fixed bar along the top that holds Roblox's search box
    const search = document.querySelector("#navbar-search-input, input[placeholder='Search'], .navbar-search input, #header input");
    const top = search && fixedUp(search, (r) => r.top <= 2 && r.height < 120 && r.width > innerWidth * 0.6);
    if (top && !top.closest(".rg-page") && !top.classList.contains("rg-tint-top")) top.classList.add("rg-tint-top");
    // left menu: the fixed column with Home / Avatar links
    const home = [...document.querySelectorAll("a[href$='/home'], a[href*='/home?']")].find((a) => a.getBoundingClientRect().left < 260 && a.getBoundingClientRect().top > 40);
    const left = home && fixedUp(home, (r) => r.left <= 2 && r.width < 340 && r.height > innerHeight * 0.5);
    if (left && !left.classList.contains("rg-tint-left")) left.classList.add("rg-tint-left");
  }
  R.tagChrome = tagChrome;

  function addNav() {
    try { tagChrome(); } catch (e) { /* page still loading */ }
    // Left sidebar
    const list = document.querySelector("#navigation .left-col-list, .left-col-list");
    if (list && !list.querySelector(".rg-nav-li")) {
      const li = R.h(`<li class="rg-nav-li"><a class="dynamic-overflow font-header-2" href="https://www.roblox.com/rogen#dashboard">
        <span class="rg-logo rg-nav-icon"></span><span class="font-header-2 dynamic-ellipsis-item">RoGen</span></a></li>`);
      const after = [...list.children].find((c) => /\/charts|\/discover/.test(c.querySelector("a")?.getAttribute("href") || ""));
      after ? after.insertAdjacentElement("afterend", li) : list.appendChild(li);
    }
    // Top bar, next to Charts / Marketplace
    document.querySelectorAll(".rbx-navbar").forEach((bar) => {
      if (bar.querySelector(".rg-top-li")) return;
      const charts = bar.querySelector("a[href$='/charts'], a[href*='/charts']");
      const li = R.h(`<li class="rg-top-li"><a class="font-header-2 nav-menu-title text-header" href="https://www.roblox.com/rogen#dashboard">RoGen</a></li>`);
      if (charts && charts.closest("li")) charts.closest("li").insertAdjacentElement("afterend", li);
      else bar.insertAdjacentElement("afterbegin", li);
    });
  }

  /* ---------- keyboard shortcuts ---------- */
  R.shortcuts = [
    ["Ctrl + K", "Quick find: games, players, friends, pages (or press /)", () => R.finder && R.finder.open()],
    ["Alt + R", "Open RoGen dashboard", () => go("dashboard")],
    ["Alt + D", "Open RoGen Discover", () => go("discover")],
    ["Alt + S", "Search everything", () => go("search")],
    ["Alt + H", "Home", () => (location.href = "https://www.roblox.com/home")],
    ["Alt + F", "Friends", () => (location.href = "https://www.roblox.com/users/friends")],
    ["Alt + P", "My profile", () => { const me = R.me(); if (me) location.href = `https://www.roblox.com/users/${me.id}/profile`; }],
    ["Alt + C", "Copy this page's ID", () => {
      const m = location.pathname.match(/\/(?:games|users|groups|communities|catalog|bundles|game-pass|badges)\/(\d+)/);
      if (m) navigator.clipboard.writeText(m[1]).then(() => R.toast("Copied ID " + m[1]));
      else R.toast("No ID on this page");
    }]
  ];
  function go(view) {
    if (location.pathname.toLowerCase().startsWith("/rogen")) location.hash = "#" + view;
    else location.href = R.rogenUrl(view);
  }
  R.go = go;
  document.addEventListener("keydown", (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || !R.feat("shortcuts")) return;
    const key = e.code.replace("Key", "");
    const hit = R.shortcuts.find(([k]) => k.endsWith(" " + key));
    if (hit) {
      e.preventDefault();
      hit[2]();
    }
  });

  R.look = { apply, addNav };
  R.get(KEYS).then((v) => {
    s = v;
    apply();
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local") return;
    let hit = false;
    for (const k in ch) if (KEYS.includes(k)) { s[k] = ch[k].newValue; hit = true; }
    if (hit) apply();
  });
})();
