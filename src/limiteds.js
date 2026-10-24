// Limiteds: "will it go up?" outlook from Roblox's own sale history,
// and catalog search that puts THE REAL item first (e.g. "headless" → Roblox's Headless Horseman, copies tucked away).
(() => {
  const R = window.Rogen;
  const DAY = 864e5;
  const clamp = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x));
  const mean = (a) => (a.length ? a.reduce((t, x) => t + x, 0) / a.length : 0);
  const pct = (x, d = 0) => `${x > 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;

  /* =====================================================================
     OUTLOOK
     ===================================================================== */
  // Price change per 30 days, from a straight line through log(price)
  const trend = (pts) => {
    if (pts.length < 5) return null;
    const t0 = pts[0].t;
    const xs = pts.map((p) => (p.t - t0) / DAY), ys = pts.map((p) => Math.log(Math.max(1, p.v)));
    const mx = mean(xs), my = mean(ys);
    let num = 0, den = 0;
    xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
    return den ? Math.exp((num / den) * 30) - 1 : null;
  };
  const resale = async (id) => {
    try { return await R.api(`https://economy.roblox.com/v1/assets/${id}/resale-data`); } catch (e) {
      // Newer (UGC) limiteds keep their history under the collectible ID
      const d = await R.api("https://catalog.roblox.com/v1/catalog/items/details", { method: "POST", body: { items: [{ itemType: "Asset", id }] } }).then((x) => (x.data || [])[0]);
      if (!d || !d.collectibleItemId) throw e;
      return R.api(`https://apis.roblox.com/marketplace-sales/v1/item/${d.collectibleItemId}/resale-data`);
    }
  };
  const lowestOf = async (id) => {
    const d = await R.api("https://catalog.roblox.com/v1/catalog/items/details", { method: "POST", body: { items: [{ itemType: "Asset", id }] } }).then((x) => (x.data || [])[0] || {}).catch(() => ({}));
    return d.lowestPrice ?? d.lowestResalePrice ?? null;
  };
  const cache = new Map();
  R.limitedOutlook = (id, lowestKnown) => {
    if (cache.has(id) && Date.now() - cache.get(id).t < 10 * 60e3) return cache.get(id).p;
    const p = (async () => {
      const [rs, low] = await Promise.all([resale(id), lowestKnown != null ? lowestKnown : lowestOf(id)]);
      const now = Date.now();
      const pts = (rs.priceDataPoints || []).map((x) => ({ t: new Date(x.date).getTime(), v: x.value })).filter((x) => x.v > 0).sort((a, b) => a.t - b.t);
      const vol = (rs.volumeDataPoints || []).map((x) => ({ t: new Date(x.date).getTime(), v: x.value })).sort((a, b) => a.t - b.t);
      const within = (a, from, to = 0) => a.filter((x) => now - x.t <= from * DAY && now - x.t > to * DAY);
      const rap = rs.recentAveragePrice || 0;
      const t30 = trend(within(pts, 30)), t90 = trend(within(pts, 90));
      const a7 = mean(within(pts, 7).map((x) => x.v)), a30 = mean(within(pts, 30).map((x) => x.v));
      const mom = a7 && a30 ? a7 / a30 - 1 : null;
      const gap = low && rap ? low / rap - 1 : null;
      const s30 = within(vol, 30).reduce((t, x) => t + x.v, 0), sPrev = within(vol, 60, 30).reduce((t, x) => t + x.v, 0);
      const demand = sPrev > 0 ? s30 / sPrev - 1 : null;
      const rets = within(pts, 30).map((x, i, a) => (i ? Math.log(x.v / a[i - 1].v) : null)).filter((x) => x != null);
      const vola = rets.length > 3 ? Math.sqrt(mean(rets.map((r) => (r - mean(rets)) ** 2))) : 0;

      const parts = [
        [t30, 0.35, (x) => clamp(x / 0.25)],
        [t90, 0.15, (x) => clamp(x / 0.4)],
        [mom, 0.15, (x) => clamp(x / 0.15)],
        [gap, 0.25, (x) => clamp(x / 0.3)],
        [demand, 0.10, (x) => clamp(x / 1)]
      ].filter(([v]) => v != null && isFinite(v));
      const wsum = parts.reduce((t, [, w]) => t + w, 0) || 1;
      const score = parts.reduce((t, [v, w, f]) => t + w * f(v), 0) / wsum;

      const reasons = [];
      if (t30 != null) reasons.push([t30 > 0.03 ? 1 : t30 < -0.03 ? -1 : 0, `Sale prices are ${Math.abs(t30) < 0.03 ? "flat" : t30 > 0 ? "rising" : "falling"} over the last 30 days (${pct(t30)} / month).`]);
      if (mom != null && Math.abs(mom) > 0.04) reasons.push([mom > 0 ? 1 : -1, `This week it's selling ${pct(mom)} vs. its 30-day average.`]);
      if (gap != null) reasons.push([gap > 0.05 ? 1 : gap < -0.05 ? -1 : 0, gap > 0.05 ? `The cheapest copy for sale is ${pct(gap)} above RAP, so new sales should pull RAP up.` : gap < -0.05 ? `Someone is selling ${pct(gap)} under RAP, so new sales should drag RAP down.` : `The cheapest copy is right around RAP.`]);
      if (demand != null && Math.abs(demand) > 0.15) reasons.push([demand > 0 ? 1 : -1, `${demand > 0 ? "More" : "Fewer"} people are buying it: ${R.fmt(s30)} sales in 30 days vs ${R.fmt(sPrev)} the month before.`]);
      if (s30 < 5) reasons.push([0, `Very few sales (${R.fmt(s30)} in 30 days), so one sale can swing the price a lot.`]);
      if (vola > 0.25) reasons.push([0, `Prices jump around a lot day to day, so treat this as a rough guess.`]);

      const conf = s30 >= 30 && pts.length >= 20 && vola < 0.25 ? "High" : s30 >= 5 && pts.length >= 8 ? "Medium" : "Low";
      const kind = score > 0.12 ? "up" : score < -0.12 ? "down" : "flat";
      const verdict = score > 0.35 ? "Likely to go up" : score > 0.12 ? "Leaning up" : score < -0.35 ? "Likely to go down" : score < -0.12 ? "Leaning down" : "Probably steady";
      const project = rap ? Math.round(rap * (1 + clamp(score * 0.25, -0.5, 0.5))) : null;
      return { id, verdict, kind, score, conf, reasons, rap, lowest: low, t30, t90, mom, perDay: s30 / 30, s30, project, pts, vol, stock: rs.assetStock, remaining: rs.numberRemaining, sales: rs.sales, original: rs.originalPrice };
    })();
    cache.set(id, { t: Date.now(), p });
    p.catch(() => cache.delete(id));
    return p;
  };

  const ICON = {
    up: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 16l6-6 4 4 6-7"/><path d="M15 7h5v5"/></svg>`,
    down: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8l6 6 4-4 6 7"/><path d="M15 17h5v-5"/></svg>`,
    flat: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 12h16"/></svg>`
  };
  const arrow = (k) => ICON[k] || ICON.flat;
  R.outlookPill = (o) => `<span class="rg-out-pill ${o.kind}" title="${R.esc(o.verdict)} · ${o.conf} confidence">${arrow(o.kind)} ${R.esc(o.verdict)}</span>`;

  // The "Outlook" tab on a catalog item
  R.renderOutlook = async (pane, id, info) => {
    if (info && !info.limited) { pane.innerHTML = `<div class="rg-empty">Only limiteds have a resale price, so there's nothing to predict for this item.</div>`; return; }
    pane.innerHTML = `<div class="rg-loading">Reading sale history…</div>`;
    let o;
    try { o = await R.limitedOutlook(id, info ? info.lowest : undefined); } catch (e) { pane.innerHTML = `<div class="rg-empty">Roblox has no resale history for this item yet.</div>`; return; }
    const pos = ((o.score + 1) / 2) * 100;
    pane.innerHTML = `
      <div class="rg-out ${o.kind}">
        <div class="rg-out-top"><span class="rg-out-arrow">${arrow(o.kind)}</span><div><b>${R.esc(o.verdict)}</b><small>${o.conf} confidence · next ~30 days</small></div>
          ${o.project ? `<div class="rg-out-proj"><small>RAP in ~30 days</small><b>${R.robux(o.project)}</b><small>${pct(o.project / o.rap - 1)} vs now</small></div>` : ""}</div>
        <div class="rg-out-meter"><span>Down</span><div class="rg-out-track"><i style="left:${pos}%"></i></div><span>Up</span></div>
      </div>
      <div class="rg-stats" style="margin:14px 0">
        ${R.stat("RAP", R.robux(o.rap))}
        ${o.lowest != null ? R.stat("Best price now", R.robux(o.lowest), o.rap ? pct(o.lowest / o.rap - 1) + " vs RAP" : "") : ""}
        ${o.t30 != null ? R.stat("30-day trend", `<span class="${o.t30 > 0.03 ? "rg-good" : o.t30 < -0.03 ? "rg-bad" : ""}">${pct(o.t30, 1)}</span>`, "per month") : ""}
        ${o.t90 != null ? R.stat("90-day trend", `<span class="${o.t90 > 0.03 ? "rg-good" : o.t90 < -0.03 ? "rg-bad" : ""}">${pct(o.t90, 1)}</span>`, "per month") : ""}
        ${R.stat("Sales / day", o.perDay >= 10 ? R.fmt(Math.round(o.perDay)) : o.perDay.toFixed(1), `${R.fmt(o.s30)} in 30 days`)}
        ${o.stock ? R.stat("Copies", R.fmt(o.stock), o.remaining ? `${R.fmt(o.remaining)} left` : "") : ""}
      </div>
      <div class="rg-h3">Why</div>
      <ul class="rg-out-why">${o.reasons.map(([d, t]) => `<li class="${d > 0 ? "up" : d < 0 ? "down" : ""}"><i></i>${R.esc(t)}</li>`).join("") || `<li>Not enough sales to say much.</li>`}</ul>
      ${R.chart(o.pts.filter((p) => Date.now() - p.t < 120 * DAY), { label: "Sale price, last 120 days", money: true })}
      <p class="rg-note">An estimate from Roblox's own sale history (price trend, this week vs. the month, cheapest copy vs. RAP, and demand). Nobody can see the future, so don't spend Robux just because of this.</p>`;
  };

  /* =====================================================================
     REAL ITEM FIRST (catalog search)
     ===================================================================== */
  const words = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const isRoblox = (i) => Number(i.creatorTargetId) === 1 && (!i.creatorType || i.creatorType === "User");
  const isLimited = (i) => (i.itemRestrictions || []).some((r) => /^Limited/i.test(r));
  const matchScore = (q, name) => {
    const qw = words(q), nw = words(name);
    if (!qw.length || !qw.every((w) => nw.some((x) => x.startsWith(w)))) return 0;
    if (nw.join(" ") === qw.join(" ")) return 1;
    return 0.4 + 0.6 * (qw.length / nw.length);
  };
  // Is this item a copy of the real one? (not by Roblox, and its name has every word you searched)
  const looksLikeCopy = (q, i, realIds) => !realIds.has(`${i.itemType}:${i.id}`) && !isRoblox(i) && matchScore(q, i.name) > 0;

  const officialCache = new Map();
  R.findReal = (q) => {
    q = q.trim();
    if (officialCache.has(q.toLowerCase())) return officialCache.get(q.toLowerCase());
    const p = (async () => {
      const k = encodeURIComponent(q);
      const [a, b] = await Promise.all([
        R.api(`https://catalog.roblox.com/v1/search/items/details?Keyword=${k}&Category=1&CreatorName=Roblox&IncludeNotForSale=true&Limit=30`).catch(() => ({ data: [] })),
        R.api(`https://catalog.roblox.com/v1/search/items/details?Keyword=${k}&Category=1&SalesTypeFilter=2&IncludeNotForSale=true&Limit=30`).catch(() => ({ data: [] }))
      ]);
      const seen = new Set(), all = [];
      [...(a.data || []), ...(b.data || [])].forEach((i) => { const key = `${i.itemType}:${i.id}`; if (!seen.has(key) && isRoblox(i)) { seen.add(key); all.push(i); } });
      const ranked = all.map((i) => ({ i, m: matchScore(q, i.name), w: (isLimited(i) ? 0.5 : 0) + (i.itemType === "Bundle" ? 0.2 : 0) + Math.log10((i.favoriteCount || 0) + 1) / 10 }))
        .filter((x) => x.m >= 0.55).sort((x, y) => y.m * (1 + y.w) - x.m * (1 + x.w));
      if (!ranked.length) return { real: [], iconic: false };
      const best = ranked[0];
      const real = ranked.filter((x) => x.m >= best.m * 0.8).slice(0, 4).map((x) => x.i);
      // Only tuck copies away for famous items (limiteds, offsale classics, bundles, huge favorites), never for everyday searches
      const iconic = real.some((i) => isLimited(i) || i.itemType === "Bundle" || /off\s*sale/i.test(i.priceStatus || "") || (i.favoriteCount || 0) >= 100000);
      return { real, iconic };
    })();
    officialCache.set(q.toLowerCase(), p);
    p.catch(() => officialCache.delete(q.toLowerCase()));
    return p;
  };
  // For RoGen's own search: real items first, copies of a famous item dropped
  R.realFirst = async (q, list) => {
    const { real, iconic } = await R.findReal(q).catch(() => ({ real: [], iconic: false }));
    const ids = new Set(real.map((i) => `${i.itemType}:${i.id}`));
    const rest = list.filter((i) => !ids.has(`${i.itemType}:${i.id}`) && !(iconic && looksLikeCopy(q, i, ids)));
    return [...real.map((i) => ({ ...i, rgReal: true })), ...rest];
  };

  const priceText = (i) => i.lowestPrice != null ? R.robux(i.lowestPrice) : i.price != null && !/off\s*sale/i.test(i.priceStatus || "") ? (i.price ? R.robux(i.price) : "Free") : `<span class="rg-mute">Offsale</span>`;
  const itemUrl = (i) => `https://www.roblox.com/${i.itemType === "Bundle" ? "bundles" : "catalog"}/${i.id}`;

  R.route((p) => p === "/catalog", () => {
    let q = null, strip = null, real = [], iconic = false, realIds = new Set(), busy = false;
    const details = new Map();     // "Asset:123" -> item details
    let hide = true;
    R.get1("catalogHideCopies", true).then((v) => (hide = v !== false));
    const kw = () => { const u = new URLSearchParams(location.search); return (u.get("Keyword") || u.get("keyword") || "").trim(); };

    // The results grid = the closest box that holds two different item cards; each "cell" is its direct child
    const cards = () => {
      const root = R.mainContent();
      const links = [];
      root.querySelectorAll('a[href*="/catalog/"], a[href*="/bundles/"]').forEach((a) => {
        if (a.closest(".rg-section, .rg-real, #header, .rbx-header, nav, header")) return;
        const m = (a.getAttribute("href") || "").match(/\/(catalog|bundles)\/(\d+)/);
        if (m) links.push({ a, type: m[1] === "bundles" ? "Bundle" : "Asset", id: Number(m[2]) });
      });
      if (!links.length) return { grid: null, list: [] };
      const other = links.find((l) => l.id !== links[0].id || l.type !== links[0].type);
      let grid = null;
      if (other) { grid = links[0].a.parentElement; while (grid && !grid.contains(other.a)) grid = grid.parentElement; }
      else { const c = links[0].a.closest("li, .catalog-item-container, .item-card-container") || links[0].a.parentElement; grid = c.parentElement; }
      if (!grid) return { grid: null, list: [] };
      const list = [];
      for (const l of links) {
        if (!grid.contains(l.a)) continue;
        let cell = l.a;
        while (cell.parentElement && cell.parentElement !== grid) cell = cell.parentElement;
        if (cell.parentElement !== grid || list.some((c) => c.card === cell)) continue;
        list.push({ card: cell, key: `${l.type}:${l.id}`, type: l.type, id: l.id });
      }
      return { grid, list };
    };

    const drawStrip = () => {
      if (!real.length) { strip && strip.remove(); strip = null; return; }
      const hidden = document.querySelectorAll(".rg-copy-hidden, .rg-copy-shown").length;
      if (!strip) {
        strip = R.h(`<section class="rg-real" aria-label="Official item"></section>`);
      }
      strip.innerHTML = `<div class="rg-real-head"><span class="rg-real-tag">The real one</span><span class="rg-mute">Official${real.length > 1 ? " items" : " item"} by Roblox${iconic ? " · copies are tucked away" : ""}</span><span style="flex:1"></span>
          ${iconic && hidden ? `<button type="button" class="rg-chip rg-real-toggle">${hide ? `Show ${hidden} cop${hidden === 1 ? "y" : "ies"}` : `Hide ${hidden} cop${hidden === 1 ? "y" : "ies"}`}</button>` : ""}</div>
        <div class="rg-real-row">${real.map((i) => `<a class="rg-real-card" href="${itemUrl(i)}">
          <span class="rg-real-img"><img data-thumb="${i.itemType === "Bundle" ? "bundle" : "asset"}:${i.id}" alt=""></span>
          <span class="rg-real-info"><b>${R.esc(i.name)}</b>
            <span class="rg-real-meta"><span class="rg-real-ok">Official · Roblox</span>${isLimited(i) ? `<span class="rg-badge">${(i.itemRestrictions || []).includes("LimitedUnique") ? "Limited U" : "Limited"}</span>` : ""}${i.itemType === "Bundle" ? `<span class="rg-badge">Bundle</span>` : ""}</span>
            <span class="rg-real-price">${priceText(i)}${i.favoriteCount ? `<span class="rg-mute"> · ${R.short(i.favoriteCount)} favorites</span>` : ""}</span>
            <span class="rg-real-out" data-out="${isLimited(i) && i.itemType === "Asset" ? i.id : ""}"></span></span></a>`).join("")}</div>`;
      R.fillThumbs(strip);
      strip.querySelectorAll("[data-out]").forEach((el) => {
        const id = Number(el.dataset.out);
        if (id) R.limitedOutlook(id, real.find((x) => x.id === id)?.lowestPrice).then((o) => (el.innerHTML = R.outlookPill(o))).catch(() => {});
      });
      const t = strip.querySelector(".rg-real-toggle");
      if (t) t.onclick = (e) => { e.preventDefault(); hide = !hide; R.set({ catalogHideCopies: hide }); applyHide(); drawStrip(); };
    };
    const placeStrip = () => {
      if (!strip) return;
      const { grid } = cards();
      if (grid && grid.parentElement) { if (strip.nextElementSibling !== grid) grid.parentElement.insertBefore(strip, grid); }
      else if (!document.contains(strip)) R.mainContent().insertAdjacentElement("afterbegin", strip);
    };
    const applyHide = () => {
      document.querySelectorAll(".rg-copy-hidden, .rg-copy-shown").forEach((c) => { c.classList.toggle("rg-copy-hidden", hide); c.classList.toggle("rg-copy-shown", !hide); });
    };
    const markCards = async () => {
      if (!iconic) return;
      const { list } = cards();
      const need = list.filter((c) => !details.has(c.key));
      for (const ch of R.chunks(need, 100)) {
        try {
          const d = await R.api("https://catalog.roblox.com/v1/catalog/items/details", { method: "POST", body: { items: ch.map((c) => ({ itemType: c.type, id: c.id })) } });
          (d.data || []).forEach((i) => details.set(`${i.itemType}:${i.id}`, i));
          ch.forEach((c) => details.has(c.key) || details.set(c.key, null));
        } catch (e) { ch.forEach((c) => details.set(c.key, null)); }
      }
      let changed = false;
      for (const c of cards().list) {
        const i = details.get(c.key);
        const copy = !!i && looksLikeCopy(q, i, realIds);
        const isReal = realIds.has(c.key);
        c.card.classList.toggle("rg-real-in-grid", isReal);
        if (copy && !c.card.classList.contains("rg-copy-hidden") && !c.card.classList.contains("rg-copy-shown")) { c.card.classList.add(hide ? "rg-copy-hidden" : "rg-copy-shown"); changed = true; }
        if (!copy) c.card.classList.remove("rg-copy-hidden", "rg-copy-shown");
      }
      if (changed) drawStrip();
    };

    const tick = async () => {
      const k = kw();
      if (k !== q) {
        q = k; real = []; iconic = false; realIds = new Set();
        document.querySelectorAll(".rg-copy-hidden, .rg-copy-shown, .rg-real-in-grid").forEach((c) => c.classList.remove("rg-copy-hidden", "rg-copy-shown", "rg-real-in-grid"));
        strip && strip.remove(); strip = null;
        if (!q) return;
        const want = q;
        const r = await R.findReal(q).catch(() => ({ real: [], iconic: false }));
        if (want !== q) return;
        real = r.real; iconic = r.iconic; realIds = new Set(real.map((i) => `${i.itemType}:${i.id}`));
        drawStrip();
      }
      if (!q || busy) return;
      busy = true;
      try { placeStrip(); await markCards(); } finally { busy = false; }
    };
    tick();
    return { tick, stop: () => { strip && strip.remove(); document.querySelectorAll(".rg-copy-hidden, .rg-copy-shown, .rg-real-in-grid").forEach((c) => c.classList.remove("rg-copy-hidden", "rg-copy-shown", "rg-real-in-grid")); } };
  });
})();
