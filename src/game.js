// Game pages: stats, owner, copylock, live players, servers, passes, badges, history, similar, notes, bookmarks, alerts
(() => {
  const R = window.Rogen;

  R.gamePasses = async (universeId) => {
    try {
      const out = [];
      let token = "";
      for (let i = 0; i < 10; i++) {
        const d = await R.api(`https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes?passView=Full&pageSize=100${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`);
        out.push(...(d.gamePasses || d.data || []));
        token = d.nextPageToken || "";
        if (!token) break;
      }
      return out.map((g) => ({ id: g.id ?? g.gamePassId, name: g.name ?? g.displayName, price: g.price ?? null, forSale: !!(g.isForSale ?? g.price != null), owned: g.isOwned }));
    } catch (e) {
      const d = await R.pages((c) => `https://games.roblox.com/v1/games/${universeId}/game-passes?limit=100&sortOrder=Asc${c ? `&cursor=${c}` : ""}`, { max: 10 });
      return d.map((g) => ({ id: g.id, name: g.name || g.displayName, price: g.price ?? null, forSale: g.price != null }));
    }
  };

  R.similarGames = async (name, excludeUid) => {
    const words = name.replace(/\[[^\]]*\]|\([^)]*\)|[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2).slice(0, 3).join(" ");
    const d = await R.api(`https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(words || name)}&sessionId=${crypto.randomUUID()}&pageType=all`);
    const out = [];
    for (const g of d.searchResults || []) if (!g.contentGroupType || g.contentGroupType === "Game") out.push(...(g.contents || []));
    return out.filter((g) => g.universeId !== excludeUid).slice(0, 24);
  };

  R.normGame = (g) => ({
    universeId: g.universeId ?? g.id,
    placeId: g.rootPlaceId ?? g.placeId ?? g.rootPlace?.id,
    name: g.name || "Untitled",
    players: g.playerCount ?? g.playing ?? 0,
    up: g.totalUpVotes ?? 0,
    down: g.totalDownVotes ?? 0
  });

  R.route((p) => R.feat("gameTab") && /^\/games\/\d+/i.test(p), () => {
    const placeId = Number(location.pathname.match(/\/games\/(\d+)/)[1]);
    let uid = null, game = null, live = [], liveTimer = null;

    const sec = R.section({
      id: "rg-game",
      title: "Game Insights",
      lazy: true,
      right: `<span class="rg-ids">${R.copy(placeId, "Place")}</span>`,
      tabs: [
        { id: "stats", label: "Stats", render: stats },
        { id: "servers", label: "Servers", render: servers },
        { id: "passes", label: "Game Passes", render: passes },
        { id: "badges", label: "Badges", render: badges },
        { id: "hist", label: "History", render: history },
        { id: "save", label: "Save & Alerts", render: saveTab },
      ]
    });

    let readyP = null;
    function ready() {
      if (!readyP) readyP = (async () => {
        uid = await R.universeOf(placeId);
        const [g] = await R.games([uid]);
        game = g;
        sec.querySelector(".rg-ids").innerHTML = `${R.copy(placeId, "Place")} ${R.copy(uid, "Universe")} ${R.copy(g.creator.id, g.creator.type === "Group" ? "Group" : "Creator")}`;
        R.recent.add({ kind: "game", id: uid, placeId, name: g.name, url: `https://www.roblox.com/games/${placeId}` });
        // Record history on every visit, even if the RoGen tab isn't opened
        R.snap(`game:${uid}`, { visits: g.visits, playing: g.playing, favorites: g.favoritedCount });
        R.snap(`gameText:${uid}`, { name: g.name, description: g.description || "", updated: g.updated }, { textOnly: true, max: 200 });
        return g;
      })();
      return readyP;
    }
    ready().catch(() => {});

    async function stats(pane) {
      const g = await ready();
      const votes = (await R.votes([uid]))[uid] || {};
      let owner = { name: g.creator.name, id: g.creator.id, type: g.creator.type };
      let groupOwner = null;
      if (g.creator.type === "Group") {
        const grp = await R.api(`https://groups.roblox.com/v1/groups/${g.creator.id}`).catch(() => null);
        groupOwner = grp && grp.owner;
      }
      await R.snap(`game:${uid}`, { visits: g.visits, playing: g.playing, favorites: g.favoritedCount, up: votes.upVotes, down: votes.downVotes });
      const total = (votes.upVotes || 0) + (votes.downVotes || 0);
      const like = total ? Math.round((votes.upVotes / total) * 1000) / 10 : null;
      // Start the live graph from saved history (last 7 days), then add a point every minute
      live = (await R.hist(`game:${uid}`)).filter((x) => x.playing != null && Date.now() - x.t < 7 * 864e5).map((x) => ({ t: x.t, v: x.playing }));
      if (!live.length || Date.now() - live[live.length - 1].t > 30e3) live.push({ t: Date.now(), v: g.playing });
      pane.innerHTML = `
        <div class="rg-stats">
          ${R.stat("Playing now", `<span class="rg-live">${R.fmt(g.playing)}</span>`)}
          ${R.stat("Visits", R.short(g.visits), R.fmt(g.visits))}
          ${R.stat("Favorites", R.short(g.favoritedCount), R.fmt(g.favoritedCount))}
          ${R.stat("Rating", like == null ? "—" : like + "%", `${R.short(votes.upVotes)} likes · ${R.short(votes.downVotes)} dislikes`)}
          ${R.stat("Server size", R.fmt(g.maxPlayers))}
          ${R.stat("Created", R.date(g.created), R.ago(g.created))}
          ${R.stat("Last updated", R.ago(g.updated), R.dateTime(g.updated))}
          ${R.stat("Genre", R.esc(g.genre_l1 || g.genre || "—"), R.esc(g.genre_l2 || ""))}
        </div>
        <div class="rg-h3">Owner</div>
        <div class="rg-row">
          <a class="rg-link" href="https://www.roblox.com/${owner.type === "Group" ? "communities" : "users"}/${owner.id}${owner.type === "Group" ? "" : "/profile"}">${R.esc(owner.name)}</a>
          <span class="rg-badge">${owner.type === "Group" ? "Group game" : "Player game"}</span>
          ${g.creator.hasVerifiedBadge ? `<span class="rg-badge acc">Verified</span>` : ""}
          ${groupOwner ? `<span class="rg-mute">· group owned by <a class="rg-link" href="https://www.roblox.com/users/${groupOwner.userId}/profile">@${R.esc(groupOwner.username)}</a></span>` : ""}
        </div>
        <div class="rg-h3">Copying</div>
        <div>${g.copyingAllowed ? `<span class="rg-badge good">Uncopylocked</span> <span class="rg-mute">The creator allows anyone to copy this place in Studio.</span>` : `<span class="rg-badge">Copylocked</span> <span class="rg-mute">This place can't be copied.</span>`}</div>
        <div class="rg-h3">Live players</div>
        <div class="rg-livechart">${R.chart(live, { label: "Players — updates every minute while this tab is open" })}</div>
        ${g.price ? `<p class="rg-note">Paid access: ${R.robux(g.price)}</p>` : ""}`;
      clearInterval(liveTimer);
      liveTimer = setInterval(async () => {
        if (!document.contains(pane) || document.hidden) return;
        try {
          const [x] = await R.games([uid]);
          live.push({ t: Date.now(), v: x.playing });
          pane.querySelector(".rg-live").textContent = R.fmt(x.playing);
          pane.querySelector(".rg-livechart").innerHTML = R.chart(live, { label: "Players — updates every minute while this tab is open" });
          R.snap(`game:${uid}`, { visits: x.visits, playing: x.playing, favorites: x.favoritedCount, up: votes.upVotes, down: votes.downVotes });
        } catch (e) { /* skip a tick */ }
      }, 60000);
    }

    async function servers(pane) {
      await ready();
      let list = [], cursor = "", loading = false;
      pane.innerHTML = `<div class="rg-toolbar">
          <label class="rg-field">Show<select class="rg-select s-sort"><option value="most">Fullest servers first</option><option value="least">Emptiest servers first</option><option value="ping">Best ping</option><option value="fps">Smoothest (FPS)</option></select></label>
          <label class="rg-check"><input type="checkbox" class="s-space" checked> Hide full servers</label>
          <button class="btn-control-sm s-refresh">Refresh</button>
        </div><div class="s-list rg-loading">Finding servers…</div><div class="rg-row" style="justify-content:center;margin-top:12px"><button class="btn-control-sm s-more" hidden>Load more servers</button></div>`;
      const $ = (q) => pane.querySelector(q);
      const draw = () => {
        const sort = $(".s-sort").value;
        const f = { most: (a, b) => b.playing - a.playing, least: (a, b) => a.playing - b.playing, ping: (a, b) => (a.ping ?? 999) - (b.ping ?? 999), fps: (a, b) => (b.fps ?? 0) - (a.fps ?? 0) }[sort];
        const l = [...list].filter((s) => !$(".s-space").checked || s.playing < s.maxPlayers).sort(f);
        const el = $(".s-list");
        el.className = "s-list";
        el.innerHTML = l.length ? `<div class="rg-table-wrap"><table class="rg-table"><thead><tr><th>Players</th><th></th><th class="rg-num">Ping</th><th class="rg-num">FPS</th><th></th></tr></thead><tbody>
          ${l.map((s) => `<tr><td style="white-space:nowrap;font-weight:700">${s.playing} / ${s.maxPlayers}</td>
            <td style="width:40%"><div class="rg-bar"><i style="width:${Math.round((s.playing / s.maxPlayers) * 100)}%"></i></div></td>
            <td class="rg-num">${s.ping != null ? s.ping + " ms" : "—"}</td><td class="rg-num">${s.fps != null ? Math.round(s.fps) : "—"}</td>
            <td class="rg-num" style="white-space:nowrap"><a class="btn-primary-sm" href="roblox://experiences/start?placeId=${placeId}&gameInstanceId=${R.esc(s.id)}">Join</a> <button class="btn-control-sm" data-copy="${R.esc(s.id)}" title="Copy server ID">Copy ID</button></td></tr>`).join("")}
          </tbody></table></div><p class="rg-note">${l.length} servers shown. Join opens the Roblox app straight into that exact server.</p>` : `<div class="rg-empty">No open servers found right now. Try Refresh in a moment.</div>`;
        $(".s-more").hidden = !cursor;
      };
      const load = async (reset) => {
        if (loading) return;
        loading = true;
        if (reset) { list = []; cursor = ""; $(".s-list").className = "s-list rg-loading"; $(".s-list").textContent = "Finding servers…"; }
        const order = $(".s-sort").value === "least" ? "Asc" : "Desc";
        const excl = $(".s-space").checked;
        try {
          const d = await R.api(`https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=${order}&excludeFullGames=${excl}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
          const seen = new Set(list.map((s) => s.id));
          list.push(...(d.data || []).filter((s) => !seen.has(s.id)));
          cursor = d.nextPageCursor || "";
          draw();
        } catch (e) { $(".s-list").innerHTML = R.errBox(e); }
        loading = false;
      };
      $(".s-sort").onchange = () => load(true);
      $(".s-space").onchange = () => load(true);
      $(".s-refresh").onclick = () => load(true);
      $(".s-more").onclick = () => load(false);
      load(true);
    }

    async function passes(pane) {
      await ready();
      const list = await R.gamePasses(uid);
      if (!list.length) { pane.innerHTML = `<div class="rg-empty">This game has no game passes.</div>`; return; }
      const me = R.me();
      const owned = {};
      list.forEach((p) => { if (p.owned != null) owned[p.id] = !!p.owned; });
      if (me) await Promise.all(list.filter((p) => p.owned == null).slice(0, 40).map((p) =>
        R.api(`https://inventory.roblox.com/v1/users/${me.id}/items/GamePass/${p.id}/is-owned`).then((v) => (owned[p.id] = v === true)).catch(() => {})));
      const hist = {};
      for (const p of list) hist[p.id] = await R.snap(`pass:${p.id}`, { price: p.price }, { textOnly: true, max: 60 });
      const forSale = list.filter((p) => p.price);
      const left = forSale.filter((p) => !owned[p.id]).reduce((t, p) => t + p.price, 0);
      pane.innerHTML = `<div class="rg-stats" style="margin-bottom:12px">
          ${R.stat("Game passes", list.length)}
          ${me ? R.stat("You own", Object.values(owned).filter(Boolean).length) : ""}
          ${R.stat("Cost of all", R.robux(forSale.reduce((t, p) => t + p.price, 0)))}
          ${R.stat("Left to buy", R.robux(left))}
        </div>
        <div class="rg-table-wrap"><table class="rg-table"><thead><tr><th>Pass</th><th class="rg-num">Price</th><th>Price history</th><th>Owned</th></tr></thead><tbody>
        ${list.sort((a, b) => (b.price || 0) - (a.price || 0)).map((p) => {
          const h = hist[p.id].filter((x) => x.price != null);
          const changes = h.length > 1 ? h.map((x) => `${R.date(x.t)}: R$${R.fmt(x.price)}`).join(" → ") : `<span class="rg-mute">No price changes seen yet</span>`;
          return `<tr><td><img class="rg-thumb" data-thumb="gamepass:${p.id}"> <a href="https://www.roblox.com/game-pass/${p.id}" target="_blank">${R.esc(p.name)}</a></td>
            <td class="rg-num">${p.price ? R.robux(p.price) : `<span class="rg-mute">Offsale</span>`}</td>
            <td style="font-size:12px">${changes}</td>
            <td>${owned[p.id] ? `<span class="rg-badge good">Owned</span>` : ""}</td></tr>`;
        }).join("")}</tbody></table></div>
        <p class="rg-note">Price history starts the first time you open this tab and records every change after that.</p>`;
      R.fillThumbs(pane);
    }

    async function badges(pane) {
      await ready();
      await R.renderBadges(pane, uid);
    }

    async function history(pane) {
      const g = await ready();
      await R.snap(`gameText:${uid}`, { name: g.name, description: g.description || "", updated: g.updated }, { textOnly: true, max: 200 });
      try {
        const t = await R.api(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${uid}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`);
        const th = t.data?.[0]?.thumbnails?.[0];
        if (th) await R.snap(`gameThumb:${uid}`, { tid: String(th.targetId), url: th.imageUrl }, { textOnly: true, max: 40 });
      } catch (e) { /* optional */ }
      const text = (await R.hist(`gameText:${uid}`)).slice().reverse();
      const thumbs = (await R.hist(`gameThumb:${uid}`)).slice().reverse();
      const nums = await R.hist(`game:${uid}`);
      const updates = [...new Set(text.map((x) => x.updated))];
      pane.innerHTML = `<div class="rg-2col">
        <div>
          <div class="rg-h3">Update history <span class="rg-sub">${updates.length} seen</span></div>
          <ul class="rg-timeline">${updates.map((u) => `<li><b>Updated</b><time>${R.dateTime(u)} · ${R.ago(u)}</time></li>`).join("")}</ul>
          <div class="rg-h3">Name & description changes</div>
          <ul class="rg-timeline">${text.map((x, i) => {
            const prev = text[i + 1];
            const bits = [];
            if (!prev) bits.push("First seen by RoGen");
            else {
              if (prev.name !== x.name) bits.push(`Renamed: <b>${R.esc(prev.name)}</b> → <b>${R.esc(x.name)}</b>`);
              if (prev.description !== x.description) bits.push("Description changed");
              if (!bits.length) return "";
            }
            return `<li><time>${R.dateTime(x.t)}</time>${bits.join("<br>")}<div class="rg-desc">${R.esc(x.description)}</div></li>`;
          }).join("")}</ul>
        </div>
        <div>
          <div class="rg-h3">Visits & favorites</div>
          ${R.chart(nums.map((x) => ({ t: x.t, v: x.visits })), { label: "Visits" })}
          ${R.chart(nums.map((x) => ({ t: x.t, v: x.favorites })), { label: "Favorites" })}
          ${R.chart(nums.map((x) => ({ t: x.t, v: x.playing })), { label: "Players" })}
          <div class="rg-h3">Thumbnail history</div>
          <ul class="rg-timeline">${thumbs.map((x) => `<li><time>${R.dateTime(x.t)}</time><img src="${R.esc(x.url)}" alt=""></li>`).join("") || `<li>No thumbnails recorded yet.</li>`}</ul>
        </div></div>
        <p class="rg-note">RoGen records history every time you (or your alerts) check this game. Bookmark it or turn on alerts to track it in the background.</p>`;
    }

    async function similar(pane) {
      const g = await ready();
      const list = (await R.similarGames(g.name, uid)).map(R.normGame);
      pane.innerHTML = list.length ? R.tileGrid(list.map((x) => R.gameTile(x)).join("")) : `<div class="rg-empty">No similar games found.</div>`;
      R.fillThumbs(pane);
    }

    async function saveTab(pane) {
      const g = await ready();
      const w = (await R.watch.games())[uid] || {};
      pane.innerHTML = `<div class="rg-h3">Bookmark</div><div class="bm"></div>
        <div class="rg-h3">Alerts</div>
        <label class="rg-check"><input type="checkbox" class="w-upd" ${w.updates ? "checked" : ""}> Notify me when this game updates</label><br><br>
        <div class="rg-row"><label class="rg-check"><input type="checkbox" class="w-pl" ${w.playerAlert ? "checked" : ""}> Notify me when players go above</label>
          <input class="rg-input w-num" type="number" min="1" style="width:120px" value="${w.playerAlert || Math.max(100, Math.round((g.playing * 1.5) / 100) * 100)}"></div>
        <p class="rg-note">Alerts are checked every 5 minutes while Chrome is open. Watched games also keep their history up to date.</p>`;
      R.bookmarkControl(pane.querySelector(".bm"), { id: uid, kind: "game", placeId, name: g.name });
      const save = () => {
        const upd = pane.querySelector(".w-upd").checked;
        const pl = pane.querySelector(".w-pl").checked ? Number(pane.querySelector(".w-num").value) : 0;
        R.watch.setGame(uid, upd || pl ? { placeId, name: g.name, updates: upd, playerAlert: pl, lastUpdated: g.updated } : null);
        R.toast(upd || pl ? "Alerts saved" : "Alerts off");
      };
      pane.querySelectorAll("input").forEach((i) => (i.onchange = save));
    }

    // A "RoGen" tab next to About / Store / Servers
    const pane = R.h(`<div class="tab-pane rg-pane" id="rogen"></div>`);
    pane.appendChild(sec);
    let tab = null;
    const place = () => {
      if (tab && document.contains(tab.li)) return;
      const ul = document.querySelector("#horizontal-tabs");
      const content = document.querySelector(".rbx-tab-content");
      if (ul && content) {
        const li = R.h(`<li id="tab-rogen" class="rbx-tab tab-rogen"><a class="rbx-tab-heading" href="#rogen"><span class="text-lead"><span class="rg-logo rg-tab-logo"></span>RoGen</span></a></li>`);
        tab = R.nativeTab({
          ul, li, pane,
          tabEl: (l) => l,
          nativeTabs: () => [...ul.querySelectorAll("li.rbx-tab:not(.rg-native-tab)")],
          panes: () => [...content.children].filter((c) => c.classList.contains("tab-pane")),
          placePane: (p) => content.appendChild(p),
          equalize: (lis) => lis.forEach((l) => (l.style.width = 100 / lis.length + "%")),
          onOpen: () => sec.activate()
        });
        tab.li = li;
      } else if (!document.contains(sec)) {
        // Fallback if Roblox changes the page: show as a section under the game info
        const main = document.querySelector(".game-main-content");
        if (main) { pane.style.display = ""; main.insertAdjacentElement("afterend", pane); sec.activate(); }
      }
    };
    place();
    return { tick: place, stop: () => { clearInterval(liveTimer); pane.remove(); tab && tab.li.remove(); } };
  });
})();
