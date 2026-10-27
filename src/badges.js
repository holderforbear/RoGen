// RoGen badges.
//  - Only the OWNER can give or take badges (by user ID, so name changes never matter).
//  - Badges show on a person's Roblox profile after Roblox's own badges, with a hover tooltip.
//  - Other people's RoGen sees them by reading the published list (badges.json). See README → Badges.
(() => {
  const R = (window.Rogen = window.Rogen || {});
  R.extraViews = R.extraViews || {};

  const OWNER_ID = 10980633414;
  // Paste the raw link to your published badges.json here BEFORE you share the extension with other people,
  // so their RoGen reads it automatically. (You can also test it from RoGen → Badges → Share.)
  const FEED_URL = R.BADGE_FEED_URL || "";   // set in src/badges-list.js

  const ICONS = R.BADGE_ICONS || {};
  // Order here = order everywhere (1 = most important)
  const DEFS = [
    { id: "high-status", name: "High Status", desc: "A high status member of the RoGen community." },
    { id: "high-donator", name: "High Donator", desc: "Made a major donation to support RoGen." },
    { id: "friends-of-owner", name: "Friends Of Owner", desc: "A friend of RoGen's owner." },
    { id: "donator", name: "Donator", desc: "Donated to support RoGen." }
  ];
  const BY = Object.fromEntries(DEFS.map((d) => [d.id, d]));
  const ORDER = DEFS.map((d) => d.id);
  const clean = (ids) => ORDER.filter((id) => Array.isArray(ids) && ids.includes(id));
  const isOwner = () => { const me = R.me(); return !!me && me.id === OWNER_ID; };
  const needOwner = () => { if (!isOwner()) throw new Error("Only the owner can change badges."); };
  const key = (uid) => String(Number(uid));

  /* ---------------- data ---------------- */
  let local = {}, feed = {}, feedUrl = "", fileGrants = {};
  // Badges.txt in the RoGen folder: [Badge name] headings with user IDs under them
  const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
  const loadFile = () => R.send({ type: "readBadgesFile" }).then((r) => {
    const out = {};
    ((r && r.sections) || []).forEach((sec) => {
      const d = DEFS.find((x) => norm(x.name) === norm(sec.name) || norm(x.id) === norm(sec.name));
      if (d) sec.ids.forEach((id) => { (out[id] = out[id] || []).push(d.id); });
    });
    fileGrants = out;
  }).catch(() => {});
  const ready = R.get(["badgeGrants", "badgeFeed", "badgeFeedUrl"]).then((v) => {
    local = v.badgeGrants || {};
    feed = (v.badgeFeed && v.badgeFeed.grants) || {};
    feedUrl = v.badgeFeedUrl || "";
    return loadFile();
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local") return;
    if (ch.badgeGrants) local = ch.badgeGrants.newValue || {};
    if (ch.badgeFeed) { feed = (ch.badgeFeed.newValue && ch.badgeFeed.newValue.grants) || {}; announce(); }
    if (ch.badgeFeedUrl) feedUrl = ch.badgeFeedUrl.newValue || "";
  });
  // The owner's own list is the source of truth on the owner's machine. Everyone else reads the published list.
  // Everyone sees: the built-in list (src/badges-list.js) + the published list. The owner's own picks are added too.
  const fileList = () => {
    const out = { ...(R.BADGE_LIST || {}) };
    for (const id in fileGrants) out[id] = [...(out[id] || []), ...fileGrants[id]];
    return out;
  };
  const grantsFor = (uid) => {
    const k = key(uid);
    const extra = isOwner() ? (local[k] ? local[k].b : []) : (feed[k] || []);
    return clean([...(fileList()[k] || []), ...extra]);
  };

  /* ---------------- going live for everyone ----------------
     The owner connects a GitHub Gist once (RoGen → Badges → Go live). After that, every change is pushed to it
     automatically, and every other RoGen reads it every minute. The token never leaves the owner's browser
     except to talk to api.github.com. */
  let pubTimer = null;
  const schedulePublish = () => { if (isOwner()) { clearTimeout(pubTimer); pubTimer = setTimeout(() => B.publish().catch(() => {}), 1200); } };

  // Safety net: if the owner's saved list is ever empty (fresh install, different folder, Chrome profile reset),
  // bring it back from the published list instead of starting over. Never overwrites a list that has people in it.
  let restored = Promise.resolve();
  const restoreOwner = async () => {
    await ready;
    if (!isOwner() || Object.keys(local).length) return;
    const url = B.feedUrl();
    if (!url) return;
    const r = await R.send({ type: "fetchBadgeFeed", url });
    if (!r || !r.ok) return;
    const f = await R.get1("badgeFeed", null);
    if (f && f.grants && Object.keys(f.grants).length && !Object.keys(local).length) await B.importObj({ grants: f.grants }, { replace: true, noPublish: true });
  };

  const B = (R.badges = {
    OWNER_ID, defs: DEFS, by: BY, ready: () => ready, isOwner,
    feedUrl: () => (!isOwner() && FEED_URL) || feedUrl || FEED_URL,
    sync: grantsFor,
    of: async (uid) => { await ready; return grantsFor(uid); },
    all: async () => {
      await ready;
      return Object.entries(local).map(([id, v]) => ({ id: Number(id), badges: clean(v.b), at: v.at || 0 })).filter((x) => x.badges.length).sort((a, b) => b.at - a.at);
    },
    set: async (uid, ids) => {
      needOwner(); await ready; await restored;
      const k = key(uid);
      if (!/^\d{1,13}$/.test(k)) throw new Error("That isn't a valid user ID.");
      const list = clean(ids);
      if (list.length) local[k] = { b: list, at: (local[k] && local[k].at) || Date.now() };
      else delete local[k];
      await R.set({ badgeGrants: local });
      schedulePublish();
      return list;
    },
    remove: async (uid) => B.set(uid, []),
    exportObj: async () => {
      await ready;
      const grants = {};
      Object.entries(local).forEach(([id, v]) => { const l = clean(v.b); if (l.length) grants[id] = l; });
      Object.entries(fileList()).forEach(([id, v]) => { const l = clean([...(grants[id] || []), ...(Array.isArray(v) ? v : [])]); if (l.length) grants[id] = l; });   // include the built-in list
      const live = await R.get1("ownerLive", null);   // announcement, newest version, features switched off for everyone
      return { app: "RoGen badges", version: 1, owner: OWNER_ID, updated: Date.now(), grants, ...(live ? { live } : {}) };
    },
    importObj: async (obj, { replace = false, noPublish = false } = {}) => {
      needOwner(); await ready;
      const src = (obj && obj.grants) || obj || {};
      const next = replace ? {} : { ...local };
      let n = 0;
      for (const [id, v] of Object.entries(src)) {
        if (!/^\d{1,13}$/.test(id) || !Array.isArray(v)) continue;
        const l = clean(v);
        if (!l.length) continue;
        next[id] = { b: replace ? l : clean([...(next[id] ? next[id].b : []), ...l]), at: (next[id] && next[id].at) || Date.now() };
        n++;
      }
      local = next;
      await R.set({ badgeGrants: local });
      if (!noPublish) schedulePublish();
      return n;
    },
    // Ask the background page to download the published list (everyone except the owner uses this)
    refreshFeed: async ({ force = false } = {}) => {
      await ready;
      const url = B.feedUrl();
      if (!url) return { ok: false, reason: "No list address set." };
      const cur = await R.get1("badgeFeed", null);
      if (!force && cur && cur.url === url && Date.now() - cur.at < 50e3) return { ok: true, skipped: true };
      return R.send({ type: "fetchBadgeFeed", url });
    },
    gist: async () => R.get1("badgeGist", null),
    pubState: async () => R.get1("badgePub", null),
    publish: async () => {
      needOwner(); await ready;
      const cfg = await R.get1("badgeGist", null);
      if (!cfg || !cfg.id || !cfg.token) return { ok: false, reason: "Not connected to a Gist yet." };
      const content = JSON.stringify(await B.exportObj(), null, 1);
      const r = await R.send({ type: "publishBadges", id: cfg.id, token: cfg.token, content });
      await R.set({ badgePub: { at: Date.now(), ok: !!r.ok, reason: r.reason || "" } });
      return r;
    },
    connect: async ({ token, id }) => {
      needOwner();
      token = (token || "").trim(); id = (id || "").trim();
      if (!token) throw new Error("Paste your GitHub token first.");
      const content = JSON.stringify(await B.exportObj(), null, 1);
      const r = id
        ? await R.send({ type: "publishBadges", id, token, content, probeLogin: true })
        : await R.send({ type: "createBadgeGist", token, content });
      if (!r.ok) throw new Error(r.reason || "Couldn't connect.");
      const gid = id || r.id;
      const raw = r.rawUrl || "";
      await R.set({ badgeGist: { id: gid, token, rawUrl: raw } });
      if (raw) await B.setFeedUrl(raw);
      await R.set({ badgePub: { at: Date.now(), ok: true, reason: "" } });
      return { id: gid, rawUrl: raw };
    },
    disconnect: async () => { needOwner(); await R.set({ badgeGist: null }); },
    publishSoon: () => schedulePublish(),
    // Anyone (not just the owner) can set the list link, so a friend can fix "I can't see badges" without editing files
    setMyFeedUrl: async (url) => { feedUrl = (url || "").trim(); await R.set({ badgeFeedUrl: feedUrl }); },
    setFeedUrl: async (url) => { needOwner(); feedUrl = (url || "").trim(); await R.set({ badgeFeedUrl: feedUrl }); }
  });

  /* ---------------- pieces of UI ---------------- */
  const img = (d) => `<img class="rg-bd-img" src="${ICONS[d.id] || ""}" alt="${R.esc(d.name)}" draggable="false">`;
  // Roblox's own marks. These always come FIRST in any badge row, before RoGen's.
  const VERIFIED_SVG = `<svg class="rg-bd-img" viewBox="0 0 24 24" aria-hidden="true"><path fill="#0066ff" d="M12 1.6l2.5 1.9 3.1-.2 1 3 2.6 1.7-.9 3 1 3-2.6 1.8-1 2.9-3.1-.1L12 22.4l-2.5-1.9-3.1.1-1-2.9-2.6-1.8 1-3-.9-3 2.6-1.7 1-3 3.1.2z"/><path fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M7.6 12.3l3 3 5.8-6.2"/></svg>`;
  const NATIVE = { verified: { id: "verified", name: "Verified", desc: "This account is verified by Roblox.", src: "Roblox", svg: VERIFIED_SVG } };
  const iconOf = (id) => (NATIVE[id] ? NATIVE[id].svg : img(BY[id]));
  const defOf = (id) => NATIVE[id] || BY[id];
  B.native = NATIVE;
  // Small icons in a row (names, headers). Hover shows the tooltip.
  B.chips = (ids, { size = 24 } = {}) => clean(ids).map((id) => `<span class="rg-bd-chip" data-bd="${id}" style="--s:${size}px">${img(BY[id])}</span>`).join("");
  // Every badge lined up like Roblox's name badges: Roblox's own marks (verified…) first, then RoGen's in rank order
  B.row = (ids, { verified = false, size = 20 } = {}) => {
    const all = [...(verified ? ["verified"] : []), ...clean(ids)];
    return all.length ? `<span class="rg-bdline" style="--s:${size}px">${all.map((id) => `<span class="rg-bd-chip${NATIVE[id] ? " native" : ""}" data-bd="${id}">${iconOf(id)}</span>`).join("")}</span>` : "";
  };
  // Badge tiles, like Roblox's badge row (Roblox's own first)
  B.tiles = (ids, { verified = false } = {}) => `<ul class="rg-bd-row">${[...(verified ? ["verified"] : []), ...clean(ids)].map((id) => `<li class="rg-bd${NATIVE[id] ? " native" : ""}" data-bd="${id}"><span class="rg-bd-ic">${iconOf(id)}</span><span class="rg-bd-nm">${R.esc(defOf(id).name)}</span><span class="rg-bd-src">${NATIVE[id] ? "Roblox" : "RoGen"}</span></li>`).join("")}</ul>`;

  /* ---------------- "You got a badge" popup ---------------- */
  // Shown to a RoGen user the first time their copy sees a badge that was given to them.
  let announcing = false;
  async function announce() {
    const me = R.me();
    if (!me || isOwner() || announcing) return;
    announcing = true;
    try {
      await ready;
      const now = grantsFor(me.id);
      const all = await R.get1("badgeSeen", {});
      const seen = all[me.id];
      all[me.id] = now;
      if (seen === undefined) { await R.set({ badgeSeen: all }); return; }          // first run: don't pop up old badges
      const fresh = now.filter((id) => !seen.includes(id));
      if (JSON.stringify(seen) !== JSON.stringify(now)) await R.set({ badgeSeen: all });
      if (!fresh.length || document.visibilityState !== "visible") return;
      fresh.forEach((id, i) => setTimeout(() => {
        const d = BY[id];
        const card = R.h(`<div class="rg-bdgift" role="status"><span class="rg-bdgift-ic">${img(d)}</span><div><b>You got the ${R.esc(d.name)} badge!</b><small>${R.esc(d.desc)}</small></div></div>`);
        document.body.appendChild(card);
        requestAnimationFrame(() => card.classList.add("in"));
        setTimeout(() => { card.classList.remove("in"); setTimeout(() => card.remove(), 300); }, 7000);
        card.onclick = () => { card.remove(); };
      }, i * 900));
    } finally { announcing = false; }
  }

  /* ---------------- hover tooltip ---------------- */
  let tip = null, tipFor = null;
  const hideTip = () => { if (tip) { tip.remove(); tip = null; tipFor = null; } };
  const showTip = (el) => {
    const d = defOf(el.dataset.bd);
    if (!d) return;
    hideTip();
    tipFor = el;
    const rank = NATIVE[d.id] ? "" : ` · #${ORDER.indexOf(d.id) + 1}`;
    tip = R.h(`<div class="rg-bdtip" role="tooltip"><span class="rg-bdtip-ic">${iconOf(d.id)}</span><div><em>${NATIVE[d.id] ? "Roblox badge" : "RoGen badge" + rank}</em><b>${R.esc(d.name)}</b><small>${R.esc(d.desc)}</small></div></div>`);
    document.body.appendChild(tip);
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
    let y = r.top - h - 10;
    if (y < 8) y = r.bottom + 10;
    tip.style.left = x + "px"; tip.style.top = y + "px";
    requestAnimationFrame(() => tip && tip.classList.add("in"));
  };
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest && e.target.closest("[data-bd]");
    if (el) { if (el !== tipFor) showTip(el); } else if (tip) hideTip();
  });
  document.addEventListener("mouseout", (e) => { if (tipFor && !tipFor.contains(e.relatedTarget)) hideTip(); });
  document.addEventListener("mousemove", () => { if (tip && !document.contains(tipFor)) hideTip(); });   // the badge was redrawn under the mouse
  document.addEventListener("scroll", hideTip, true);
  document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest("[data-rg-bd-li]")) e.preventDefault(); }, true);

  /* ---------------- on a Roblox profile ---------------- */
  // Roblox's "Roblox Badges" row. RoGen badges go AFTER Roblox's own, copying the look of Roblox's tiles.
  const findRobloxList = () => {
    const direct = document.querySelector(".roblox-badges-container ul, .roblox-badges ul, [class*='roblox-badges'] ul");
    if (direct) return direct;
    for (const h of document.querySelectorAll("h1,h2,h3,h4,.container-header,[class*='heading'],[class*='title']")) {
      if (h.children.length > 2 || !/^roblox badges$/i.test(h.textContent.trim())) continue;
      let c = h.parentElement;
      for (let i = 0; i < 4 && c; i++, c = c.parentElement) {
        const ul = c.querySelector("ul");
        if (ul && ul.children.length) return ul;
      }
    }
    return null;
  };
  const nativeLi = (list, d) => {
    const tpl = [...list.children].find((c) => c.tagName === "LI" && !c.hasAttribute("data-rg-bd-li"));
    if (!tpl) return null;
    const li = tpl.cloneNode(true);
    const pic = li.querySelector("img");
    if (!pic) return null;
    li.querySelectorAll("*").forEach((n) => {
      [...n.attributes].forEach((a) => { if (/^(data-|ng-|id$|href$|title$|onclick$|srcset$)/i.test(a.name)) n.removeAttribute(a.name); });
    });
    pic.src = ICONS[d.id] || ""; pic.alt = d.name;
    const leaves = [...li.querySelectorAll("*")].filter((e) => !e.children.length && e.textContent.trim());
    leaves.forEach((e, i) => { if (i === 0) e.textContent = d.name; else e.remove(); });
    li.setAttribute("data-rg-bd-li", ""); li.setAttribute("data-bd", d.id);
    li.style.cursor = "default";
    return li;
  };

  // The display name in Roblox's profile header (the element the verified checkmark sits in)
  const findNameEl = () => {
    const root = document.querySelector(".user-profile-header, .profile-header-overlay, #profile-header") || document;
    const uname = root.querySelector(".stylistic-alts-username");
    const ok = (e) => e && !(uname && e.contains(uname)) && !e.closest(".rg-section, .rg-pane");
    const direct = [...root.querySelectorAll("#profile-header-title-container-name, .profile-display-name, h1.profile-name, h1")].find(ok);
    if (direct) return direct;
    if (uname && uname.parentElement) return [...uname.parentElement.children].find((c) => c !== uname && !c.contains(uname) && c.textContent.trim() && !c.matches(".rg-status, .rg-fpill")) || null;
    return null;
  };
  const dropNameBadge = () => document.querySelectorAll(".rg-namebadges, .rg-namebadge").forEach((n) => n.remove());
  // Roblox's own marks next to a name (verified, premium…). RoGen's line up AFTER the last of these, never before.
  const NATIVE_MARK = ".verified-badge-icon-container, [class*='verified-badge'], [class*='VerifiedBadge'], [data-testid*='verified'], .icon-premium, [class*='premium-badge'], [class*='premium-icon']";
  const nativeMarks = (el) => {
    const scope = el.parentElement || el;
    const all = [...scope.querySelectorAll(NATIVE_MARK)].filter((n) => !n.closest(".rg-namebadges")
      && (el.contains(n) || (el.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)));
    return all.filter((n) => !all.some((o) => o !== n && o.contains(n)));    // outermost only
  };
  // Like Roblox's verified / star-creator mark, but ALL of them in a line: Roblox's marks first, then every RoGen badge in rank order
  const placeNameBadge = (ids) => {
    const el = ids.length ? findNameEl() : null;
    if (!el) { dropNameBadge(); return; }
    const marks = nativeMarks(el);
    const anchor = marks[marks.length - 1] || null;
    const sig = ids.join();
    const cur = document.querySelector(".rg-namebadges");
    const placed = cur && cur.dataset.sig === sig && (anchor ? cur.previousElementSibling === anchor : cur.parentElement === el && cur === el.lastElementChild);
    if (placed) return;
    dropNameBadge();
    const node = R.h(`<span class="rg-namebadges" data-sig="${sig}" aria-label="RoGen badges: ${R.esc(ids.map((id) => BY[id].name).join(", "))}">${ids.map((id) => `<span class="rg-namebadge" data-bd="${id}">${img(BY[id])}</span>`).join("")}</span>`);
    if (anchor) anchor.insertAdjacentElement("afterend", node);
    else el.appendChild(node);
  };

  B.mountProfile = (uid) => {
    let section = null, busy = false;
    const clear = () => { document.querySelectorAll("[data-rg-bd-li]").forEach((n) => n.remove()); section && section.remove(); section = null; };
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        await ready;
        const ids = grantsFor(uid);
        placeNameBadge(ids);
        if (!ids.length) { if (section || document.querySelector("[data-rg-bd-li]")) clear(); return; }
        const list = findRobloxList();
        if (list) {
          const have = [...list.children].filter((c) => c.hasAttribute("data-rg-bd-li")).map((c) => c.dataset.bd);
          if (have.join() === ids.join()) { section && (section.remove(), (section = null)); return; }
          clear();
          let ok = true;
          for (const id of ids) { const li = nativeLi(list, BY[id]); if (!li) { ok = false; break; } list.appendChild(li); }
          if (ok) return;
          clear();
        }
        // No Roblox badge row to join: the icon next to the name is enough, so nothing else is drawn
        clear();
      } finally { busy = false; }
    };
    const onChange = (ch, area) => { if (area === "local" && (ch.badgeGrants || ch.badgeFeed)) { clear(); tick(); } };
    chrome.storage.onChanged.addListener(onChange);
    return { tick, stop: () => { clear(); dropNameBadge(); chrome.storage.onChanged.removeListener(onChange); } };
  };

  // Owner-only: tick badges for the profile you're looking at (the "Badges" tab in RoGen's profile section)
  B.profileEditor = async (pane, uid) => {
    if (!isOwner()) { pane.innerHTML = `<div class="rg-empty">Only the owner can give badges.</div>`; return; }
    await ready;
    const draw = () => {
      const have = grantsFor(uid);
      pane.innerHTML = `<p class="rg-note" style="margin:0 0 12px">Click a badge to give it or take it away. It's saved to this person's <b>user ID (${uid})</b>, so it stays with them if they change their name.</p>
        <div class="bd-picks">${DEFS.map((d) => `<button type="button" class="bd-pick ${have.includes(d.id) ? "on" : ""}" data-id="${d.id}">${img(d)}<b>${R.esc(d.name)}</b><small>${have.includes(d.id) ? "Given · click to take away" : "Click to give"}</small></button>`).join("")}</div>
        <p class="rg-note"><a class="rg-link" href="https://www.roblox.com/rogen#badges">Open the full Badges manager →</a></p>`;
      pane.querySelectorAll(".bd-pick").forEach((b) => (b.onclick = async () => {
        const cur = grantsFor(uid), id = b.dataset.id;
        await B.set(uid, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
        R.toast(cur.includes(id) ? `Took away ${BY[id].name}` : `Gave ${BY[id].name}`);
        draw();
      }));
    };
    draw();
  };

  /* ---------------- the Badges page (owner only) ---------------- */
  const names = {};   // id -> {name, displayName}, so lists show CURRENT names
  const loadNames = async (ids) => {
    const need = ids.filter((id) => !names[id]);
    if (!need.length) return;
    try { const u = await R.users(need); for (const id in u) names[id] = { name: u[id].name, displayName: u[id].displayName, verified: !!u[id].hasVerifiedBadge }; } catch (e) { /* names are optional */ }
  };

  R.extraViews.badges = async (main) => {
    if (!isOwner()) { main.innerHTML = `<div class="rg-empty" style="padding:80px 0">Only the owner can manage badges.</div>`; return; }
    await ready;
    const $ = (s) => main.querySelector(s);
    const st = { q: "", f: "" };
    const picked = new Set();
    main.innerHTML = `<div class="rg-pagehead"><h1>Badges</h1><p class="rg-lead">Give RoGen badges by user ID. Usernames change, IDs never do, so badges always follow the person.</p></div>
      <div class="bd-cards"></div>
      <div class="rg-section section"><div class="container-header rg-head"><h2>Give or take away</h2></div>
        <div class="section-content rg-body">
          <label class="rg-field">User ID(s) <span style="font-weight:400">add as many as you like, separated by spaces, commas or new lines</span>
            <textarea class="rg-textarea g-ids" rows="2" placeholder="10980633414, 123456789"></textarea></label>
          <div class="g-prev"></div>
          <div class="rg-h3">Pick badges</div>
          <div class="bd-picks">${DEFS.map((d) => `<button type="button" class="bd-pick" data-id="${d.id}">${img(d)}<b>${R.esc(d.name)}</b><small>${R.esc(d.desc)}</small></button>`).join("")}</div>
          <div class="rg-row" style="margin-top:16px"><button class="btn-primary-md g-give">Give badges</button><button class="btn-control-md g-take">Take away</button><span class="rg-mute g-msg" style="font-size:14px"></span></div>
        </div></div>
      <div class="rg-section section"><div class="container-header rg-head"><h2>People with badges <span class="rg-sub l-count"></span></h2></div>
        <div class="section-content rg-body"><div class="rg-toolbar"><input class="rg-input l-q" placeholder="Search by name or ID…" style="flex:1;min-width:200px">
          <select class="rg-select l-f"><option value="">All badges</option>${DEFS.map((d) => `<option value="${d.id}">${R.esc(d.name)}</option>`).join("")}</select></div>
          <div class="l-list"></div></div></div>
      <div class="rg-section section"><div class="container-header rg-head"><h2>Go live for everyone <span class="rg-sub gl-pill"></span></h2></div>
        <div class="section-content rg-body">
          <p class="rg-note" style="margin-top:0">Connect once and every badge you give or take away is sent out <b>automatically</b>. Everyone using RoGen sees the new badge next to the name within about a minute, and the person who got it gets a little popup. This uses a free GitHub Gist as the list.</p>
          <div class="gl-off">
            <ol class="rg-note" style="margin:0 0 12px;padding-left:20px;line-height:1.6">
              <li>On GitHub go to <b>Settings → Developer settings → Personal access tokens → Tokens (classic)</b> → <b>Generate new token</b>. Tick only <b>gist</b>. Copy the token.</li>
              <li>Paste it below and press <b>Create Gist &amp; connect</b>. (Already made a Gist? Put its ID in the second box instead.)</li>
              <li>Copy the <b>list link</b> RoGen shows you into <code>FEED_URL</code> at the top of <code>src/badges.js</code> <u>before</u> you share RoGen. You only do this once.</li>
            </ol>
            <div class="rg-row"><input class="rg-input gl-token" type="password" autocomplete="off" placeholder="GitHub token (starts with ghp_ or github_pat_)" style="flex:1;min-width:260px"><input class="rg-input gl-id" placeholder="Existing Gist ID (optional)" style="width:240px"><button class="btn-primary-md gl-connect">Create Gist &amp; connect</button></div>
          </div>
          <div class="gl-on" hidden>
            <div class="rg-h3" style="margin-top:0">List link for <code>FEED_URL</code></div>
            <div class="rg-row"><input class="rg-input gl-raw" readonly style="flex:1;min-width:260px"><button class="btn-control-md gl-copyraw">Copy link</button></div>
            <div class="rg-row" style="margin-top:12px"><button class="btn-primary-md gl-now">Publish now</button><button class="btn-control-md gl-off-btn">Disconnect</button><span class="rg-mute gl-msg" style="font-size:14px"></span></div>
          </div>
        </div></div>
      <div class="rg-section section"><div class="container-header rg-head"><h2>Share by hand (optional)</h2></div>
        <div class="section-content rg-body">
          <p class="rg-note" style="margin-top:0">Badges you give are saved in <b>this browser</b>. Other people's RoGen only shows them if it can read your published list. Download <b>badges.json</b>, put it on GitHub, and paste its <b>raw</b> link below. Anyone using your copy of RoGen with the same link in <code>src/badges.js</code> (<code>FEED_URL</code>) will see the badges.</p>
          <div class="rg-row"><button class="btn-primary-md s-dl">Download badges.json</button><button class="btn-control-md s-copy">Copy JSON</button>
            <label class="btn-control-md" style="cursor:pointer">Import file…<input type="file" accept=".json,application/json" hidden class="s-file"></label></div>
          <div class="rg-h3">Published list link</div>
          <div class="rg-row"><input class="rg-input s-url" placeholder="https://raw.githubusercontent.com/you/rogen-badges/main/badges.json" style="flex:1;min-width:260px"><button class="btn-control-md s-save">Save link</button><button class="btn-control-md s-load">Load list from link</button></div>
          <p class="rg-note s-state"></p>
        </div></div>`;

    /* --- cards (counts + filter) --- */
    const drawCards = async () => {
      const all = await B.all();
      $(".bd-cards").innerHTML = DEFS.map((d) => `<button type="button" class="bd-card ${st.f === d.id ? "on" : ""}" data-f="${d.id}">${img(d)}<span><b>${R.esc(d.name)}</b><small>${all.filter((x) => x.badges.includes(d.id)).length} people</small></span></button>`).join("");
      $(".bd-cards").querySelectorAll(".bd-card").forEach((c) => (c.onclick = () => { st.f = st.f === c.dataset.f ? "" : c.dataset.f; $(".l-f").value = st.f; drawCards(); drawList(); }));
    };

    /* --- list --- */
    const drawList = async () => {
      const all = await B.all();
      await loadNames(all.map((x) => x.id));
      const q = st.q.trim().toLowerCase();
      const rows = all.filter((x) => (!st.f || x.badges.includes(st.f)) && (!q || String(x.id).includes(q) || [names[x.id]?.name, names[x.id]?.displayName].join(" ").toLowerCase().includes(q)));
      $(".l-count").textContent = `${rows.length} of ${all.length}`;
      $(".l-list").innerHTML = rows.length ? rows.map((x) => `<div class="bd-row" data-id="${x.id}">
          <a class="rg-av" href="https://www.roblox.com/users/${x.id}/profile"><img data-thumb="user:${x.id}" alt=""></a>
          <a class="rg-fname" href="https://www.roblox.com/users/${x.id}/profile"><b>${R.esc(names[x.id]?.displayName || "User " + x.id)}${names[x.id]?.verified ? B.row([], { verified: true, size: 15 }) : ""}</b><small>@${R.esc(names[x.id]?.name || x.id)}</small></a>
          ${R.copy(x.id, "ID")}
          <span class="bd-toggles">${DEFS.map((d) => `<button type="button" class="bd-t ${x.badges.includes(d.id) ? "on" : ""}" data-t="${d.id}" data-bd="${d.id}">${img(d)}</button>`).join("")}</span>
          <button class="btn-control-sm bd-rm">Remove all</button></div>`).join("")
        : `<div class="rg-empty">${all.length ? "Nobody matches." : "Nobody has a badge yet. Give one above."}</div>`;
      R.fillThumbs($(".l-list"));
    };
    $(".l-list").onclick = async (e) => {
      const row = e.target.closest(".bd-row");
      if (!row) return;
      const uid = Number(row.dataset.id);
      const t = e.target.closest(".bd-t"), rm = e.target.closest(".bd-rm");
      if (!t && !rm) return;
      try {
        if (rm) {
          if (!(await R.confirm("Remove all badges?", `${R.esc(names[uid]?.displayName || uid)} will lose every badge.`, "Remove", true))) return;
          await B.remove(uid);
        } else {
          const cur = grantsFor(uid), id = t.dataset.t;
          await B.set(uid, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
        }
        hideTip(); drawCards(); drawList();
      } catch (err) { R.toast(err.message); }
    };
    $(".l-q").oninput = (e) => { st.q = e.target.value; drawList(); };
    $(".l-f").onchange = (e) => { st.f = e.target.value; drawCards(); drawList(); };

    /* --- give / take --- */
    const parseIds = (text) => [...new Set((text.match(/\d+/g) || []).filter((x) => x.length <= 13).map(String))].slice(0, 200);
    let prevTimer;
    const preview = async () => {
      const ids = parseIds($(".g-ids").value);
      const box = $(".g-prev");
      if (!ids.length) { box.innerHTML = ""; return; }
      try {
        const u = await R.users(ids.slice(0, 60));
        box.innerHTML = `<div class="bd-prev">${ids.slice(0, 60).map((id) => u[id]
          ? `<span class="bd-pchip"><img data-thumb="user:${id}" alt=""><b>${R.esc(u[id].displayName)}</b><small>@${R.esc(u[id].name)}</small>${B.row(grantsFor(id), { verified: !!u[id].hasVerifiedBadge, size: 18 })}</span>`
          : `<span class="bd-pchip bad">ID ${R.esc(id)} not found</span>`).join("")}</div>`;
        for (const id in u) names[id] = { name: u[id].name, displayName: u[id].displayName, verified: !!u[id].hasVerifiedBadge };
        R.fillThumbs(box);
      } catch (err) { box.innerHTML = R.errBox(err); }
    };
    $(".g-ids").oninput = () => { clearTimeout(prevTimer); prevTimer = setTimeout(preview, 450); };
    main.querySelectorAll(".bd-picks .bd-pick").forEach((b) => (b.onclick = () => { picked.has(b.dataset.id) ? picked.delete(b.dataset.id) : picked.add(b.dataset.id); b.classList.toggle("on", picked.has(b.dataset.id)); }));
    const run = async (give) => {
      const ids = parseIds($(".g-ids").value), msg = $(".g-msg");
      if (!ids.length) { msg.textContent = "Enter at least one user ID."; return; }
      if (!picked.size) { msg.textContent = "Pick at least one badge."; return; }
      msg.textContent = "Working…";
      try {
        const u = await R.users(ids);
        const real = ids.filter((id) => u[id]), missing = ids.length - real.length;
        for (const id of real) {
          const cur = grantsFor(id);
          await B.set(id, give ? [...cur, ...picked] : cur.filter((x) => !picked.has(x)));
        }
        msg.textContent = `${give ? "Gave" : "Took away"} ${picked.size} badge${picked.size === 1 ? "" : "s"} ${give ? "to" : "from"} ${real.length} ${real.length === 1 ? "person" : "people"}${missing ? ` (${missing} ID${missing === 1 ? "" : "s"} not found, skipped)` : ""}.`;
        R.toast(give ? "Badges given" : "Badges taken away");
        drawCards(); drawList(); preview();
      } catch (err) { msg.textContent = err.message; }
    };
    $(".g-give").onclick = () => run(true);
    $(".g-take").onclick = () => run(false);

    /* --- go live --- */
    const glDraw = async () => {
      const g = await B.gist(), pub = await B.pubState();
      $(".gl-off").hidden = !!g; $(".gl-on").hidden = !g;
      $(".gl-pill").textContent = g ? (pub && !pub.ok ? "· problem" : "· connected") : "· not connected";
      if (g) {
        $(".gl-raw").value = g.rawUrl || B.feedUrl();
        $(".gl-msg").textContent = pub ? (pub.ok ? `Last published ${R.ago(pub.at)}.` : `Last publish failed: ${pub.reason}`) : "";
      }
    };
    $(".gl-connect").onclick = async () => {
      const btn = $(".gl-connect"); btn.disabled = true; btn.textContent = "Connecting…";
      try {
        const r = await B.connect({ token: $(".gl-token").value, id: $(".gl-id").value });
        $(".gl-token").value = "";
        R.toast("Connected. Badges now go live automatically.");
        $(".s-url").value = B.feedUrl();
      } catch (err) { R.toast(err.message); }
      btn.disabled = false; btn.textContent = "Create Gist & connect";
      glDraw();
    };
    $(".gl-copyraw").onclick = async () => { await navigator.clipboard.writeText($(".gl-raw").value); R.toast("Copied. Paste it as FEED_URL in src/badges.js"); };
    $(".gl-now").onclick = async () => {
      $(".gl-msg").textContent = "Publishing…";
      const r = await B.publish();
      R.toast(r.ok ? "Published to everyone" : (r.reason || "Couldn't publish"));
      glDraw();
    };
    $(".gl-off-btn").onclick = async () => {
      if (!(await R.confirm("Disconnect?", "RoGen will stop pushing changes. Your token is removed from this browser. The Gist and what people already see stay as they are.", "Disconnect", true))) return;
      await B.disconnect(); glDraw();
    };
    chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && (ch.badgePub || ch.badgeGist) && document.contains(main)) glDraw(); });
    glDraw();

    /* --- share --- */
    $(".s-url").value = B.feedUrl();
    const state = async () => {
      const f = await R.get1("badgeFeed", null);
      $(".s-state").textContent = f ? `Last loaded from the link ${R.ago(f.at)} · ${Object.keys(f.grants).length} people on that list.` : "Not loaded from a link yet.";
    };
    state();
    const grab = async () => JSON.stringify(await B.exportObj(), null, 1);
    $(".s-dl").onclick = async () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([await grab()], { type: "application/json" }));
      a.download = "badges.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    $(".s-copy").onclick = async () => { await navigator.clipboard.writeText(await grab()); R.toast("Copied badges.json"); };
    $(".s-file").onchange = async (e) => {
      try {
        const obj = JSON.parse(await e.target.files[0].text());
        const replace = await R.confirm("Import badges", "Replace your current list with this file? Choose Cancel to add them to your current list instead.", "Replace");
        const n = await B.importObj(obj, { replace });
        R.toast(`Imported ${n} ${n === 1 ? "person" : "people"}`);
        drawCards(); drawList();
      } catch (err) { R.toast("Couldn't import: " + err.message); }
      e.target.value = "";
    };
    $(".s-save").onclick = async () => { await B.setFeedUrl($(".s-url").value); R.toast("Link saved"); };
    $(".s-load").onclick = async () => {
      await B.setFeedUrl($(".s-url").value);
      $(".s-state").textContent = "Loading…";
      const r = await R.send({ type: "fetchBadgeFeed", url: B.feedUrl() });
      if (!r.ok) { $(".s-state").textContent = r.reason || "Couldn't load that link."; return; }
      const f = await R.get1("badgeFeed", null);
      if (f && await R.confirm("Load list from link", `Replace the badges on this browser with the ${Object.keys(f.grants).length} people on that list?`, "Replace")) {
        await B.importObj({ grants: f.grants }, { replace: true });
        drawCards(); drawList();
      }
      state();
    };

    drawCards();
    drawList();
  };

  // The owner doesn't download the list, everyone else keeps theirs fresh (the background page also polls every minute)
  ready.then(() => {
    if (isOwner()) { restored = restoreOwner().catch(() => {}); return; }
    const u = B.feedUrl();
    if (u && feedUrl !== u) R.set({ badgeFeedUrl: u });
    if (u) B.refreshFeed().catch(() => {});
    announce();
  });
})();
