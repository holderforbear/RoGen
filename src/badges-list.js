// ============================================================================
//  RoGen advanced settings. To GIVE BADGES, just edit Badges.txt (in the RoGen folder).
// ============================================================================
//  HOW TO GIVE A BADGE
//   1. Find the person's USER ID (the number in their profile link: roblox.com/users/123456789/profile).
//   2. Add a line like:   "123456789": ["donator"],
//   3. Save the file, then press the 🔄 button on the RoGen card at chrome://extensions and refresh Roblox.
//
//  Badge names you can use (put as many as you want, in quotes, separated by commas):
//     "high-status"   "high-donator"   "friends-of-owner"   "donator"
//
//  To TAKE a badge away, delete it from the person's line (or delete the whole line).
//
//  Anyone who has THIS copy of RoGen sees these badges right away, with no setup.
//  Badges you give inside RoGen (Badges page) are added on top of this list.
// ============================================================================
(() => {
  const R = (window.Rogen = window.Rogen || {});

  R.BADGE_LIST = {};   // (old way) badges are now given in Badges.txt: just put the ID under the badge's heading

  // OPTIONAL: link to your published list, so people with an OLDER copy of RoGen still get new badges.
  // (RoGen → Badges → Go live for everyone gives you this link.) Leave "" if you don't use it.
  R.BADGE_FEED_URL = "";
})();
