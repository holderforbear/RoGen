// Shared stats: a player's / community's total visits + live players (CCU), hidden experiences, all + hidden badges, and the Lookup page.
(() => {
  const R = window.Rogen;
  R.extraViews = R.extraViews || {};
  const cur = (c) => (c ? `&cursor=${encodeURIComponent(c)}` : "");

  /* ---------------- data ---------------- */

  // Public experiences a player made
  R.userGames = (id) => R.pages((c) => `https://games.roblox.com/v2/users/${id}/games?accessFilter=2&limit=50&sortOrder=Desc${cur(c)}`, { max: 20 });

  // Every experience a community owns, including ones Roblox doesn't list on its page.
  // Roblox's group list endpoint returns more than the public page shows; we compare it with the public list
  // and with the games endpoint (which only returns experiences you're allowed to see) to work out which are hidden.
  R.groupGamesAll = async (gid) => {
    const listV2 = (filter) => R.pages((c) => `https://games.roblox.com/v2/groups/${gid}/gamesV2?${filter == null ? "" : `accessFilter=${filter}&`}limit=100&sortOrder=Desc${cur(c)}`, { max: 20 }).catch(() => null);
    const publicList = () => R.pages((c) => `https://games.roblox.com/v2/groups/${gid}/games?accessFilter=2&limit=100&sortOrder=Desc${cur(c)}`, { max: 20 }).catch(() => null);
    const none = await listV2(null);
    const f1 = await listV2(1);
    const f3 = await listV2(3);
    const pub = await publicList();
    const byId = new Map();
    [none, f1, f3, pub].forEach((l) => (l || []).forEach((g) => !byId.has(g.id) && byId.set(g.id, g)));
    const all = [...byId.values()];
    const pubIds = pub ? new Set(pub.map((g) => g.id)) : null;
    let vis = null;
    if (all.length) {
      try {
        vis = new Map((await R.games(all.map((g) => g.id))).map((g) => [g.id, g]));
        if (!vis.size) vis = null;
      } catch (e) { vis = null; }
    }
    const isPublic = (g) => (pubIds ? pubIds.has(g.id) : true) && (vis ? vis.has(g.id) : true);
    const visitsOf = (g) => vis?.get(g.id)?.visits ?? g.placeVisits ?? 0;
    const hidden = all.filter((g) => !isPublic(g));
    return {
      all, hidden, vis,
      publicCount: all.length - hidden.length,
      visitsOf,
      isPublic,
      visits: all.reduce((t, g) => t + visitsOf(g), 0),
      playing: all.reduce((t, g) => t + (vis?.get(g.id)?.playing || 0), 0),
      knownPublic: !!pubIds
    };
  };

  const lines = (rows) => rows.map((r) => `<tr>
      <td><img class="rg-thumb" data-thumb="game:${r.uid}"> <a href="https://www.roblox.com/games/${r.placeId}" target="_blank">${R.esc(r.name)}</a>${r.hidden ? ` <span class="rg-badge bad">Hidden</span>` : ""}${r.src ? ` <span class="rg-mute" style="font-size:12px">· ${R.esc(r.src)}</span>` : ""}</td>
      <td class="rg-num">${R.short(r.visits)}</td><td class="rg-num">${r.playing ? R.fmt(r.playing) : `<span class="rg-mute">0</span>`}</td></tr>`).join("");
  const table = (rows) => `<div class="rg-table-wrap"><table class="rg-table"><thead><tr><th>Experience</th><th class="rg-num">Visits</th><th class="rg-num">Playing now</th></tr></thead><tbody>${lines(rows)}</tbody></table></div>`;

  // Compact list of a community's hidden experiences. d = { hidden: [{id, placeId, name, visits}], total }
  R.hiddenList = (d) => {
    const rows = [...d.hidden].sort((a, b) => b.visits - a.visits);
    if (!rows.length) return `<div class="rg-empty">${d.total ? "No hidden experiences. Everything this community owns is public." : "Roblox didn't return any experiences for this community."}</div>`;
    return `<div class="rg-list">${rows.map((r) => `<a class="rg-li" ${r.placeId ? `href="https://www.roblox.com/games/${r.placeId}"` : ""} target="_blank">
      <img class="rg-thumb" data-thumb="game:${r.id}" alt=""><span class="rg-li-main"><b>${R.esc(r.name)}</b><small>${R.short(r.visits)} visits · hidden</small></span></a>`).join("")}</div>`;
  };

  /* ---------------- a player's visits + CCU ---------------- */
  R.renderCreations = async (el, userId, { owned = false } = {}) => {
    const run = async (includeGroups) => {
      el.innerHTML = `<div class="rg-loading">Counting visits…</div>`;
      try {
        const rows = new Map();
        const mine = await R.userGames(userId);
        const ids = mine.map((g) => g.id);
        const groupInfo = [];
        if (includeGroups) {
          const roles = await R.api(`https://groups.roblox.com/v1/users/${userId}/groups/roles`).catch(() => ({ data: [] }));
          for (const r of (roles.data || []).filter((x) => x.role && x.role.rank === 255)) {
            const info = await R.groupGamesAll(r.group.id).catch(() => null);
            if (info) groupInfo.push({ group: r.group, info });
          }
        }
        const allIds = [...new Set([...ids, ...groupInfo.flatMap((g) => g.info.all.map((x) => x.id))])];
        const det = allIds.length ? await R.games(allIds).catch(() => []) : [];
        const d = new Map(det.map((g) => [g.id, g]));
        mine.forEach((g) => rows.set(g.id, { uid: g.id, placeId: g.rootPlace?.id, name: g.name, visits: d.get(g.id)?.visits ?? g.placeVisits ?? 0, playing: d.get(g.id)?.playing || 0, fav: d.get(g.id)?.favoritedCount || 0, src: "" }));
        for (const { group, info } of groupInfo) for (const g of info.all) {
          if (rows.has(g.id)) continue;
          rows.set(g.id, { uid: g.id, placeId: g.rootPlace?.id, name: g.name, visits: info.visitsOf(g), playing: d.get(g.id)?.playing || 0, fav: d.get(g.id)?.favoritedCount || 0, src: group.name, hidden: !info.isPublic(g) });
        }
        const list = [...rows.values()].sort((a, b) => b.visits - a.visits);
        const tot = (k) => list.reduce((t, r) => t + (r[k] || 0), 0);
        el.innerHTML = `<div class="rg-stats">
            ${R.stat("Total visits", R.short(tot("visits")), R.fmt(tot("visits")))}
            ${R.stat("Playing now (CCU)", `<span class="rg-live">${R.fmt(tot("playing"))}</span>`, "across all their experiences")}
            ${R.stat("Experiences", list.length)}
            ${R.stat("Favorites", R.short(tot("fav")), R.fmt(tot("fav")))}
          </div>
          <div class="rg-row space" style="margin:12px 0 8px">
            <label class="rg-check"><input type="checkbox" class="cr-groups" ${includeGroups ? "checked" : ""}> Include communities they own</label>
            <button class="btn-control-sm cr-refresh">Refresh</button></div>
          ${list.length ? table(list) : `<div class="rg-empty">No public experiences.</div>`}
          <p class="rg-note">Counts public experiences${includeGroups ? " plus everything their owned communities have, including unlisted ones" : ""}. Visits are all-time; Playing now is live.</p>`;
        el.querySelector(".cr-groups").onchange = (e) => run(e.target.checked);
        el.querySelector(".cr-refresh").onclick = () => run(el.querySelector(".cr-groups").checked);
        R.fillThumbs(el);
      } catch (e) { el.innerHTML = R.errBox(e); }
    };
    return run(owned);
  };

  /* ---------------- a community's visits, CCU and hidden experiences ---------------- */
  R.renderGroupGames = async (pane, gid) => {
    pane.innerHTML = `<div class="rg-loading">Loading experiences…</div>`;
    const g = await R.groupGamesAll(gid);
    await R.snap(`groupGames:${gid}`, { visits: g.visits, games: g.all.length });
    const h = await R.hist(`groupGames:${gid}`);
    const toRow = (x) => ({ uid: x.id, placeId: x.rootPlace?.id, name: x.name, visits: g.visitsOf(x), playing: g.vis?.get(x.id)?.playing || 0, hidden: !g.isPublic(x) });
    pane.innerHTML = `<div class="rg-stats">
        ${R.stat("Total visits", R.short(g.visits), R.fmt(g.visits))}
        ${R.stat("Playing now (CCU)", R.fmt(g.playing))}
        ${R.stat("Experiences", g.all.length)}
        ${R.stat("Public", g.publicCount)}
        ${R.stat("Hidden", g.hidden.length)}
      </div>
      ${h.length > 1 ? R.chart(h.map((x) => ({ t: x.t, v: x.visits })), { label: "Total visits over time" }) : ""}
      <div class="rg-h3">Hidden experiences</div>
      ${g.hidden.length ? table(g.hidden.map(toRow).sort((a, b) => b.visits - a.visits))
        : `<div class="rg-empty">${g.all.length ? "None found. Everything this community owns is public." : "Roblox didn't return any experiences for this community."}</div>`}
      <div class="rg-h3">All experiences by visits</div>
      ${g.all.length ? table(g.all.map(toRow).sort((a, b) => b.visits - a.visits)) : `<div class="rg-empty">No experiences.</div>`}
      <p class="rg-note">Hidden = Roblox returns the experience for this community but it isn't on the public list or can't be opened by you. Hidden experiences only show visits Roblox reports; they have no live player count. Roblox controls this data and may change it.</p>`;
    R.fillThumbs(pane);
  };

  /* ---------------- badges: every badge in a game, including hidden ones ---------------- */
  const rateOf = (b) => { const w = b.statistics?.winRatePercentage ?? 0; return w > 1 ? w : w * 100; };
  const pct = (r) => (r <= 0 ? "<0.01%" : r < 0.1 ? r.toFixed(2) + "%" : r.toFixed(1) + "%");
  // Same difficulty names Roblox shows on badge pages
  const level = (r) => r >= 90 ? "Freebie" : r >= 80 ? "Cake Walk" : r >= 50 ? "Easy" : r >= 30 ? "Moderate" : r >= 20 ? "Challenging" : r >= 10 ? "Hard" : r >= 5 ? "Extreme" : r >= 1 ? "Insane" : "Impossible";

  // Badges the game's public list doesn't show. Badge IDs a developer makes are usually close together,
  // so check the IDs next to the ones we know and keep those that belong to this game.
  R.findHiddenBadges = async (universeId, known, { onProgress, shouldStop } = {}) => {
    const have = new Set(known.map((b) => b.id));
    const cand = new Map();
    for (const b of known) for (let d = -30; d <= 30; d++) {
      const id = b.id + d;
      if (id > 0 && !have.has(id)) cand.set(id, Math.min(cand.get(id) ?? 99, Math.abs(d)));
    }
    const order = [...cand.entries()].sort((a, b) => a[1] - b[1]).slice(0, 240).map((x) => x[0]);
    const found = [];
    let done = 0, errors = 0, i = 0;
    const worker = async () => {
      while (i < order.length && errors < 12 && !(shouldStop && shouldStop())) {
        const id = order[i++];
        try {
          const d = await R.api(`https://badges.roblox.com/v1/badges/${id}`);
          if (d && d.awardingUniverse && Number(d.awardingUniverse.id) === Number(universeId)) found.push({ ...d, hiddenFound: true });
        } catch (e) { if (e.status !== 404 && e.status !== 400) errors++; }
        done++;
        onProgress && onProgress(done, order.length, found.length);
        await R.sleep(120);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return { found, checked: done, total: order.length, stopped: errors >= 12 };
  };

  R.renderBadges = async (pane, uid) => {
    const list = await R.pages((c) => `https://badges.roblox.com/v1/universes/${uid}/badges?limit=100&sortOrder=Asc${cur(c)}`, { max: 10 });
    const me = R.me();
    const got = {};
    let mode = "rare";
    let scanning = false, stop = false;
    const fetchMine = async (arr) => {
      if (!me) return;
      for (const c of R.chunks(arr.map((b) => b.id), 100)) {
        const d = await R.api(`https://badges.roblox.com/v1/users/${me.id}/badges/awarded-dates?badgeIds=${c.join(",")}`).catch(() => ({ data: [] }));
        (d.data || []).forEach((x) => (got[x.badgeId] = x.awardedDate));
      }
    };
    await fetchMine(list);
    const isHidden = (b) => b.enabled === false || b.hiddenFound;
    pane.innerHTML = `<div class="rg-row space" style="margin-bottom:10px"><div class="b-sum" style="flex:1;min-width:200px"></div>
        <select class="rg-select b-mode"><option value="rare">Rarest first</option><option value="common">Most common first</option><option value="hidden">Hidden / disabled only</option><option value="missing">Ones I'm missing</option><option value="mine">Ones I have</option></select></div>
      <div class="rg-row" style="margin-bottom:10px"><button class="btn-control-sm b-scan">Find hidden badges</button><span class="rg-mute b-scanmsg" style="font-size:13px"></span></div>
      <div class="b-list"></div>`;
    const draw = () => {
      const have = list.filter((b) => got[b.id]).length;
      const hid = list.filter(isHidden).length;
      pane.querySelector(".b-sum").innerHTML = (me && list.length ? `<div style="font-weight:700;margin-bottom:6px">You have ${have} / ${list.length} badges (${Math.round((have / list.length) * 100)}%)</div><div class="rg-bar"><i style="width:${(have / list.length) * 100}%"></i></div>`
        : `<div style="font-weight:700">${list.length} badges</div>${me ? "" : `<div class="rg-mute" style="font-size:13px">Log in to see which ones you have.</div>`}`)
        + (hid ? `<div class="rg-mute" style="font-size:13px;margin-top:6px">${hid} hidden or disabled</div>` : "");
      let l = [...list];
      if (mode === "missing") l = l.filter((b) => !got[b.id]);
      if (mode === "mine") l = l.filter((b) => got[b.id]);
      if (mode === "hidden") l = l.filter(isHidden);
      l.sort((a, b) => (mode === "common" ? rateOf(b) - rateOf(a) : rateOf(a) - rateOf(b)));
      pane.querySelector(".b-list").innerHTML = l.length ? `<div class="rg-table-wrap"><table class="rg-table"><thead><tr><th>#</th><th>Badge</th><th>Difficulty</th><th class="rg-num">Win rate</th><th class="rg-num">Awarded</th><th></th></tr></thead><tbody>
        ${l.map((b, i) => `<tr><td class="rg-mute">${i + 1}</td>
          <td><img class="rg-thumb" data-thumb="badge:${b.id}"> <a href="https://www.roblox.com/badges/${b.id}" target="_blank">${R.esc(b.name)}</a>${isHidden(b) ? ` <span class="rg-badge bad" title="${b.hiddenFound ? "Not on the game's public badge list" : "Turned off by the developer"}">Hidden</span>` : ""}</td>
          <td><span class="rg-badge ${rateOf(b) < 1 ? "bad" : rateOf(b) < 10 ? "acc" : ""}">${level(rateOf(b))}</span></td>
          <td class="rg-num">${pct(rateOf(b))}</td>
          <td class="rg-num">${R.short(b.statistics?.awardedCount)}</td>
          <td>${got[b.id] ? `<span class="rg-badge good" title="${R.date(got[b.id])}">Earned</span>` : ""}</td></tr>`).join("")}</tbody></table></div>`
        : `<div class="rg-empty">${mode === "hidden" ? "No hidden badges found yet. Press “Find hidden badges” to search." : list.length ? "Nothing here." : "This game has no badges."}</div>`;
      R.fillThumbs(pane);
    };
    pane.querySelector(".b-mode").onchange = (e) => { mode = e.target.value; draw(); };
    pane.querySelector(".b-scan").onclick = async (e) => {
      const btn = e.currentTarget, msg = pane.querySelector(".b-scanmsg");
      if (scanning) { stop = true; return; }
      if (!list.length) { msg.textContent = "Needs at least one known badge to search next to."; return; }
      scanning = true; stop = false; btn.textContent = "Stop";
      const r = await R.findHiddenBadges(uid, list, { onProgress: (d, t, f) => (msg.textContent = `Checked ${d} / ${t} · ${f} hidden found`), shouldStop: () => stop });
      scanning = false; btn.textContent = "Find hidden badges";
      r.found.forEach((b) => !list.some((x) => x.id === b.id) && list.push(b));
      await fetchMine(r.found);
      msg.textContent = r.stopped ? `Roblox slowed us down. Found ${r.found.length}; try again in a minute.` : `Done. ${r.found.length} hidden ${r.found.length === 1 ? "badge" : "badges"} found. Checked ${r.checked} IDs next to the known badges.`;
      if (r.found.length) { mode = "hidden"; pane.querySelector(".b-mode").value = "hidden"; }
      draw();
    };
    draw();
  };

  // Everything a player has earned (their profile only shows a few)
  R.renderUserBadges = async (el, userId) => {
    el.innerHTML = `<div class="rg-loading">Loading badges…</div>`;
    try {
      const list = await R.pages((c) => `https://badges.roblox.com/v1/users/${userId}/badges?limit=100&sortOrder=Desc${cur(c)}`, { max: 30, onPage: (all) => (el.innerHTML = `<div class="rg-loading">Loading badges… ${all.length}</div>`) });
      let q = "", sort = "new";
      el.innerHTML = `<div class="rg-stats" style="margin-bottom:12px">${R.stat("Badges", R.fmt(list.length))}${R.stat("Rarest", list.length ? pct(Math.min(...list.map(rateOf))) : "—")}</div>
        <div class="rg-row" style="margin-bottom:10px"><input class="rg-input ub-q" placeholder="Search badges…" style="flex:1;min-width:160px"><select class="rg-select ub-sort"><option value="new">Newest first</option><option value="rare">Rarest first</option><option value="old">Oldest first</option></select></div><div class="ub-out"></div>`;
      const draw = () => {
        let l = list.filter((b) => !q || (b.name + " " + (b.description || "")).toLowerCase().includes(q));
        const t = (b) => new Date(b.awardedDate || b.created || 0).getTime();
        l.sort(sort === "rare" ? (a, b) => rateOf(a) - rateOf(b) : sort === "old" ? (a, b) => t(a) - t(b) : (a, b) => t(b) - t(a));
        el.querySelector(".ub-out").innerHTML = l.length ? `<div class="rg-table-wrap"><table class="rg-table"><thead><tr><th>Badge</th><th>Difficulty</th><th class="rg-num">Win rate</th><th class="rg-num">Awarded</th></tr></thead><tbody>
          ${l.slice(0, 500).map((b) => `<tr><td><img class="rg-thumb" data-thumb="badge:${b.id}"> <a href="https://www.roblox.com/badges/${b.id}" target="_blank">${R.esc(b.name)}</a>${b.enabled === false ? ` <span class="rg-badge bad">Hidden</span>` : ""}</td>
            <td><span class="rg-badge ${rateOf(b) < 1 ? "bad" : rateOf(b) < 10 ? "acc" : ""}">${level(rateOf(b))}</span></td><td class="rg-num">${pct(rateOf(b))}</td><td class="rg-num">${R.short(b.statistics?.awardedCount)}</td></tr>`).join("")}</tbody></table></div>${l.length > 500 ? `<p class="rg-note">Showing the first 500 of ${l.length}.</p>` : ""}`
          : `<div class="rg-empty">No badges.</div>`;
        R.fillThumbs(el);
      };
      el.querySelector(".ub-q").oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
      el.querySelector(".ub-sort").onchange = (e) => { sort = e.target.value; draw(); };
      draw();
    } catch (e) { el.innerHTML = e.status === 403 ? `<div class="rg-empty">This player's badges are private.</div>` : R.errBox(e); }
  };

  /* ---------------- Lookup page: any player, community or game ---------------- */
  R.extraViews.lookup = async (main) => {
    let tab = "player";
    const TABS = { player: ["Player", "Username, ID or profile link"], group: ["Community", "Community ID or link"], badges: ["Game badges", "Game link or place ID"], ubadges: ["Player badges", "Username, ID or profile link"] };
    main.innerHTML = `<h1>Lookup</h1><p class="rg-lead">Total visits, live players, hidden experiences and badges for anyone on Roblox.</p>
      <div class="rg-seg">${Object.entries(TABS).map(([k, [l]]) => `<button data-t="${k}" class="${k === tab ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="rg-searchbar"><input class="rg-input lk-in"><button class="btn-primary-md lk-go">Look up</button></div><div class="lk-out"></div>`;
    const $ = (s) => main.querySelector(s);
    const setTab = (t) => {
      tab = t;
      main.querySelectorAll(".rg-seg button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
      $(".lk-in").placeholder = TABS[t][1] + "…";
      $(".lk-out").innerHTML = "";
    };
    const userFrom = async (txt) => {
      const m = txt.match(/users\/(\d+)/i) || txt.match(/^(\d{3,})$/);
      if (m) return Number(m[1]);
      const u = await R.userByName(txt.replace(/^@/, ""));
      return u ? u.id : null;
    };
    const go = async () => {
      const txt = $(".lk-in").value.trim();
      const out = $(".lk-out");
      if (!txt) return;
      out.innerHTML = `<div class="rg-loading">Looking up…</div>`;
      try {
        if (tab === "player" || tab === "ubadges") {
          const id = await userFrom(txt);
          if (!id) { out.innerHTML = `<div class="rg-empty">No player found for “${R.esc(txt)}”.</div>`; return; }
          const [u] = Object.values(await R.users([id]));
          out.innerHTML = `<div class="rg-row" style="margin-bottom:12px"><img class="rg-thumb round" data-thumb="user:${id}"> <a class="rg-link" href="https://www.roblox.com/users/${id}/profile" style="font-size:17px">${R.esc(u?.displayName || id)} <span class="rg-mute">@${R.esc(u?.name || "")}</span></a></div><div class="lk-body"></div>`;
          R.fillThumbs(out);
          tab === "player" ? await R.renderCreations($(".lk-body"), id) : await R.renderUserBadges($(".lk-body"), id);
        } else if (tab === "group") {
          const m = txt.match(/(?:groups|communities)\/(\d+)/i) || txt.match(/^(\d+)$/);
          if (!m) { out.innerHTML = `<div class="rg-empty">Paste a community link or its ID number.</div>`; return; }
          const gid = Number(m[1]);
          const info = await R.api(`https://groups.roblox.com/v1/groups/${gid}`);
          out.innerHTML = `<div class="rg-row" style="margin-bottom:12px"><img class="rg-thumb" data-thumb="group:${gid}"> <a class="rg-link" href="https://www.roblox.com/communities/${gid}" style="font-size:17px">${R.esc(info.name)}</a><span class="rg-mute">${R.fmt(info.memberCount)} members</span></div><div class="lk-body"></div>`;
          R.fillThumbs(out);
          await R.renderGroupGames($(".lk-body"), gid);
        } else {
          const m = txt.match(/games\/(\d+)/i) || txt.match(/^(\d+)$/);
          if (!m) { out.innerHTML = `<div class="rg-empty">Paste a game link or its place ID.</div>`; return; }
          const uid = await R.universeOf(Number(m[1]));
          const [g] = await R.games([uid]);
          out.innerHTML = `<div class="rg-row" style="margin-bottom:12px"><img class="rg-thumb" data-thumb="game:${uid}"> <a class="rg-link" href="https://www.roblox.com/games/${m[1]}" style="font-size:17px">${R.esc(g?.name || "Game")}</a></div><div class="lk-body"></div>`;
          R.fillThumbs(out);
          await R.renderBadges($(".lk-body"), uid);
        }
      } catch (e) { out.innerHTML = R.errBox(e); }
    };
    main.querySelectorAll(".rg-seg button").forEach((b) => (b.onclick = () => setTab(b.dataset.t)));
    $(".lk-go").onclick = go;
    $(".lk-in").onkeydown = (e) => { if (e.key === "Enter") go(); };
    setTab("player");
    const pre = new URLSearchParams(location.hash.split("?")[1] || "");
    if (pre.get("q")) { $(".lk-in").value = pre.get("q"); go(); }
  };
})();
