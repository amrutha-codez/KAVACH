/* ==========================================================
   charts.js  -  Charts page logic.
   Needs js/common.js first (score colors + time-of-day rules).
   ========================================================== */
(function () {
  "use strict";

  var D = window.DWSI;
  var DEFAULT_AREA = "Cubbon Park";
  var STORE_KEY = "dwsi.chartsArea";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var BAR_ROWS = [
    { key: "theft",       label: "Theft" },
    { key: "nightSafety", label: "Night safety" },
    { key: "roadSafety",  label: "Road safety" },
    { key: "womenSafety", label: "Women’s safety" }
  ];
  var COMPARE_ROWS = [
    { key: "incidentScore",       label: "Incident risk" },
    { key: "nightRiskScore",      label: "Night risk" },
    { key: "communityScore",      label: "Community" },
    { key: "infrastructureScore", label: "Infrastructure" }
  ];

  var state = {
    areas: [],        // all locations from data/locations.json
    area: null,       // selected location object
    slot: null,       // selected time slot object
    manualSlot: false // true once the user taps a card
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- tiny DOM helpers (textContent only, so data can never inject HTML) ---------- */
  function el(tag, props) {
    var node = document.createElement(tag);
    var p = props || {};
    Object.keys(p).forEach(function (k) {
      var v = p[k];
      if (v == null || v === false) return;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.indexOf("on") === 0) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return node;
  }
  function svg(tag, attrs) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function slotScore(area, slotKey) { return area.timeSlotScores[slotKey].score; }
  function bandClass(score) { return D.bandOf(score).key; }
  function bandLabel(score) { return D.bandOf(score).label; }

  /* ---------- storage (optional, never required) ---------- */
  function readSaved() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }
  function save(name) {
    try { localStorage.setItem(STORE_KEY, name); } catch (e) { /* ignore */ }
  }

  /* ---------- nearby areas (for the compare table) ---------- */
  function distanceKm(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.latitude - a.latitude) * rad;
    var dLon = (b.longitude - a.longitude) * rad;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function nearestAreas(area, count) {
    return state.areas
      .filter(function (a) { return a !== area; })
      .map(function (a) { return { a: a, d: distanceKm(area, a) }; })
      .sort(function (x, y) { return x.d - y.d; })
      .slice(0, count)
      .map(function (x) { return x.a; });
  }

  /* ==========================================================
     1. Time of day cards
     ========================================================== */
  function renderTimeCards() {
    var area = state.area;
    var nowSlot = D.currentSlot();
    var box = $("timeCards");
    clear(box);

    $("timeTitle").textContent = area.locationName + " · By time of day";
    $("nowPill").textContent = "Now: " + nowSlot.label;

    D.SLOTS.forEach(function (slot) {
      var score = slotScore(area, slot.key);
      var cls = bandClass(score);
      var btn = el("button", {
        type: "button",
        class: "time-card",
        "aria-pressed": slot.key === state.slot.key ? "true" : "false",
        "aria-label": slot.label + ", " + slot.range + ", score " + score + ", " + bandLabel(score),
        onclick: function () {
          state.slot = slot;
          state.manualSlot = slot.key !== D.currentSlot().key;
          renderSlotDependent();
        }
      },
        el("span", { class: "t-text" },
          el("span", { class: "t-name", text: slot.label }),
          el("span", { class: "t-range", text: slot.range })
        ),
        el("span", { class: "t-score " + cls, text: String(score) }),
        el("span", { class: "t-band " + cls, text: bandLabel(score) })
      );
      box.appendChild(btn);
    });

    renderTimeNote();
  }

  function renderTimeNote() {
    var note = $("timeNote");
    var clock = D.formatClock();
    var nowSlot = D.currentSlot();
    clear(note);
    if (state.manualSlot && state.slot.key !== nowSlot.key) {
      note.appendChild(document.createTextNode(
        "Showing " + state.slot.label + ". It’s " + nowSlot.label + " now (" + clock + "). "));
      note.appendChild(el("button", {
        type: "button",
        class: "link-btn",
        text: "Back to " + nowSlot.label,
        onclick: function () {
          state.slot = nowSlot;
          state.manualSlot = false;
          renderSlotDependent();
        }
      }));
    } else {
      note.textContent = "Auto-selected from your phone’s clock · " + clock;
    }
  }

  /* ==========================================================
     2. 6-month trend chart (SVG, redrawn to fit its container)
     ========================================================== */
  function monthLabels(count) {
    var now = new Date();
    var out = [];
    for (var i = count - 1; i >= 0; i--) {
      out.push(MONTHS[new Date(now.getFullYear(), now.getMonth() - i, 1).getMonth()]);
    }
    return out;
  }

  function renderTrendDelta(known) {
    var pill = $("trendDelta");
    var cls, text;
    var diff = known.length > 1 ? known[known.length - 1].v - known[0].v : null;
    if (diff === null) { cls = "neutral"; text = "New \u00B7 no history yet"; }
    else if (diff > 0)      { cls = "safe";   text = "+" + diff + " pts · safer"; }
    else if (diff < 0) { cls = "risky";  text = "−" + Math.abs(diff) + " pts · riskier"; }
    else               { cls = "neutral"; text = "No change"; }
    pill.className = "pill " + cls;
    pill.textContent = text;
  }

  function renderTrend() {
    var wrap = $("trendWrap");
    var scores = state.area.trend.scores;
    var labels = monthLabels(scores.length);
    // months with no data are null: skip them instead of drawing them as 0
    var known = [];
    scores.forEach(function (v, i) { if (typeof v === "number") known.push({ i: i, v: v }); });
    renderTrendDelta(known);
    if (!known.length) {
      clear(wrap);
      wrap.appendChild(el("p", { class: "time-note", text: "No trend data for this area yet." }));
      return;
    }

    var W = Math.max(wrap.clientWidth, 260);
    var H = W < 480 ? 210 : 260;
    var m = { top: 30, right: 24, bottom: 30, left: 36 };
    var iw = W - m.left - m.right;
    var ih = H - m.top - m.bottom;

    var vals = known.map(function (k) { return k.v; });
    var lo = Math.min.apply(null, vals);
    var hi = Math.max.apply(null, vals);
    var step = hi - lo > 20 ? 10 : 5;
    var yMin = Math.floor((lo - 2) / step) * step;
    var yMax = Math.ceil((hi + 2) / step) * step;
    if (yMax - yMin < step * 2) yMax = yMin + step * 2;

    function x(i) { return m.left + (scores.length === 1 ? iw / 2 : (iw * i) / (scores.length - 1)); }
    function y(v) { return m.top + ih - ((v - yMin) / (yMax - yMin)) * ih; }

    var root = svg("svg", {
      viewBox: "0 0 " + W + " " + H,
      role: "img",
      "aria-label": area_label(scores, labels)
    });

    // horizontal grid + y labels
    for (var t = yMin; t <= yMax; t += step) {
      root.appendChild(svg("line", { class: "grid-line", x1: m.left, x2: W - m.right, y1: y(t), y2: y(t) }));
      var yl = svg("text", { class: "axis-label", x: m.left - 8, y: y(t) + 4, "text-anchor": "end" });
      yl.textContent = t;
      root.appendChild(yl);
    }

    // area fill + line
    var pts = known.map(function (k) { return x(k.i) + "," + y(k.v); });
    if (known.length > 1) {
      root.appendChild(svg("polygon", {
        class: "area-fill",
        points: x(known[0].i) + "," + y(yMin) + " " + pts.join(" ") + " " + x(known[known.length - 1].i) + "," + y(yMin)
      }));
      root.appendChild(svg("polyline", { class: "trend-line", points: pts.join(" ") }));
    }

    // dots (with hover text)
    known.forEach(function (k) {
      var c = svg("circle", { class: "dot", cx: x(k.i), cy: y(k.v), r: 4.5 });
      var title = svg("title");
      title.textContent = labels[k.i] + ": " + k.v;
      c.appendChild(title);
      root.appendChild(c);
    });

    // month labels
    scores.forEach(function (v, i) {
      var ml = svg("text", { class: "axis-label", x: x(i), y: H - 6, "text-anchor": "middle" });
      ml.textContent = labels[i];
      root.appendChild(ml);
    });

    // value label on the latest month
    var lastK = known[known.length - 1];
    var end = svg("text", { class: "end-label", x: x(lastK.i), y: y(lastK.v) - 12, "text-anchor": "middle" });
    end.textContent = lastK.v;
    root.appendChild(end);

    clear(wrap);
    wrap.appendChild(root);
  }

  function area_label(scores, labels) {
    return state.area.locationName + " safety score trend, " +
      labels.map(function (l, i) { return l + " " + (scores[i] == null ? "no data" : scores[i]); }).join(", ");
  }

  /* ==========================================================
     3. Score bars
     ========================================================== */
  function renderBars() {
    var box = $("bars");
    var b = state.area.scoreBreakdown;
    clear(box);
    BAR_ROWS.forEach(function (row) {
      var v = b[row.key];
      var cls = bandClass(v);
      var fill = el("div", { class: "b-fill " + cls });
      fill.style.width = "0%";
      box.appendChild(el("div", {
        class: "bar-row",
        role: "meter",
        "aria-label": row.label,
        "aria-valuemin": "0",
        "aria-valuemax": "100",
        "aria-valuenow": String(v),
        "aria-valuetext": v + ", " + bandLabel(v)
      },
        el("span", { class: "b-label", text: row.label }),
        el("div", { class: "b-track" }, fill),
        el("span", { class: "b-val", text: String(v) })
      ));
      // animate to value on next frame
      requestAnimationFrame(function () { fill.style.width = Math.max(0, Math.min(100, v)) + "%"; });
    });
  }

  /* ==========================================================
     4. Compare areas table
     ========================================================== */
  function renderCompare() {
    var table = $("compareTable");
    var slot = state.slot;
    var cols = [state.area].concat(nearestAreas(state.area, 2));
    clear(table);

    var headRow = el("tr", {}, el("th", { scope: "col" }, el("span", { class: "sr-only", text: "Measure" })));
    cols.forEach(function (a, i) {
      var s = slotScore(a, slot.key);
      headRow.appendChild(el("th", { scope: "col", class: i === 0 ? "is-selected" : null },
        el("div", { text: a.locationName }),
        el("span", { class: "pill " + bandClass(s), text: String(s) })
      ));
    });
    table.appendChild(el("thead", {}, headRow));

    var body = el("tbody");
    COMPARE_ROWS.forEach(function (row) {
      var tr = el("tr", {}, el("th", { scope: "row", text: row.label }));
      cols.forEach(function (a, i) {
        tr.appendChild(el("td", { class: i === 0 ? "is-selected" : null, text: String(a[row.key]) }));
      });
      body.appendChild(tr);
    });
    table.appendChild(body);

    $("compareNote").textContent = slot.label + " scores shown · risk scores: lower is better.";
  }

  /* ==========================================================
     5. Safest / Least safe lists (for the selected time of day)
     ========================================================== */
  function fillRank(listId, titleId, title, areas) {
    var list = $(listId);
    clear(list);
    $(titleId).textContent = title + " · " + state.slot.label;
    areas.forEach(function (a, i) {
      var s = slotScore(a, state.slot.key);
      list.appendChild(el("li", {},
        el("span", { class: "rank", text: String(i + 1) }),
        el("button", {
          type: "button",
          class: "name",
          text: a.locationName,
          title: "Show " + a.locationName,
          onclick: function () { setArea(a.locationName); }
        }),
        el("span", { class: "pill " + bandClass(s), text: s + " · " + bandLabel(s) })
      ));
    });
  }

  function renderRanks() {
    var key = state.slot.key;
    var high = state.areas.slice().sort(function (a, b) { return slotScore(b, key) - slotScore(a, key); });
    var low  = state.areas.slice().sort(function (a, b) { return slotScore(a, key) - slotScore(b, key); });
    fillRank("safestList", "safestTitle", "Safest areas", high.slice(0, 3));
    fillRank("leastList",  "leastTitle",  "Least safe areas", low.slice(0, 3));
  }

  /* ==========================================================
     Wiring
     ========================================================== */
  function renderSlotDependent() {
    renderTimeCards();
    renderCompare();
    renderRanks();
  }

  function renderAll() {
    renderSlotDependent();
    renderTrend();
    renderBars();
  }

  function setArea(name) {
    var found = state.areas.filter(function (a) { return a.locationName === name; })[0];
    if (!found) return;
    state.area = found;
    $("areaSelect").value = name;
    save(name);
    renderAll();
    if (window.scrollY > 120) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildDropdown() {
    var select = $("areaSelect");
    clear(select);
    state.areas
      .map(function (a) { return a.locationName; })
      .sort(function (a, b) { return a.localeCompare(b); })
      .forEach(function (name) { select.appendChild(el("option", { value: name, text: name })); });
    select.disabled = false;
    select.addEventListener("change", function () { setArea(select.value); });
  }

  function pickStartArea() {
    var fromUrl = null;
    try { fromUrl = new URLSearchParams(location.search).get("area"); } catch (e) { /* ignore */ }
    var wanted = [fromUrl, readSaved(), DEFAULT_AREA];
    for (var i = 0; i < wanted.length; i++) {
      var hit = state.areas.filter(function (a) { return a.locationName === wanted[i]; })[0];
      if (hit) return hit;
    }
    return state.areas[0];
  }

  // keep the clock text, "Now" pill and auto-selected slot fresh
  function tick() {
    var nowSlot = D.currentSlot();
    $("nowPill").textContent = "Now: " + nowSlot.label;
    if (!state.manualSlot && state.slot.key !== nowSlot.key) {
      state.slot = nowSlot;
      renderSlotDependent();
    } else {
      renderTimeNote();
    }
  }

  function showError(html) {
    var msg = $("message");
    clear(msg);
    msg.appendChild(html);
    msg.hidden = false;
    $("grid").hidden = true;
    var s = $("areaSelect");
    clear(s);
    s.appendChild(el("option", { text: "No data" }));
  }

  function init() {
    D.loadLocations("data/locations.json").then(function (data) {
      if (!Array.isArray(data) || !data.length) throw new Error("Empty data");
      state.areas = data;
      state.area = pickStartArea();
      state.slot = D.currentSlot();

      buildDropdown();
      $("areaSelect").value = state.area.locationName;
      $("grid").hidden = false;
      renderAll();

      if (window.ResizeObserver) {
        var last = 0;
        new ResizeObserver(function () {
          var w = $("trendWrap").clientWidth;
          if (w !== last) { last = w; renderTrend(); }
        }).observe($("trendWrap"));
      } else {
        window.addEventListener("resize", renderTrend);
      }
      setInterval(tick, 30 * 1000);
    }).catch(function () {
      showError(el("p", {},
        el("strong", { text: "Couldn’t load the area data." }),
        el("br"),
        "Open this page through a web server (for example ",
        el("code", { text: "python -m http.server" }),
        ") or GitHub Pages, and make sure ",
        el("code", { text: "data/locations.json" }),
        " is uploaded."
      ));
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
