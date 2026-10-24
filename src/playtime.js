// Playtime 2.0: you, your friends, and full history.
//  - You:          live tracking of your own games (page.js → R.playtimeYou).
//  - Friends:      the background page checks your friends every minute and counts their time per game.
//  - Full history: Roblox never shares hours played, but it does share WHEN every badge was earned, for any
//                  player with a public inventory. Badges go back to the start of the account, so RoGen rebuilds
//                  which games someone played, since when, until when and on how many days, way before RoGen.
(() => {
  const R = window.Rogen;
  const cur = (c) => (c ? `&cursor=${encodeURIComponent(c)}` : "");
  const DAY = 864e5;

  /* ---------------- helpers ---------------- */
  const span = (ms) => {
    const d = Math.round(ms / DAY);
    if (d < 1) return "1 day";
    if (d < 60) return `${d} day${d === 1 ? "" : "s"}`;
    if (d < 730) return `${Math.round(d / 30.44)} months`;
    return `${(d / 365.25).toFixed(1).replace(/\.0$/, "")} years`;
  };
  const dayKey = (t) => new Date(t).toISOString().slice(0, 10);
  const isFriendTracked = (u) => u && u.ms > 0;
  const gameLink = (g, name) => g.placeId ? `<a href="https://www.roblox.com/games/${g.placeId}">${R.esc(name)}</a>` : R.esc(name);

  /* ---------------- full history from badge dates ---------------- */
  R.playHistory = async (uid, { force = false, onProgress = () => {} } = {}) => {
    const key = "playHist:" + uid;
    const c = await R.get1(key, null);
    if (!force && c && c.v === 2 && Date.now() - c.t < 6 * 3600e3) return c;
    const list = await R.pages((x) => `https://badges.roblox.com/v1/users/${uid}/badges?limit=100&sortOrder=Desc${cur(x)}`, { max: 50, onPage: (all) => onProgress(`Reading badges… ${R.fmt(all.length)}`) });
    const dates = {};
    let done = 0;
    for (const ch of R.chunks(list.map((b) => b.id), 100)) {
      const d = await R.api(`https://badges.roblox.com/v1/users/${uid}/badges/awarded-dates?badgeIds=${ch.join(",")}`).catch(() => ({ data: [] }));
      (d.data || []).forEach((x) => (dates[x.badgeId] = new Date(x.awardedDate).getTime()));
      done += ch.length;
      onProgress(`Dating badges… ${R.fmt(done)} / ${R.fmt(list.length)}`);
    }
    const games = {}, allDays = new Set(), years = {};
    for (const b of list) {
      const t = dates[b.id];
      if (!t) continue;
      const au = b.awardingUniverse || {};
      const g = String(au.id || (b.awarder && b.awarder.id) || "?");
      const e = (games[g] = games[g] || { first: t, last: t, days: [], count: 0, name: au.name || "", placeId: au.rootPlaceId || null });
      e.first = Math.min(e.first, t); e.last = Math.max(e.last, t); e.count++;
      const k = dayKey(t);
      if (!e.days.includes(k)) e.days.push(k);
      allDays.add(k);
      const y = new Date(t).getFullYear(); years[y] = (years[y] || 0) + 1;
    }
    // Fill in names for games the badge list didn't name
    const missing = Object.keys(games).filter((g) => /^\d+$/.test(g) && (!games[g].name || !games[g].placeId));
    if (missing.length) {
      onProgress("Looking up games…");
      const found = new Set();
      try { (await R.games(missing)).forEach((x) => { const e = games[x.id]; if (e) { found.add(String(x.id)); e.name = e.name || x.name; e.placeId = e.placeId || x.rootPlaceId; } }); } catch (e) { /* names are optional */ }
      // Some badge lists name the awarding PLACE instead of the game: turn those into games and merge them
      const asPlace = missing.filter((g) => !found.has(g)).slice(0, 60);
      const moved = {};
      for (const pid of asPlace) {
        const uni = await R.universeOf(pid).catch(() => null);
        if (!uni || String(uni) === pid) continue;
        const a = games[pid], k = String(uni), b = games[k];
        games[k] = b ? { ...b, first: Math.min(a.first, b.first), last: Math.max(a.last, b.last), count: a.count + b.count, days: [...new Set([...a.days, ...b.days])] } : { ...a, placeId: a.placeId || Number(pid) };
        delete games[pid]; moved[k] = 1;
      }
      const need = Object.keys(moved).filter((g) => !games[g].name);
      if (need.length) try { (await R.games(need)).forEach((x) => { const e = games[x.id]; if (e) { e.name = e.name || x.name; e.placeId = x.rootPlaceId || e.placeId; } }); } catch (e) { /* optional */ }
    }
    const out = {
      v: 2, t: Date.now(), badges: list.length,
      games: Object.fromEntries(Object.entries(games).map(([g, e]) => [g, { ...e, active: e.days.length, days: undefined }])),
      activeDays: allDays.size, years,
      first: Object.keys(games).length ? Math.min(...Object.values(games).map((e) => e.first)) : null,
      last: Object.keys(games).length ? Math.max(...Object.values(games).map((e) => e.last)) : null
    };
    await R.set({ [key]: out });
    return out;
  };

  /* ---------------- friend tracked data ---------------- */
  const friendData = async () => {
    const me = R.me();
    const fp = await R.get1("friendPlay", null);
    return fp && me && fp.owner === me.id ? fp : null;
  };
  const liveNow = async () => {
    const st = await R.get1("friendPlayState", {});
    const out = {};
    for (const id in st) if (Date.now() - st[id].last < 3 * 60e3) out[id] = st[id];
    return out;
  };

  /* ---------------- FRIENDS tab ---------------- */
  async function friendsTab(el, go) {
    const fp = await friendData();
    const status = await R.get1("friendPlayStatus", null);
    const live = await liveNow();
    const users = fp ? Object.entries(fp.users).filter(([, u]) => isFriendTracked(u)).sort((a, b) => b[1].ms - a[1].ms) : [];
    const names = users.length || Object.keys(live).length ? await R.users([...users.map(([id]) => id), ...Object.keys(live)].map(Number)).catch(() => ({})) : {};
    const top = (u) => Object.entries(u.games || {}).sort((a, b) => b[1].ms - a[1].ms)[0];
    const total = users.reduce((t, [, u]) => t + u.ms, 0);
    const liveIds = Object.keys(live);
    el.innerHTML = `
      <div class="rg-note pt-fstatus" style="margin:0 0 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <i class="rg-gdot" style="background:${status ? "var(--rg-good)" : "var(--rg-mute)"};box-shadow:none"></i>
        <span style="flex:1;min-width:200px">${status ? `Watching ${R.fmt(status.friends)} friends · ${status.inGame} in a game right now · checked ${R.ago(status.t)}. Counting since <b>${R.date(fp ? fp.since : status.t)}</b>, about once a minute while Chrome is open.` : "Starting up. RoGen checks your friends about once a minute while Chrome is open."}
          For time before that, open <b>Full history</b>.</span>
        <button class="btn-control-sm pt-fnow">Check now</button></div>
      ${liveIds.length ? `<div class="rg-h3">Playing right now</div><div class="rg-people" style="margin-bottom:12px">${liveIds.map((id) => `<a class="rg-person" href="https://www.roblox.com/users/${id}/profile"><span class="rg-av"><img data-thumb="user:${id}" alt=""><i class="rg-pres game"></i></span><div class="p-name">${R.esc(names[id]?.displayName || id)}</div><div class="p-sub">${R.esc(live[id].name || "In a game")} · ${R.dur(Date.now() - live[id].start)}</div></a>`).join("")}</div>` : ""}
      <div class="rg-stats" style="margin-bottom:16px">${R.stat("Friends tracked", R.fmt(users.length))}${R.stat("Total friend playtime", R.dur(total))}${R.stat("In a game now", R.fmt(liveIds.length))}</div>
      ${users.length ? `<div class="rg-table-wrap" style="max-height:none"><table class="rg-table pt-ftable"><thead><tr><th>Friend</th><th class="rg-num">Time played</th><th>Top game</th><th class="rg-num">Last in a game</th><th></th></tr></thead><tbody>
        ${users.map(([id, u]) => { const t = top(u); return `<tr class="pt-frow" data-id="${id}" style="cursor:pointer"><td><div class="rg-cell"><img class="rg-thumb round" data-thumb="user:${id}" alt=""><span><b>${R.esc(names[id]?.displayName || "User " + id)}</b>${live[id] ? ` <span class="rg-badge good">Playing</span>` : ""}<br><span class="rg-mute" style="font-size:13px">@${R.esc(names[id]?.name || id)}</span></span></div></td>
          <td class="rg-num"><b>${R.dur(u.ms)}</b></td><td>${t ? `${R.esc(t[1].name || "Game")} <span class="rg-mute">· ${R.dur(t[1].ms)}</span>` : "—"}</td><td class="rg-num rg-mute">${live[id] ? "now" : R.ago(u.last)}</td>
          <td class="rg-num"><button class="btn-control-sm pt-fhist" data-id="${id}">Full history</button></td></tr>
          <tr class="pt-fdetail" data-for="${id}" hidden><td colspan="5"></td></tr>`; }).join("")}</tbody></table></div>`
      : `<div class="rg-empty">No friend playtime yet. Leave Chrome open and it fills in whenever your friends are in a game.<br>Friends who hide which game they're in still count, under "Hidden game".</div>`}`;
    R.fillThumbs(el);
    el.querySelector(".pt-fnow").onclick = async (e) => { e.target.textContent = "Checking…"; await R.send({ type: "friendsPlayNow" }); friendsTab(el, go); };
    el.querySelectorAll(".pt-fhist").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); go(b.dataset.id); }));
    el.querySelectorAll(".pt-frow").forEach((row) => (row.onclick = () => {
      const d = el.querySelector(`.pt-fdetail[data-for="${row.dataset.id}"]`);
      d.hidden = !d.hidden;
      if (!d.hidden && !d.dataset.done) { d.dataset.done = 1; d.firstElementChild.innerHTML = trackedDetail(fp.users[row.dataset.id]); R.fillThumbs(d); }
    }));
  }

  // Per-game bars + recent sessions for one friend (what RoGen tracked)
  const trackedDetail = (u) => {
    const gs = Object.entries(u.games || {}).sort((a, b) => b[1].ms - a[1].ms);
    const max = gs.length ? gs[0][1].ms || 1 : 1;
    return `<div class="pt-detail"><div class="rg-list">${gs.slice(0, 12).map(([g, x]) => `<div class="rg-li" style="cursor:default">${/^\d+$/.test(g) ? `<img class="rg-thumb" data-thumb="game:${g}" alt="">` : `<span class="rg-thumb"></span>`}
        <div class="rg-li-main"><b>${gameLink(x, x.name || "Game")}</b><div class="rg-bar"><i style="width:${(x.ms / max) * 100}%"></i></div></div><span class="rg-num" style="min-width:70px"><b>${R.dur(x.ms)}</b><br><span class="rg-mute" style="font-size:12px">${R.ago(x.last)}</span></span></div>`).join("")}</div>
      ${(u.sessions || []).length ? `<div class="rg-h3">Recent sessions</div><div class="pt-sessions">${u.sessions.slice(0, 12).map((s) => `<span class="rg-chip" style="cursor:default">${R.esc(s.name || "Game")} · ${R.dur(s.end - s.start)} <span class="rg-mute">${R.ago(s.end)}</span></span>`).join("")}</div>` : ""}</div>`;
  };

  /* ---------------- FULL HISTORY tab ---------------- */
  async function historyTab(el, uid) {
    const me = R.me();
    uid = Number(uid || (me && me.id));
    const fp = await friendData();
    const myPt = await R.get1("playtime", {});
    // Quick picks: you + friends RoGen has seen playing the most
    const picks = fp ? Object.entries(fp.users).filter(([, u]) => u.ms > 0).sort((a, b) => b[1].ms - a[1].ms).slice(0, 10).map(([id]) => Number(id)) : [];
    const snap = await R.get1("friendSnap", null);
    if (picks.length < 10 && snap && snap.ids) snap.ids.slice(0, 10 - picks.length).forEach((id) => picks.includes(id) || picks.push(id));
    const pn = picks.length ? await R.users(picks).catch(() => ({})) : {};
    el.innerHTML = `
      <div class="rg-searchbar"><input class="rg-input ph-in" placeholder="Anyone: username, user ID or profile link" style="flex:1"><button class="btn-primary-md ph-go">Show history</button></div>
      <div class="rg-chips" style="margin:-4px 0 16px">${me ? `<button class="rg-chip ${uid === me.id ? "on" : ""}" data-u="${me.id}">You</button>` : ""}${picks.map((id) => `<button class="rg-chip ${uid === id ? "on" : ""}" data-u="${id}">${R.esc(pn[id]?.displayName || id)}</button>`).join("")}</div>
      <div class="ph-out"></div>`;
    const load = async (id, force) => {
      const out = el.querySelector(".ph-out");
      el.querySelectorAll(".rg-chip[data-u]").forEach((c) => c.classList.toggle("on", Number(c.dataset.u) === id));
      out.innerHTML = `<div class="rg-loading">Loading…</div>`;
      try {
        const [u, h] = await Promise.all([R.api(`https://users.roblox.com/v1/users/${id}`), R.playHistory(id, { force, onProgress: (t) => (out.innerHTML = `<div class="rg-loading">${R.esc(t)}</div>`) })]);
        renderHistory(out, id, u, h, id === (me && me.id) ? myPt : (fp && fp.users[id] ? fp.users[id].games : {}), () => load(id, true));
      } catch (e) { out.innerHTML = e.status === 403 || /403/.test(e.message) ? `<div class="rg-empty">This player's inventory is private, so Roblox doesn't share their badges.</div>` : R.errBox(e); }
    };
    const resolve = async (txt) => {
      txt = txt.trim();
      const m = txt.match(/users\/(\d+)/) || txt.match(/^(\d{1,13})$/);
      if (m) return Number(m[1]);
      const u = await R.userByName(txt.replace(/^@/, ""));
      if (!u) throw new Error("No player with that name.");
      return u.id;
    };
    const run = async () => { try { const id = await resolve(el.querySelector(".ph-in").value); load(id); } catch (e) { el.querySelector(".ph-out").innerHTML = R.errBox(e); } };
    el.querySelector(".ph-go").onclick = run;
    el.querySelector(".ph-in").onkeydown = (e) => { if (e.key === "Enter") run(); };
    el.querySelectorAll(".rg-chip[data-u]").forEach((c) => (c.onclick = () => load(Number(c.dataset.u))));
    if (uid) load(uid);
  }

  // tracked: { universeId: {ms, base?} } from RoGen's own tracking (you or a friend), merged into the table
  function renderHistory(out, id, user, h, tracked, refresh) {
    const games = Object.entries(h.games).filter(([g]) => g !== "?");
    let sort = "active", q = "";
    const tr = (g) => { const x = tracked && tracked[g]; return x ? (x.ms || 0) + (x.base || 0) : 0; };
    const accountMs = Date.now() - new Date(user.created).getTime();
    const yrs = Object.keys(h.years).sort();
    const maxY = Math.max(1, ...Object.values(h.years));
    out.innerHTML = `
      <div class="pt-hhead"><img class="rg-thumb round" data-thumb="user:${id}" alt="" style="width:48px;height:48px"><div><b style="font-size:18px">${R.esc(user.displayName)}</b> <span class="rg-mute">@${R.esc(user.name)}</span><br><span class="rg-mute" style="font-size:13px">On Roblox ${span(accountMs)} · joined ${R.date(user.created)}</span></div><span style="flex:1"></span><button class="btn-control-sm ph-refresh">Refresh</button></div>
      <div class="rg-stats" style="margin:14px 0">${R.stat("Games played", R.fmt(games.length), "with at least one badge")}${R.stat("Days active", R.fmt(h.activeDays), "days a badge was earned")}${R.stat("Playing since", h.first ? new Date(h.first).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—", h.first ? span(Date.now() - h.first) + " ago" : "")}${R.stat("Badges", R.fmt(h.badges))}</div>
      ${yrs.length > 1 ? `<div class="rg-chart"><div class="rg-chart-top"><span>Activity by year</span><em>badges earned</em></div><div class="rg-bars rg-bars-sm">${yrs.map((y) => `<div title="${h.years[y]} badges in ${y}"><i style="height:${(h.years[y] / maxY) * 100}%"></i><span>${y}</span></div>`).join("")}</div></div>` : ""}
      <div class="rg-row" style="margin:14px 0 10px"><input class="rg-input ph-q" placeholder="Search games…" style="flex:1;min-width:160px"><select class="rg-select ph-sort">
        <option value="active">Most days played</option><option value="long">Played the longest</option><option value="recent">Played most recently</option><option value="old">Played first</option><option value="badges">Most badges</option>${tracked && Object.keys(tracked).length ? `<option value="tracked">Most time tracked</option>` : ""}</select></div>
      <div class="ph-table"></div>
      <p class="rg-note">Roblox doesn't share hours played with anyone, so this is rebuilt from the dates <b>${R.esc(user.displayName)}</b> earned each badge: <b>Playing for</b> is first badge → latest badge in that game, and <b>Days active</b> counts the different days they earned one. Games without badges don't show up here. ${tracked && Object.keys(tracked).length ? "<b>Tracked</b> is the exact time RoGen counted." : ""}</p>`;
    const draw = () => {
      const by = { active: (a, b) => b[1].active - a[1].active || b[1].last - a[1].last, long: (a, b) => (b[1].last - b[1].first) - (a[1].last - a[1].first), recent: (a, b) => b[1].last - a[1].last, old: (a, b) => a[1].first - b[1].first, badges: (a, b) => b[1].count - a[1].count, tracked: (a, b) => tr(b[0]) - tr(a[0]) };
      const l = games.filter(([, g]) => !q || (g.name || "").toLowerCase().includes(q)).sort(by[sort]);
      const maxA = Math.max(1, ...l.map(([, g]) => g.active));
      const showT = tracked && Object.keys(tracked).length;
      out.querySelector(".ph-table").innerHTML = l.length ? `<div class="rg-table-wrap"><table class="rg-table"><thead><tr><th>Game</th><th class="rg-num">Playing for</th><th>Days active</th><th class="rg-num">First played</th><th class="rg-num">Last played</th><th class="rg-num">Badges</th>${showT ? `<th class="rg-num">Tracked</th>` : ""}</tr></thead><tbody>
        ${l.slice(0, 400).map(([g, x]) => `<tr><td><div class="rg-cell">${/^\d+$/.test(g) ? `<img class="rg-thumb" data-thumb="game:${g}" alt="">` : ""}${gameLink(x, x.name || "Game " + g)}</div></td>
          <td class="rg-num"><b>${span(x.last - x.first)}</b></td>
          <td style="min-width:120px"><div class="rg-row" style="flex-wrap:nowrap"><div class="rg-bar" style="flex:1"><i style="width:${(x.active / maxA) * 100}%"></i></div><span class="rg-num" style="min-width:34px">${x.active}</span></div></td>
          <td class="rg-num rg-mute">${R.date(x.first)}</td><td class="rg-num rg-mute">${R.ago(x.last)}</td><td class="rg-num">${x.count}</td>${showT ? `<td class="rg-num">${tr(g) ? R.dur(tr(g)) : "—"}</td>` : ""}</tr>`).join("")}</tbody></table></div>${l.length > 400 ? `<p class="rg-note">Showing 400 of ${l.length}.</p>` : ""}`
        : `<div class="rg-empty">${games.length ? "No games match." : "No badges to build a history from."}</div>`;
      R.fillThumbs(out);
    };
    out.querySelector(".ph-q").oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
    out.querySelector(".ph-sort").onchange = (e) => { sort = e.target.value; draw(); };
    out.querySelector(".ph-refresh").onclick = refresh;
    R.fillThumbs(out.querySelector(".pt-hhead"));
    draw();
  }

  /* ---------------- the Playtime page ---------------- */
  const youView = R.views.playtime;   // the original "your games" view from page.js
  R.playtimeYou = youView;
  R.views.playtime = async (main, _q, params) => {
    const tabFromHash = () => new URLSearchParams(location.hash.split("?")[1] || "");
    const p = params || tabFromHash();
    let tab = p.get("tab") || "you";
    main.innerHTML = `<div class="rg-pagehead"><h1>Playtime</h1><p class="rg-lead">How long you and your friends play, live, plus full history going back to the start of any account.</p></div>
      <div class="rg-seg pt-seg"><button data-t="you">You</button><button data-t="friends">Friends</button><button data-t="history">Full history</button></div><div class="pt-body"></div>`;
    const show = (t, uid) => {
      tab = t;
      main.querySelectorAll(".pt-seg button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
      const body = R.h(`<div class="pt-body pt-${t}"></div>`);
      main.querySelector(".pt-body").replaceWith(body);
      const go = (id) => show("history", id);
      Promise.resolve(t === "friends" ? friendsTab(body, go) : t === "history" ? historyTab(body, uid || p.get("user")) : youView(body)).catch((e) => (body.innerHTML = R.errBox(e)));
    };
    main.querySelectorAll(".pt-seg button").forEach((b) => (b.onclick = () => show(b.dataset.t)));
    show(tab);
  };

  /* ---------------- a player's profile: their playtime ---------------- */
  R.playtimeFor = async (pane, uid) => {
    uid = Number(uid);
    const fp = await friendData();
    const u = fp && fp.users[uid];
    const live = (await liveNow())[uid];
    pane.innerHTML = `${u && u.ms ? `<div class="rg-h3" style="margin-top:0">Tracked by RoGen <span class="rg-mute" style="font-weight:500;font-size:13px">since ${R.date(u.first)}${live ? ` · <span class="rg-good">playing ${R.esc(live.name || "a game")} now</span>` : ""}</span></div>
        <div class="rg-stats" style="margin-bottom:10px">${R.stat("Time played", R.dur(u.ms))}${R.stat("Games", Object.keys(u.games || {}).length)}${R.stat("Last in a game", live ? "Now" : R.ago(u.last))}</div>${trackedDetail(u)}<div class="rg-h3">Full history</div>` : ""}
      <div class="pf-hist"></div>`;
    R.fillThumbs(pane);
    const out = pane.querySelector(".pf-hist");
    const load = async (force) => {
      out.innerHTML = `<div class="rg-loading">Loading…</div>`;
      try {
        const [usr, h] = await Promise.all([R.api(`https://users.roblox.com/v1/users/${uid}`), R.playHistory(uid, { force, onProgress: (t) => (out.innerHTML = `<div class="rg-loading">${R.esc(t)}</div>`) })]);
        renderHistory(out, uid, usr, h, u ? u.games : {}, () => load(true));
      } catch (e) { out.innerHTML = /403/.test(e.message) ? `<div class="rg-empty">This player's inventory is private, so Roblox doesn't share their badges.</div>` : R.errBox(e); }
    };
    load(false);
  };
})();
