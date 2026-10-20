function canonical(host) {
  const h = host.toLowerCase();
  return h.startsWith("www.") ? h.slice(4) : h;
}

const HOST = canonical(location.hostname);

const styleEl = document.createElement("style");
styleEl.dataset.refocus = "true";

const WRAPPER_ATTR = "data-refocus-hide";
const WRAPPER_CSS = `[${WRAPPER_ATTR}="1"] { display: none !important; visibility: hidden !important; height: 0 !important; min-height: 0 !important; max-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; overflow: hidden !important; }`;

function applyRules(selectors, withWrapperRule) {
  if (selectors.length === 0) {
    styleEl.remove();
    return;
  }
  const rules = selectors.map((s) => `${s} { display: none !important; }`);
  if (withWrapperRule) rules.push(WRAPPER_CSS);
  styleEl.textContent = rules.join("\n");
  if (!styleEl.isConnected) {
    document.documentElement.appendChild(styleEl);
  }
}

const WRAPPER_STOP_TAGS = new Set([
  "BODY", "HTML", "MAIN", "NAV", "ASIDE",
  "HEADER", "FOOTER", "SECTION", "FORM", "TABLE"
]);
const MAX_WRAPPER_DEPTH = 4;

function hasOwnText(el) {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) return true;
  }
  return false;
}

function soleWrapperOf(el) {
  let node = el;
  for (let i = 0; i < MAX_WRAPPER_DEPTH; i++) {
    const parent = node.parentElement;
    if (!parent) break;
    if (WRAPPER_STOP_TAGS.has(parent.tagName)) break;
    if (parent.id) break;
    if (parent.children.length !== 1) break;
    if (hasOwnText(parent)) break;
    node = parent;
  }
  return node === el ? null : node;
}

let wrapperObserver = null;
let wrapperMarkFn = null;

function markHiddenWrappers(selectors) {
  document.querySelectorAll(`[${WRAPPER_ATTR}="1"]`).forEach((el) =>
    el.removeAttribute(WRAPPER_ATTR)
  );
  if (HOST !== "tiktok.com" || selectors.length === 0) {
    if (wrapperObserver) {
      wrapperObserver.disconnect();
      wrapperObserver = null;
    }
    return;
  }
  wrapperMarkFn = () => {
    document.querySelectorAll(`[${WRAPPER_ATTR}="1"]`).forEach((el) =>
      el.removeAttribute(WRAPPER_ATTR)
    );
    const marked = new Set();
    for (const sel of selectors) {
      let els;
      try {
        els = document.querySelectorAll(sel);
      } catch {
        continue;
      }
      for (const el of els) {
        if (marked.has(el)) continue;
        const wrap = soleWrapperOf(el);
        if (wrap && !marked.has(wrap)) {
          wrap.setAttribute(WRAPPER_ATTR, "1");
          marked.add(wrap);
        }
      }
    }
  };
  wrapperMarkFn();
  if (!wrapperObserver) {
    let timer = 0;
    wrapperObserver = new MutationObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(() => wrapperMarkFn && wrapperMarkFn(), 300);
    });
    wrapperObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
}

const behaviorState = new Set();
const behaviorStyles = {};
let behaviorStyleEl = null;

function setBehaviorStyle(key, css) {
  if (css) behaviorStyles[key] = css;
  else delete behaviorStyles[key];
  const combined = Object.values(behaviorStyles).join("\n");
  if (!combined) {
    if (behaviorStyleEl) {
      behaviorStyleEl.remove();
      behaviorStyleEl = null;
    }
    return;
  }
  if (!behaviorStyleEl) {
    behaviorStyleEl = document.createElement("style");
    behaviorStyleEl.dataset.refocusBehavior = "true";
    document.documentElement.appendChild(behaviorStyleEl);
  }
  behaviorStyleEl.textContent = combined;
}

const REDIRECT_GUARD_KEY = "refocus_redirect_guard_v1";
const HOME_FEED_CLASS = "refocus-home-feed";
const TT_HOME_PATHS = ["/", "/foryou"];

function canRedirect() {
  try {
    const now = Date.now();
    const raw = sessionStorage.getItem(REDIRECT_GUARD_KEY);
    let state = raw ? JSON.parse(raw) : { count: 0, ts: now };
    if (now - state.ts > 30000) state = { count: 0, ts: now };
    state.count += 1;
    state.ts = now;
    sessionStorage.setItem(REDIRECT_GUARD_KEY, JSON.stringify(state));
    return state.count <= 3;
  } catch {
    return true;
  }
}

function clearRedirectGuard() {
  try {
    sessionStorage.removeItem(REDIRECT_GUARD_KEY);
  } catch {}
}

function getProfileHref() {
  const link = document.querySelector('[data-e2e="nav-profile"]');
  const href = link ? link.getAttribute("href") : null;
  return href && href.startsWith("/@") && href.length > 2 ? href : null;
}

function redirectToProfile() {
  const href = getProfileHref();
  if (href) {
    window.location.replace(href);
    return;
  }
  let attempts = 0;
  const intervalId = window.setInterval(() => {
    if (window.location.pathname !== "/") {
      window.clearInterval(intervalId);
      return;
    }
    attempts++;
    const found = getProfileHref();
    if (found) {
      window.clearInterval(intervalId);
      window.location.replace(found);
      return;
    }
    if (attempts >= 40) window.clearInterval(intervalId);
  }, 500);
}

let routeTimer = 0;

function checkTikTokRedirect() {
  const path = window.location.pathname;
  const isHome = TT_HOME_PATHS.includes(path);
  const isExplore = path === "/explore" || path.startsWith("/explore/");
  document.documentElement.classList.toggle(
    HOME_FEED_CLASS,
    isHome && behaviorState.has("redirect-profile")
  );
  if (!isHome && !isExplore) {
    clearRedirectGuard();
    return;
  }
  if (isHome && behaviorState.has("redirect-profile")) {
    if (!canRedirect()) return;
    redirectToProfile();
    return;
  }
  if (isExplore && behaviorState.has("redirect-explore")) {
    if (!canRedirect()) return;
    window.location.replace("/following");
  }
}

function syncTikTokRedirectWatch() {
  const wanted =
    HOST === "tiktok.com" &&
    (behaviorState.has("redirect-profile") ||
      behaviorState.has("redirect-explore"));
  if (wanted) {
    if (!routeTimer) {
      routeTimer = window.setInterval(checkTikTokRedirect, 500);
      window.addEventListener("popstate", checkTikTokRedirect);
      window.addEventListener("hashchange", checkTikTokRedirect);
    }
    checkTikTokRedirect();
  } else {
    if (routeTimer) {
      window.clearInterval(routeTimer);
      routeTimer = 0;
      window.removeEventListener("popstate", checkTikTokRedirect);
      window.removeEventListener("hashchange", checkTikTokRedirect);
    }
    document.documentElement.classList.remove(HOME_FEED_CLASS);
  }
}

const HOME_FEED_CSS = `.${HOME_FEED_CLASS} [data-e2e="feed-video"],
.${HOME_FEED_CLASS} [data-e2e="feed-container"],
.${HOME_FEED_CLASS} [data-e2e="recommend-list-item-container"],
.${HOME_FEED_CLASS} [id^="main-content-homepage_hot"] { display: none !important; }`;

const YT_MUSIC_VIDEO_CSS = `ytmusic-player video { opacity: 0 !important; }
video-cover { display: none !important; }
#song-image img { display: none !important; }
ytmusic-player { background-color: #000 !important; position: relative; }
ytmusic-player::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 44%;
  transform: translate(-50%, -50%);
  width: 88px;
  height: 88px;
  background: url("${chrome.runtime.getURL("icons/icon128.png")}") center / contain no-repeat;
  border-radius: 18px;
  z-index: 10;
  pointer-events: none;
}
ytmusic-player::after {
  content: "Refocus";
  position: absolute;
  left: 50%;
  top: 44%;
  transform: translate(-50%, 58px);
  padding: 8px 18px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  color: #fff;
  font: 600 13px/1 Roboto, "Segoe UI", Arial, sans-serif;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  z-index: 10;
  pointer-events: none;
}`;

let ytmusicHandlerInjected = false;

function postHideVideosState(enabled) {
  window.postMessage({ source: "refocus", type: "hide-videos", enabled }, "*");
}

const BEHAVIORS = {
  "redirect-profile": {
    apply() {
      setBehaviorStyle("redirect-profile", HOME_FEED_CSS);
      syncTikTokRedirectWatch();
    },
    revert() {
      setBehaviorStyle("redirect-profile", null);
      syncTikTokRedirectWatch();
    }
  },
  "redirect-explore": {
    apply() {
      syncTikTokRedirectWatch();
    },
    revert() {
      syncTikTokRedirectWatch();
    }
  },
  "hide-videos": {
    apply() {
      setBehaviorStyle("hide-videos", YT_MUSIC_VIDEO_CSS);
      if (!ytmusicHandlerInjected) {
        ytmusicHandlerInjected = true;
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("page/ytmusic-video-handler.js");
        script.onload = () => script.remove();
        (document.head || document.documentElement).appendChild(script);
      }
      postHideVideosState(true);
    },
    revert() {
      setBehaviorStyle("hide-videos", null);
      postHideVideosState(false);
    }
  }
};

function syncBehaviors(wanted) {
  for (const name of wanted) {
    if (!behaviorState.has(name)) {
      behaviorState.add(name);
      if (BEHAVIORS[name]) BEHAVIORS[name].apply();
    }
  }
  for (const name of [...behaviorState]) {
    if (!wanted.has(name)) {
      behaviorState.delete(name);
      if (BEHAVIORS[name]) BEHAVIORS[name].revert();
    }
  }
}

function refresh() {
  chrome.storage.local.get(["sites", "toggles"], ({ sites = [], toggles = {} }) => {
    const site = sites.find((s) => s.key === HOST);
    if (!site) return;
    const filters = site.filters || (site.selectors
      ? [{ id: HOST, name: site.name, selectors: site.selectors }]
      : []);
    const active = toggles[site.key] === false
      ? []
      : filters.filter((f) => toggles[f.id] !== false);
    const selectors = active.flatMap((f) => f.selectors);
    applyRules(selectors, HOST === "tiktok.com");
    markHiddenWrappers(selectors);
    syncBehaviors(new Set(active.map((f) => f.behavior).filter(Boolean)));
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.sites || changes.toggles) refresh();
});

refresh();
