// Header search: while you type in Roblox's search box, show the top player and the top game right under it.
//   Player row: avatar + online dot, name, "Playing <game>" / Online / Last seen, your mutual friends, Join button when they're in a game
//   Game row:   icon, name, like %, players now, Play button and a button that opens the game's RoGen tab (server browser)
(() => {
  if (window.__rgSearchTop) return;
  window.__rgSearchTop = true;
  const R = window.Rogen;
  const SESSION = crypto.randomUUID();
  const cache = new Map();
  let panel = null, input = null, token = 0, timer = 0, keep = 0, pressing = false, hi = -1;

  /* ---------- which input is Roblox's top-bar search box ---------- */
  const SEL = 'input[type="search"], input[role="combobox"], input[name*="search" i], input[id*="search" i], input[data-testid*="search" i], #navbar-universal-search input';
  const isSearchInput = (el) => {
    if (!el || el.tagName !== "INPUT" || el.closest(".rg-pane, .rg-section, .rg-embed, .rg-sq, .rg-ask, .rg-finder, .rg-page")) return false;
    if (el.type && !/^(text|search)$/i.test(el.type)) return false;
    const named = el.matches(SEL) || /search/i.test(`${el.placeholder || ""} ${el.getAttribute("aria-label") || ""}`);
    if (!named) return false;
    const r = el.getBoundingClientRect();
    return r.width > 100 && r.top < 120;                      // the header, never a search box further down the page
  };

  /* ---------- data ---------- */
  const topPerson = async (q) => {
    let u = null;
    try { u = await R.userByName(q); } catch (e) { /* not a valid username, fall through to search */ }
    if (!u) {
      try { u = ((await R.api(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(q)}&limit=10`)).data || [])[0] || null; } catch (e) { /* ignore */ }
    }
    if (!u) return null;
    const [pres, th] = await Promise.all([
      R.api("https://presence.roblox.com/v1/presence/users", { method: "POST", body: { userIds: [u.id] } }).then((d) => (d.userPresences || [])[0]).catch(() => null),
      R.thumbs("user", [u.id], "150x150")
    ]);
    await R.badges.ready().catch(() => {});
    return { id: u.id, name: u.name, displayName: u.displayName || u.name, thumb: th[u.id] || "", pres, verified: !!u.hasVerifiedBadge, badges: R.badges.sync(u.id) };
  };

  const topGame = async (q) => {
    const d = await R.api(`https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(q)}&sessionId=${SESSION}&pageType=all`);
    let raw = null;
    for (const grp of d.searchResults || []) {
      if (grp.contentGroupType && grp.contentGroupType !== "Game") continue;
      if ((grp.contents || [])[0]) { raw = grp.contents[0]; break; }
    }
    if (!raw) return null;
    const g = R.normGame(raw);
    if (!g.placeId || !g.players) {
      try { const x = (await R.games([g.universeId]))[0]; if (x) { g.placeId = g.placeId || x.rootPlaceId; g.players = g.players || x.playing || 0; } } catch (e) { /* ignore */ }
    }
    if (!g.placeId) return null;
    if (!(g.up + g.down)) {
      try { const x = (await R.votes([g.universeId]))[g.universeId]; if (x) { g.up = x.upVotes; g.down = x.downVotes; } } catch (e) { /* ignore */ }
    }
    const th = await R.thumbs("game", [g.universeId], "150x150");
    return { ...g, thumb: th[g.universeId] || "" };
  };

  const statusOf = (p) => {
    if (!p) return { text: "", dot: "" };
    const t = p.userPresenceType;
    if (t === 2) return { text: p.lastLocation ? `Playing ${p.lastLocation}` : "In a game", dot: "game" };
    if (t === 3) return { text: "In Studio", dot: "studio" };
    if (t === 1) return { text: "Online", dot: "online" };
    return { text: p.lastOnline ? `Last seen ${R.ago(p.lastOnline)}` : "Offline", dot: "" };
  };

  /* ---------- drawing ---------- */
  const ICON = {
    play: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z"/></svg>`,
    servers: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>`,
    like: `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M2 10.5h4V21H2zM8 10.5l3.4-7.2a1.6 1.6 0 0 1 3 .9L13.6 9H20a2 2 0 0 1 2 2.4l-1.5 7.5A2.5 2.5 0 0 1 18 21H8z"/></svg>`,
    people: `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><circle cx="12" cy="7.5" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>`
  };

  const personRow = (p) => {
    const s = statusOf(p.pres);
    const pr = p.pres || {};
    const join = pr.userPresenceType === 2 && pr.rootPlaceId && pr.gameId
      ? `<a class="rg-sq-btn" href="roblox://experiences/start?placeId=${Number(pr.rootPlaceId)}&gameInstanceId=${encodeURIComponent(pr.gameId)}" title="Join ${R.esc(p.displayName)}">${ICON.play}</a>` : "";
    return `<div class="rg-sq-row rg-sq-person" data-id="${p.id}">
      <a class="rg-sq-link" href="https://www.roblox.com/users/${p.id}/profile">
        <span class="rg-sq-av">${p.thumb ? `<img src="${R.esc(p.thumb)}" alt="">` : "<img alt=\"\">"}${s.dot ? `<i class="rg-sq-dot ${s.dot}"></i>` : ""}</span>
        <span class="rg-sq-main"><span class="rg-sq-name">${R.esc(p.displayName)}${R.badges.row(p.badges || [], { verified: p.verified, size: 16 })}${p.displayName !== p.name ? ` <span class="rg-sq-at">@${R.esc(p.name)}</span>` : ""}</span>
          <span class="rg-sq-sub">${R.esc(s.text)}</span><span class="rg-sq-mslot"></span></span>
      </a>${join ? `<span class="rg-sq-btns">${join}</span>` : ""}</div>`;
  };

  const gameRow = (g) => {
    const pct = g.up + g.down ? Math.round((g.up / (g.up + g.down)) * 100) + "%" : "";
    return `<div class="rg-sq-row rg-sq-game">
      <a class="rg-sq-link" href="https://www.roblox.com/games/${Number(g.placeId)}">
        <span class="rg-sq-av game">${g.thumb ? `<img src="${R.esc(g.thumb)}" alt="">` : "<img alt=\"\">"}</span>
        <span class="rg-sq-main"><span class="rg-sq-name">${R.esc(g.name)}</span>
          <span class="rg-sq-meta">${pct ? `<span>${ICON.like} ${pct}</span>` : ""}<span>${ICON.people} ${R.short(g.players)}</span></span></span>
      </a><span class="rg-sq-btns">
        <a class="rg-sq-btn" href="https://www.roblox.com/games/${Number(g.placeId)}#rogen" title="Server browser (RoGen)">${ICON.servers}</a>
        <a class="rg-sq-btn" href="https://www.roblox.com/games/start?placeId=${Number(g.placeId)}" title="Play">${ICON.play}</a>
      </span></div>`;
  };

  // Your mutual friends with the top player, shown under their status
  const mutualInto = (p) => {
    const me = R.me();
    if (!me || me.id === p.id || !R.mutualFriends) return;
    R.mutualFriends(p.id).then(async (ids) => {
      if (!ids.length || !panel) return;
      const th = await R.thumbs("user", ids.slice(0, 3), "48x48");
      const slot = panel && panel.querySelector(`.rg-sq-person[data-id="${p.id}"] .rg-sq-mslot`);
      if (!slot) return;
      slot.innerHTML = `<span class="rg-mav">${ids.slice(0, 3).map((id) => `<img src="${R.esc(th[id] || "")}" alt="">`).join("")}</span><span>${ids.length} mutual friend${ids.length === 1 ? "" : "s"}</span>`;
    }).catch(() => {});
  };

  /* ---------- panel ---------- */
  // Roblox's own dropdown ("airedrez in Games / in People / ..."): find it by those rows, so ours can take its exact place
  const NATIVE_ROW = /^in (Games|People|Marketplace|Communities|Creator Store|Experiences|Users|Catalog)$/i;
  let nat = null;
  const findNative = () => {
    if (nat && nat.isConnected) return nat;
    nat = null;
    if (!input) return null;
    const rows = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    for (let n = w.nextNode(); n && rows.length < 2; n = w.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest(".rg-sq") || el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
      if (NATIVE_ROW.test(n.nodeValue.trim()) && el.getClientRects().length) rows.push(el);
    }
    if (rows.length < 2) return null;
    let el = rows[0];
    while (el && !el.contains(rows[1])) el = el.parentElement;
    if (!el || el === document.body || el.contains(input)) return null;
    // include a wrapper that only adds the background / border
    for (let i = 0; i < 4 && el.parentElement && el.parentElement !== document.body && !el.parentElement.contains(input); i++) {
      const a = el.getBoundingClientRect(), b = el.parentElement.getBoundingClientRect();
      if (Math.abs(a.left - b.left) > 6 || Math.abs(a.right - b.right) > 6 || Math.abs(a.top - b.top) > 6) break;
      el = el.parentElement;
    }
    nat = el;
    return nat;
  };
  const place = () => {
    if (!panel || !input) return;
    const n = findNative();
    const r = input.getBoundingClientRect();
    if (n) {
      // our two rows go at the very top of Roblox's own dropdown; its rows are pushed down underneath
      const h = panel.offsetHeight;
      const nr = n.getBoundingClientRect();
      const top = nr.top - (n._rgOff || 0);
      panel.style.left = nr.left + "px";
      panel.style.top = top + "px";
      panel.style.width = nr.width + "px";
      const bg = getComputedStyle(n).backgroundColor;
      panel.style.background = bg && !/rgba\(.*,\s*0\)$/.test(bg) && bg !== "transparent" ? bg : "";
      panel.classList.add("rg-sq-flush");
      if (n._rgOff !== h) {
        if (n._rgOff === undefined) {
          n._rgInline = n.style.transform;
          const cs = getComputedStyle(n).transform;
          n._rgBase = cs && cs !== "none" ? new DOMMatrix(cs) : new DOMMatrix();
        }
        // our shift is added on top of whatever transform Roblox already put on its list
        n.style.setProperty("transform", new DOMMatrix([1, 0, 0, 1, 0, h]).multiply(n._rgBase).toString(), "important");
        n._rgOff = h;
      }
    } else {
      const w = Math.min(Math.max(r.width, 380), innerWidth - 16);
      panel.style.width = w + "px";
      panel.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px";
      panel.style.top = r.bottom + 6 + "px";
      panel.style.background = "";
      panel.classList.remove("rg-sq-flush");
    }
  };
  const close = () => {
    token++;
    hi = -1;
    clearTimeout(timer);
    clearInterval(keep); keep = 0;
    if (panel) { panel.remove(); panel = null; }
    if (nat) {
      if (nat._rgInline) nat.style.setProperty("transform", nat._rgInline); else nat.style.removeProperty("transform");
      delete nat._rgOff; delete nat._rgBase; delete nat._rgInline;
    }
    nat = null;
  };
  const show = ({ person, game }) => {
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "rg-sq";
      // Roblox reacts to the press itself (closing its dropdown), so we open the link on mouse-down instead of waiting for the click
      panel.addEventListener("mousedown", (e) => {
        e.preventDefault(); e.stopPropagation();
        pressing = true; setTimeout(() => { pressing = false; }, 1500);
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;   // new-tab clicks use the normal link behaviour
        const row = e.target.closest(".rg-sq-row");
        const a = e.target.closest("a") || (row && row.querySelector(".rg-sq-link"));
        const href = a && a.getAttribute("href");
        if (!href) return;
        location.href = href;                                              // roblox:// links launch the game, others open the page
        setTimeout(close, 150);
      });
      panel.addEventListener("pointerdown", (e) => e.stopPropagation());
      panel.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!(e.ctrlKey || e.metaKey || e.shiftKey)) e.preventDefault();   // already handled on mouse-down
        else setTimeout(close, 0);
      });
      document.body.appendChild(panel);
    }
    R.applyThemeAttr();
    hi = -1;
    panel.innerHTML = (person ? personRow(person) : "") + (game ? gameRow(game) : "");
    place();
    if (!keep) keep = setInterval(() => {
      if (!pressing && (!input || !input.isConnected || input.value.trim().length < 2)) return close();   // box cleared or Roblox redrew the header
      place();
    }, 200);
    if (person) mutualInto(person);
  };

  const run = async (q) => {
    const my = ++token;
    const key = q.toLowerCase();
    let res = cache.get(key);
    if (!res || Date.now() - res.t > 60e3) {
      const [person, game] = await Promise.all([topPerson(q).catch(() => null), topGame(q).catch(() => null)]);
      res = { person, game, t: Date.now() };
      cache.set(key, res);
      if (cache.size > 40) cache.delete(cache.keys().next().value);
    }
    if (my !== token || !input || input.value.trim() !== q) return;   // you kept typing
    if (!res.person && !res.game) return close();
    show(res);
  };

  document.addEventListener("input", (e) => {
    if (!isSearchInput(e.target)) return;
    input = e.target;
    const q = input.value.trim();
    clearTimeout(timer);
    if (q.length < 2) { close(); return; }
    timer = setTimeout(() => run(q), 300);
  }, true);
  document.addEventListener("mousedown", (e) => { if (panel && !panel.contains(e.target) && e.target !== input) close(); }, true);
  // Arrow keys move through our rows (then back to Roblox's list), Enter opens, Shift+Enter plays / joins
  document.addEventListener("keydown", (e) => {
    if (!panel) return;
    const rows = [...panel.querySelectorAll(".rg-sq-row")];
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && document.activeElement === input) {
      if (e.key === "ArrowUp" && hi < 0) return;
      if (e.key === "ArrowDown" && hi >= rows.length - 1) { hi = -1; rows.forEach((r) => r.classList.remove("on")); return; }   // hand over to Roblox's list
      e.preventDefault(); e.stopPropagation();
      hi += e.key === "ArrowDown" ? 1 : -1;
      rows.forEach((r, i) => r.classList.toggle("on", i === hi));
      return;
    }
    if (e.key === "Enter" && hi >= 0 && rows[hi]) {
      e.preventDefault(); e.stopPropagation();
      const alt = e.shiftKey && rows[hi].querySelector(".rg-sq-btn[title='Play'], .rg-sq-btn[title^='Join']");
      const href = (alt || rows[hi].querySelector(".rg-sq-link")).getAttribute("href");
      close();
      location.href = href;
      return;
    }
    if (e.key === "Escape" || e.key === "Enter") close();
  }, true);
  window.addEventListener("resize", place);
})();
