// Look & feel: background (preset / link / uploaded file), accent color, hide Robux, nav entries, shortcuts
(() => {
  const R = window.Rogen;
  const KEYS = ["bgMode", "bgPreset", "bgImage", "bgUpload", "bgDim", "accent", "hideRobux", "blurCards"];
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
    style.textContent = css;
    document.documentElement.classList.toggle("rg-hide-robux", !!s.hideRobux);
  }

  /* ---------- "RoGen" in Roblox's own menus ---------- */
  function addNav() {
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
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
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
