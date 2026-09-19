function canonical(host) {
  const h = host.toLowerCase();
  return h.startsWith("www.") ? h.slice(4) : h;
}

const styleEl = document.createElement("style");
styleEl.dataset.refocus = "true";

function applyRules(selectors) {
  if (selectors.length === 0) {
    styleEl.remove();
    return;
  }
  styleEl.textContent = selectors
    .map((s) => `${s} { display: none !important; }`)
    .join("\n");
  if (!styleEl.isConnected) {
    document.documentElement.appendChild(styleEl);
  }
}

function refresh() {
  chrome.storage.local.get(["sites", "toggles"], ({ sites = [], toggles = {} }) => {
    const key = canonical(location.hostname);
    const site = sites.find((s) => s.key === key);
    if (!site) return;
    const filters = site.filters || (site.selectors
      ? [{ id: key, name: site.name, selectors: site.selectors }]
      : []);
    const active = toggles[site.key] === false
      ? []
      : filters.filter((f) => toggles[f.id] !== false).flatMap((f) => f.selectors);
    applyRules(active);
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.sites || changes.toggles) refresh();
});

refresh();