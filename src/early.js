// Runs before Roblox's own scripts on roblox.com/rogen.
// Roblox's Charts app clears "#discover" etc. from the address while loading, so remember it first.
if (location.hash) document.documentElement.dataset.rgHash = location.hash;
