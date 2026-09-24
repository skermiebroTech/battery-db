/* Laptop Battery Finder - plain JS, no build step. Data comes from data/batteries.js. */
(function () {
  "use strict";
  const DATA = (window.BATTERIES || []).map((r, i) => ({ ...r, id: i }));
  const $ = (s) => document.querySelector(s);
  const q = $("#q"), results = $("#results"), count = $("#count"), brandsEl = $("#brands");
  const state = { query: "", brand: "", view: "laptops", sort: "" };

  // ---------- helpers ----------
  const norm = (s) => String(s || "").toLowerCase().replace(/[\s\-_.,()"']+/g, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const RAM_LABEL = { yes: "Upgradable", partial: "Partly upgradable", no: "Soldered" }; // search words only
  function tokens(query) { return query.toLowerCase().split(/\s+/).filter(Boolean); }
  function hay(r) {
    return [r.brand, r.model, ...(r.alias || []), ...(r.part_numbers || []), ...(r.battery_type || []),
      ...(r.charger_part_numbers || []), r.charger_connector || "", r.charger_watts ? r.charger_watts + "W" : "",
      r.ram_type || "", RAM_LABEL[r.ram_upgradable] ? RAM_LABEL[r.ram_upgradable] + " RAM" : "",
      r.storage_type || "", r.wifi_type || "", r.gpu || "", r.wwan === "yes" ? "WWAN 4G 5G LTE" : "", r.replaceable_parts || "", ...Object.values(r.replaceable_part_numbers || {}).flat()].join(" ");
  }
  // Every token must appear somewhere (with punctuation and spaces ignored, so "x1carbon" and "cc03 xl" both work).
  function matches(r, toks) {
    if (!toks.length) return true;
    const h = norm(hay(r));
    return toks.every((t) => h.includes(norm(t)));
  }
  function hilite(text, toks) {
    let out = esc(text);
    for (const t of toks) {
      if (t.length < 2) continue;
      const re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      out = out.replace(re, "<mark>$1</mark>");
    }
    return out;
  }
  function pn(code, toks, isType) {
    return `<span class="pn${isType ? " type" : ""}" data-copy="${esc(code)}" title="Click to copy">${hilite(code, toks)}</span>`;
  }
  function confBadge(c) { return `<span class="conf ${esc(c)}">${esc(c || "unknown")} confidence</span>`; }
  function thumb(r) {
    if (r.image) {
      const code = esc(r.battery_type[0] || "battery");
      return `<button type="button" class="thumb" data-img="${esc(r.image)}" data-cap="${code}" title="Click to enlarge"><img src="${esc(r.image)}" alt="${code} battery" loading="lazy"></button>`;
    }
    return `<div class="thumb">no photo yet</div>`;
  }
  function photoSrc(r) {
    if (!r.image_source) return "";
    let host = "";
    try { host = new URL(r.image_source).hostname.replace(/^www\./, ""); } catch (e) { host = "source"; }
    return `<a href="${esc(r.image_source)}" target="_blank" rel="noopener" title="${esc(r.image_note || "Photo source")}">photo: ${esc(host)}${r.image_note ? " *" : ""}</a>`;
  }

  // ---------- rendering ----------
  function chargerBlock(r, toks) {
    if (!r.charger_watts && !r.charger_connector) return "";
    const label = [r.charger_watts ? `${r.charger_watts} W` : "", r.charger_connector].filter(Boolean).join(" · ");
    const parts = (r.charger_part_numbers || []).map((p) => pn(p, toks, false)).join("");
    const src = r.charger_source_url ? `<a href="${esc(r.charger_source_url)}" target="_blank" rel="noopener">source</a>` : "";
    const notes = r.charger_notes ? `<details class="notes"><summary>Charger notes</summary>${esc(r.charger_notes)}</details>` : "";
    return `<div class="charger">
      <div class="parts"><span class="tag">Charger</span><span class="pn type" data-copy="${esc(label)}">${hilite(label, toks)}</span>${parts}</div>
      <div class="meta">${r.charger_output ? `<span>${esc(r.charger_output)}</span>` : ""}${confBadge(r.charger_confidence)}${src}</div>
      ${notes}
    </div>`;
  }
  // Hardware grid: one short cell per part, with the long detail in one collapsible section.
  // Each map is value -> [colour class, short label].
  const HW = [
    ["RAM", "ram_upgradable", { yes: ["yes", "Upgradable"], partial: ["partial", "Partly"], no: ["no", "Soldered"] }],
    ["Storage", "storage_upgradable", { yes: ["yes", "Replaceable"], proprietary: ["partial", "Proprietary"], no: ["no", "Soldered"] }],
    ["Wi-Fi", "wifi_upgradable", { yes: ["yes", "Replaceable"], no: ["no", "Soldered"] }],
    ["WWAN", "wwan", { yes: ["yes", "Available"], no: ["none", "None"] }],
    ["GPU", "gpu_upgradable", { yes: ["yes", "Replaceable"], no: ["none", "Fixed"] }],
    ["Keyboard", "keyboard", { separate: ["yes", "Separate"], palmrest: ["partial", "With palmrest"] }],
    ["Screen", "screen", { panel: ["yes", "Panel only"], assembly: ["partial", "Assembly"] }],
    ["Charge port", "charge_port", { separate: ["yes", "Separate"], board: ["no", "On board"] }],
    ["Fan", "fan", { separate: ["yes", "Separate"], heatsink: ["partial", "With heatsink"], none: ["none", "Fanless"] }],
  ];
  function hwExtra(r, key) {
    if (key === "ram_upgradable") return r.ram_max ? `max ${r.ram_max}` : "";
    if (key === "storage_upgradable") return r.storage_slots > 1 ? `${r.storage_slots} slots` : "";
    return "";
  }
  // Sort keys. Green cells count 2, amber cells count 1.
  const partList = (r) => (r.replaceable_parts || "").split(";").map((p) => p.trim()).filter(Boolean);
  const partCount = (r) => partList(r).length;
  function hwScore(r, key) {
    const f = (HW.find((h) => h[1] === key) || [])[2]?.[r[key]];
    return !f ? 0 : f[0] === "yes" ? 2 : f[0] === "partial" ? 1 : 0;
  }
  const upgradeScore = (r) => HW.reduce((s, h) => s + hwScore(r, h[1]), 0);
  function hwBlock(r, toks) {
    const cells = HW.map(([name, key, map]) => {
      const f = map[r[key]];
      if (!f) return "";
      const extra = hwExtra(r, key);
      return `<div class="hw ${f[0]}"><span class="tag">${name}</span><span class="val">${f[1]}${extra ? ` <small>${esc(extra)}</small>` : ""}</span></div>`;
    }).join("");
    if (!cells) return "";
    const slots = r.ram_slots === 0 ? "no slots" : r.ram_slots ? `${r.ram_slots} slot${r.ram_slots === 1 ? "" : "s"}` : "";
    const rows = [
      ["RAM", [r.ram_type, slots].filter(Boolean).join(" · ")],
      ["Storage", r.storage_type], ["Wi-Fi", r.wifi_type], ["WWAN", r.wwan_notes], ["GPU", r.gpu],
    ].filter(([, v]) => v);
    const pns = r.replaceable_part_numbers || {};
    // Parts from the repair list, then any part that only has numbers.
    const parts = [...new Set(partList(r).concat(Object.keys(pns)))];
    const notes = [r.ram_notes, r.parts_notes, r.repair_notes, r.pn_notes].filter(Boolean);
    const link = (url, text, conf) => url ? `<span><a href="${esc(url)}" target="_blank" rel="noopener">${text}</a> ${confBadge(conf).replace(" confidence", "")}</span>` : "";
    const detailText = rows.map(([, v]) => v).concat(parts, notes, Object.values(pns).flat()).join(" ");
    const withPn = parts.filter((p) => pns[p]?.length), noPn = parts.filter((p) => !pns[p]?.length);
    const open = toks.length && toks.some((t) => norm(detailText).includes(norm(t))) ? " open" : "";
    return `<div class="charger">
      <div class="hwgrid">${cells}</div>
      <details class="notes"${open}><summary>Hardware details${parts.length ? ` · ${parts.length} replaceable parts` : ""}</summary>
        <dl class="partlist">${rows.map(([k, v]) => `<dt class="tag">${k}</dt><dd>${hilite(v, toks)}</dd>`).join("")}</dl>
        ${withPn.length ? `<dl class="partlist pnlist">${withPn.map((p) => `<dt>${hilite(p, toks)}</dt><dd>${pns[p].map((n) => pn(n, toks, false)).join("")}</dd>`).join("")}</dl>` : ""}
        ${noPn.length ? `<ul class="plist">${noPn.map((p) => `<li>${hilite(p, toks)}</li>`).join("")}</ul>` : ""}
        ${notes.map((n) => `<p class="hwnote">${esc(n)}</p>`).join("")}
        <div class="meta">${link(r.ram_source_url, "RAM source", r.ram_confidence)}${link(r.parts_source_url, "spec sheet", r.parts_confidence)}${link(r.service_manual_url, "service manual", r.repair_confidence)}${link(r.pn_source_url, "part numbers", r.pn_confidence)}</div>
      </details>
    </div>`;
  }
  function laptopCard(r, toks) {
    const types = r.battery_type.map((c) => pn(c, toks, true)).join("");
    const parts = r.part_numbers.filter((p) => !r.battery_type.includes(p)).map((p) => pn(p, toks, false)).join("");
    const alias = r.alias.length ? `<p class="alias">Also listed as: ${r.alias.map((a) => hilite(a, toks)).join(", ")}</p>` : "";
    const cap = [r.wh ? `${r.wh} Wh` : "", r.cells ? `${r.cells}-cell` : ""].filter(Boolean).join(" · ");
    const src = r.source_url ? `<a href="${esc(r.source_url)}" target="_blank" rel="noopener">source</a>` : "";
    const notes = r.notes ? `<details class="notes"><summary>Notes</summary>${esc(r.notes)}</details>` : "";
    return `<article class="card">
      ${thumb(r)}
      <div>
        <h2><span class="brand">${hilite(r.brand, toks)}</span> ${hilite(r.model, toks)}</h2>
        ${alias}
        <div class="parts">${types}${parts}</div>
        <div class="meta">${cap ? `<span>${esc(cap)}</span>` : ""}${confBadge(r.confidence)}${src}${photoSrc(r)}</div>
        ${notes}
        ${chargerBlock(r, toks)}
        ${hwBlock(r, toks)}
      </div>
    </article>`;
  }

  function chargerGroups(rows) {
    const map = new Map();
    for (const r of rows) {
      if (!r.charger_watts && !r.charger_connector) continue;
      const key = r.brand + "|" + r.charger_watts + "|" + r.charger_connector;
      if (!map.has(key)) map.set(key, { brand: r.brand, watts: r.charger_watts, connector: r.charger_connector, output: r.charger_output, parts: new Set(), laptops: [] });
      const g = map.get(key);
      (r.charger_part_numbers || []).forEach((p) => g.parts.add(p));
      g.laptops.push(r.model);
    }
    return [...map.values()].sort((a, b) => a.brand.localeCompare(b.brand) || (a.watts || 0) - (b.watts || 0) || a.connector.localeCompare(b.connector));
  }
  function chargerCard(g, toks) {
    const label = [g.watts ? `${g.watts} W` : "", g.connector].filter(Boolean).join(" · ");
    const parts = [...g.parts].map((p) => pn(p, toks, false)).join("");
    return `<article class="card bcard">
      <div class="thumb plug" aria-hidden="true">${g.connector && /usb-c/i.test(g.connector) ? "USB-C" : "barrel"}</div>
      <div>
        <h2><span class="brand">${hilite(g.brand, toks)}</span> ${pn(label, toks, true)}</h2>
        <div class="parts">${parts}</div>
        <div class="meta">${g.output ? `<span>${esc(g.output)}</span>` : ""}<span>fits ${g.laptops.length} model${g.laptops.length === 1 ? "" : "s"}</span></div>
        <ul class="laptops">${g.laptops.map((m) => `<li>${hilite(m, toks)}</li>`).join("")}</ul>
      </div>
    </article>`;
  }

  function batteryGroups(rows) {
    const map = new Map();
    for (const r of rows) {
      const key = r.brand + "|" + (r.battery_type[0] || r.part_numbers[0] || "?");
      if (!map.has(key)) map.set(key, { brand: r.brand, code: r.battery_type[0] || r.part_numbers[0] || "?", parts: new Set(), wh: r.wh, cells: r.cells, image: r.image, image_source: r.image_source, image_note: r.image_note, laptops: [] });
      const g = map.get(key);
      r.part_numbers.forEach((p) => g.parts.add(p));
      r.battery_type.forEach((p) => g.parts.add(p));
      if (!g.image && r.image) { g.image = r.image; g.image_source = r.image_source; g.image_note = r.image_note; }
      g.laptops.push(r.model);
    }
    return [...map.values()].sort((a, b) => a.brand.localeCompare(b.brand) || a.code.localeCompare(b.code));
  }
  function batteryCard(g, toks) {
    const cap = [g.wh ? `${g.wh} Wh` : "", g.cells ? `${g.cells}-cell` : ""].filter(Boolean).join(" · ");
    const parts = [...g.parts].filter((p) => p !== g.code).map((p) => pn(p, toks, false)).join("");
    return `<article class="card bcard">
      ${thumb({ image: g.image, battery_type: [g.code] })}
      <div>
        <h2><span class="brand">${hilite(g.brand, toks)}</span> ${pn(g.code, toks, true)}</h2>
        <div class="parts">${parts}</div>
        <div class="meta">${cap ? `<span>${esc(cap)}</span>` : ""}<span>fits ${g.laptops.length} model${g.laptops.length === 1 ? "" : "s"}</span>${photoSrc(g)}</div>
        <ul class="laptops">${g.laptops.map((m) => `<li>${hilite(m, toks)}</li>`).join("")}</ul>
      </div>
    </article>`;
  }

  function render() {
    const toks = tokens(state.query);
    let rows = DATA.filter((r) => (!state.brand || r.brand === state.brand) && matches(r, toks));
    const byName = (a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model);
    // Rank: brand or model hit first, then battery-code hits.
    if (state.sort && state.view === "laptops") {
      const key = state.sort === "name" ? () => 0 : state.sort === "parts" ? partCount : state.sort === "upgrade" ? upgradeScore : (r) => hwScore(r, state.sort);
      rows.sort((a, b) => key(b) - key(a) || byName(a, b));
    } else if (toks.length) {
      const score = (r) => toks.reduce((s, t) => s + (norm(r.model).startsWith(norm(t)) ? 3 : norm(r.model).includes(norm(t)) ? 2 : 0), 0);
      rows.sort((a, b) => score(b) - score(a) || a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
    } else {
      rows.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
    }
    if (!rows.length) {
      results.innerHTML = `<p class="empty">No match. Try fewer words, or search by the battery code printed on the pack.</p>`;
      count.textContent = "0 results";
      return;
    }
    if (state.view === "laptops") {
      count.textContent = `${rows.length} laptop model${rows.length === 1 ? "" : "s"}`;
      results.innerHTML = rows.slice(0, 200).map((r) => laptopCard(r, toks)).join("") + (rows.length > 200 ? `<p class="empty">Showing the first 200. Add a word to narrow the list.</p>` : "");
    } else if (state.view === "chargers") {
      const groups = chargerGroups(rows);
      count.textContent = `${groups.length} charger type${groups.length === 1 ? "" : "s"} across ${rows.length} laptops`;
      results.innerHTML = groups.map((g) => chargerCard(g, toks)).join("");
    } else {
      const groups = batteryGroups(rows);
      count.textContent = `${groups.length} battery model${groups.length === 1 ? "" : "s"} across ${rows.length} laptops`;
      results.innerHTML = groups.map((g) => batteryCard(g, toks)).join("");
    }
  }

  // ---------- brand chips ----------
  const brands = [...new Set(DATA.map((r) => r.brand))].sort();
  brandsEl.innerHTML = [`<button type="button" data-brand="" class="on">All</button>`]
    .concat(brands.map((b) => `<button type="button" data-brand="${esc(b)}">${esc(b)}</button>`)).join("");
  brandsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-brand]");
    if (!btn) return;
    state.brand = btn.dataset.brand;
    brandsEl.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === btn));
    syncHash(); render();
  });

  // ---------- view toggle ----------
  $("#view-laptops").addEventListener("click", () => setView("laptops"));
  $("#view-batteries").addEventListener("click", () => setView("batteries"));
  $("#view-chargers").addEventListener("click", () => setView("chargers"));
  const sortEl = $("#sort");
  sortEl.addEventListener("change", () => { state.sort = sortEl.value; syncHash(); render(); });
  function setView(v) {
    state.view = v;
    $("#view-laptops").classList.toggle("on", v === "laptops");
    $("#view-batteries").classList.toggle("on", v === "batteries");
    $("#view-chargers").classList.toggle("on", v === "chargers");
    sortEl.parentElement.hidden = v !== "laptops";
    syncHash(); render();
  }

  // ---------- search box ----------
  let timer;
  q.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { state.query = q.value.trim(); syncHash(); render(); }, 80); });
  $("#clear").addEventListener("click", () => { q.value = ""; state.query = ""; syncHash(); render(); q.focus(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && box.open) { box.close(); return; }
    if (e.key === "/" && document.activeElement !== q) { e.preventDefault(); q.focus(); q.select(); }
    if (e.key === "Escape" && document.activeElement === q) { q.value = ""; state.query = ""; syncHash(); render(); }
  });

  // ---------- lightbox ----------
  const box = document.createElement("dialog"); box.className = "lightbox";
  box.innerHTML = `<button type="button" class="close" aria-label="Close">&times;</button><img alt=""><p></p>`;
  document.body.appendChild(box);
  box.addEventListener("click", (e) => { if (e.target === box || e.target.classList.contains("close")) box.close(); });
  results.addEventListener("click", (e) => {
    const t = e.target.closest(".thumb[data-img]"); if (!t) return;
    box.querySelector("img").src = t.dataset.img; box.querySelector("img").alt = t.dataset.cap + " battery";
    box.querySelector("p").textContent = t.dataset.cap; box.showModal();
  });

  // ---------- copy on click ----------
  const toast = document.createElement("div"); toast.className = "toast"; document.body.appendChild(toast);
  results.addEventListener("click", (e) => {
    const el = e.target.closest(".pn"); if (!el) return;
    const text = el.dataset.copy;
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => {
      toast.textContent = `Copied ${text}`; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 1200);
    }).catch(() => {});
  });

  // ---------- hash state (shareable links: #q=latitude%207430&brand=Dell&view=batteries) ----------
  function syncHash() {
    const p = new URLSearchParams();
    if (state.query) p.set("q", state.query);
    if (state.brand) p.set("brand", state.brand);
    if (state.view !== "laptops") p.set("view", state.view);
    if (state.sort) p.set("sort", state.sort);
    const h = p.toString();
    history.replaceState(null, "", h ? "#" + h : location.pathname + location.search);
  }
  function readHash() {
    if (box.open) box.close();
    const p = new URLSearchParams(location.hash.slice(1));
    state.query = p.get("q") || ""; q.value = state.query;
    state.brand = brands.includes(p.get("brand")) ? p.get("brand") : "";
    brandsEl.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.brand === state.brand));
    state.sort = [...sortEl.options].some((o) => o.value && o.value === p.get("sort")) ? p.get("sort") : ""; sortEl.value = state.sort;
    setView(["batteries", "chargers"].includes(p.get("view")) ? p.get("view") : "laptops");
  }
  window.addEventListener("hashchange", readHash);
  readHash();
})();
