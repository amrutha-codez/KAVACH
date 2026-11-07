import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { db, locations, seedReports, busStops, policeStations, locationNames } from "./store.js";
import { SLOTS, slotForHour, buildLocations } from "./scoring.js";
import {
  hashPassword,
  checkPassword,
  makeToken,
  requireLogin,
  publicUser,
  rateLimit,
} from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "10kb" }));

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
const CATEGORY_TITLE = {
  poor_lighting: "Poor lighting",
  harassment: "Harassment",
  felt_unsafe: "Felt unsafe",
  felt_safe: "Felt safe",
};
const SEVERITIES = ["low", "medium", "high"];

// Kavach is for Bengaluru, so "today" and "yesterday" use Indian time.
const istFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function istParts(date) {
  const p = Object.fromEntries(istFormat.formatToParts(date).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, hour: Number(p.hour) };
}
function daysBetween(dayA, dayB) {
  return Math.round((Date.parse(dayA) - Date.parse(dayB)) / 86400000);
}

// Seed reports (from reports.json) and user reports look the same to the website.
function normalizeSeed(r) {
  return {
    id: r.reportId,
    location: r.location,
    slot: r.timeSlot,
    title: r.issueType,
    category: r.category,
    severity: r.severity === "very low" ? "low" : r.severity, // "very low" is shown as Low
    description: r.description,
    time: r.reportTime,
    daysAgo: r.daysAgo,
    source: "seed",
  };
}
function normalizeUser(r, today) {
  return {
    id: r.id,
    location: r.location,
    slot: r.slot,
    title: CATEGORY_TITLE[r.category],
    category: r.category,
    severity: r.severity,
    description: r.description,
    time: r.time,
    daysAgo: Math.max(0, daysBetween(today, istParts(new Date(r.createdAt)).day)),
    createdAt: r.createdAt,
    source: "user",
  };
}
function allReports() {
  const today = istParts(new Date()).day;
  return [...db.userReports.map((r) => normalizeUser(r, today)), ...seedReports.map(normalizeSeed)];
}

const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = (v) => v === "" || /^[+0-9 ()-]{7,20}$/.test(v);

// ---------------------------------------------------------------
// Data for the pages
// ---------------------------------------------------------------
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Scoring only needs a few fields from each report
function toScoringReport(r) {
  return { location: r.location, slot: r.slot, category: r.category, severity: r.severity, source: r.source, createdAt: r.createdAt };
}

// All 63 areas, with the Morning / Afternoon / Night score of each
app.get("/api/locations", (req, res) => {
  res.json(buildLocations(locations, allReports().map(toScoringReport)));
});

// Community reports. Newest first.
app.get("/api/reports", (req, res) => {
  const { location, slot } = req.query;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  let list = allReports();
  if (typeof location === "string" && location) list = list.filter((r) => r.location === location);
  if (typeof slot === "string" && SLOTS.includes(slot)) list = list.filter((r) => r.slot === slot);
  // newest day first; on the same day, reports from the website come before the old dataset ones
  list.sort(
    (a, b) =>
      a.daysAgo - b.daysAgo ||
      (a.source === "user" ? 0 : 1) - (b.source === "user" ? 0 : 1) ||
      b.time.localeCompare(a.time)
  );
  res.json(list.slice(0, limit));
});

app.get("/api/bus-stops", (req, res) => {
  res.json(
    busStops.map((s) => ({
      id: s.stopId,
      name: s.stopName,
      location: s.location,
      latitude: s.latitude,
      longitude: s.longitude,
      shelter: s.shelterType,
      lighting: s.lighting, // adequate, partial, none, unknown
      nightSafety: s.nightSafety, // safe, somewhat safe, unsafe, not assessed, not audited
      hasCCTV: s.hasCCTV,
    }))
  );
});

app.get("/api/police-stations", (req, res) => {
  res.json(
    policeStations.map((s) => ({
      id: s.stationId,
      name: s.stationName,
      location: s.location,
      latitude: s.latitude,
      longitude: s.longitude,
    }))
  );
});

// ---------------------------------------------------------------
// Sign up, log in, profile
// ---------------------------------------------------------------
app.post("/api/auth/signup", rateLimit("signup", 10, 60 * 60 * 1000), (req, res) => {
  const name = text(req.body.name, 60);
  const email = text(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const phone = text(req.body.phone, 20);
  const homeArea = text(req.body.homeArea, 60);
  const emergencyContact = text(req.body.emergencyContact, 60);

  if (name.length < 2) return res.status(400).json({ error: "Please enter your name." });
  if (!isEmail(email)) return res.status(400).json({ error: "Please enter a valid email." });
  if (password.length < 6 || password.length > 100)
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  if (!isPhone(phone)) return res.status(400).json({ error: "Please enter a valid phone number." });
  if (homeArea && !locationNames.has(homeArea))
    return res.status(400).json({ error: "Please choose a home area from the list." });
  if (db.users.some((u) => u.email === email))
    return res.status(409).json({ error: "An account with this email already exists." });

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: hashPassword(password),
    phone,
    homeArea,
    emergencyContact,
    settings: { notifications: true },
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  db.saveUsers();
  res.status(201).json({ token: makeToken(user.id), user: publicUser(user) });
});

app.post("/api/auth/login", rateLimit("login", 10, 60 * 1000), (req, res) => {
  const email = text(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const user = db.users.find((u) => u.email === email);
  if (!user || !checkPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Wrong email or password." });
  }
  res.json({ token: makeToken(user.id), user: publicUser(user) });
});

app.get("/api/auth/me", requireLogin, (req, res) => res.json({ user: publicUser(req.user) }));

app.patch("/api/auth/me", requireLogin, (req, res) => {
  const u = req.user;
  const b = req.body;

  if (b.name !== undefined) {
    const name = text(b.name, 60);
    if (name.length < 2) return res.status(400).json({ error: "Please enter your name." });
    u.name = name;
  }
  if (b.phone !== undefined) {
    const phone = text(b.phone, 20);
    if (!isPhone(phone)) return res.status(400).json({ error: "Please enter a valid phone number." });
    u.phone = phone;
  }
  if (b.homeArea !== undefined) {
    const homeArea = text(b.homeArea, 60);
    if (homeArea && !locationNames.has(homeArea))
      return res.status(400).json({ error: "Please choose a home area from the list." });
    u.homeArea = homeArea;
  }
  if (b.emergencyContact !== undefined) u.emergencyContact = text(b.emergencyContact, 60);
  if (b.settings && typeof b.settings.notifications === "boolean") {
    u.settings = { ...u.settings, notifications: b.settings.notifications };
  }
  db.saveUsers();
  res.json({ user: publicUser(u) });
});

// ---------------------------------------------------------------
// Submit a community report (login needed)
// ---------------------------------------------------------------
app.post("/api/reports", requireLogin, rateLimit("report", 10, 60 * 60 * 1000), (req, res) => {
  const location = text(req.body.location, 60);
  const category = text(req.body.category, 30);
  const severity = text(req.body.severity, 10);
  const description = text(req.body.description, 500);
  const now = istParts(new Date());

  if (!locationNames.has(location)) return res.status(400).json({ error: "Please choose an area." });
  if (!CATEGORY_TITLE[category]) return res.status(400).json({ error: "Please choose what happened." });
  if (!SEVERITIES.includes(severity)) return res.status(400).json({ error: "Please choose a severity." });
  if (description.length < 10)
    return res.status(400).json({ error: "Please describe what you saw or felt (at least 10 letters)." });

  // Time of day: the website sends the slot from the device clock.
  // If it sends nothing, the server works it out from Indian time.
  let slot = text(req.body.slot, 12);
  if (!SLOTS.includes(slot)) slot = slotForHour(now.hour);
  let time = text(req.body.time, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) time = now.time;

  const report = {
    id: "UR-" + crypto.randomBytes(4).toString("hex"),
    userId: req.user.id,
    location,
    slot,
    category,
    severity,
    description,
    time,
    createdAt: new Date().toISOString(),
    source: "user",
  };
  db.userReports.push(report);
  db.saveUserReports();

  const updated = buildLocations(locations, allReports().map(toScoringReport)).find((l) => l.name === location);
  res.status(201).json({ report: normalizeUser(report, now.day), location: updated });
});

// ---------------------------------------------------------------
// In production, this server also serves the built website
// ---------------------------------------------------------------
const dist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(path.join(dist, "index.html"))) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Bad request." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Kavach server running on http://localhost:${PORT}`));
