// RoGen saved data: notes, bookmarks (folders), recently viewed, watchlist, compare list
(() => {
  const R = window.Rogen;

  /* ---------- recently viewed ---------- */
  R.recent = {
    async add(entry) {
      const list = (await R.get1("recent", [])).filter((e) => !(e.kind === entry.kind && e.id === entry.id));
      list.unshift({ ...entry, at: Date.now() });
      await R.set({ recent: list.slice(0, 150) });
    },
    all: () => R.get1("recent", [])
  };

  /* ---------- notes ---------- */
  R.notes = {
    key: (kind, id) => `${kind}:${id}`,
    async get(kind, id) { return (await R.get1("notes", {}))[`${kind}:${id}`] || null; },
    async set(kind, id, text, label) {
      const all = await R.get1("notes", {});
      if (text.trim()) all[`${kind}:${id}`] = { text, label, at: Date.now(), url: location.href.split("#")[0] };
      else delete all[`${kind}:${id}`];
      await R.set({ notes: all });
    },
    all: () => R.get1("notes", {})
  };
  // Notes pane with autosave
  R.notesPane = async (pane, kind, id, label) => {
    const n = await R.notes.get(kind, id);
    pane.innerHTML = `<textarea class="rg-textarea" placeholder="Private notes, only saved in your browser…">${R.esc(n ? n.text : "")}</textarea>
      <div class="rg-note">${n ? "Last saved " + R.ago(n.at) : "Notes save automatically."}</div>`;
    const ta = pane.querySelector("textarea");
    let h;
    ta.oninput = () => {
      clearTimeout(h);
      h = setTimeout(async () => {
        await R.notes.set(kind, id, ta.value, label);
        pane.querySelector(".rg-note").textContent = "Saved";
      }, 500);
    };
  };

  /* ---------- bookmarks with folders ---------- */
  R.bookmarks = {
    async all() { return R.get1("bookmarks", { Favorites: [] }); },
    async add(folder, item) {
      const b = await R.bookmarks.all();
      b[folder] = (b[folder] || []).filter((x) => x.id !== item.id);
      b[folder].unshift({ ...item, at: Date.now() });
      await R.set({ bookmarks: b });
    },
    async remove(folder, id) {
      const b = await R.bookmarks.all();
      b[folder] = (b[folder] || []).filter((x) => x.id !== id);
      await R.set({ bookmarks: b });
    },
    async folders() { return Object.keys(await R.bookmarks.all()); },
    async createFolder(name) {
      const b = await R.bookmarks.all();
      if (!b[name]) b[name] = [];
      await R.set({ bookmarks: b });
    },
    async deleteFolder(name) {
      const b = await R.bookmarks.all();
      delete b[name];
      if (!Object.keys(b).length) b.Favorites = [];
      await R.set({ bookmarks: b });
    },
    async foldersWith(id) {
      const b = await R.bookmarks.all();
      return Object.keys(b).filter((f) => b[f].some((x) => x.id === id));
    }
  };
  // Bookmark button + folder picker
  R.bookmarkControl = async (wrap, item) => {
    const draw = async () => {
      const folders = await R.bookmarks.folders();
      const inF = await R.bookmarks.foldersWith(item.id);
      wrap.innerHTML = `<div class="rg-row">
        <select class="rg-select rg-bm-folder">${folders.map((f) => `<option>${R.esc(f)}</option>`).join("")}<option value="__new">+ New folder…</option></select>
        <button class="btn-primary-sm rg-bm-add">Save</button>
        ${inF.length ? `<span class="rg-mute" style="font-size:13px">Saved in: ${inF.map((f) => `<span class="rg-badge acc">${R.esc(f)} <button class="rg-link rg-bm-rm" data-f="${R.esc(f)}" title="Remove">✕</button></span>`).join(" ")}</span>` : ""}
      </div>`;
      wrap.querySelector(".rg-bm-add").onclick = async () => {
        let f = wrap.querySelector(".rg-bm-folder").value;
        if (f === "__new") {
          f = (prompt("Folder name") || "").trim();
          if (!f) return;
          await R.bookmarks.createFolder(f);
        }
        await R.bookmarks.add(f, item);
        R.toast(`Saved to ${f}`);
        draw();
      };
      wrap.querySelectorAll(".rg-bm-rm").forEach((b) => (b.onclick = async () => { await R.bookmarks.remove(b.dataset.f, item.id); draw(); }));
    };
    draw();
  };

  /* ---------- watchlist (alerts handled in background) ---------- */
  R.watch = {
    async games() { return R.get1("watchGames", {}); },
    async items() { return R.get1("watchItems", {}); },
    async setGame(uid, data) {
      const w = await R.watch.games();
      if (data) w[uid] = { ...(w[uid] || {}), ...data };
      else delete w[uid];
      await R.set({ watchGames: w });
    },
    async setItem(aid, data) {
      const w = await R.watch.items();
      if (data) w[aid] = { ...(w[aid] || {}), ...data };
      else delete w[aid];
      await R.set({ watchItems: w });
    }
  };

  /* ---------- compare list (items) ---------- */
  R.compare = {
    all: () => R.get1("compareItems", []),
    async toggle(item) {
      let list = await R.compare.all();
      const has = list.some((x) => x.id === item.id);
      list = has ? list.filter((x) => x.id !== item.id) : [...list, item].slice(-8);
      await R.set({ compareItems: list });
      return !has;
    }
  };

})();
