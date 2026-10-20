const DISPLAY_NAMES = {
  "x.com": "X",
  "twitter.com": "X",
  "youtube.com": "YouTube",
  "music.youtube.com": "YouTube Music",
  "open.spotify.com": "Spotify",
  "reddit.com": "Reddit",
  "facebook.com": "Facebook",
  "web.whatsapp.com": "WhatsApp",
  "tiktok.com": "TikTok"
};

function canonical(host) {
  const h = host.toLowerCase();
  return h.startsWith("www.") ? h.slice(4) : h;
}

function parseSites(text) {
  const byKey = new Map();
  let name = null;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("!")) {
      const label = trimmed.slice(1).trim();
      name = label.startsWith("---") ? null : label;
      continue;
    }
    const sep = trimmed.indexOf("##");
    if (sep === -1) continue;
    const domain = trimmed.slice(0, sep).trim();
    const selector = trimmed.slice(sep + 2).trim();
    if (!domain || !selector) continue;

    const key = canonical(domain);
    if (!byKey.has(key)) {
      byKey.set(key, { key, name: DISPLAY_NAMES[key] || key, filters: [] });
    }
    const site = byKey.get(key);
    if (name || site.filters.length === 0) {
      site.filters.push({
        id: `${key}:${site.filters.length}`,
        name: name || `Filter ${site.filters.length + 1}`,
        selectors: []
      });
    }
    if (selector.startsWith("@behavior:")) {
      site.filters[site.filters.length - 1].behavior =
        selector.slice("@behavior:".length).trim();
    } else {
      site.filters[site.filters.length - 1].selectors.push(selector);
    }
    name = null;
  }
  return [...byKey.values()];
}

async function loadSites() {
  const res = await fetch(chrome.runtime.getURL("filters.txt"));
  const text = await res.text();

  const sites = parseSites(text);
  const stored = await chrome.storage.local.get(["sites", "toggles"]);
  const toggles = { ...(stored.toggles || {}) };
  for (const site of sites) {
    if (toggles[site.key] === undefined) toggles[site.key] = true;
    for (const f of site.filters) {
      if (toggles[f.id] === undefined) toggles[f.id] = true;
    }
  }
  await chrome.storage.local.set({ sites, toggles });
}

chrome.runtime.onInstalled.addListener(loadSites);
chrome.runtime.onStartup.addListener(loadSites);
loadSites();
