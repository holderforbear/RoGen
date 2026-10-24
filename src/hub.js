// RoGen hub: Vault, Tracker data, Overlay on Roblox pages, interface options, and the extras added
// to Wallet, Friends, Search, Settings, Tools and the dashboard.
(() => {
  const R = window.Rogen;
  const RB = "https://www.roblox.com";
  const $$ = (root, s) => [...root.querySelectorAll(s)];
  const ic = (p, s = 16) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  R.ic = ic;
  const I = {
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    id: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h4M7 14h7"/>'
  };
  R.hubIcons = I;

  /* ================= data ================= */
  // Vault: favorite profiles, games, items, developers, plus a wishlist of items
  R.vault = {
    async all() { return { users: [], games: [], items: [], devs: [], wish: [], ...(await R.get1("vault", {})) }; },
    async has(kind, id) { return (await R.vault.all())[kind].some((x) => String(x.id) === String(id)); },
    async toggle(kind, entry) {
      const v = await R.vault.all();
      const on = v[kind].some((x) => String(x.id) === String(entry.id));
      v[kind] = on ? v[kind].filter((x) => String(x.id) !== String(entry.id)) : [{ ...entry, at: Date.now() }, ...v[kind]];
      await R.set({ vault: v });
      return !on;
    }
  };
  // Tracker: profiles, communities, games and items RoGen checks every 30 minutes for public changes
  R.tracker = {
    async all() { return { users: {}, groups: {}, games: {}, items: {}, ...(await R.get1("trk", {})) }; },
    async has(kind, id) { return !!(await R.tracker.all())[kind][id]; },
    async toggle(kind, id, data) {
      const t = await R.tracker.all();
      if (t[kind][id]) delete t[kind][id]; else t[kind][id] = { ...data, at: Date.now() };
      await R.set({ trk: t });
      return !!t[kind][id];
    }
  };
  R.searchHist = {
    all: () => R.get1("searchHist", []),
    async add(q) { q = String(q).trim(); if (!q) return; const l = (await R.searchHist.all()).filter((x) => x.toLowerCase() !== q.toLowerCase()); l.unshift(q); await R.set({ searchHist: l.slice(0, 20) }); },
    clear: () => R.set({ searchHist: [] })
  };
  R.ui = async () => ({ overlay: true, oled: false, hide: {}, banner: "", ...(await R.get1("rgUi", {})) });

  // small helpers
  R.pctText = (a, b) => (b ? `${a >= b ? "+" : "−"}${Math.abs(Math.round(((a - b) / b) * 100))}%` : "");
  R.badgeStats = async (ids) => {
    const out = {};
    for (const c of R.chunks(ids, 25)) await Promise.all(c.map(async (id) => { try { out[id] = await R.api(`https://badges.roblox.com/v1/badges/${id}`); } catch (e) { /* skip */ } }));
    return out;
  };
  // every badge a user has (newest first), with Roblox's rarity numbers when the list includes them
  // Roblox gives win rate as a fraction (0.05 = 5%); RoGen's own pages use percent
  R.ratePct = (w) => (w == null ? null : w * 100);
  R.userBadges = async (uid, max = 10, onPage) => (await R.pages((c) => `https://badges.roblox.com/v1/users/${uid}/badges?limit=100&sortOrder=Desc${c ? `&cursor=${encodeURIComponent(c)}` : ""}`, { max, onPage })).map((b) => (b.statistics && b.statistics.winRatePercentage != null ? { ...b, statistics: { ...b.statistics, winRatePercentage: R.ratePct(b.statistics.winRatePercentage) } } : b));
  R.awardedDates = async (uid, badgeIds) => {
    const out = {};
    for (const c of R.chunks(badgeIds, 100)) {
      try { (await R.api(`https://badges.roblox.com/v1/users/${uid}/badges/awarded-dates?badgeIds=${c.join(",")}`)).data.forEach((x) => (out[x.badgeId] = x.awardedDate)); } catch (e) { /* skip */ }
    }
    return out;
  };
  R.catalogDetails = async (ids, itemType = "Asset") => {
    const out = {};
    for (const c of R.chunks(ids, 100)) {
      try { (await R.api("https://catalog.roblox.com/v1/catalog/items/details", { method: "POST", body: { items: c.map((id) => ({ itemType, id })) } })).data.forEach((x) => (out[x.id] = x)); } catch (e) { /* skip */ }
    }
    return out;
  };
  R.friendsOf = async (uid) => {
    try { return ((await R.api(`https://friends.roblox.com/v1/users/${uid}/friends`)).data || []).map((f) => f.id); }
    catch (e) { return R.friendIds ? R.friendIds(uid) : []; }
  };
  // run a list of async jobs a few at a time
  R.pool = async (items, n, fn) => { let k = 0; const w = async () => { while (k < items.length) { const i = k++; await fn(items[i], i); } }; await Promise.all(Array.from({ length: n }, w)); };

  /* ================= interface options ================= */
  async function applyUi() {
    const u = await R.ui();
    const h = document.documentElement;
    h.classList.toggle("rg-oled", !!u.oled);
    ["chat", "footer", "sponsored", "premium", "friendsRow", "robuxNav"].forEach((k) => h.classList.toggle("rg-hide-" + k, !!u.hide[k]));
    R.native && R.native();
  }
  R.applyUi = applyUi;
  applyUi();
  chrome.storage.onChanged.addListener((ch) => { if (ch.rgUi) applyUi(); });
  // "Sponsored" rows on Home are found by their title
  let hideTimer = 0;
  const hideSponsored = () => {
    if (!document.documentElement.classList.contains("rg-hide-sponsored")) return;
    document.querySelectorAll("h2, h3, .container-header span, [class*='sort-header'] span").forEach((el) => {
      if (!/^\s*sponsored\b/i.test(el.textContent || "") || el.closest(".rg-page")) return;
      let box = el.closest("[class*='game-sort'], [class*='carousel'], .container-list, section, [data-testid*='sort']") || el.parentElement?.parentElement;
      if (box && box !== document.body) box.classList.add("rg-hidden-el");
    });
  };
  new MutationObserver(() => { clearTimeout(hideTimer); hideTimer = setTimeout(hideSponsored, 400); }).observe(document.documentElement, { childList: true, subtree: true });

  // Your profile banner (only you see it)
  const BANNERS = { "": "", dusk: "linear-gradient(120deg,#1e1b4b,#7c3aed 55%,#db2777)", ocean: "linear-gradient(120deg,#0c4a6e,#0891b2 55%,#22d3ee)", ember: "linear-gradient(120deg,#431407,#ea580c 55%,#facc15)", forest: "linear-gradient(120deg,#052e16,#16a34a 55%,#a3e635)", mono: "linear-gradient(120deg,#0a0a0a,#3f3f46 55%,#a1a1aa)", rose: "linear-gradient(120deg,#4c0519,#e11d48 55%,#fda4af)" };
  R.BANNERS = BANNERS;
  R.route((p) => /^\/users\/\d+\/profile/i.test(p), () => {
    let node = null;
    const place = async () => {
      const me = R.me(), m = location.pathname.match(/\/users\/(\d+)/);
      if (!me || !m || Number(m[1]) !== me.id) return;
      const u = await R.ui();
      if (!BANNERS[u.banner]) { node && node.remove(); node = null; return; }
      const hdr = document.querySelector(".user-profile-header, .profile-header, #profile-header");
      if (!hdr) return;
      if (node && document.contains(node)) { node.style.background = BANNERS[u.banner]; return; }
      node = R.h(`<div class="rg-pbanner" aria-hidden="true"></div>`);
      node.style.background = BANNERS[u.banner];
      hdr.parentElement.insertBefore(node, hdr);
    };
    place();
    return { tick: place, stop: () => node && node.remove() };
  });

  /* ================= Overlay: IDs and quick actions on Roblox pages ================= */
  const pageInfo = () => {
    const p = location.pathname;
    let m;
    if ((m = p.match(/^\/games\/(\d+)/i))) return { kind: "game", id: Number(m[1]) };
    if ((m = p.match(/^\/users\/(\d+)\/profile/i))) return { kind: "user", id: Number(m[1]) };
    if ((m = p.match(/^\/(?:groups|communities)\/(\d+)/i))) return { kind: "group", id: Number(m[1]) };
    if ((m = p.match(/^\/catalog\/(\d+)/i))) return { kind: "item", id: Number(m[1]) };
    if ((m = p.match(/^\/bundles\/(\d+)/i))) return { kind: "bundle", id: Number(m[1]) };
    if ((m = p.match(/^\/badges\/(\d+)/i))) return { kind: "badge", id: Number(m[1]) };
    return null;
  };
  R.route((p) => R.feat("infoButton") && /^\/(games|users\/\d+\/profile|groups|communities|catalog|bundles|badges)\/?/i.test(p) && !!pageInfo(), () => {
    const info = pageInfo();
    let box = null, stopped = false;
    const row = (label, val, copy = true) => (val == null || val === "" || val === "undefined") ? "" : `<div class="ov-row"><span>${R.esc(label)}</span>${copy ? `<button class="ov-copy" data-copy="${R.esc(val)}" title="Copy">${R.esc(val)}${ic('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>', 13)}</button>` : `<b>${val}</b>`}</div>`;
    const act = (cls, on, iconP, labelOn, labelOff) => `<button class="ov-act ${cls} ${on ? "on" : ""}" aria-pressed="${on}">${ic(iconP, 15)}<span>${on ? labelOn : labelOff}</span></button>`;
    async function build() {
      const u = await R.ui();
      if (stopped) return;
      box = R.h(`<div class="rg-overlay" role="complementary" aria-label="RoGen info"><button class="ov-tab" type="button"><span class="rg-logo"></span>Info</button><div class="ov-card" hidden><div class="ov-body"><div class="rg-loading">Loading…</div></div></div></div>`);
      document.body.appendChild(box);
      R.applyThemeAttr();
      const card = box.querySelector(".ov-card"), body = box.querySelector(".ov-body");
      box.querySelector(".ov-tab").onclick = () => { card.hidden = !card.hidden; R.set({ ovOpen: !card.hidden }); if (!card.hidden && !body.dataset.done) fill(body); };
      if (await R.get1("ovOpen", false)) { card.hidden = false; fill(body); }
    }
    async function fill(body) {
      body.dataset.done = "1";
      try {
        let html = "", vaultKind = null, vaultEntry = null, trackKind = null, trackData = null;
        if (info.kind === "game") {
          const uid = await R.universeOf(info.id);
          const g = (await R.games([uid]))[0] || {};
          const creator = g.creator || {};
          html = `<div class="ov-title">${R.esc(g.name || "Game")}</div>` + row("Place ID", info.id) + row("Universe ID", uid)
            + row("Creator", `<a href="${creator.type === "Group" ? `${RB}/communities/${creator.id}` : `${RB}/users/${creator.id}/profile`}">${R.esc(creator.name || "?")}</a>${creator.hasVerifiedBadge ? " ✓" : ""}`, false)
            + row(creator.type === "Group" ? "Community ID" : "Creator ID", creator.id)
            + row("Created", R.date(g.created), false) + row("Updated", `${R.date(g.updated)} <small>(${R.ago(g.updated)})</small>`, false)
            + row("Max players", R.fmt(g.maxPlayers || 0), false) + row("Genre", R.esc([g.genre_l1, g.genre].filter(Boolean)[0] || g.genre || "—"), false)
            + `<a class="ov-link" href="${creator.type === "Group" ? `${RB}/communities/${creator.id}` : `${RB}/users/${creator.id}/profile`}#rogen">More games by this creator →</a>`;
          vaultKind = "games"; vaultEntry = { id: uid, placeId: info.id, name: g.name };
          trackKind = "games"; trackData = { name: g.name, placeId: info.id }; info.trackId = uid;
        } else if (info.kind === "user") {
          const s = await R.api(`https://users.roblox.com/v1/users/${info.id}`);
          html = `<div class="ov-title">${R.esc(s.displayName)} <small>@${R.esc(s.name)}</small></div>` + row("User ID", info.id) + row("Username", s.name)
            + row("Joined", `${R.date(s.created)} <small>(${Math.floor((Date.now() - new Date(s.created)) / 864e5).toLocaleString()} days)</small>`, false)
            + `<a class="ov-link" href="${R.rogenUrl("id")}?q=${info.id}">Full analysis in RoGen ID →</a>`;
          vaultKind = "users"; vaultEntry = { id: info.id, name: s.displayName, username: s.name };
          trackKind = "users"; trackData = { name: s.displayName };
        } else if (info.kind === "group") {
          const g = await R.api(`https://groups.roblox.com/v1/groups/${info.id}`);
          html = `<div class="ov-title">${R.esc(g.name)}</div>` + row("Community ID", info.id)
            + row("Owner", g.owner ? `<a href="${RB}/users/${g.owner.userId}/profile">@${R.esc(g.owner.username)}</a>` : "No owner", false)
            + (g.owner ? row("Owner ID", g.owner.userId) : "") + row("Members", R.fmt(g.memberCount || 0), false);
          vaultKind = "devs"; vaultEntry = { id: "g" + info.id, gid: info.id, name: g.name, type: "Group" };
          trackKind = "groups"; trackData = { name: g.name };
        } else if (info.kind === "item" || info.kind === "bundle") {
          const isB = info.kind === "bundle";
          const d = isB ? await R.api(`https://catalog.roblox.com/v1/bundles/${info.id}/details`) : await R.api(`https://economy.roblox.com/v2/assets/${info.id}/details`);
          const name = isB ? d.name : d.Name, creator = isB ? d.creator?.name : d.Creator?.Name;
          html = `<div class="ov-title">${R.esc(name)}</div>` + row(isB ? "Bundle ID" : "Asset ID", info.id) + row("Creator", R.esc(creator || "?"), false)
            + (!isB ? row("Created", R.date(d.Created), false) + row("Updated", R.date(d.Updated), false) + (d.CollectiblesItemDetails || d.IsLimited || d.IsLimitedUnique ? row("Limited", "Yes", false) : "") : "");
          vaultKind = "wish"; vaultEntry = { id: info.id, name, type: isB ? "Bundle" : "Asset" };
          if (!isB && (d.IsLimited || d.IsLimitedUnique || d.CollectiblesItemDetails)) { trackKind = "items"; trackData = { name, pct: 10 }; }
        } else if (info.kind === "badge") {
          const b = await R.api(`https://badges.roblox.com/v1/badges/${info.id}`);
          const st = { ...(b.statistics || {}) }; if (st.winRatePercentage != null) st.winRatePercentage = R.ratePct(st.winRatePercentage);
          html = `<div class="ov-title">${R.esc(b.name)}</div>` + row("Badge ID", info.id)
            + row("Rarity", `${(st.winRatePercentage ?? 0).toFixed(1)}% <small>${rarityWord(st.winRatePercentage)}</small>`, false)
            + row("Awarded", R.fmt(st.awardedCount || 0), false) + row("Yesterday", R.fmt(st.pastDayAwardedCount || 0), false)
            + (b.awardingUniverse ? row("Game", `<a href="${RB}/games/${b.awardingUniverse.rootPlaceId}">${R.esc(b.awardingUniverse.name)}</a>`, false) : "");
        }
        const vOn = vaultKind ? await R.vault.has(vaultKind, vaultEntry.id) : false;
        const tId = info.trackId || info.id;
        const tOn = trackKind ? await R.tracker.has(trackKind, tId) : false;
        body.innerHTML = html + `<div class="ov-acts">${vaultKind ? act("ov-vault", vOn, vaultKind === "wish" ? I.heart : I.star, vaultKind === "wish" ? "On wishlist" : "In Vault", vaultKind === "wish" ? "Wishlist" : "Save to Vault") : ""}${trackKind ? act("ov-track", tOn, I.target, "Tracking", "Track changes") : ""}</div>`;
        const vb = body.querySelector(".ov-vault"), tb = body.querySelector(".ov-track");
        if (vb) vb.onclick = async () => { const on = await R.vault.toggle(vaultKind, vaultEntry); vb.classList.toggle("on", on); vb.setAttribute("aria-pressed", on); vb.querySelector("span").textContent = on ? (vaultKind === "wish" ? "On wishlist" : "In Vault") : (vaultKind === "wish" ? "Wishlist" : "Save to Vault"); R.toast(on ? (vaultKind === "wish" ? "Added to your wishlist" : "Saved to your Vault") : "Removed"); };
        if (tb) tb.onclick = async () => { const on = await R.tracker.toggle(trackKind, tId, trackData); tb.classList.toggle("on", on); tb.setAttribute("aria-pressed", on); tb.querySelector("span").textContent = on ? "Tracking" : "Track changes"; R.toast(on ? "Tracking. Changes show up in RoGen → Tracker" : "Stopped tracking"); if (on) R.send({ type: "runTracker" }); };
      } catch (e) { body.innerHTML = R.errBox(e); }
    }
    build();
    return { tick: () => { if (box && !document.contains(box)) document.body.appendChild(box); }, stop: () => { stopped = true; box && box.remove(); } };
  });
  const rarityWord = (p) => (p == null ? "" : p < 0.1 ? "Insane" : p < 1 ? "Extreme" : p < 5 ? "Hard" : p < 20 ? "Challenging" : p < 50 ? "Moderate" : "Easy");
  R.rarityWord = rarityWord;

  /* ================= Wallet: earned vs spent, pending, biggest purchases ================= */
  R.walletTop = async (el, me) => {
    if (!el) return;
    let tf = "Year";
    const draw = async () => {
      el.innerHTML = `<div class="rg-section section"><div class="container-header rg-head"><h2>Robux in and out</h2><div class="rg-head-right"><div class="rg-seg wl-tf">${["Day", "Week", "Month", "Year"].map((t) => `<button class="${t === tf ? "on" : ""}" data-tf="${t}">${t === "Day" ? "Today" : "Past " + t.toLowerCase()}</button>`).join("")}</div></div></div>
        <div class="section-content rg-body wl-body"><div class="rg-loading">Loading…</div></div></div>`;
      el.querySelectorAll("[data-tf]").forEach((b) => (b.onclick = () => { tf = b.dataset.tf; draw(); }));
      const body = el.querySelector(".wl-body");
      try {
        const t = await R.api(`https://economy.roblox.com/v2/users/${me.id}/transaction-totals?timeFrame=${tf}&transactionType=summary`);
        const inc = t.incomingRobuxTotal ?? 0, out = Math.abs(t.outgoingRobuxTotal ?? 0), pend = t.pendingRobuxTotal ?? 0;
        const lines = [
          ["Sales of your items and passes", t.salesTotal], ["Community payouts", t.groupPayoutsTotal], ["Premium payouts", t.premiumPayoutsTotal],
          ["Premium stipend", t.premiumStipendsTotal], ["Robux you bought", t.currencyPurchasesTotal], ["Trades (earned)", t.tradeSystemEarningsTotal],
          ["Affiliate sales", t.affiliateSalesTotal], ["Ads revenue share", t.adsRevsharePayoutsTotal], ["Purchases", t.purchasesTotal], ["Trades (paid)", t.tradeSystemCostsTotal],
          ["Ad spend", t.adSpendTotal], ["DevEx cash out", t.developerExchangeTotal]
        ].filter(([, v]) => v);
        const tx = await R.get1("tx", []);
        const big = [...tx].sort((a, b) => R.spent(b) - R.spent(a)).slice(0, 8);
        body.innerHTML = `<div class="rg-stats">${R.stat("Earned", R.robux(inc))}${R.stat("Spent", R.robux(out))}${R.stat("Net", `<span class="${inc - out >= 0 ? "rg-good" : "rg-bad"}">${inc - out >= 0 ? "+" : "−"}${R.robux(Math.abs(inc - out))}</span>`)}${R.stat("Pending", R.robux(pend), "On its way from sales")}</div>
          <div class="rg-2col" style="margin-top:14px"><div><div class="rg-h3">Where it came from and went</div>${lines.length ? `<table class="rg-table"><tbody>${lines.map(([l, v]) => `<tr><td>${l}</td><td class="rg-num ${v > 0 ? "rg-good" : ""}">${v > 0 ? "+" : "−"}${R.robux(Math.abs(v))}</td></tr>`).join("")}</tbody></table>` : `<div class="rg-empty">Nothing in this period.</div>`}</div>
          <div><div class="rg-h3">Biggest purchases</div>${big.length ? `<table class="rg-table"><tbody>${big.map((x) => `<tr><td>${R.esc(x.details?.name || "Purchase")}<div class="rg-mute" style="font-size:12px">${R.date(x.created)}${R.gameOf(x) ? ` · ${R.esc(R.gameOf(x).name)}` : ""}</div></td><td class="rg-num">${R.robux(R.spent(x))}</td></tr>`).join("")}</tbody></table>` : `<div class="rg-empty">Press Sync purchases below to see these.</div>`}
          <p class="rg-note">Profit and loss on your limiteds is in <a class="rg-link" href="#inventory?tab=pl">Inventory</a>.</p></div></div>`;
      } catch (e) { body.innerHTML = R.errBox(e); }
    };
    draw();
  };

  /* ================= Friends: recently added, leaderboard, name changes ================= */
  R.friendsExtra = async (body, me, tab) => {
    if (tab === "recent") {
      const { friendSince = {}, friendSnap } = await R.get(["friendSince", "friendSnap"]);
      const base = friendSnap ? friendSnap.since : 0;
      const ids = Object.entries(friendSince).filter(([, t]) => t > base + 60e3).sort((a, b) => b[1] - a[1]).slice(0, 100);
      if (!ids.length) { body.innerHTML = `<div class="rg-empty">No new friends since RoGen started watching${base ? ` on ${R.date(base)}` : ""}. New ones show up here with the date you added them.</div>`; return; }
      const users = await R.users(ids.map(([id]) => Number(id)));
      body.innerHTML = `<div class="rg-flist">${ids.map(([id, t]) => { const u = users[id] || {}; return `<div class="rg-frow"><a class="rg-av" href="${RB}/users/${id}/profile"><img data-thumb="user:${id}" alt=""></a><a class="rg-fname" href="${RB}/users/${id}/profile"><b>${R.esc(u.displayName || id)}</b><small>@${R.esc(u.name || "")}</small></a><span class="rg-fpres">Added ${R.ago(t)}</span><span class="rg-mute" style="font-size:13px">${R.date(t)}</span></div>`; }).join("")}</div>`;
      R.fillThumbs(body);
      return;
    }
    if (tab === "names") {
      const tl = (await R.get1("timeline", [])).filter((e) => e.kind === "friend");
      body.innerHTML = `<div class="rg-row space" style="margin-bottom:12px"><span class="rg-mute">RoGen checks your friends' names every 6 hours and tells you when one changes.</span><button class="btn-control-sm fn-check">Check now</button></div>
        ${tl.length ? `<div class="rg-flist">${tl.map((e) => `<div class="rg-frow"><a class="rg-av" href="${e.url}"><img data-thumb="user:${e.id}" alt=""></a><a class="rg-fname" href="${e.url}"><b>${R.esc(e.name)}</b><small>${R.esc(e.text)}</small></a><span class="rg-mute" style="font-size:13px">${R.dateTime(e.t)}</span></div>`).join("")}</div>` : `<div class="rg-empty">No name changes yet. The first check saves everyone's current names.</div>`}`;
      R.fillThumbs(body);
      body.querySelector(".fn-check").onclick = async (ev) => { ev.target.disabled = true; ev.target.textContent = "Checking…"; await R.send({ type: "runTracker" }); R.friendsExtra(body, me, tab); };
      return;
    }
    if (tab === "leader") {
      let metric = (await R.get1("lbMetric", "playtime"));
      const METRICS = { playtime: "Playtime (tracked)", age: "Account age", followers: "Followers", friends: "Friends" };
      const ids = await R.friendIds(me.id);
      const users = await R.users(ids);
      const draw = async () => {
        body.innerHTML = `<div class="rg-row" style="margin-bottom:12px"><div class="rg-seg lb-m">${Object.entries(METRICS).map(([k, l]) => `<button class="${k === metric ? "on" : ""}" data-m="${k}">${l}</button>`).join("")}</div></div><div class="lb-out"><div class="rg-loading">Ranking your friends…</div></div>`;
        body.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => { metric = b.dataset.m; R.set({ lbMetric: metric }); draw(); }));
        const out = body.querySelector(".lb-out");
        let vals = {};
        if (metric === "playtime") {
          const fp = await R.get1("friendPlay", {});
          for (const id of ids) { const u = fp.users ? fp.users[id] : fp[id]; vals[id] = u ? Object.values(u.games || {}).reduce((t, g) => t + (g.ms || 0), 0) || u.ms || u.total || 0 : 0; }
        } else {
          const cache = await R.get1("lbCache", {}), need = ids.filter((id) => !cache[metric + ":" + id] || Date.now() - cache[metric + ":" + id].t > 864e5);
          let done = 0;
          await R.pool(need.slice(0, 250), 4, async (id) => {
            try {
              let v = 0;
              if (metric === "age") v = new Date((await R.api(`https://users.roblox.com/v1/users/${id}`)).created).getTime();
              else v = (await R.api(`https://friends.roblox.com/v1/users/${id}/${metric}/count`)).count || 0;
              cache[metric + ":" + id] = { v, t: Date.now() };
            } catch (e) { /* skip */ }
            if (++done % 10 === 0 && out.isConnected) out.innerHTML = `<div class="rg-loading">Ranking your friends… ${done} of ${need.length}</div>`;
          });
          await R.set({ lbCache: cache });
          for (const id of ids) vals[id] = cache[metric + ":" + id]?.v ?? 0;
        }
        const ranked = ids.filter((id) => vals[id]).sort((a, b) => (metric === "age" ? vals[a] - vals[b] : vals[b] - vals[a])).slice(0, 100);
        const fmtV = (v) => metric === "playtime" ? R.dur(v) : metric === "age" ? `${((Date.now() - v) / 31557600000).toFixed(1)} years` : R.fmt(v);
        out.innerHTML = ranked.length ? `<div class="rg-flist">${ranked.map((id, i) => { const u = users[id] || {}; return `<div class="rg-frow lb-row"><span class="lb-n">${i + 1}</span><a class="rg-av" href="${RB}/users/${id}/profile"><img data-thumb="user:${id}" alt=""></a><a class="rg-fname" href="${RB}/users/${id}/profile"><b>${R.esc(u.displayName || id)}</b><small>@${R.esc(u.name || "")}</small></a><b class="lb-v">${fmtV(vals[id])}</b></div>`; }).join("")}</div>`
          : `<div class="rg-empty">${metric === "playtime" ? "No friend playtime tracked yet. RoGen counts it while Chrome is open." : "Nothing to rank yet."}</div>`;
        R.fillThumbs(out);
      };
      draw();
    }
  };

  /* ================= hooks on existing pages ================= */
  const DASH_EXTRA = async (main) => {
    const cfg = { hidden: [], order: [], ...(await R.get1("rgDash", {})) };
    const dash = main.querySelector(".rg-dash");
    if (!dash) return;
    // Achievement showcase (badges you pinned on the Badges page)
    const show = await R.get1("showcase", []);
    if (show.length && !dash.querySelector(".d-show")) {
      dash.insertAdjacentHTML("beforeend", `<div class="rg-card rg-span2 d-show"><div class="rg-card-h"><h3>Showcase</h3><a href="#collection">Badges</a></div><div class="sc-row">${show.slice(0, 8).map((b) => `<a class="sc-b" href="${RB}/badges/${b.id}" title="${R.esc(b.name)}"><img data-thumb="badge:${b.id}" alt=""><span>${R.esc(b.name)}</span><small>${b.rate != null ? b.rate.toFixed(2) + "%" : ""}</small></a>`).join("")}</div></div>`);
      R.fillThumbs(dash.querySelector(".d-show"));
    }
    const cards = $$(dash, ":scope > .rg-card");
    const title = (c) => (c.querySelector(".rg-card-h h3")?.textContent || "").trim();
    cards.forEach((c) => { const t = title(c); c.hidden = cfg.hidden.includes(t); const o = cfg.order.indexOf(t); c.style.order = o >= 0 ? o : 50; });
    if (!main.querySelector(".d-custom")) {
      dash.insertAdjacentHTML("afterend", `<div class="rg-row" style="justify-content:flex-end;margin-top:10px"><button class="rg-link d-custom">Customize dashboard</button></div>`);
      main.querySelector(".d-custom").onclick = () => customizeDash(main, cards.map(title));
    }
  };
  async function customizeDash(main, titles) {
    const cfg = { hidden: [], order: [], ...(await R.get1("rgDash", {})) };
    let order = [...titles].sort((a, b) => { const x = cfg.order.indexOf(a), y = cfg.order.indexOf(b); return (x < 0 ? 50 : x) - (y < 0 ? 50 : y); });
    const hidden = new Set(cfg.hidden);
    const wrap = R.h(`<div class="rg-modal-wrap"><div class="rg-modal"><div class="rg-modal-head"><h3>Customize dashboard</h3><button class="rg-modal-x" aria-label="Close">${ic(I.x)}</button></div><p class="rg-note" style="margin-top:0">Pick which cards show and move them up or down.</p><div class="dc-list"></div><div class="rg-modal-foot"><button class="btn-control-sm dc-reset">Reset</button><span style="flex:1"></span><button class="btn-primary-sm dc-save">Save</button></div></div></div>`);
    const list = wrap.querySelector(".dc-list");
    const draw = () => { list.innerHTML = order.map((t, i) => `<div class="dc-row"><label class="rg-check"><input type="checkbox" data-t="${R.esc(t)}" ${hidden.has(t) ? "" : "checked"}> ${R.esc(t)}</label><span><button class="btn-control-sm" data-up="${i}" ${i ? "" : "disabled"} aria-label="Move up">↑</button><button class="btn-control-sm" data-dn="${i}" ${i < order.length - 1 ? "" : "disabled"} aria-label="Move down">↓</button></span></div>`).join(""); };
    draw();
    list.onclick = (e) => {
      const up = e.target.closest("[data-up]"), dn = e.target.closest("[data-dn]"), cb = e.target.closest("input[data-t]");
      if (up) { const i = +up.dataset.up; [order[i - 1], order[i]] = [order[i], order[i - 1]]; draw(); }
      if (dn) { const i = +dn.dataset.dn; [order[i + 1], order[i]] = [order[i], order[i + 1]]; draw(); }
      if (cb) cb.checked ? hidden.delete(cb.dataset.t) : hidden.add(cb.dataset.t);
    };
    const close = () => wrap.remove();
    wrap.querySelector(".rg-modal-x").onclick = close;
    wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(); });
    wrap.querySelector(".dc-reset").onclick = async () => { await R.set({ rgDash: {} }); close(); location.reload(); };
    wrap.querySelector(".dc-save").onclick = async () => { await R.set({ rgDash: { hidden: [...hidden], order } }); close(); DASH_EXTRA(main); };
    document.body.appendChild(wrap);
  }

  const SEARCH_EXTRA = async (main) => {
    const form = main.querySelector("form.rg-searchbar"), input = form && form.querySelector("input");
    if (!form) return;
    const chips = R.h(`<div class="sh-chips"></div>`);
    const ids = R.h(`<div class="sh-ids" hidden></div>`);
    form.after(chips, ids);
    const draw = async () => {
      const h = await R.searchHist.all();
      chips.innerHTML = h.length ? `<span class="rg-mute">Recent:</span>${h.slice(0, 10).map((q) => `<button class="rg-chip" data-q="${R.esc(q)}">${R.esc(q)}</button>`).join("")}<button class="rg-link sh-clr">Clear</button>` : "";
      const c = chips.querySelector(".sh-clr"); if (c) c.onclick = async () => { await R.searchHist.clear(); draw(); };
    };
    chips.onclick = (e) => { const b = e.target.closest("[data-q]"); if (b) { input.value = b.dataset.q; form.requestSubmit(); } };
    form.addEventListener("submit", () => {
      const q = input.value.trim();
      R.searchHist.add(q).then(draw);
      // a number could be any kind of ID: offer all of them
      if (/^\d{3,}$/.test(q)) {
        ids.hidden = false;
        ids.innerHTML = `<span class="rg-mute">Open ${R.esc(q)} as:</span>${[["Player", `${RB}/users/${q}/profile`], ["Game (place)", `${RB}/games/${q}`], ["Community", `${RB}/communities/${q}`], ["Item", `${RB}/catalog/${q}`], ["Bundle", `${RB}/bundles/${q}`], ["Badge", `${RB}/badges/${q}`], ["RoGen ID", `${R.rogenUrl("id")}?q=${q}`]].map(([l, u]) => `<a class="rg-chip" href="${u}">${l}</a>`).join("")}`;
      } else ids.hidden = true;
    });
    draw();
  };

  /* Settings → Features: turn any part of RoGen off */
  const SIMPLE_OFF = ["searchMutuals", "backToTop", "navDot", "notifs", "chartsDiscover", "shortcuts", "view:lookup", "view:insights", "view:wrapped", "view:compare", "view:alerts", "view:tools"];
  async function featuresSection(main) {
    const cur = await R.get1("rgFeatures", {});
    const on = (k) => (k in cur ? cur[k] !== false : R.FEATURE_DEFAULTS[k] !== false);
    const groups = {};
    R.FEATURES.forEach(([g, k, label, desc]) => (groups[g] = groups[g] || []).push([k, label, desc]));
    const pages = R.VIEWS.filter(([id]) => !["#", "-"].includes(id[0]) && !["dashboard", "settings", "badges"].includes(id));
    const sw = (k, label, desc) => `<label class="ft-row"><span class="ft-t"><b>${R.esc(label)}</b>${desc ? `<small>${R.esc(desc)}</small>` : ""}</span><span class="ft-sw"><input type="checkbox" data-f="${k}" ${on(k) ? "checked" : ""}><i></i></span></label>`;
    const box = R.h(`<div class="rg-section section" id="features"><div class="container-header rg-head"><h2>Features</h2><div class="rg-head-right"><button class="btn-control-sm ft-simple">Simple mode</button><button class="btn-control-sm ft-all">Turn everything on</button></div></div>
      <div class="section-content rg-body"><p class="rg-note" style="margin-top:0">Turn off anything you don't use. Changes apply straight away. Simple mode keeps the main things and turns off the extras.</p>
        <div class="ft-grid">${Object.entries(groups).map(([g, l]) => `<div class="ft-col"><div class="rg-h3">${R.esc(g)}</div>${l.map(([k, a, d]) => sw(k, a, d)).join("")}</div>`).join("")}
          <div class="ft-col"><div class="rg-h3">Pages in the RoGen sidebar</div>${pages.map(([id, label]) => sw("view:" + id, label, "")).join("")}</div></div></div></div>`);
    // right after Theme, so colors and backgrounds stay at the top
    const theme = main.querySelector(".rg-section");
    (theme || main.querySelector(".rg-lead") || main.firstChild).insertAdjacentElement("afterend", box);
    box.querySelectorAll("[data-f]").forEach((c) => (c.onchange = () => R.setFeat(c.dataset.f, c.checked)));
    const setAll = async (map) => { await R.set({ rgFeatures: map }); box.querySelectorAll("[data-f]").forEach((c) => (c.checked = c.dataset.f in map ? map[c.dataset.f] !== false : R.FEATURE_DEFAULTS[c.dataset.f] !== false)); R.toast("Saved"); };
    box.querySelector(".ft-simple").onclick = () => setAll(Object.fromEntries(SIMPLE_OFF.map((k) => [k, false])));
    box.querySelector(".ft-all").onclick = () => setAll(Object.fromEntries([...R.FEATURES.map((f) => f[1]), ...pages.map(([id]) => "view:" + id)].map((k) => [k, true])));
  }

  const SETTINGS_EXTRA = async (main) => {
    const u = await R.ui();
    const p = { badges: true, invValue: true, invPct: 5, friendNames: true, ...(await R.get1("rgAlertPrefs", {})) };
    const HIDE = [["sponsored", "Sponsored games and ads"], ["chat", "Chat bar"], ["friendsRow", "Friends row on Home"], ["premium", "Premium upsell buttons"], ["robuxNav", "Robux button in the top bar"], ["footer", "Page footer"]];
    const sec = R.h(`<div><div class="rg-section section"><div class="container-header rg-head"><h2>Interface</h2></div><div class="section-content rg-body">
        <label class="rg-check"><input type="checkbox" class="ui-oled" ${u.oled ? "checked" : ""}> Darker dark mode (true black, easier on OLED screens)</label>
        <div class="rg-h3">Hide parts of Roblox</div>
        <div class="ui-hide">${HIDE.map(([k, l]) => `<label class="rg-check"><input type="checkbox" data-h="${k}" ${u.hide[k] ? "checked" : ""}> ${l}</label>`).join("")}</div>
        <div class="rg-h3">Your profile banner</div><p class="rg-note" style="margin:0 0 8px">A color band behind your profile header. Only you see it.</p>
        <div class="rg-row ui-ban">${Object.entries(R.BANNERS).map(([k, g]) => `<button class="ui-b ${u.banner === k ? "on" : ""}" data-b="${k}" title="${k || "None"}" style="background:${g || "transparent"}">${k ? "" : "None"}</button>`).join("")}</div>
        <div class="rg-h3">Dashboard</div><a class="btn-control-sm" href="#dashboard">Open the dashboard and press "Customize dashboard"</a>
      </div></div>
      <div class="rg-section section"><div class="container-header rg-head"><h2>Tracker alerts</h2></div><div class="section-content rg-body">
        <label class="rg-check"><input type="checkbox" data-p="badges" ${p.badges ? "checked" : ""}> Tell me when I earn a new badge</label>
        <label class="rg-check" style="margin-top:8px"><input type="checkbox" data-p="invValue" ${p.invValue ? "checked" : ""}> Tell me when my inventory value moves by <input class="rg-input ap-pct" type="number" min="1" max="90" value="${p.invPct}" style="width:70px;height:32px;margin:0 6px">%</label>
        <label class="rg-check" style="margin-top:8px"><input type="checkbox" data-p="friendNames" ${p.friendNames ? "checked" : ""}> Tell me when a friend changes their username or display name</label>
        <p class="rg-note">Profiles, communities, games and items you track are in <a class="rg-link" href="#tracker">Tracker</a>.</p>
      </div></div></div>`);
    main.appendChild(sec);
    featuresSection(main);
    const save = (patch) => R.ui().then((cur) => R.set({ rgUi: { ...cur, ...patch } }));
    sec.querySelector(".ui-oled").onchange = (e) => save({ oled: e.target.checked });
    sec.querySelectorAll("[data-h]").forEach((c) => (c.onchange = async () => { const cur = await R.ui(); await R.set({ rgUi: { ...cur, hide: { ...cur.hide, [c.dataset.h]: c.checked } } }); }));
    sec.querySelectorAll("[data-b]").forEach((b) => (b.onclick = () => { save({ banner: b.dataset.b }); sec.querySelectorAll("[data-b]").forEach((x) => x.classList.toggle("on", x === b)); }));
    const saveP = async () => { const cur = { ...p }; sec.querySelectorAll("[data-p]").forEach((c) => (cur[c.dataset.p] = c.checked)); cur.invPct = Math.max(1, Math.min(90, Number(sec.querySelector(".ap-pct").value) || 5)); await R.set({ rgAlertPrefs: cur }); };
    sec.querySelectorAll("[data-p], .ap-pct").forEach((c) => (c.onchange = saveP));
  };

  const TOOLS_EXTRA = async (main) => {
    const sec = R.h(`<div class="rg-section section"><div class="container-header rg-head"><h2>Trade calculator</h2></div><div class="section-content rg-body">
      <p class="rg-note" style="margin-top:0">Paste item IDs or catalog links, one per line. RoGen adds up their RAP and the cheapest copy for sale.</p>
      <div class="rg-2col"><label class="rg-field">You give<textarea class="rg-textarea tc-give" placeholder="1029025&#10;https://www.roblox.com/catalog/20573078"></textarea></label><label class="rg-field">You get<textarea class="rg-textarea tc-get"></textarea></label></div>
      <div class="rg-row" style="margin-top:10px"><label class="rg-field">Robux you add<input class="rg-input tc-rg" type="number" min="0" value="0" style="width:120px"></label><label class="rg-field">Robux they add<input class="rg-input tc-rt" type="number" min="0" value="0" style="width:120px"></label><button class="btn-primary-md tc-go" style="align-self:flex-end">Work it out</button></div>
      <div class="tc-out" style="margin-top:14px"></div></div></div>`);
    main.appendChild(sec);
    const ids = (t) => [...new Set((t.match(/\d{3,}/g) || []).map(Number))];
    sec.querySelector(".tc-go").onclick = async () => {
      const give = ids(sec.querySelector(".tc-give").value), getL = ids(sec.querySelector(".tc-get").value);
      const out = sec.querySelector(".tc-out");
      if (!give.length && !getL.length) { out.innerHTML = `<div class="rg-empty">Add some items first.</div>`; return; }
      out.innerHTML = `<div class="rg-loading">Pricing…</div>`;
      const all = [...give, ...getL], info = {};
      await R.pool(all, 4, async (id) => {
        try { const [r, d] = await Promise.all([R.api(`https://economy.roblox.com/v1/assets/${id}/resale-data`).catch(() => ({})), R.api(`https://economy.roblox.com/v2/assets/${id}/details`)]); info[id] = { name: d.Name, rap: r.recentAveragePrice || 0, lowest: d.CollectiblesItemDetails?.CollectibleLowestResalePrice || null }; } catch (e) { info[id] = { name: "Unknown item " + id, rap: 0 }; }
      });
      const sum = (l, k) => l.reduce((t, id) => t + (info[id]?.[k] || 0), 0);
      const addG = Number(sec.querySelector(".tc-rg").value) || 0, addT = Number(sec.querySelector(".tc-rt").value) || 0;
      const g = sum(give, "rap") + addG, r = sum(getL, "rap") + addT;
      const diff = r - g, pct = g ? Math.round((diff / g) * 100) : 0;
      const verdict = Math.abs(pct) < 5 ? "About even" : diff > 0 ? `You win by ${pct}%` : `You lose by ${Math.abs(pct)}%`;
      const list = (l) => l.map((id) => `<tr><td><img class="rg-thumb" data-thumb="asset:${id}"> <a href="${RB}/catalog/${id}">${R.esc(info[id].name)}</a></td><td class="rg-num">${R.robux(info[id].rap)}</td></tr>`).join("");
      out.innerHTML = `<div class="rg-stats">${R.stat("You give (RAP)", R.robux(g))}${R.stat("You get (RAP)", R.robux(r))}${R.stat("Difference", `<span class="${diff >= 0 ? "rg-good" : "rg-bad"}">${diff >= 0 ? "+" : "−"}${R.robux(Math.abs(diff))}</span>`, verdict)}</div>
        <div class="rg-2col" style="margin-top:12px"><table class="rg-table"><thead><tr><th>You give</th><th class="rg-num">RAP</th></tr></thead><tbody>${list(give)}${addG ? `<tr><td>Robux</td><td class="rg-num">${R.robux(addG)}</td></tr>` : ""}</tbody></table>
        <table class="rg-table"><thead><tr><th>You get</th><th class="rg-num">RAP</th></tr></thead><tbody>${list(getL)}${addT ? `<tr><td>Robux</td><td class="rg-num">${R.robux(addT)}</td></tr>` : ""}</tbody></table></div>
        <p class="rg-note">RAP is Roblox's recent average sale price. Rare items can trade well above it, so treat this as a guide.</p>`;
      R.fillThumbs(out);
    };
  };

  R.afterView = (v, main) => {
    if (v === "dashboard") return DASH_EXTRA(main);
    if (v === "search") return SEARCH_EXTRA(main);
    if (v === "settings") return SETTINGS_EXTRA(main);
    if (v === "tools") return TOOLS_EXTRA(main);
  };
})();
