// "You" features: Discord-style status + custom profile picture (shown in your browser)
(() => {
  const R = window.Rogen;

  /* ================= STATUS ================= */
  R.STATES = {
    online: { label: "Online", color: "#23a55a", desc: "" },
    idle: { label: "Idle", color: "#f0b232", desc: "" },
    dnd: { label: "Do Not Disturb", color: "#f23f43", desc: "You won't get RoGen alerts" },
    invisible: { label: "Invisible", color: "#80848e", desc: "Your status pill is hidden" }
  };
  const CLEAR = [["", "Don't clear"], ["30m", "30 minutes"], ["1h", "1 hour"], ["4h", "4 hours"], ["today", "Today"]];

  // Old status format → new one
  R.normStatus = (st) => {
    if (!st) return { state: "online", emoji: "", text: "", clearAt: 0, on: false };
    return { state: st.state || "online", emoji: st.emoji || "", text: st.text || "", clearAt: st.clearAt || 0, on: st.on !== false };
  };
  R.statusLive = (st) => {
    st = R.normStatus(st);
    if (!st.on) return null;
    if (st.clearAt && Date.now() > st.clearAt) return { ...st, emoji: "", text: "" };
    return st;
  };
  R.statusDot = (state, size = 10) => `<span class="rg-dot" style="--d:${R.STATES[state]?.color || R.STATES.online.color};--s:${size}px" title="${R.esc(R.STATES[state]?.label || "")}"></span>`;
  // The pill that shows on your profile and dashboard
  R.statusPill = (raw, { editable = false } = {}) => {
    const st = R.statusLive(raw);
    if (!st || st.state === "invisible") return editable ? `<button class="rg-status rg-status-empty" data-edit-status>Set a status</button>` : "";
    const label = st.text || R.STATES[st.state].label;
    return `<${editable ? "button" : "div"} class="rg-status" ${editable ? "data-edit-status" : ""} title="${R.esc(R.STATES[st.state].label)}">
      ${R.statusDot(st.state)}${label ? `<span class="s-t">${R.esc(label)}</span>` : ""}</${editable ? "button" : "div"}>`;
  };
  // Discord-style bubble that sits on the top corner of your avatar
  R.statusBubble = (raw, { editable = false } = {}) => {
    const st = R.statusLive(raw);
    const has = st && st.state !== "invisible";
    if (!has && !editable) return "";
    const text = has ? (st.text || R.STATES[st.state].label) : "Add a status";
    const tag = editable ? "button" : "div";
    const lead = has ? R.statusDot(st.state, 10) : `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
    return `<${tag} class="rg-bubble${has ? "" : " empty"}"${editable ? ` type="button" data-edit-status title="Change your status"` : ""}>${lead}<span class="b-t">${R.esc(text)}</span></${tag}>`;
  };
  const clearTime = (k) => {
    const now = Date.now();
    if (k === "30m") return now + 30 * 60e3;
    if (k === "1h") return now + 3600e3;
    if (k === "4h") return now + 4 * 3600e3;
    if (k === "today") { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); }
    return 0;
  };

  // Discord-style status popup. Pops up next to whatever you clicked. Pick Online / Idle / Do Not Disturb / Invisible and it
  // applies right away. A custom status is optional text (an emoji is optional too).
  R.openStatusEditor = async (anchor) => {
    const old = document.querySelector(".rg-pop-wrap");
    if (old) { old.remove(); if (old._anchor === anchor) return; }   // click the trigger again = close
    const st = R.normStatus(await R.get1("status", null));
    const me = R.me();
    const wrap = R.h(`<div class="rg-pop-wrap"><div class="rg-pop rg-stpop" role="dialog" aria-label="Set your status">
      <div class="sp-head"><span class="sp-av"><img alt=""></span><div class="sp-who"><b>${R.esc(me ? me.displayName : "You")}</b><small class="sp-cur"></small></div></div>
      <div class="sp-custom"><input class="sp-text" maxlength="80" placeholder="Set a custom status" value="${R.esc(st.text)}"><button type="button" class="sp-x" title="Clear text" aria-label="Clear text" ${st.text ? "" : "hidden"}><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="sp-more" hidden><label>Clear after<select class="sp-clear">${CLEAR.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label><button type="button" class="btn-primary-sm sp-save">Save</button></div>
      <div class="sp-sep"></div>
      ${Object.entries(R.STATES).map(([k, v]) => `<button type="button" class="sp-state ${st.on !== false && st.state === k ? "on" : ""}" data-s="${k}">${R.statusDot(k, 12)}<span><b>${v.label}</b>${v.desc ? `<small>${v.desc}</small>` : ""}</span><i class="sp-tick"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg></i></button>`).join("")}
      <div class="sp-sep"></div>
      <button type="button" class="sp-clearall" ${st.on !== false && (st.text || st.emoji) ? "" : "hidden"}>Clear custom status</button>
    </div></div>`);
    wrap._anchor = anchor;
    document.body.appendChild(wrap);
    const pop = wrap.querySelector(".rg-pop");
    const $ = (q) => pop.querySelector(q);
    const emoji = "";

    // status line under your name
    const live = st.on !== false ? st : null;
    $(".sp-cur").textContent = live ? (live.text || R.STATES[live.state].label) : "No status set";
    if (R.myPfp && R.myPfp()) $(".sp-av img").src = R.myPfp(); else if (me) R.thumbs("user", [me.id], "150x150").then((m) => m[me.id] && ($(".sp-av img").src = m[me.id]));

    // position next to the trigger (flips so it always stays on screen)
    const place = () => {
      const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
      const w = pop.offsetWidth, h = pop.offsetHeight, m = 8;
      let x, y;
      if (r && (r.width || r.height)) {
        x = Math.min(Math.max(m, r.left), innerWidth - w - m);
        y = r.bottom + 8;
        if (y + h > innerHeight - m) y = Math.max(m, r.top - h - 8);
        pop.style.transformOrigin = `${Math.max(12, r.left + r.width / 2 - x)}px ${y > r.top ? "0" : "100%"}`;
      } else { x = (innerWidth - w) / 2; y = Math.max(m, (innerHeight - h) / 3); }
      pop.style.left = x + "px"; pop.style.top = y + "px";
    };
    place();
    requestAnimationFrame(() => pop.classList.add("in"));

    const close = () => { pop.classList.remove("in"); setTimeout(() => wrap.remove(), 120); document.removeEventListener("keydown", onKey, true); removeEventListener("resize", place); };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    document.addEventListener("keydown", onKey, true);
    addEventListener("resize", place);
    wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(); });

    const save = async (patch = {}) => {
      const text = $(".sp-text").value.trim();
      const cur = R.normStatus(await R.get1("status", null));
      const next = { state: patch.state || (cur.on !== false ? cur.state : "online") || "online", emoji: text || emoji ? emoji : "", text, clearAt: text || emoji ? clearTime($(".sp-clear").value) : 0, on: true };
      await R.set({ status: next });
      R.toast(patch.state ? `You're now ${R.STATES[next.state].label}` : "Status updated");
      close();
    };
    const reveal = () => { $(".sp-more").hidden = !($(".sp-text").value.trim() || emoji); $(".sp-x").hidden = !$(".sp-text").value; place(); };
    $(".sp-text").oninput = reveal;
    $(".sp-text").onkeydown = (e) => { if (e.key === "Enter") save(); };
    $(".sp-x").onclick = () => { $(".sp-text").value = ""; $(".sp-text").focus(); reveal(); };
    $(".sp-save").onclick = () => save();
    pop.querySelectorAll(".sp-state").forEach((b) => (b.onclick = () => save({ state: b.dataset.s })));
    $(".sp-clearall").onclick = async () => { await R.set({ status: { state: st.state, emoji: "", text: "", clearAt: 0, on: st.on !== false } }); R.toast("Custom status cleared"); close(); };
    reveal();
    if (st.text || emoji) $(".sp-more").hidden = false;
    $(".sp-text").focus();
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-edit-status]");
    if (b) { e.preventDefault(); e.stopPropagation(); R.openStatusEditor(b); }
  }, true);

  // Small popup that asks for one value next to what you clicked. Resolves with the value, "" for Reset, or null if cancelled.
  R.ask = (anchor, { title, hint = "", type = "text", value = "", min, max, step, unit = "", ok = "Save", reset = "" }) => new Promise((res) => {
    document.querySelector(".rg-pop-wrap")?.remove();
    const wrap = R.h(`<div class="rg-pop-wrap"><div class="rg-pop rg-askpop" role="dialog">
      <div class="sp-who" style="padding:6px 6px 8px"><b>${R.esc(title)}</b>${hint ? `<small style="white-space:normal;line-height:1.4;margin-top:3px">${R.esc(hint)}</small>` : ""}</div>
      <div class="sp-custom"><input class="sp-text" type="${type}" value="${R.esc(value)}" ${min != null ? `min="${min}"` : ""} ${max != null ? `max="${max}"` : ""} ${step != null ? `step="${step}"` : ""}>${unit ? `<span class="rg-mute" style="padding:0 10px;font-size:14px">${R.esc(unit)}</span>` : ""}</div>
      <div class="sp-more" style="margin-top:10px">${reset ? `<button type="button" class="btn-control-sm ak-reset">${R.esc(reset)}</button>` : ""}<span style="flex:1"></span><button type="button" class="btn-control-sm ak-no">Cancel</button><button type="button" class="btn-primary-sm ak-ok">${R.esc(ok)}</button></div>
    </div></div>`);
    document.body.appendChild(wrap);
    const pop = wrap.querySelector(".rg-pop");
    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let x = r ? Math.min(Math.max(8, r.left), innerWidth - w - 8) : (innerWidth - w) / 2;
    let y = r ? r.bottom + 8 : Math.max(8, (innerHeight - h) / 3);
    if (r && y + h > innerHeight - 8) y = Math.max(8, r.top - h - 8);
    pop.style.left = x + "px"; pop.style.top = y + "px";
    requestAnimationFrame(() => pop.classList.add("in"));
    const input = pop.querySelector("input");
    const done = (v) => { document.removeEventListener("keydown", onKey, true); pop.classList.remove("in"); setTimeout(() => wrap.remove(), 120); res(v); };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); done(null); } };
    document.addEventListener("keydown", onKey, true);
    wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) done(null); });
    pop.querySelector(".ak-no").onclick = () => done(null);
    pop.querySelector(".ak-ok").onclick = () => done(input.value);
    const rb = pop.querySelector(".ak-reset"); if (rb) rb.onclick = () => done("");
    input.onkeydown = (e) => { if (e.key === "Enter") done(input.value); };
    input.focus(); input.select && input.select();
  });

  /* ================= PROFILE PICTURE ================= */
  // Center-crop to a square and shrink, so it's light to store
  R.readPfp = (file) => new Promise((res, rej) => {
    if (!file || !file.type.startsWith("image/")) return rej(new Error("Pick an image file"));
    const fr = new FileReader();
    fr.onerror = () => rej(new Error("Couldn't read that file"));
    fr.onload = () => {
      if (file.type === "image/gif") return file.size > 4e6 ? rej(new Error("GIF is too big (max 4 MB)")) : res(fr.result);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(img.width, img.height), out = 320;
        const c = document.createElement("canvas"); c.width = c.height = out;
        c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, out, out);
        res(c.toDataURL("image/png"));
      };
      img.onerror = () => rej(new Error("That image couldn't be opened"));
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });

  let pfp = null, status = null, myId = null;
  R.myPfp = () => pfp;

  // Swap your avatar headshot for your picture wherever it appears, and add your status dot to the top bar
  R.applyMe = () => {
    const me = R.me();
    if (!me) return;
    myId = me.id;
    const imgs = new Set();
    document.querySelectorAll(`a[href*="/users/${me.id}/profile"] img, a[href*="/users/${me.id}/"] .avatar-card-image img`).forEach((i) => imgs.add(i));
    if (location.pathname.toLowerCase().startsWith(`/users/${me.id}/`)) document.querySelectorAll(".user-profile-header-details-avatar-container img, .profile-avatar-thumb img").forEach((i) => imgs.add(i));
    document.querySelectorAll(`img[data-thumb="user:${me.id}"]`).forEach((i) => imgs.add(i));
    imgs.forEach((img) => {
      if (pfp) {
        if (img.src !== pfp) { if (!img.dataset.rgOrig) img.dataset.rgOrig = img.src; img.src = pfp; img.removeAttribute("srcset"); img.classList.add("rg-pfp"); }
      } else if (img.dataset.rgOrig) { img.src = img.dataset.rgOrig; delete img.dataset.rgOrig; img.classList.remove("rg-pfp"); }
    });
    // Status dot on your top-bar avatar
    const nav = document.querySelector(`#navigation-container a[href*="/users/${me.id}/profile"], #header a[href*="/users/${me.id}/profile"]`);
    const holder = nav && (nav.querySelector(".avatar, .avatar-card-image, .thumbnail-2d-container") || nav);
    const live = R.statusLive(status);
    let dot = document.querySelector(".rg-nav-dot");
    if (!holder || !live || live.state === "invisible") { dot && dot.remove(); return; }
    if (!dot || !holder.contains(dot)) {
      dot && dot.remove();
      dot = R.h(`<span class="rg-nav-dot" data-edit-status></span>`);
      if (getComputedStyle(holder).position === "static") holder.style.position = "relative";
      holder.appendChild(dot);
    }
    dot.style.setProperty("--d", R.STATES[live.state].color);
    dot.title = R.STATES[live.state].label + (live.text ? ` · ${live.text}` : "") + " (click to change)";
  };

  R.get(["pfp", "status"]).then((v) => { pfp = v.pfp || null; status = v.status || null; R.applyMe(); });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local") return;
    if (ch.pfp) { pfp = ch.pfp.newValue || null; R.applyMe(); }
    if (ch.status) { status = ch.status.newValue || null; R.applyMe(); }
  });
})();
