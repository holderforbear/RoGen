// The RoGen page at roblox.com/rogen#<view>
(() => {
  const R = window.Rogen;
  // ["#", "Label"] = a group label in the sidebar, ["-"] = a divider
  const VIEWS = [
    ["dashboard", "Dashboard"],
    ["#", "Explore"],
    ["discover", "Discover"],
    ["search", "Search"],
    ["lookup", "Lookup"],
    ["#", "You"],
    ["spending", "Spending"],
    ["playtime", "Playtime"],
    ["friends", "Friends & Unadds"],
    ["library", "Library"],
    ["#", "Track"],
    ["items", "Items & Deals"],
    ["alerts", "Alerts"],
    ["tools", "Tools"],
    ["#owner", "Owner"],
    ["badges", "Badges"],
    ["-"],
    ["settings", "Settings"]
  ];

  /* =================== shared helpers =================== */
  // Online / in-game info for a list of users (only works for your friends, like on Roblox)
  R.presence = async (ids) => {
    const out = {};
    for (const c of R.chunks(ids, 50)) {
      try {
        const d = await R.api("https://presence.roblox.com/v1/presence/users", { method: "POST", body: { userIds: c } });
        (d.userPresences || []).forEach((p) => (out[p.userId] = p));
      } catch (e) { /* presence is optional */ }
    }
    return out;
  };
  const presenceText = (p) => !p ? "Offline" : p.userPresenceType === 2 ? (p.lastLocation ? `Playing ${p.lastLocation}` : "In a game") : p.userPresenceType === 3 ? "In Studio" : p.userPresenceType === 1 ? "Online" : "Offline";
  const presenceKind = (p) => (!p ? "off" : ["off", "on", "game", "studio"][p.userPresenceType] || "off");

  // Small confirm popup in RoGen's style (instead of the browser's grey box)
  R.confirm = (title, msg, ok = "Confirm", danger = false) => new Promise((res) => {
    const w = R.h(`<div class="rg-modal-wrap"><div class="rg-modal" style="width:400px"><div class="rg-modal-head"><h3>${R.esc(title)}</h3></div>
      <p style="margin:4px 0 18px;line-height:1.5">${msg}</p>
      <div class="rg-modal-foot"><span style="flex:1"></span><button class="btn-control-md c-no">Cancel</button><button class="${danger ? "btn-alert-md" : "btn-primary-md"} c-yes">${R.esc(ok)}</button></div></div></div>`);
    document.body.appendChild(w);
    const done = (v) => { w.remove(); res(v); };
    w.querySelector(".c-no").onclick = () => done(false);
    w.querySelector(".c-yes").onclick = () => done(true);
    w.onclick = (e) => { if (e.target === w) done(false); };
  });

  R.unfriend = async (id) => {
    await R.api(`https://friends.roblox.com/v1/users/${id}/unfriend`, { method: "POST", body: {} });
    const { iUnfriended = [], friendSnap } = await R.get(["iUnfriended", "friendSnap"]);
    const patch = { iUnfriended: [...new Set([...iUnfriended, id])] };
    if (friendSnap) patch.friendSnap = { ...friendSnap, ids: friendSnap.ids.filter((x) => x !== id) };
    await R.set(patch);
  };

  /* =================== DASHBOARD =================== */
  async function dashboard(main) {
    const me = R.me();
    if (!me) { main.innerHTML = `<div class="rg-empty" style="padding:80px 0">Log in to Roblox to see your dashboard.</div>`; return; }
    const st = await R.get1("status", null);
    main.innerHTML = `
      <section class="rg-hero">
        <div class="rg-hero-avw"><a class="rg-hero-av" href="https://www.roblox.com/users/${me.id}/profile"><img data-thumb="user:${me.id}" alt=""></a>
          <div class="rg-hero-status">${R.statusBubble(st, { editable: true })}</div></div>
        <div class="rg-hero-info">
          <div class="rg-hero-name">${R.esc(me.displayName)} <span>@${R.esc(me.name)}</span></div>
          <div class="rg-hero-badges"></div>
          <div class="rg-hero-meta h-meta">&nbsp;</div>
        </div>
        <div class="rg-hero-side">
          <div class="rg-hero-robux rg-my-robux h-robux">&nbsp;</div>
          <div class="rg-mute h-usd" style="font-size:13px"></div>
          <div class="rg-row" style="margin-top:12px;justify-content:flex-end"><a class="btn-control-sm" href="#settings">Customize</a><a class="btn-secondary-sm" href="https://www.roblox.com/users/${me.id}/profile">View profile</a></div>
        </div>
      </section>
      <div class="rg-kpis d-kpis">${["Friends", "Followers", "Following", "Groups", "Limiteds RAP"].map((l) => `<div class="rg-kpi"><div class="rg-kpi-v">—</div><div class="rg-kpi-l">${l}</div></div>`).join("")}</div>
      <div class="rg-dash">
        <div class="rg-card rg-span2"><div class="rg-card-h"><h3>Friends online</h3><a href="#friends">Manage friends</a></div><div class="d-online"><div class="rg-loading">Checking who's on…</div></div></div>
        <div class="rg-card"><div class="rg-card-h"><h3>Unadded you</h3><a href="#friends?tab=unadds">See all</a></div><div class="d-unadd"></div></div>
        <div class="rg-card"><div class="rg-card-h"><h3>Spending</h3><a href="#spending">Details</a></div><div class="d-spend"><div class="rg-loading"></div></div></div>
        <div class="rg-card rg-span2"><div class="rg-card-h"><h3>Jump back in</h3><a href="#library">Library</a></div><div class="d-recent"></div></div>
        <div class="rg-card"><div class="rg-card-h"><h3>Most played</h3><a href="#playtime">All</a></div><div class="d-play"></div></div>
        <div class="rg-card"><div class="rg-card-h"><h3>Your badges</h3>${R.badges.isOwner() ? `<a href="#badges">Manage</a>` : ""}</div><div class="d-badges"></div></div>
      </div>`;
    R.fillThumbs(main.querySelector(".rg-hero"));
    // Badges: Roblox's verified mark first, then every RoGen badge lined up in rank order
    let verified = false;
    const drawBadges = () => {
      const ids = R.badges.sync(me.id);
      main.querySelector(".rg-hero-badges").innerHTML = R.badges.row(ids, { verified, size: 26 });
      main.querySelector(".d-badges").innerHTML = ids.length || verified ? R.badges.tiles(ids, { verified }) : `<div class="rg-empty">No badges yet.</div>`;
    };
    R.badges.ready().then(drawBadges);
    // Re-render the status pill when it changes
    const onSt = (ch) => { if (ch.status && document.contains(main)) main.querySelector(".rg-hero-status").innerHTML = R.statusBubble(ch.status.newValue, { editable: true }); };
    chrome.storage.onChanged.addListener(onSt);

    // Account numbers + how they changed this week
    Promise.all([R.userSummary(me.id), R.api(`https://economy.roblox.com/v1/users/${me.id}/currency`).catch(() => null), R.inventoryValue(me.id).catch(() => null)]).then(async ([s, cur, inv]) => {
      await R.snap(`user:${me.id}`, { friends: s.friends, followers: s.followers, following: s.following });
      if (inv) await R.snap(`rap:${me.id}`, { rap: inv.rap }, { every: 12 * 3600e3 });
      const h = await R.hist(`user:${me.id}`);
      const rh = await R.hist(`rap:${me.id}`);
      const weekAgo = (list) => list.find((x) => Date.now() - x.t < 8 * 864e5) || list[0];
      const delta = (now, then) => {
        if (then == null || now == null || now === then) return "";
        const d = now - then;
        return `<span class="rg-delta ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : "−"}${R.short(Math.abs(d))}</span>`;
      };
      const w = weekAgo(h) || {}, wr = weekAgo(rh) || {};
      const kpis = [
        [R.fmt(s.friends), "Friends", delta(s.friends, w.friends)],
        [R.short(s.followers), "Followers", delta(s.followers, w.followers)],
        [R.short(s.following), "Following", delta(s.following, w.following)],
        [R.fmt(s.groups), "Groups", ""],
        [inv ? R.robux(inv.rap, { short: true }) : `<span class="rg-mute" style="font-size:15px">Private</span>`, "Limiteds RAP", inv ? delta(inv.rap, wr.rap) : ""]
      ];
      main.querySelector(".d-kpis").innerHTML = kpis.map(([v, l, d]) => `<div class="rg-kpi"><div class="rg-kpi-v">${v}</div><div class="rg-kpi-l">${l} ${d}</div></div>`).join("");
      const yrs = s.ageDays / 365;
      if (s.user && s.user.hasVerifiedBadge && !verified) { verified = true; R.badges.ready().then(drawBadges); }
      main.querySelector(".h-meta").innerHTML = `Joined ${R.date(s.user.created)} · ${yrs >= 1 ? yrs.toFixed(1).replace(/\.0$/, "") + " years" : s.ageDays + " days"} on Roblox · ${R.copy(me.id, "ID")}`;
      if (cur) {
        main.querySelector(".h-robux").innerHTML = R.robux(cur.robux);
        main.querySelector(".h-usd").textContent = `≈ $${(cur.robux * (await rates()).devex).toFixed(2)} DevEx value`;
      } else main.querySelector(".h-robux").innerHTML = "";
    }).catch((e) => (main.querySelector(".d-kpis").innerHTML = R.errBox(e)));

    // Friends online
    (async () => {
      const el = main.querySelector(".d-online");
      const ids = await R.friendIds(me.id).catch(() => R.myFriendIds());
      const pres = await R.presence(ids);
      const on = ids.filter((id) => pres[id] && pres[id].userPresenceType > 0).sort((a, b) => (pres[b].userPresenceType === 2) - (pres[a].userPresenceType === 2));
      if (!on.length) { el.innerHTML = `<div class="rg-empty">None of your ${ids.length} friends are online right now.</div>`; return; }
      const users = await R.users(on.slice(0, 30));
      el.innerHTML = `<div class="rg-people">${on.slice(0, 30).map((id) => `<a class="rg-person" href="https://www.roblox.com/users/${id}/profile" title="${R.esc(presenceText(pres[id]))}">
        <span class="rg-av"><img data-thumb="user:${id}" alt=""><i class="rg-pres ${presenceKind(pres[id])}"></i></span>
        <div class="p-name">${R.esc(users[id]?.displayName || id)}</div><div class="p-sub">${R.esc(presenceText(pres[id]))}</div></a>`).join("")}</div>`;
      R.fillThumbs(el);
    })();

    // Unadds
    R.widgets.unadds(main.querySelector(".d-unadd"), me, 5);

    // Spending: this month + last 6 months bars (from synced purchases)
    R.widgets.spendingCard(main.querySelector(".d-spend"), me);

    // Jump back in + Most played
    R.widgets.recent(main.querySelector(".d-recent"));
    R.widgets.played(main.querySelector(".d-play"));
  }

  /* =================== FRIENDS =================== */
  async function friends(main, q, params) {
    const me = R.me();
    if (!me) { main.innerHTML = `<div class="rg-empty" style="padding:80px 0">Log in to Roblox first.</div>`; return; }
    const tab = params?.get("tab") || "all";
    main.innerHTML = `<div class="rg-pagehead"><h1>Friends</h1><p class="rg-lead">See who's online, unfriend in one click, and track who unadds you.</p></div>
      <div class="rg-seg">${[["all", "All friends"], ["unadds", "Unadded you"], ["growth", "Graphs"]].map(([k, l]) => `<button class="${k === tab ? "on" : ""}" data-t="${k}">${l}</button>`).join("")}</div>
      <div class="f-body"></div>`;
    main.querySelectorAll(".rg-seg button").forEach((b) => (b.onclick = () => { history.replaceState(null, "", `#friends?tab=${b.dataset.t}`); friends(main, q, new URLSearchParams(`tab=${b.dataset.t}`)); }));
    const body = main.querySelector(".f-body");
    if (tab === "unadds") return unaddsTab(body, me);
    if (tab === "growth") return growthTab(body, me);

    body.innerHTML = `<div class="rg-loading">Loading your friends…</div>`;
    const ids = await R.friendIds(me.id);
    const [users, pres] = await Promise.all([R.users(ids), R.presence(ids)]);
    let list = ids.map((id) => ({ id, name: users[id]?.name || String(id), displayName: users[id]?.displayName || users[id]?.name || String(id), p: pres[id] }));
    const selected = new Set();
    body.innerHTML = `<div class="rg-toolbar rg-friendbar">
        <input class="rg-input f-q" placeholder="Search ${list.length} friends…" style="flex:1;min-width:200px">
        <select class="rg-select f-show"><option value="">Everyone</option><option value="online">Online</option><option value="game">In a game</option><option value="off">Offline</option></select>
        <select class="rg-select f-sort"><option value="online">Online first</option><option value="az">Name A → Z</option><option value="za">Name Z → A</option></select>
      </div>
      <div class="rg-selbar" hidden><b class="s-count"></b><span style="flex:1"></span><button class="btn-control-sm s-none">Clear</button><button class="btn-alert-sm s-go">Unfriend selected</button></div>
      <div class="rg-flist"></div>`;
    const $ = (s) => body.querySelector(s);
    const rank = (f) => (f.p ? [0, 2, 3, 1][f.p.userPresenceType] ?? 0 : 0);
    const draw = () => {
      const qq = $(".f-q").value.trim().toLowerCase(), show = $(".f-show").value, sort = $(".f-sort").value;
      let l = list.filter((f) => (!qq || f.name.toLowerCase().includes(qq) || f.displayName.toLowerCase().includes(qq)) && (!show || presenceKind(f.p) === show || (show === "online" && presenceKind(f.p) !== "off")));
      l.sort(sort === "az" ? (a, b) => a.displayName.localeCompare(b.displayName) : sort === "za" ? (a, b) => b.displayName.localeCompare(a.displayName) : (a, b) => rank(b) - rank(a) || a.displayName.localeCompare(b.displayName));
      $(".rg-flist").innerHTML = l.length ? l.map((f) => `<div class="rg-frow ${selected.has(f.id) ? "sel" : ""}" data-id="${f.id}">
          <label class="rg-fcheck"><input type="checkbox" ${selected.has(f.id) ? "checked" : ""}></label>
          <a class="rg-av" href="https://www.roblox.com/users/${f.id}/profile"><img data-thumb="user:${f.id}" alt=""><i class="rg-pres ${presenceKind(f.p)}"></i></a>
          <a class="rg-fname" href="https://www.roblox.com/users/${f.id}/profile"><b>${R.esc(f.displayName)}</b><small>@${R.esc(f.name)}</small></a>
          <span class="rg-fpres ${presenceKind(f.p)}">${R.esc(presenceText(f.p))}</span>
          <button class="btn-control-sm f-un">Unfriend</button></div>`).join("") : `<div class="rg-empty">No friends match.</div>`;
      R.fillThumbs($(".rg-flist"));
      $(".rg-selbar").hidden = !selected.size;
      $(".s-count").textContent = `${selected.size} selected`;
    };
    const unfriendMany = async (arr) => {
      const names = arr.map((id) => list.find((f) => f.id === id)?.displayName).filter(Boolean);
      const ok = await R.confirm(arr.length === 1 ? `Unfriend ${names[0]}?` : `Unfriend ${arr.length} people?`,
        arr.length === 1 ? "They won't be told, and they won't show up in your Unadded list." : R.esc(names.slice(0, 8).join(", ")) + (names.length > 8 ? ` and ${names.length - 8} more` : ""), "Unfriend", true);
      if (!ok) return;
      let done = 0;
      for (const id of arr) {
        try { await R.unfriend(id); done++; list = list.filter((f) => f.id !== id); selected.delete(id); } catch (e) { R.toast(`Couldn't unfriend: ${e.message}`); break; }
        await R.sleep(300);
      }
      if (done) R.toast(done === 1 ? `Unfriended ${names[0]}` : `Unfriended ${done} people`);
      $(".f-q").placeholder = `Search ${list.length} friends…`;
      draw();
    };
    $(".rg-flist").addEventListener("click", (e) => {
      const row = e.target.closest(".rg-frow"); if (!row) return;
      const id = Number(row.dataset.id);
      if (e.target.closest(".f-un")) return unfriendMany([id]);
      if (e.target.closest(".rg-fcheck")) { const c = row.querySelector("input"); setTimeout(() => { c.checked ? selected.add(id) : selected.delete(id); row.classList.toggle("sel", c.checked); $(".rg-selbar").hidden = !selected.size; $(".s-count").textContent = `${selected.size} selected`; }); }
    });
    $(".s-none").onclick = () => { selected.clear(); draw(); };
    $(".s-go").onclick = () => unfriendMany([...selected]);
    $(".f-q").oninput = draw; $(".f-show").onchange = draw; $(".f-sort").onchange = draw;
    draw();
  }

  async function unaddsTab(body, me) {
    const { unadded = [], friendSnap } = await R.get(["unadded", "friendSnap"]);
    const list = unadded.filter((u) => u.id !== me.id);
    body.innerHTML = `<div class="rg-row space" style="margin-bottom:12px"><span class="rg-mute">${friendSnap ? `Watching ${friendSnap.ids.length} friends since ${R.date(friendSnap.since)}` : "Taking the first snapshot…"}</span>
        <span class="rg-row"><button class="btn-control-sm u-check">Check now</button><button class="btn-control-sm u-csv">Export CSV</button><button class="btn-control-sm u-clear">Clear list</button></span></div>
      ${list.length ? `<div class="rg-flist">${list.map((u) => `<div class="rg-frow">
          <a class="rg-av" href="https://www.roblox.com/users/${u.id}/profile"><img data-thumb="user:${u.id}" alt=""></a>
          <a class="rg-fname" href="https://www.roblox.com/users/${u.id}/profile"><b>${R.esc(u.displayName)}</b><small>@${R.esc(u.name)}</small></a>
          <span class="rg-fpres">${u.byMe ? `<span class="rg-badge">You removed them</span>` : `Unadded you`}</span>
          <span class="rg-mute" style="font-size:13px;white-space:nowrap">${R.dateTime(u.at)}</span></div>`).join("")}</div>`
        : `<div class="rg-empty">Nobody has unadded you yet.</div>`}`;
    R.fillThumbs(body);
    body.querySelector(".u-check").onclick = async () => { const r = await R.checkFriends({ force: true }); R.toast(r.ok ? (r.removed ? `${r.removed} new unadd(s)` : "No changes") : r.reason || "Failed"); unaddsTab(body, me); };
    body.querySelector(".u-clear").onclick = async () => { if (await R.confirm("Clear the list?", "This only clears RoGen's list. Nobody is affected.", "Clear")) { await R.set({ unadded: [] }); R.send({ type: "markUnaddedSeen" }); unaddsTab(body, me); } };
    body.querySelector(".u-csv").onclick = () => R.csv([["User ID", "Username", "Display name", "When", "You removed them"], ...list.map((u) => [u.id, u.name, u.displayName, new Date(u.at).toISOString(), u.byMe ? "yes" : ""])], "rogen-unadds.csv");
  }

  async function growthTab(body, me) {
    body.innerHTML = `<div class="rg-loading">Loading…</div>`;
    const s = await R.userSummary(me.id);
    await R.snap(`user:${me.id}`, { friends: s.friends, followers: s.followers, following: s.following });
    const h = await R.hist(`user:${me.id}`);
    body.innerHTML = `<div class="rg-kpis">${[["Friends", s.friends], ["Followers", s.followers], ["Following", s.following]].map(([l, v]) => `<div class="rg-kpi"><div class="rg-kpi-v">${R.fmt(v)}</div><div class="rg-kpi-l">${l}</div></div>`).join("")}</div>
      ${R.chart(h.map((x) => ({ t: x.t, v: x.friends })), { label: "Friends" })}${R.chart(h.map((x) => ({ t: x.t, v: x.followers })), { label: "Followers" })}`;
  }

  const recentRow = (r) => {
    const t = { game: "game", user: "user", group: "group", item: "asset" }[r.kind];
    return `<tr><td><img class="rg-thumb ${r.kind === "user" ? "round" : ""}" data-thumb="${t}:${r.id}"> <a href="${R.esc(r.url)}">${R.esc(r.name)}</a></td><td class="rg-mute" style="text-transform:capitalize">${r.kind}</td><td class="rg-num rg-mute">${R.ago(r.at)}</td></tr>`;
  };

  /* =================== DISCOVER =================== */
  const UPDATE_TAG = /(\[[^\]]+\]|\([^)]*(upd|update|new|event)[^)]*\)|\bUPD(ATE)?\b|\bNEW\b|\bEVENT\b|\bRELEASE\b)/i;
  const STOP = new Set("the and for you your with from game games roblox new are not but all can get have has this that its".split(" "));
  const SESSION = crypto.randomUUID();
  const EXPLORE = "https://apis.roblox.com/explore-api/v1";
  const sortsCache = {};
  const DEVICES = [["computer", "Computer"], ["all", "All devices"], ["high_end_phone", "Phone"], ["high_end_tablet", "Tablet"], ["console", "Console"], ["vr", "VR"]];
  const COUNTRIES = [["all", "All locations"], ["us", "United States"], ["gb", "United Kingdom"], ["ca", "Canada"], ["au", "Australia"], ["de", "Germany"], ["fr", "France"], ["br", "Brazil"], ["mx", "Mexico"], ["ph", "Philippines"], ["id", "Indonesia"], ["jp", "Japan"], ["kr", "South Korea"], ["in", "India"]];

  async function loadSorts(device, country) {
    const key = device + "|" + country;
    if (sortsCache[key]) return sortsCache[key];
    let token = "";
    const out = [];
    for (let i = 0; i < 12; i++) {
      const d = await R.api(`${EXPLORE}/get-sorts?sessionId=${SESSION}&device=${device}&country=${country}${token ? `&sortsPageToken=${encodeURIComponent(token)}` : ""}`);
      for (const s of d.sorts || []) {
        if (s.contentType !== "Games" || !s.sortId || out.some((o) => o.sortId === s.sortId)) continue;
        out.push({ sortId: s.sortId, name: s.sortDisplayName || s.sortId, games: s.games || [], next: s.nextPageToken || "" });
      }
      token = d.nextSortsPageToken || "";
      if (!token) break;
    }
    return (sortsCache[key] = out);
  }

  async function discover(main, q) {
    const prefs = await R.get1("discoverPrefs", { device: "computer", country: "all" });
    let games = [], src = null, loading = false, sorts = [];
    const details = new Map();
    main.innerHTML = `<div class="rg-pagehead"><h1>Discover</h1><p class="rg-lead">Every Roblox category in one place, with filters Roblox doesn't have.</p></div>
      <form class="rg-searchbar"><input class="rg-input" placeholder="Search all Roblox games…" value="${R.esc(q || "")}"><button class="btn-primary-md">Search</button></form>
      <div class="rg-row" style="margin-bottom:12px">
        <select class="rg-select f-device">${DEVICES.map(([v, l]) => `<option value="${v}" ${prefs.device === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        <select class="rg-select f-country">${COUNTRIES.map(([v, l]) => `<option value="${v}" ${prefs.country === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        <span class="rg-mute c-count" style="font-size:13px"></span>
      </div>
      <div class="rg-chips rg-cats c-cats" style="margin-bottom:16px"><span class="rg-mute">Loading categories…</span></div>
      <div class="section-content rg-filterbar">
        <label class="rg-field">Name has<input class="rg-input f-inc" placeholder="tycoon, obby"></label>
        <label class="rg-field">Name doesn't have<input class="rg-input f-exc" placeholder="simulator"></label>
        <label class="rg-field">Genre<select class="rg-select f-genre"><option value="">Any genre</option></select></label>
        <label class="rg-field">Min players<input class="rg-input f-min" type="number" min="0" step="100" placeholder="0" style="width:110px"></label>
        <label class="rg-field">Sort by<select class="rg-select f-sort">
          <option value="default">Roblox order</option><option value="players">Most players</option><option value="rating">Best rating</option><option value="likes">Most likes</option>
          <option value="visits">Most visits</option><option value="newest">Newest</option><option value="updated">Recently updated</option>
          <option value="az">Name A → Z</option><option value="za">Name Z → A</option><option value="short">Shortest name</option><option value="match">Best name match</option></select></label>
        <label class="rg-check"><input type="checkbox" class="f-upd"> Has update tag</label>
        <div class="rg-chips f-words" style="flex-basis:100%"></div>
      </div>
      <div class="container-header rg-head" style="margin-top:20px"><h2 class="v-title"></h2><span class="rg-mute v-count" style="font-size:14px"></span></div>
      <ul class="hlist games game-cards game-tile-list rg-tiles v-grid"></ul>
      <div class="rg-row" style="justify-content:center;margin-top:20px"><button class="btn-control-md v-more" hidden>Load more</button><span class="rg-mute v-status"></span></div>`;
    const $ = (s) => main.querySelector(s);
    const status = (t) => ($(".v-status").textContent = t);

    const add = (list) => {
      const seen = new Set(games.map((g) => g.universeId));
      for (const raw of list || []) {
        const g = { ...R.normGame(raw), genre: raw.genreL1 || raw.genre || "" };
        if (g.universeId && g.placeId && !seen.has(g.universeId)) { seen.add(g.universeId); games.push(g); }
      }
    };
    const terms = (v) => v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    const rating = (g) => (g.up + g.down ? g.up / (g.up + g.down) : 0);
    const score = (g, inc) => inc.reduce((s, t) => { const i = g.name.toLowerCase().indexOf(t); return s + (i < 0 ? 0 : 10 + (i === 0 ? 5 : 0)); }, 0);

    function refresh() {
      const inc = terms($(".f-inc").value), exc = terms($(".f-exc").value), min = Number($(".f-min").value || 0), upd = $(".f-upd").checked, genre = $(".f-genre").value;
      // genre list from loaded games
      const gs = [...new Set(games.map((g) => g.genre).filter(Boolean))].sort();
      const gsel = $(".f-genre");
      if (gsel.options.length - 1 !== gs.length) gsel.innerHTML = `<option value="">Any genre</option>` + gs.map((x) => `<option ${x === genre ? "selected" : ""}>${R.esc(x)}</option>`).join("");
      let list = games.filter((g) => {
        const n = g.name.toLowerCase();
        return (!inc.length || inc.some((t) => n.includes(t))) && !exc.some((t) => n.includes(t)) && g.players >= min && (!upd || UPDATE_TAG.test(g.name)) && (!genre || g.genre === genre);
      });
      const d = (g) => details.get(g.universeId) || {};
      const f = {
        players: (a, b) => b.players - a.players, rating: (a, b) => rating(b) - rating(a), likes: (a, b) => b.up - a.up,
        visits: (a, b) => (d(b).visits || 0) - (d(a).visits || 0), newest: (a, b) => new Date(d(b).created || 0) - new Date(d(a).created || 0),
        updated: (a, b) => new Date(d(b).updated || 0) - new Date(d(a).updated || 0), az: (a, b) => a.name.localeCompare(b.name),
        za: (a, b) => b.name.localeCompare(a.name), short: (a, b) => a.name.length - b.name.length, match: (a, b) => score(b, inc) - score(a, inc) || b.players - a.players
      }[$(".f-sort").value];
      if (f) list = [...list].sort(f);
      const by = $(".f-sort").value;
      $(".v-count").textContent = games.length ? `${R.fmt(list.length)} of ${R.fmt(games.length)} games` : "";
      $(".v-grid").innerHTML = list.length
        ? list.slice(0, 600).map((g) => R.gameTile({ ...g, extra: by === "visits" && d(g).visits != null ? `${R.short(d(g).visits)} visits` : by === "updated" && d(g).updated ? `Updated ${R.ago(d(g).updated)}` : by === "newest" && d(g).created ? `Made ${R.date(d(g).created)}` : "" }, inc)).join("")
        : `<li class="rg-empty" style="grid-column:1/-1;list-style:none">${games.length ? "No games match those filters." : loading ? "Loading…" : "Nothing here."}</li>`;
      $(".v-more").hidden = !(src && src.kind === "search" && src.token);
      const counts = new Map();
      games.forEach((g) => new Set((g.name.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w))).forEach((w) => counts.set(w, (counts.get(w) || 0) + 1)));
      const top = [...counts].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 16);
      $(".f-words").innerHTML = top.length ? `<span class="rg-mute" style="font-size:12px;align-self:center;margin-right:2px">Common words:</span>` + top.map(([w, c]) => `<button type="button" class="rg-chip ${inc.includes(w) ? "on" : ""}" data-w="${R.esc(w)}">${R.esc(w)} <span class="rg-mute">${c}</span></button>`).join("") : "";
      R.fillThumbs($(".v-grid"));
      if (["visits", "newest", "updated"].includes(by)) enrich();
    }
    let enriching = false;
    async function enrich() {
      if (enriching) return;
      const need = games.map((g) => g.universeId).filter((id) => !details.has(id));
      if (!need.length) return;
      enriching = true;
      status("Getting visits and dates…");
      try {
        for (const c of R.chunks(need, 50)) {
          const d = await R.games(c);
          d.forEach((x) => details.set(x.id, { visits: x.visits, created: x.created, updated: x.updated }));
          c.forEach((id) => details.has(id) || details.set(id, {}));
        }
      } catch (e) { /* optional */ }
      enriching = false;
      status("");
      refresh();
    }

    async function more() {
      if (loading || !src || src.kind !== "search") return;
      loading = true;
      status("Searching…");
      try {
        const d = await R.api(`https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(src.q)}&sessionId=${SESSION}&pageType=all${src.token ? `&pageToken=${encodeURIComponent(src.token)}` : ""}`);
        (d.searchResults || []).forEach((g) => g.contentGroupType === "Game" && add(g.contents));
        src.token = d.nextPageToken || "";
        status("");
      } catch (e) { status("Couldn't load: " + e.message); }
      loading = false;
      refresh();
    }
    const start = (title, s) => { src = s; games = []; $(".v-title").textContent = title; drawCats(); };
    const drawCats = () => {
      $(".c-cats").innerHTML = `<button type="button" class="rg-chip ${src?.kind === "all" ? "on" : ""}" data-all="1">Every category</button>` +
        sorts.map((s) => `<button type="button" class="rg-chip ${src?.kind === "sort" && src.sortId === s.sortId ? "on" : ""}" data-s="${R.esc(s.sortId)}">${R.esc(s.name)}</button>`).join("");
      $(".c-count").textContent = sorts.length ? `${sorts.length} categories` : "";
    };
    const openSort = (id) => { const s = sorts.find((x) => x.sortId === id); if (!s) return; start(s.name, { kind: "sort", sortId: id }); add(s.games); refresh(); };
    const openAll = () => { start("Every category", { kind: "all" }); sorts.forEach((s) => add(s.games)); if ($(".f-sort").value === "default") $(".f-sort").value = "players"; refresh(); };
    const openSearch = (q) => { start(`Results for “${q}”`, { kind: "search", q, token: "" }); more(); };
    const loadCats = async (keep) => {
      $(".c-cats").innerHTML = `<span class="rg-mute">Loading categories…</span>`;
      try {
        sorts = await loadSorts($(".f-device").value, $(".f-country").value);
        drawCats();
        if (keep && src?.kind === "all") openAll();
        else if (keep && src?.kind === "sort" && sorts.some((s) => s.sortId === src.sortId)) openSort(src.sortId);
        else if (!src || src.kind !== "search") sorts[0] && openSort(sorts[0].sortId);
      } catch (e) { $(".c-cats").innerHTML = `<span class="rg-err">Couldn't load categories (${R.esc(e.message)}). Search still works.</span>`; }
    };

    $(".c-cats").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; b.dataset.all ? openAll() : openSort(b.dataset.s); };
    $(".rg-searchbar").onsubmit = (e) => { e.preventDefault(); const v = $(".rg-searchbar input").value.trim(); if (v) openSearch(v); };
    $(".f-words").onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      let inc = terms($(".f-inc").value);
      inc = inc.includes(b.dataset.w) ? inc.filter((t) => t !== b.dataset.w) : [...inc, b.dataset.w];
      $(".f-inc").value = inc.join(", ");
      if (inc.length && $(".f-sort").value === "default") $(".f-sort").value = "match";
      refresh();
    };
    [".f-inc", ".f-exc", ".f-min"].forEach((s) => ($(s).oninput = refresh));
    [".f-sort", ".f-upd", ".f-genre"].forEach((s) => ($(s).onchange = refresh));
    [".f-device", ".f-country"].forEach((s) => ($(s).onchange = () => { R.set({ discoverPrefs: { device: $(".f-device").value, country: $(".f-country").value } }); loadCats(true); }));
    $(".v-more").onclick = more;
    if (q) openSearch(q);
    await loadCats(!!q);
  }

  /* =================== UNIVERSAL SEARCH =================== */
  async function search(main) {
    main.innerHTML = `<h1>Search everything</h1><p class="rg-lead">Games, players, groups and catalog items in one search.</p>
      <form class="rg-searchbar"><input class="rg-input" placeholder="Type anything…" autofocus><button class="btn-primary-md">Search</button></form>
      <div class="s-out rg-2col"></div>`;
    const out = main.querySelector(".s-out");
    main.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const q = main.querySelector("input").value.trim();
      if (!q) return;
      const box = (id, title) => `<div class="rg-section section"><div class="container-header rg-head"><h2>${title}</h2></div><div class="section-content rg-body ${id}"><div class="rg-loading">Searching…</div></div></div>`;
      out.innerHTML = box("r-games", "Games") + box("r-users", "Players") + box("r-groups", "Groups") + box("r-items", "Items");
      const fill = (cls, p, row) => p.then((list) => {
        const el = out.querySelector("." + cls);
        el.innerHTML = list.length ? `<table class="rg-table"><tbody>${list.map(row).join("")}</tbody></table>` : `<div class="rg-empty">Nothing found.</div>`;
        R.fillThumbs(el);
      }).catch((err) => (out.querySelector("." + cls).innerHTML = R.errBox(err)));
      // If it's a number, also try it as an ID
      fill("r-games", R.api(`https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(q)}&sessionId=${SESSION}&pageType=all`).then((d) => {
        const l = []; (d.searchResults || []).forEach((g) => (!g.contentGroupType || g.contentGroupType === "Game") && l.push(...(g.contents || []))); return l.slice(0, 10).map(R.normGame);
      }), (g) => `<tr><td><img class="rg-thumb" data-thumb="game:${g.universeId}"> <a href="https://www.roblox.com/games/${g.placeId}">${R.esc(g.name)}</a></td><td class="rg-num rg-mute">${R.short(g.players)} playing</td></tr>`);
      fill("r-users", R.api(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(q)}&limit=10`).then((d) => d.data || []),
        (u) => `<tr><td><img class="rg-thumb round" data-thumb="user:${u.id}"> <a href="https://www.roblox.com/users/${u.id}/profile">${R.esc(u.displayName)}</a> <span class="rg-mute">@${R.esc(u.name)}</span></td></tr>`);
      fill("r-groups", R.api(`https://groups.roblox.com/v1/groups/search?keyword=${encodeURIComponent(q)}&limit=10&prioritizeExactMatch=true`).then((d) => d.data || []),
        (g) => `<tr><td><img class="rg-thumb" data-thumb="group:${g.id}"> <a href="https://www.roblox.com/communities/${g.id}">${R.esc(g.name)}</a></td><td class="rg-num rg-mute">${R.short(g.memberCount)} members</td></tr>`);
      // The real (Roblox-made) item first; copies of famous items are left out
      fill("r-items", R.api(`https://catalog.roblox.com/v1/search/items/details?Keyword=${encodeURIComponent(q)}&Limit=30&Category=1`).then((d) => R.realFirst(q, d.data || [])).then((l) => l.slice(0, 10)),
        (i) => { const b = i.itemType === "Bundle"; return `<tr><td><img class="rg-thumb" data-thumb="${b ? "bundle" : "asset"}:${i.id}"> <a href="https://www.roblox.com/${b ? "bundles" : "catalog"}/${i.id}">${R.esc(i.name)}</a>${i.rgReal ? ` <span class="rg-badge">Official</span>` : ""}</td><td class="rg-num">${i.lowestPrice ?? i.price ? R.robux(i.lowestPrice ?? i.price) : `<span class="rg-mute">Offsale</span>`}</td></tr>`; });
    };
  }

  /* =================== SPENDING =================== */
  const spent = R.spent, txKey = R.txKey, gameOf = R.gameOf;
  const loadTransactions = (me, onProgress, stopRef) => R.syncPurchases(me, onProgress, stopRef);

  async function spending(main) {
    const me = R.me();
    if (!me) { main.innerHTML = `<h1>Spending</h1><div class="rg-empty">Log in first.</div>`; return; }
    main.innerHTML = `<h1>Spending</h1><p class="rg-lead">Every Robux purchase you've made, totaled by game and by month.</p>
      <div class="rg-row" style="margin-bottom:14px"><button class="btn-primary-md sp-sync">Sync purchases</button><button class="btn-control-md sp-stop" hidden>Stop</button>
        <span class="rg-mute sp-state"></span><span style="flex:1"></span><button class="btn-control-md sp-csv">Export CSV</button></div>
      <div class="sp-out"></div>`;
    const stopRef = { stop: false };
    const draw = async () => {
      const tx = await R.get1("tx", []);
      const synced = await R.get1("txSynced", 0);
      main.querySelector(".sp-state").textContent = synced ? `Last synced ${R.ago(synced)} · ${R.fmt(tx.length)} purchases` : "Not synced yet";
      const out = main.querySelector(".sp-out");
      if (!tx.length) { out.innerHTML = `<div class="rg-empty">Press <b>Sync purchases</b> to load your history. The first sync can take a minute if you've bought a lot.</div>`; return; }
      const total = tx.reduce((t, x) => t + spent(x), 0);
      const now = new Date();
      const thisMonth = tx.filter((x) => { const d = new Date(x.created); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((t, x) => t + spent(x), 0);
      const thisYear = tx.filter((x) => new Date(x.created).getFullYear() === now.getFullYear()).reduce((t, x) => t + spent(x), 0);
      const r = await rates();
      // by game
      const games = new Map();
      for (const x of tx) {
        const g = gameOf(x);
        const key = g ? g.uid : "shop:" + (x.details?.type || "Other");
        const e = games.get(key) || { key, g, label: g ? g.name : (x.details?.type === "Asset" ? "Avatar Shop" : (x.details?.type || "Other")), total: 0, passes: 0, products: 0, count: 0, last: x.created };
        e.total += spent(x); e.count++;
        if (x.details?.type === "GamePass") e.passes++;
        if (x.details?.type === "DeveloperProduct") e.products++;
        if (new Date(x.created) > new Date(e.last)) e.last = x.created;
        games.set(key, e);
      }
      const byGame = [...games.values()].sort((a, b) => b.total - a.total);
      // by month
      const months = new Map();
      for (const x of tx) { const d = new Date(x.created); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; months.set(k, (months.get(k) || 0) + spent(x)); }
      const monthList = [...months].sort((a, b) => a[0].localeCompare(b[0])).slice(-24);
      const maxM = Math.max(...monthList.map((m) => m[1]), 1);
      const types = [...new Set(tx.map((x) => x.details?.type).filter(Boolean))];
      out.innerHTML = `<div class="rg-stats">
          ${R.stat("Lifetime spent", R.robux(total), `≈ $${(total * r.buy).toFixed(2)} to buy`)}
          ${R.stat("This year", R.robux(thisYear))}
          ${R.stat("This month", R.robux(thisMonth))}
          ${R.stat("Purchases", R.fmt(tx.length), `avg ${R.robux(Math.round(total / tx.length))}`)}
          ${R.stat("Games bought in", R.fmt(byGame.filter((g) => g.g).length))}
          ${R.stat("Dev products", R.fmt(tx.filter((x) => x.details?.type === "DeveloperProduct").length))}
        </div>
                <div class="rg-chart"><div class="rg-chart-top"><span>Robux spent per month</span></div><div class="rg-bars">${monthList.map(([k, v]) => `<div title="${k}: R$${R.fmt(v)}"><i style="height:${Math.max(2, (v / maxM) * 100)}%"></i><span>${k.slice(2).replace("-", "/")}</span></div>`).join("")}</div></div>
        <div class="rg-h3">Robux spent per game</div>
        <div class="rg-table-wrap" style="max-height:400px"><table class="rg-table"><thead><tr><th>Game / place</th><th class="rg-num">Spent</th><th class="rg-num">Passes</th><th class="rg-num">Dev products</th><th class="rg-num">Last purchase</th></tr></thead><tbody>
          ${byGame.map((e) => `<tr><td>${e.g ? `<img class="rg-thumb" data-thumb="game:${e.g.uid}"> <a href="https://www.roblox.com/games/${e.g.placeId}">${R.esc(e.label)}</a>` : `<span style="font-weight:600">${R.esc(e.label)}</span>`}</td>
            <td class="rg-num">${R.robux(e.total)}</td><td class="rg-num">${e.passes || ""}</td><td class="rg-num">${e.products || ""}</td><td class="rg-num rg-mute">${R.date(e.last)}</td></tr>`).join("")}
        </tbody></table></div>
        <div class="rg-h3">Purchase history</div>
        <div class="rg-toolbar"><input class="rg-input h-q" placeholder="Search purchases, games, sellers…" style="flex:1;min-width:220px">
          <select class="rg-select h-type"><option value="">All types</option>${types.map((t) => `<option>${R.esc(t)}</option>`).join("")}</select></div>
        <div class="h-list"></div>`;
      const drawHist = () => {
        const q = main.querySelector(".h-q").value.trim().toLowerCase();
        const ty = main.querySelector(".h-type").value;
        const list = tx.filter((x) => (!ty || x.details?.type === ty) && (!q || [x.details?.name, x.details?.place?.name, x.agent?.name].join(" ").toLowerCase().includes(q)));
        main.querySelector(".h-list").innerHTML = `<div class="rg-mute" style="font-size:13px;margin-bottom:6px">${R.fmt(list.length)} purchases · ${R.robux(list.reduce((t, x) => t + spent(x), 0))}</div>
          <div class="rg-table-wrap"><table class="rg-table"><thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Game / seller</th><th class="rg-num">Robux</th></tr></thead><tbody>
          ${list.slice(0, 500).map((x) => `<tr><td class="rg-mute" style="white-space:nowrap">${R.date(x.created)}</td><td>${R.esc(x.details?.name || "—")}</td><td class="rg-mute">${R.esc(x.details?.type || "")}</td>
            <td>${x.details?.place ? `<a href="https://www.roblox.com/games/${x.details.place.placeId}">${R.esc(x.details.place.name)}</a>` : R.esc(x.agent?.name || "")}</td><td class="rg-num">${R.robux(spent(x))}</td></tr>`).join("")}
          </tbody></table></div>${list.length > 500 ? `<p class="rg-note">Showing 500 of ${R.fmt(list.length)}. Export CSV for all of them.</p>` : ""}`;
      };
      main.querySelector(".h-q").oninput = drawHist;
      main.querySelector(".h-type").onchange = drawHist;
      drawHist();
      R.fillThumbs(out);
    };
    main.querySelector(".sp-sync").onclick = async () => {
      const btn = main.querySelector(".sp-sync");
      btn.disabled = true; stopRef.stop = false; main.querySelector(".sp-stop").hidden = false;
      try { await loadTransactions(me, (n) => (main.querySelector(".sp-state").textContent = `Loading… ${R.fmt(n)} purchases`), stopRef); }
      catch (e) { R.toast("Sync failed: " + e.message); }
      btn.disabled = false; main.querySelector(".sp-stop").hidden = true;
      draw();
    };
    main.querySelector(".sp-stop").onclick = () => (stopRef.stop = true);
    main.querySelector(".sp-csv").onclick = async () => {
      const tx = await R.get1("tx", []);
      R.csv([["Date", "Item", "Type", "Item ID", "Game", "Universe ID", "Seller", "Robux"], ...tx.map((x) => [x.created, x.details?.name, x.details?.type, x.details?.id, x.details?.place?.name, x.details?.place?.universeId, x.agent?.name, spent(x)])], "rogen-purchases.csv");
    };
    await draw();
    if (!(await R.get1("txSynced", 0)) || Date.now() - (await R.get1("txSynced", 0)) > 6 * 3600e3) main.querySelector(".sp-sync").click();
  }

  /* =================== PLAYTIME =================== */
  async function playtime(main) {
    const pt = await R.get1("playtime", {});
    const sessions = await R.get1("playSessions", []);
    const tot = R.playMs;
    const list = Object.entries(pt).sort((a, b) => tot(b[1]) - tot(a[1]));
    const total = list.reduce((t, [, p]) => t + tot(p), 0);
    const added = list.reduce((t, [, p]) => t + (p.base || 0), 0);
    const stRaw = await R.get1("playStatus", null);
    const stLine = (st) => {
      if (!st) return { c: "var(--rg-mute)", t: "Waiting for the first check. RoGen looks every 30 seconds while Chrome is open." };
      const ago = R.ago(st.t);
      if (st.kind === "signedout") return { c: "var(--rg-bad)", t: "RoGen can't tell which account you're on. Open roblox.com while logged in." };
      if (st.kind === "error") return { c: "var(--rg-bad)", t: `Couldn't reach Roblox (${st.msg}). Last try ${ago}.` };
      if (st.kind === "ingame") return st.hidden ? { c: "var(--rg-bad)", t: `Roblox says you're in a game but hides which one. Set "Who can see me join" to Friends or higher in Roblox privacy settings. Checked ${ago}.` } : { c: "var(--rg-good)", t: `Playing ${st.game || "a game"}. Counting your time. Checked ${ago}.` };
      if (st.kind === "studio") return { c: "var(--rg-mute)", t: `In Roblox Studio (not counted). Checked ${ago}.` };
      return { c: "var(--rg-mute)", t: `${st.kind === "online" ? "Online, not in a game" : "Offline"}. Checked ${ago}.` };
    };
    const stNow = stLine(stRaw);
    const since = Math.min(...list.map(([, p]) => p.first || Infinity), ...sessions.map((s) => s.start));
    main.innerHTML = `<h1>Playtime</h1><p class="rg-lead">How long you've played each game. RoGen checks whether you're in a game every minute while Chrome is open.</p>
      <div class="rg-note pt-status" style="margin:-4px 0 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><i class="rg-gdot" style="background:${stNow.c};box-shadow:none"></i><span class="pt-st" style="flex:1;min-width:200px">${R.esc(stNow.t)}</span><button class="btn-control-sm pt-now">Check now</button></div>
      <div class="rg-note" style="margin:-8px 0 16px">Exact time is counted from ${isFinite(since) ? `<b>${R.date(since)}</b>` : "when RoGen started"}. For everything before that, back to when you made your account, open <a class="rg-link" href="#playtime?tab=history">Full history</a>. You can also press <b>+ Earlier time</b> on a row to add hours you know you played.</div>
      <div class="rg-stats" style="margin-bottom:16px">${R.stat("Total playtime", R.dur(total), added ? `includes ${R.dur(added)} you added` : "")}${R.stat("Games", list.length)}${R.stat("Sessions tracked", sessions.length)}</div>
      ${list.length ? `<div class="rg-table-wrap"><table class="rg-table"><thead><tr><th>Game</th><th class="rg-num">Time played</th><th>Share</th><th class="rg-num">Last played</th><th></th></tr></thead><tbody>
        ${list.map(([uid, p]) => `<tr><td>${/^\d+$/.test(uid) ? `<img class="rg-thumb" data-thumb="game:${uid}"> ` : ""}${p.placeId ? `<a href="https://www.roblox.com/games/${p.placeId}">${R.esc(p.name || "Game " + uid)}</a>` : R.esc(p.name || "Game " + uid)}</td>
          <td class="rg-num" title="${R.esc(`Tracked by RoGen: ${R.dur(p.ms || 0)}${p.base ? ` · Added by you: ${R.dur(p.base)}` : ""}${p.first ? ` · Tracking since ${R.date(p.first)}` : ""}`)}">${R.dur(tot(p))}${p.base ? ` <span class="rg-mute" style="font-size:12px">(+${R.dur(p.base)})</span>` : ""}</td>
          <td style="width:26%"><div class="rg-bar"><i style="width:${(tot(p) / tot(list[0][1])) * 100}%"></i></div></td><td class="rg-num rg-mute">${R.ago(p.last)}</td>
          <td class="rg-num"><button class="btn-control-sm pt-add" data-uid="${uid}">+ Earlier time</button></td></tr>`).join("")}</tbody></table></div>
        <div class="rg-h3">Recent sessions</div>
        <div class="rg-table-wrap" style="max-height:300px"><table class="rg-table"><tbody>${sessions.slice(0, 50).map((s) => `<tr><td>${R.esc(s.name || "Game")}</td><td class="rg-mute">${R.dateTime(s.start)}</td><td class="rg-num">${R.dur(s.end - s.start)}</td></tr>`).join("")}</tbody></table></div>`
        : `<div class="rg-empty">No playtime yet. Join a game and it'll show up here. Tip: in Roblox privacy settings, "Who can see me join" must allow RoGen to see which game you're in, so set it to at least Friends.</div>`}
      <p class="rg-note"><button class="rg-link pt-clear">Reset playtime</button></p>`;
    main.querySelector(".pt-now").onclick = async (e) => { e.target.textContent = "Checking…"; await R.send({ type: "presenceNow" }); playtime(main); };
    const iv = setInterval(async () => {
      const box = main.querySelector(".pt-status");
      if (!box || !main.isConnected) return clearInterval(iv);
      const l = stLine(await R.get1("playStatus", null));
      box.querySelector(".pt-st").textContent = l.t; box.querySelector(".rg-gdot").style.background = l.c;
    }, 10000);
    main.querySelectorAll(".pt-add").forEach((b) => (b.onclick = async () => {
      const uid = b.dataset.uid, p = pt[uid];
      const v = await R.ask(b, { title: `Time played before RoGen`, hint: `${p.name || "This game"}: how many hours did you play before RoGen started counting? This replaces what you entered before. It doesn't change what RoGen tracked.`, type: "number", min: 0, step: "0.5", value: p.base ? String(Math.round((p.base / 3600e3) * 10) / 10) : "", unit: "hours", ok: "Add", reset: p.base ? "Remove" : "" });
      if (v === null) return;
      const h = Number(v);
      const cur = await R.get1("playtime", {});
      if (!cur[uid]) return;
      if (v === "" || !(h > 0)) delete cur[uid].base; else cur[uid].base = Math.round(h * 3600e3);
      await R.set({ playtime: cur });
      R.toast("Playtime updated");
      playtime(main);
    }));
    main.querySelector(".pt-clear").onclick = async () => { if (confirm("Reset all playtime? This also removes time you added by hand.")) { await R.set({ playtime: {}, playSessions: [] }); playtime(main); } };
    R.fillThumbs(main);
  }

  /* =================== LIBRARY =================== */
  async function library(main) {
    const me = R.me();
    const bm = await R.bookmarks.all();
    const notes = await R.notes.all();
    const recent = await R.recent.all();
    main.innerHTML = `<h1>Library</h1><p class="rg-lead">Your bookmark folders, Roblox favorites, notes and recently viewed pages.</p>
      <div class="rg-section section"><div class="container-header rg-head"><h2>Bookmark folders</h2><div class="rg-head-right"><button class="rg-link l-newf">+ New folder</button></div></div><div class="l-folders"></div></div>
      <div class="rg-section section"><div class="container-header rg-head"><h2>Your Roblox favorites</h2><div class="rg-head-right"><span class="rg-sub l-favcount"></span></div></div><div class="section-content rg-body l-favs rg-loading">Loading…</div></div>
      <div class="rg-2col">
        <div class="rg-section section"><div class="container-header rg-head"><h2>Notes</h2></div><div class="section-content rg-body">${Object.keys(notes).length ? `<table class="rg-table"><tbody>${Object.entries(notes).sort((a, b) => b[1].at - a[1].at).map(([k, n]) => {
          const [kind, id] = k.split(":");
          const url = n.url || { user: `https://www.roblox.com/users/${id}/profile`, group: `https://www.roblox.com/communities/${id}`, item: `https://www.roblox.com/catalog/${id}` }[kind] || "/rogen#library";
          return `<tr><td><a href="${url}">${R.esc(n.label || k)}</a><div class="rg-mute" style="font-size:12px;white-space:pre-wrap">${R.esc(n.text.slice(0, 140))}</div></td><td class="rg-num rg-mute" style="text-transform:capitalize">${kind}</td></tr>`;
        }).join("")}</tbody></table>` : `<div class="rg-empty">Add notes from the Notes tab on any game, profile, group or item.</div>`}</div></div>
        <div class="rg-section section"><div class="container-header rg-head"><h2>Recently viewed</h2><div class="rg-head-right"><button class="rg-link l-clr">Clear</button></div></div><div class="section-content rg-body">${recent.length ? `<div class="rg-table-wrap" style="max-height:420px"><table class="rg-table"><tbody>${recent.map(recentRow).join("")}</tbody></table></div>` : `<div class="rg-empty">Nothing yet.</div>`}</div></div>
      </div>`;
    const drawFolders = async () => {
      const b = await R.bookmarks.all();
      main.querySelector(".l-folders").innerHTML = Object.entries(b).map(([f, list]) => `<div class="rg-folder"><div class="rg-row space" style="margin-bottom:10px"><b style="font-size:16px">${R.esc(f)} <span class="rg-sub">${list.length}</span></b>
        <button class="rg-link l-delf" data-f="${R.esc(f)}">Delete folder</button></div>
        ${list.length ? R.tileGrid(list.map((g) => R.gameTile({ universeId: g.id, placeId: g.placeId, name: g.name, players: null, up: 0, down: 0,
            extra: `Saved ${R.ago(g.at)}`, corner: `<button class="rg-tile-x l-rm" data-f="${R.esc(f)}" data-id="${g.id}" title="Remove from folder">✕</button>` })).join(""))
          : `<div class="rg-empty">Empty. Bookmark games from the RoGen tab on any game page (Save & Alerts).</div>`}</div>`).join("");
      main.querySelectorAll(".l-delf").forEach((x) => (x.onclick = async () => { if (confirm(`Delete folder "${x.dataset.f}"?`)) { await R.bookmarks.deleteFolder(x.dataset.f); drawFolders(); } }));
      main.querySelectorAll(".l-rm").forEach((x) => (x.onclick = async () => { await R.bookmarks.remove(x.dataset.f, Number(x.dataset.id)); drawFolders(); }));
      R.fillThumbs(main.querySelector(".l-folders"));
    };
    drawFolders();
    main.querySelector(".l-newf").onclick = async () => { const n = (prompt("Folder name") || "").trim(); if (n) { await R.bookmarks.createFolder(n); drawFolders(); } };
    main.querySelector(".l-clr").onclick = async () => { await R.set({ recent: [] }); library(main); };
    R.fillThumbs(main);
    if (me) {
      try {
        const favs = await R.pages((c) => `https://games.roblox.com/v2/users/${me.id}/favorite/games?limit=100&sortOrder=Desc${c ? `&cursor=${encodeURIComponent(c)}` : ""}`, { max: 5 });
        const uids = favs.map((f) => f.id);
        const det = uids.length ? await R.games(uids) : [];
        const prev = await R.get1("favSnap", []);
        const prevSet = new Set(prev);
        await R.set({ favSnap: uids });
        main.querySelector(".l-favcount").textContent = `${favs.length} games`;
        const el = main.querySelector(".l-favs");
        el.className = "section-content rg-body l-favs";
        const removed = prev.filter((id) => !uids.includes(id));
        el.innerHTML = (det.length ? R.tileGrid(det.sort((a, b) => new Date(b.updated) - new Date(a.updated)).map((g) => R.gameTile({ universeId: g.id, placeId: g.rootPlaceId, name: g.name, players: g.playing, up: 0, down: 0,
            extra: `${prev.length && !prevSet.has(g.id) ? `<span class="rg-badge acc">New</span> ` : ""}Updated ${R.ago(g.updated)}` })).join("")) : `<div class="rg-empty">No favorites.</div>`)
          + (removed.length ? `<p class="rg-note">${removed.length} game(s) left your favorites since last time.</p>` : "")
          + `<p class="rg-note">Sorted by most recently updated.</p>`;
        R.fillThumbs(el);
      } catch (e) { main.querySelector(".l-favs").innerHTML = R.errBox(e); }
    }
  }

  /* =================== ITEMS =================== */
  async function items(main) {
    const cmp = await R.compare.all();
    const w = await R.watch.items();
    main.innerHTML = `<h1>Items & Deals</h1><p class="rg-lead">Compare items side by side and keep an eye on prices.</p>
      <div class="rg-section section"><div class="container-header rg-head"><h2>Compare</h2><div class="rg-head-right"><span class="rg-sub">Add items from any catalog page</span></div></div><div class="section-content rg-body i-cmp">${cmp.length ? `<div class="rg-loading">Loading…</div>` : `<div class="rg-empty">Open any catalog item and use "Add to compare" in the RoGen section.</div>`}</div></div>
      <div class="rg-section section"><div class="container-header rg-head"><h2>Price alerts</h2></div><div class="section-content rg-body">${Object.keys(w).length ? `<table class="rg-table"><thead><tr><th>Item</th><th class="rg-num">Alert at</th><th>Offsale alert</th><th></th></tr></thead><tbody>${Object.entries(w).map(([id, x]) => `<tr>
        <td><img class="rg-thumb" data-thumb="asset:${id}"> <a href="https://www.roblox.com/catalog/${id}">${R.esc(x.name)}</a></td><td class="rg-num">${x.target ? R.robux(x.target) : "—"}</td><td>${x.gone ? "On" : ""}</td>
        <td class="rg-num"><button class="btn-control-sm i-unw" data-id="${id}">Remove</button></td></tr>`).join("")}</tbody></table>` : `<div class="rg-empty">No item alerts yet.</div>`}</div></div>
      <div class="rg-section section"><div class="container-header rg-head"><h2>Avatar outfit price</h2></div><div class="section-content rg-body"><div class="rg-row"><input class="rg-input o-name" placeholder="Username (blank = you)"><button class="btn-primary-md o-go">Price it</button></div><div class="o-out" style="margin-top:12px"></div></div></div>`;
    main.querySelectorAll(".i-unw").forEach((b) => (b.onclick = async () => { await R.watch.setItem(b.dataset.id, null); items(main); }));
    main.querySelector(".o-go").onclick = async () => {
      const out = main.querySelector(".o-out");
      out.innerHTML = `<div class="rg-loading">Pricing…</div>`;
      try {
        const n = main.querySelector(".o-name").value.trim();
        const u = n ? await R.userByName(n) : R.me();
        if (!u) { out.innerHTML = `<div class="rg-empty">User not found.</div>`; return; }
        const o = await R.outfitPrice(u.id);
        out.innerHTML = `<div class="rg-stats" style="margin-bottom:10px">${R.stat("Outfit total", R.robux(o.total), `${o.items.length} items`)}</div>
          <table class="rg-table"><tbody>${o.items.map((i) => `<tr><td><img class="rg-thumb" data-thumb="asset:${i.id}"> <a href="https://www.roblox.com/catalog/${i.id}">${R.esc(i.name)}</a></td><td class="rg-num">${o.priceOf(i) ? R.robux(o.priceOf(i)) : `<span class="rg-mute">Offsale/free</span>`}</td></tr>`).join("")}</tbody></table>`;
        R.fillThumbs(out);
      } catch (e) { out.innerHTML = R.errBox(e); }
    };
    R.fillThumbs(main);
    if (cmp.length) {
      const infos = await Promise.all(cmp.map((c) => R.itemInfo(c.id).catch(() => null)));
      const ok = infos.filter(Boolean);
      const rows = [
        ["Price", (i) => (i.forSale && i.price != null ? R.robux(i.price) : "Offsale")],
        ["Lowest resale", (i) => (i.lowest != null ? R.robux(i.lowest) : "—")],
        ["Sales", (i) => (i.sales != null ? R.fmt(i.sales) : "—")],
        ["Favorites", (i) => (i.favorites != null ? R.fmt(i.favorites) : "—")],
        ["Type", (i) => R.esc(i.type)],
        ["Limited", (i) => (i.limited ? "Yes" : "No")],
        ["Creator", (i) => R.esc(i.creator?.Name)],
        ["Created", (i) => R.date(i.created)],
        ["Updated", (i) => R.ago(i.updated)]
      ];
      main.querySelector(".i-cmp").innerHTML = `<div class="rg-table-wrap"><table class="rg-table"><thead><tr><th></th>${ok.map((i) => `<th><img class="rg-thumb" data-thumb="asset:${i.id}"> <a href="https://www.roblox.com/catalog/${i.id}">${R.esc(i.name)}</a> <button class="rg-link c-rm" data-id="${i.id}">✕</button></th>`).join("")}</tr></thead>
        <tbody>${rows.map(([l, f]) => `<tr><td class="rg-mute">${l}</td>${ok.map((i) => `<td style="font-weight:600">${f(i)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      main.querySelectorAll(".c-rm").forEach((b) => (b.onclick = async () => { await R.compare.toggle({ id: Number(b.dataset.id) }); items(main); }));
      R.fillThumbs(main.querySelector(".i-cmp"));
    }
  }

  /* =================== ALERTS =================== */
  async function alerts(main) {
    const wg = await R.watch.games();
    const wi = await R.watch.items();
    const log = await R.get1("alertLog", []);
    main.innerHTML = `<h1>Alerts</h1><p class="rg-lead">RoGen checks these every 5 minutes while Chrome is open and sends a desktop notification.</p>
      <div class="rg-section section"><div class="container-header rg-head"><h2>Games</h2></div><div class="section-content rg-body">${Object.keys(wg).length ? `<table class="rg-table"><thead><tr><th>Game</th><th>Updates</th><th class="rg-num">Player alert</th><th></th></tr></thead><tbody>
        ${Object.entries(wg).map(([id, g]) => `<tr><td><img class="rg-thumb" data-thumb="game:${id}"> <a href="https://www.roblox.com/games/${g.placeId}">${R.esc(g.name)}</a>${g.deleted ? ` <span class="rg-badge bad">Removed</span>` : ""}</td><td>${g.updates ? "On" : ""}</td><td class="rg-num">${g.playerAlert ? "> " + R.fmt(g.playerAlert) : ""}</td>
          <td class="rg-num"><button class="btn-control-sm a-rmg" data-id="${id}">Remove</button></td></tr>`).join("")}</tbody></table>` : `<div class="rg-empty">Turn on alerts from the "Save & Alerts" tab on any game.</div>`}</div></div>
      <div class="rg-section section"><div class="container-header rg-head"><h2>Items</h2></div><div class="section-content rg-body">${Object.keys(wi).length ? `<a class="rg-link" href="#items">${Object.keys(wi).length} item alert(s) → manage in Items & Deals</a>` : `<div class="rg-empty">Turn on alerts from the "Alerts & Compare" tab on any item.</div>`}</div></div>
      <div class="rg-section section"><div class="container-header rg-head"><h2>Recent alerts</h2><div class="rg-head-right"><button class="rg-link a-test">Send a test notification</button></div></div><div class="section-content rg-body">${log.length ? `<ul class="rg-timeline">${log.slice(0, 50).map((a) => `<li><b>${R.esc(a.title)}</b> ${R.esc(a.msg)}<time>${R.dateTime(a.t)}</time></li>`).join("")}</ul>` : `<div class="rg-empty">No alerts yet.</div>`}</div></div>`;
    main.querySelectorAll(".a-rmg").forEach((b) => (b.onclick = async () => { await R.watch.setGame(b.dataset.id, null); alerts(main); }));
    main.querySelector(".a-test").onclick = () => R.send({ type: "testNotify" });
    R.fillThumbs(main);
  }

  /* =================== TOOLS =================== */
  const rates = () => R.rates();
  async function tools(main) {
    const r = await rates();
    main.innerHTML = `<h1>Tools</h1><p class="rg-lead">Quick lookups and calculators.</p>
      <div class="rg-2col">
        <div class="rg-section section"><div class="container-header rg-head"><h2>Robux to USD</h2></div><div class="section-content rg-body">
          <div class="rg-row"><label class="rg-field">Robux<input class="rg-input c-rbx" type="number" value="1000" style="width:140px"></label><label class="rg-field">US dollars<input class="rg-input c-usd" type="number" step="0.01" style="width:140px"></label></div>
          <div class="c-out" style="margin-top:12px"></div>
          <div class="rg-row" style="margin-top:12px"><label class="rg-field">Buying rate ($ per R$)<input class="rg-input c-buy" type="number" step="0.0001" value="${r.buy}" style="width:140px"></label><label class="rg-field">DevEx rate ($ per R$)<input class="rg-input c-dev" type="number" step="0.0001" value="${r.devex}" style="width:140px"></label></div>
          <p class="rg-note">Buying rate is roughly what Robux costs in the shop; DevEx is what developers cash out at. Edit them if Roblox changes prices.</p></div></div>
        <div class="rg-section section"><div class="container-header rg-head"><h2>Compare players</h2></div><div class="section-content rg-body">
          <div class="rg-row"><input class="rg-input p-names" placeholder="usernames, separated by commas" style="flex:1"><button class="btn-primary-md p-go">Compare</button></div><div class="p-out" style="margin-top:12px"></div></div></div>
        <div class="rg-section section"><div class="container-header rg-head"><h2>Look up anything by ID</h2></div><div class="section-content rg-body">
          <div class="rg-row"><select class="rg-select k-type"><option value="user">Player</option><option value="game">Game (place ID)</option><option value="universe">Game (universe ID)</option><option value="group">Group</option><option value="item">Catalog item</option></select>
            <input class="rg-input k-id" placeholder="ID" style="width:160px"><button class="btn-primary-md k-go">Open</button></div>
          <p class="rg-note">Opens the page with all of RoGen's info for it.</p></div></div>
        <div class="rg-section section"><div class="container-header rg-head"><h2>Username history</h2></div><div class="section-content rg-body">
          <div class="rg-row"><input class="rg-input u-name" placeholder="Current username" style="flex:1"><button class="btn-primary-md u-go">Look up</button></div><div class="u-out" style="margin-top:12px"></div></div></div>
      </div>`;
    const $ = (s) => main.querySelector(s);
    const calc = (from) => {
      const buy = Number($(".c-buy").value) || 0.0125, dev = Number($(".c-dev").value) || 0.0038;
      if (from === "usd") $(".c-rbx").value = Math.round((Number($(".c-usd").value) || 0) / buy);
      const rb = Number($(".c-rbx").value) || 0;
      if (from !== "usd") $(".c-usd").value = (rb * buy).toFixed(2);
      $(".c-out").innerHTML = `<div class="rg-stats">${R.stat("Costs to buy", "$" + (rb * buy).toFixed(2))}${R.stat("DevEx payout", "$" + (rb * dev).toFixed(2))}${R.stat("After 30% fee", R.robux(Math.floor(rb * 0.7)), "what a seller gets")}</div>`;
      R.set({ rates: { buy, devex: dev } });
    };
    $(".c-rbx").oninput = () => calc("rbx"); $(".c-usd").oninput = () => calc("usd"); $(".c-buy").oninput = () => calc("rbx"); $(".c-dev").oninput = () => calc("rbx");
    calc("rbx");
    $(".p-go").onclick = async () => {
      const out = $(".p-out");
      out.innerHTML = `<div class="rg-loading">Comparing…</div>`;
      try {
        const names = $(".p-names").value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5);
        const users = (await Promise.all(names.map((n) => R.userByName(n)))).filter(Boolean);
        out.innerHTML = users.length ? await R.compareUsersHTML(users.map((u) => u.id)) : `<div class="rg-empty">No users found.</div>`;
        R.fillThumbs(out);
      } catch (e) { out.innerHTML = R.errBox(e); }
    };
    $(".k-go").onclick = async () => {
      const id = $(".k-id").value.trim(), t = $(".k-type").value;
      if (!/^\d+$/.test(id)) return R.toast("Enter a number");
      if (t === "universe") { const [g] = await R.games([Number(id)]).catch(() => []); if (!g) return R.toast("Not found"); location.href = `https://www.roblox.com/games/${g.rootPlaceId}`; return; }
      location.href = { user: `/users/${id}/profile`, game: `/games/${id}`, group: `/communities/${id}`, item: `/catalog/${id}` }[t];
    };
    $(".u-go").onclick = async () => {
      const out = $(".u-out");
      out.innerHTML = `<div class="rg-loading">Looking up…</div>`;
      try {
        const u = await R.userByName($(".u-name").value.trim());
        if (!u) { out.innerHTML = `<div class="rg-empty">No user with that name.</div>`; return; }
        const h = await R.api(`https://users.roblox.com/v1/users/${u.id}/username-history?limit=100&sortOrder=Desc`);
        out.innerHTML = `<div class="rg-row" style="margin-bottom:8px"><img class="rg-thumb round" data-thumb="user:${u.id}"> <a class="rg-link" href="https://www.roblox.com/users/${u.id}/profile">${R.esc(u.displayName)} (@${R.esc(u.name)})</a></div>
          ${(h.data || []).length ? `<div class="rg-chips">${h.data.map((n) => `<span class="rg-chip">@${R.esc(n.name)}</span>`).join("")}</div>` : `<div class="rg-empty">Never changed their username.</div>`}`;
        R.fillThumbs(out);
      } catch (e) { out.innerHTML = R.errBox(e); }
    };
  }

  /* =================== SETTINGS =================== */
  const PRESETS = ["linear-gradient(135deg,#1a1033,#3b1d6e,#0b5ea8)", "linear-gradient(135deg,#0f2027,#203a43,#2c5364)", "linear-gradient(135deg,#ff512f,#dd2476)", "linear-gradient(135deg,#11998e,#38ef7d)", "linear-gradient(135deg,#f7971e,#ffd200)", "linear-gradient(135deg,#000428,#004e92)", "linear-gradient(135deg,#232526,#414345)", "linear-gradient(135deg,#8e2de2,#4a00e0)", "linear-gradient(135deg,#ee9ca7,#ffdde1)", "radial-gradient(circle at 30% 20%,#2b5876,#4e4376 60%,#0b0b12)", "linear-gradient(180deg,#0b0b12,#1c1c28)", "#0e0e14"];
  const ACCENTS = ["#335fff", "#7c5cff", "#00b06f", "#e5484d", "#f5a623", "#00c2ff", "#ff5fa2", "#8a8a8a"];
  R.PRESETS = PRESETS;

  // Shrink an uploaded image so it fits comfortably in storage
  R.readBackground = (file) => new Promise((res, rej) => {
    if (!file || !file.type.startsWith("image/")) return rej(new Error("Pick an image file"));
    const fr = new FileReader();
    fr.onerror = () => rej(new Error("Couldn't read that file"));
    fr.onload = () => {
      if (file.type === "image/gif") {
        if (file.size > 8e6) return rej(new Error("GIF is too big (max 8 MB)"));
        return res(fr.result);
      }
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 2560 / img.width);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.88));
      };
      img.onerror = () => rej(new Error("That image couldn't be opened"));
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });

  async function settings(main) {
    const s = await R.get(["bgMode", "bgPreset", "bgImage", "bgUpload", "bgDim", "accent", "hideRobux", "blurCards", "status", "pfp"]);
    main.innerHTML = `<h1>Settings</h1><p class="rg-lead">Make Roblox look and work the way you want.</p>
      <div class="rg-section section"><div class="container-header rg-head"><h2>Theme</h2></div><div class="section-content rg-body">
        <div class="rg-h3">Accent color</div>
        <div class="rg-row">${ACCENTS.map((c) => `<button class="rg-swatch t-acc ${s.accent === c || (!s.accent && c === "#335fff") ? "on" : ""}" data-c="${c}" style="background:${c}" title="${c}"></button>`).join("")}<input type="color" class="t-custom" value="${s.accent || "#335fff"}" title="Custom color"></div>
        <div class="rg-h3">Background</div>
        <div class="rg-row" style="margin-bottom:10px">${["off", "preset", "upload", "image"].map((m) => `<button class="rg-chip t-mode ${(s.bgMode || "off") === m ? "on" : ""}" data-m="${m}">${{ off: "Default", preset: "Gradient", upload: "Upload a file", image: "Image link" }[m]}</button>`).join("")}</div>
        <div class="t-preset rg-row" ${s.bgMode === "preset" ? "" : "hidden"}>${PRESETS.map((p) => `<button class="rg-bgpick t-p ${s.bgPreset === p ? "on" : ""}" data-p="${R.esc(p)}" style="background:${p}"></button>`).join("")}</div>
        <div class="t-upload" ${s.bgMode === "upload" ? "" : "hidden"}>
          <label class="btn-primary-md" style="display:inline-block">Choose image…<input type="file" accept="image/*" hidden class="t-file"></label>
          <span class="rg-mute t-upname" style="margin-left:8px">${s.bgUpload ? "Using your uploaded image" : "PNG, JPG, WEBP or GIF"}</span>
          ${s.bgUpload ? `<div style="margin-top:10px"><img src="${s.bgUpload}" style="max-width:260px;border-radius:8px;display:block"></div>` : ""}
        </div>
        <div class="t-image" ${s.bgMode === "image" ? "" : "hidden"}><input class="rg-input t-url" style="width:100%" placeholder="https://…" value="${R.esc(s.bgImage || "")}"></div>
        <div class="rg-row" style="margin-top:12px"><span>Darken</span><input type="range" min="0" max="85" step="5" class="t-dim" value="${s.bgDim ?? 35}" style="accent-color:var(--rg-accent)">
          <label class="rg-check" style="margin-left:16px"><input type="checkbox" class="t-blur" ${s.blurCards !== false ? "checked" : ""}> Frosted panel behind page content</label></div>
        <div class="rg-h3">Privacy</div>
        <label class="rg-check"><input type="checkbox" class="t-hide" ${s.hideRobux ? "checked" : ""}> Hide my Robux (blurred, hover to peek)</label>
      </div></div>
      <div class="rg-section section" id="you"><div class="container-header rg-head"><h2>You</h2></div><div class="section-content rg-body">
        <div class="rg-you">
          <div class="rg-you-av"><img class="y-av" alt=""></div>
          <div style="flex:1;min-width:220px">
            <div class="rg-h3" style="margin-top:0">Profile picture</div>
            <div class="rg-row"><label class="btn-primary-sm" style="cursor:pointer">Upload picture<input type="file" accept="image/*" hidden class="y-file"></label>${s.pfp ? `<button class="btn-control-sm y-reset">Use my Roblox avatar</button>` : ""}</div>
            <p class="rg-note">Replaces your avatar picture across roblox.com in this browser. Roblox doesn't let anyone upload a real profile picture, so other people still see your normal avatar.</p>
            <div class="rg-h3">Status</div>
            <div class="y-status">${R.statusPill(s.status, { editable: true })}</div>
          </div>
        </div>
      </div></div>
      <div class="rg-section section"><div class="container-header rg-head"><h2>Keyboard shortcuts</h2></div><div class="section-content rg-body"><table class="rg-table"><tbody>${R.shortcuts.map(([k, d]) => `<tr><td style="width:140px"><span class="rg-kbd">${k}</span></td><td>${d}</td></tr>`).join("")}</tbody></table></div></div>
      <div class="rg-section section"><div class="container-header rg-head"><h2>RoGen badges</h2></div><div class="section-content rg-body">
        <p class="rg-note" style="margin-top:0">To see badges other people have, RoGen reads the owner's published list. If you can't see badges, paste the list link from the owner here once.</p>
        <div class="rg-row"><input class="rg-input bl-url" placeholder="https://gist.githubusercontent.com/…/raw/badges.json" style="flex:1;min-width:260px"><button class="btn-primary-sm bl-save">Save &amp; load</button></div>
        <p class="rg-note bl-state"></p></div></div>
            <div class="rg-section section"><div class="container-header rg-head"><h2>Your data</h2></div><div class="section-content rg-body">
        <p class="rg-note" style="margin-top:0">Everything RoGen saves stays in this browser. Nothing is sent anywhere except Roblox.</p>
        <div class="rg-row"><button class="btn-control-md x-json">Export everything (JSON)</button><button class="btn-control-md x-hist">Export tracked history (CSV)</button><button class="btn-control-md x-wipe" style="color:var(--rg-bad)">Delete all RoGen data</button></div></div></div>`;
    const $ = (q) => main.querySelector(q);
    main.querySelectorAll(".t-acc").forEach((b) => (b.onclick = () => { R.set({ accent: b.dataset.c }); settings(main); }));
    $(".t-custom").onchange = (e) => { R.set({ accent: e.target.value }); settings(main); };
    main.querySelectorAll(".t-mode").forEach((b) => (b.onclick = async () => {
      const patch = { bgMode: b.dataset.m };
      if (b.dataset.m === "preset" && !s.bgPreset) patch.bgPreset = PRESETS[0];
      await R.set(patch); settings(main);
      if (b.dataset.m === "upload" && !s.bgUpload) main.querySelector(".t-file").click();
    }));
    main.querySelectorAll(".t-p").forEach((b) => (b.onclick = () => { R.set({ bgPreset: b.dataset.p }); settings(main); }));
    $(".t-file").onchange = async (e) => {
      try {
        $(".t-upname").textContent = "Loading…";
        const url = await R.readBackground(e.target.files[0]);
        await R.set({ bgUpload: url, bgMode: "upload" });
        R.toast("Background updated");
        settings(main);
      } catch (err) { R.toast(err.message); $(".t-upname").textContent = err.message; }
    };
    $(".t-url").onchange = (e) => R.set({ bgImage: e.target.value.trim() });
    $(".t-dim").oninput = (e) => R.set({ bgDim: Number(e.target.value) });
    $(".t-blur").onchange = (e) => R.set({ blurCards: e.target.checked });
    $(".t-hide").onchange = (e) => R.set({ hideRobux: e.target.checked });
    // Profile picture
    const av = $(".y-av");
    if (s.pfp) av.src = s.pfp; else { const me = R.me(); if (me) R.thumbs("user", [me.id], "420x420").then((m) => m[me.id] && (av.src = m[me.id])); }
    $(".y-file").onchange = async (e) => {
      try { await R.set({ pfp: await R.readPfp(e.target.files[0]) }); R.toast("Profile picture updated"); settings(main); }
      catch (err) { R.toast(err.message); }
    };
    $(".y-reset") && ($(".y-reset").onclick = async () => { await R.set({ pfp: null }); R.toast("Back to your Roblox avatar"); settings(main); });
    const onSt = (ch) => { if (ch.status && document.contains(main)) $(".y-status").innerHTML = R.statusPill(ch.status.newValue, { editable: true }); };
    chrome.storage.onChanged.addListener(onSt);
    $(".x-json").onclick = async () => {
      const all = await R.get(null);
      delete all.bgUpload;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(all, null, 1)], { type: "application/json" }));
      a.download = "rogen-data.json"; a.click();
    };
    $(".x-hist").onclick = async () => {
      const all = await R.get(null);
      const rows = [["Kind", "ID", "Time", "Field", "Value"]];
      for (const k in all) if (k.startsWith("hist:")) {
        const [, kind, id] = k.match(/^hist:([^:]+):(.+)$/) || [];
        for (const p of all[k]) for (const f in p) if (f !== "t" && typeof p[f] !== "object") rows.push([kind, id, new Date(p.t).toISOString(), f, p[f]]);
      }
      R.csv(rows, "rogen-history.csv");
    };
    const blState = async () => {
      const f = await R.get1("badgeFeed", null), me = R.me();
      const url = R.badges.feedUrl();
      $(".bl-state").textContent = !url ? "No list link yet, so no badges can show." : !f ? "Link saved, not loaded yet." : `Loaded ${R.ago(f.at)} · ${Object.keys(f.grants).length} people have badges${me ? (f.grants[me.id] ? " · you have: " + f.grants[me.id].join(", ") : " · you have none") : ""}.`;
    };
    $(".bl-url").value = R.badges.feedUrl();
    blState();
    $(".bl-save").onclick = async () => {
      $(".bl-state").textContent = "Loading…";
      await R.badges.setMyFeedUrl($(".bl-url").value);
      const r = await R.send({ type: "fetchBadgeFeed", url: R.badges.feedUrl() });
      if (!r.ok) { $(".bl-state").textContent = r.reason || "Couldn't load that link."; return; }
      blState(); R.toast("Badges loaded");
    };
    $(".x-wipe").onclick = async () => { if (confirm("Delete ALL RoGen data (history, notes, bookmarks, purchases, settings)? Badges are kept. This can't be undone.")) { const keep = await R.get(["badgeGrants", "badgeGist", "badgeFeedUrl", "badgeSeen"]);   // badges are never wiped
          await new Promise((r) => chrome.storage.local.clear(r));
          await R.set(keep); R.toast("All RoGen data deleted"); settings(main); } };
  }

  /* =================== mount =================== */
  const RENDER = { dashboard, discover, search, spending, playtime, friends, library, items, alerts, tools, settings, ...(R.extraViews || {}) };
  R.views = RENDER;   // other Roblox pages reuse these (see places.js)
const ICONS = {
    badges: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>`,
    lookup: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>`,
    dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
    discover: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`,
    spending: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/></svg>`,
    playtime: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    friends: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c1.9.7 3.1 2.5 3.5 5.2"/></svg>`,
    library: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>`,
    items: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>`,
    alerts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/></svg>`,
    tools: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6.5a4 4 0 00-5.4 5.1L4 16.7 7.3 20l5.1-5.1a4 4 0 005.1-5.4l-2.4 2.4-2.6-.7-.7-2.6z"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/></svg>`
  };
  R.viewIcons = ICONS;
  const view = () => {
    let h = location.hash;
    // Roblox clears the #section on first load; restore the one you opened
    const saved = document.documentElement.dataset.rgHash;
    if (!h && saved) {
      h = saved;
      history.replaceState(history.state, "", location.pathname + h);
    }
    delete document.documentElement.dataset.rgHash;
    const v = h.replace(/^#/, "").split("?")[0];
    // The avatar editor now replaces Roblox's own page
    if (v === "avatar") { location.replace("https://www.roblox.com/my/avatar"); return "dashboard"; }
    return RENDER[v] ? v : "dashboard";
  };

  // roblox.com/rogen  (Roblox shows an empty Charts page there, RoGen replaces it)
  R.route((p) => p === "/rogen", () => {
    const page = R.h(`<div class="rg-page">
      <nav class="rg-side" aria-label="RoGen">
        <a class="rg-brand" href="#dashboard"><span class="rg-brand-mark"><span class="rg-logo"></span></span><span class="rg-brand-t">RoGen<small>v${R.esc(chrome.runtime.getManifest().version)}</small></span></a>
        <button class="rg-side-find" type="button"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/></svg><span>Quick find</span><kbd>${/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"}</kbd></button>
        ${VIEWS.filter(([id]) => (id !== "badges" && id !== "#owner") || R.badges.isOwner()).map(([id, label]) => (id === "-" ? `<div class="rg-side-sep"></div>` : id[0] === "#" ? `<div class="rg-side-label">${label}</div>` : `<a class="rg-side-link" href="#${id}" data-v="${id}"><span class="rg-side-ic">${ICONS[id]}</span><span class="rg-side-t">${label}</span></a>`)).join("")}
      </nav><div class="rg-main"></div></div>`);
    page.querySelector(".rg-side-find").onclick = () => R.finder && R.finder.open();
    let current = null;
    const show = () => {
      const v = view();
      if (location.hash === current && page.querySelector(".rg-main").childElementCount) return;
      current = location.hash;
      page.querySelectorAll(".rg-side-link").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
      const main = R.h(`<div class="rg-main"></div>`);
      page.querySelector(".rg-main").replaceWith(main);
      const params = new URLSearchParams(location.hash.split("?")[1] || "");
      Promise.resolve(RENDER[v](main, params.get("q"), params)).catch((e) => (main.innerHTML = R.errBox(e)));
      document.title = `RoGen · ${(VIEWS.find(([id]) => id === v) || [, "Dashboard"])[1]} - Roblox`;
      main.dataset.view = v;
      window.scrollTo(0, 0);
    };
    const onHash = () => show();
    window.addEventListener("hashchange", onHash);
    const place = () => {
      const content = document.querySelector("#content") || document.querySelector("#container-main");
      if (!content) return;
      content.classList.add("rg-host");
      if (!content.contains(page)) content.appendChild(page);
      document.title.startsWith("RoGen") || (document.title = `RoGen - Roblox`);
    };
    place();
    show();
    return { tick: place, stop: () => { window.removeEventListener("hashchange", onHash); page.remove(); document.querySelector(".rg-host")?.classList.remove("rg-host"); } };
  });

  // Old address → new one
  R.route((p) => p === "/charts/rogen", () => { location.replace("https://www.roblox.com/rogen" + (location.hash || document.documentElement.dataset.rgHash || "")); return {}; });
})();
