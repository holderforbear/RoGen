const open = (view) => chrome.runtime.sendMessage({ type: "openRogen", view }, () => window.close());
const $ = (id) => document.getElementById(id);

$("ver").textContent = "v" + chrome.runtime.getManifest().version;

chrome.storage.local.get(["myName", "myId", "myDisplayName"], (s) => {
  if (!s.myId) return;
  $("dn").textContent = s.myDisplayName || s.myName || "You";
  $("un").textContent = "@" + (s.myName || s.myId);
  $("me").onclick = (e) => { e.preventDefault(); chrome.tabs.create({ url: `https://www.roblox.com/users/${s.myId}/profile` }); window.close(); };
  fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${s.myId}&size=150x150&format=Png&isCircular=false`)
    .then((r) => r.json()).then((d) => { const u = d.data && d.data[0] && d.data[0].imageUrl; if (u) $("av").src = u; }).catch(() => {});
});
document.querySelectorAll(".grid button").forEach((b) => (b.onclick = () => open(b.dataset.v)));
$("open").onclick = () => open("dashboard");
$("settings").onclick = (e) => { e.preventDefault(); open("settings"); };
