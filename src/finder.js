// Quick find: press Ctrl+K (or /) anywhere on roblox.com.
// One box for games, players, your friends, things you opened recently, RoGen pages and Roblox pages.
(() => {
  if (window.__rgFinder) return;
  window.__rgFinder = true;
  const R = window.Rogen;
  const SESSION = crypto.randomUUID();
  const MAC = /Mac|iPhone|iPad/.test(navigator.platform);
  const KEY = MAC ? "⌘K" : "Ctrl K";

  const I = {
    search: '<path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4"/>',
    page: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    game: '<rect x="3" y="7" width="18" height="11" rx="3"/><path d="M8 11v3M6.5 12.5h3M15 12h.01M17 14h.01"/>',
    group: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.8 3.1 2.6 3.5 5.2"/>',
    item: '<path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    hex: '<path d="M12 2.5l8 4.6v9.8l-8 4.6-8-4.6V7.1z"/><path d="M12 8.2l3.6 2.1v3.4L12 15.8l-3.6-2.1v-3.4z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>'
  };
  const svg = (k, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;

  const RB = "https://www.roblox.com";
  const PAGES = [
    // RoGen
    ["RoGen dashboard", R.rogenUrl("dashboard"), "RoGen", "dashboard home overview"],
    ["Discover games", R.rogenUrl("discover"), "RoGen", "categories charts find games filter"],
    ["Search everything", R.rogenUrl("search"), "RoGen", "search"],
    ["Lookup a player or community", R.rogenUrl("lookup"), "RoGen", "lookup player community visits"],
    ["Spending", R.rogenUrl("spending"), "RoGen", "robux spent money transactions"],
    ["Playtime", R.rogenUrl("playtime"), "RoGen", "time played hours"],
    ["Friends & unadds", R.rogenUrl("friends"), "RoGen", "friends unadded unfriend removed"],
    ["Library", R.rogenUrl("library"), "RoGen", "recent saved history"],
    ["Items & deals", R.rogenUrl("items"), "RoGen", "limiteds items deals rap"],
    ["Alerts", R.rogenUrl("alerts"), "RoGen", "notify alerts price"],
    ["Tools", R.rogenUrl("tools"), "RoGen", "robux usd calculator devex username history"],
    ["RoGen settings", R.rogenUrl("settings"), "RoGen", "theme background accent status settings"],
    // Roblox
    ["Home", RB + "/home", "Roblox", "home", "home"],
    ["Charts", RB + "/charts", "Roblox", "charts discover top games", "chart"],
    ["Marketplace", RB + "/catalog", "Roblox", "catalog avatar shop items marketplace", "bag"],
    ["Avatar editor", RB + "/my/avatar", "Roblox", "avatar customize outfit", "user"],
    ["Inventory", "INV", "Roblox", "inventory my items", "box"],
    ["My profile", "ME", "Roblox", "profile me", "user"],
    ["Friends", RB + "/users/friends", "Roblox", "friends followers following", "group"],
    ["Messages", RB + "/my/messages", "Roblox", "messages inbox", "mail"],
    ["Trades", RB + "/trades", "Roblox", "trades trading", "swap"],
    ["Transactions", RB + "/transactions", "Roblox", "transactions purchases sales", "receipt"],
    ["Communities", RB + "/communities", "Roblox", "groups communities", "group"],
    ["Buy Robux", RB + "/upgrades/robux", "Roblox", "robux buy premium", "hex"],
    ["Account settings", RB + "/my/account", "Roblox", "settings account privacy security", "gear"],
    ["Create", "https://create.roblox.com/dashboard/creations", "Roblox", "create studio develop creations", "wrench"]
  ];
  const pageUrl = (u) => {
    const me = R.me();
    if (u === "ME") return me ? `${RB}/users/${me.id}/profile` : `${RB}/home`;
    if (u === "INV") return me ? `${RB}/users/${me.id}/inventory` : `${RB}/home`;
    return u;
  };

  // RoGen pages use the same icons as RoGen's sidebar
  const pageIcon = (u, k) => {
    const v = /\/rogen#(\w+)/.exec(u || "");
    if (v && R.viewIcons && R.viewIcons[v[1]]) return R.viewIcons[v[1]];
    return svg(k || "page");
  };
  const asRow = (sec) => ([t, u, src, , k]) => ({ sec, title: t, sub: src, url: u, icHtml: pageIcon(u, k), page: true });

  let wrap = null, box = null, list = null, items = [], sel = 0, token = 0, timer = 0, lastFocus = null;

  /* ---------- data ---------- */
  const thumbsFor = async (rows) => {
    const by = { user: [], game: [], group: [], asset: [] };
    rows.forEach((r) => r.tk && by[r.tk].push(r.tid));
    const out = {};
    await Promise.all(Object.keys(by).map(async (k) => {
      if (!by[k].length) return;
      try { const t = await R.thumbs(k, [...new Set(by[k])], k === "user" ? "48x48" : "150x150"); for (const id in t) out[k + ":" + id] = t[id]; } catch (e) { /* no pictures, fine */ }
    }));
    return out;
  };
  const presenceFor = async (ids) => {
    if (!ids.length) return {};
    try {
      const d = await R.api("https://presence.roblox.com/v1/presence/users", { method: "POST", body: { userIds: ids } });
      const o = {}; (d.userPresences || []).forEach((p) => (o[p.userId] = p)); return o;
    } catch (e) { return {}; }
  };
  const presText = (p) => !p ? "" : p.userPresenceType === 2 ? (p.lastLocation ? `Playing ${p.lastLocation}` : "In a game") : p.userPresenceType === 3 ? "In Studio" : p.userPresenceType === 1 ? "Online" : "";
  const joinUrl = (p) => p && p.userPresenceType === 2 && p.rootPlaceId && p.gameId ? `roblox://experiences/start?placeId=${Number(p.rootPlaceId)}&gameInstanceId=${encodeURIComponent(p.gameId)}` : "";

  const recentRows = async (q) => {
    const rec = await R.recent.all().catch(() => []);
    const kinds = { game: ["game", "Game"], user: ["user", "Player"], group: ["group", "Community"], item: ["asset", "Item"] };
    return rec.filter((r) => kinds[r.kind] && (!q || (r.name || "").toLowerCase().includes(q))).slice(0, q ? 4 : 6).map((r) => ({
      sec: "Recent", title: r.name || "Untitled", sub: kinds[r.kind][1], url: r.url, ic: r.kind === "item" ? "item" : r.kind,
      tk: kinds[r.kind][0], tid: r.id, play: r.kind === "game" && r.placeId ? `${RB}/games/start?placeId=${Number(r.placeId)}` : ""
    }));
  };
  const friendRows = async (q) => {
    const snap = await R.get1("friendSnap", null).catch(() => null);
    if (!snap || !snap.names) return [];
    const out = [];
    for (const id of snap.ids || []) {
      const n = snap.names[id];
      if (!n) continue;
      if (`${n.name} ${n.displayName}`.toLowerCase().includes(q)) out.push({ id: Number(id), name: n.name, displayName: n.displayName || n.name });
      if (out.length >= 5) break;
    }
    return out.map((u) => ({ sec: "Friends", title: u.displayName, sub: "@" + u.name, url: `${RB}/users/${u.id}/profile`, ic: "user", tk: "user", tid: u.id, uid: u.id }));
  };
  const pageRows = (q) => PAGES.filter(([t, , , k]) => !q || `${t} ${k}`.toLowerCase().includes(q)).slice(0, q ? 5 : 0)
    .map(asRow("Go to"));

  const playerRows = async (q) => {
    if (q.length < 3 || /\s/.test(q)) return [];
    const seen = new Set(), out = [];
    try { const u = await R.userByName(q); if (u) { seen.add(u.id); out.push(u); } } catch (e) { /* not an exact name */ }
    try {
      const d = await R.api(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(q)}&limit=10`);
      for (const u of d.data || []) if (!seen.has(u.id) && out.length < 4) { seen.add(u.id); out.push(u); }
    } catch (e) { /* search is rate limited sometimes */ }
    return out.map((u) => ({ sec: "Players", title: u.displayName || u.name, sub: "@" + u.name, url: `${RB}/users/${u.id}/profile`, ic: "user", tk: "user", tid: u.id, uid: u.id }));
  };
  const gameRows = async (q) => {
    if (q.length < 2) return [];
    try {
      const d = await R.api(`https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(q)}&sessionId=${SESSION}&pageType=all`);
      const l = [];
      (d.searchResults || []).forEach((g) => (!g.contentGroupType || g.contentGroupType === "Game") && l.push(...(g.contents || [])));
      return l.slice(0, 5).map(R.normGame).filter((g) => g.placeId).map((g) => ({
        sec: "Games", title: g.name, sub: [g.up + g.down ? Math.round((g.up / (g.up + g.down)) * 100) + "% liked" : "", g.players ? R.short(g.players) + " playing" : ""].filter(Boolean).join(" · "),
        url: `${RB}/games/${g.placeId}`, ic: "game", tk: "game", tid: g.universeId, play: `${RB}/games/start?placeId=${Number(g.placeId)}`
      }));
    } catch (e) { return []; }
  };

  /* ---------- drawing ---------- */
  const rowHtml = (r, i, th) => {
    const pic = r.tk && th[r.tk + ":" + r.tid];
    const lead = pic ? `<img class="${r.tk === "user" ? "round" : ""}" src="${R.esc(pic)}" alt="">` : `<span class="rg-fd-ic">${r.icHtml || svg(r.ic)}</span>`;
    const act = r.join ? `<span class="rg-fd-act" data-act="join">Join</span>` : r.play ? `<span class="rg-fd-act" data-act="play">${svg("play", 14)}Play</span>` : "";
    return `<a class="rg-fd-row${i === sel ? " on" : ""}" href="${R.esc(pageUrl(r.url))}" data-i="${i}">
      <span class="rg-fd-lead">${lead}</span>
      <span class="rg-fd-txt"><b>${R.esc(r.title)}</b>${r.sub ? `<small>${R.esc(r.sub)}</small>` : ""}</span>${act}</a>`;
  };
  const draw = (rows, th = {}, note = "") => {
    items = rows;
    if (sel >= items.length) sel = Math.max(0, items.length - 1);
    let html = "", cur = "";
    rows.forEach((r, i) => {
      if (r.sec !== cur) { cur = r.sec; html += `<div class="rg-fd-sec">${R.esc(cur)}</div>`; }
      html += rowHtml(r, i, th);
    });
    list.innerHTML = html || `<div class="rg-fd-empty">${note || "No matches."}</div>`;
    const on = list.querySelector(".rg-fd-row.on");
    on && on.scrollIntoView({ block: "nearest" });
  };
  const move = (d) => {
    if (!items.length) return;
    sel = (sel + d + items.length) % items.length;
    list.querySelectorAll(".rg-fd-row").forEach((el) => el.classList.toggle("on", Number(el.dataset.i) === sel));
    list.querySelector(".rg-fd-row.on")?.scrollIntoView({ block: "nearest" });
  };

  async function update() {
    const raw = box.value.trim();
    const q = raw.toLowerCase();
    const my = ++token;
    if (!q) {
      const rec = await recentRows("");
      if (my !== token) return;
      const quick = PAGES.filter(([t]) => ["RoGen dashboard", "Discover games", "Friends & unadds", "Avatar editor", "Marketplace", "My profile"].includes(t))
        .map(asRow("Jump to"));
      const rows = [...rec, ...quick];
      draw(rows, {}, "");
      const th = await thumbsFor(rows);
      if (my === token) draw(rows, th);
      return;
    }
    // instant part: pages, friends, recent
    const [fr, rec] = await Promise.all([friendRows(q), recentRows(q)]);
    if (my !== token) return;
    const local = [...pageRows(q), ...fr, ...rec];
    draw(local, {}, "Searching…");
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const [games, players] = await Promise.all([gameRows(raw), playerRows(raw)]);
      if (my !== token) return;
      const known = new Set(fr.map((r) => r.uid));
      const rows = [...games, ...players.filter((p) => !known.has(p.uid)), ...local];
      // friends/players that are in a game get a Join button
      const pres = await presenceFor(rows.filter((r) => r.uid).map((r) => r.uid).slice(0, 10));
      rows.forEach((r) => { if (r.uid && pres[r.uid]) { const t = presText(pres[r.uid]); if (t) r.sub = `${r.sub} · ${t}`; r.join = joinUrl(pres[r.uid]); } });
      if (my !== token) return;
      draw(rows, {}, "Nothing found for that.");
      const th = await thumbsFor(rows);
      if (my === token) draw(rows, th, "Nothing found for that.");
    }, 220);
  }

  function go(i, how) {
    const r = items[i];
    if (!r) return;
    let url = pageUrl(r.url);
    if (how === "play" && r.join) url = r.join;
    else if (how === "play" && r.play) url = r.play;
    if (how === "tab") { window.open(url, "_blank", "noopener"); return; }
    close();
    location.href = url;
  }

  /* ---------- open / close ---------- */
  function open(prefill = "") {
    if (wrap) { box.focus(); box.select(); return; }
    R.applyThemeAttr && R.applyThemeAttr();
    R.native && R.native();
    lastFocus = document.activeElement;
    wrap = R.h(`<div class="rg-finder" role="dialog" aria-modal="true" aria-label="Quick find">
      <div class="rg-fd-box">
        <label class="rg-fd-in">${svg("search", 20)}<input type="text" placeholder="Search games, players, friends and pages" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></label>
        <div class="rg-fd-list" role="listbox"></div>
        <div class="rg-fd-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Shift</kbd><kbd>Enter</kbd> play or join</span><span class="r">RoGen</span></div>
      </div></div>`);
    box = wrap.querySelector("input");
    list = wrap.querySelector(".rg-fd-list");
    sel = 0;
    document.body.appendChild(wrap);
    document.documentElement.classList.add("rg-finder-open");
    box.value = prefill;
    box.focus();
    box.addEventListener("input", () => { sel = 0; update(); });
    box.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") { e.preventDefault(); go(sel, e.shiftKey ? "play" : e.ctrlKey || e.metaKey ? "tab" : "open"); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "Tab") { e.preventDefault(); move(e.shiftKey ? -1 : 1); }
    });
    wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(); });
    list.addEventListener("mousemove", (e) => {
      const row = e.target.closest(".rg-fd-row");
      if (row && Number(row.dataset.i) !== sel) { sel = Number(row.dataset.i); list.querySelectorAll(".rg-fd-row").forEach((el) => el.classList.toggle("on", el === row)); }
    });
    list.addEventListener("click", (e) => {
      const row = e.target.closest(".rg-fd-row");
      if (!row) return;
      if (e.ctrlKey || e.metaKey || e.button === 1) return;   // normal new-tab behaviour
      e.preventDefault();
      go(Number(row.dataset.i), e.target.closest(".rg-fd-act") || e.shiftKey ? "play" : "open");
    });
    update();
  }
  function close() {
    if (!wrap) return;
    token++;
    clearTimeout(timer);
    wrap.remove();
    wrap = null;
    document.documentElement.classList.remove("rg-finder-open");
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) { /* gone */ }
  }

  const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
      e.preventDefault(); e.stopPropagation();
      wrap ? close() : open();
    } else if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e.target) && !wrap) {
      e.preventDefault();
      open();
    }
  }, true);

  R.finder = { open, close, key: KEY };
})();
