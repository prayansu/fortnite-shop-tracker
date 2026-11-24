#!/usr/bin/env node
/**
 * update-shop.mjs
 * Fetches the current Fortnite item shop, computes summary metrics,
 * and upserts today's record into data/summary.json (minified).
 */

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const DATA_DIR   = join(__dirname, "..", "data");
const SUMMARY    = join(DATA_DIR, "summary.json");
const SHOP_API   = "https://fortnite-api.com/v2/shop";

// Paths to clean up from older versions
const LEGACY_FILES = ["history.json", "today.json", "yesterday.json"].map((f) => join(DATA_DIR, f));
const LEGACY_DIRS  = [join(DATA_DIR, "shops")];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDisplayName(entry) {
  if (entry.bundle?.name)         return entry.bundle.name;
  if (entry.brItems?.[0]?.name)   return entry.brItems[0].name;
  if (entry.tracks?.[0]?.title)   return entry.tracks[0].title;
  if (entry.cars?.[0]?.name)      return entry.cars[0].name;
  if (entry.instruments?.[0]?.name) return entry.instruments[0].name;
  return "Unknown";
}

function checkCollab(entry) {
  const series = entry.series?.value || entry.series?.id || entry.brItems?.[0]?.series?.value || entry.brItems?.[0]?.series?.id;
  if (series) return true;

  const sec = (entry.section?.id || entry.section?.name || "").toLowerCase();
  if (sec.includes("collab") || sec.includes("marvel") || sec.includes("star wars") || sec.includes("icon") || sec.includes("gaming") || sec.includes("anime")) {
    return true;
  }

  const name = getDisplayName(entry).toLowerCase();
  const collabKeywords = [
    "marvel", "star wars", "disney", "anime", "naruto", "dragon ball", "goku", "vegeta",
    "one piece", "luffy", "zoro", "cowboy bebop", "overwatch", "halo", "god of war", "kratos",
    "master chief", "witcher", "geralt", "my hero academia", "jujutsu kaisen", "attack on titan",
    "batman", "superman", "spider-man", "spiderman", "iron man", "avengers", "deadpool", "wolverine",
    "nike", "jordan", "lego", "ferrari", "mclaren", "lamborghini", "bmw", "cybertruck", "travis scott",
    "eminem", "ariana grande", "the weeknd", "lady gaga", "billie eilish", "metallica", "snoop dogg",
    "madison beer", "lil uzi vert", "regular show", "futurama", "family guy", "rick and morty",
    "mrbeast", "ninja", "bugha", "icon series", "gaming legends", "dc series"
  ];
  return collabKeywords.some((kw) => name.includes(kw));
}

// ---------------------------------------------------------------------------
// Migration: convert legacy data into summary.json entries
// ---------------------------------------------------------------------------

async function migrateLegacy(summary) {
  const existingDates = new Set(summary.map((r) => r.date));
  let migrated = 0;

  // Migrate history.json
  const histPath = join(DATA_DIR, "history.json");
  if (existsSync(histPath)) {
    try {
      const raw = JSON.parse(await readFile(histPath, "utf-8"));
      for (const entry of raw) {
        if (existingDates.has(entry.date)) continue;
        summary.push({
          date: entry.date,
          totalVbucks: entry.totalVbucks,
          itemCount: entry.itemCount,
          topItem: entry.topItem ?? null,
        });
        existingDates.add(entry.date);
        migrated++;
      }
    } catch { /* ignore corrupt */ }
  }

  if (migrated) console.log(`📦 Migrated ${migrated} record(s) from legacy files`);

  // Delete legacy files & dirs
  for (const f of LEGACY_FILES) {
    if (existsSync(f)) { await rm(f, { force: true }); console.log(`🗑  Deleted ${f}`); }
  }
  for (const d of LEGACY_DIRS) {
    if (existsSync(d)) { await rm(d, { recursive: true, force: true }); console.log(`🗑  Deleted ${d}/`); }
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // 1. Fetch shop data
  console.log("⏳ Fetching shop data …");
  const res = await fetch(SHOP_API);
  if (!res.ok) throw new Error(`API responded ${res.status} ${res.statusText}`);
  const json = await res.json();
  const { data } = json;

  // 2. Date
  const shopDate = data.date.slice(0, 10);
  console.log(`📅 Shop date: ${shopDate}`);

  // 3. Deduplicate by offerId
  const seen = new Set();
  const unique = [];
  for (const entry of data.entries) {
    if (!entry.offerId || seen.has(entry.offerId)) continue;
    seen.add(entry.offerId);
    unique.push(entry);
  }

  // 4. Filter
  const items = [];
  for (const entry of unique) {
    const price = entry.finalPrice;
    if (price == null || price <= 0 || price >= 100000) continue;
    items.push({ name: getDisplayName(entry), price });
  }

  // 5. Metrics
  const totalVbucks = items.reduce((s, i) => s + i.price, 0);
  const itemCount   = items.length;
  const topItem     = items.length
    ? items.reduce((best, i) => (i.price > best.price ? i : best), items[0])
    : null;
  const hasCollab   = unique.some(checkCollab);

  console.log(
    `🛒 ${itemCount} items | 💰 ${totalVbucks.toLocaleString("en-US")} V-Bucks | 🏆 ${topItem?.name ?? "—"} (${topItem?.price ? topItem.price.toLocaleString("en-US") : 0})${hasCollab ? ' [Collab]' : ''}`
  );

  const record = {
    date: shopDate,
    totalVbucks,
    itemCount,
    topItem: topItem ? { name: topItem.name, price: topItem.price } : null,
    hasCollab: Boolean(hasCollab),
  };

  // 6. Load existing summary
  await mkdir(DATA_DIR, { recursive: true });
  let summary = [];
  try {
    summary = JSON.parse(await readFile(SUMMARY, "utf-8"));
    if (!Array.isArray(summary)) summary = [];
  } catch { /* start fresh */ }

  // 7. Migrate legacy data
  summary = await migrateLegacy(summary);

  // 8. Upsert
  const idx = summary.findIndex((r) => r.date === shopDate);
  if (idx !== -1) { summary[idx] = record; console.log("🔄 Updated", shopDate); }
  else            { summary.push(record);  console.log("➕ Added", shopDate); }

  // 9. Sort chronologically & write (minified)
  summary.sort((a, b) => a.date.localeCompare(b.date));
  await writeFile(SUMMARY, JSON.stringify(summary), "utf-8");
  console.log(`✅ Saved ${summary.length} record(s) to data/summary.json`);
}

main().catch((err) => { console.error("❌ Fatal:", err); process.exit(1); });
