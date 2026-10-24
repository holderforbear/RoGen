// RoGen on the Roblox pages where each thing belongs. Every piece is the same view as on the RoGen dashboard
// (R.views), just placed inside the matching Roblox page:
//   Charts            → switch between Roblox Charts and RoGen Discover (and back)
// (Transactions, Friends and your profile are handled in widgets.js / profile.js.)
(() => {
  const R = window.Rogen;

  // Draw one of the RoGen views inside a pane/section body
  const embed = (view, after) => (pane) => {
    pane.classList.add("rg-embed");
    pane.innerHTML = "";
    const p = Promise.resolve(R.views[view](pane, null, new URLSearchParams()));
    return p.then(() => after && after(pane));
  };
  const block = (sec) => { sec.classList.add("rg-native-block"); return sec; };

  /* ---------------- KPI card (Robux, friends, followers…) used on Home ---------------- */
  R.widgets.kpis = async (el, me) => {
    el.innerHTML = `<div class="rg-loading">Loading your numbers…</div>`;
    const [s, cur, inv, r] = await Promise.all([
      R.userSummary(me.id),
      R.api(`https://economy.roblox.com/v1/users/${me.id}/currency`).catch(() => null),
      R.inventoryValue(me.id).catch(() => null),
      R.rates()
    ]);
    await R.snap(`user:${me.id}`, { friends: s.friends, followers: s.followers, following: s.following });
    const h = await R.hist(`user:${me.id}`);
    const w = h.find((x) => Date.now() - x.t < 8 * 864e5) || h[0] || {};
    const d = (now, then) => (then == null || now == null || now === then ? "" : `<span class="rg-delta ${now > then ? "up" : "down"}">${now > then ? "+" : "−"}${R.short(Math.abs(now - then))}</span>`);
    el.innerHTML = `<div class="rg-stats">
      ${cur ? R.stat("Your Robux", `<span class="rg-my-robux">${R.robux(cur.robux)}</span>`, `≈ $${(cur.robux * r.devex).toFixed(2)} DevEx value`) : ""}
      ${R.stat("Friends", R.fmt(s.friends), d(s.friends, w.friends))}
      ${R.stat("Followers", R.short(s.followers), d(s.followers, w.followers))}
      ${R.stat("Following", R.short(s.following), d(s.following, w.following))}
      ${R.stat("Groups", R.fmt(s.groups))}
      ${R.stat("Limiteds RAP", inv ? R.robux(inv.rap, { short: true }) : `<span class="rg-mute" style="font-size:15px">Private</span>`)}
    </div>`;
  };

  /* ---------------- Charts: Roblox Charts ⇄ RoGen Discover ---------------- */
  R.route((p) => R.feat("chartsDiscover") && p === "/charts", () => {
    const KEY = "rgChartsMode";
    let mode = "roblox", built = false;
    try { mode = sessionStorage.getItem(KEY) === "rogen" ? "rogen" : "roblox"; } catch (e) { /* ignore */ }
    const bar = R.h(`<div class="rg-switch" role="tablist"><button type="button" data-m="roblox" role="tab">Roblox Charts</button><button type="button" data-m="rogen" role="tab"><span class="rg-logo"></span>RoGen Discover</button><a class="rg-switch-full" href="https://www.roblox.com/rogen#discover">Open full page</a></div>`);
    const host = R.h(`<div class="rg-embed rg-charts-host" hidden></div>`);
    const apply = () => {
      const content = R.mainContent();
      bar.querySelectorAll("button").forEach((b) => { b.classList.toggle("on", b.dataset.m === mode); b.setAttribute("aria-selected", b.dataset.m === mode); });
      host.hidden = mode !== "rogen";
      // Hide / restore everything else Roblox drew in the page
      [...content.children].forEach((c) => {
        if (c === bar || c === host) return;
        if (mode === "rogen") {
          if (c.dataset.rgPrev === undefined) { c.dataset.rgPrev = c.style.display || ""; c.style.display = "none"; }
        } else if (c.dataset.rgPrev !== undefined) { c.style.display = c.dataset.rgPrev; delete c.dataset.rgPrev; }
      });
      if (mode === "rogen" && !built) { built = true; R.views.discover(host).catch((e) => (host.innerHTML = R.errBox(e))); }
    };
    bar.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b || b.dataset.m === mode) return;
      mode = b.dataset.m;
      try { sessionStorage.setItem(KEY, mode); } catch (err) { /* ignore */ }
      apply();
      window.scrollTo({ top: 0 });
    };
    const place = () => {
      const content = R.mainContent();
      if (!content) return;
      if (content.firstElementChild !== bar) content.insertAdjacentElement("afterbegin", bar);
      if (bar.nextElementSibling !== host) bar.insertAdjacentElement("afterend", host);
      apply();
    };
    place();
    return {
      tick: place,
      stop: () => {
        const content = R.mainContent();
        content && [...content.children].forEach((c) => { if (c.dataset.rgPrev !== undefined) { c.style.display = c.dataset.rgPrev; delete c.dataset.rgPrev; } });
        bar.remove(); host.remove();
      }
    };
  });





})();
