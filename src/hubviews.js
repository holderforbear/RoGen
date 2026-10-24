// New RoGen pages: RoGen ID, Compare, Tracker (with Timeline), Vault, Inventory, Badges, Wrapped, Insights
(() => {
  const R = window.Rogen;
  const RB = "https://www.roblox.com";
  const SESSION = crypto.randomUUID();
  const head = (title, lead) => `<h1>${title}</h1><p class="rg-lead">${lead}</p>`;
  const sec = (title, inner, right = "") => `<div class="rg-section section"><div class="container-header rg-head"><h2>${title}</h2><div class="rg-head-right">${right}</div></div><div class="section-content rg-body">${inner}</div></div>`;
  const loading = (t = "Loading…") => `<div class="rg-loading">${t}</div>`;
  const seg = (cls, items, on) => `<div class="rg-seg ${cls}">${items.map(([k, l]) => `<button class="${k === on ? "on" : ""}" data-k="${k}">${l}</button>`).join("")}</div>`;
  const bars = (list, fmt = R.fmt, small = false) => { const m = Math.max(1, ...list.map((x) => x[1])); return `<div class="rg-bars ${small ? "rg-bars-sm" : ""}">${list.map(([k, v]) => `<div title="${R.esc(k)}: ${fmt(v)}"><i style="height:${Math.max(2, (v / m) * 100)}%"></i><span>${R.esc(k)}</span></div>`).join("")}</div>`; };
  const hbars = (list, fmt = R.fmt) => { const m = Math.max(1, ...list.map((x) => x[1])); return `<div class="rg-list">${list.map(([k, v, href]) => `<div class="rg-li"><div class="rg-li-main"><b>${href ? `<a href="${href}">${R.esc(k)}</a>` : R.esc(k)}</b><div class="rg-bar"><i style="width:${(v / m) * 100}%"></i></div></div><span class="rg-num"><b>${fmt(v)}</b></span></div>`).join("")}</div>`; };
  // a username, profile link or ID → user {id, name, displayName}
  R.resolveUser = async (q) => {
    q = String(q || "").trim();
    const m = q.match(/users\/(\d+)/) || q.match(/^(\d{1,12})$/);
    if (m) { const u = await R.api(`https://users.roblox.com/v1/users/${m[1]}`); return { id: u.id, name: u.name, displayName: u.displayName }; }
    const u = await R.userByName(q.replace(/^@/, ""));
    if (!u) throw new Error(`No player called "${q}"`);
    return u;
  };
  const meOrAsk = (main) => { const me = R.me(); if (!me) main.innerHTML = `<div class="rg-empty" style="padding:80px 0">Log in to Roblox first.</div>`; return me; };
  const tabsFrom = (params, def) => (params && params.get("tab")) || def;
  const setTab = (view, tab, extra = "") => history.replaceState(null, "", `#${view}?tab=${tab}${extra}`);
  const rarity = (p) => (p == null ? "—" : `${p < 0.01 ? p.toFixed(3) : p < 1 ? p.toFixed(2) : p.toFixed(1)}%`);

  /* =================== RoGen ID: a full profile analyzer =================== */
  async function idView(main, q) {
    main.innerHTML = head("RoGen ID", "Everything public about a player in one place: account, value, names, badges, creations and how they connect to you.")
      + `<form class="rg-searchbar id-form"><input class="rg-input" placeholder="Username, profile link or user ID" value="${R.esc(q || "")}"><button class="btn-primary-md">Analyze</button></form><div class="id-out"></div>`;
    const form = main.querySelector(".id-form"), out = main.querySelector(".id-out");
    form.onsubmit = (e) => { e.preventDefault(); const v = form.querySelector("input").value.trim(); if (v) { history.replaceState(null, "", `#id?q=${encodeURIComponent(v)}`); analyze(v); } };
    const analyze = async (v) => {
      out.innerHTML = loading("Looking them up…");
      let u;
      try { u = await R.resolveUser(v); } catch (e) { out.innerHTML = R.errBox(e); return; }
      const id = u.id, me = R.me();
      R.recent.add({ kind: "user", id, name: u.displayName, url: `${RB}/users/${id}/profile` });
      const [s, full, inVault, tracking] = await Promise.all([R.userSummary(id), R.api(`https://users.roblox.com/v1/users/${id}`), R.vault.has("users", id), R.tracker.has("users", id)]);
      out.innerHTML = `<section class="rg-hero id-hero"><span class="rg-hero-av"><img data-thumb="user:${id}" alt=""></span><div class="rg-hero-info">
          <div class="rg-hero-name">${R.esc(full.displayName)} <span>@${R.esc(full.name)}</span>${full.hasVerifiedBadge ? ` <span class="rg-badge">Verified</span>` : ""}${full.isBanned ? ` <span class="rg-badge bad">Banned</span>` : ""}</div>
          <div class="rg-hero-meta">Joined ${R.date(full.created)} · ${(s.ageDays / 365.25).toFixed(1)} years · ${R.copy(id, "ID")}</div>
          ${full.description ? `<p class="id-bio">${R.esc(full.description.slice(0, 400))}</p>` : ""}
          <div class="rg-row" style="margin-top:10px"><a class="btn-control-sm" href="${RB}/users/${id}/profile">Profile</a><button class="btn-control-sm id-vault">${inVault ? "In Vault" : "Save to Vault"}</button><button class="btn-control-sm id-track">${tracking ? "Tracking" : "Track changes"}</button>${me && me.id !== id ? `<a class="btn-control-sm" href="#compare?tab=profiles&a=${me.id}&b=${id}">Compare with me</a>` : ""}</div></div></section>
        <div class="rg-stats id-stats">${R.stat("Friends", R.fmt(s.friends || 0))}${R.stat("Followers", R.fmt(s.followers || 0))}${R.stat("Following", R.fmt(s.following || 0))}${R.stat("Communities", R.fmt(s.groups || 0))}
          <div class="rg-stat id-badges">${loading("")}</div><div class="rg-stat id-rap">${loading("")}</div><div class="rg-stat id-outfit">${loading("")}</div><div class="rg-stat id-value">${loading("")}</div></div>
        <div class="rg-2col">${sec("You and them", `<div class="id-you">${loading()}</div>`)}${sec("Names", `<div class="id-names">${loading()}</div>`)}</div>
        <div class="rg-2col">${sec("Rarest badges", `<div class="id-rare">${loading()}</div>`)}${sec("Communities they own", `<div class="id-owns">${loading()}</div>`)}</div>
        ${sec("Their games", `<div class="id-games">${loading()}</div>`)}`;
      R.fillThumbs(out);
      out.querySelector(".id-vault").onclick = async (e) => { const on = await R.vault.toggle("users", { id, name: full.displayName, username: full.name }); e.target.textContent = on ? "In Vault" : "Save to Vault"; };
      out.querySelector(".id-track").onclick = async (e) => { const on = await R.tracker.toggle("users", id, { name: full.displayName }); e.target.textContent = on ? "Tracking" : "Track changes"; if (on) R.send({ type: "runTracker" }); };
      const put = (cls, html) => { const el = out.querySelector(cls); if (el) el.outerHTML = html; };
      R.snap(`userText:${id}`, { displayName: full.displayName, name: full.name, description: full.description || "" }, { textOnly: true });
      // badges (count + rarest)
      R.userBadges(id, 10).then((list) => {
        put(".id-badges", R.stat("Badges", R.fmt(list.length) + (list.length >= 1000 ? "+" : "")));
        const rare = list.filter((b) => b.statistics && b.statistics.winRatePercentage != null).sort((a, b) => a.statistics.winRatePercentage - b.statistics.winRatePercentage).slice(0, 6);
        const el = out.querySelector(".id-rare");
        el.innerHTML = rare.length ? `<div class="rg-list">${rare.map((b) => `<a class="rg-li" href="${RB}/badges/${b.id}"><img class="rg-thumb" data-thumb="badge:${b.id}"><div class="rg-li-main"><b>${R.esc(b.name)}</b><small>${R.esc(R.rarityWord(b.statistics.winRatePercentage))}</small></div><span class="rg-li-end">${rarity(b.statistics.winRatePercentage)}</span></a>`).join("")}</div>` : `<div class="rg-empty">${list.length ? "Roblox didn't share rarity for these badges." : "No public badges."}</div>`;
        R.fillThumbs(el);
      }).catch(() => put(".id-badges", R.stat("Badges", "Private")));
      // value
      const rapP = R.inventoryValue(id).then((v) => v.rap).catch(() => null);
      const outP = R.outfitPrice(id).then((o) => o.total).catch(() => null);
      rapP.then((r) => put(".id-rap", R.stat("Limiteds RAP", r == null ? "Private" : R.robux(r))));
      outP.then((o) => put(".id-outfit", R.stat("Outfit cost", o == null ? "—" : R.robux(o))));
      Promise.all([rapP, outP]).then(([r, o]) => put(".id-value", R.stat("Estimated value", R.robux((r || 0) + (o || 0)), "Limiteds RAP + current outfit")));
      // you and them
      (async () => {
        const el = out.querySelector(".id-you");
        if (!me || me.id === id) { el.innerHTML = `<div class="rg-empty">${me ? "This is you." : "Log in to see how you're connected."}</div>`; return; }
        const [fi, mut] = await Promise.all([R.friendshipInfo(id).catch(() => null), R.mutualFriends(id).catch(() => [])]);
        const th = mut.length ? await R.thumbs("user", mut.slice(0, 12), "48x48") : {};
        const note = await R.notes.get("user", id);
        el.innerHTML = `<div class="rg-stats">${R.stat("Friends?", fi ? "Yes" : "No")}${R.stat("Mutual friends", R.fmt(mut.length))}</div>
          ${mut.length ? `<div class="rg-people" style="margin-top:10px">${mut.slice(0, 12).map((m) => `<a class="rg-person sm" href="${RB}/users/${m}/profile"><img src="${R.esc(th[m] || "")}" alt=""></a>`).join("")}</div>` : ""}
          <div class="rg-h3">Your note</div><div class="rg-row"><input class="rg-input id-note" placeholder="Only you can see this" value="${R.esc(note ? note.text : "")}" style="flex:1"><button class="btn-control-sm id-nsave">Save</button></div>`;
        el.querySelector(".id-nsave").onclick = async () => { await R.notes.set("user", id, el.querySelector(".id-note").value, full.displayName); R.toast("Note saved"); };
      })();
      // names: Roblox's username history + display names RoGen has seen
      (async () => {
        const el = out.querySelector(".id-names");
        const [h, seen] = await Promise.all([R.api(`https://users.roblox.com/v1/users/${id}/username-history?limit=100&sortOrder=Desc`).then((d) => d.data || []).catch(() => []), R.hist(`userText:${id}`)]);
        const dns = [...new Set(seen.map((x) => x.displayName).filter(Boolean))].filter((d) => d !== full.displayName);
        el.innerHTML = `<div class="rg-h3" style="margin-top:0">Past usernames</div>${h.length ? `<div class="rg-chips">${h.map((x) => `<span class="rg-chip">@${R.esc(x.name)}</span>`).join("")}</div>` : `<div class="rg-mute">None.</div>`}
          <div class="rg-h3">Past display names</div>${dns.length ? `<div class="rg-chips">${dns.map((d) => `<span class="rg-chip">${R.esc(d)}</span>`).join("")}</div>` : `<div class="rg-mute">None seen yet.</div>`}
          <p class="rg-note">Roblox doesn't share old display names. RoGen remembers the ones it sees when you visit or track this profile.</p>`;
      })();
      // communities they own
      R.api(`https://groups.roblox.com/v2/users/${id}/groups/roles`).then((d) => {
        const own = (d.data || []).filter((x) => x.role && x.role.rank === 255);
        const el = out.querySelector(".id-owns");
        el.innerHTML = own.length ? `<div class="rg-list">${own.map((x) => `<a class="rg-li" href="${RB}/communities/${x.group.id}"><img class="rg-thumb" data-thumb="group:${x.group.id}"><div class="rg-li-main"><b>${R.esc(x.group.name)}</b><small>${R.fmt(x.group.memberCount || 0)} members</small></div></a>`).join("")}</div>` : `<div class="rg-empty">They don't own any communities.</div>`;
        R.fillThumbs(el);
      }).catch(() => (out.querySelector(".id-owns").innerHTML = `<div class="rg-empty">Couldn't load.</div>`));
      // games
      R.api(`https://games.roblox.com/v2/users/${id}/games?accessFilter=2&limit=50&sortOrder=Desc`).then(async (d) => {
        const list = d.data || [], el = out.querySelector(".id-games");
        if (!list.length) { el.innerHTML = `<div class="rg-empty">No public games.</div>`; return; }
        const det = await R.games(list.map((g) => g.id));
        const tot = det.reduce((t, g) => t + (g.visits || 0), 0), now = det.reduce((t, g) => t + (g.playing || 0), 0);
        el.innerHTML = `<div class="rg-stats" style="margin-bottom:12px">${R.stat("Games", R.fmt(det.length))}${R.stat("Total visits", R.short(tot))}${R.stat("Playing now", R.fmt(now))}</div>`
          + R.tileGrid(det.sort((a, b) => b.visits - a.visits).slice(0, 12).map((g) => R.gameTile({ universeId: g.id, placeId: g.rootPlaceId, name: g.name, players: g.playing, up: 0, down: 0, extra: `${R.short(g.visits)} visits` })).join(""));
        R.fillThumbs(el);
      }).catch(() => (out.querySelector(".id-games").innerHTML = `<div class="rg-empty">Couldn't load.</div>`));
    };
    if (q) analyze(q);
  }

  /* =================== Compare =================== */
  async function compare(main, q, params) {
    const tab = tabsFrom(params, "profiles");
    const me = R.me();
    main.innerHTML = head("Compare", "Put players, badge collections, inventories, outfits or games side by side.")
      + seg("cmp-tabs", [["profiles", "Profiles"], ["badges", "Badges"], ["inventory", "Inventories"], ["outfits", "Outfits"], ["games", "Games"]], tab) + `<div class="cmp-body"></div>`;
    main.querySelectorAll(".cmp-tabs [data-k]").forEach((b) => (b.onclick = () => { setTab("compare", b.dataset.k); compare(main, q, new URLSearchParams(`tab=${b.dataset.k}`)); }));
    const body = main.querySelector(".cmp-body");
    const isGames = tab === "games";
    const preset = [params && params.get("a"), params && params.get("b")].filter(Boolean);
    const inputs = (n) => Array.from({ length: n }, (_, i) => `<input class="rg-input cmp-in" placeholder="${isGames ? "Game link or place ID" : i === 0 && me ? `Player ${i + 1} (blank = you)` : `Player ${i + 1}`}" value="${R.esc(preset[i] || "")}">`).join("");
    const many = tab === "profiles" || tab === "games" || tab === "outfits";
    body.innerHTML = `<form class="rg-filterbar cmp-form">${inputs(many ? 3 : 2)}<button class="btn-primary-md">Compare</button></form><div class="cmp-out" style="margin-top:14px"></div>`;
    const out = body.querySelector(".cmp-out");
    const users = async () => {
      const vals = [...body.querySelectorAll(".cmp-in")].map((i, k) => i.value.trim() || (k === 0 && me ? String(me.id) : "")).filter(Boolean);
      if (vals.length < 2) throw new Error("Add at least two players");
      return Promise.all(vals.map(R.resolveUser));
    };
    body.querySelector(".cmp-form").onsubmit = async (e) => {
      e.preventDefault();
      out.innerHTML = loading("Comparing…");
      try {
        if (tab === "profiles") {
          const us = await users();
          const [a, b] = us;
          const [fa, fb] = await Promise.all([R.friendsOf(a.id), R.friendsOf(b.id)]);
          const common = fa.filter((x) => new Set(fb).has(x));
          const names = common.length ? await R.users(common.slice(0, 40)) : {};
          out.innerHTML = (await R.compareUsersHTML(us.map((u) => u.id)))
            + sec(`Mutual friends of ${R.esc(a.displayName)} and ${R.esc(b.displayName)}`, common.length ? `<div class="rg-people wrap">${common.slice(0, 40).map((id) => `<a class="rg-person sm" href="${RB}/users/${id}/profile"><img data-thumb="user:${id}" alt=""><div class="p-name">${R.esc(names[id]?.displayName || id)}</div></a>`).join("")}</div>${common.length > 40 ? `<p class="rg-note">and ${common.length - 40} more</p>` : ""}` : `<div class="rg-empty">No friends in common.</div>`, `<span class="rg-sub">${common.length}</span>`);
        } else if (tab === "badges") {
          const [a, b] = await users();
          const [la, lb] = await Promise.all([R.userBadges(a.id, 20), R.userBadges(b.id, 20)]);
          const sb = new Set(lb.map((x) => x.id)), sa = new Set(la.map((x) => x.id));
          const both = la.filter((x) => sb.has(x.id)), onlyA = la.filter((x) => !sb.has(x.id)), onlyB = lb.filter((x) => !sa.has(x.id));
          const rareBoth = both.filter((x) => x.statistics).sort((x, y) => x.statistics.winRatePercentage - y.statistics.winRatePercentage).slice(0, 10);
          const rareOf = (l) => l.filter((x) => x.statistics).sort((x, y) => x.statistics.winRatePercentage - y.statistics.winRatePercentage).slice(0, 8);
          const li = (l) => l.length ? `<div class="rg-list">${l.map((x) => `<a class="rg-li" href="${RB}/badges/${x.id}"><img class="rg-thumb" data-thumb="badge:${x.id}"><div class="rg-li-main"><b>${R.esc(x.name)}</b></div><span class="rg-li-end">${rarity(x.statistics?.winRatePercentage)}</span></a>`).join("")}</div>` : `<div class="rg-empty">None.</div>`;
          out.innerHTML = `<div class="rg-stats">${R.stat(a.displayName, R.fmt(la.length) + (la.length >= 2000 ? "+" : ""), "badges")}${R.stat(b.displayName, R.fmt(lb.length) + (lb.length >= 2000 ? "+" : ""), "badges")}${R.stat("In common", R.fmt(both.length))}${R.stat(`Only ${a.displayName}`, R.fmt(onlyA.length))}${R.stat(`Only ${b.displayName}`, R.fmt(onlyB.length))}</div>
            ${sec("Rarest badges you both have", li(rareBoth))}<div class="rg-2col">${sec(`Rarest only ${R.esc(a.displayName)} has`, li(rareOf(onlyA)))}${sec(`Rarest only ${R.esc(b.displayName)} has`, li(rareOf(onlyB)))}</div>`;
        } else if (tab === "inventory") {
          const [a, b] = await users();
          const [ia, ib] = await Promise.all([R.inventoryValue(a.id).catch(() => null), R.inventoryValue(b.id).catch(() => null)]);
          if (!ia || !ib) throw new Error(`${!ia ? a.displayName : b.displayName}'s inventory is private`);
          const setB = new Set(ib.items.map((x) => x.assetId)), common = [...new Map(ia.items.filter((x) => setB.has(x.assetId)).map((x) => [x.assetId, x])).values()];
          const top = (inv) => `<table class="rg-table"><tbody>${inv.items.slice(0, 10).map((x) => `<tr><td><img class="rg-thumb" data-thumb="asset:${x.assetId}"> <a href="${RB}/catalog/${x.assetId}">${R.esc(x.name)}</a></td><td class="rg-num">${R.robux(x.recentAveragePrice || 0)}</td></tr>`).join("")}</tbody></table>`;
          out.innerHTML = `<div class="rg-stats">${R.stat(`${a.displayName} RAP`, R.robux(ia.rap), `${R.fmt(ia.items.length)} limiteds`)}${R.stat(`${b.displayName} RAP`, R.robux(ib.rap), `${R.fmt(ib.items.length)} limiteds`)}${R.stat("Difference", R.robux(Math.abs(ia.rap - ib.rap)), ia.rap >= ib.rap ? `${a.displayName} is ahead` : `${b.displayName} is ahead`)}${R.stat("Items in common", R.fmt(common.length))}</div>
            <div class="rg-2col">${sec(`${R.esc(a.displayName)}'s most valuable`, top(ia))}${sec(`${R.esc(b.displayName)}'s most valuable`, top(ib))}</div>
            ${common.length ? sec("Limiteds they both own", `<div class="rg-chips">${common.slice(0, 40).map((x) => `<a class="rg-chip" href="${RB}/catalog/${x.assetId}">${R.esc(x.name)}</a>`).join("")}</div>`) : ""}`;
        } else if (tab === "outfits") {
          const us = await users();
          const os = await Promise.all(us.map((u) => R.outfitPrice(u.id).catch(() => ({ items: [], total: 0 }))));
          out.innerHTML = `<div class="rg-stats">${us.map((u, i) => R.stat(u.displayName, R.robux(os[i].total), `${os[i].items.length} items`)).join("")}</div>
            <div class="cmp-cols">${us.map((u, i) => sec(R.esc(u.displayName), `<div class="cmp-av"><img data-thumb="user:${u.id}" alt=""></div><table class="rg-table"><tbody>${os[i].items.map((it) => `<tr><td><a href="${RB}/catalog/${it.id}">${R.esc(it.name)}</a></td><td class="rg-num">${os[i].priceOf(it) ? R.robux(os[i].priceOf(it)) : `<span class="rg-mute">—</span>`}</td></tr>`).join("")}</tbody></table>`)).join("")}</div>`;
        } else if (tab === "games") {
          const vals = [...body.querySelectorAll(".cmp-in")].map((i) => (i.value.match(/\d{3,}/) || [])[0]).filter(Boolean);
          if (vals.length < 2) throw new Error("Add at least two games");
          const uids = await Promise.all(vals.map((p) => R.universeOf(Number(p))));
          const [gs, votes] = await Promise.all([R.games(uids), R.votes(uids)]);
          const by = Object.fromEntries(gs.map((g) => [g.id, g]));
          const hist = await Promise.all(uids.map((u) => R.hist(`game:${u}`)));
          const wk = (h, cur) => { const old = h.find((p) => Date.now() - p.t < 8 * 864e5); return old && old.visits ? cur - old.visits : null; };
          const rows = [["Playing now", (g) => R.fmt(g.playing)], ["Visits", (g) => R.fmt(g.visits)], ["Visits this week (seen)", (g, i) => { const d = wk(hist[i], g.visits); return d == null ? `<span class="rg-mute">—</span>` : "+" + R.fmt(d); }],
            ["Favorites", (g) => R.fmt(g.favoritedCount)], ["Likes", (g) => { const v = votes[g.id]; return v && v.upVotes + v.downVotes ? Math.round((v.upVotes / (v.upVotes + v.downVotes)) * 100) + "%" : "—"; }],
            ["Max players", (g) => R.fmt(g.maxPlayers)], ["Genre", (g) => R.esc(g.genre || "—")], ["Creator", (g) => R.esc(g.creator?.name || "—")], ["Created", (g) => R.date(g.created)], ["Last update", (g) => R.ago(g.updated)]];
          out.innerHTML = `<div class="rg-table-wrap"><table class="rg-table"><thead><tr><th></th>${uids.map((u) => `<th><img class="rg-thumb" data-thumb="game:${u}"> <a href="${RB}/games/${by[u]?.rootPlaceId}">${R.esc(by[u]?.name || u)}</a></th>`).join("")}</tr></thead>
            <tbody>${rows.map(([l, f]) => `<tr><td class="rg-mute">${l}</td>${uids.map((u, i) => `<td style="font-weight:600">${by[u] ? f(by[u], i) : "—"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
            <p class="rg-note">"Seen" numbers come from what RoGen recorded when you opened these games. Track a game in Tracker to record it every 30 minutes.</p>`;
        }
        R.fillThumbs(out);
      } catch (err) { out.innerHTML = R.errBox(err); }
    };
    if (preset.length >= 2) body.querySelector(".cmp-form").requestSubmit();
  }

  /* =================== Tracker + Timeline =================== */
  async function tracker(main, q, params) {
    const tab = tabsFrom(params, "timeline");
    main.innerHTML = head("Tracker", "Keep an eye on profiles, communities, games and items. RoGen checks them every 30 minutes while Chrome is open.")
      + `<div class="rg-row space" style="margin-bottom:12px">${seg("trk-tabs", [["timeline", "Timeline"], ["tracking", "What you track"]], tab)}<span class="rg-row"><span class="rg-mute trk-last"></span><button class="btn-control-sm trk-now">Check now</button></span></div><div class="trk-body"></div>`;
    main.querySelectorAll(".trk-tabs [data-k]").forEach((b) => (b.onclick = () => { setTab("tracker", b.dataset.k); tracker(main, q, new URLSearchParams(`tab=${b.dataset.k}`)); }));
    const last = await R.get1("trackerLast", 0);
    main.querySelector(".trk-last").textContent = last ? `Last checked ${R.ago(last)}` : "Not checked yet";
    main.querySelector(".trk-now").onclick = async (e) => { e.target.disabled = true; e.target.textContent = "Checking…"; await R.send({ type: "runTracker" }); tracker(main, q, params); };
    const body = main.querySelector(".trk-body");
    if (tab === "tracking") return trackingTab(body, () => tracker(main, q, params));
    // Timeline: what the tracker saw + changes RoGen noticed while you browsed
    body.innerHTML = loading();
    const tl = await R.get1("timeline", []);
    const all = await new Promise((res) => chrome.storage.local.get(null, res));
    const seen = [];
    for (const k in all) {
      const m = k.match(/^hist:(userText|gameText):(\d+)$/);
      if (!m || !Array.isArray(all[k])) continue;
      const list = all[k];
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1], b = list[i], id = Number(m[2]);
        if (m[1] === "userText") {
          const url = `${RB}/users/${id}/profile`;
          if (a.name !== b.name) seen.push({ t: b.t, kind: "user", id, name: b.displayName, text: `changed username from @${a.name} to @${b.name}`, url });
          if (a.displayName !== b.displayName) seen.push({ t: b.t, kind: "user", id, name: b.displayName, text: `changed display name from "${a.displayName}"`, url });
          if (a.description !== b.description) seen.push({ t: b.t, kind: "user", id, name: b.displayName, text: "changed their bio", url, detail: (b.description || "").slice(0, 200) });
        } else {
          const url = `${RB}/games/${id}`;
          if (a.name !== b.name) seen.push({ t: b.t, kind: "game", id, name: b.name, text: `was renamed from "${a.name}"`, url: null, uid: id });
          if (a.updated !== b.updated) seen.push({ t: b.t, kind: "game", id, name: b.name, text: "was updated", url: null, uid: id });
        }
      }
    }
    const keyOf = (e) => `${e.kind}|${e.id}|${e.text}`;
    const have = new Set(tl.map(keyOf));
    const events = [...tl, ...seen.filter((e) => !have.has(keyOf(e)))].sort((a, b) => b.t - a.t).slice(0, 400);
    let filter = "all";
    const KINDS = [["all", "Everything"], ["user", "Profiles"], ["group", "Communities"], ["game", "Games"], ["item", "Items"], ["mine", "You & friends"]];
    const draw = () => {
      const l = events.filter((e) => filter === "all" || (filter === "mine" ? e.mine || e.kind === "friend" || e.kind === "badge" || e.kind === "me" : e.kind === filter));
      let day = "";
      body.innerHTML = `<div class="rg-chips" style="margin-bottom:12px">${KINDS.map(([k, n]) => `<button class="rg-chip ${k === filter ? "on" : ""}" data-f="${k}">${n}</button>`).join("")}</div>`
        + (l.length ? `<div class="tl">${l.map((e) => { const d = new Date(e.t).toDateString(); const hdr = d !== day ? `<div class="tl-day">${R.date(e.t)}</div>` : ""; day = d;
            const th = e.kind === "game" ? `game:${e.uid || e.id}` : e.kind === "group" ? `group:${e.id}` : e.kind === "item" ? `asset:${e.id}` : e.kind === "badge" ? `badge:${e.id}` : `user:${e.id}`;
            return `${hdr}<div class="tl-row"><img class="rg-thumb ${/user|friend/.test(e.kind) ? "round" : ""}" data-thumb="${th}" alt=""><div class="tl-main"><b>${e.url ? `<a href="${e.url}">${R.esc(e.name || "")}</a>` : R.esc(e.name || "")}</b> ${R.esc(e.text)}${e.detail ? `<div class="tl-detail">${R.esc(e.detail)}</div>` : ""}</div><span class="tl-t">${new Date(e.t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span></div>`; }).join("")}</div>`
          : `<div class="rg-empty">Nothing yet. Track something with the RoGen Info button on any profile, community, game or limited, or in "What you track". Changes show up here.</div>`);
      body.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { filter = b.dataset.f; draw(); }));
      R.fillThumbs(body);
    };
    draw();
  }
  async function trackingTab(body, refresh) {
    const t = await R.tracker.all(), st = await R.get1("trkState", {});
    const block = (kind, title, rows, emptyText) => sec(title, rows.length ? `<table class="rg-table"><tbody>${rows.join("")}</tbody></table>` : `<div class="rg-empty">${emptyText}</div>`, `<span class="rg-sub">${rows.length}</span>`);
    const rm = (kind, id) => `<button class="btn-control-sm tk-rm" data-kind="${kind}" data-id="${id}">Stop</button>`;
    const users = Object.entries(t.users).map(([id, x]) => { const s = st["u:" + id]; return `<tr><td><img class="rg-thumb round" data-thumb="user:${id}"> <a href="${RB}/users/${id}/profile">${R.esc(x.name || id)}</a>${s ? ` <span class="rg-mute">@${R.esc(s.name)}</span>` : ""}</td><td class="rg-num rg-mute">${s && s.fo != null ? R.fmt(s.fo) + " followers" : "Waiting for first check"}</td><td class="rg-num">${rm("users", id)}</td></tr>`; });
    const groups = Object.entries(t.groups).map(([id, x]) => { const s = st["g:" + id]; return `<tr><td><img class="rg-thumb" data-thumb="group:${id}"> <a href="${RB}/communities/${id}">${R.esc(x.name || id)}</a></td><td class="rg-num rg-mute">${s ? `${R.fmt(s.members)} members · owner @${R.esc(s.ownerName || "none")}` : "Waiting for first check"}</td><td class="rg-num">${rm("groups", id)}</td></tr>`; });
    const games = Object.entries(t.games).map(([id, x]) => { const s = st["gm:" + id]; return `<tr><td><img class="rg-thumb" data-thumb="game:${id}"> <a href="${RB}/games/${x.placeId || ""}">${R.esc(x.name || id)}</a></td><td class="rg-num rg-mute">${s ? `${R.short(s.visits)} visits · ${R.fmt(s.playing)} playing · updated ${R.ago(s.updated)}` : "Waiting for first check"}</td><td class="rg-num">${rm("games", id)}</td></tr>`; });
    const items = Object.entries(t.items).map(([id, x]) => { const s = st["it:" + id]; return `<tr><td><img class="rg-thumb" data-thumb="asset:${id}"> <a href="${RB}/catalog/${id}">${R.esc(x.name || id)}</a></td><td class="rg-num rg-mute">${s ? `RAP ${R.robux(s.rap)}` : "Waiting for first check"} · alert at <input class="rg-input tk-pct" data-id="${id}" type="number" min="1" max="90" value="${x.pct || 10}" style="width:60px;height:28px">%</td><td class="rg-num">${rm("items", id)}</td></tr>`; });
    body.innerHTML = `<form class="rg-filterbar tk-add"><input class="rg-input" placeholder="Paste a profile, community, game or limited item link" style="flex:1;min-width:260px"><button class="btn-primary-md">Track</button></form>
      <div style="margin-top:14px">${block("users", "Profiles", users, "Track a profile to hear about name, bio and follower changes.")}${block("groups", "Communities", groups, "Track a community to hear when the owner, name or shout changes.")}${block("games", "Games", games, "Track a game for updates, visit milestones, player records and events.")}${block("items", "Items", items, "Track a limited to hear when its RAP moves.")}</div>`;
    R.fillThumbs(body);
    body.querySelectorAll(".tk-rm").forEach((b) => (b.onclick = async () => { await R.tracker.toggle(b.dataset.kind, b.dataset.id); refresh(); }));
    body.querySelectorAll(".tk-pct").forEach((i) => (i.onchange = async () => { const all = await R.tracker.all(); if (all.items[i.dataset.id]) { all.items[i.dataset.id].pct = Math.max(1, Math.min(90, Number(i.value) || 10)); await R.set({ trk: all }); R.toast("Saved"); } }));
    body.querySelector(".tk-add").onsubmit = async (e) => {
      e.preventDefault();
      const v = e.target.querySelector("input").value.trim();
      let m;
      try {
        if ((m = v.match(/users\/(\d+)/))) { const u = await R.api(`https://users.roblox.com/v1/users/${m[1]}`); await R.tracker.toggle("users", u.id, { name: u.displayName }); }
        else if ((m = v.match(/(?:groups|communities)\/(\d+)/))) { const g = await R.api(`https://groups.roblox.com/v1/groups/${m[1]}`); await R.tracker.toggle("groups", g.id, { name: g.name }); }
        else if ((m = v.match(/games\/(\d+)/))) { const uid = await R.universeOf(Number(m[1])); const g = (await R.games([uid]))[0]; await R.tracker.toggle("games", uid, { name: g ? g.name : "Game", placeId: Number(m[1]) }); }
        else if ((m = v.match(/catalog\/(\d+)/))) { const d = await R.api(`https://economy.roblox.com/v2/assets/${m[1]}/details`); await R.tracker.toggle("items", Number(m[1]), { name: d.Name, pct: 10 }); }
        else if (v) { const u = await R.resolveUser(v); await R.tracker.toggle("users", u.id, { name: u.displayName }); }
        else return;
        R.toast("Tracking"); R.send({ type: "runTracker" }); refresh();
      } catch (err) { R.toast("Couldn't add that: " + err.message); }
    };
  }

  /* =================== Vault =================== */
  async function vault(main) {
    const v = await R.vault.all();
    main.innerHTML = head("Vault", "Your saved profiles, games, developers and wishlist, plus bookmark folders, Roblox favorites, notes and recently viewed.")
      + `<div class="rg-2col">${sec("Profiles", `<div class="v-users"></div>`, `<span class="rg-sub">${v.users.length}</span>`)}${sec("Developers", `<form class="rg-row v-devadd"><input class="rg-input" placeholder="Add a player or community link" style="flex:1"><button class="btn-control-sm">Add</button></form><div class="v-devs" style="margin-top:10px"></div>`, `<span class="rg-sub">${v.devs.length}</span>`)}</div>`
      + sec("Games", `<div class="v-games"></div>`, `<span class="rg-sub">${v.games.length}</span>`)
      + sec("Wishlist", `<div class="v-wish">${loading()}</div>`, `<span class="rg-sub">${v.wish.length}</span>`)
      + `<div class="vault-lib"></div>`;
    const x = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
    const rmBtn = (kind, id) => `<button class="v-rm" data-kind="${kind}" data-id="${R.esc(id)}" title="Remove" aria-label="Remove">${x}</button>`;
    main.querySelector(".v-users").innerHTML = v.users.length ? `<div class="rg-list">${v.users.map((u) => `<div class="rg-li"><img class="rg-thumb round" data-thumb="user:${u.id}"><div class="rg-li-main"><b><a href="${RB}/users/${u.id}/profile">${R.esc(u.name)}</a></b><small>${u.username ? "@" + R.esc(u.username) : ""} · <a class="rg-link" href="#id?q=${u.id}">RoGen ID</a></small></div>${rmBtn("users", u.id)}</div>`).join("")}</div>` : `<div class="rg-empty">Save profiles from RoGen ID or the Info button on any profile.</div>`;
    main.querySelector(".v-games").innerHTML = v.games.length ? R.tileGrid(v.games.map((g) => R.gameTile({ universeId: g.id, placeId: g.placeId, name: g.name, players: null, up: 0, down: 0, extra: `Saved ${R.ago(g.at)}`, corner: `<button class="rg-tile-x v-rm" data-kind="games" data-id="${g.id}" title="Remove">✕</button>` })).join("")) : `<div class="rg-empty">Save games with the Info button on any game page.</div>`;
    // developers: their games
    const devEl = main.querySelector(".v-devs");
    const drawDevs = async () => {
      const vv = await R.vault.all();
      devEl.innerHTML = vv.devs.length ? `<div class="rg-list">${vv.devs.map((d) => `<div class="rg-li"><img class="rg-thumb ${d.type === "User" ? "round" : ""}" data-thumb="${d.type === "User" ? "user:" + d.uid : "group:" + d.gid}"><div class="rg-li-main"><b><a href="${d.type === "User" ? `${RB}/users/${d.uid}/profile` : `${RB}/communities/${d.gid}`}">${R.esc(d.name)}</a></b><small class="v-devg" data-k="${R.esc(d.id)}">Loading games…</small></div>${rmBtn("devs", d.id)}</div>`).join("")}</div>` : `<div class="rg-empty">Add developers to see their games here.</div>`;
      R.fillThumbs(devEl);
      for (const d of vv.devs) {
        const url = d.type === "User" ? `https://games.roblox.com/v2/users/${d.uid}/games?accessFilter=2&limit=50&sortOrder=Desc` : `https://games.roblox.com/v2/groups/${d.gid}/gamesV2?accessFilter=2&limit=50&sortOrder=Desc`;
        R.api(url).then(async (r) => {
          const det = (r.data || []).length ? await R.games(r.data.map((g) => g.id)) : [];
          const newest = det.sort((a, b) => new Date(b.updated) - new Date(a.updated))[0];
          const el = devEl.querySelector(`.v-devg[data-k="${CSS.escape(String(d.id))}"]`);
          if (el) el.innerHTML = det.length ? `${det.length} games · ${R.short(det.reduce((t, g) => t + g.visits, 0))} visits · latest update: <a href="${RB}/games/${newest.rootPlaceId}">${R.esc(newest.name)}</a> ${R.ago(newest.updated)}` : "No public games";
        }).catch(() => {});
      }
    };
    drawDevs();
    main.querySelector(".v-devadd").onsubmit = async (e) => {
      e.preventDefault();
      const val = e.target.querySelector("input").value.trim();
      try {
        const m = val.match(/(?:groups|communities)\/(\d+)/);
        if (m) { const g = await R.api(`https://groups.roblox.com/v1/groups/${m[1]}`); await R.vault.toggle("devs", { id: "g" + g.id, gid: g.id, name: g.name, type: "Group" }); }
        else { const u = await R.resolveUser(val); await R.vault.toggle("devs", { id: "u" + u.id, uid: u.id, name: u.displayName, type: "User" }); }
        e.target.querySelector("input").value = ""; drawDevs();
      } catch (err) { R.toast(err.message); }
    };
    // wishlist with live prices
    (async () => {
      const el = main.querySelector(".v-wish");
      if (!v.wish.length) { el.innerHTML = `<div class="rg-empty">Add items to your wishlist with the Info button on any catalog item.</div>`; return; }
      const det = await R.catalogDetails(v.wish.filter((w) => w.type !== "Bundle").map((w) => w.id));
      const total = v.wish.reduce((t, w) => t + (det[w.id]?.price || det[w.id]?.lowestPrice || 0), 0);
      el.innerHTML = `<div class="rg-stats" style="margin-bottom:10px">${R.stat("Items", R.fmt(v.wish.length))}${R.stat("Total to buy it all", R.robux(total))}</div>
        <table class="rg-table"><thead><tr><th>Item</th><th class="rg-num">Price</th><th class="rg-num">Cheapest copy</th><th></th></tr></thead><tbody>${v.wish.map((w) => { const d = det[w.id] || {}; const lim = (d.itemRestrictions || []).some((r) => /limited|collectible/i.test(r));
          return `<tr><td><img class="rg-thumb" data-thumb="${w.type === "Bundle" ? "bundle" : "asset"}:${w.id}"> <a href="${RB}/${w.type === "Bundle" ? "bundles" : "catalog"}/${w.id}">${R.esc(w.name)}</a>${lim ? ` <span class="rg-badge">Limited</span>` : ""}</td><td class="rg-num">${d.price != null && d.priceStatus !== "Off Sale" ? R.robux(d.price) : `<span class="rg-mute">Off sale</span>`}</td><td class="rg-num">${d.lowestPrice ? R.robux(d.lowestPrice) : "—"}</td><td class="rg-num">${rmBtn("wish", w.id)}</td></tr>`; }).join("")}</tbody></table>`;
      R.fillThumbs(el);
    })();
    main.onclick = async (e) => { const b = e.target.closest(".v-rm"); if (!b) return; e.preventDefault(); const vv = await R.vault.all(); const entry = vv[b.dataset.kind].find((x) => String(x.id) === b.dataset.id); if (entry) await R.vault.toggle(b.dataset.kind, entry); vault(main); };
    R.fillThumbs(main);
    // the old Library sections (folders, Roblox favorites, notes, recently viewed) live underneath
    if (R.libraryOld) R.libraryOld(main.querySelector(".vault-lib"));
  }

  /* =================== Inventory =================== */
  async function inventory(main, q, params) {
    const me = meOrAsk(main); if (!me) return;
    const tab = tabsFrom(params, "limiteds");
    main.innerHTML = head("Inventory", "Your limiteds with filters, duplicates, value history and profit or loss, plus every item you own searchable by price.")
      + seg("inv-tabs", [["limiteds", "Limiteds"], ["pl", "Profit & loss"], ["all", "All items"]], tab) + `<div class="inv-body" style="margin-top:14px">${loading("Reading your inventory…")}</div>`;
    main.querySelectorAll(".inv-tabs [data-k]").forEach((b) => (b.onclick = () => { setTab("inventory", b.dataset.k); inventory(main, q, new URLSearchParams(`tab=${b.dataset.k}`)); }));
    const body = main.querySelector(".inv-body");
    if (tab === "all") return allItems(body, me);
    let inv;
    try { inv = await R.inventoryValue(me.id, (all) => { if (body.isConnected) body.innerHTML = loading(`Reading your inventory… ${all.length}`); }); }
    catch (e) { body.innerHTML = e.status === 403 ? `<div class="rg-empty">Your inventory is private. Make it visible in Roblox privacy settings so RoGen can read it.</div>` : R.errBox(e); return; }
    R.snap(`rap:${me.id}`, { rap: inv.rap }, { every: 12 * 3600e3 });
    const det = await R.catalogDetails([...new Set(inv.items.map((x) => x.assetId))]);
    const items = inv.items.map((x) => ({ ...x, copies: det[x.assetId]?.totalQuantity || null, lowest: det[x.assetId]?.lowestPrice || null, type: det[x.assetId]?.assetType }));
    const counts = {}; items.forEach((x) => (counts[x.assetId] = (counts[x.assetId] || 0) + 1));
    if (tab === "pl") return profitLoss(body, me, items);
    const hist = await R.hist(`rap:${me.id}`);
    body.innerHTML = `<div class="rg-stats">${R.stat("Total RAP", R.robux(inv.rap))}${R.stat("Limiteds", R.fmt(items.length))}${R.stat("Different items", R.fmt(Object.keys(counts).length))}${R.stat("Duplicates", R.fmt(Object.values(counts).filter((c) => c > 1).reduce((t, c) => t + c - 1, 0)))}</div>
      <div style="margin:14px 0">${R.chart(hist.map((p) => ({ t: p.t, v: p.rap })), { label: "Inventory value (RAP)", money: true })}</div>
      <div class="rg-filterbar"><label class="rg-field">Search<input class="rg-input iv-q" placeholder="Item name"></label>
        <label class="rg-field">Sort<select class="rg-select iv-sort"><option value="rap">Most valuable</option><option value="rapAsc">Least valuable</option><option value="rare">Rarest (fewest copies)</option><option value="name">Name</option><option value="serial">Serial number</option></select></label>
        <label class="rg-field">Min RAP<input class="rg-input iv-min" type="number" min="0" style="width:110px"></label><label class="rg-field">Max RAP<input class="rg-input iv-max" type="number" min="0" style="width:110px"></label>
        <label class="rg-check"><input type="checkbox" class="iv-dup"> Duplicates only</label></div>
      <div class="iv-out" style="margin-top:12px"></div>`;
    const $ = (s) => body.querySelector(s);
    const draw = () => {
      const qq = $(".iv-q").value.trim().toLowerCase(), min = Number($(".iv-min").value) || 0, max = Number($(".iv-max").value) || Infinity, dup = $(".iv-dup").checked, sort = $(".iv-sort").value;
      let l = items.filter((x) => (!qq || x.name.toLowerCase().includes(qq)) && (x.recentAveragePrice || 0) >= min && (x.recentAveragePrice || 0) <= max && (!dup || counts[x.assetId] > 1));
      const S = { rap: (a, b) => (b.recentAveragePrice || 0) - (a.recentAveragePrice || 0), rapAsc: (a, b) => (a.recentAveragePrice || 0) - (b.recentAveragePrice || 0), rare: (a, b) => (a.copies || 1e12) - (b.copies || 1e12), name: (a, b) => a.name.localeCompare(b.name), serial: (a, b) => (a.serialNumber || 1e12) - (b.serialNumber || 1e12) };
      l.sort(S[sort]);
      $(".iv-out").innerHTML = l.length ? `<div class="rg-table-wrap"><table class="rg-table"><thead><tr><th>Item</th><th class="rg-num">RAP</th><th class="rg-num">Cheapest copy</th><th class="rg-num">Copies</th><th class="rg-num">Serial</th></tr></thead><tbody>${l.slice(0, 500).map((x) => `<tr><td><img class="rg-thumb" data-thumb="asset:${x.assetId}"> <a href="${RB}/catalog/${x.assetId}">${R.esc(x.name)}</a>${counts[x.assetId] > 1 ? ` <span class="rg-badge">×${counts[x.assetId]}</span>` : ""}</td><td class="rg-num">${R.robux(x.recentAveragePrice || 0)}</td><td class="rg-num">${x.lowest ? R.robux(x.lowest) : "—"}</td><td class="rg-num">${x.copies ? R.fmt(x.copies) : "—"}</td><td class="rg-num">${x.serialNumber ? "#" + R.fmt(x.serialNumber) : "—"}</td></tr>`).join("")}</tbody></table></div>` : `<div class="rg-empty">No limiteds match.</div>`;
      R.fillThumbs($(".iv-out"));
    };
    body.querySelectorAll(".iv-q, .iv-min, .iv-max").forEach((i) => (i.oninput = draw));
    body.querySelectorAll(".iv-sort, .iv-dup").forEach((i) => (i.onchange = draw));
    draw();
  }
  async function profitLoss(body, me, items) {
    const tx = await R.get1("tx", []);
    if (!tx.length) { body.innerHTML = `<div class="rg-empty">RoGen needs your purchase history for this. Open <a class="rg-link" href="#spending">Wallet</a> and press Sync purchases, then come back.</div>`; return; }
    const paid = {};
    tx.forEach((x) => { const id = x.details && (x.details.type === "Asset" || !x.details.type) ? x.details.id : null; if (id) (paid[id] = paid[id] || []).push(R.spent(x)); });
    const rows = items.map((x) => { const p = paid[x.assetId] && paid[x.assetId].length ? paid[x.assetId].shift() : null; return { ...x, paid: p }; });
    const known = rows.filter((r) => r.paid != null), unknown = rows.filter((r) => r.paid == null);
    const cost = known.reduce((t, r) => t + r.paid, 0), worth = known.reduce((t, r) => t + (r.recentAveragePrice || 0), 0);
    known.sort((a, b) => ((b.recentAveragePrice || 0) - b.paid) - ((a.recentAveragePrice || 0) - a.paid));
    const pl = (r) => { const d = (r.recentAveragePrice || 0) - r.paid; return `<span class="${d >= 0 ? "rg-good" : "rg-bad"}">${d >= 0 ? "+" : "−"}${R.robux(Math.abs(d))}</span>`; };
    body.innerHTML = `<div class="rg-stats">${R.stat("You paid", R.robux(cost), `${known.length} limiteds bought with Robux`)}${R.stat("Worth now (RAP)", R.robux(worth))}${R.stat("Profit / loss", `<span class="${worth - cost >= 0 ? "rg-good" : "rg-bad"}">${worth - cost >= 0 ? "+" : "−"}${R.robux(Math.abs(worth - cost))}</span>`, cost ? R.pctText(worth, cost) : "")}${R.stat("Traded or not found", R.fmt(unknown.length), "No Robux purchase found")}</div>
      ${known.length ? `<div class="rg-table-wrap" style="margin-top:14px"><table class="rg-table"><thead><tr><th>Item</th><th class="rg-num">Paid</th><th class="rg-num">RAP now</th><th class="rg-num">Profit / loss</th></tr></thead><tbody>${known.map((r) => `<tr><td><img class="rg-thumb" data-thumb="asset:${r.assetId}"> <a href="${RB}/catalog/${r.assetId}">${R.esc(r.name)}</a></td><td class="rg-num">${R.robux(r.paid)}</td><td class="rg-num">${R.robux(r.recentAveragePrice || 0)}</td><td class="rg-num">${pl(r)}</td></tr>`).join("")}</tbody></table></div>` : ""}
      <p class="rg-note">Matched against the purchases RoGen synced in Wallet. Items you got from trades don't have a Robux price, so they're counted separately.</p>`;
    R.fillThumbs(body);
  }
  const ALL_TYPES = [["Hat", "Hats"], ["HairAccessory", "Hair"], ["FaceAccessory", "Face accessories"], ["NeckAccessory", "Neck"], ["ShoulderAccessory", "Shoulder"], ["FrontAccessory", "Front"], ["BackAccessory", "Back"], ["WaistAccessory", "Waist"], ["Shirt", "Shirts"], ["Pants", "Pants"], ["TShirt", "T-Shirts"], ["Face", "Faces"], ["Gear", "Gear"], ["EmoteAnimation", "Emotes"]];
  async function allItems(body, me) {
    body.innerHTML = `<div class="rg-filterbar"><label class="rg-field">Type<select class="rg-select ai-type">${ALL_TYPES.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
      <label class="rg-field">Search<input class="rg-input ai-q" placeholder="Item name"></label><label class="rg-field">Min price<input class="rg-input ai-min" type="number" min="0" style="width:100px"></label><label class="rg-field">Max price<input class="rg-input ai-max" type="number" min="0" style="width:100px"></label>
      <label class="rg-field">Show<select class="rg-select ai-show"><option value="">Everything</option><option value="lim">Limiteds only</option><option value="off">Off-sale only</option><option value="free">Free items</option></select></label>
      <label class="rg-field">Sort<select class="rg-select ai-sort"><option value="new">Newest first</option><option value="hi">Price: high to low</option><option value="lo">Price: low to high</option><option value="name">Name</option></select></label></div><div class="ai-out" style="margin-top:12px"></div>`;
    const $ = (s) => body.querySelector(s);
    let list = [];
    const load = async () => {
      $(".ai-out").innerHTML = loading();
      try {
        const type = $(".ai-type").value;
        const raw = await R.pages((c) => `https://inventory.roblox.com/v2/users/${me.id}/inventory?assetTypes=${type}&limit=100&sortOrder=Desc${c ? `&cursor=${encodeURIComponent(c)}` : ""}`, { max: 10 });
        const det = await R.catalogDetails([...new Set(raw.map((x) => x.assetId))]);
        list = raw.map((x, i) => { const d = det[x.assetId] || {}; return { id: x.assetId, name: x.assetName, i, price: d.price ?? d.lowestPrice ?? null, off: d.priceStatus === "Off Sale" || d.price == null, lim: (d.itemRestrictions || []).some((r) => /limited|collectible/i.test(r)), creator: d.creatorName || "" }; });
        draw();
      } catch (e) { $(".ai-out").innerHTML = e.status === 403 ? `<div class="rg-empty">Your inventory is private.</div>` : R.errBox(e); }
    };
    const draw = () => {
      const qq = $(".ai-q").value.trim().toLowerCase(), min = Number($(".ai-min").value) || 0, max = $(".ai-max").value === "" ? Infinity : Number($(".ai-max").value), show = $(".ai-show").value, sort = $(".ai-sort").value;
      let l = list.filter((x) => (!qq || x.name.toLowerCase().includes(qq)) && (x.price == null ? min === 0 : x.price >= min && x.price <= max) && (!show || (show === "lim" ? x.lim : show === "off" ? x.off : x.price === 0)));
      l.sort({ new: (a, b) => a.i - b.i, hi: (a, b) => (b.price || 0) - (a.price || 0), lo: (a, b) => (a.price || 0) - (b.price || 0), name: (a, b) => a.name.localeCompare(b.name) }[sort]);
      const worth = l.reduce((t, x) => t + (x.price || 0), 0);
      $(".ai-out").innerHTML = `<p class="rg-mute" style="margin:0 0 8px">${R.fmt(l.length)} items · worth about ${R.robux(worth)} at today's prices</p>` + (l.length ? `<div class="rg-table-wrap"><table class="rg-table"><tbody>${l.slice(0, 600).map((x) => `<tr><td><img class="rg-thumb" data-thumb="asset:${x.id}"> <a href="${RB}/catalog/${x.id}">${R.esc(x.name)}</a>${x.lim ? ` <span class="rg-badge">Limited</span>` : ""}<div class="rg-mute" style="font-size:12px">${R.esc(x.creator)}</div></td><td class="rg-num">${x.price == null ? `<span class="rg-mute">Off sale</span>` : x.price === 0 ? "Free" : R.robux(x.price)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="rg-empty">Nothing matches.</div>`);
      R.fillThumbs($(".ai-out"));
    };
    $(".ai-type").onchange = load;
    body.querySelectorAll(".ai-q, .ai-min, .ai-max").forEach((i) => (i.oninput = draw));
    body.querySelectorAll(".ai-show, .ai-sort").forEach((i) => (i.onchange = draw));
    load();
  }

  /* =================== Badges: collection, rarity, progress, showcase =================== */
  async function collection(main, q) {
    const me = R.me();
    main.innerHTML = head("Badges", "Your badge collection: what you earned recently, your rarest badges, which games you're closest to finishing, and your showcase.")
      + `<div class="bc-out">${loading("Reading your badges…")}</div>`;
    const out = main.querySelector(".bc-out");
    let uid = me && me.id, who = "You";
    try { if (q) { const u = await R.resolveUser(q); uid = u.id; who = u.displayName; } } catch (e) { out.innerHTML = R.errBox(e); return; }
    if (!uid) { out.innerHTML = `<div class="rg-empty">Log in first.</div>`; return; }
    let list;
    try { list = await R.userBadges(uid, 20, (all) => { if (out.isConnected) out.innerHTML = loading(`Reading badges… ${all.length}`); }); }
    catch (e) { out.innerHTML = R.errBox(e); return; }
    if (!list.length) { out.innerHTML = `<div class="rg-empty">No public badges.</div>`; return; }
    const recentIds = list.slice(0, 60).map((b) => b.id);
    const dates = await R.awardedDates(uid, recentIds);
    const recent = list.slice(0, 60).filter((b) => dates[b.id]).sort((a, b) => new Date(dates[b.id]) - new Date(dates[a.id])).slice(0, 12);
    const rated = list.filter((b) => b.statistics && b.statistics.winRatePercentage != null);
    const rare = [...rated].sort((a, b) => a.statistics.winRatePercentage - b.statistics.winRatePercentage).slice(0, 15);
    // group by game (awarder = place)
    const byGame = {};
    list.forEach((b) => { const k = b.awarder && b.awarder.id; if (!k) return; (byGame[k] = byGame[k] || { place: k, n: 0, rarest: 100, badges: [] }); byGame[k].n++; byGame[k].badges.push(b); if (b.statistics) byGame[k].rarest = Math.min(byGame[k].rarest, b.statistics.winRatePercentage); });
    const games = Object.values(byGame).sort((a, b) => b.n - a.n);
    const year = new Date().getFullYear();
    const show = await R.get1("showcase", []);
    const pinned = new Set(show.map((s) => s.id));
    out.innerHTML = `<div class="rg-stats">${R.stat("Badges", R.fmt(list.length) + (list.length >= 2000 ? "+" : ""))}${R.stat("Games", R.fmt(games.length))}${R.stat(`Earned in ${year}`, R.fmt(Object.values(dates).filter((d) => new Date(d).getFullYear() === year).length) + (list.length > 60 ? "+" : ""), "of your 60 newest")}${R.stat("Rarest", rare[0] ? rarity(rare[0].statistics.winRatePercentage) : "—", rare[0] ? R.esc(rare[0].name) : "")}</div>
      ${uid === (me && me.id) ? sec("Showcase", show.length ? `<div class="sc-row">${show.map((b) => `<a class="sc-b" href="${RB}/badges/${b.id}"><img data-thumb="badge:${b.id}" alt=""><span>${R.esc(b.name)}</span><small>${b.rate != null ? rarity(b.rate) : ""}</small></a>`).join("")}</div>` : `<div class="rg-empty">Pin up to 8 badges below with the pin button. They show on your dashboard.</div>`, `<span class="rg-sub">${show.length}/8</span>`) : ""}
      <div class="rg-2col">${sec("Recently earned", recent.length ? `<div class="rg-list">${recent.map((b) => `<a class="rg-li" href="${RB}/badges/${b.id}"><img class="rg-thumb" data-thumb="badge:${b.id}"><div class="rg-li-main"><b>${R.esc(b.name)}</b><small>${R.ago(dates[b.id])}</small></div><span class="rg-li-end">${rarity(b.statistics?.winRatePercentage)}</span></a>`).join("")}</div>` : `<div class="rg-empty">No dates available.</div>`)}
        ${sec("Rarest badges", rare.length ? `<div class="rg-list">${rare.map((b) => `<div class="rg-li"><img class="rg-thumb" data-thumb="badge:${b.id}"><div class="rg-li-main"><b><a href="${RB}/badges/${b.id}">${R.esc(b.name)}</a></b><small>${R.esc(R.rarityWord(b.statistics.winRatePercentage))} · ${R.fmt(b.statistics.awardedCount || 0)} have it</small></div><span class="rg-li-end">${rarity(b.statistics.winRatePercentage)}</span>${uid === (me && me.id) ? `<button class="bc-pin ${pinned.has(b.id) ? "on" : ""}" data-id="${b.id}" data-name="${R.esc(b.name)}" data-rate="${b.statistics.winRatePercentage}" title="${pinned.has(b.id) ? "Unpin" : "Pin to showcase"}">${R.ic('<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>', 15)}</button>` : ""}</div>`).join("")}</div>` : `<div class="rg-empty">Roblox didn't share rarity for these badges.</div>`)}</div>
      ${sec("Progress by game", `<div class="bc-prog">${loading("Counting each game's badges…")}</div>`)}
      ${sec("Games with your rarest badges", `<div class="bc-rgames">${loading()}</div>`)}
      <p class="rg-note"><a class="rg-link" href="#compare?tab=badges">Compare your badges with a friend →</a></p>`;
    R.fillThumbs(out);
    out.querySelectorAll(".bc-pin").forEach((b) => (b.onclick = async () => {
      let s = await R.get1("showcase", []);
      const id = Number(b.dataset.id);
      if (s.some((x) => x.id === id)) s = s.filter((x) => x.id !== id); else { if (s.length >= 8) return R.toast("Your showcase holds 8 badges. Unpin one first."); s.push({ id, name: b.dataset.name, rate: Number(b.dataset.rate) }); }
      await R.set({ showcase: s }); collection(main, q);
    }));
    // progress: your badges vs all badges in the game (top 12 games)
    const top = games.slice(0, 12);
    const info = {};
    await R.pool(top, 3, async (g) => {
      try {
        const uidG = await R.universeOf(g.place);
        const all = await R.pages((c) => `https://badges.roblox.com/v1/universes/${uidG}/badges?limit=100&sortOrder=Asc${c ? `&cursor=${encodeURIComponent(c)}` : ""}`, { max: 5 });
        info[g.place] = { uid: uidG, total: all.filter((b) => b.enabled !== false).length || all.length };
      } catch (e) { /* skip */ }
    });
    const uids = Object.values(info).map((x) => x.uid);
    const det = uids.length ? await R.games(uids) : [];
    const nameOf = Object.fromEntries(det.map((d) => [d.id, d]));
    const progEl = out.querySelector(".bc-prog");
    if (progEl) {
      const rows = top.filter((g) => info[g.place]).map((g) => ({ ...g, ...info[g.place], game: nameOf[info[g.place].uid] })).sort((a, b) => b.n / b.total - a.n / a.total);
      progEl.innerHTML = rows.length ? `<div class="rg-list">${rows.map((r) => `<div class="rg-li"><img class="rg-thumb" data-thumb="game:${r.uid}"><div class="rg-li-main"><b><a href="${RB}/games/${r.place}">${R.esc(r.game?.name || "Game")}</a></b><div class="rg-bar"><i style="width:${Math.min(100, (r.n / Math.max(1, r.total)) * 100)}%"></i></div></div><span class="rg-num"><b>${r.n}/${r.total}</b><br><span class="rg-mute" style="font-size:12px">${Math.round((r.n / Math.max(1, r.total)) * 100)}%</span></span></div>`).join("")}</div>` : `<div class="rg-empty">Couldn't count the games' badges.</div>`;
      R.fillThumbs(progEl);
    }
    const rg = games.filter((g) => g.rarest < 100).sort((a, b) => a.rarest - b.rarest).slice(0, 8);
    const rgUids = await Promise.all(rg.map((g) => (info[g.place] ? info[g.place].uid : R.universeOf(g.place).catch(() => null))));
    const rgDet = await R.games(rgUids.filter(Boolean));
    const rgBy = Object.fromEntries(rgDet.map((d) => [d.id, d]));
    const rgEl = out.querySelector(".bc-rgames");
    if (rgEl) { rgEl.innerHTML = rg.length ? `<div class="rg-list">${rg.map((g, i) => `<div class="rg-li"><img class="rg-thumb" data-thumb="game:${rgUids[i]}"><div class="rg-li-main"><b><a href="${RB}/games/${g.place}">${R.esc(rgBy[rgUids[i]]?.name || "Game")}</a></b><small>You have ${g.n} badge${g.n === 1 ? "" : "s"} here</small></div><span class="rg-li-end">rarest ${rarity(g.rarest)}</span></div>`).join("")}</div>` : `<div class="rg-empty">No rarity data.</div>`; R.fillThumbs(rgEl); }
  }

  /* =================== Wrapped: your year on Roblox =================== */
  async function wrapped(main, q, params) {
    const me = meOrAsk(main); if (!me) return;
    const now = new Date(), year = Number(params && params.get("year")) || now.getFullYear();
    main.innerHTML = head(`RoGen Wrapped ${year}`, "Your year on Roblox in one page: games, badges, Robux, friends and more.")
      + `<div class="rg-row" style="margin-bottom:14px">${[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => `<a class="rg-chip ${y === year ? "on" : ""}" href="#wrapped?year=${y}">${y}</a>`).join("")}</div><div class="wr-out">${loading("Putting your year together…")}</div>`;
    const out = main.querySelector(".wr-out");
    const inYear = (t) => t && new Date(t).getFullYear() === year;
    const [tx, play, sessions, friendSince, unadded, userHist, rapHist] = await Promise.all([R.get1("tx", []), R.get1("playtime", {}), R.get1("playSessions", []), R.get1("friendSince", {}), R.get1("unadded", []), R.hist(`user:${me.id}`), R.hist(`rap:${me.id}`)]);
    // badges this year
    let badges = [], dates = {};
    try { badges = await R.userBadges(me.id, 10); dates = await R.awardedDates(me.id, badges.slice(0, 500).map((b) => b.id)); } catch (e) { /* private */ }
    const yb = badges.filter((b) => inYear(dates[b.id]));
    const gameCount = {}; yb.forEach((b) => { const k = b.awarder?.id; if (k) gameCount[k] = (gameCount[k] || 0) + 1; });
    const topBadgeGames = Object.entries(gameCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const tbUids = await Promise.all(topBadgeGames.map(([p]) => R.universeOf(Number(p)).catch(() => null)));
    const tbDet = await R.games(tbUids.filter(Boolean));
    const tbBy = Object.fromEntries(tbDet.map((d) => [d.id, d]));
    const rarestY = yb.filter((b) => b.statistics).sort((a, b) => a.statistics.winRatePercentage - b.statistics.winRatePercentage)[0];
    // spending this year
    const ytx = tx.filter((x) => inYear(x.created));
    const spentY = ytx.reduce((t, x) => t + R.spent(x), 0);
    const byG = {}; ytx.forEach((x) => { const g = R.gameOf(x); const k = g ? g.name : "Avatar & catalog"; byG[k] = (byG[k] || 0) + R.spent(x); });
    const topSpend = Object.entries(byG).sort((a, b) => b[1] - a[1])[0];
    const biggest = [...ytx].sort((a, b) => R.spent(b) - R.spent(a))[0];
    // playtime (tracked sessions this year, plus totals)
    const ys = sessions.filter((s) => inYear(s.start));
    const ms = {}; ys.forEach((s) => (ms[s.name || s.uid] = (ms[s.name || s.uid] || 0) + (s.end - s.start)));
    const topPlay = Object.entries(ms).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const playY = Object.values(ms).reduce((t, v) => t + v, 0);
    const playAll = Object.values(play).reduce((t, p) => t + R.playMs(p), 0);
    const months = Array(12).fill(0); ys.forEach((s) => (months[new Date(s.start).getMonth()] += s.end - s.start));
    const busiest = months.some((m) => m) ? new Date(year, months.indexOf(Math.max(...months))).toLocaleString(undefined, { month: "long" }) : null;
    // friends
    const newF = Object.values(friendSince).filter(inYear).length, lost = unadded.filter((u) => inYear(u.at) && !u.byMe).length;
    const fy = userHist.filter((p) => inYear(p.t)), fGain = fy.length > 1 && fy[0].followers != null ? fy[fy.length - 1].followers - fy[0].followers : null;
    const ry = rapHist.filter((p) => inYear(p.t)), rGain = ry.length > 1 ? ry[ry.length - 1].rap - ry[0].rap : null;
    const card = (big, label, sub = "", cls = "") => `<div class="wr-card ${cls}"><div class="wr-big">${big}</div><div class="wr-l">${label}</div>${sub ? `<div class="wr-sub">${sub}</div>` : ""}</div>`;
    out.innerHTML = `<div class="wr-grid">
      ${card(R.fmt(yb.length), "badges earned", rarestY ? `Rarest: ${R.esc(rarestY.name)} (${rarity(rarestY.statistics.winRatePercentage)})` : "", "wr-a")}
      ${card(playY ? R.dur(playY) : "—", "played (tracked by RoGen)", busiest ? `Busiest month: ${busiest}` : playAll ? `${R.dur(playAll)} tracked all time` : "RoGen counts playtime while Chrome is open")}
      ${card(spentY ? R.robux(spentY) : "—", "Robux spent", topSpend ? `Most on ${R.esc(topSpend[0])}` : tx.length ? "" : "Sync purchases in Wallet to fill this in")}
      ${card(newF ? "+" + R.fmt(newF) : "—", "new friends", lost ? `${lost} unadded you` : "")}
      ${card(fGain != null ? (fGain >= 0 ? "+" : "−") + R.fmt(Math.abs(fGain)) : "—", "followers", fGain == null ? "Seen by RoGen over the year" : "")}
      ${card(rGain != null ? `<span class="${rGain >= 0 ? "rg-good" : "rg-bad"}">${rGain >= 0 ? "+" : "−"}${R.robux(Math.abs(rGain))}</span>` : "—", "inventory value change", biggest ? `Biggest buy: ${R.esc(biggest.details?.name || "Item")} for R$${R.fmt(R.spent(biggest))}` : "")}
      </div>
      <div class="rg-2col">${sec("Top games by playtime", topPlay.length ? hbars(topPlay, R.dur) : `<div class="rg-empty">No tracked sessions this year.</div>`)}
        ${sec("Where you earned badges", topBadgeGames.length ? hbars(topBadgeGames.map(([p, n], i) => [tbBy[tbUids[i]]?.name || "Game", n, `${RB}/games/${p}`])) : `<div class="rg-empty">No badges this year.</div>`)}</div>
      ${months.some((m) => m) ? sec("Playtime by month", bars(months.map((m, i) => [new Date(year, i).toLocaleString(undefined, { month: "short" }), Math.round(m / 60000)]), (v) => R.dur(v * 60000))) : ""}
      <div class="rg-row" style="justify-content:flex-end;margin-top:12px"><button class="btn-control-md wr-copy">Copy my Wrapped</button></div>`;
    out.querySelector(".wr-copy").onclick = () => {
      const t = `My RoGen Wrapped ${year}: ${yb.length} badges earned, ${playY ? R.dur(playY) + " played, " : ""}${spentY ? "R$" + R.fmt(spentY) + " spent, " : ""}${newF ? newF + " new friends" : ""}`.replace(/, $/, "");
      navigator.clipboard.writeText(t).then(() => R.toast("Copied"));
    };
  }

  /* =================== Insights: charts and trends =================== */
  async function insights(main) {
    const me = meOrAsk(main); if (!me) return;
    main.innerHTML = head("Insights", "Charts of your Roblox stats over time, plus what's trending on the charts right now.")
      + `<div class="rg-2col"><div class="in-a"></div><div class="in-b"></div></div><div class="rg-2col"><div class="in-c"></div><div class="in-d"></div></div>`
      + sec("Recently released games on the charts", `<div class="in-new">${loading("Reading the charts…")}</div>`) + sec("Genres on the charts right now", `<div class="in-gen">${loading()}</div>`);
    const [uh, rh, tx, play] = await Promise.all([R.hist(`user:${me.id}`), R.hist(`rap:${me.id}`), R.get1("tx", []), R.get1("playtime", {})]);
    main.querySelector(".in-a").innerHTML = R.chart(uh.map((p) => ({ t: p.t, v: p.followers })), { label: "Followers" }) + `<div style="height:12px"></div>` + R.chart(uh.map((p) => ({ t: p.t, v: p.friends })), { label: "Friends" });
    main.querySelector(".in-b").innerHTML = R.chart(rh.map((p) => ({ t: p.t, v: p.rap })), { label: "Inventory value (RAP)", money: true });
    const mk = []; for (let i = 11; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); mk.push([d.getFullYear(), d.getMonth()]); }
    const spend = mk.map(([y, m]) => [new Date(y, m).toLocaleString(undefined, { month: "short" }), tx.filter((x) => { const c = new Date(x.created); return c.getFullYear() === y && c.getMonth() === m; }).reduce((t, x) => t + R.spent(x), 0)]);
    main.querySelector(".in-c").innerHTML = `<div class="rg-chart"><div class="rg-chart-top"><span>Robux spent per month</span></div>${tx.length ? bars(spend, (v) => "R$" + R.fmt(v)) : `<div class="rg-chart-wait">Sync purchases in Wallet to see this.</div>`}</div>`;
    const topPlay = Object.values(play).filter((p) => R.playMs(p) > 0).sort((a, b) => R.playMs(b) - R.playMs(a)).slice(0, 8);
    main.querySelector(".in-d").innerHTML = sec("Most played (tracked)", topPlay.length ? hbars(topPlay.map((p) => [p.name || "Game", R.playMs(p), p.placeId ? `${RB}/games/${p.placeId}` : ""]), R.dur) : `<div class="rg-empty">Play something with Chrome open and it shows up here.</div>`);
    // charts: recently released + genres
    try {
      const games = new Map();
      let token = "";
      for (let i = 0; i < 4; i++) {
        const d = await R.api(`https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=${SESSION}&device=computer&country=all${token ? `&sortsPageToken=${encodeURIComponent(token)}` : ""}`);
        (d.sorts || []).forEach((s) => (s.games || []).forEach((g) => g.universeId && games.set(g.universeId, g)));
        token = d.nextSortsPageToken || ""; if (!token) break;
      }
      const det = await R.games([...games.keys()].slice(0, 400));
      const fresh = det.filter((g) => Date.now() - new Date(g.created) < 60 * 864e5).sort((a, b) => b.playing - a.playing).slice(0, 18);
      const nEl = main.querySelector(".in-new");
      nEl.innerHTML = fresh.length ? R.tileGrid(fresh.map((g) => R.gameTile({ universeId: g.id, placeId: g.rootPlaceId, name: g.name, players: g.playing, up: 0, down: 0, extra: `Released ${R.ago(g.created)}` })).join("")) : `<div class="rg-empty">No games under two months old on the charts right now.</div>`;
      R.fillThumbs(nEl);
      const gen = {}; det.forEach((g) => { const k = g.genre_l1 || g.genre || "Other"; gen[k] = gen[k] || { n: 0, p: 0 }; gen[k].n++; gen[k].p += g.playing || 0; });
      const gl = Object.entries(gen).sort((a, b) => b[1].p - a[1].p).slice(0, 12);
      main.querySelector(".in-gen").innerHTML = `<table class="rg-table"><thead><tr><th>Genre</th><th class="rg-num">Games</th><th class="rg-num">Playing now</th><th class="rg-num">Share</th></tr></thead><tbody>${gl.map(([k, v]) => `<tr><td>${R.esc(k)}</td><td class="rg-num">${v.n}</td><td class="rg-num">${R.short(v.p)}</td><td class="rg-num">${Math.round((v.p / Math.max(1, det.reduce((t, g) => t + (g.playing || 0), 0))) * 100)}%</td></tr>`).join("")}</tbody></table><p class="rg-note">From ${det.length} games on Roblox's charts.</p>`;
    } catch (e) { main.querySelector(".in-new").innerHTML = R.errBox(e); main.querySelector(".in-gen").innerHTML = ""; }
  }

  R.extraViews = { ...(R.extraViews || {}), id: idView, compare, tracker, library: vault, inventory, collection, wrapped, insights };
})();
