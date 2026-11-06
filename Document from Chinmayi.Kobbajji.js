/* ==========================================================
   common.js  -  SHARED rules for every page.
   Score colors:  65-100 Safe, 45-64 Medium, 0-44 Risky
   Time of day:   Morning 5 AM-12 PM, Afternoon 12-6 PM, Night 6 PM-5 AM
   ========================================================== */
(function () {
  "use strict";

  var BANDS = [
    { key: "safe",   label: "Safe",   min: 65, max: 100 },
    { key: "medium", label: "Medium", min: 45, max: 64 },
    { key: "risky",  label: "Risky",  min: 0,  max: 44 }
  ];

  var SLOTS = [
    { key: "morning",   label: "Morning",   range: "5 AM–12 PM", start: 5,  end: 12 },
    { key: "afternoon", label: "Afternoon", range: "12–6 PM",    start: 12, end: 18 },
    { key: "night",     label: "Night",     range: "6 PM–5 AM",  start: 18, end: 5 }
  ];

  /** 65-100 Safe, 45-64 Medium, 0-44 Risky */
  function bandOf(score) {
    if (score >= 65) return BANDS[0];
    if (score >= 45) return BANDS[1];
    return BANDS[2];
  }

  /** Morning 5-11:59, Afternoon 12-17:59, Night 18-4:59 */
  function slotOfHour(hour) {
    if (hour >= 5 && hour < 12) return SLOTS[0];
    if (hour >= 12 && hour < 18) return SLOTS[1];
    return SLOTS[2];
  }

  function currentSlot(date) {
    return slotOfHour((date || new Date()).getHours());
  }

  /** 9:15 AM style clock text */
  function formatClock(date) {
    var d = date || new Date();
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? "PM" : "AM";
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ":" + (m < 10 ? "0" + m : m) + " " + ampm;
  }

  function loadLocations(url) {
    return fetch(url || "data/locations.json").then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  window.DWSI = {
    BANDS: BANDS,
    SLOTS: SLOTS,
    bandOf: bandOf,
    slotOfHour: slotOfHour,
    currentSlot: currentSlot,
    formatClock: formatClock,
    loadLocations: loadLocations
  };
})();
