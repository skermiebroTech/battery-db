/* Laptop Battery Finder - plain JS, no build step. Data comes from data/batteries.js. */
(function () {
  "use strict";
  const DATA = (window.BATTERIES || []).map((r, i) => ({ ...r, id: i }));
  const $ = (s) => document.querySelector(s);
  const q = $("#q"), results = $("#results"), count = $("#count"), brandsEl = $("#brands");
  const state = { query: "", brand: "", view: "laptops" };

  // ---------- helpers ----------
  const norm = (s) => String(s || "").toLowerCase().replace(/[\s\-_.,()"']+/g, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function tokens(query) { return query.toLowerCase().split(/\s+/).filter(Boolean); }
  function hay(r) {
    return [r.brand, r.model, ...(r.alias || []), ...(r.part_numbers || []), ...(r.battery_type || [])].join(" ");
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
    // Rank: brand or model hit first, then battery-code hits.
    if (toks.length) {
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
  function setView(v) {
    state.view = v;
    $("#view-laptops").classList.toggle("on", v === "laptops");
    $("#view-batteries").classList.toggle("on", v === "batteries");
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
    const h = p.toString();
    history.replaceState(null, "", h ? "#" + h : location.pathname + location.search);
  }
  function readHash() {
    if (box.open) box.close();
    const p = new URLSearchParams(location.hash.slice(1));
    state.query = p.get("q") || ""; q.value = state.query;
    state.brand = brands.includes(p.get("brand")) ? p.get("brand") : "";
    brandsEl.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.brand === state.brand));
    setView(p.get("view") === "batteries" ? "batteries" : "laptops");
  }
  window.addEventListener("hashchange", readHash);
  readHash();
})();
