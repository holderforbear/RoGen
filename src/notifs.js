// Unadds inside Roblox's own bell notifications panel
(() => {
  const R = window.Rogen;
  const RECENT_DAYS = 30;
  const MAX_CARDS = 5;

  // "Oct 13, 2026 | 7:57 PM" — same format Roblox uses in the panel
  const stamp = (t) => {
    const d = new Date(t);
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} | ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  };

  async function list() {
    const { unadded = [], hiddenNotifs = [] } = await R.get(["unadded", "hiddenNotifs"]);
    const hidden = new Set(hiddenNotifs);
    return unadded.filter((u) => !u.byMe && !hidden.has(`${u.id}:${u.at}`) && Date.now() - u.at < RECENT_DAYS * 864e5).slice(0, MAX_CARDS);
  }

  // Copy the look of Roblox's real cards/buttons in the panel, so ours match exactly
  function matchLook(group, base) {
    const card = base.querySelector(".notification-card-tight, .sendr-notification-background > *");
    const btn = base.querySelector(".sendr-notification-button");
    const set = (k, v) => v && group.style.setProperty(k, v);
    if (card) {
      const cs = getComputedStyle(card);
      if (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)") set("--rg-n-bg", cs.backgroundColor);
      set("--rg-n-radius", cs.borderRadius !== "0px" ? cs.borderRadius : "");
      set("--rg-n-color", cs.color);
    }
    if (btn) {
      const bs = getComputedStyle(btn);
      if (bs.backgroundColor && bs.backgroundColor !== "rgba(0, 0, 0, 0)") set("--rg-nb-bg", bs.backgroundColor);
      set("--rg-nb-fg", bs.color);
      set("--rg-nb-radius", bs.borderRadius);
      set("--rg-nb-h", bs.height !== "auto" ? bs.height : "");
    }
  }

  function cardHTML(u) {
    return `<div class="rg-ncard" data-key="${u.id}:${u.at}">
      <a class="rg-ncard-media" href="https://www.roblox.com/users/${u.id}/profile"><img data-thumb="user:${u.id}" alt=""></a>
      <div class="rg-ncard-body">
        <div class="rg-ncard-title"><b>${R.esc(u.displayName)}</b> <span class="rg-ncard-at">@${R.esc(u.name)}</span> unadded you.</div>
        <div class="rg-ncard-time">${stamp(u.at)}${u.seen ? "" : ` <span class="rg-ncard-new">New</span>`}</div>
      </div>
      <button class="rg-ncard-x" title="Remove" aria-label="Remove">✕</button>
      <a class="rg-ncard-btn" href="https://www.roblox.com/users/${u.id}/profile">View Profile</a>
    </div>`;
  }

  R.route(() => R.feat("notifs") && true, () => {
    let group = null, lastKey = "", seenTimer = null;

    const render = async (base) => {
      const items = await list();
      const key = items.map((u) => `${u.id}:${u.at}:${u.seen ? 1 : 0}`).join(",");
      if (!items.length) { group && group.remove(); group = null; lastKey = ""; return; }
      if (!group) {
        group = R.h(`<div class="rg-notifs"></div>`);
        group.addEventListener("click", async (e) => {
          const x = e.target.closest(".rg-ncard-x");
          if (!x) return;
          e.preventDefault(); e.stopPropagation();
          const k = x.closest(".rg-ncard").dataset.key;
          const h = await R.get1("hiddenNotifs", []);
          await R.set({ hiddenNotifs: [...h, k].slice(-500) });
          lastKey = ""; render(base);
        });
      }
      if (key !== lastKey) {
        lastKey = key;
        group.innerHTML = `<div class="rg-notifs-label"><span>Unadded you</span><a href="https://www.roblox.com/rogen#friends">See all</a></div>` + items.map(cardHTML).join("");
        R.fillThumbs(group);
      }
      const header = base.querySelector(".notification-stream-header");
      if (!base.contains(group)) (header || base.firstElementChild || base).insertAdjacentElement(header ? "afterend" : "afterbegin", group);
      matchLook(group, base);
      // Opening the panel counts as seeing them
      if (items.some((u) => !u.seen) && !seenTimer) seenTimer = setTimeout(() => { seenTimer = null; R.send({ type: "markUnaddedSeen" }); markSeenLocal(); }, 2500);
    };

    const markSeenLocal = async () => {
      const u = await R.get1("unadded", []);
      u.forEach((x) => (x.seen = true));
      await R.set({ unadded: u });
    };

    // Red count on the bell when Roblox isn't already showing one
    const badge = async () => {
      const icon = document.querySelector(".notification-stream-icon, #navbar-stream, [class*='notification-stream-icon']");
      if (!icon) return;
      const unseen = (await list()).filter((u) => !u.seen).length;
      let ours = icon.querySelector(".rg-bell-badge");
      const robloxBadge = icon.querySelector(".bell-red-badge:not(.rg-bell-badge)");
      if (!unseen || robloxBadge) { ours && ours.remove(); return; }
      if (!ours) {
        ours = R.h(`<span class="notification-red notification bell-red-badge rg-bell-badge"></span>`);
        (icon.querySelector("button, a") || icon).appendChild(ours);
      }
      ours.textContent = unseen;
    };

    const tick = () => {
      const base = document.querySelector(".notification-stream-base");
      if (base && base.offsetParent !== null) render(base);
      badge();
    };
    const onChange = (ch) => { if (ch.unadded || ch.hiddenNotifs) { lastKey = ""; tick(); } };
    chrome.storage.onChanged.addListener(onChange);
    tick();
    return { tick, stop: () => { group && group.remove(); chrome.storage.onChanged.removeListener(onChange); clearTimeout(seenTimer); } };
  });
})();
