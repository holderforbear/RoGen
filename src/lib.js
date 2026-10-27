// RoGen shared library (content scripts). Everything hangs off window.Rogen.
(() => {
  const R = (window.Rogen = window.Rogen || {});

  /* ---------- formatting ---------- */
  R.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  R.fmt = (n) => Number(n || 0).toLocaleString();
  R.short = (n) => {
    n = Number(n || 0);
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
    if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (a >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return String(Math.round(n));
  };
  R.ago = (t) => {
    const s = Math.floor((Date.now() - new Date(t).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    if (s < 86400 * 30) return Math.floor(s / 86400) + "d ago";
    if (s < 86400 * 365) return Math.floor(s / (86400 * 30)) + "mo ago";
    return (s / (86400 * 365)).toFixed(1).replace(/\.0$/, "") + "y ago";
  };
  R.date = (t) => (t ? new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");
  R.dateTime = (t) => (t ? new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
  R.dur = (ms) => {
    const m = Math.round(ms / 60000);
    if (m < 60) return m + "m";
    const h = Math.floor(m / 60);
    return h < 48 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
  };
  R.robux = (n, o) => `<span class="rg-robux"><i class="rg-rbx-ic" aria-hidden="true"></i>${o && o.short ? R.short(n) : R.fmt(n)}</span>`;
  R.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Total time for a playtime entry: what RoGen tracked + earlier time you added by hand
  R.playMs = (p) => (p.ms || 0) + (p.base || 0);

  /* ---------- storage ---------- */
  R.get = (keys) => new Promise((res) => chrome.storage.local.get(keys, (v) => res(v || {})));
  R.set = (obj) => new Promise((res) => chrome.storage.local.set(obj, res));
  R.get1 = async (key, fallback) => {
    const v = (await R.get(key))[key];
    return v === undefined ? fallback : v;
  };
  R.send = (msg) => new Promise((res) => chrome.runtime.sendMessage(msg, (r) => res(r || { ok: false })));

  // Snapshot history: one array per kind+id. Numbers saved at most every `every` ms unless changed a lot; text saved on change.
  R.snap = async (key, obj, { every = 3 * 3600e3, max = 400, textOnly = false } = {}) => {
    const k = "hist:" + key;
    const list = await R.get1(k, []);
    const last = list[list.length - 1];
    const now = Date.now();
    const differs = !last || Object.keys(obj).some((f) => JSON.stringify(obj[f]) !== JSON.stringify(last[f]));
    const textChanged = !last || Object.keys(obj).some((f) => typeof obj[f] === "string" && obj[f] !== last[f]);
    let push = false;
    if (textOnly) push = differs;
    else if (textChanged || now - last.t >= every) push = true;
    else if (differs) {
      // numbers moved inside the window: keep the newest values on the last point
      Object.assign(last, obj);
      await R.set({ [k]: list });
      return list;
    }
    if (push) {
      list.push({ t: now, ...obj });
      while (list.length > max) list.shift();
      await R.set({ [k]: list });
    }
    return list;
  };
  R.hist = (key) => R.get1("hist:" + key, []);

  /* ---------- network (runs as www.roblox.com, so your login works) ---------- */
  let csrf = "";
  R.api = async (url, opts = {}) => {
    const o = { credentials: "include", ...opts, headers: { ...(opts.headers || {}) } };
    if (o.body && typeof o.body !== "string") {
      o.body = JSON.stringify(o.body);
      o.headers["Content-Type"] = "application/json";
    }
    if (o.method && o.method !== "GET") o.headers["x-csrf-token"] = csrf;
    let res = await fetch(url, o);
    if (res.status === 403 && res.headers.get("x-csrf-token")) {
      csrf = res.headers.get("x-csrf-token");
      o.headers["x-csrf-token"] = csrf;
      res = await fetch(url, o);
    }
    if (res.status === 429) {
      await R.sleep(1500);
      res = await fetch(url, o);
    }
    if (!res.ok) {
      const err = new Error(res.status === 403 ? "not allowed (private or no permission)" : res.status === 429 ? "Roblox is rate-limiting, try again in a bit" : `Roblox error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const txt = await res.text();
    return txt ? JSON.parse(txt) : {};
  };
  // Paginate any cursor endpoint
  R.pages = async (makeUrl, { max = 20, onPage } = {}) => {
    const out = [];
    let cursor = "";
    for (let i = 0; i < max; i++) {
      const d = await R.api(makeUrl(cursor));
      const items = d.data || d.PageItems || [];
      out.push(...items);
      onPage && onPage(out, i);
      cursor = d.nextPageCursor || d.NextCursor || "";
      if (!cursor) break;
    }
    return out;
  };
  R.chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

  /* ---------- common Roblox lookups ---------- */
  R.me = () => {
    const meta = document.querySelector('meta[name="user-data"]');
    if (!meta || !meta.dataset.userid) return null;
    return { id: Number(meta.dataset.userid), name: meta.dataset.name || "", displayName: meta.dataset.displayname || meta.dataset.name || "" };
  };
  R.universeOf = async (placeId) => {
    const cache = await R.get1("u2p", {});
    if (cache[placeId]) return cache[placeId];
    const d = await R.api(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
    cache[placeId] = d.universeId;
    await R.set({ u2p: cache });
    return d.universeId;
  };
  R.games = async (universeIds) => {
    const out = [];
    for (const c of R.chunks(universeIds, 50)) {
      const d = await R.api(`https://games.roblox.com/v1/games?universeIds=${c.join(",")}`);
      out.push(...(d.data || []));
    }
    return out;
  };
  R.votes = async (universeIds) => {
    const out = {};
    for (const c of R.chunks(universeIds, 50)) {
      const d = await R.api(`https://games.roblox.com/v1/games/votes?universeIds=${c.join(",")}`);
      (d.data || []).forEach((v) => (out[v.id] = v));
    }
    return out;
  };
  R.users = async (ids) => {
    const out = {};
    for (const c of R.chunks([...new Set(ids)], 100)) {
      const d = await R.api("https://users.roblox.com/v1/users", { method: "POST", body: { userIds: c, excludeBannedUsers: false } });
      (d.data || []).forEach((u) => (out[u.id] = u));
    }
    return out;
  };
  R.userByName = async (name) => {
    const d = await R.api("https://users.roblox.com/v1/usernames/users", { method: "POST", body: { usernames: [name], excludeBannedUsers: false } });
    return (d.data || [])[0] || null;
  };
  const thumbCache = new Map();
  R.thumbs = async (type, ids, size) => {
    const urlFor = {
      user: (c) => `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${c}&size=${size || "150x150"}&format=Png&isCircular=false`,
      game: (c) => `https://thumbnails.roblox.com/v1/games/icons?universeIds=${c}&returnPolicy=PlaceHolder&size=${size || "150x150"}&format=Png&isCircular=false`,
      asset: (c) => `https://thumbnails.roblox.com/v1/assets?assetIds=${c}&returnPolicy=PlaceHolder&size=${size || "150x150"}&format=Png&isCircular=false`,
      group: (c) => `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${c}&size=${size || "150x150"}&format=Png&isCircular=false`,
      gamepass: (c) => `https://thumbnails.roblox.com/v1/game-passes?gamePassIds=${c}&size=${size || "150x150"}&format=Png&isCircular=false`,
      badge: (c) => `https://thumbnails.roblox.com/v1/badges/icons?badgeIds=${c}&size=${size || "150x150"}&format=Png&isCircular=false`,
      bundle: (c) => `https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${c}&size=${size || "150x150"}&format=Png&isCircular=false`
    }[type];
    const out = {};
    const need = [];
    for (const id of ids) {
      const k = `${type}:${size}:${id}`;
      if (thumbCache.has(k)) out[id] = thumbCache.get(k);
      else need.push(id);
    }
    for (const c of R.chunks([...new Set(need)], 100)) {
      try {
        const d = await R.api(urlFor(c.join(",")));
        for (const t of d.data || []) {
          out[t.targetId] = t.imageUrl;
          thumbCache.set(`${type}:${size}:${t.targetId}`, t.imageUrl);
        }
      } catch (e) { /* thumbnails are optional */ }
    }
    return out;
  };
  // Fill <img data-thumb="type:id"> elements under root
  R.fillThumbs = async (root) => {
    const imgs = [...root.querySelectorAll("img[data-thumb]")].filter((i) => !i.src);
    const byType = {};
    imgs.forEach((i) => {
      const [t, id] = i.dataset.thumb.split(":");
      (byType[t] = byType[t] || []).push(Number(id));
    });
    for (const t in byType) {
      const map = await R.thumbs(t, byType[t]);
      imgs.forEach((i) => {
        const [tt, id] = i.dataset.thumb.split(":");
        if (tt === t && map[id]) i.src = map[id];
      });
    }
  };
  R.myFriendIds = async () => {
    const snap = await R.get1("friendSnap", null);
    return snap ? snap.ids : [];
  };
  R.friendIds = async (userId) => {
    const ids = new Set();
    let cursor = "";
    for (let i = 0; i < 30; i++) {
      const d = await R.api(`https://friends.roblox.com/v1/users/${userId}/friends/find?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      (d.PageItems || []).forEach((f) => f.id !== Number(userId) && ids.add(f.id));
      cursor = d.NextCursor || "";
      if (!cursor) break;
    }
    return [...ids];
  };

  /* ---------- UI helpers (match Roblox look) ---------- */
  R.h = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  R.theme = () => {
    const b = document.body;
    if (b.classList.contains("dark-theme")) return "dark";
    if (b.classList.contains("light-theme")) return "light";
    const probe = document.querySelector("#header, .rbx-header, #navigation-container") || b;
    const m = getComputedStyle(probe).backgroundColor.match(/\d+/g);
    if (m) {
      const [r, g, bl] = m.map(Number);
      return (0.299 * r + 0.587 * g + 0.114 * bl) / 255 < 0.5 ? "dark" : "light";
    }
    return "dark";
  };
  R.applyThemeAttr = () => document.documentElement.setAttribute("data-rg-theme", R.theme());

  // A Roblox-style section with optional tabs. tabs: [{id,label,render(el)}]
  // Uses Roblox's own section markup (container-header + section-content) so it inherits Roblox styling.
  R.section = ({ id, title, sub = "", tabs = null, right = "", lazy = false, bare = false }) => {
    const sec = R.h(`<div class="rg-section section" id="${id}">
      ${title ? `<div class="container-header rg-head"><h2>${R.esc(title)}${sub ? ` <span class="rg-sub">${sub}</span>` : ""}</h2><div class="rg-head-right">${right}</div></div>` : ""}
      ${tabs ? `<div class="rg-tabs" role="tablist">${tabs.map((t, i) => `<button class="rg-tab${i ? "" : " on"}" data-t="${t.id}" role="tab">${R.esc(t.label)}</button>`).join("")}</div>` : ""}
      <div class="${bare ? "" : "section-content "}rg-body"></div></div>`);
    if (tabs) {
      const body = sec.querySelector(".rg-body");
      const rendered = {};
      const show = (tid) => {
        sec.querySelectorAll(".rg-tab").forEach((b) => b.classList.toggle("on", b.dataset.t === tid));
        [...body.children].forEach((c) => (c.hidden = c.dataset.pane !== tid));
        if (!rendered[tid]) {
          rendered[tid] = true;
          const pane = R.h(`<div data-pane="${tid}"><div class="rg-loading">Loading…</div></div>`);
          body.appendChild(pane);
          const t = tabs.find((x) => x.id === tid);
          Promise.resolve(t.render(pane)).catch((e) => (pane.innerHTML = R.errBox(e)));
        }
      };
      sec.querySelectorAll(".rg-tab").forEach((b) => (b.onclick = () => show(b.dataset.t)));
      sec.showTab = show;
      let started = false;
      sec.activate = () => { if (!started) { started = true; show(tabs[0].id); } };
      if (!lazy) setTimeout(sec.activate);
    }
    return sec;
  };

  /* A real tab next to Roblox's own page tabs (game, profile, group pages).
     It hides Roblox's panes while open, and puts everything back when you click a Roblox tab. */
  R.nativeTab = ({ ul, li, tabEl, nativeTabs, panes, placePane, pane, onOpen, equalize, useHash = true }) => {
    li.classList.add("rg-native-tab");
    ul.appendChild(li);
    placePane(pane);
    pane.style.display = "none";
    let open = false, wasActive = [], hidden = [];
    const fit = () => equalize && equalize([...ul.children].filter((c) => c.tagName === "LI" || c.matches("li, a")));
    fit();
    const show = () => {
      if (open) return;
      open = true;
      wasActive = nativeTabs().filter((t) => t.classList.contains("active"));
      wasActive.forEach((t) => t.classList.remove("active"));
      hidden = panes().filter((p) => p !== pane && getComputedStyle(p).display !== "none");
      hidden.forEach((p) => { p.dataset.rgHid = p.style.display || ""; p.style.display = "none"; });
      tabEl(li).classList.add("active");
      pane.classList.add("active");
      pane.style.display = "block";
      onOpen && onOpen();
      if (useHash) history.replaceState(history.state, "", location.pathname + location.search + "#rogen");
    };
    const hide = () => {
      if (!open) return;
      open = false;
      tabEl(li).classList.remove("active");
      pane.classList.remove("active");
      pane.style.display = "none";
      wasActive.forEach((t) => t.classList.add("active"));
      hidden.forEach((p) => { p.style.display = p.dataset.rgHid; delete p.dataset.rgHid; });
      if (useHash && location.hash === "#rogen") history.replaceState(history.state, "", location.pathname + location.search);
    };
    li.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); show(); }, true);
    // Clicking any Roblox tab closes ours first, then Roblox switches normally
    ul.addEventListener("click", (e) => { if (!li.contains(e.target)) hide(); }, true);
    if (useHash && location.hash === "#rogen") setTimeout(show, 50);
    return { show, hide, fit, isOpen: () => open };
  };

  /* Unadd check from the page itself (uses your Roblox login directly). Background does the same every 30 min. */
  R.checkFriends = async ({ force = false } = {}) => {
    const me = R.me();
    if (!me) return { ok: false, reason: "Log in to Roblox first." };
    const s = await R.get(["friendSnap", "unadded", "lastFriendCheck", "friendCheckLock", "friendSince"]);
    const now = Date.now();
    if (!force && s.lastFriendCheck && now - s.lastFriendCheck < 10 * 60e3) return { ok: true, skipped: true };
    if (s.friendCheckLock && now - s.friendCheckLock < 60e3) return { ok: true, skipped: true };
    await R.set({ friendCheckLock: now });
    try {
      const current = await R.friendIds(me.id);
      const snap = s.friendSnap && s.friendSnap.owner === me.id ? s.friendSnap : null;
      let unadded = Array.isArray(s.unadded) ? s.unadded : [];
      if (!snap) {
        const users = await R.users(current);
        const names = {};
        for (const id in users) names[id] = { name: users[id].name, displayName: users[id].displayName };
        await R.set({ friendSnap: { owner: me.id, ids: current, names, since: now }, lastFriendCheck: now, friendCheckLock: 0 });
        return { ok: true, baseline: true, count: current.length };
      }
      // Guard against a failed/partial load wiping the list
      if (!current.length && snap.ids.length > 3) { await R.set({ friendCheckLock: 0 }); return { ok: false, reason: "Roblox returned no friends, skipped." }; }
      const cur = new Set(current), prev = new Set(snap.ids);
      const removed = snap.ids.filter((id) => !cur.has(id));
      const added = current.filter((id) => !prev.has(id));
      const names = { ...snap.names };
      if (added.length) {
        const users = await R.users(added);
        for (const id in users) names[id] = { name: users[id].name, displayName: users[id].displayName };
      }
      const iUnfriended = new Set((await R.get1("iUnfriended", [])).map(Number));
      for (const id of removed) {
        const n = names[id] || {};
        unadded.unshift({ id, name: n.name || `User ${id}`, displayName: n.displayName || n.name || `User ${id}`, at: now, seen: false, byMe: iUnfriended.has(id) });
      }
      unadded = unadded.filter((u) => !cur.has(u.id) && u.id !== me.id).slice(0, 500);
      removed.forEach((id) => delete names[id]);
      // when each friend was added (people already friends at the first check just have "since the first check")
      const friendSince = { ...(s.friendSince || {}) };
      added.forEach((id) => { if (!friendSince[id]) friendSince[id] = now; });
      removed.forEach((id) => delete friendSince[id]);
      await R.set({ friendSince, friendSnap: { owner: me.id, ids: current, names, since: snap.since }, unadded, lastFriendCheck: now, friendCheckLock: 0, iUnfriended: [...iUnfriended].filter((id) => !removed.includes(id)) });
      if (removed.length) R.send({ type: "badge" });
      return { ok: true, removed: removed.length, added: added.length, count: current.length };
    } catch (e) {
      await R.set({ friendCheckLock: 0 });
      return { ok: false, reason: e.message };
    }
  };

  // Game tile using Roblox's own game-card markup, so it looks identical to Charts/Home tiles
  R.gameTile = (g, inc = []) => {
    let name = R.esc(g.name);
    for (const t of inc) name = name.replace(new RegExp(R.esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => `<mark class="rg-mark">${m}</mark>`);
    const rating = g.up + g.down ? Math.round((g.up / (g.up + g.down)) * 100) + "%" : "";
    return `<li class="list-item game-card game-tile rg-tile-li" data-uid="${g.universeId}"><div class="game-card-container"><a class="game-card-link" href="https://www.roblox.com/games/${g.placeId}">
      <div class="game-card-thumb-container"><span class="thumbnail-2d-container game-card-thumb"><img data-thumb="game:${g.universeId}" alt=""></span></div>
      <div class="game-card-name game-name-title" title="${R.esc(g.name)}">${name}</div>
      ${g.players != null ? `<div class="game-card-info">${rating ? `<span class="info-label icon-votes-gray"></span><span class="info-label vote-percentage-label">${rating}</span>` : ""}
        <span class="info-label icon-playing-counts-gray"></span><span class="info-label playing-counts-label">${R.short(g.players)}</span></div>` : ""}
      ${g.extra ? `<div class="rg-tile-extra">${g.extra}</div>` : ""}</a>${g.corner || ""}</div></li>`;
  };
  R.tileGrid = (inner) => `<ul class="hlist games game-cards game-tile-list rg-tiles">${inner}</ul>`;
  R.rogenUrl = (view = "dashboard") => `https://www.roblox.com/rogen#${view}`;
  R.errBox = (e) => `<div class="rg-empty rg-err">Couldn't load: ${R.esc(e && e.message ? e.message : e)}</div>`;
  R.stat = (label, value, hint = "") => `<div class="rg-stat"><div class="rg-stat-v">${value}</div><div class="rg-stat-l">${R.esc(label)}</div>${hint ? `<div class="rg-stat-h">${hint}</div>` : ""}</div>`;
  R.copy = (text, label) => `<button class="rg-chip rg-copy" data-copy="${R.esc(text)}" title="Copy">${R.esc(label)} <b>${R.esc(text)}</b> ⧉</button>`;
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-copy]");
    if (!b) return;
    e.preventDefault();
    navigator.clipboard.writeText(b.dataset.copy).then(() => R.toast("Copied " + b.dataset.copy));
  });
  R.toast = (msg) => {
    let t = document.getElementById("rg-toast");
    if (!t) {
      t = R.h(`<div id="rg-toast"></div>`);
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove("show"), 1800);
  };
  R.csv = (rows, filename) => {
    const cell = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const text = rows.map((r) => r.map(cell).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  // Simple line chart (SVG). points: [{t, v}]
  R.chart = (points, { h = 120, label = "", money = false } = {}) => {
    const pts = points.filter((p) => p && p.v != null && !isNaN(p.v));
    const fmtV = money ? (n) => "R$" + R.short(n) : R.short;
    if (pts.length < 2) return `<div class="rg-chart rg-chart-empty"><div class="rg-chart-top"><span>${R.esc(label)}</span>${pts.length ? `<span>${fmtV(pts[0].v)} <em>now</em></span>` : ""}</div>
      <div class="rg-chart-wait">${pts.length ? `Tracking since ${R.dateTime(pts[0].t)}. The graph draws itself as RoGen collects more points.` : "No data yet."}</div></div>`;
    const W = 600, H = h, P = 6;
    const ts = pts.map((p) => +p.t), vs = pts.map((p) => +p.v);
    const t0 = Math.min(...ts), t1 = Math.max(...ts), v0 = Math.min(...vs), v1 = Math.max(...vs);
    const x = (t) => P + ((t - t0) / (t1 - t0 || 1)) * (W - 2 * P);
    const y = (v) => H - P - ((v - v0) / (v1 - v0 || 1)) * (H - 2 * P);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${x(+p.t).toFixed(1)},${y(+p.v).toFixed(1)}`).join(" ");
    const area = `${d} L${x(t1).toFixed(1)},${H} L${x(t0).toFixed(1)},${H} Z`;
    const f = money ? (n) => "R$" + R.short(n) : R.short;
    return `<div class="rg-chart">
      <div class="rg-chart-top"><span>${R.esc(label)}</span><span>${f(vs[vs.length - 1])} <em>now</em> · ${f(v1)} <em>high</em> · ${f(v0)} <em>low</em></span></div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${area}" class="rg-area"/><path d="${d}" class="rg-line" vector-effect="non-scaling-stroke"/></svg>
      <div class="rg-chart-bot"><span>${R.dateTime(t0)}</span><span>${R.dateTime(t1)}</span></div></div>`;
  };

  // Insert a node after the first matching anchor, or at top of the main content. Keeps it there if React re-renders.
  R.mount = (node, anchors, { where = "afterend" } = {}) => {
    const place = () => {
      if (document.contains(node)) return true;
      for (const sel of anchors) {
        const a = document.querySelector(sel);
        if (a) {
          a.insertAdjacentElement(where, node);
          return true;
        }
      }
      return false;
    };
    place();
    return place;
  };
  R.mainContent = () => document.querySelector("#container-main > .content") || document.querySelector("#container-main") || document.body;

  /* ---------- feature registry ---------- */
  R.routes = [];
  // key = the switch in Settings → Features that turns this on or off
  R.route = (test, fn, key) => R.routes.push({ test, fn, key });

  /* ---------- features you can turn off (Settings → Features) ---------- */
  R.FEATURES = [
    ["Profiles", "profileTab", "RoGen tab on profiles", "Overview, value, history and playtime for any player", true],
    ["Profiles", "profileStatus", "Your status bubble", "The Discord-style bubble on your profile picture", true],
    ["Profiles", "rogenBadges", "RoGen badges", "RoGen badges next to names and on profiles", true],
    ["Profiles", "pfp", "Custom profile picture", "Shows your own picture instead of your headshot (only in your browser)", true],
    ["Profiles", "navDot", "Status dot in the top bar", "A small dot on your avatar at the top of every page", true],
    ["Roblox pages", "infoButton", "Info button", "IDs, copy buttons, Vault and Track in the corner of game, profile, community, item and badge pages", true],
    ["Roblox pages", "gameTab", "RoGen tab on games", "Servers, stats, badges and alerts on game pages", true],
    ["Roblox pages", "groupTab", "RoGen tab on communities", "Visits, players and hidden games on community pages", true],
    ["Roblox pages", "catalogTab", "RoGen on catalog items", "Price history and outlook on item pages", true],
    ["Roblox pages", "catalogLimiteds", "Marketplace extras", "Copy-item filter and deals on the Marketplace", true],
    ["Roblox pages", "chartsDiscover", "Discover on Charts", "RoGen Discover button on Roblox Charts", true],
    ["Roblox pages", "transactions", "Spending on Transactions", "Your spending summary at the bottom of the Transactions page", true],
    ["Roblox pages", "friendsPage", "Extras on the Friends page", "Who unadded you and a friend count graph", true],
    ["Roblox pages", "avatarEditor", "RoGen avatar editor", "RoGen's editor on the Avatar page", true],
    ["Roblox pages", "notifs", "RoGen alerts in notifications", "RoGen's alerts in Roblox's notification panel", true],
    ["Getting around", "quickFind", "Quick find (Ctrl K)", "One search box for games, players and pages", true],
    ["Getting around", "searchDropdown", "Better search dropdown", "Games, players and friends under Roblox's search box", true],
    ["Getting around", "searchMutuals", "Mutual friends in search", "How many mutual friends you have with a player in the search dropdown", false],
    ["Getting around", "shortcuts", "Keyboard shortcuts", "Alt + letter shortcuts to jump around Roblox", true],
    ["Getting around", "backToTop", "Back to top button", "A button to jump back up on long pages", false]
  ];
  R.FEATURE_DEFAULTS = Object.fromEntries(R.FEATURES.map((f) => [f[1], f[4]]));
  let featCache = {}, liveOff = new Set();
  // the owner can switch a feature off for everyone (for when a Roblox change breaks it); that wins over your own switch
  R.feat = (key) => !key || (!liveOff.has(key) && (key in featCache ? featCache[key] !== false : R.FEATURE_DEFAULTS[key] !== false));
  R.featOffByOwner = (key) => liveOff.has(key);
  const setLive = (l) => { liveOff = new Set(((l && l.off) || []).filter((k) => typeof k === "string")); };
  R.featReady = new Promise((res) => chrome.storage.local.get(["rgFeatures", "rgLive"], (v) => { featCache = (v && v.rgFeatures) || {}; setLive(v && v.rgLive); res(); }));
  chrome.storage.onChanged.addListener((ch) => {
    if (ch.rgFeatures) featCache = ch.rgFeatures.newValue || {};
    if (ch.rgLive) setLive(ch.rgLive.newValue);
    if (ch.rgFeatures || ch.rgLive) R.onFeatures && R.onFeatures();
  });
  R.setFeat = async (key, on) => { const all = await R.get1("rgFeatures", {}); all[key] = !!on; await R.set({ rgFeatures: all }); };
})();
