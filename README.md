# RoGen

A free Chrome extension that adds the things Roblox doesn't show you to roblox.com: who unadded you, what you've spent, playtime for you and your friends, game and player insights, a tracker that tells you when profiles, games or limiteds change, your inventory's value and profit, badges, Wrapped, a better avatar editor, quick find (Ctrl+K), themes and more. Every feature can be turned off in Settings.

**This is the full source code of the extension, exactly as it is installed.** Nothing is minified, bundled or hidden. Every file here is what runs in your browser.

- Install: [Chrome Web Store](https://chromewebstore.google.com/detail/rogen/alffelihaammoakndcdnpjnpbemmfpgg)
- Discord: [discord.gg/6tjgYJVu8](https://discord.gg/6tjgYJVu8)
- What changed in each version: [CHANGELOG.md](CHANGELOG.md)

## Is it safe?

You don't have to take our word for it. Here is everything RoGen can do, and where to see it in the code.

**It never asks for your password, and never sends your login anywhere.** RoGen runs on roblox.com and talks to Roblox the same way the Roblox website does, using the login you already have in your browser. Your login cookie is never read, copied or sent to any other site.

**The only websites it talks to:**

| Website | Why |
|---|---|
| `*.roblox.com` | Everything RoGen shows: friends, games, inventory, avatar, catalog, thumbnails. These are Roblox's own servers. |
| `gist.githubusercontent.com`, `raw.githubusercontent.com` | Downloads the public list of RoGen badges (a plain text list of Roblox user IDs) and, in the same file, short notices from the owner such as "a new version is out" or a feature switched off because a Roblox change broke it. |
| `api.github.com` | Only used by the RoGen owner to publish that badge list. Normal users never send anything here. |

You can check this yourself: search the code for `https://`. There are no analytics, no trackers, no ads, and no servers of our own.

**Permissions it asks Chrome for** (see [`manifest.json`](manifest.json)):

| Permission | Why |
|---|---|
| `storage`, `unlimitedStorage` | Saves your settings, playtime history and unadd list **in your own browser**. It stays on your computer. |
| `alarms` | Checks for unadds and tracks playtime every few minutes, and runs the Tracker every 30 minutes, while Chrome is open. |
| `notifications` | Shows "someone unadded you" and alert pop-ups. |
| Access to `roblox.com` | So it can add its features to Roblox's pages. |

**It doesn't modify or automate the game.** It only changes the roblox.com website in your browser.

## Check the store version matches this code

Install any "CRX viewer" extension, open RoGen's Chrome Web Store page and view its source. The files and the version number in `manifest.json` match the files here.

## Install from this code (developer mode)

1. Download this repository (green **Code** button, then **Download ZIP**) and unzip it.
2. Go to `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick the folder with `manifest.json` in it.

## Files

| Path | What it is |
|---|---|
| `manifest.json` | The extension's settings and permissions |
| `background.js` | Runs in the background: unadd checks, playtime tracking, notifications |
| `popup.html`, `popup.js`, `popup.css` | The small window when you click the RoGen icon |
| `src/` | Everything RoGen adds to roblox.com (one file per feature, e.g. `avatar.js`, `search.js`, `profile.js`) |
| `src/rogen.css` | All of RoGen's styles |
| `Badges.txt` | Who has which RoGen badge (Roblox user IDs) |
| `icons/` | Icons and badge images |

## License

All rights reserved. The code is public so you can check it's safe, not for copying or republishing. See [LICENSE](LICENSE).

Made by bear. Not affiliated with Roblox Corporation.
