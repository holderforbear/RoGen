// Dashboard widgets that also live on the normal Roblox pages where they belong:
//   Spending  → bottom of roblox.com/transactions
//   Unadds    → bottom of the Friends page
//   Home, Charts, Catalog, Robux, Search, Account and your profile → see places.js
// The same functions fill the cards on the RoGen dashboard, so there is one copy of each.
(() => {
  const R = window.Rogen;
  R.widgets = R.widgets || {};

  /* ---------------- shared purchase helpers (used by Spending everywhere) ---------------- */
  R.spent = (x) => Math.abs(x.currency?.amount || 0);
  R.txKey = (x) => x.idHash || x.id || `${x.created}|${x.details?.id}|${x.currency?.amount}`;
  R.gameOf = (x) => (x.details?.place ? { uid: x.details.place.universeId, placeId: x.details.place.placeId, name: x.details.place.name } : null);
  R.rates = async () => ({ buy: 0.0125, devex: 0.0038, ...(await R.get1("rates", {})) });

  R.loadTransactions = async (me, onProgress, stopRef) => {
    const existing = await R.get1("tx", []);
    const known = new Set(existing.map(R.txKey));
    const fresh = [];
    let cursor = "";
    for (let i = 0; i < 500; i++) {
      if (stopRef.stop) break;
      const d = await R.api(`https://economy.roblox.com/v2/users/${me.id}/transactions?limit=100&transactionType=Purchase&itemPricingType=PaidAndLimited${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      let hitKnown = false;
      for (const x of d.data || []) {
        if (x.currency?.type && x.currency.type !== "Robux") continue;
        if (known.has(R.txKey(x))) { hitKnown = true; continue; }
        fresh.push({ idHash: R.txKey(x), created: x.created, isPending: x.isPending, agent: x.agent, details: x.details, currency: x.currency });
      }
      onProgress(fresh.length + existing.length);
      cursor = d.nextPageCursor || "";
      if (!cursor || hitKnown) break;
      await R.sleep(250);
    }
    const all = [...fresh, ...existing].sort((a, b) => new Date(b.created) - new Date(a.created));
    await R.set({ tx: all, txSynced: Date.now() });
    return all;
  };

  // One sync at a time, however many places ask for it
  let syncing = null;
  R.syncPurchases = (me, onProgress = () => {}, stopRef = { stop: false }) => {
    if (!syncing) syncing = R.loadTransactions(me, onProgress, stopRef).finally(() => (syncing = null));
    return syncing;
  };

  const monthsBack = (n) => {
    const out = [];
    for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); out.push([d.getFullYear(), d.getMonth()]); }
    return out;
  };
  const sumMonth = (tx, [y, m]) => tx.filter((x) => { const d = new Date(x.created); return d.getFullYear() === y && d.getMonth() === m; }).reduce((t, x) => t + R.spent(x), 0);
  const monthBars = (tx, n, small) => {
    const months = monthsBack(n);
    const sums = months.map((m) => sumMonth(tx, m));
    const max = Math.max(...sums, 1);
    return `<div class="rg-bars ${small ? "rg-bars-sm" : ""}">${sums.map((v, i) => `<div title="${new Date(months[i][0], months[i][1]).toLocaleString(undefined, { month: "long", year: "numeric" })}: R$${R.fmt(v)}"><i style="height:${Math.max(3, (v / max) * 100)}%"></i><span>${new Date(months[i][0], months[i][1]).toLocaleString(undefined, { month: "short" })}</span></div>`).join("")}</div>`;
  };

  /* ---------------- Spending: compact card (RoGen dashboard) ---------------- */
  R.widgets.spendingCard = async (el, me) => {
    const [m, tx] = await Promise.all([
      R.api(`https://economy.roblox.com/v2/users/${me.id}/transaction-totals?timeFrame=Month&transactionType=summary`).catch(() => null),
      R.get1("tx", [])
    ]);
    const thisMonth = sumMonth(tx, monthsBack(1)[0]);
    el.innerHTML = `<div class="rg-kpi-v" style="font-size:26px">${R.robux(m ? Math.abs(m.purchasesTotal || 0) : thisMonth)}</div><div class="rg-kpi-l">spent this month</div>
      ${tx.length ? monthBars(tx, 6, true) : `<p class="rg-note">Open <a class="rg-link" href="/rogen#spending">Spending</a> once to load your full history.</p>`}`;
  };

  /* ---------------- Spending: full section (roblox.com/transactions) ---------------- */
  // sec = an R.section() with .sw-sync / .sw-state in its header
  R.widgets.spendingFull = async (sec) => {
    const me = R.me();
    const body = sec.querySelector(".rg-body");
    if (!me) { body.innerHTML = `<div class="rg-empty">Log in to see your spending.</div>`; return; }
    const state = sec.querySelector(".sw-state"), btn = sec.querySelector(".sw-sync");
    const draw = async () => {
      const [tx, synced, r, cur] = await Promise.all([
        R.get1("tx", []), R.get1("txSynced", 0), R.rates(),
        R.api(`https://economy.roblox.com/v1/users/${me.id}/currency`).catch(() => null)
      ]);
      state.textContent = synced ? `Synced ${R.ago(synced)}` : "Not synced yet";
      if (!tx.length) {
        body.innerHTML = `<div class="rg-empty">${syncing ? "Loading your purchase history…" : "Press <b>Sync</b> to load your purchase history. The first sync can take a minute."}</div>`;
        return;
      }
      const now = new Date();
      const total = tx.reduce((t, x) => t + R.spent(x), 0);
      const thisMonth = sumMonth(tx, [now.getFullYear(), now.getMonth()]);
      const lastMonth = sumMonth(tx, monthsBack(2)[0]);
      const thisYear = tx.filter((x) => new Date(x.created).getFullYear() === now.getFullYear()).reduce((t, x) => t + R.spent(x), 0);
      const byGame = new Map();
      for (const x of tx) {
        const g = R.gameOf(x);
        const key = g ? g.uid : "shop:" + (x.details?.type || "Other");
        const e = byGame.get(key) || { g, label: g ? g.name : (x.details?.type === "Asset" ? "Avatar Shop" : (x.details?.type || "Other")), total: 0, count: 0 };
        e.total += R.spent(x); e.count++;
        byGame.set(key, e);
      }
      const top = [...byGame.values()].sort((a, b) => b.total - a.total).slice(0, 6);
      const diff = thisMonth - lastMonth;
      body.innerHTML = `<div class="rg-stats">
          ${cur ? R.stat("Your Robux", `<span class="rg-my-robux">${R.robux(cur.robux)}</span>`, `≈ $${(cur.robux * r.devex).toFixed(2)} DevEx value`) : ""}
          ${R.stat("Spent this month", R.robux(thisMonth), lastMonth ? `<span class="${diff > 0 ? "rg-bad" : "rg-good"}">${diff > 0 ? "+" : "−"}${R.short(Math.abs(diff))}</span> vs last month` : "")}
          ${R.stat("Spent this year", R.robux(thisYear))}
          ${R.stat("Lifetime spent", R.robux(total), `≈ $${(total * r.buy).toFixed(2)} to buy`)}
          ${R.stat("Purchases", R.fmt(tx.length), `avg ${R.robux(Math.round(total / tx.length))}`)}
        </div>
        <div class="rg-chart"><div class="rg-chart-top"><span>Robux spent per month</span></div>${monthBars(tx, 12, false)}</div>
        <div class="rg-h3">Where it went</div>
        <div class="rg-table-wrap"><table class="rg-table"><tbody>
          ${top.map((e) => `<tr><td>${e.g ? `<img class="rg-thumb" data-thumb="game:${e.g.uid}"> <a href="https://www.roblox.com/games/${e.g.placeId}">${R.esc(e.label)}</a>` : `<span style="font-weight:600">${R.esc(e.label)}</span>`}</td>
            <td class="rg-mute rg-num">${R.fmt(e.count)} purchase${e.count === 1 ? "" : "s"}</td><td class="rg-num">${R.robux(e.total)}</td></tr>`).join("")}
        </tbody></table></div>`;
      R.fillThumbs(body);
    };
    const sync = async () => {
      btn.disabled = true;
      try { await R.syncPurchases(me, (n) => (state.textContent = `Loading… ${R.fmt(n)} purchases`)); }
      catch (e) { R.toast("Sync failed: " + e.message); }
      btn.disabled = false;
      if (document.contains(sec)) draw();
    };
    btn.onclick = sync;
    await draw();
    const last = await R.get1("txSynced", 0);
    if (!last || Date.now() - last > 6 * 3600e3) sync();
  };

  /* ---------------- Unadded you ---------------- */
  R.widgets.unadds = async (el, me, limit = 5) => {
    const un = (await R.get1("unadded", [])).filter((u) => !u.byMe && u.id !== me.id).slice(0, limit);
    el.innerHTML = un.length ? `<div class="rg-list">${un.map((u) => `<a class="rg-li" href="https://www.roblox.com/users/${u.id}/profile">
        <img class="rg-thumb round" data-thumb="user:${u.id}" alt=""><span class="rg-li-main"><b>${R.esc(u.displayName)}</b><small>@${R.esc(u.name)}</small></span><span class="rg-li-end">${R.ago(u.at)}</span></a>`).join("")}</div>`
      : `<div class="rg-empty">Nobody has unadded you.</div>`;
    R.fillThumbs(el);
  };

  /* ---------------- Jump back in / Most played ---------------- */
  R.widgets.recent = async (el, n = 6) => {
    const rec = (await R.recent.all()).filter((r) => r.kind === "game").slice(0, n);
    if (!rec.length) { el.innerHTML = `<div class="rg-empty">Games you open show up here.</div>`; return; }
    const det = await R.games(rec.map((r) => r.id)).catch(() => []);
    const byId = Object.fromEntries(det.map((g) => [g.id, g]));
    el.innerHTML = R.tileGrid(rec.map((r) => R.gameTile({ universeId: r.id, placeId: r.placeId, name: byId[r.id]?.name || r.name, players: byId[r.id]?.playing ?? null, up: 0, down: 0, extra: `Viewed ${R.ago(r.at)}` })).join(""));
    R.fillThumbs(el);
  };
  R.widgets.played = async (el, n = 5) => {
    const pt = Object.entries(await R.get1("playtime", {})).sort((a, b) => R.playMs(b[1]) - R.playMs(a[1])).slice(0, n);
    el.innerHTML = pt.length ? `<div class="rg-list">${pt.map(([uid, p]) => `<a class="rg-li" ${p.placeId ? `href="https://www.roblox.com/games/${p.placeId}"` : ""}>
        ${/^\d+$/.test(uid) ? `<img class="rg-thumb" data-thumb="game:${uid}" alt="">` : ""}<span class="rg-li-main"><b>${R.esc(p.name || "Game")}</b><span class="rg-bar"><i style="width:${(R.playMs(p) / R.playMs(pt[0][1])) * 100}%"></i></span></span><span class="rg-li-end">${R.dur(R.playMs(p))}</span></a>`).join("")}</div>`
      : `<div class="rg-empty">Play something. RoGen counts your time while Chrome is open.</div>`;
    R.fillThumbs(el);
  };

  /* ---------------- mounting on Roblox's own pages ---------------- */
  // Keeps `node` as the last thing in the page's main content (Roblox draws its own content late and re-renders).
  // (gives up after a few moves so it can never fight with the page)
  // Roblox's content area is sometimes a flex/grid row (Home is). Put our block on its own full-width row
  // underneath, instead of letting it become a squeezed column beside the page.
  const keepAtBottom = (node) => {
    let moves = 0;
    const fit = (host) => {
      const d = getComputedStyle(host).display;
      node.style.minWidth = "0";
      if (d.includes("flex")) {
        node.style.flex = "0 0 100%";
        node.style.width = "100%";
        node.style.order = "9999";
        node.style.boxSizing = "border-box";
        if (getComputedStyle(host).flexWrap === "nowrap") host.style.flexWrap = "wrap";
      } else if (d.includes("grid")) {
        node.style.gridColumn = "1 / -1";
      }
    };
    return () => {
      const host = R.mainContent();
      if (!host || moves > 8) return;
      if (!host.contains(node) || host.lastElementChild !== node) { moves++; host.appendChild(node); }
      fit(host);
    };
  };

  R.keepAtBottom = keepAtBottom;

  // /transactions → Spending at the bottom
  R.route((p) => p === "/transactions", () => {
    if (!R.me()) return {};
    const sec = R.section({
      id: "rg-spending",
      title: "Spending insights",
      sub: "by RoGen",
      right: `<span class="rg-mute sw-state" style="font-size:13px"></span><button class="btn-control-sm sw-sync">Sync</button><a class="rg-link" href="https://www.roblox.com/rogen#spending">Full breakdown</a>`
    });
    sec.classList.add("rg-native-block");
    const place = keepAtBottom(sec);
    place();
    R.widgets.spendingFull(sec);
    return { tick: place, stop: () => sec.remove() };
  });

  // Friends page → who unadded you + friend count graph at the bottom
  R.route((p) => /^\/users\/(friends|\d+\/friends)/.test(p), () => {
    const me = R.me();
    if (!me) return {};
    const sec = R.section({
      id: "rg-friends",
      title: "Unadded you",
      sub: "by RoGen",
      right: `<button class="btn-control-sm fw-check">Check now</button><a class="rg-link" href="https://www.roblox.com/rogen#friends?tab=unadds">See all</a>`
    });
    sec.classList.add("rg-native-block");
    const body = sec.querySelector(".rg-body");
    body.innerHTML = `<div class="fw-list"><div class="rg-loading">Loading…</div></div><div class="fw-graph"></div>`;
    const draw = async () => {
      await R.widgets.unadds(body.querySelector(".fw-list"), me, 8);
      try {
        const c = await R.api(`https://friends.roblox.com/v1/users/${me.id}/friends/count`);
        await R.snap(`user:${me.id}`, { friends: c.count });
        const h = (await R.hist(`user:${me.id}`)).filter((x) => x.friends != null);
        body.querySelector(".fw-graph").innerHTML = R.chart(h.map((x) => ({ t: x.t, v: x.friends })), { label: "Your friends over time" });
      } catch (e) { /* graph is optional */ }
    };
    sec.querySelector(".fw-check").onclick = async (e) => {
      e.currentTarget.disabled = true;
      const r = await R.checkFriends({ force: true });
      R.toast(r.ok ? (r.removed ? `${r.removed} new unadd${r.removed === 1 ? "" : "s"}` : "No changes") : r.reason || "Failed");
      e.currentTarget.disabled = false;
      draw();
    };
    const place = keepAtBottom(sec);
    place();
    draw();
    return { tick: place, stop: () => sec.remove() };
  });
})();
