// Group / community pages: total visits, hidden experiences, member history, revenue (if you can see it), notes
(() => {
  const R = window.Rogen;

  const groupGames = (gid, filter) =>
    R.pages((c) => `https://games.roblox.com/v2/groups/${gid}/gamesV2?accessFilter=${filter}&limit=100&sortOrder=Desc${c ? `&cursor=${encodeURIComponent(c)}` : ""}`, { max: 20 });

  R.route((p) => /^\/(groups|communities)\/\d+/i.test(p), () => {
    const gid = Number(location.pathname.match(/\/(?:groups|communities)\/(\d+)/i)[1]);
    const sec = R.section({
      id: "rg-group",
      title: "Group Insights",
      lazy: true,
      right: R.copy(gid, "Group ID"),
      tabs: [
        { id: "games", label: "Experiences", render: games },
        { id: "members", label: "Members", render: members },
        { id: "money", label: "Revenue", render: money },
      ]
    });

    async function games(pane) {
      await R.renderGroupGames(pane, gid);
    }

    async function members(pane) {
      const g = await R.api(`https://groups.roblox.com/v1/groups/${gid}`);
      await R.snap(`groupMembers:${gid}`, { members: g.memberCount });
      const h = await R.hist(`groupMembers:${gid}`);
      R.recent.add({ kind: "group", id: gid, name: g.name, url: location.href.split("#")[0] });
      const first = h[0], last = h[h.length - 1];
      const diff = h.length > 1 ? last.members - first.members : 0;
      pane.innerHTML = `<div class="rg-stats">
          ${R.stat("Members", R.fmt(g.memberCount))}
          ${R.stat("Change", h.length > 1 ? `<span class="${diff >= 0 ? "rg-good" : "rg-bad"}">${diff >= 0 ? "+" : ""}${R.fmt(diff)}</span>` : "—", h.length > 1 ? "since " + R.date(first.t) : "first visit")}
          ${R.stat("Owner", g.owner ? `<a class="rg-link" href="https://www.roblox.com/users/${g.owner.userId}/profile">@${R.esc(g.owner.username)}</a>` : "No owner")}
          ${R.stat("Join type", g.publicEntryAllowed ? "Anyone can join" : "Approval needed")}
        </div>
        ${R.chart(h.map((x) => ({ t: x.t, v: x.members })), { label: "Members over time" })}
        <p class="rg-note">RoGen adds a point each time you visit this group.</p>`;
    }

    async function money(pane) {
      const [funds, day, week, month] = await Promise.all([
        R.api(`https://economy.roblox.com/v1/groups/${gid}/currency`).catch((e) => e),
        R.api(`https://economy.roblox.com/v1/groups/${gid}/revenue/summary/day`).catch((e) => e),
        R.api(`https://economy.roblox.com/v1/groups/${gid}/revenue/summary/week`).catch((e) => e),
        R.api(`https://economy.roblox.com/v1/groups/${gid}/revenue/summary/month`).catch((e) => e)
      ]);
      if (funds instanceof Error && day instanceof Error) {
        pane.innerHTML = `<div class="rg-empty">Roblox only shows revenue to group owners and people with the "view group funds" permission.</div>`;
        return;
      }
      const sum = (s) => (s instanceof Error ? null : Object.entries(s).reduce((t, [k, v]) => (/pending/i.test(k) ? t : t + (Number(v) || 0)), 0));
      if (!(funds instanceof Error)) await R.snap(`groupFunds:${gid}`, { funds: funds.robux }, { every: 6 * 3600e3 });
      const h = await R.hist(`groupFunds:${gid}`);
      const breakdown = month instanceof Error ? "" : `<div class="rg-h3">This month by source</div><div class="rg-table-wrap"><table class="rg-table"><tbody>
        ${Object.entries(month).filter(([, v]) => Number(v)).map(([k, v]) => `<tr><td>${R.esc(k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()))}</td><td class="rg-num">${R.robux(v)}</td></tr>`).join("")}</tbody></table></div>`;
      pane.innerHTML = `<div class="rg-stats">
          ${funds instanceof Error ? "" : R.stat("Group funds", R.robux(funds.robux))}
          ${sum(day) != null ? R.stat("Today", R.robux(sum(day))) : ""}
          ${sum(week) != null ? R.stat("This week", R.robux(sum(week))) : ""}
          ${sum(month) != null ? R.stat("This month", R.robux(sum(month))) : ""}
        </div>
        ${h.length > 1 ? R.chart(h.map((x) => ({ t: x.t, v: x.funds })), { label: "Funds over time", money: true }) : ""}
        ${breakdown}`;
    }

    // Record member history on every visit
    R.api(`https://groups.roblox.com/v1/groups/${gid}`).then((g) => {
      R.snap(`groupMembers:${gid}`, { members: g.memberCount });
      R.recent.add({ kind: "group", id: gid, name: g.name, url: `https://www.roblox.com/communities/${gid}` });
    }).catch(() => {});

    /* Next to the "Members" pill: a Visits pill and a CCU pill in the same row. Under the bio: a "Hidden experiences" pill-button
       that opens the list. Pills are copies of Roblox's own Members pill so they match exactly. If the Members pill can't be found
       a few seconds after load, a standalone card is shown instead. Re-attaches itself whenever Roblox redraws the header,
       and the last numbers are cached so it's instant. */
    const CK = `grpStats:${gid}`;
    const info = { data: null, failed: false, loading: true };
    const slim = (d) => ({ t: Date.now(), visits: d.visits, playing: d.playing, total: d.all.length, hidden: d.hidden.map((x) => ({ id: x.id, placeId: x.rootPlace?.id, name: x.name, visits: d.visitsOf(x) })) });
    let pills = null, hx = null, card = null, lastPlace = 0;
    const t0 = Date.now();

    // Replace only the "56 Members" text inside the copied pill, so nothing like a leftover "Members" stays behind
    const setLabel = (el, text) => {
      const leaf = el._leaf;
      if (leaf) { if (leaf.textContent !== text) leaf.textContent = text; return; }
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n, done = false;
      while ((n = w.nextNode())) if (n.nodeValue.trim()) { n.nodeValue = done ? "" : text; done = true; }
      if (!done) el.textContent = text;
    };
    const labels = () => {
      const d = info.data;
      return {
        visits: d ? `${R.short(d.visits)} Visits` : info.failed ? "— Visits" : "… Visits",
        ccu: d ? `${R.fmt(d.playing)} CCU` : info.failed ? "— CCU" : "… CCU",
        btn: d ? `Hidden experiences (${d.hidden.length})` : info.failed ? "Couldn't load, tap to retry" : "Hidden experiences"
      };
    };
    const VTIP = () => (info.data ? `${R.fmt(info.data.visits)} total visits across all of this community's experiences` : "Total visits");
    function paint() {
      const L = labels();
      if (pills) {
        setLabel(pills[0], L.visits); pills[0].title = VTIP();
        setLabel(pills[1], L.ccu); pills[1].title = "Players in this community's experiences right now (CCU)";
        setLabel(hx.querySelector(".rg-hx-btn"), L.btn);
      }
      if (card) {
        card.querySelector('[data-k="visits"]').textContent = L.visits.replace(/ Visits$/, "");
        card.querySelector('[data-k="visits"]').title = VTIP();
        card.querySelector('[data-k="ccu"]').textContent = L.ccu.replace(/ CCU$/, "");
        card.querySelector(".rg-hx-btn").textContent = L.btn;
        card.classList.toggle("loading", info.loading && !info.data);
      }
      [hx, card].forEach((root) => {
        const body = root && root.querySelector(".rg-hx-body");
        if (body && !body.hidden && info.data) { body.innerHTML = R.hiddenList(info.data); R.fillThumbs(body); }
      });
    }
    function load() {
      info.loading = true; info.failed = false; paint();
      return R.groupGamesAll(gid)
        .then((d) => {
          // Roblox sometimes answers with nothing at all (rate limit / hiccup). Don't replace good numbers with zeros.
          if (!d.all.length && info.data && info.data.total > 0) return;
          info.data = slim(d);
          if (d.all.length) R.set({ [CK]: info.data });
        })
        .catch(() => { info.failed = !info.data; })
        .finally(() => { info.loading = false; paint(); });
    }
    R.get1(CK, null).then((c) => { if (c && !info.data) { info.data = c; paint(); } }); // show last numbers instantly
    load();

    // click on the button (pill or card version)
    const wire = (btn, root) => {
      const go = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (info.failed && !info.data) return load();
        const body = root.querySelector(".rg-hx-body");
        body.hidden = !body.hidden;
        if (body.hidden) return;
        if (!info.data) { body.innerHTML = `<div class="rg-loading">Loading…</div>`; return; }
        body.innerHTML = R.hiddenList(info.data);
        R.fillThumbs(body);
      };
      btn.addEventListener("click", go, true);
      btn.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && go(e));
    };

    const MEMBERS = /^[\d.,]+\s*[KMB]?\+?\s+members?$/i;
    const hasBg = (el) => { const c = getComputedStyle(el).backgroundColor; return c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c); };
    const leafOf = (root) => [root, ...root.querySelectorAll("*")].find((n) => !n.children.length && MEMBERS.test(n.textContent.trim())) || null;
    // Finds the "56 Members" pill anywhere on the page, then the row of pills it sits in (Members, Member Rank, ...)
    const MEMBERS_CAP = /^[\d.,]+\s*[KMB]?\+?\s+Members?$/;
    const NUMWORD = /^[\d.,]+\s*[KMB]?\+?\s+\p{L}+$/u;           // any "<number> <word>" pill, for other languages           // the header pill says "58 Members" (the left menu says "58 members")
    const findMembers = () => {
      // Only the community's own header counts: next to the big title, never the left "Communities" menu
      const h1s = [...document.querySelectorAll("h1")].filter((h) => h.getClientRects().length && !h.closest("aside, nav, .rg-pane"));
      const near = (leaf) => !h1s.length || h1s.some((h) => {
        const a = h.getBoundingClientRect(), b = leaf.getBoundingClientRect();
        let anc = h;
        for (let i = 0; i < 7 && anc.parentElement; i++) { anc = anc.parentElement; if (anc.contains(leaf)) return b.top >= a.top - 20 && b.top - a.bottom < 320; }
        return false;
      });
      let leaf = null;
      for (const n of (document.querySelector("main") || document.body).querySelectorAll("*")) {
        if (n.children.length || !MEMBERS_CAP.test(n.textContent.trim())) continue;
        if (n.closest(".rg-pane, .rg-gcard, .rg-hx, .rg-gpill, aside, nav")) continue;
        if (!n.getClientRects().length) continue;                  // hidden duplicate (mobile layout etc.)
        if (!near(n)) continue;
        leaf = n; break;
      }
      if (!leaf && h1s.length) {                                   // other languages / odd wording: first "<number> <word>" pill under the title
        for (const n of (document.querySelector("main") || document.body).querySelectorAll("*")) {
          if (n.children.length || !NUMWORD.test(n.textContent.trim())) continue;
          if (n.closest(".rg-pane, .rg-gcard, .rg-hx, .rg-gpill, aside, nav") || !n.getClientRects().length || !near(n)) continue;
          leaf = n; break;
        }
      }
      if (!leaf) return null;
      const t = leaf.textContent.trim();
      let pill = leaf;
      for (let i = 0; i < 3 && !hasBg(pill) && pill.parentElement && pill.parentElement.textContent.trim() === t; i++) pill = pill.parentElement;
      let unit = pill, n = 0;                                    // the item that sits directly in the row
      while (unit.parentElement && unit.parentElement.children.length < 2 && n++ < 4) unit = unit.parentElement;
      return unit.parentElement ? { unit, row: unit.parentElement } : null;
    };
    const copyOf = (m) => {
      const c = m.cloneNode(true);
      c.removeAttribute("id"); c.removeAttribute("href"); c.removeAttribute("onclick");
      c.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
      c.querySelectorAll("[href]").forEach((e) => e.removeAttribute("href"));
      ["aria-haspopup", "aria-expanded", "aria-controls"].forEach((a) => { c.removeAttribute(a); c.querySelectorAll("[" + a + "]").forEach((e) => e.removeAttribute(a)); });
      c._leaf = leafOf(c);
      c.classList.add("rg-gpill");
      return c;
    };

    let lastRef = null, mode = "flow", bad = 0;
    // If Roblox's row can't hold the pills (they wrap or collapse), pin them to the exact spot to the right of the last pill instead
    const posFloat = () => {
      if (!lastRef || !lastRef.isConnected) return;
      const a = lastRef.getBoundingClientRect();
      let x = a.right + window.scrollX + 8;
      pills.forEach((p) => { p.style.left = x + "px"; p.style.top = a.top + window.scrollY + "px"; p.style.height = a.height + "px"; x += p.getBoundingClientRect().width + 8; });
    };
    const toFloat = () => { mode = "float"; pills.forEach((p) => { p.classList.add("rg-float"); document.body.appendChild(p); }); posFloat(); };
    const geoOk = () => {
      const a = lastRef.getBoundingClientRect(), b = pills[0].getBoundingClientRect();
      return b.width > 0 && b.height > 0 && Math.abs(b.top - a.top) < Math.max(16, a.height) && b.left >= a.right - 2;
    };
    function placePills(f) {
      if (!pills) {
        pills = [copyOf(f.unit), copyOf(f.unit)];
        const btn = copyOf(f.unit);
        btn.classList.add("rg-hx-btn");
        btn.setAttribute("role", "button"); btn.setAttribute("tabindex", "0");
        hx = R.h(`<div class="rg-hx"><div class="rg-hx-body" hidden></div></div>`);
        hx.insertBefore(btn, hx.firstChild);
        wire(btn, hx);
      }
      // Visits then CCU, straight after "Member Rank" (the pills that are the same size as Members), in the same row
      let last = f.unit;
      const hgt = f.unit.offsetHeight || 0;
      while (last.nextElementSibling && !last.nextElementSibling.matches(".rg-gpill, .rg-hx") && last.nextElementSibling.textContent.trim().length < 30 && Math.abs((last.nextElementSibling.offsetHeight || 0) - hgt) < 10) last = last.nextElementSibling;
      lastRef = last; mode = "flow"; bad = 0;
      pills.forEach((p) => { p.classList.remove("rg-float"); p.style.left = p.style.top = p.style.height = ""; });
      if (last.nextElementSibling !== pills[0]) { last.insertAdjacentElement("afterend", pills[0]); pills[0].insertAdjacentElement("afterend", pills[1]); }
      // The "Hidden experiences" button goes right under the bio (and its "more" link). If there's no bio element, right under the pill row.
      let up = f.row, hop = 0, after = null;
      while (up && hop++ < 4) {
        const s = up.nextElementSibling;
        if (s && !s.matches(".rg-hx, .rg-pane")) { after = s.matches(".rbx-tabs-horizontal") || s.querySelector("#horizontal-tabs, .rbx-tabs-horizontal") ? up : s; break; }
        up = up.parentElement;
      }
      after = after || f.row;
      for (let i = 0; i < 2; i++) {                                // skip a short "more" / "less" link that follows the bio
        const n = after.nextElementSibling, tx = n ? n.textContent.trim() : "";
        if (n && !n.matches(".rg-hx, .rg-pane") && tx && tx.length < 12 && !n.querySelector("#horizontal-tabs")) after = n; else break;
      }
      if (after.nextElementSibling !== hx) after.insertAdjacentElement("afterend", hx);
      card && card.remove();
      paint();
    }

    function placeCard(anchor) {
      if (!card) {
        card = R.h(`<div class="rg-gcard">
          <div class="rg-gtiles">
            <div class="rg-gtile"><b data-k="visits">…</b><span>Total visits</span></div>
            <div class="rg-gtile"><b><i class="rg-gdot"></i><span data-k="ccu" style="font:inherit;color:inherit;display:inline">…</span></b><span>Playing now (CCU)</span></div>
          </div>
          <div class="btn-control-md rg-hx-btn" role="button" tabindex="0">Hidden experiences</div>
          <div class="rg-hx-body" hidden></div></div>`);
        wire(card.querySelector(".rg-hx-btn"), card);
      }
      anchor.el.insertAdjacentElement(anchor.where, card);
      card.dataset.anchor = anchor.kind;
      const par = card.parentElement;
      const flex = par && getComputedStyle(par).display.includes("flex");
      card.style.flex = flex ? "0 0 100%" : "";
      if (flex && getComputedStyle(par).flexWrap === "nowrap") par.style.flexWrap = "wrap";
      paint();
    }

    const placeStats = () => {
      const now = Date.now();
      if (pills && pills[0].isConnected && pills[1].isConnected && hx.isConnected && lastRef && lastRef.isConnected) {
        if (mode === "float") posFloat();
        else if (!geoOk() && ++bad >= 2) toFloat();
        else if (geoOk()) bad = 0;
        return;                                                    // all good
      }
      if (now - lastPlace < 250) return;
      lastPlace = now;
      const f = findMembers();
      if (f) return placePills(f);
      if (card && card.isConnected) return;
      if (now - t0 < 2500) return;                                       // give Roblox time to draw its header
      const h = [...document.querySelectorAll("h1")].find((x) => x.getClientRects().length && !x.closest("aside, nav, .rg-pane, .rg-gcard"));
      if (h) return placeCard({ el: h, where: "afterend", kind: "title" });
      const c = [...document.querySelectorAll("main, #container-main, #group-container")].find((x) => !x.closest("aside, nav"));
      if (c) placeCard({ el: c, where: "afterbegin", kind: "top" });
    };

    // A "RoGen" tab next to About / Events / Store / Affiliates
    const pane = R.h(`<div class="rg-pane rg-group-pane"></div>`);
    pane.appendChild(sec);
    let tab = null;
    const place = () => {
      if (tab && document.contains(tab.li)) return;
      const ul = document.querySelector("#group-container #horizontal-tabs, .group-foundation-tabs");
      if (ul) {
        const box = ul.closest(".rbx-tabs-horizontal") || ul.parentElement;
        const li = R.h(`<li class="rbx-tab group-tab"><a class="rbx-tab-heading" tabindex="0"><span class="text-lead"><span class="rg-logo rg-tab-logo"></span>RoGen</span></a></li>`);
        tab = R.nativeTab({
          ul, li, pane, useHash: false,
          tabEl: (l) => l,
          nativeTabs: () => [...ul.querySelectorAll("li.rbx-tab")].filter((l) => l !== li),
          panes: () => { const out = []; let n = box.nextElementSibling; while (n) { if (n !== pane) out.push(n); n = n.nextElementSibling; } return out; },
          placePane: (p) => box.insertAdjacentElement("afterend", p),
          equalize: (lis) => lis.forEach((l) => (l.style.width = 100 / lis.length + "%")),
          onOpen: () => sec.activate()
        });
        tab.li = li;
      } else if (!tab) {
        // Roblox changed the tab bar: show RoGen as its own block lower on the page instead
        const host = document.querySelector("#group-container, .group-container, #container-main > .content, #container-main");
        if (host && !document.contains(pane)) { pane.style.display = ""; host.appendChild(pane); sec.activate(); }
      }
    };
    place();
    placeStats();
    // Don't rely only on page changes to notice the header: keep checking on a timer too
    const timer = setInterval(() => { placeStats(); if (Date.now() - t0 > 20000) { clearInterval(timer); keep = setInterval(placeStats, 2000); } }, 500);
    let keep = null;
    const fl = setInterval(() => mode === "float" && posFloat(), 300);
    return { tick: () => { place(); placeStats(); tab && tab.fit(); }, stop: () => { clearInterval(fl); clearInterval(timer); clearInterval(keep); pane.remove(); tab && tab.li.remove(); card && card.remove(); pills && pills.forEach((e) => e.remove()); hx && hx.remove(); } };
  });
})();
