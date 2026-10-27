// Owner tools: an announcement every RoGen user sees, an "update available" notice, switching a feature off
// for everyone, and housekeeping. It all rides along in the badge list the owner already publishes,
// so there's no server: every RoGen reads that list once a minute.
(() => {
  const R = window.Rogen;
  const RB = "https://www.roblox.com";
  const STORE = "https://chromewebstore.google.com/detail/rogen/alffelihaammoakndcdnpjnpbemmfpgg";
  const LINK_OK = /^https:\/\/((www\.)?roblox\.com|chromewebstore\.google\.com|discord\.gg|(www\.)?github\.com)\//i;
  const myVersion = () => chrome.runtime.getManifest().version;
  const newer = (a, b) => { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
  const sec = (title, inner, right = "") => `<div class="rg-section section"><div class="container-header rg-head"><h2>${title}</h2><div class="rg-head-right">${right}</div></div><div class="section-content rg-body">${inner}</div></div>`;
  const live = async () => (R.badges && R.badges.isOwner() ? await R.get1("ownerLive", null) : await R.get1("rgLive", null)) || {};
  const activeNotice = (l) => (l && l.notice && (!l.notice.until || l.notice.until > Date.now()) ? l.notice : null);

  /* ---------- what everyone sees ---------- */
  const noticeHTML = (n, dismissable = true) => `<div class="rg-notice ${n.important ? "imp" : ""}" data-id="${R.esc(n.id)}"><span class="rg-notice-ic">${R.ic('<path d="M4 10v4h3l5 4V6L7 10z"/><path d="M16 9a4 4 0 0 1 0 6"/>', 18)}</span><div class="rg-notice-t"><b>From RoGen</b><span>${R.esc(n.text)}</span></div>${n.link ? `<a class="btn-control-sm" href="${R.esc(n.link)}" target="_blank" rel="noopener">Open</a>` : ""}${dismissable ? `<button class="rg-notice-x" type="button" aria-label="Dismiss">${R.ic('<path d="M6 6l12 12M18 6L6 18"/>', 14)}</button>` : ""}</div>`;
  const updateHTML = (u) => `<div class="rg-notice upd"><span class="rg-notice-ic">${R.ic('<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>', 18)}</span><div class="rg-notice-t"><b>RoGen ${R.esc(u.version)} is out</b><span>${R.esc(u.note || `You're on ${myVersion()}. Chrome updates it on its own, or get it now.`)}</span></div><a class="btn-primary-sm" href="${R.esc(u.link || STORE)}" target="_blank" rel="noopener">Get it</a></div>`;

  // Top of every RoGen page: the update notice and the announcement (until you dismiss it)
  const prevAfter = R.afterView;
  R.afterView = async (v, main) => {
    try { prevAfter && (await prevAfter(v, main)); } catch (e) { /* keep going */ }
    const l = await live(), seen = await R.get1("noticeSeen", "");
    const box = R.h(`<div class="rg-notices"></div>`);
    if (l.latest && newer(l.latest.version, myVersion())) box.insertAdjacentHTML("beforeend", updateHTML(l.latest));
    const n = activeNotice(l);
    if (n && seen !== n.id) box.insertAdjacentHTML("beforeend", noticeHTML(n));
    if (!box.children.length || !main.isConnected) return;
    main.prepend(box);
    box.querySelectorAll(".rg-notice-x").forEach((x) => (x.onclick = () => { const el = x.closest(".rg-notice"); R.set({ noticeSeen: el.dataset.id }); el.remove(); }));
  };

  // On Roblox's own pages: a small card in the corner, once per announcement
  let shownOn = "";
  R.route(() => true, () => {
    let card = null;
    const show = async () => {
      if (location.pathname === "/rogen" || card) return;
      const l = await live(), n = activeNotice(l);
      if (!n || shownOn === n.id || (await R.get1("noticeSeen", "")) === n.id) return;
      shownOn = n.id;
      card = R.h(`<div class="rg-notice-float">${noticeHTML(n)}</div>`);
      document.body.appendChild(card);
      R.applyThemeAttr();
      card.querySelector(".rg-notice-x").onclick = () => { R.set({ noticeSeen: n.id }); card.remove(); };
    };
    show();
    return { stop: () => card && card.remove() };
  });

  /* ---------- Owner tools page ---------- */
  async function ownerView(main) {
    if (!R.badges || !R.badges.isOwner()) { main.innerHTML = `<div class="rg-empty" style="padding:80px 0">Only RoGen's owner can open this page.</div>`; return; }
    const cfg = { off: [], ...(await R.get1("ownerLive", {})) };
    const gist = await R.badges.gist(), pub = await R.badges.pubState();
    const n = cfg.notice || {}, u = cfg.latest || {};
    const people = (await R.badges.all()).length;
    const usage = await new Promise((res) => chrome.storage.local.getBytesInUse ? chrome.storage.local.getBytesInUse(null, res) : res(0));
    main.innerHTML = `<h1>Owner tools</h1><p class="rg-lead">Things only you can do. Changes go out to every RoGen within about a minute, through the badge list you publish.</p>
      <div class="rg-stats ow-stats">${R.stat("Going live", gist ? "On" : "Off", gist ? (pub ? `Last pushed ${R.ago(pub.at)}${pub.ok ? "" : " · failed"}` : "") : "Connect a Gist in Badge manager")}${R.stat("People with badges", R.fmt(people))}${R.stat("Your version", myVersion())}${R.stat("Features off for everyone", R.fmt(cfg.off.length))}</div>
      ${gist ? "" : `<div class="rg-notice imp" style="margin:14px 0"><span class="rg-notice-ic">${R.ic('<circle cx="12" cy="12" r="8.5"/><path d="M12 8v5M12 16h.01"/>', 18)}</span><div class="rg-notice-t"><b>Nothing here reaches anyone yet</b><span>Connect a GitHub Gist in Badge manager first. Then announcements, the update notice and switches go out to everyone.</span></div><a class="btn-primary-sm" href="#badges">Badge manager</a></div>`}
      ${sec("Announcement", `<p class="rg-note" style="margin-top:0">Shows at the top of every RoGen page and once in the corner of Roblox. Important ones also send a notification.</p>
        <textarea class="rg-textarea ow-text" maxlength="300" placeholder="e.g. RoGen 5.0 is coming this weekend!">${R.esc(n.text || "")}</textarea>
        <div class="rg-filterbar" style="padding:12px 0 0"><label class="rg-field" style="flex:1;min-width:240px">Link (optional)<input class="rg-input ow-link" placeholder="Roblox, Chrome Web Store, Discord or GitHub link" value="${R.esc(n.link || "")}"></label>
          <label class="rg-field">Show for<select class="rg-select ow-until"><option value="0">Until I remove it</option><option value="1">1 day</option><option value="3">3 days</option><option value="7">1 week</option></select></label>
          <label class="rg-check"><input type="checkbox" class="ow-imp" ${n.important ? "checked" : ""}> Important (send a notification)</label></div>
        <div class="rg-h3">Preview</div><div class="ow-prev"></div>
        <div class="rg-row" style="margin-top:12px;justify-content:flex-end"><button class="btn-control-md ow-nclear" ${n.text ? "" : "disabled"}>Remove announcement</button><button class="btn-primary-md ow-nsend">Send to everyone</button></div>`,
        n.text ? `<span class="rg-sub">Live${n.until ? ` until ${R.dateTime(n.until)}` : ""}</span>` : "")}
      ${sec("Update notice", `<p class="rg-note" style="margin-top:0">People on an older version see "RoGen X is out" with a button. Set this after the new version is live on the Chrome Web Store.</p>
        <div class="rg-filterbar" style="padding:0"><label class="rg-field">Newest version<input class="rg-input ow-ver" placeholder="${R.esc(myVersion())}" value="${R.esc(u.version || "")}" style="width:120px"></label>
          <label class="rg-field" style="flex:1;min-width:240px">What's new (optional)<input class="rg-input ow-vnote" maxlength="200" placeholder="Tracker, Wrapped and a lot more" value="${R.esc(u.note || "")}"></label>
          <button class="btn-control-md ow-vme">Use ${R.esc(myVersion())}</button><button class="btn-primary-md ow-vsave">Save</button></div>`)}
      ${sec("Switch a feature off for everyone", `<p class="rg-note" style="margin-top:0">For when a Roblox change breaks something. It turns off for every RoGen until you turn it back on, and people see it greyed out in their Settings.</p>
        <div class="ft-grid">${Object.entries(R.FEATURES.reduce((g, f) => ((g[f[0]] = g[f[0]] || []).push(f), g), {})).map(([g, l]) => `<div class="ft-col"><div class="rg-h3">${R.esc(g)}</div>${l.map(([, k, label]) => `<label class="ft-row"><span class="ft-t"><b>${R.esc(label)}</b><small>${cfg.off.includes(k) ? "Off for everyone" : "On"}</small></span><span class="ft-sw"><input type="checkbox" data-k="${k}" ${cfg.off.includes(k) ? "" : "checked"}><i></i></span></label>`).join("")}</div>`).join("")}</div>`)}
      ${sec("Housekeeping", `<div class="rg-row">
        <button class="btn-control-md ow-push">Push everything now</button>
        <button class="btn-control-md ow-trk">Run the tracker now</button>
        <button class="btn-control-md ow-cache">Clear cached rankings</button>
        <a class="btn-control-md" href="#badges">Badge manager</a></div>
        <p class="rg-note">RoGen is using ${(usage / 1048576).toFixed(1)} MB in this browser. Your published list: ${gist && gist.rawUrl ? `<a class="rg-link" href="${R.esc(gist.rawUrl)}" target="_blank" rel="noopener">open</a>` : "not connected"}.</p>`)}`;
    const $ = (q) => main.querySelector(q);
    const save = async (patch, msg) => {
      const next = { off: [], ...(await R.get1("ownerLive", {})), ...patch };
      if (!next.notice) delete next.notice;
      if (!next.latest) delete next.latest;
      await R.set({ ownerLive: next, rgLive: next });   // rgLive: so you see it on your own RoGen too
      R.badges.publishSoon();
      R.toast(gist ? `${msg}. Going out to everyone now.` : `${msg}. Connect a Gist so it reaches everyone.`);
    };
    const prev = () => {
      const text = $(".ow-text").value.trim();
      $(".ow-prev").innerHTML = text ? noticeHTML({ id: "p", text, link: LINK_OK.test($(".ow-link").value.trim()) ? $(".ow-link").value.trim() : "", important: $(".ow-imp").checked }, false) : `<div class="rg-mute">Type a message to see it here.</div>`;
    };
    ["input", "change"].forEach((ev) => main.querySelectorAll(".ow-text, .ow-link, .ow-imp").forEach((el) => el.addEventListener(ev, prev)));
    prev();
    $(".ow-nsend").onclick = async () => {
      const text = $(".ow-text").value.trim(), link = $(".ow-link").value.trim();
      if (!text) return R.toast("Write a message first");
      if (link && !LINK_OK.test(link)) return R.toast("Links can go to Roblox, the Chrome Web Store, Discord or GitHub");
      const days = Number($(".ow-until").value);
      await save({ notice: { id: String(Date.now()), text, link, important: $(".ow-imp").checked, until: days ? Date.now() + days * 864e5 : 0 } }, "Announcement sent");
      ownerView(main);
    };
    $(".ow-nclear").onclick = async () => { await save({ notice: null }, "Announcement removed"); ownerView(main); };
    $(".ow-vme").onclick = () => ($(".ow-ver").value = myVersion());
    $(".ow-vsave").onclick = async () => {
      const v = $(".ow-ver").value.trim();
      if (v && !/^\d+(\.\d+){0,3}$/.test(v)) return R.toast("Use a version like 4.9.3");
      await save({ latest: v ? { version: v, note: $(".ow-vnote").value.trim(), link: STORE } : null }, v ? "Update notice saved" : "Update notice removed");
    };
    main.querySelectorAll(".ft-sw input[data-k]").forEach((c) => (c.onchange = async () => {
      const cur = { off: [], ...(await R.get1("ownerLive", {})) };
      const off = new Set(cur.off);
      c.checked ? off.delete(c.dataset.k) : off.add(c.dataset.k);
      c.closest(".ft-row").querySelector("small").textContent = c.checked ? "On" : "Off for everyone";
      await save({ off: [...off] }, c.checked ? "Turned back on" : "Turned off for everyone");
    }));
    $(".ow-push").onclick = async () => { const r = await R.badges.publish(); R.toast(r.ok ? "Pushed" : r.reason || "Couldn't push"); };
    $(".ow-trk").onclick = async (e) => { e.target.disabled = true; await R.send({ type: "runTracker" }); e.target.disabled = false; R.toast("Tracker ran. See Tracker for anything new."); };
    $(".ow-cache").onclick = async () => { await R.set({ lbCache: {} }); R.toast("Cleared"); };
  }
  R.extraViews = { ...(R.extraViews || {}), owner: ownerView };
})();
