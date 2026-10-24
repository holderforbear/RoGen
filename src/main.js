// RoGen router: runs the right feature for the current Roblox page and keeps it mounted
(() => {
  const R = window.Rogen;
  let active = [];
  let lastKey = "";
  let queued = false;

  const path = () => (location.pathname.replace(/\/+$/, "") || "/").toLowerCase();

  function route() {
    const k = path();
    if (k === lastKey) return;
    lastKey = k;
    active.forEach((a) => { try { a.stop && a.stop(); } catch (e) { /* ignore */ } });
    active = R.routes.filter((r) => R.feat(r.key) && r.test(k)).map((r) => {
      try { return r.fn() || {}; } catch (e) { console.warn("RoGen:", e); return {}; }
    });
  }

  function tick() {
    queued = false;
    route();
    R.look.addNav();
    R.applyMe && R.applyMe();
    R.applyThemeAttr();
    active.forEach((a) => { try { a.tick && a.tick(); } catch (e) { /* keep going */ } });
  }
  const schedule = () => {
    if (queued) return;
    queued = true;
    setTimeout(tick, 150);
  };

  function boot() {
    const me = R.me();
    if (me) {
      R.set({ myId: me.id, myName: me.name, myDisplayName: me.displayName });
      // Check for unadds right here using your Roblox login (at most every 10 minutes)
      R.checkFriends().then((r) => r && r.removed && R.toast(`${r.removed} ${r.removed === 1 ? "person" : "people"} unadded you`));
    }
    tick();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", schedule);
    window.addEventListener("hashchange", schedule);
  }

  // turning a feature on or off in Settings takes effect straight away
  R.onFeatures = () => { lastKey = ""; schedule(); };
  const start = () => R.featReady.then(boot);
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
