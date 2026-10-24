// Avatar editor: replaces roblox.com/my/avatar. Live preview, category tabs, tap to wear, outfits, skin tone, body size and a built-in Marketplace (browse, buy, wear).
(() => {
  const R = window.Rogen;
  const AV = "https://avatar.roblox.com";
  const cur = (c) => (c ? `&cursor=${encodeURIComponent(c)}` : "");

  const SHOES = ["LeftShoeAccessory", "RightShoeAccessory"];
  // Same tabs and sub-menus as Roblox's avatar editor. [label, asset types] or a special view name.
  const CATS = {
    recent: { label: "Recent" },
    characters: { label: "Characters" },
    clothing: { label: "Clothing", subs: [["All", null], ["Shirts", ["Shirt"]], ["T-Shirts", ["TShirt"]], ["Pants", ["Pants"]], ["Jackets", ["JacketAccessory"]], ["Sweaters", ["SweaterAccessory"]], ["Layered shirts", ["ShirtAccessory", "TShirtAccessory"]], ["Layered pants", ["PantsAccessory"]], ["Shorts", ["ShortsAccessory"]], ["Dresses & skirts", ["DressSkirtAccessory"]], ["Shoes", SHOES]] },
    accessories: { label: "Accessories", subs: [["All", null], ["Hats", ["Hat"]], ["Hair", ["HairAccessory"]], ["Face", ["FaceAccessory"]], ["Neck", ["NeckAccessory"]], ["Shoulder", ["ShoulderAccessory"]], ["Front", ["FrontAccessory"]], ["Back", ["BackAccessory"]], ["Waist", ["WaistAccessory"]], ["Gear", ["Gear"]], ["Advanced", "advanced"]] },
    body: { label: "Head & Body", subs: [["Skin tone", "skin"], ["Scale", "scale"], ["Bodies", "bundle:BodyParts"], ["Heads", ["Head", "DynamicHead"]], ["Faces", ["Face"]], ["Eyebrows", ["EyebrowAccessory"]], ["Eyelashes", ["EyelashAccessory"]], ["Torsos", ["Torso"]], ["Left arms", ["LeftArm"]], ["Right arms", ["RightArm"]], ["Left legs", ["LeftLeg"]], ["Right legs", ["RightLeg"]]] },
    animations: { label: "Animations", subs: [["Packs", "bundle:AvatarAnimations"], ["Idle", ["IdleAnimation"]], ["Walk", ["WalkAnimation"]], ["Run", ["RunAnimation"]], ["Jump", ["JumpAnimation"]], ["Fall", ["FallAnimation"]], ["Climb", ["ClimbAnimation"]], ["Swim", ["SwimAnimation"]], ["Mood", ["MoodAnimation"]]] },
    emotes: { label: "Emotes" },
    market: { label: "Marketplace" }
  };
  const ONE_ONLY = new Set(["Shirt", "Pants", "TShirt", "Face", "Head", "DynamicHead", "Gear", "Torso", "LeftArm", "RightArm", "LeftLeg", "RightLeg", "IdleAnimation", "WalkAnimation", "RunAnimation", "JumpAnimation", "FallAnimation", "ClimbAnimation", "SwimAnimation", "MoodAnimation"]);
  const PARTS = [["all", "Everything"], ["head", "Head"], ["torso", "Torso"], ["leftArm", "Left arm"], ["rightArm", "Right arm"], ["leftLeg", "Left leg"], ["rightLeg", "Right leg"]];
  const typeName = (a) => (a && typeof a.assetType === "object" ? a.assetType?.name : a?.assetType) || "";
  const typesOf = (cat, sub) => { const s = CATS[cat].subs[sub][1]; return Array.isArray(s) ? s : CATS[cat].subs.flatMap((x) => (Array.isArray(x[1]) ? x[1] : [])); };
  const special = (cat, sub) => { const x = CATS[cat].subs && CATS[cat].subs[sub] && CATS[cat].subs[sub][1]; return typeof x === "string" ? x : ""; };

  const CHECK = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>`;
  const XICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
  const UNDO = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>`;
  R.avatarEditor = async (main) => {
    const me = R.me();
    if (!me) { main.innerHTML = `<div class="rg-empty" style="padding:80px 0">Log in to Roblox to edit your avatar.</div>`; return; }
    main.innerHTML = `<div class="av-wrap"><aside class="av-left rg-card">
        <div class="av-stage"><img class="av-img" alt="Your avatar"><div class="av-busy" hidden><span class="rg-loading">Updating…</span></div><button class="av-redraw" type="button" title="Avatar not showing right? Redraw it">Redraw</button><span class="av-save" hidden></span></div>
        <div class="av-ctrl"><div class="av-type" role="group" aria-label="Body type"></div><button class="av-undo" type="button" disabled title="Undo last change">${UNDO}Undo</button></div>
        <div class="av-whead"><b>Wearing</b><span class="av-count"></span></div>
        <div class="av-wlist"></div>
      </aside><section class="av-right">
        <div class="rg-tabs av-cats">${Object.entries(CATS).map(([k, c]) => `<button class="rg-tab" data-c="${k}">${c.label}</button>`).join("")}</div>
        <div class="rg-chips av-subs" style="margin-bottom:12px"></div>
        <div class="av-tools"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/></svg><input class="av-q" placeholder="Search…"></div>
        <div class="av-body"></div>
      </section></div>`;
    const $ = (s) => main.querySelector(s);
    const st = { avatar: null, rules: null, cat: (await R.get1("avRecent", [])).length ? "recent" : "accessories", sub: 0, q: "", busy: false, thumbTok: 0, undo: [] };
    const inv = {};
    const alive = () => document.contains(main);

    /* ---------- data ---------- */
    // v1 has body colors as BrickColor ids (what the skin tone picker uses); v2 adds each item's layering "meta"
    const loadAvatar = async () => {
      const [a, b] = await Promise.all([R.api(`${AV}/v1/avatar`), R.api(`${AV}/v2/avatar/avatar`).catch(() => null)]);
      const meta = new Map(((b && b.assets) || []).map((x) => [x.id, x.meta]));
      (a.assets || []).forEach((x) => { if (meta.get(x.id)) x.meta = meta.get(x.id); });
      if (b && b.bodyColor3s) a.bodyColor3s = b.bodyColor3s;
      return (st.avatar = a);
    };
    try { await Promise.all([loadAvatar(), R.api(`${AV}/v1/avatar-rules`).then((r) => (st.rules = r)).catch(() => null)]); }
    catch (e) { main.innerHTML = R.errBox(e); return; }
    const maxOf = (type) => st.rules?.wearableAssetTypes?.find((t) => t.name === type)?.maxNumber ?? (ONE_ONLY.has(type) ? 1 : 99);
    // What you've picked. Clicks change this instantly; Roblox is updated in the background.
    const worn = () => st.want || st.avatar.assets || [];
    const wornIds = () => new Set(worn().map((a) => a.id));
    const snap = (list) => list.map((a) => ({ id: a.id, name: a.name, assetType: a.assetType, meta: a.meta }));

    /* ---------- preview ---------- */
    async function loadThumb(prev) {
      const tok = ++st.thumbTok;
      const busy = $(".av-busy");
      busy.hidden = false;
      for (let i = 0; i < 9 && alive() && tok === st.thumbTok; i++) {
        try {
          const d = await R.api(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${me.id}&size=420x420&format=Png&isCircular=false`);
          const t = d.data && d.data[0];
          if (t && t.state === "Completed" && t.imageUrl && (t.imageUrl !== prev || i >= 4)) { $(".av-img").src = t.imageUrl; break; }
        } catch (e) { /* retry */ }
        await R.sleep(1300);
      }
      if (tok === st.thumbTok && alive()) busy.hidden = true;
    }

    /* ---------- saving ---------- */
    const setBusy = (b) => { st.busy = b; main.classList.toggle("av-working", b); };
    // Send a full outfit to Roblox (v2, then v1, then one item at a time). Returns the ids Roblox refused.
    async function send(next) {
      const payload = { assets: next.map((a) => ({ id: a.id, ...(a.meta ? { meta: a.meta } : {}) })) };
      try {
        const r = await R.api(`${AV}/v2/avatar/set-wearing-assets`, { method: "POST", body: payload });
        const bad = r.invalidAssets || r.invalidAssetIds || [];
        if (r.success === false && !bad.length) throw new Error("Roblox didn't accept that");
        return bad.map((x) => (typeof x === "object" ? x.id : x));
      } catch (e) {
        try {
          const r = await R.api(`${AV}/v1/avatar/set-wearing-assets`, { method: "POST", body: { assetIds: next.map((a) => a.id) } });
          return r.invalidAssetIds || [];
        } catch (e2) {
          const was = new Set((st.avatar.assets || []).map((a) => a.id)), now = new Set(next.map((a) => a.id));
          for (const id of now) if (!was.has(id)) await R.api(`${AV}/v1/avatar/assets/${id}/wear`, { method: "POST", body: {} });
          for (const id of was) if (!now.has(id)) await R.api(`${AV}/v1/avatar/assets/${id}/remove`, { method: "POST", body: {} });
          return [];
        }
      }
    }
    let saveTimer = 0, saving = false, dirty = false;
    const status = (t) => { const el = $(".av-save"); if (el) { el.textContent = t; el.hidden = !t; } };
    // Change what you're wearing: the tiles and the Wearing list update right away, the save follows a moment later
    function apply(next, record = true) {
      if (record) { st.undo.push(snap(worn())); if (st.undo.length > 30) st.undo.shift(); }
      st.want = snap(next);
      $(".av-undo").disabled = !st.undo.length;
      paintLeft(); refreshTiles();
      dirty = true; status("Saving…");
      clearTimeout(saveTimer); saveTimer = setTimeout(flush, 450);
    }
    async function flush() {
      if (saving || !dirty) return;
      dirty = false; saving = true;
      const target = st.want, prevUrl = $(".av-img").src;
      let bad = [];
      try { bad = await send(target); } catch (e) { R.toast("Couldn't save: " + e.message); }
      saving = false;
      if (dirty) return flush();                         // you kept clicking: send the newest version
      try { await loadAvatar(); } catch (e) { /* keep what we have */ }
      if (dirty) return;
      st.want = null;                                     // Roblox's copy is the truth again
      paintLeft(); refreshTiles(); status("Saved"); setTimeout(() => !dirty && !saving && status(""), 1400);
      loadThumb(prevUrl);
      if (bad.length) R.toast(`Roblox wouldn't wear ${bad.length} item${bad.length === 1 ? "" : "s"} (you may not own ${bad.length === 1 ? "it" : "them"})`);
    }
    async function setAssets(next) { apply(next); }
    function toggle(id, name, type) {
      const have = worn();
      let next;
      if (have.some((a) => a.id === id)) next = have.filter((a) => a.id !== id);
      else {
        const max = maxOf(type);
        const same = have.filter((a) => typeName(a) === type);
        const drop = new Set(same.slice(0, Math.max(0, same.length - (max - 1))).map((a) => a.id));
        next = [...have.filter((a) => !drop.has(a.id)), { id, name, assetType: { name: type } }];
        remember({ id, name, type });
      }
      apply(next);
    }
    // keep every visible tile's check mark in step with what you're wearing
    function refreshTiles() {
      const w = wornIds();
      main.querySelectorAll(".av-item[data-id]").forEach((b) => { const on = w.has(Number(b.dataset.id)); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
      if (typeof mk !== "undefined" && mk.items) mk.items.forEach((x) => repaint(x.id));
    }
    async function remember(item) {
      const list = (await R.get1("avRecent", [])).filter((x) => x.id !== item.id);
      list.unshift(item);
      R.set({ avRecent: list.slice(0, 60) });
    }
    async function postAvatar(path, body, msg) {
      if (st.busy) return;
      setBusy(true);
      const prev = $(".av-img").src;
      try { await R.api(`${AV}${path}`, { method: "POST", body }); await loadAvatar(); paintLeft(); loadThumb(prev); msg && R.toast(msg); }
      catch (e) { R.toast(e.message); }
      setBusy(false);
    }

    /* ---------- left column ---------- */
    function paintLeft() {
      const a = st.avatar;
      $(".av-type").innerHTML = ["R6", "R15"].map((t) => `<button type="button" data-type="${t}" class="${a.playerAvatarType === t ? "on" : ""}" aria-pressed="${a.playerAvatarType === t}">${t}</button>`).join("");
      const assets = worn();
      $(".av-count").textContent = assets.length;
      $(".av-wlist").innerHTML = assets.length ? assets.map((x) => `<div class="av-w"><img data-thumb="asset:${x.id}" alt=""><div><b>${R.esc(x.name)}</b><small>${R.esc(typeName(x).replace(/Accessory$/, "").replace(/([a-z])([A-Z])/g, "$1 $2"))}</small></div><button class="av-x" data-rm="${x.id}" title="Take off" aria-label="Take off ${R.esc(x.name)}">${XICON}</button></div>`).join("") : `<div class="av-none">Nothing on. Pick something on the right.</div>`;
      R.fillThumbs($(".av-wlist"));
    }
    $(".av-type").onclick = (e) => { const b = e.target.closest("button"); if (b && b.dataset.type !== st.avatar.playerAvatarType) postAvatar("/v1/avatar/set-player-avatar-type", { playerAvatarType: b.dataset.type }, `Switched to ${b.dataset.type}`); };
    $(".av-wlist").onclick = (e) => { const b = e.target.closest("[data-rm]"); if (b) toggle(Number(b.dataset.rm)); };
    $(".av-redraw").onclick = async () => {
      const prev = $(".av-img").src;
      try { await R.api(`${AV}/v1/avatar/redraw-thumbnail`, { method: "POST", body: {} }); } catch (e) { /* Roblox limits how often you can redraw */ }
      loadThumb(prev);
    };
    $(".av-undo").onclick = () => { if (st.undo.length) apply(st.undo.pop(), false); };

    /* ---------- right column ---------- */
    const paintTabs = () => {
      main.querySelectorAll(".av-cats .rg-tab").forEach((b) => b.classList.toggle("on", b.dataset.c === st.cat));
      const subs = CATS[st.cat].subs;
      $(".av-subs").innerHTML = subs ? subs.map((s, i) => `<button class="rg-chip ${i === st.sub ? "on" : ""}" data-s="${i}">${s[0]}</button>`).join("") : "";
      $(".av-subs").hidden = !subs;
      $(".av-q").placeholder = st.cat === "market" ? "Search the Marketplace" : `Search your ${CATS[st.cat].label.toLowerCase()}`;
      $(".av-tools").hidden = ["characters", "emotes"].includes(st.cat) || /^(skin|scale|advanced)$/.test(special(st.cat, st.sub));
    };
    main.querySelector(".av-cats").onclick = (e) => { const b = e.target.closest("[data-c]"); if (b) { st.cat = b.dataset.c; st.sub = 0; st.q = ""; $(".av-q").value = ""; paintTabs(); paintBody(); } };
    // Click a tile to put it on, click it again to take it off (like Roblox)
    $(".av-body").addEventListener("click", (e) => {
      const b = e.target.closest(".av-item[data-id]");
      if (!b) return;
      e.preventDefault();
      toggle(Number(b.dataset.id), b.dataset.name || "", b.dataset.type || "");
    });
    $(".av-subs").onclick = (e) => { const b = e.target.closest("[data-s]"); if (b) { st.sub = Number(b.dataset.s); paintTabs(); paintBody(); } };
    let qt = null;
    $(".av-q").oninput = (e) => {
      st.q = e.target.value.trim();
      clearTimeout(qt);
      qt = setTimeout(() => (st.cat === "market" ? marketSearch(true) : paintBody(true)), st.cat === "market" ? 450 : 120);
    };
    $(".av-q").onkeydown = (e) => { if (e.key === "Enter" && st.cat === "market") { clearTimeout(qt); marketSearch(true); } };

    const itemCard = (it) => `<button type="button" aria-pressed="${wornIds().has(it.id)}" class="av-item ${wornIds().has(it.id) ? "on" : ""}" data-id="${it.id}" data-name="${R.esc(it.name)}" data-type="${R.esc(it.type)}" title="${R.esc(it.name)}">
      <span class="av-ith"><img data-thumb="asset:${it.id}" alt="" loading="lazy"></span><span class="av-itn">${R.esc(it.name)}</span><i class="av-check">${CHECK}</i></button>`;
    const grid = (items) => `<div class="av-grid">${items.map(itemCard).join("")}</div>`;
    const filt = (items) => (st.q ? items.filter((i) => i.name.toLowerCase().includes(st.q.toLowerCase())) : items);

    function paintBody(soft) {
      const body = $(".av-body");
      if (soft && st.cat === "market" && body.querySelector(".mk-out")) { mk.items.forEach((i) => repaint(i.id)); return; }
      const sp = CATS[st.cat].subs ? special(st.cat, st.sub) : "";
      if (soft && body.querySelector(".av-grid") && !["characters", "market", "recent", "emotes"].includes(st.cat) && !sp) return paintGridOnly();
      if (soft && st.cat === "characters") return;
      if (st.cat === "recent") return recent(body);
      if (st.cat === "characters") return outfits(body);
      if (st.cat === "emotes") return emotes(body);
      if (st.cat === "market") return marketView(body);
      if (sp === "skin" || sp === "scale") return skin(body, sp);
      if (sp === "advanced") return advanced(body);
      if (sp.startsWith("bundle:")) return bundles(body, sp.slice(7));
      return owned(body);
    }
    // Keep the worn highlight right without reloading the whole list
    function paintGridOnly() {
      const worn = wornIds();
      main.querySelectorAll(".av-item").forEach((b) => b.classList.toggle("on", worn.has(Number(b.dataset.id))));
      const key = `${st.cat}:${st.sub}`;
      if (inv[key] && st.q !== inv[key].lastQ) owned($(".av-body"));
    }

    async function recent(body) {
      const list = filt(await R.get1("avRecent", []));
      body.innerHTML = list.length ? grid(list) : `<div class="rg-empty">Things you wear here show up in this list.</div>`;
      R.fillThumbs(body);
    }

    async function owned(body) {
      const key = `${st.cat}:${st.sub}`;
      const types = typesOf(st.cat, st.sub);
      const s = (inv[key] = inv[key] || { items: [], cursor: "", done: false, loading: false });
      s.lastQ = st.q;
      const draw = () => {
        if (!alive() || key !== `${st.cat}:${st.sub}`) return;
        const items = filt(s.items);
        body.innerHTML = (items.length ? grid(items) : s.loading ? `<div class="rg-loading">Loading your items…</div>` : `<div class="rg-empty">${s.items.length ? "Nothing matches that search." : "You don't have anything here yet."}</div>`)
          + (!s.done ? `<div class="rg-row" style="justify-content:center;margin-top:14px"><button class="btn-control-md av-more">${s.loading ? "Loading…" : "Load more"}</button></div>` : "");
        R.fillThumbs(body);
        const more = body.querySelector(".av-more");
        if (more) more.onclick = () => fetchMore();
      };
      const fetchMore = async () => {
        if (s.loading || s.done) return;
        s.loading = true; draw();
        try {
          let d;
          try { d = await R.api(`https://inventory.roblox.com/v2/users/${me.id}/inventory?assetTypes=${types.join(",")}&limit=100&sortOrder=Desc${cur(s.cursor)}`); }
          catch (e) {
            if (e.status !== 400 || types.length < 2) throw e;
            d = { data: [] };                     // one of the types isn't known to Roblox: ask for each on its own
            for (const t of types) { try { (await R.api(`https://inventory.roblox.com/v2/users/${me.id}/inventory?assetTypes=${t}&limit=100&sortOrder=Desc`)).data.forEach((x) => d.data.push({ ...x, assetType: x.assetType || t })); } catch (e2) { /* skip */ } }
          }
          for (const x of d.data || []) s.items.push({ id: x.assetId, name: x.assetName, type: typeName(x) || (types.length === 1 ? types[0] : "") });
          s.cursor = d.nextPageCursor || "";
          s.done = !s.cursor;
        } catch (e) { s.done = true; body.innerHTML = e.status === 403 ? `<div class="rg-empty">Roblox wouldn't show your inventory. Check your privacy settings.</div>` : R.errBox(e); s.loading = false; return; }
        s.loading = false;
        // Keep loading while a search has no hits yet
        if (st.q && !filt(s.items).length && !s.done) return fetchMore();
        draw();
      };
      if (!s.items.length && !s.done) await fetchMore(); else draw();
    }

    /* Skin tone + body size */
    function skin(body, what = "skin") {
      const a = st.avatar, bc = a.bodyColors || {};
      const palette = st.rules?.bodyColorsPalette || [];
      const sc = a.scales || {};
      const ranges = st.rules?.scales || {};
      const r15 = a.playerAvatarType === "R15";
      let part = body.dataset.part || "all";
      const colorKey = { head: "headColorId", torso: "torsoColorId", leftArm: "leftArmColorId", rightArm: "rightArmColorId", leftLeg: "leftLegColorId", rightLeg: "rightLegColorId" };
      const tone = `<div class="rg-h3" style="margin-top:0">Skin tone</div>
        <div class="rg-chips" style="margin-bottom:12px">${PARTS.map(([k, l]) => `<button class="rg-chip ${k === part ? "on" : ""}" data-part="${k}">${l}</button>`).join("")}</div>
        ${palette.length ? `<div class="av-swatches">${palette.map((c) => `<button class="av-sw ${part !== "all" && bc[colorKey[part]] === c.brickColorId ? "on" : part === "all" && Object.values(colorKey).every((k) => bc[k] === c.brickColorId) ? "on" : ""}" data-c="${c.brickColorId}" style="background:${R.esc(c.hexColor || "#999")}" title="${R.esc(c.name || "")}"></button>`).join("")}</div>`
        : `<div class="rg-empty">Couldn't load the skin tone list from Roblox.</div>`}
        <div class="av-custom"><label>Custom color <input type="color" class="av-hex" value="#${R.esc((palette.find((c) => c.brickColorId === bc[colorKey[part === "all" ? "head" : part]]) || {}).hexColor || "#CC8E69").replace("#", "")}"></label><button class="btn-control-sm av-hexgo" type="button">Use this color</button></div>`;
      const size = `<div class="rg-h3" style="margin-top:0">Scale</div>
        ${r15 ? "" : `<p class="rg-note" style="margin:0 0 8px">Sizes only apply to R15 avatars. Switch to R15 on the left.</p>`}
        <div class="av-scales ${r15 ? "" : "off"}">${Object.entries(ranges).map(([k, r]) => `<label class="av-scale"><span>${k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}</span>
          <input type="range" data-k="${k}" min="${r.min}" max="${r.max}" step="${r.increment || 0.01}" value="${sc[k] ?? r.min}" ${r15 ? "" : "disabled"}><output>${Number(sc[k] ?? r.min).toFixed(2)}</output></label>`).join("") || `<div class="rg-empty">Couldn't load size limits.</div>`}</div>`;
      body.innerHTML = what === "scale" ? size : tone;
      body.querySelectorAll("[data-part]").forEach((b) => (b.onclick = () => { body.dataset.part = b.dataset.part; skin(body, what); }));
      const hexgo = body.querySelector(".av-hexgo");
      if (hexgo) hexgo.onclick = () => {
        // any colour: Roblox's v2 body colours take hex values
        const hex = body.querySelector(".av-hex").value.replace("#", "").toUpperCase();
        const parts = { head: "headColor3", torso: "torsoColor3", leftArm: "leftArmColor3", rightArm: "rightArmColor3", leftLeg: "leftLegColor3", rightLeg: "rightLegColor3" };
        const cur3 = {}; Object.values(parts).forEach((k) => (cur3[k] = (st.avatar.bodyColor3s || {})[k] || hex));
        if (part === "all") Object.values(parts).forEach((k) => (cur3[k] = hex)); else cur3[parts[part]] = hex;
        postAvatar("/v2/avatar/set-body-colors", cur3, "Skin color updated").then(() => skin(body, what));
      };
      body.querySelectorAll(".av-sw").forEach((b) => (b.onclick = () => {
        const id = Number(b.dataset.c);
        const next = { headColorId: bc.headColorId, torsoColorId: bc.torsoColorId, rightArmColorId: bc.rightArmColorId, leftArmColorId: bc.leftArmColorId, rightLegColorId: bc.rightLegColorId, leftLegColorId: bc.leftLegColorId };
        if (part === "all") Object.keys(next).forEach((k) => (next[k] = id)); else next[colorKey[part]] = id;
        postAvatar("/v1/avatar/set-body-colors", next, "Skin tone updated").then(() => skin(body, what));
      }));
      body.querySelectorAll(".av-scale input").forEach((inp) => {
        inp.oninput = () => (inp.nextElementSibling.textContent = Number(inp.value).toFixed(2));
        inp.onchange = () => {
          const next = { ...sc };
          body.querySelectorAll(".av-scale input").forEach((i) => (next[i.dataset.k] = Number(i.value)));
          postAvatar("/v1/avatar/set-scales", next, "Size updated");
        };
      });
    }

    /* Characters: your saved outfits, like Roblox's Characters tab */
    const outfitBody = (name) => {
      const a = st.avatar;
      return { name, bodyColors: a.bodyColors, assetIds: (a.assets || []).map((x) => x.id), scale: a.scales, playerAvatarType: a.playerAvatarType };
    };
    async function outfits(body) {
      body.innerHTML = `<div class="rg-loading">Loading your characters…</div>`;
      let list = [];
      try {
        const get = (v) => R.api(`${AV}/${v}/users/${me.id}/outfits?page=1&itemsPerPage=50&isEditable=true`);
        const d = await get("v2/avatar").catch(() => get("v1"));
        list = d.data || [];
      } catch (e) { body.innerHTML = R.errBox(e); return; }
      const th = {};
      try {
        for (const c of R.chunks(list.map((o) => o.id), 100)) {
          const d = await R.api(`https://thumbnails.roblox.com/v1/users/outfits?userOutfitIds=${c.join(",")}&size=150x150&format=Png&isCircular=false`);
          (d.data || []).forEach((t) => (th[t.targetId] = t.imageUrl));
        }
      } catch (e) { /* thumbnails optional */ }
      body.innerHTML = `<div class="av-outfits"><button class="av-outfit av-new" type="button"><span class="av-ot"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span><b>Create</b><small>Save what you're wearing</small></button>
        ${list.map((o) => `<div class="av-outfit" data-id="${o.id}" data-name="${R.esc(o.name)}" role="button" tabindex="0"><span class="av-ot">${th[o.id] ? `<img src="${R.esc(th[o.id])}" alt="">` : ""}</span><b>${R.esc(o.name)}</b>
          <button class="av-omenu" type="button" aria-label="Options for ${R.esc(o.name)}"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button></div>`).join("")}</div>
        <p class="rg-note">Click a character to wear it. Use the three dots to update it with what you're wearing now, rename it or delete it.</p>`;
      body.querySelector(".av-new").onclick = async (e) => {
        const name = await R.ask(e.currentTarget, { title: "Name this character", value: `Character ${list.length + 1}`, ok: "Create" });
        if (!name) return;
        try {
          await R.api(`${AV}/v1/outfits/create`, { method: "POST", body: outfitBody(name.trim().slice(0, 50)) })
            .catch(() => R.api(`${AV}/v2/outfits/create`, { method: "POST", body: { ...outfitBody(name.trim().slice(0, 50)), assets: (st.avatar.assets || []).map((x) => ({ id: x.id, ...(x.meta ? { meta: x.meta } : {}) })) } }));
          R.toast(`Saved “${name.trim()}”`); outfits(body);
        } catch (err) { R.toast("Couldn't save: " + err.message); }
      };
      body.querySelectorAll(".av-outfit[data-id]").forEach((card) => {
        const id = Number(card.dataset.id), name = card.dataset.name;
        card.onclick = (e) => { if (!e.target.closest(".av-omenu")) wearOutfit(id, name); };
        card.onkeydown = (e) => { if (e.key === "Enter") wearOutfit(id, name); };
        card.querySelector(".av-omenu").onclick = (e) => { e.stopPropagation(); outfitMenu(e.currentTarget, id, name, body); };
      });
    }
    function outfitMenu(anchor, id, name, body) {
      document.querySelector(".av-menu")?.remove();
      const m = R.h(`<div class="av-menu" role="menu"><button data-a="update" role="menuitem">Update with current look</button><button data-a="rename" role="menuitem">Rename</button><button data-a="delete" role="menuitem" class="danger">Delete</button></div>`);
      document.body.appendChild(m);
      const r = anchor.getBoundingClientRect();
      m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 8) + "px"; m.style.top = r.bottom + 4 + scrollY + "px";
      const off = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("mousedown", off, true); } };
      setTimeout(() => document.addEventListener("mousedown", off, true));
      m.onclick = async (e) => {
        const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
        m.remove();
        try {
          if (a === "update") {
            if (!(await R.confirm(`Update “${name}”?`, "It will be saved with what you're wearing right now.", "Update"))) return;
            await R.api(`${AV}/v1/outfits/${id}`, { method: "PATCH", body: outfitBody(name) });
            R.toast(`Updated “${name}”`);
          } else if (a === "rename") {
            const n = await R.ask(anchor, { title: "Rename character", value: name, ok: "Rename" });
            if (!n || n.trim() === name) return;
            await R.api(`${AV}/v1/outfits/${id}`, { method: "PATCH", body: { name: n.trim().slice(0, 50) } });
            R.toast("Renamed");
          } else if (a === "delete") {
            if (!(await R.confirm(`Delete “${name}”?`, "This removes the saved character from your account. Items you own aren't affected.", "Delete", true))) return;
            await R.api(`${AV}/v1/outfits/${id}/delete`, { method: "POST", body: {} });
            R.toast(`Deleted “${name}”`);
          }
          outfits(body);
        } catch (err) { R.toast("Roblox didn't accept that: " + err.message); }
      };
    }

    /* Bodies and animation packs (bundles you own): wearing one only swaps the parts it contains, like on Roblox */
    async function bundles(body, kind) {
      body.innerHTML = `<div class="rg-loading">Loading…</div>`;
      let list = [];
      try {
        let cursor = "";
        for (let i = 0; i < 5; i++) {
          const d = await R.api(`https://catalog.roblox.com/v1/users/${me.id}/bundles?limit=100&sortOrder=Desc${cur(cursor)}`);
          list.push(...(d.data || []).filter((b) => (b.bundleType || "") === kind || (kind === "BodyParts" && /body|character/i.test(b.bundleType || ""))));
          cursor = d.nextPageCursor || ""; if (!cursor) break;
        }
      } catch (e) { body.innerHTML = R.errBox(e); return; }
      if (st.q) list = list.filter((b) => b.name.toLowerCase().includes(st.q.toLowerCase()));
      if (!list.length) { body.innerHTML = `<div class="rg-empty">${kind === "BodyParts" ? "You don't own any bodies yet." : "You don't own any animation packs yet."}</div>`; return; }
      body.innerHTML = `<div class="av-grid">${list.map((b) => `<button class="av-item" data-bundle="${b.id}" title="${R.esc(b.name)}"><span class="av-ith"><img data-thumb="bundle:${b.id}" alt=""></span><span class="av-itn">${R.esc(b.name)}</span></button>`).join("")}</div>`;
      R.fillThumbs(body);
      body.querySelectorAll("[data-bundle]").forEach((b) => (b.onclick = () => wearBundle(Number(b.dataset.bundle), b.title)));
    }
    async function wearBundle(id, name) {
      try {
        const d = await R.api(`https://catalog.roblox.com/v1/bundles/${id}/details`);
        const outfit = (d.items || []).find((i) => i.type === "UserOutfit");
        let parts = [];
        if (outfit) {
          const o = await R.api(`${AV}/v3/outfits/${outfit.id}/details`).catch(() => R.api(`${AV}/v1/outfits/${outfit.id}/details`));
          parts = (o.assets || []).map((a) => ({ id: a.id, name: a.name, assetType: a.assetType }));
        } else parts = (d.items || []).filter((i) => i.type === "Asset").map((i) => ({ id: i.id, name: i.name, assetType: { name: "" } }));
        const types = new Set(parts.map(typeName).filter(Boolean));
        const keep = worn().filter((a) => !types.has(typeName(a)));
        apply([...keep, ...parts]);
        R.toast(`Wearing “${name}”`);
      } catch (e) { R.toast("Couldn't wear that: " + e.message); }
    }

    /* Advanced: wear anything you own by its ID (same as Roblox's Advanced box) */
    function advanced(body) {
      body.innerHTML = `<div class="av-adv"><div class="rg-h3" style="margin-top:0">Wear by ID</div>
        <p class="rg-note" style="margin:0 0 12px">Paste an item ID or catalog link for anything you own, like a hat, hair or accessory.</p>
        <div class="rg-row"><input class="rg-input av-advin" placeholder="e.g. 48474313 or a roblox.com/catalog link" style="flex:1;min-width:220px"><button class="btn-primary-md av-advgo" type="button">Wear</button></div></div>`;
      const go = async () => {
        const m = (body.querySelector(".av-advin").value.match(/\d{3,}/) || [])[0];
        if (!m) return R.toast("That doesn't look like an item ID");
        try {
          const d = await R.api(`https://economy.roblox.com/v2/assets/${m}/details`);
          const type = TYPE_BY_ID[d.AssetTypeId] || "";
          if (!type) return R.toast("That item can't be worn");
          await toggle(Number(m), d.Name || "Item", type);
        } catch (e) { R.toast("Couldn't find that item: " + e.message); }
      };
      body.querySelector(".av-advgo").onclick = go;
      body.querySelector(".av-advin").onkeydown = (e) => { if (e.key === "Enter") go(); };
    }

    /* Emotes: eight slots, like Roblox's emote wheel */
    async function emotes(body) {
      body.innerHTML = `<div class="rg-loading">Loading emotes…</div>`;
      let slots = [], mine = [];
      try {
        const [eq, inv] = await Promise.all([
          R.api(`${AV}/v1/emotes`),
          R.api(`https://inventory.roblox.com/v2/users/${me.id}/inventory?assetTypes=EmoteAnimation&limit=100&sortOrder=Desc`)
        ]);
        slots = Array.isArray(eq) ? eq : eq.data || [];
        mine = (inv.data || []).map((x) => ({ id: x.assetId, name: x.assetName }));
      } catch (e) { body.innerHTML = R.errBox(e); return; }
      let pickSlot = [1, 2, 3, 4, 5, 6, 7, 8].find((n) => !slots.some((x) => x.position === n)) || 1;
      const draw = () => {
        const at = (n) => slots.find((x) => x.position === n);
        body.innerHTML = `<div class="av-eslots">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => { const e = at(n); return `<div class="av-eslot ${n === pickSlot ? "on" : ""}" data-n="${n}" role="button" tabindex="0" title="Slot ${n}">
            <span class="av-en">${n}</span>${e ? `<img data-thumb="asset:${e.assetId}" alt=""><small>${R.esc(e.assetName || "")}</small><button class="av-ex" data-x="${n}" aria-label="Remove from slot ${n}">${XICON}</button>` : `<small class="rg-mute">Empty</small>`}</div>`; }).join("")}</div>
          <p class="rg-note" style="margin:6px 0 14px">Pick a slot, then click an emote to put it there.</p>
          ${mine.length ? `<div class="av-grid">${mine.filter((m) => !st.q || m.name.toLowerCase().includes(st.q.toLowerCase())).map((m) => `<button class="av-item ${slots.some((x) => x.assetId === m.id) ? "on" : ""}" data-emote="${m.id}" title="${R.esc(m.name)}"><span class="av-ith"><img data-thumb="asset:${m.id}" alt=""></span><span class="av-itn">${R.esc(m.name)}</span><i class="av-check">${CHECK}</i></button>`).join("")}</div>` : `<div class="rg-empty">You don't own any emotes yet. Get some in the Marketplace.</div>`}`;
        R.fillThumbs(body);
        body.querySelectorAll(".av-eslot").forEach((el) => (el.onclick = (e) => { if (e.target.closest("[data-x]")) return; pickSlot = Number(el.dataset.n); draw(); }));
        body.querySelectorAll("[data-x]").forEach((b) => (b.onclick = async (e) => {
          e.stopPropagation();
          const n = Number(b.dataset.x);
          try { await R.api(`${AV}/v1/emotes/${n}`, { method: "DELETE" }); slots = slots.filter((x) => x.position !== n); pickSlot = n; draw(); } catch (err) { R.toast(err.message); }
        }));
        body.querySelectorAll("[data-emote]").forEach((b) => (b.onclick = async () => {
          const id = Number(b.dataset.emote), m = mine.find((x) => x.id === id);
          try {
            await R.api(`${AV}/v1/emotes/${id}/${pickSlot}`, { method: "POST", body: {} });
            slots = slots.filter((x) => x.position !== pickSlot && x.assetId !== id).concat([{ assetId: id, assetName: m.name, position: pickSlot }]);
            R.toast(`${m.name} is in slot ${pickSlot}`);
            pickSlot = [1, 2, 3, 4, 5, 6, 7, 8].find((n) => !slots.some((x) => x.position === n)) || pickSlot;
            draw();
          } catch (err) { R.toast("Couldn't equip: " + err.message); }
        }));
      };
      draw();
    }

    async function wearOutfit(id, name) {
      if (st.busy) return;
      setBusy(true);
      const prev = $(".av-img").src;
      try {
        const d = await R.api(`${AV}/v3/outfits/${id}/details`).catch(() => R.api(`${AV}/v1/outfits/${id}/details`));
        const assets = (d.assets || []).map((a) => ({ id: a.id, name: a.name, assetType: a.assetType, meta: a.meta }));
        st.undo.push(snap(worn())); $(".av-undo").disabled = false; st.want = null;
        await R.api(`${AV}/v2/avatar/set-wearing-assets`, { method: "POST", body: { assets: assets.map((a) => ({ id: a.id, ...(a.meta ? { meta: a.meta } : {}) })) } });
        const bc = d.bodyColors;
        if (bc && bc.headColorId) await R.api(`${AV}/v1/avatar/set-body-colors`, { method: "POST", body: bc }).catch(() => {});
        if (d.scale) await R.api(`${AV}/v1/avatar/set-scales`, { method: "POST", body: d.scale }).catch(() => {});
        if (d.playerAvatarType && d.playerAvatarType !== st.avatar.playerAvatarType) await R.api(`${AV}/v1/avatar/set-player-avatar-type`, { method: "POST", body: { playerAvatarType: d.playerAvatarType } }).catch(() => {});
        await loadAvatar(); paintLeft(); loadThumb(prev);
        R.toast(`Wearing “${name}”`);
        if (st.cat === "characters") outfits($(".av-body"));
      } catch (e) { R.toast(e.message); }
      setBusy(false);
    }

    /* ---------- Marketplace ---------- */
    const TYPE_BY_ID = { 2: "TShirt", 8: "Hat", 11: "Shirt", 12: "Pants", 17: "Head", 18: "Face", 27: "Torso", 28: "RightArm", 29: "LeftArm", 30: "LeftLeg", 31: "RightLeg", 41: "HairAccessory", 42: "FaceAccessory", 43: "NeckAccessory", 44: "ShoulderAccessory", 45: "FrontAccessory", 46: "BackAccessory", 47: "WaistAccessory", 48: "ClimbAnimation", 50: "FallAnimation", 51: "IdleAnimation", 52: "JumpAnimation", 53: "RunAnimation", 54: "SwimAnimation", 55: "WalkAnimation", 64: "TShirtAccessory", 65: "ShirtAccessory", 66: "PantsAccessory", 67: "JacketAccessory", 68: "SweaterAccessory", 69: "ShortsAccessory", 70: "LeftShoeAccessory", 71: "RightShoeAccessory", 72: "DressSkirtAccessory", 76: "EyebrowAccessory", 77: "EyelashAccessory", 78: "MoodAnimation", 19: "Gear", 79: "DynamicHead", 61: "EmoteAnimation" };
    const WEARABLE = new Set(Object.values(TYPE_BY_ID).filter((t) => t !== "EmoteAnimation"));
    const typeFromCatalog = (i) => (typeof i.assetType === "string" ? i.assetType : i.assetType && typeof i.assetType === "object" ? i.assetType.name : TYPE_BY_ID[i.assetType]) || "";
    const MCATS = [["All", {}], ["Clothing", { Category: 3 }], ["Accessories", { Category: 11 }], ["Body", { Category: 4 }], ["Animations", { Category: 12 }], ["Limiteds", { Category: 2 }]];
    const PRICES = [["Any price", {}], ["Free", { MinPrice: 0, MaxPrice: 0 }], ["Under R$100", { MaxPrice: 100 }], ["Under R$500", { MaxPrice: 500 }], ["Under R$1,000", { MaxPrice: 1000 }], ["R$1,000+", { MinPrice: 1000 }]];
    const mk = { cat: 0, sort: "0", price: 0, offsale: false, items: [], byId: new Map(), cursor: "", done: false, loading: false, tok: 0, owned: new Map(), bal: null, balLoaded: false };

    const isLimited = (i) => (i.itemRestrictions || []).some((r) => /limited|collectible/i.test(r));
    const priceOf = (i) => (i.priceStatus === "Off Sale" || i.price == null ? (i.lowestPrice ? i.lowestPrice : null) : i.price);
    const priceText = (i) => { const p = priceOf(i); return p == null ? `<span class="rg-mute">Off sale</span>` : p === 0 ? "Free" : `<i class="rg-rbx-ic" aria-hidden="true"></i>${R.fmt(p)}`; };
    const forSale = (i) => i.priceStatus !== "Off Sale" && i.price != null;

    function actHTML(i) {
      if (i.itemType !== "Asset") return `<a class="btn-control-sm" href="https://www.roblox.com/bundles/${i.id}" target="_blank">View bundle</a>`;
      const type = typeFromCatalog(i);
      const owned = mk.owned.get(i.id);
      if (owned) {
        if (!WEARABLE.has(type)) return `<span class="rg-badge good">Owned</span>`;
        return wornIds().has(i.id) ? `<button class="btn-control-sm mk-act" data-act="wear" data-id="${i.id}">Take off</button>` : `<button class="btn-primary-sm mk-act" data-act="wear" data-id="${i.id}">Wear</button>`;
      }
      if (owned === undefined && i.itemType === "Asset") return `<button class="btn-control-sm" disabled>…</button>`;
      if (isLimited(i)) return `<a class="btn-control-sm" href="https://www.roblox.com/catalog/${i.id}" target="_blank">${i.lowestPrice ? `Resale R$${R.fmt(i.lowestPrice)}` : "View"}</a>`;
      if (forSale(i)) return `<button class="btn-primary-sm mk-act" data-act="buy" data-id="${i.id}">${i.price === 0 ? "Get" : `Buy R$${R.fmt(i.price)}`}</button>`;
      return `<a class="btn-control-sm" href="https://www.roblox.com/catalog/${i.id}" target="_blank">View</a>`;
    }
    const cardHTML = (i) => {
      const asset = i.itemType === "Asset";
      const tag = isLimited(i) ? `<span class="mk-tag">Limited</span>` : "";
      return `<div class="av-citem" data-id="${i.id}"><a href="https://www.roblox.com/${asset ? "catalog" : "bundles"}/${i.id}" target="_blank" class="av-cimg">${asset ? `<img data-thumb="asset:${i.id}" alt="">` : `<span>Bundle</span>`}${tag}</a>
        <span class="av-cn" title="${R.esc(i.name)}">${R.esc(i.name)}</span>
        <span class="av-cp">${priceText(i)}</span>${i.creatorName ? `<span class="av-cc">By ${R.esc(i.creatorName)}${i.creatorHasVerifiedBadge ? "" : ""}</span>` : ""}
        <div class="mk-slot">${actHTML(i)}</div></div>`;
    };
    const repaint = (id) => {
      const i = mk.byId.get(id);
      const slot = main.querySelector(`.av-citem[data-id="${id}"] .mk-slot`);
      if (i && slot) slot.innerHTML = actHTML(i);
    };

    async function loadBalance() {
      try { mk.bal = (await R.api(`https://economy.roblox.com/v1/users/${me.id}/currency`)).robux; } catch (e) { /* optional */ }
      const el = main.querySelector(".mk-bal");
      if (el && mk.bal != null) el.innerHTML = `You have ${R.robux(mk.bal)}`;
    }

    // Which of these do I already own? (checked a few at a time so Roblox doesn't rate-limit us)
    async function checkOwned(items) {
      const need = items.filter((i) => i.itemType === "Asset" && !mk.owned.has(i.id));
      let k = 0;
      const worker = async () => {
        while (k < need.length && alive()) {
          const i = need[k++];
          try {
            const r = await R.api(`https://inventory.roblox.com/v1/users/${me.id}/items/Asset/${i.id}/is-owned`);
            mk.owned.set(i.id, r === true || r === "true");
          } catch (e) { mk.owned.set(i.id, false); }
          repaint(i.id);
          await R.sleep(60);
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
    }

    function marketView(body) {
      body.innerHTML = `<div class="rg-row space" style="margin-bottom:10px"><div class="rg-chips mk-cats">${MCATS.map((c, i) => `<button class="rg-chip ${i === mk.cat ? "on" : ""}" data-mc="${i}">${c[0]}</button>`).join("")}</div><span class="mk-bal rg-mute" style="font-size:14px;font-weight:600"></span></div>
        <div class="rg-row" style="margin-bottom:12px">
          <select class="rg-select mk-sort"><option value="0">Relevance</option><option value="1">Most favorited</option><option value="2">Best selling</option><option value="3">Recently updated</option><option value="4">Price: low to high</option><option value="5">Price: high to low</option></select>
          <select class="rg-select mk-price">${PRICES.map((p, i) => `<option value="${i}">${p[0]}</option>`).join("")}</select>
          <label class="rg-check"><input type="checkbox" class="mk-off"> Include off-sale</label></div>
        <div class="mk-out"></div>
        <p class="rg-note">You can wear anything you own straight from here. Buying asks you to confirm first. Limiteds open their Roblox page for resale.</p>`;
      body.querySelector(".mk-sort").value = mk.sort;
      body.querySelector(".mk-price").value = String(mk.price);
      body.querySelector(".mk-off").checked = mk.offsale;
      body.querySelector(".mk-cats").onclick = (e) => { const b = e.target.closest("[data-mc]"); if (!b) return; mk.cat = Number(b.dataset.mc); body.querySelectorAll(".mk-cats .rg-chip").forEach((c) => c.classList.toggle("on", c === b)); marketSearch(true); };
      body.querySelector(".mk-sort").onchange = (e) => { mk.sort = e.target.value; marketSearch(true); };
      body.querySelector(".mk-price").onchange = (e) => { mk.price = Number(e.target.value); marketSearch(true); };
      body.querySelector(".mk-off").onchange = (e) => { mk.offsale = e.target.checked; marketSearch(true); };
      body.querySelector(".mk-out").addEventListener("click", (e) => {
        if (e.target.closest(".mk-more")) return marketSearch(false);
        const b = e.target.closest(".mk-act"); if (!b) return;
        const id = Number(b.dataset.id);
        b.dataset.act === "buy" ? buyItem(id) : wearFromMarket(id);
      });
      if (mk.bal != null) body.querySelector(".mk-bal").innerHTML = `You have ${R.robux(mk.bal)}`; else loadBalance();
      marketSearch(true);
    }

    async function marketSearch(reset) {
      const out = main.querySelector(".mk-out");
      if (!out) return;
      if (reset) { mk.items = []; mk.cursor = ""; mk.done = false; mk.loading = false; }
      if (mk.loading || mk.done) return;
      const tok = ++mk.tok;
      mk.loading = true;
      const more = out.querySelector(".mk-more");
      if (more) more.textContent = "Loading…"; else if (!mk.items.length) out.innerHTML = `<div class="rg-loading">Searching…</div>`;
      const build = (ver, withCat) => {
        const q = new URLSearchParams({ Limit: "30", SortType: mk.sort, IncludeNotForSale: String(mk.offsale), SalesTypeFilter: "1" });
        if (st.q) q.set("Keyword", st.q);
        if (ver === "v1" && !st.q) q.set("Keyword", "");
        Object.entries({ ...(withCat ? MCATS[mk.cat][1] : {}), ...PRICES[mk.price][1] }).forEach(([k, v]) => q.set(k, v));
        if (mk.cursor) q.set("Cursor", mk.cursor);
        return `https://catalog.roblox.com/${ver}/search/items/details?${q}`;
      };
      let d;
      try {
        // Roblox moved catalog search to v2; v1 still answers on some accounts
        const tries = [["v2", true], ["v1", true]];
        if (mk.cat) tries.push(["v2", false]);
        let err = null;
        for (const [ver, withCat] of tries) {
          try { d = await R.api(build(ver, withCat)); if (d && Array.isArray(d.data)) break; } catch (e) { err = e; d = null; }
        }
        if (!d) throw err || new Error("Roblox didn't answer");
      } catch (e) {
        if (tok === mk.tok) { mk.loading = false; if (out.isConnected) out.innerHTML = R.errBox(e); }
        return;
      }
      if (tok !== mk.tok || !out.isConnected) { if (tok === mk.tok) mk.loading = false; return; }
      const fresh = (d.data || []).filter((i) => !mk.items.some((x) => x.id === i.id));
      fresh.forEach((i) => { mk.byId.set(i.id, i); mk.items.push(i); });
      mk.cursor = d.nextPageCursor || "";
      mk.done = !mk.cursor;
      mk.loading = false;
      out.innerHTML = mk.items.length ? `<div class="av-grid av-cgrid">${mk.items.map(cardHTML).join("")}</div>${!mk.done ? `<div class="rg-row" style="justify-content:center;margin-top:14px"><button class="btn-control-md mk-more">Load more</button></div>` : ""}` : `<div class="rg-empty">Nothing found${st.q ? ` for “${R.esc(st.q)}”` : ""}.</div>`;
      R.fillThumbs(out);
      checkOwned(fresh);
    }

    async function wearFromMarket(id) {
      const i = mk.byId.get(id);
      if (!i) return;
      await toggle(id, i.name, typeFromCatalog(i));
      mk.items.forEach((x) => repaint(x.id));
    }

    async function buyItem(id) {
      const i = mk.byId.get(id);
      if (!i || st.busy) return;
      const slot = main.querySelector(`.av-citem[data-id="${id}"] .mk-slot`);
      const restore = () => slot && (slot.innerHTML = actHTML(i));
      if (slot) slot.innerHTML = `<button class="btn-control-sm" disabled>Checking…</button>`;
      let d;
      try { d = await R.api(`https://economy.roblox.com/v2/assets/${id}/details`); }
      catch (e) { R.toast("Couldn't check that item: " + e.message); restore(); return; }
      if (!d.IsForSale || d.IsLimited || d.IsLimitedUnique) { restore(); window.open(`https://www.roblox.com/catalog/${id}`, "_blank"); return; }
      const price = d.PriceInRobux || 0;
      if (mk.bal == null) await loadBalance();
      if (price > 0 && mk.bal != null && mk.bal < price) { R.toast(`You need R$${R.fmt(price - mk.bal)} more Robux`); restore(); return; }
      const ok = await R.confirm(price ? `Buy “${i.name}”?` : `Get “${i.name}”?`,
        price ? `This costs <b>R$${R.fmt(price)}</b>${mk.bal != null ? `. You have R$${R.fmt(mk.bal)}, so you'll have R$${R.fmt(mk.bal - price)} left` : ""}.` : "It's free.", price ? `Buy for R$${R.fmt(price)}` : "Get it");
      if (!ok) { restore(); return; }
      if (slot) slot.innerHTML = `<button class="btn-control-sm" disabled>Buying…</button>`;
      try {
        const r = await R.api(`https://economy.roblox.com/v1/purchases/products/${d.ProductId}`, { method: "POST", body: { expectedCurrency: 1, expectedPrice: price, expectedSellerId: d.Creator && d.Creator.Id } });
        if (r.purchased === false) {
          const why = { InsufficientFunds: "Not enough Robux", AlreadyOwned: "You already own this", PriceChanged: "The price changed, try again", NotForSale: "It's no longer for sale", PremiumOnly: "Roblox Premium members only" }[r.reason] || r.errorMsg || r.reason || "Roblox didn't complete the purchase";
          if (r.reason === "AlreadyOwned") mk.owned.set(id, true);
          R.toast(why); restore(); return;
        }
        mk.owned.set(id, true);
        // owned lists are out of date now
        Object.keys(inv).forEach((k) => delete inv[k]);
        loadBalance();
        R.toast(price ? `Bought “${i.name}” for R$${R.fmt(price)}` : `Got “${i.name}”`);
        repaint(id);
      } catch (e) { R.toast("Purchase failed: " + e.message); restore(); }
    }

    paintLeft();
    paintTabs();
    paintBody();
    loadThumb();
  };

  /* Replace Roblox's avatar page with this editor */
  R.route((p) => R.feat("avatarEditor") && /^\/my\/avatar/i.test(p), () => {
    const page = R.h(`<div class="rg-av-page rg-page-lite">
      <div class="rg-av-bar"><h1>Avatar</h1><span class="rg-mute rg-av-hint">Changes save to your Roblox account right away.</span><span style="flex:1"></span>
        <button class="btn-control-sm rg-av-classic">Use Roblox's editor</button></div>
      <div class="rg-av-mount"></div></div>`);
    const mount = page.querySelector(".rg-av-mount");
    const btn = page.querySelector(".rg-av-classic");
    let host = null, started = false, stopped = false;
    const setClassic = (on) => {
      host && host.classList.toggle("rg-av-classic-on", on);
      btn.textContent = on ? "Use RoGen's editor" : "Use Roblox's editor";
      page.querySelector(".rg-av-hint").hidden = on;
    };
    btn.onclick = async () => {
      const on = !(host && host.classList.contains("rg-av-classic-on"));
      setClassic(on);
      R.set({ avClassic: on });
    };
    const place = () => {
      if (stopped) return;
      const h = document.querySelector("#container-main > .content") || document.querySelector("#container-main");
      if (!h) return;
      host = h;
      h.classList.add("rg-av-host");
      if (!h.contains(page)) h.insertAdjacentElement("afterbegin", page);
      if (!started) {
        started = true;
        R.get1("avClassic", false).then((c) => setClassic(!!c));
        Promise.resolve(R.avatarEditor(mount)).catch((e) => (mount.innerHTML = R.errBox(e)));
      }
    };
    place();
    return { tick: place, stop: () => { stopped = true; page.remove(); host && host.classList.remove("rg-av-host", "rg-av-classic-on"); } };
  });
})();
