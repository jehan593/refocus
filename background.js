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

async function fetchFilters() {
  const res = await fetch(chrome.runtime.getURL("filters.txt"));
  return res.text();
}

async function applySites(sites) {
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

async function loadSites() {
  const text = await fetchFilters();
  await applySites(parseSites(text));
}

async function applyStartupPolicy() {
  const { enableOnStartup = true } = await chrome.storage.local.get("enableOnStartup");
  if (!enableOnStartup) return;
  const { sites = [] } = await chrome.storage.local.get("sites");
  const { toggles = {} } = await chrome.storage.local.get("toggles");
  let changed = false;
  for (const site of sites) {
    if (toggles[site.key] === false) { toggles[site.key] = true; changed = true; }
    for (const f of site.filters) {
      if (toggles[f.id] === false) { toggles[f.id] = true; changed = true; }
    }
  }
  if (changed) await chrome.storage.local.set({ toggles });
}

const SESSION_BOOT_KEY = "refocus_boot_done";

async function boot() {
  if (chrome.storage.session) {
    const { [SESSION_BOOT_KEY]: booted } = await chrome.storage.session.get(SESSION_BOOT_KEY);
    if (!booted) {
      await chrome.storage.session.set({ [SESSION_BOOT_KEY]: true });
      await applyStartupPolicy();
    }
  }
  await loadSites();
}

chrome.runtime.onInstalled.addListener(async () => {
  await loadSites();
  await applyStartupPolicy();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.session.remove(SESSION_BOOT_KEY);
});
boot().catch(console.error);
