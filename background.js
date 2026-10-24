// RoGen background: unadd tracker, playtime tracker, game + item alerts, notifications
const get = (k) => chrome.storage.local.get(k);
const set = (o) => chrome.storage.local.set(o);
let csrf = "";

async function api(url, opts = {}) {
  const o = { credentials: "include", ...opts, headers: { ...(opts.headers || {}) } };
  if (o.body && typeof o.body !== "string") { o.body = JSON.stringify(o.body); o.headers["Content-Type"] = "application/json"; }
  if (o.method && o.method !== "GET") o.headers["x-csrf-token"] = csrf;
  let res = await fetch(url, o);
  if (res.status === 403 && res.headers.get("x-csrf-token")) {
    csrf = res.headers.get("x-csrf-token");
    o.headers["x-csrf-token"] = csrf;
    res = await fetch(url, o);
  }
  if (!res.ok) throw new Error(`${res.status} on ${url}`);
  const t = await res.text();
  return t ? JSON.parse(t) : {};
}
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/* ---------------- notifications ---------------- */
async function notify(title, msg, url) {
  const { status } = await get("status");
  const dnd = status && status.on !== false && status.state === "dnd";
  const id = "rg-" + Date.now() + Math.random().toString(36).slice(2, 6);
  if (!dnd) try {
    await chrome.notifications.create(id, { type: "basic", iconUrl: "icons/icon128.png", title, message: msg, priority: 1 });
  } catch (e) { console.warn("notify failed", e); }
  const { notifUrls = {}, alertLog = [] } = await get(["notifUrls", "alertLog"]);
  if (url) notifUrls[id] = url;
  alertLog.unshift({ t: Date.now(), title, msg, url });
  await set({ notifUrls, alertLog: alertLog.slice(0, 200) });
}
chrome.notifications.onClicked.addListener(async (id) => {
  const { notifUrls = {} } = await get("notifUrls");
  if (notifUrls[id]) chrome.tabs.create({ url: notifUrls[id] });
  chrome.notifications.clear(id);
});

/* ---------------- unadd tracker ---------------- */
async function fetchFriendIds(userId) {
  const ids = new Set();
  let cursor = "";
  for (let page = 0; page < 40; page++) {
    let d;
    try {
      d = await api(`https://friends.roblox.com/v1/users/${userId}/friends/find?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    } catch (e) {
      if (page === 0) {
        const old = await api(`https://friends.roblox.com/v1/users/${userId}/friends`);
        (old.data || []).forEach((f) => ids.add(f.id));
        return [...ids];
      }
      throw e;
    }
    (d.PageItems || d.data || []).forEach((f) => f.id !== Number(userId) && ids.add(f.id));
    cursor = d.NextCursor || d.nextPageCursor || "";
    if (!cursor) break;
  }
  return [...ids];
}
async function userNames(ids) {
  const out = {};
  for (const c of chunks(ids, 100)) {
    try {
      const d = await api("https://users.roblox.com/v1/users", { method: "POST", body: { userIds: c, excludeBannedUsers: false } });
      (d.data || []).forEach((u) => (out[u.id] = { name: u.name, displayName: u.displayName }));
    } catch (e) { /* names are best-effort */ }
  }
  return out;
}
async function checkFriends({ force = false } = {}) {
  const s = await get(["myId", "friendSnap", "unadded", "lastFriendCheck", "friendCheckLock", "iUnfriended", "friendSince"]);
  if (!s.myId) return { ok: false, reason: "Open roblox.com while logged in so RoGen knows your account." };
  const now = Date.now();
  if (!force && s.lastFriendCheck && now - s.lastFriendCheck < 10 * 60e3) return { ok: true, skipped: true };
  if (s.friendCheckLock && now - s.friendCheckLock < 60e3) return { ok: true, skipped: true };

  const current = await fetchFriendIds(s.myId);
  if (!current.length && s.friendSnap && s.friendSnap.ids.length > 3) return { ok: false, reason: "Roblox returned no friends, skipped." };
  const snap = s.friendSnap && s.friendSnap.owner === s.myId ? s.friendSnap : null;
  let unadded = Array.isArray(s.unadded) ? s.unadded : [];
  if (!snap) {
    await set({ friendSnap: { owner: s.myId, ids: current, names: await userNames(current), since: now }, lastFriendCheck: now });
    return { ok: true, baseline: true, count: current.length };
  }
  const cur = new Set(current), prev = new Set(snap.ids);
  const removed = snap.ids.filter((id) => !cur.has(id));
  const added = current.filter((id) => !prev.has(id));
  const names = { ...snap.names, ...(added.length ? await userNames(added) : {}) };
  for (const id of removed) {
    const n = names[id] || {};
    unadded.unshift({ id, name: n.name || `User ${id}`, displayName: n.displayName || n.name || `User ${id}`, at: now, seen: false, byMe: (s.iUnfriended || []).map(Number).includes(id) });
  }
  unadded = unadded.filter((u) => !cur.has(u.id) && u.id !== Number(s.myId)).slice(0, 500);
  removed.forEach((id) => delete names[id]);
  const friendSince = { ...(s.friendSince || {}) };
  added.forEach((id) => { if (!friendSince[id]) friendSince[id] = now; });
  removed.forEach((id) => delete friendSince[id]);
  await set({ friendSince, friendSnap: { owner: s.myId, ids: current, names, since: snap.since }, unadded, lastFriendCheck: now });
  const notMine = removed.filter((id) => !(s.iUnfriended || []).map(Number).includes(id));
  if (notMine.length) {
    const who = notMine.map((id) => (unadded.find((u) => u.id === id) || {}).displayName).filter(Boolean);
    notify(notMine.length === 1 ? `${who[0] || "Someone"} unadded you` : `${notMine.length} people unadded you`, notMine.length > 1 ? who.slice(0, 5).join(", ") : "Open RoGen to see who.", "https://www.roblox.com/rogen#friends");
  }
  await updateBadge();
  return { ok: true, removed: removed.length, added: added.length, count: current.length };
}
async function updateBadge() {
  const { unadded = [] } = await get("unadded");
  const n = unadded.filter((u) => !u.seen && !u.byMe).length;
  await chrome.action.setBadgeBackgroundColor({ color: "#e5484d" });
  await chrome.action.setBadgeText({ text: n ? String(n) : "" });
}

/* ---------------- playtime (checks if you're in a game) ---------------- */
// Works out who you are on its own (no need to have visited roblox.com first)
async function myIdNow() {
  const s = await get("myId");
  if (s.myId) return s.myId;
  try {
    const u = await api("https://users.roblox.com/v1/users/authenticated");
    if (u && u.id) { await set({ myId: u.id, myName: u.name, myDisplayName: u.displayName }); return u.id; }
  } catch (e) { /* not signed in */ }
  return null;
}
// Roblox sometimes gives a place but no universe in presence; look the universe up
const uniCache = {};
async function universeOf(placeId) {
  if (!placeId) return null;
  if (uniCache[placeId]) return uniCache[placeId];
  try {
    const d = await api(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
    if (d && d.universeId) return (uniCache[placeId] = d.universeId);
  } catch (e) { /* ignore */ }
  return null;
}
async function trackPlaytime() {
  const now = Date.now();
  const id = await myIdNow();
  if (!id) { await set({ playStatus: { t: now, kind: "signedout" } }); return; }
  const s = await get(["playState", "playtime", "playSessions"]);
  let state = s.playState || null;
  const playtime = s.playtime || {};
  let sessions = s.playSessions || [];
  let p = null;
  try {
    const d = await api("https://presence.roblox.com/v1/presence/users", { method: "POST", body: { userIds: [id] } });
    p = (d.userPresences || [])[0] || null;
  } catch (e) { await set({ playStatus: { t: now, kind: "error", msg: String(e.message || e).slice(0, 80) } }); return; }
  const type = p ? p.userPresenceType : 0;
  const close = () => {
    if (state && state.uid) sessions.unshift({ uid: state.uid, name: state.name, start: state.start, end: state.last });
    state = null;
  };
  const status = { t: now, kind: type === 2 ? "ingame" : type === 1 ? "online" : type === 3 ? "studio" : "offline" };
  if (type === 2) {
    const placeId = p.rootPlaceId || p.placeId || null;
    const name = p.lastLocation || null;
    let uid = p.universeId || (await universeOf(placeId));
    status.hidden = !uid && !placeId;
    uid = String(uid || "n:" + (name || "unknown"));
    status.game = name; status.uid = uid;
    const base = (e) => ({ ...e, first: e.first || now, name: name || e.name, placeId: placeId || e.placeId, last: now });
    if (state && String(state.uid) === uid && now - state.last < 6 * 60e3) {
      const e = playtime[uid] || { ms: 0 };
      playtime[uid] = { ...base(e), ms: (e.ms || 0) + (now - state.last) };
      state.last = now;
    } else {
      close();
      state = { uid, name, start: now, last: now };
      playtime[uid] = { ms: 0, ...base(playtime[uid] || {}) };
    }
  } else close();
  sessions = sessions.filter((x) => x.end - x.start > 30e3).slice(0, 300);
  await set({ playState: state, playtime, playSessions: sessions, playStatus: status });
  // Friends: every other check (about once a minute)
  if (friendTurn++ % 2 === 0) await trackFriendsPlay(id).catch((e) => console.warn("friends playtime", e));
}

/* ---------------- friends' playtime ----------------
   Every minute (while Chrome is open) RoGen checks which of your friends are in a game and adds the time
   to that friend + that game. Roblox only shows the game if the friend's "Who can see me join" allows you;
   otherwise it's counted under "Hidden game". */
let friendTurn = 0;
async function trackFriendsPlay(myId) {
  const now = Date.now();
  const s = await get(["friendSnap", "friendPlay", "friendPlayState", "friendPlayIds"]);
  let ids = s.friendSnap && s.friendSnap.owner === myId ? s.friendSnap.ids : null;
  if (!ids) {
    const c = s.friendPlayIds;
    if (c && c.owner === myId && now - c.t < 30 * 60e3) ids = c.ids;
    else { ids = await fetchFriendIds(myId).catch(() => []); await set({ friendPlayIds: { owner: myId, ids, t: now } }); }
  }
  if (!ids || !ids.length) return;
  const play = s.friendPlay && s.friendPlay.owner === myId ? s.friendPlay : { owner: myId, since: now, users: {} };
  const state = s.friendPlayState || {};
  const pres = {};
  for (const c of chunks(ids, 50)) {
    try {
      const d = await api("https://presence.roblox.com/v1/presence/users", { method: "POST", body: { userIds: c } });
      (d.userPresences || []).forEach((p) => (pres[p.userId] = p));
    } catch (e) { return; }   // don't count a gap as playtime if Roblox hiccups
  }
  const close = (fid) => {
    const st = state[fid];
    if (st && play.users[fid] && st.last - st.start > 30e3) {
      const u = play.users[fid];
      u.sessions = [{ g: st.g, name: st.name, start: st.start, end: st.last }, ...(u.sessions || [])].slice(0, 40);
    }
    delete state[fid];
  };
  let inGame = 0;
  for (const fid of ids) {
    const p = pres[fid];
    if (p && p.userPresenceType === 2) {
      inGame++;
      const placeId = p.rootPlaceId || p.placeId || null;
      const uni = p.universeId || (placeId ? await universeOf(placeId) : null);
      const g = uni ? String(uni) : placeId ? "p:" + placeId : "hidden";
      const name = p.lastLocation || (g === "hidden" ? "Hidden game" : null);
      const u = (play.users[fid] = play.users[fid] || { ms: 0, first: now, games: {} });
      const gm = (u.games[g] = u.games[g] || { ms: 0, first: now });
      if (name) gm.name = name;
      if (placeId) gm.placeId = placeId;
      gm.last = now; u.last = now; u.lastGame = g;
      const st = state[fid];
      if (st && st.g === g && now - st.last < 4 * 60e3) {
        const add = now - st.last;
        u.ms += add; gm.ms += add; st.last = now;
      } else { close(fid); state[fid] = { g, name: gm.name, start: now, last: now }; }
    } else close(fid);
  }
  play.checked = now;
  await set({ friendPlay: play, friendPlayState: state, friendPlayStatus: { t: now, friends: ids.length, inGame } });
}

/* ---------------- history helper (same format as the page uses) ---------------- */
async function snap(key, obj, { every = 3 * 3600e3, textOnly = false, max = 400 } = {}) {
  const k = "hist:" + key;
  const list = (await get(k))[k] || [];
  const last = list[list.length - 1];
  const now = Date.now();
  const differs = !last || Object.keys(obj).some((f) => JSON.stringify(obj[f]) !== JSON.stringify(last[f]));
  const textChanged = !last || Object.keys(obj).some((f) => typeof obj[f] === "string" && obj[f] !== last[f]);
  if (textOnly ? differs : textChanged || now - last.t >= every) {
    list.push({ t: now, ...obj });
    while (list.length > max) list.shift();
  } else if (differs && !textOnly) Object.assign(last, obj);
  else return;
  await set({ [k]: list });
}

/* ---------------- game + item alerts ---------------- */
async function checkWatch() {
  const { watchGames = {}, watchItems = {} } = await get(["watchGames", "watchItems"]);
  const gameIds = Object.keys(watchGames).map(Number);
  if (gameIds.length) {
    const found = {};
    for (const c of chunks(gameIds, 50)) {
      try { (await api(`https://games.roblox.com/v1/games?universeIds=${c.join(",")}`)).data.forEach((g) => (found[g.id] = g)); } catch (e) { return; }
    }
    for (const uid of gameIds) {
      const w = watchGames[uid];
      const g = found[uid];
      const url = `https://www.roblox.com/games/${w.placeId}`;
      if (!g) {
        if (!w.deleted) { w.deleted = true; notify(`${w.name} is gone`, "This game was deleted or made private.", url); }
        continue;
      }
      if (w.deleted) { w.deleted = false; notify(`${g.name} is back`, "This game is available again.", url); }
      await snap(`game:${uid}`, { visits: g.visits, playing: g.playing, favorites: g.favoritedCount });
      await snap(`gameText:${uid}`, { name: g.name, description: g.description || "", updated: g.updated }, { textOnly: true, max: 200 });
      if (w.updates && w.lastUpdated && g.updated !== w.lastUpdated && new Date(g.updated) > new Date(w.lastUpdated)) notify(`${g.name} just updated`, "Jump in and see what's new.", url);
      w.lastUpdated = g.updated;
      if (w.playerAlert) {
        if (g.playing >= w.playerAlert && !w.highAlerted) { w.highAlerted = true; notify(`${g.name}: ${g.playing.toLocaleString()} playing`, `Players went above ${w.playerAlert.toLocaleString()}.`, url); }
        if (g.playing < w.playerAlert * 0.9) w.highAlerted = false;
      }
      w.name = g.name;
    }
    await set({ watchGames });
  }

  const itemIds = Object.keys(watchItems).map(Number);
  if (itemIds.length) {
    const found = {};
    for (const c of chunks(itemIds, 100)) {
      try {
        const d = await api("https://catalog.roblox.com/v1/catalog/items/details", { method: "POST", body: { items: c.map((id) => ({ itemType: "Asset", id })) } });
        (d.data || []).forEach((i) => (found[i.id] = i));
      } catch (e) { return; }
    }
    for (const id of itemIds) {
      const w = watchItems[id];
      const i = found[id];
      const url = `https://www.roblox.com/catalog/${id}`;
      if (!i) {
        if (w.gone && !w.goneAlerted) { w.goneAlerted = true; notify(`${w.name} was removed`, "This item is no longer in the catalog.", url); }
        continue;
      }
      const price = i.lowestPrice ?? i.lowestResalePrice ?? i.price ?? null;
      const forSale = !(i.isOffSale) || price != null;
      await snap(`item:${id}`, { price: i.price ?? null, lowest: i.lowestPrice ?? null, forSale }, { every: 6 * 3600e3 });
      if (w.target && price != null && price <= w.target && w.lastAlertPrice !== price) {
        w.lastAlertPrice = price;
        notify(`Deal: ${i.name}`, `Now R$${price.toLocaleString()} (your alert: R$${w.target.toLocaleString()} or less)`, url);
      }
      if (price != null && w.target && price > w.target) w.lastAlertPrice = null;
      if (w.gone && w.lastForSale && !forSale) notify(`${i.name} went offsale`, "You asked RoGen to tell you if this happened.", url);
      w.lastForSale = forSale;
      w.name = i.name;
    }
    await set({ watchItems });
  }
}

/* ---------------- wiring ---------------- */
chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  (async () => {
    try {
      if (msg.type === "checkFriends") return reply(await checkFriends({ force: !!msg.force }));
      if (msg.type === "markUnaddedSeen") {
        const { unadded = [] } = await get("unadded");
        unadded.forEach((u) => (u.seen = true));
        await set({ unadded });
        await updateBadge();
        return reply({ ok: true });
      }
      if (msg.type === "friendsPlayNow") { const id = await myIdNow(); if (id) await trackFriendsPlay(id); return reply({ ok: true }); }
      if (msg.type === "presenceNow") { await trackPlaytime(); const { playStatus } = await get("playStatus"); return reply({ ok: true, status: playStatus }); }
      if (msg.type === "fetchBadgeFeed") return reply(await fetchBadgeFeed(String(msg.url || "")));
      if (msg.type === "readBadgesFile") return reply(await readBadgesFile());
      if (msg.type === "publishBadges") return reply(await publishBadges(msg));
      if (msg.type === "createBadgeGist") return reply(await createBadgeGist(msg));
      if (msg.type === "badge") { await updateBadge(); return reply({ ok: true }); }
      if (msg.type === "testNotify") { await notify("RoGen alerts are working", "You'll get notifications like this one.", "https://www.roblox.com/rogen#alerts"); return reply({ ok: true }); }
      if (msg.type === "openRogen") {
        const url = "https://www.roblox.com/rogen#" + (msg.view || "dashboard");
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        // Already on Roblox? Open RoGen right there instead of a new tab
        if (tab && /^https:\/\/www\.roblox\.com\//.test(tab.url || "")) await chrome.tabs.update(tab.id, { url });
        else await chrome.tabs.create({ url });
        return reply({ ok: true });
      }
      reply({ ok: false, reason: "unknown message" });
    } catch (e) { reply({ ok: false, reason: String(e.message || e) }); }
  })();
  return true;
});

/* ---------------- RoGen badges: read the published list, and (owner only) publish it ---------------- */
const BADGE_OWNER_ID = 10980633414;
const BADGE_FILE = "badges.json";
async function fetchBadgeFeed(url) {
  if (!/^https:\/\/(raw\.githubusercontent\.com|gist\.githubusercontent\.com|[a-z0-9-]+\.github\.io)\//i.test(url)) return { ok: false, reason: "Use a raw GitHub link (raw.githubusercontent.com, gist.githubusercontent.com or a github.io page)." };
  // cache-buster so a change shows up within a minute instead of GitHub's ~5 minute cache
  const res = await fetch(url + (url.includes("?") ? "&" : "?") + "rg=" + Date.now(), { cache: "no-store" });
  if (!res.ok) return { ok: false, reason: `The list link returned ${res.status}.` };
  let j;
  try { j = JSON.parse(await res.text()); } catch (e) { return { ok: false, reason: "That link isn't a valid badges.json." }; }
  const src = j && typeof j === "object" ? (j.grants && typeof j.grants === "object" ? j.grants : j) : {};
  const grants = {};
  for (const k of Object.keys(src).slice(0, 5000)) if (/^\d{1,13}$/.test(k) && Array.isArray(src[k])) grants[k] = src[k].filter((x) => typeof x === "string").slice(0, 8);
  // Only write when something changed, so open tabs don't redraw every minute
  const { badgeFeed } = await get("badgeFeed");
  const same = badgeFeed && badgeFeed.url === url && JSON.stringify(badgeFeed.grants) === JSON.stringify(grants);
  if (!same) await set({ badgeFeed: { at: Date.now(), url, grants } });
  return { ok: true, count: Object.keys(grants).length, changed: !same };
}
const ghHeaders = (token) => ({ Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" });
const ghFail = async (res) => {
  if (res.status === 401) return "GitHub says that token isn't valid.";
  if (res.status === 403 || res.status === 404) return "GitHub refused. Make sure the token has the \"gist\" permission and the Gist ID is yours.";
  return `GitHub returned ${res.status}.`;
};
async function createBadgeGist({ token, content }) {
  const res = await fetch("https://api.github.com/gists", { method: "POST", headers: ghHeaders(token), body: JSON.stringify({ description: "RoGen badges", public: false, files: { [BADGE_FILE]: { content } } }) });
  if (!res.ok) return { ok: false, reason: await ghFail(res) };
  const g = await res.json();
  return { ok: true, id: g.id, rawUrl: `https://gist.githubusercontent.com/${g.owner.login}/${g.id}/raw/${BADGE_FILE}` };
}
async function publishBadges({ id, token, content }) {
  if (!/^[a-f0-9]{8,64}$/i.test(String(id || ""))) return { ok: false, reason: "That Gist ID doesn't look right." };
  const res = await fetch(`https://api.github.com/gists/${id}`, { method: "PATCH", headers: ghHeaders(token), body: JSON.stringify({ files: { [BADGE_FILE]: { content } } }) });
  if (!res.ok) return { ok: false, reason: await ghFail(res) };
  const g = await res.json();
  return { ok: true, rawUrl: `https://gist.githubusercontent.com/${g.owner.login}/${id}/raw/${BADGE_FILE}` };
}
// Reads Badges.txt (in the RoGen folder): [Badge name] headings with one user ID per line under each
async function readBadgesFile() {
  let text = "";
  try { const res = await fetch(chrome.runtime.getURL("Badges.txt"), { cache: "no-store" }); if (res.ok) text = await res.text(); } catch (e) { return { ok: false, sections: [] }; }
  const sections = []; let cur = null;
  for (let line of text.split(/\r?\n/)) {
    line = line.replace(/(^|\s)(#|\/\/).*$/, "").trim();
    const h = line.match(/^\[(.+?)\]\s*$/);
    if (h) { cur = { name: h[1], ids: [] }; sections.push(cur); continue; }
    const m = cur && line.match(/^(\d{1,13})(?!\d)/);
    if (m) cur.ids.push(m[1]);
  }
  return { ok: true, sections };
}
async function pollBadgeFeed() {
  const { badgeFeedUrl, myId } = await get(["badgeFeedUrl", "myId"]);
  if (!badgeFeedUrl || myId === BADGE_OWNER_ID) return;   // the owner's own list is the source of truth
  await fetchBadgeFeed(badgeFeedUrl);
}

function setupAlarms() {
  chrome.alarms.create("friends", { periodInMinutes: 30 });
  chrome.alarms.create("watch", { periodInMinutes: 5 });
  chrome.alarms.create("presence", { periodInMinutes: 0.5 });
  chrome.alarms.create("badgefeed", { periodInMinutes: 1 });
  chrome.alarms.create("rgtrack", { periodInMinutes: 30, delayInMinutes: 1 });
  updateBadge();
  trackPlaytime().catch(() => {});
}
chrome.runtime.onInstalled.addListener(setupAlarms);
chrome.runtime.onStartup.addListener(setupAlarms);
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "badgefeed") pollBadgeFeed().catch(() => {});
  if (a.name === "friends") checkFriends().catch((e) => console.warn(e));
  if (a.name === "watch") checkWatch().catch((e) => console.warn(e));
  if (a.name === "presence") trackPlaytime().catch((e) => console.warn(e));
  if (a.name === "rgtrack") runTracker().catch((e) => console.warn("RoGen tracker", e));
});
chrome.alarms.get("rgtrack").then((a) => { if (!a) chrome.alarms.create("rgtrack", { periodInMinutes: 30, delayInMinutes: 1 }); });

// If Chrome dropped the timer, put it back (so playtime keeps counting)
chrome.alarms.get("presence").then((a) => { if (!a) setupAlarms(); });


/* ---------------- RoGen Tracker: public changes to profiles, communities, games and items you track ----------------
   Runs every 30 minutes while Chrome is open. Everything it notices goes on the Timeline (RoGen → Tracker),
   and the important ones (owner changed, new badge, big value swings, name changes) also send a notification. */
const MILESTONES = [1e3, 1e4, 5e4, 1e5, 2.5e5, 5e5, 1e6, 2.5e6, 5e6, 1e7, 2.5e7, 5e7, 1e8, 2.5e8, 5e8, 1e9, 2.5e9, 5e9];
const crossed = (a, b) => MILESTONES.filter((m) => a < m && b >= m).pop();
const short = (n) => n >= 1e9 ? (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, "") + "B" : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M" : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K" : String(n);
let trackerBusy = false;
async function runTracker(force = false) {
  if (trackerBusy) return;
  trackerBusy = true;
  try {
    const { trk = {}, trkState = {}, timeline = [], myId, rgAlertPrefs = {}, friendSnap } = await get(["trk", "trkState", "timeline", "myId", "rgAlertPrefs", "friendSnap"]);
    const prefs = { badges: true, invValue: true, invPct: 5, friendNames: true, ...rgAlertPrefs };
    const now = Date.now(), ev = [];
    const add = (e) => ev.push({ t: now, ...e });

    // Profiles
    for (const id of Object.keys(trk.users || {}).slice(0, 40)) {
      try {
        const [u, fo, fr] = await Promise.all([
          api(`https://users.roblox.com/v1/users/${id}`),
          api(`https://friends.roblox.com/v1/users/${id}/followers/count`).catch(() => ({})),
          api(`https://friends.roblox.com/v1/users/${id}/friends/count`).catch(() => ({}))
        ]);
        const k = "u:" + id, old = trkState[k], cur = { name: u.name, dn: u.displayName, bio: u.description || "", banned: !!u.isBanned, fo: fo.count ?? null, fr: fr.count ?? null };
        const url = `https://www.roblox.com/users/${id}/profile`, who = u.displayName || u.name;
        if (old) {
          if (old.name !== cur.name) add({ kind: "user", id: +id, name: who, text: `changed username from @${old.name} to @${cur.name}`, url, important: true });
          if (old.dn !== cur.dn) add({ kind: "user", id: +id, name: who, text: `changed display name from "${old.dn}" to "${cur.dn}"`, url, important: true });
          if (old.bio !== cur.bio) add({ kind: "user", id: +id, name: who, text: "changed their bio", url, detail: cur.bio.slice(0, 200) });
          if (old.banned !== cur.banned) add({ kind: "user", id: +id, name: who, text: cur.banned ? "was banned" : "was unbanned", url, important: true });
          if (old.fo != null && cur.fo != null) { const m = crossed(old.fo, cur.fo); if (m) add({ kind: "user", id: +id, name: who, text: `passed ${short(m)} followers`, url }); }
        }
        trkState[k] = cur;
      } catch (e) { /* skip this one */ }
    }

    // Communities
    for (const id of Object.keys(trk.groups || {}).slice(0, 40)) {
      try {
        const g = await api(`https://groups.roblox.com/v1/groups/${id}`);
        const k = "g:" + id, old = trkState[k], cur = { name: g.name, owner: g.owner ? g.owner.userId : null, ownerName: g.owner ? g.owner.username : "", members: g.memberCount || 0, shout: (g.shout && g.shout.body) || "" };
        const url = `https://www.roblox.com/communities/${id}`;
        if (old) {
          if (old.owner !== cur.owner) add({ kind: "group", id: +id, name: g.name, text: cur.owner ? `has a new owner: @${cur.ownerName}` : "has no owner any more", url, important: true });
          if (old.name !== cur.name) add({ kind: "group", id: +id, name: g.name, text: `was renamed from "${old.name}"`, url, important: true });
          if (old.shout !== cur.shout && cur.shout) add({ kind: "group", id: +id, name: g.name, text: "posted a new shout", url, detail: cur.shout.slice(0, 200) });
          const m = crossed(old.members, cur.members); if (m) add({ kind: "group", id: +id, name: g.name, text: `passed ${short(m)} members`, url });
        }
        trkState[k] = cur;
      } catch (e) { /* skip */ }
    }

    // Games
    const gids = Object.keys(trk.games || {}).slice(0, 50);
    for (const c of chunks(gids, 50)) {
      try {
        const d = await api(`https://games.roblox.com/v1/games?universeIds=${c.join(",")}`);
        for (const g of d.data || []) {
          const k = "gm:" + g.id, old = trkState[k], cur = { name: g.name, updated: g.updated, visits: g.visits || 0, playing: g.playing || 0, peak: Math.max(g.playing || 0, (old && old.peak) || 0) };
          const url = `https://www.roblox.com/games/${g.rootPlaceId}`;
          if (old) {
            if (old.updated !== cur.updated) add({ kind: "game", id: g.id, name: g.name, text: "was updated", url });
            if (old.name !== cur.name) add({ kind: "game", id: g.id, name: g.name, text: `was renamed from "${old.name}"`, url, important: true });
            const m = crossed(old.visits, cur.visits); if (m) add({ kind: "game", id: g.id, name: g.name, text: `passed ${short(m)} visits`, url, important: true });
            if (old.peak && cur.playing > old.peak * 1.1 && cur.playing >= 50) add({ kind: "game", id: g.id, name: g.name, text: `hit a new player record: ${cur.playing.toLocaleString()} playing`, url });
          }
          trkState[k] = cur;
          // Events Roblox lists for the game (if any)
          try {
            const e = await api(`https://apis.roblox.com/virtual-events/v1/universes/${g.id}/virtual-events?limit=10`);
            const seen = new Set(trkState["ev:" + g.id] || []);
            for (const x of e.data || []) {
              if (!x.id || seen.has(x.id)) continue;
              if (trkState["ev:" + g.id]) add({ kind: "game", id: g.id, name: g.name, text: `announced an event: ${x.title || x.displayTitle || "Event"}`, url, when: x.eventTime && x.eventTime.startUtc });
              seen.add(x.id);
            }
            trkState["ev:" + g.id] = [...seen].slice(-50);
          } catch (e) { /* events are optional */ }
        }
      } catch (e) { /* skip */ }
    }

    // Items: RAP moves
    for (const id of Object.keys(trk.items || {}).slice(0, 40)) {
      try {
        const r = await api(`https://economy.roblox.com/v1/assets/${id}/resale-data`);
        const k = "it:" + id, old = trkState[k], rap = r.recentAveragePrice || 0, it = trk.items[id], pct = it.pct || 10;
        if (old && old.rap && rap && Math.abs(rap - old.rap) / old.rap * 100 >= pct) {
          add({ kind: "item", id: +id, name: it.name || "Item", text: `RAP ${rap > old.rap ? "rose" : "fell"} ${Math.round(Math.abs(rap - old.rap) / old.rap * 100)}% to R$${rap.toLocaleString()}`, url: `https://www.roblox.com/catalog/${id}`, important: true });
          trkState[k] = { rap };
        } else if (!old) trkState[k] = { rap };
      } catch (e) { /* skip */ }
    }

    if (myId) {
      // New badges you earned
      if (prefs.badges) try {
        const d = await api(`https://badges.roblox.com/v1/users/${myId}/badges?limit=25&sortOrder=Desc`);
        const ids = (d.data || []).map((b) => b.id), seen = trkState.myBadges;
        if (seen) for (const b of d.data || []) if (!seen.includes(b.id)) add({ kind: "badge", id: b.id, name: b.name, text: `You earned the badge "${b.name}"${b.awarder && b.awarder.name ? "" : ""}`, url: `https://www.roblox.com/badges/${b.id}`, important: true, mine: true });
        trkState.myBadges = [...new Set([...(seen || []), ...ids])].slice(-300);
      } catch (e) { /* skip */ }

      // Inventory value (every 12 hours)
      if (prefs.invValue && (force || !trkState.invT || now - trkState.invT > 12 * 3600e3)) try {
        let cursor = "", rap = 0;
        for (let i = 0; i < 20; i++) {
          const d = await api(`https://inventory.roblox.com/v1/users/${myId}/assets/collectibles?limit=100&sortOrder=Desc${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`);
          (d.data || []).forEach((x) => (rap += x.recentAveragePrice || 0));
          cursor = d.nextPageCursor; if (!cursor) break;
        }
        const old = trkState.inv;
        if (old && old.rap && Math.abs(rap - old.rap) / old.rap * 100 >= prefs.invPct)
          add({ kind: "me", id: myId, name: "Your inventory", text: `value ${rap > old.rap ? "went up" : "went down"} ${Math.round(Math.abs(rap - old.rap) / old.rap * 100)}% to R$${rap.toLocaleString()}`, url: `https://www.roblox.com/rogen#inventory`, important: true, mine: true });
        trkState.inv = { rap }; trkState.invT = now;
        const hk = "hist:rap:" + myId, h = (await get(hk))[hk] || [];
        if (!h.length || now - h[h.length - 1].t > 6 * 3600e3) { h.push({ t: now, rap }); await set({ [hk]: h.slice(-400) }); }
      } catch (e) { /* skip */ }

      // Friends' username / display name changes (every 6 hours)
      if (prefs.friendNames && friendSnap && friendSnap.owner === myId && (force || !trkState.fnT || now - trkState.fnT > 6 * 3600e3)) try {
        const prev = trkState.fn || {}, next = {};
        for (const c of chunks(friendSnap.ids || [], 100)) {
          const d = await api("https://users.roblox.com/v1/users", { method: "POST", body: { userIds: c, excludeBannedUsers: false } });
          for (const u of d.data || []) {
            next[u.id] = [u.name, u.displayName];
            const o = prev[u.id];
            if (o && o[0] !== u.name) add({ kind: "friend", id: u.id, name: u.displayName, text: `changed username from @${o[0]} to @${u.name}`, url: `https://www.roblox.com/users/${u.id}/profile`, important: true, mine: true });
            else if (o && o[1] !== u.displayName) add({ kind: "friend", id: u.id, name: u.displayName, text: `changed display name from "${o[1]}"`, url: `https://www.roblox.com/users/${u.id}/profile`, mine: true });
          }
        }
        trkState.fn = next; trkState.fnT = now;
      } catch (e) { /* skip */ }
    }

    await set({ trkState, timeline: [...ev.reverse(), ...timeline].slice(0, 600), trackerLast: now });
    const loud = ev.filter((e) => e.important);
    for (const e of loud.slice(0, 4)) await notify(e.name, e.text, e.url);
    if (loud.length > 4) await notify("RoGen Tracker", `${loud.length - 4} more changes. Open RoGen → Tracker to see them.`, "https://www.roblox.com/rogen#tracker");
  } finally { trackerBusy = false; }
}
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg && msg.type === "runTracker") { runTracker(true).then(() => reply({ ok: true })).catch((e) => reply({ ok: false, reason: String(e.message || e) })); return true; }
});
