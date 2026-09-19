const list = document.getElementById("site-list");

function makeSwitch(dataset, checked, label) {
  const sw = document.createElement("label");
  sw.className = "switch";
  const input = document.createElement("input");
  input.type = "checkbox";
  for (const [k, v] of Object.entries(dataset)) input.dataset[k] = v;
  input.checked = checked;
  input.setAttribute("aria-label", label);
  const track = document.createElement("span");
  track.className = "switch-track";
  const knob = document.createElement("span");
  knob.className = "switch-knob";
  track.append(knob);
  sw.append(input, track);
  return sw;
}

function render(sites, toggles) {
  list.classList.remove("empty");
  list.replaceChildren();
  if (sites.length === 0) {
    list.classList.add("empty");
    list.textContent = "No filters yet.";
    return;
  }
  for (const site of sites) {
    const filters = site.filters || (site.selectors
      ? [{ id: site.key, name: "All", selectors: site.selectors }]
      : []);

    const row = document.createElement("li");
    row.className = "site-row";
    row.classList.toggle("disabled", toggles[site.key] === false);

    const label = document.createElement("button");
    label.type = "button";
    label.className = "site-label";
    label.dataset.expand = site.key;
    label.setAttribute("aria-expanded", "false");
    const caret = document.createElement("span");
    caret.className = "caret";
    caret.textContent = "▸";
    const info = document.createElement("span");
    info.className = "site-info";
    const name = document.createElement("div");
    name.className = "site-name";
    name.textContent = site.name;
    const domain = document.createElement("div");
    domain.className = "site-domain";
    domain.textContent = site.key;
    info.append(name, domain);
    label.append(caret, info);

    const sw = makeSwitch(
      { site: site.key },
      toggles[site.key] !== false,
      `Hide clutter on ${site.name}`
    );

    const subList = document.createElement("ul");
    subList.className = "sub-list";
    for (const f of filters) {
      const sub = document.createElement("li");
      sub.className = "sub-row";
      const subName = document.createElement("div");
      subName.className = "sub-name";
      subName.textContent = f.name;
      const subSw = makeSwitch(
        { filter: f.id },
        toggles[f.id] !== false,
        `${f.name} on ${site.name}`
      );
      sub.append(subName, subSw);
      subList.append(sub);
    }

    row.append(label, sw, subList);
    list.append(row);
  }
}

list.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-expand]");
  if (!btn) return;
  const row = btn.closest(".site-row");
  const expanded = row.classList.toggle("open");
  btn.setAttribute("aria-expanded", String(expanded));
  if (expanded) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
});

list.addEventListener("change", async (e) => {
  const input = e.target;
  if (!(input instanceof HTMLInputElement)) return;
  const key = input.dataset.site || input.dataset.filter;
  if (!key) return;
  if (input.dataset.site) {
    input.closest(".site-row").classList.toggle("disabled", !input.checked);
  }
  const { toggles = {} } = await chrome.storage.local.get("toggles");
  toggles[key] = input.checked;
  await chrome.storage.local.set({ toggles });
});

chrome.storage.local.get(["sites", "toggles"], ({ sites = [], toggles = {} }) => {
  render(sites, toggles);
});