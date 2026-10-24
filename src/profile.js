// Profile pages: status, account age, username history, follower tracking, value, outfit price, mutuals, compare, history, notes
(() => {
  const R = window.Rogen;

  R.userSummary = async (id) => {
    const [user, fr, fo, fg, groups] = await Promise.all([
      R.api(`https://users.roblox.com/v1/users/${id}`),
      R.api(`https://friends.roblox.com/v1/users/${id}/friends/count`).catch(() => ({})),
      R.api(`https://friends.roblox.com/v1/users/${id}/followers/count`).catch(() => ({})),
      R.api(`https://friends.roblox.com/v1/users/${id}/followings/count`).catch(() => ({})),
      R.api(`https://groups.roblox.com/v1/users/${id}/groups/roles`).catch(() => ({}))
    ]);
    return {
      id, user,
      friends: fr.count, followers: fo.count, following: fg.count,
      groups: (groups.data || []).length,
      ageDays: Math.floor((Date.now() - new Date(user.created)) / 86400e3)
    };
  };

  // Friends you and `uid` both have (cached for 10 minutes so profile pill, tab and search dropdown share one lookup)
  const mutualCache = new Map();
  R.mutualFriends = (uid) => {
    const me = R.me();
    if (!me || me.id === Number(uid)) return Promise.resolve([]);
    const c = mutualCache.get(uid);
    if (c && Date.now() - c.t < 10 * 60e3) return c.p;
    const p = (async () => {
      let mine = await R.myFriendIds();
      if (!mine.length) mine = await R.friendIds(me.id);
      const set = new Set(mine);
      return (await R.friendIds(uid)).filter((id) => set.has(id));
    })();
    mutualCache.set(uid, { t: Date.now(), p });
    p.catch(() => mutualCache.delete(uid));
    return p;
  };

  R.inventoryValue = async (id, onProgress) => {
    const items = await R.pages((c) => `https://inventory.roblox.com/v1/users/${id}/assets/collectibles?limit=100&sortOrder=Desc${c ? `&cursor=${encodeURIComponent(c)}` : ""}`, { max: 30, onPage: onProgress });
    const rap = items.reduce((t, i) => t + (i.recentAveragePrice || 0), 0);
    return { items: items.sort((a, b) => (b.recentAveragePrice || 0) - (a.recentAveragePrice || 0)), rap };
  };

  R.outfitPrice = async (id) => {
    const wearing = await R.api(`https://avatar.roblox.com/v1/users/${id}/currently-wearing`);
    const ids = wearing.assetIds || [];
    if (!ids.length) return { items: [], total: 0 };
    const out = [];
    for (const c of R.chunks(ids, 100)) {
      const d = await R.api("https://catalog.roblox.com/v1/catalog/items/details", { method: "POST", body: { items: c.map((i) => ({ itemType: "Asset", id: i })) } });
      out.push(...(d.data || []));
    }
    const priceOf = (i) => (i.lowestPrice ?? i.price ?? 0) || 0;
    return { items: out.sort((a, b) => priceOf(b) - priceOf(a)), total: out.reduce((t, i) => t + priceOf(i), 0), priceOf };
  };

  /* ---- How long you've been friends ----
     Roblox doesn't share the date two people became friends. RoGen watches your friends list, so:
     - someone who became your friend while RoGen was watching: exact (to within a few minutes)
     - someone who already was a friend when RoGen started watching: "at least" that long */
  const span = (ms) => {
    const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (m < 1) return "just now";
    if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
    if (h < 24) return `${h} hour${h === 1 ? "" : "s"}`;
    if (d < 60) return `${d} day${d === 1 ? "" : "s"}`;
    const mo = Math.floor(d / 30.44);
    if (mo < 24) return `${mo} month${mo === 1 ? "" : "s"}`;
    const y = Math.floor(d / 365.25), rest = Math.floor((d - y * 365.25) / 30.44);
    return `${y} year${y === 1 ? "" : "s"}${rest ? `, ${rest} month${rest === 1 ? "" : "s"}` : ""}`;
  };
  R.friendshipInfo = async (uid) => {
    const me = R.me();
    if (!me || me.id === uid) return null;
    const { friendSnap, friendSince = {}, friendSinceManual = {} } = await R.get(["friendSnap", "friendSince", "friendSinceManual"]);
    const snap = friendSnap && friendSnap.owner === me.id ? friendSnap : null;
    let t = null, exact = false, manual = false;
    if (friendSinceManual[uid]) { t = friendSinceManual[uid]; exact = true; manual = true; }
    else if (friendSince[uid]) { t = friendSince[uid]; exact = true; }
    else if (snap && snap.ids.includes(uid)) { t = snap.since; }
    else {
      // not in the last snapshot: ask Roblox, so a brand-new friend still shows up
      try {
        const r = await R.api(`https://friends.roblox.com/v1/users/${me.id}/friends/statuses?userIds=${uid}`);
        if (r.data && r.data[0] && r.data[0].status === "Friends") {
          t = Date.now();
          exact = !!snap;
          if (snap) R.set({ friendSince: { ...friendSince, [uid]: t } });
        }
      } catch (e) { /* not a friend, or Roblox said no */ }
    }
    if (!t) return null;
    const ms = Date.now() - t;
    return {
      t, exact, manual,
      text: `Friends for ${span(ms)}${exact ? "" : "+"}`,
      value: `${span(ms)}${exact ? "" : "+"}`,
      tip: (manual ? `You set this: friends since ${R.date(t)}.` : exact ? `You became friends on ${R.dateTime(t)}.` : `Roblox doesn't share the date you became friends, so this is only how long RoGen has seen you as friends (since ${R.date(t)}). It could be longer.`) + " Click to set the real date."
    };
  };

  const age = (days) => (days >= 365 ? `${(days / 365).toFixed(1).replace(/\.0$/, "")} years` : `${days} days`);

  R.route((p) => /^\/users\/\d+\/profile/i.test(p), () => {
    const uid = Number(location.pathname.match(/\/users\/(\d+)/)[1]);
    const me = R.me();
    const isMe = me && me.id === uid;
    let statusNode = null;
    // Record history on every visit, even if the RoGen tab isn't opened
    R.userSummary(uid).then((s) => {
      R.snap(`user:${uid}`, { friends: s.friends, followers: s.followers, following: s.following });
      R.snap(`userText:${uid}`, { displayName: s.user.displayName, name: s.user.name, description: s.user.description || "" }, { textOnly: true });
      R.recent.add({ kind: "user", id: uid, name: s.user.displayName, url: `https://www.roblox.com/users/${uid}/profile` });
    }).catch(() => {});

    const sec = R.section({
      id: "rg-profile",
      title: isMe ? "Your Account" : "Player Insights",
      lazy: true,
      right: R.copy(uid, "User ID"),
      tabs: [
        { id: "over", label: "Overview", render: overview },
        { id: "value", label: "Value", render: value },
        { id: "hist", label: "History", render: history },
        isMe ? { id: "play", label: "Playtime", render: (p) => { p.classList.add("rg-embed"); return R.views.playtime(p); } } : { id: "play", label: "Playtime", render: (p) => { p.classList.add("rg-embed"); return R.playtimeFor(p, uid); } },
        ...(R.badges.isOwner() ? [{ id: "badges", label: "Badges", render: (p) => R.badges.profileEditor(p, uid) }] : []),
      ]
    });

    async function overview(pane) {
      const s = await R.userSummary(uid);
      const names = await R.api(`https://users.roblox.com/v1/users/${uid}/username-history?limit=100&sortOrder=Desc`).catch(() => ({ data: [] }));
      await R.snap(`user:${uid}`, { friends: s.friends, followers: s.followers, following: s.following });
      await R.snap(`userText:${uid}`, { displayName: s.user.displayName, name: s.user.name, description: s.user.description || "" }, { textOnly: true });
      R.recent.add({ kind: "user", id: uid, name: s.user.displayName, url: location.href.split("#")[0] });
      const h = await R.hist(`user:${uid}`);
      pane.innerHTML = `
        <div class="rg-stats">
          ${R.stat("Account age", age(s.ageDays), "Joined " + R.date(s.user.created))}
          ${R.stat("Friends", R.fmt(s.friends))}
          ${R.stat("Followers", R.fmt(s.followers))}
          ${R.stat("Following", R.fmt(s.following))}
          ${R.stat("Groups", R.fmt(s.groups))}
          ${R.stat("Past usernames", R.fmt((names.data || []).length))}
        </div>
        ${s.user.isBanned ? `<p class="rg-bad" style="font-weight:700">This account is banned.</p>` : ""}
        <div class="rg-h3">Their experiences <span class="rg-sub">total visits and players right now</span></div>
        <div class="o-creations"></div>
        <div class="rg-h3">Badges</div>
        <button class="btn-control-md o-badges">Show all badges</button><div class="o-badgebox" style="margin-top:10px"></div>
        ${(names.data || []).length ? `<div class="rg-h3">Username history</div><div class="rg-chips">${names.data.map((n) => `<span class="rg-chip">@${R.esc(n.name)}</span>`).join("")}</div>` : ""}
        <div class="rg-h3">Followers over time</div>
        ${R.chart(h.map((x) => ({ t: x.t, v: x.followers })), { label: "Followers" })}
        ${R.chart(h.map((x) => ({ t: x.t, v: x.friends })), { label: "Friends" })}
        <p class="rg-note">RoGen saves a data point each time you visit this profile, so the graphs grow over time.</p>`;
      R.renderCreations(pane.querySelector(".o-creations"), uid);
      pane.querySelector(".o-badges").onclick = (e) => { e.currentTarget.remove(); R.renderUserBadges(pane.querySelector(".o-badgebox"), uid); };
    }

    async function value(pane) {
      pane.innerHTML = `<div class="rg-2col"><div><div class="rg-h3">Inventory value (limiteds)</div><div class="v-inv rg-loading">Counting limiteds…</div></div>
        <div><div class="rg-h3">Outfit they're wearing</div><div class="v-fit rg-loading">Pricing outfit…</div></div></div>`;
      R.outfitPrice(uid).then((o) => {
        const el = pane.querySelector(".v-fit");
        el.className = "v-fit";
        el.innerHTML = o.items.length ? `<div class="rg-stats">${R.stat("Outfit price", R.robux(o.total), `${o.items.length} items · offsale items count as 0`)}</div>
          <div class="rg-table-wrap" style="max-height:300px"><table class="rg-table"><tbody>${o.items.map((i) => `<tr>
            <td><img class="rg-thumb" data-thumb="asset:${i.id}"> <a href="https://www.roblox.com/catalog/${i.id}" target="_blank">${R.esc(i.name)}</a></td>
            <td class="rg-num">${i.isOffSale && !i.lowestPrice ? `<span class="rg-mute">Offsale</span>` : R.robux(o.priceOf(i))}</td></tr>`).join("")}</tbody></table></div>` : `<div class="rg-empty">Not wearing any catalog items.</div>`;
        R.fillThumbs(el);
      }).catch((e) => (pane.querySelector(".v-fit").outerHTML = R.errBox(e)));
      R.inventoryValue(uid, (all) => { pane.querySelector(".v-inv").textContent = `Counting limiteds… ${all.length}`; }).then(async (v) => {
        const el = pane.querySelector(".v-inv");
        el.className = "v-inv";
        await R.snap(`rap:${uid}`, { rap: v.rap }, { every: 12 * 3600e3 });
        const h = await R.hist(`rap:${uid}`);
        el.innerHTML = `<div class="rg-stats">${R.stat("Total RAP", R.robux(v.rap), "Recent average price of limiteds")}${R.stat("Limiteds", R.fmt(v.items.length))}</div>
          ${h.length > 1 ? R.chart(h.map((x) => ({ t: x.t, v: x.rap })), { label: "RAP over time", money: true }) : ""}
          ${v.items.length ? `<div class="rg-table-wrap" style="max-height:300px"><table class="rg-table"><tbody>${v.items.slice(0, 100).map((i) => `<tr>
            <td><img class="rg-thumb" data-thumb="asset:${i.assetId}"> <a href="https://www.roblox.com/catalog/${i.assetId}" target="_blank">${R.esc(i.name)}</a></td>
            <td class="rg-num">${R.robux(i.recentAveragePrice || 0)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="rg-empty">No limiteds.</div>`}`;
        R.fillThumbs(el);
      }).catch((e) => {
        pane.querySelector(".v-inv").outerHTML = e.status === 403 ? `<div class="rg-empty">This inventory is private.</div>` : R.errBox(e);
      });
    }

    async function mutual(pane) {
      const mine = new Set(await R.myFriendIds());
      if (!mine.size) { pane.innerHTML = `<div class="rg-empty">RoGen needs your friends list first. Visit the home page once, then come back.</div>`; return; }
      const theirs = await R.friendIds(uid);
      const both = theirs.filter((id) => mine.has(id));
      if (!both.length) { pane.innerHTML = `<div class="rg-empty">No mutual friends.</div>`; return; }
      const users = await R.users(both);
      pane.innerHTML = `<div class="rg-sub" style="margin-bottom:8px">${both.length} mutual friend${both.length === 1 ? "" : "s"}</div>
        <div class="rg-people" style="flex-wrap:wrap">${both.map((id) => `<a class="rg-person" href="https://www.roblox.com/users/${id}/profile">
          <img data-thumb="user:${id}"><div class="p-name">${R.esc(users[id]?.displayName || id)}</div><div class="p-sub">@${R.esc(users[id]?.name || "")}</div></a>`).join("")}</div>`;
      R.fillThumbs(pane);
    }

    async function compare(pane) {
      pane.innerHTML = `<div class="rg-row" style="margin-bottom:12px"><input class="rg-input" placeholder="Compare with username…" value="${isMe ? "" : R.esc(me ? me.name : "")}"><button class="btn-primary-md">Compare</button></div><div class="c-out"></div>`;
      const run = async () => {
        const name = pane.querySelector("input").value.trim();
        if (!name) return;
        const out = pane.querySelector(".c-out");
        out.innerHTML = `<div class="rg-loading">Comparing…</div>`;
        try {
          const other = await R.userByName(name);
          if (!other) { out.innerHTML = `<div class="rg-empty">No user named ${R.esc(name)}.</div>`; return; }
          out.innerHTML = await R.compareUsersHTML([uid, other.id]);
          R.fillThumbs(out);
        } catch (e) { out.innerHTML = R.errBox(e); }
      };
      pane.querySelector("button").onclick = run;
      pane.querySelector("input").onkeydown = (e) => { if (e.key === "Enter") run(); };
      if (!isMe && me) run();
    }

    async function history(pane) {
      const h = (await R.hist(`userText:${uid}`)).slice().reverse();
      pane.innerHTML = h.length ? `<ul class="rg-timeline">${h.map((x, i) => {
        const prev = h[i + 1];
        const changes = [];
        if (!prev) changes.push("First seen by RoGen");
        else {
          if (prev.displayName !== x.displayName) changes.push(`Display name: <b>${R.esc(prev.displayName)}</b> → <b>${R.esc(x.displayName)}</b>`);
          if (prev.name !== x.name) changes.push(`Username: <b>@${R.esc(prev.name)}</b> → <b>@${R.esc(x.name)}</b>`);
          if (prev.description !== x.description) changes.push("About section changed");
        }
        return `<li><time>${R.dateTime(x.t)}</time>${changes.join("<br>")}${x.description ? `<div class="rg-desc">${R.esc(x.description)}</div>` : ""}</li>`;
      }).join("")}</ul><p class="rg-note">Changes are recorded whenever you visit this profile.</p>` : `<div class="rg-empty">No history yet.</div>`;
    }

    // Status: a Discord-style bubble on the top corner of your profile picture (falls back to a pill under @username)
    let placing = false;
    // Roblox has more than one profile layout (and some pictures sit in a colored circle), so look for the
    // biggest round or square picture in the header: an <img>, a <canvas>, or a box with a background image
    const findAvatar = () => {
      const hdr = document.querySelector(".user-profile-header, .profile-header, #profile-header, [class*='profile-header'], [class*='ProfileHeader'], [data-testid*='profile-header']")
        || (document.querySelector(".stylistic-alts-username, .profile-display-name, #profile-header-title-container-name") || {}).closest?.("section, header, [class*='header']");
      if (!hdr) return null;
      const known = hdr.querySelector(".user-profile-header-details-avatar-container, .profile-avatar-thumb, [class*='avatar-container'], [class*='AvatarContainer'], [data-testid*='avatar']");
      let best = null, bw = 0;
      const consider = (el) => {
        if (el.closest(".rg-bubble, .rg-namebadges, .rg-bdline, .rg-mav, .rg-status")) return;
        const r = el.getBoundingClientRect();
        if (r.width >= 64 && Math.abs(r.width - r.height) <= Math.max(6, r.width * 0.08) && r.width > bw) { best = el; bw = r.width; }
      };
      if (known) { consider(known); known.querySelectorAll("img, canvas, span, div").forEach(consider); }
      if (!best) hdr.querySelectorAll("img, canvas").forEach(consider);
      if (!best) hdr.querySelectorAll("span, div, a").forEach((el) => { const cs = getComputedStyle(el); if (cs.backgroundImage !== "none" || parseFloat(cs.borderTopLeftRadius) >= 30) consider(el); });
      return best;
    };
    const putBubble = () => {
      if (!statusNode || !statusNode.classList.contains("rg-bubble") || !statusNode._av) return;
      const av = statusNode._av;
      if (!document.contains(av)) { statusNode.remove(); statusNode = null; return; }
      const r = av.getBoundingClientRect();
      if (!r.width) return;
      const h = statusNode.offsetHeight;
      statusNode.style.left = Math.round(r.left + scrollX + r.width * 0.62) + "px";
      statusNode.style.top = Math.round(r.top + scrollY + r.height * 0.12 - h) + "px";
    };
    const placeStatus = async () => {
      if (!isMe || placing) return;
      if (!R.feat("profileStatus")) { statusNode && statusNode.remove(); statusNode = null; return; }
      if (statusNode && document.contains(statusNode)) {
        // started as a pill because the picture wasn't drawn yet: move to the picture once it is
        if (!statusNode.classList.contains("rg-bubble") && findAvatar()) { statusNode.remove(); statusNode = null; }
        else { putBubble(); return; }
      }
      placing = true;
      const st = await R.get1("status", null);
      placing = false;
      if (statusNode && document.contains(statusNode)) return;
      document.querySelectorAll(".rg-status, .rg-bubble.rg-on-profile").forEach((n) => n.remove());
      const av = findAvatar();
      if (av) {
        statusNode = R.h(R.statusBubble(st, { editable: true }));
        statusNode.classList.add("rg-on-profile");
        statusNode._av = av;
        R.applyThemeAttr();
        document.body.appendChild(statusNode);
        putBubble();
        return;
      }
      const html = R.statusPill(st, { editable: true });
      if (!html) return;
      const uname = document.querySelector(".user-profile-header .stylistic-alts-username");
      const anchor = uname ? uname.parentElement : document.querySelector("#profile-header-title-container-name, .profile-header-names, .profile-display-name");
      if (!anchor) return;
      statusNode = R.h(html);
      anchor.insertAdjacentElement("afterend", statusNode);
    };
    addEventListener("resize", putBubble);
    const onStatus = (ch) => { if (ch.status) { statusNode && statusNode.remove(); statusNode = null; placeStatus(); } };
    chrome.storage.onChanged.addListener(onStatus);

    // "7 Mutual Friends" pill in the stats row (next to Friends / Followers / Following), with the first mutuals' faces.
    // It is a copy of Roblox's own "Following" pill so it matches; if that pill can't be found it falls back to a pill under the username.
    let mutNode = null, mutIds, mutBusy = false;
    const T0 = Date.now();
    const FOLLOW = /^[\d.,]+\s*[KMB]?\+?\s+Following$/i;
    const hasBg = (el) => { const c = getComputedStyle(el).backgroundColor; return c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c); };
    const deepest = (root) => [root, ...root.querySelectorAll("*")].find((n) => FOLLOW.test(n.textContent.trim()) && ![...n.children].some((c) => FOLLOW.test(c.textContent.trim())));
    const findFollowing = () => {
      const root = document.querySelector(".user-profile-header, .profile-header-overlay") || document.querySelector("main") || document.body;
      const hit = [...root.querySelectorAll("*")].find((n) => !n.closest(".rg-pane, .rg-mpill, aside, nav") && n.getClientRects().length && FOLLOW.test(n.textContent.trim()) && ![...n.children].some((c) => FOLLOW.test(c.textContent.trim())));
      if (!hit) return null;
      const t = hit.textContent.trim();
      let pillEl = hit;
      for (let i = 0; i < 3 && !hasBg(pillEl) && pillEl.parentElement && pillEl.parentElement.textContent.trim() === t; i++) pillEl = pillEl.parentElement;
      let unit = pillEl, n = 0;
      while (unit.parentElement && unit.parentElement.children.length < 2 && n++ < 4) unit = unit.parentElement;
      return unit.parentElement ? unit : null;
    };
    const buildMutual = (unit, ids) => {
      const label = `${ids.length} Mutual Friend${ids.length === 1 ? "" : "s"}`;
      let node;
      if (unit) {
        node = unit.cloneNode(true);
        node.removeAttribute("id"); node.removeAttribute("href"); node.removeAttribute("onclick");
        node.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
        node.querySelectorAll("[href]").forEach((e) => e.removeAttribute("href"));
        ["aria-haspopup", "aria-expanded", "aria-controls"].forEach((a) => { node.removeAttribute(a); node.querySelectorAll(`[${a}]`).forEach((e) => e.removeAttribute(a)); });
        const leaf = deepest(node);
        if (leaf) leaf.textContent = label; else node.textContent = label;
        node.classList.add("rg-mpill");
      } else {
        node = R.h(`<button type="button" class="rg-fpill rg-mpill"><span class="rg-mlabel"></span></button>`);
        node.querySelector(".rg-mlabel").textContent = label;
      }
      const av = R.h(`<span class="rg-mav"></span>`);
      ids.slice(0, 3).forEach((id) => { const i = document.createElement("img"); i.alt = ""; i.dataset.thumb = `user:${id}`; av.appendChild(i); });
      node.insertBefore(av, node.firstChild);
      node.title = "Open your mutual friends";
      R.fillThumbs(node);
      // Click: open the RoGen tab on Mutual Friends
      node.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        tab ? tab.show() : sec.activate();
        sec.activate();
        sec.showTab("mutual");
        sec.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      return node;
    };
    const placeMutual = async () => {
      if (isMe || !me) return;
      if (mutIds === undefined) {
        if (mutBusy) return;
        mutBusy = true;
        try { mutIds = await R.mutualFriends(uid); } catch (e) { mutIds = []; }
        mutBusy = false;
      }
      if (!mutIds.length || (mutNode && mutNode.isConnected)) return;
      const unit = Date.now() - T0 < 20000 ? findFollowing() : null;
      if (!mutNode) {
        if (!unit && Date.now() - T0 < 3000) return;          // give Roblox a moment to draw its pills first
        document.querySelectorAll(".rg-mpill").forEach((n) => n.remove());
        mutNode = buildMutual(unit, mutIds);
      }
      if (unit) { unit.insertAdjacentElement("afterend", mutNode); return; }
      const uname = document.querySelector(".user-profile-header .stylistic-alts-username");
      const anchor = uname ? uname.parentElement : document.querySelector("#profile-header-title-container-name, .profile-header-names, .profile-display-name");
      if (!anchor) return;
      anchor.insertAdjacentElement("afterend", mutNode);
    };

    // If YOU press Unfriend, remember it so they aren't listed as "unadded you"
    const onUnfriendClick = (e) => {
      const b = e.target.closest && e.target.closest("button, a, [role=menuitem], li");
      if (b && /^\s*unfriend\s*$/i.test(b.textContent || "")) R.get1("iUnfriended", []).then((l) => R.set({ iUnfriended: [...new Set([...l, uid])] }));
    };
    document.addEventListener("click", onUnfriendClick, true);

    // RoGen badges, shown after Roblox's own badges
    const bdm = R.feat("rogenBadges") ? R.badges.mountProfile(uid) : { tick() {}, stop() {} };

    // A "RoGen" tab next to About / Creations
    const pane = R.h(`<div class="profile-tab-content padding-top-xxlarge rg-pane"></div>`);
    pane.appendChild(sec);
    let tab = null;
    const place = () => {
      bdm.tick();
      placeStatus();
      if (!R.feat("profileTab")) return;
      if (tab && document.contains(tab.li)) return;
      const ul = document.querySelector("ul.profile-tabs");
      if (ul) {
        const li = R.h(`<li class="justify-center flex fill"><a id="tab-rogen" href="#rogen" class="profile-tab justify-center text-label-medium padding-bottom-xlarge padding-top-medium flex fill"><span class="rg-logo rg-tab-logo" style="align-self:center"></span>RoGen</a></li>`);
        tab = R.nativeTab({
          ul, li, pane,
          tabEl: (l) => l.querySelector("a"),
          nativeTabs: () => [...ul.querySelectorAll("a.profile-tab")].filter((a) => !li.contains(a)),
          panes: () => [...ul.parentElement.querySelectorAll(":scope > .profile-tab-content")],
          placePane: (p) => { const last = [...ul.parentElement.querySelectorAll(":scope > .profile-tab-content:not(.rg-pane)")].pop(); (last || ul).insertAdjacentElement("afterend", p); },
          onOpen: () => sec.activate()
        });
        tab.li = li;
      } else if (!document.contains(pane)) {
        const head = document.querySelector(".profile-header-overlay, .user-profile-header");
        if (head) { pane.style.display = ""; head.insertAdjacentElement("afterend", pane); sec.activate(); }
      }
    };
    place();
    return { tick: place, stop: () => { bdm.stop(); pane.remove(); tab && tab.li.remove(); statusNode && statusNode.remove(); mutNode && mutNode.remove(); chrome.storage.onChanged.removeListener(onStatus); document.removeEventListener("click", onUnfriendClick, true); } };
  });

  // Side-by-side comparison table for any number of users
  R.compareUsersHTML = async (ids) => {
    const list = await Promise.all(ids.map((id) => R.userSummary(id)));
    const vals = await Promise.all(ids.map((id) => R.inventoryValue(id).then((v) => v.rap).catch(() => null)));
    const rows = [
      ["Account age", (s) => s.ageDays, (s) => age(s.ageDays)],
      ["Friends", (s) => s.friends, (s) => R.fmt(s.friends)],
      ["Followers", (s) => s.followers, (s) => R.fmt(s.followers)],
      ["Following", (s) => s.following, (s) => R.fmt(s.following)],
      ["Groups", (s) => s.groups, (s) => R.fmt(s.groups)],
      ["Limiteds RAP", (s, i) => vals[i] ?? -1, (s, i) => (vals[i] == null ? `<span class="rg-mute">Private</span>` : R.robux(vals[i]))]
    ];
    return `<div class="rg-table-wrap"><table class="rg-table"><thead><tr><th></th>${list.map((s) => `<th><a href="https://www.roblox.com/users/${s.id}/profile"><img class="rg-thumb round" data-thumb="user:${s.id}"> ${R.esc(s.user.displayName)}</a><div class="rg-mute" style="font-weight:400">@${R.esc(s.user.name)}</div></th>`).join("")}</tr></thead>
      <tbody>${rows.map(([label, num, show]) => {
        const nums = list.map((s, i) => num(s, i));
        const best = Math.max(...nums);
        return `<tr><td class="rg-mute">${label}</td>${list.map((s, i) => `<td class="${nums[i] === best && list.length > 1 && best > 0 ? "rg-good" : ""}" style="font-weight:600">${show(s, i)}</td>`).join("")}</tr>`;
      }).join("")}</tbody></table></div>`;
  };
})();
