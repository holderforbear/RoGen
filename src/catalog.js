// Catalog item pages: asset info, price/RAP history, ownership checker, deal + deleted alerts, compare, notes
(() => {
  const R = window.Rogen;
  const TYPES = { 2: "T-Shirt", 8: "Hat", 11: "Shirt", 12: "Pants", 17: "Head", 18: "Face", 19: "Gear", 41: "Hair", 42: "Face accessory", 43: "Neck accessory", 44: "Shoulder accessory", 45: "Front accessory", 46: "Back accessory", 47: "Waist accessory", 48: "Climb animation", 61: "Emote", 64: "T-Shirt (layered)", 65: "Shirt (layered)", 66: "Pants (layered)", 67: "Jacket", 68: "Sweater", 69: "Shorts", 72: "Dress/skirt", 79: "Dynamic head" };

  R.itemInfo = async (id) => {
    const [d, cat, fav] = await Promise.all([
      R.api(`https://economy.roblox.com/v2/assets/${id}/details`),
      R.api("https://catalog.roblox.com/v1/catalog/items/details", { method: "POST", body: { items: [{ itemType: "Asset", id }] } }).then((x) => (x.data || [])[0] || {}).catch(() => ({})),
      R.api(`https://catalog.roblox.com/v1/favorites/assets/${id}/count`).catch(() => null)
    ]);
    const limited = d.IsLimited || d.IsLimitedUnique || (cat.itemRestrictions || []).some((r) => /Limited|Collectible/i.test(r));
    return {
      id, name: d.Name, desc: d.Description, creator: d.Creator, created: d.Created, updated: d.Updated,
      price: d.PriceInRobux, forSale: d.IsForSale, sales: d.Sales, remaining: d.Remaining, type: TYPES[d.AssetTypeId] || `Type ${d.AssetTypeId}`,
      limited, lowest: cat.lowestPrice ?? cat.lowestResalePrice ?? d.CollectiblesItemDetails?.CollectibleLowestResalePrice ?? null,
      favorites: typeof fav === "number" ? fav : null, total: cat.totalQuantity, raw: d
    };
  };

  R.route((p) => /^\/catalog\/\d+/i.test(p), () => {
    const id = Number(location.pathname.match(/\/catalog\/(\d+)/)[1]);
    let infoP = null;
    const info = () => (infoP = infoP || R.itemInfo(id).then((i) => { R.recent.add({ kind: "item", id, name: i.name, url: `https://www.roblox.com/catalog/${id}` }); return i; }));

    const sec = R.section({
      id: "rg-item",
      title: "Item Insights",
      right: R.copy(id, "Asset ID"),
      tabs: [
        { id: "info", label: "Item Info", render: infoTab },
        { id: "outlook", label: "Outlook", render: (p) => info().then((i) => R.renderOutlook(p, id, i)) },
        { id: "price", label: "Price History", render: priceTab },
        { id: "owns", label: "Who Owns It", render: ownsTab },
        { id: "watch", label: "Alerts & Compare", render: watchTab },
      ]
    });

    async function infoTab(pane) {
      const i = await info();
      await R.snap(`item:${id}`, { price: i.price ?? null, lowest: i.lowest ?? null, forSale: !!i.forSale }, { every: 6 * 3600e3 });
      pane.innerHTML = `<div class="rg-stats">
          ${R.stat("Price", i.forSale && i.price != null ? R.robux(i.price) : "Offsale")}
          ${i.limited ? R.stat("Lowest resale", i.lowest != null ? R.robux(i.lowest) : "—") : ""}
          ${i.sales ? R.stat("Sales", R.short(i.sales), R.fmt(i.sales)) : ""}
          ${i.favorites != null ? R.stat("Favorites", R.short(i.favorites)) : ""}
          ${i.remaining ? R.stat("Remaining", R.fmt(i.remaining), i.total ? `of ${R.fmt(i.total)}` : "") : ""}
          ${R.stat("Type", R.esc(i.type))}
          ${R.stat("Created", R.date(i.created), R.ago(i.created))}
          ${R.stat("Last updated", R.ago(i.updated), R.dateTime(i.updated))}
        </div>
        <div class="rg-h3">Creator</div>
        <div class="rg-row"><a class="rg-link" href="https://www.roblox.com/${i.creator.CreatorType === "Group" ? "communities" : "users"}/${i.creator.CreatorTargetId || i.creator.Id}${i.creator.CreatorType === "Group" ? "" : "/profile"}">${R.esc(i.creator.Name)}</a>
          <span class="rg-badge">${R.esc(i.creator.CreatorType)}</span>${i.creator.HasVerifiedBadge ? `<span class="rg-badge acc">Verified</span>` : ""}
          ${i.limited ? `<span class="rg-badge acc">Limited</span>` : ""}</div>
        ${i.limited ? `<div class="rg-h3">Outlook</div><div class="rg-row i-out"><span class="rg-mute">Checking sale history…</span></div>` : ""}`;
      if (i.limited) R.limitedOutlook(id, i.lowest).then((o) => { const el = pane.querySelector(".i-out"); if (el) el.innerHTML = `${R.outlookPill(o)}<span class="rg-mute">${o.conf} confidence${o.project ? ` · RAP ~R$${R.fmt(o.project)} in 30 days` : ""}</span>`; }).catch(() => { const el = pane.querySelector(".i-out"); if (el) el.innerHTML = `<span class="rg-mute">No resale history yet.</span>`; });
    }

    async function priceTab(pane) {
      const i = await info();
      let resale = null;
      if (i.limited) resale = await R.api(`https://economy.roblox.com/v1/assets/${id}/resale-data`).catch(() => null);
      const local = await R.hist(`item:${id}`);
      let html = "";
      if (resale) {
        const pts = (resale.priceDataPoints || []).map((p) => ({ t: new Date(p.date).getTime(), v: p.value })).sort((a, b) => a.t - b.t);
        const vol = (resale.volumeDataPoints || []).map((p) => ({ t: new Date(p.date).getTime(), v: p.value })).sort((a, b) => a.t - b.t);
        html += `<div class="rg-stats">
            ${R.stat("RAP", R.robux(resale.recentAveragePrice))}
            ${resale.originalPrice ? R.stat("Original price", R.robux(resale.originalPrice)) : ""}
            ${resale.assetStock ? R.stat("Stock", R.fmt(resale.assetStock)) : ""}
            ${resale.sales ? R.stat("Total resales", R.short(resale.sales), R.fmt(resale.sales)) : ""}
            ${i.lowest != null ? R.stat("Best price now", R.robux(i.lowest), i.lowest < resale.recentAveragePrice ? `<span class="rg-good">${Math.round((1 - i.lowest / resale.recentAveragePrice) * 100)}% under RAP</span>` : `<span class="rg-bad">${Math.round((i.lowest / resale.recentAveragePrice - 1) * 100)}% over RAP</span>`) : ""}
          </div>
          ${R.chart(pts, { label: "Sale price (from Roblox)", money: true })}
          ${R.chart(vol, { label: "Daily sales volume" })}`;
      }
      html += `<div class="rg-h3">Price changes RoGen has seen</div>
        ${R.chart(local.map((x) => ({ t: x.t, v: x.lowest ?? x.price })), { label: i.limited ? "Lowest price" : "Price", money: true })}
        <ul class="rg-timeline">${local.slice().reverse().map((x) => `<li><time>${R.dateTime(x.t)}</time>${x.forSale ? (x.price != null ? "R$" + R.fmt(x.price) : "") : "Offsale"}${x.lowest != null ? ` · lowest resale R$${R.fmt(x.lowest)}` : ""}</li>`).join("")}</ul>`;
      pane.innerHTML = html;
    }

    async function ownsTab(pane) {
      pane.innerHTML = `<div class="rg-row"><input class="rg-input" placeholder="Username to check" style="flex:1;max-width:320px"><button class="btn-primary-md">Check</button></div><div class="o-out" style="margin-top:12px"></div>
        <p class="rg-note">Works when that player's inventory is public.</p>`;
      const run = async () => {
        const name = pane.querySelector("input").value.trim();
        const out = pane.querySelector(".o-out");
        if (!name) return;
        out.innerHTML = `<div class="rg-loading">Checking…</div>`;
        try {
          const u = await R.userByName(name);
          if (!u) { out.innerHTML = `<div class="rg-empty">No user named ${R.esc(name)}.</div>`; return; }
          const owns = await R.api(`https://inventory.roblox.com/v1/users/${u.id}/items/Asset/${id}/is-owned`);
          out.innerHTML = `<div class="rg-row"><img class="rg-thumb round" data-thumb="user:${u.id}"> <a class="rg-link" href="https://www.roblox.com/users/${u.id}/profile">${R.esc(u.displayName)} (@${R.esc(u.name)})</a>
            ${owns === true ? `<span class="rg-badge good">Owns this item</span>` : `<span class="rg-badge">Doesn't own it</span>`}</div>`;
          R.fillThumbs(out);
        } catch (e) { out.innerHTML = e.status === 403 ? `<div class="rg-empty">That inventory is private.</div>` : R.errBox(e); }
      };
      pane.querySelector("button").onclick = run;
      pane.querySelector("input").onkeydown = (e) => { if (e.key === "Enter") run(); };
    }

    async function watchTab(pane) {
      const i = await info();
      const w = (await R.watch.items())[id] || {};
      const inCompare = (await R.compare.all()).some((x) => x.id === id);
      pane.innerHTML = `
        <div class="rg-h3">Deal alert</div>
        <div class="rg-row"><label class="rg-check"><input type="checkbox" class="w-deal" ${w.target ? "checked" : ""}> Notify me when the price drops to</label>
          <input class="rg-input w-target" type="number" min="1" style="width:130px" value="${w.target || Math.max(1, Math.round(((i.lowest ?? i.price) || 100) * 0.9))}"> <span class="rg-mute">Robux or less</span></div>
        <div class="rg-h3">Removed / offsale alert</div>
        <label class="rg-check"><input type="checkbox" class="w-gone" ${w.gone ? "checked" : ""}> Notify me if this item goes offsale or gets deleted</label>
        <div class="rg-h3">Compare</div>
        <button class="${inCompare ? "btn-control-md" : "btn-primary-md"} c-btn">${inCompare ? "Remove from compare" : "Add to compare"}</button>
        <a class="rg-link" style="margin-left:10px" href="https://www.roblox.com/rogen#items">Open item compare →</a>
        <p class="rg-note">Alerts check every 5 minutes while Chrome is open.</p>`;
      const save = () => {
        const target = pane.querySelector(".w-deal").checked ? Number(pane.querySelector(".w-target").value) : 0;
        const gone = pane.querySelector(".w-gone").checked;
        R.watch.setItem(id, target || gone ? { name: i.name, target, gone, lastForSale: !!i.forSale } : null);
        R.toast(target || gone ? "Alert saved" : "Alerts off");
      };
      pane.querySelectorAll("input").forEach((x) => (x.onchange = save));
      pane.querySelector(".c-btn").onclick = async () => {
        const added = await R.compare.toggle({ id, name: i.name });
        R.toast(added ? "Added to compare" : "Removed from compare");
        watchTab(pane);
      };
    }

    info().then((i) => R.snap(`item:${id}`, { price: i.price ?? null, lowest: i.lowest ?? null, forSale: !!i.forSale }, { every: 6 * 3600e3 })).catch(() => {});
    const place = () => {
      if (document.contains(sec)) return;
      const top = document.querySelector("#item-details-container .page-content .clearfix, #item-details-container .clearfix");
      if (top) top.insertAdjacentElement("afterend", sec);
      else (document.querySelector("#item-details-container .page-content") || R.mainContent()).insertAdjacentElement("afterbegin", sec);
    };
    place();
    return { tick: place, stop: () => sec.remove() };
  });
})();
