/* ================================================================
   app.js — Shop Value Tracker (ES module)
   Unified Time Range Control & Adaptive Overview Analytics
   ================================================================ */

// ================================================================
// CONSTANTS & CONFIGURATION
// ================================================================
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const COLLAB_KEYWORDS = [
  "marvel", "star wars", "disney", "anime", "naruto", "dragon ball", "goku", "vegeta",
  "one piece", "luffy", "zoro", "cowboy bebop", "overwatch", "halo", "god of war", "kratos",
  "master chief", "witcher", "geralt", "my hero academia", "jujutsu kaisen", "attack on titan",
  "batman", "superman", "spider-man", "spiderman", "iron man", "avengers", "deadpool", "wolverine",
  "nike", "jordan", "lego", "ferrari", "mclaren", "lamborghini", "bmw", "cybertruck", "travis scott",
  "eminem", "ariana grande", "the weeknd", "lady gaga", "billie eilish", "metallica", "snoop dogg",
  "madison beer", "lil uzi vert", "regular show", "futurama", "family guy", "rick and morty",
  "mrbeast", "ninja", "bugha", "icon", "gaming legends", "dc", "collab"
];

// ── State ──
let history = [];
let vbucksChart = null;

// Time range modes: "preset" | "month" | "custom"
let activeMode = "preset";
let activePreset = "30d"; // "7d" | "30d" | "90d" | "all"
let activeMonth = "2026-11"; // "YYYY-MM"
let customRange = { from: "", to: "" }; // "YYYY-MM-DD"

// Chart display state
let chartTypePref = "auto"; // "auto" | "bar" | "line"
let chartAggPref = null;    // null (auto) | "day" | "week" | "month"

// Leaderboard state
let lbSort = "desc";        // "desc" (Highest) | "asc" (Lowest)
let lbExpanded = false;     // false (Top 5) | true (Full list)

// Popover datepicker state
let popYear = 2026;
let popMonth = 10; // 0-based
let tempStart = null;
let tempEnd = null;

// Boundaries
let minDateStr = "";
let maxDateStr = "";
let minMonthStr = "";
let maxMonthStr = "";

// ── DOM References ──
const $presetBtns     = document.querySelectorAll(".preset-btn");
const $monthStepper   = document.querySelector(".month-stepper");
const $stepperPrev    = document.getElementById("stepper-prev");
const $stepperNext    = document.getElementById("stepper-next");
const $stepperLabel   = document.getElementById("stepper-label");
const $stepperLabelBtn= document.getElementById("stepper-label-btn");

const $customBtn      = document.getElementById("custom-range-btn");
const $customBtnLabel = document.getElementById("custom-btn-label");
const $popover        = document.getElementById("datepicker-popover");
const $popTitle       = document.getElementById("pop-title");
const $popHint        = document.getElementById("pop-hint");
const $popGrid        = document.getElementById("pop-grid");
const $popPrev        = document.getElementById("pop-prev");
const $popNext        = document.getElementById("pop-next");
const $popCancel      = document.getElementById("pop-cancel");
const $popApply       = document.getElementById("pop-apply");

const $chartEmptyState= document.getElementById("chart-empty-state");
const $chartLegend    = document.getElementById("chart-legend");
const $chartLegendAvg = document.getElementById("chart-legend-avg");
const $aggToggleBtns  = document.querySelectorAll("#agg-toggle-group .chart-toggle-btn");
const $typeToggleBtns = document.querySelectorAll("#type-toggle-group .chart-toggle-btn");

const $lbTitle        = document.getElementById("leaderboard-title");
const $lbSortBtns     = document.querySelectorAll("#lb-sort-group .chart-toggle-btn");
const $lbExpandBtn    = document.getElementById("lb-expand-btn");
const $lbExpandText   = document.getElementById("lb-expand-text");
const $lbScroll       = document.getElementById("leaderboard-scroll");

// UI State References
const $errorBanner    = document.getElementById("error-banner");
const $errorDesc      = document.getElementById("error-desc");
const $errorRetryBtn  = document.getElementById("error-retry-btn");

const $emptyCard      = document.getElementById("empty-state-card");
const $emptyResetBtn  = document.getElementById("empty-reset-btn");

const $chartCard      = document.getElementById("chart-card");
const $chartSkeleton  = document.getElementById("chart-skeleton");
const $leaderboardCard= document.getElementById("leaderboard-card");

const $todayVb        = document.getElementById("kpi-today-vbucks");
const $pill           = document.getElementById("kpi-change-pill");
const $yestLine       = document.getElementById("kpi-yesterday-line");
const $newVb          = document.getElementById("kpi-new-vbucks");
const $newDetail      = document.getElementById("kpi-new-detail");
const $peakVb         = document.getElementById("kpi-peak-vbucks");
const $peakDetail     = document.getElementById("kpi-peak-detail");
const $avgVb          = document.getElementById("kpi-avg-vbucks");
const $avgDetail      = document.getElementById("kpi-avg-detail");
const $lb             = document.getElementById("leaderboard");

// Mobile Layout References
const $themeToggle        = document.getElementById("theme-toggle");
const $mobileFilterToggle = document.getElementById("mobile-filter-toggle");
const $mobileFilterLabel  = document.getElementById("mobile-filter-label");
const $navFilterBar       = document.getElementById("nav-filter-bar");
const $chartScrollWrap    = document.getElementById("chart-scroll-container");
const $chartCanvasWrap    = document.getElementById("chart-canvas-wrap");

let isEventsSetup = false;

// ── Custom Chart.js Plugin: Dashed Average Reference Line ──
const averageLinePlugin = {
  id: "averageLine",
  afterDraw(chart) {
    const { ctx, chartArea, scales: { y } } = chart;
    const avgValue = chart.config.options.plugins?.averageLine?.value;
    if (!chartArea || !avgValue) return;

    const yPos = y.getPixelForValue(avgValue);
    if (yPos < chartArea.top || yPos > chartArea.bottom) return;

    ctx.save();

    // Dashed average reference line across chart
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = isDark ? "rgba(244, 244, 245, 0.4)" : "rgba(17, 17, 17, 0.35)";
    ctx.moveTo(chartArea.left, yPos);
    ctx.lineTo(chartArea.right, yPos);
    ctx.stroke();

    ctx.restore();
  }
};

if (typeof Chart !== "undefined") {
  Chart.register(averageLinePlugin);
}

// ── Boot ──
// (Boot is triggered at the end of script after all constants, plugins, and helpers are initialized)

async function init() {
  initTheme();
  renderLoadingSkeletons();

  try {
    const res = await fetch("./data/summary.json");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Failed to fetch shop data`);
    }
    history = await res.json();
    if (!Array.isArray(history)) {
      throw new Error("Invalid format: summary.json is not an array");
    }
    if ($errorBanner) $errorBanner.hidden = true;
  } catch (err) {
    console.error("Failed to load summary.json:", err);
    history = [];
    renderErrorState(err);
    if (!isEventsSetup) {
      setupEventListeners();
      isEventsSetup = true;
    }
    return;
  }

  computeBoundaries();
  readURLState();
  if (!isEventsSetup) {
    setupEventListeners();
    isEventsSetup = true;
  }
  render();
}

// ── Skeletons & Error State ──
function renderLoadingSkeletons() {
  if ($errorBanner) $errorBanner.hidden = true;
  if ($emptyCard) $emptyCard.hidden = true;
  if ($chartCard) $chartCard.hidden = false;
  if ($leaderboardCard) $leaderboardCard.hidden = false;

  // KPI Skeletons
  if ($todayVb) $todayVb.innerHTML = '<span class="skeleton skeleton-val"></span>';
  if ($pill) $pill.textContent = "";
  if ($yestLine) $yestLine.innerHTML = '<span class="skeleton skeleton-sub"></span>';

  if ($newVb) $newVb.innerHTML = '<span class="skeleton skeleton-val"></span>';
  if ($newDetail) $newDetail.innerHTML = '<span class="skeleton skeleton-sub"></span>';

  if ($peakVb) $peakVb.innerHTML = '<span class="skeleton skeleton-val"></span>';
  if ($peakDetail) $peakDetail.innerHTML = '<span class="skeleton skeleton-sub"></span>';

  if ($avgVb) $avgVb.innerHTML = '<span class="skeleton skeleton-val"></span>';
  if ($avgDetail) $avgDetail.innerHTML = '<span class="skeleton skeleton-sub"></span>';

  // Chart Skeleton
  if ($chartLegend) $chartLegend.hidden = true;
  if ($chartSkeleton) $chartSkeleton.hidden = false;
  const canvas = document.getElementById("vbucks-chart");
  if (canvas) canvas.style.display = "none";
  if ($chartEmptyState) $chartEmptyState.hidden = true;

  // Leaderboard Skeletons
  if ($lb) {
    $lb.innerHTML = Array(5)
      .fill(
        `<li class="lb-row skeleton-lb-row">
          <div class="skeleton skeleton-lb-top"></div>
          <div class="skeleton skeleton-bar"></div>
        </li>`
      )
      .join("");
  }
}

function renderErrorState(err) {
  if ($chartLegend) $chartLegend.hidden = true;
  if ($chartSkeleton) $chartSkeleton.hidden = true;
  if ($errorBanner) {
    $errorBanner.hidden = false;
    if ($errorDesc) $errorDesc.textContent = err.message || "Could not fetch or parse data/summary.json.";
  }

  if ($todayVb) $todayVb.innerHTML = "—";
  if ($yestLine) $yestLine.textContent = "Data unavailable";
  if ($newVb) $newVb.innerHTML = "—";
  if ($newDetail) $newDetail.textContent = "Data unavailable";
  if ($peakVb) $peakVb.innerHTML = "—";
  if ($peakDetail) $peakDetail.textContent = "Data unavailable";
  if ($avgVb) $avgVb.innerHTML = "—";
  if ($avgDetail) $avgDetail.textContent = "Data unavailable";

  const canvas = document.getElementById("vbucks-chart");
  if (canvas) canvas.style.display = "none";
  if ($chartEmptyState) {
    $chartEmptyState.hidden = false;
    $chartEmptyState.textContent = "Unable to display chart due to loading error";
  }

  if ($lb) {
    $lb.innerHTML = '<li style="color:var(--ink-muted);font-size:13px;padding:8px 0">Unable to load shop data.</li>';
  }
}

// ================================================================
// BOUNDARIES & DATE UTILS
// ================================================================
function computeBoundaries() {
  if (history.length) {
    minDateStr = history[0].date;
    maxDateStr = history[history.length - 1].date;
    minMonthStr = minDateStr.slice(0, 7);
    maxMonthStr = maxDateStr.slice(0, 7);
  } else {
    const today = new Date().toISOString().slice(0, 10);
    minDateStr = maxDateStr = today;
    minMonthStr = maxMonthStr = today.slice(0, 7);
  }

  if (!activeMonth) {
    activeMonth = maxMonthStr;
  }
}

function formatMonthYear(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const monthIdx = parseInt(m, 10) - 1;
  return `${MONTH_SHORT[monthIdx] || ""} ${y}`;
}

function formatFullMonthYear(y, m) {
  return `${MONTH_NAMES[m]} ${y}`;
}

function prevMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

function nextMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 7);
}

function getMondayDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay(); // 0 = Sun, 1 = Mon ...
  const diff = (day === 0 ? -6 : 1) - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

function formatSpan(from, to) {
  if (!from || !to) return "Custom";
  const [y1, m1, d1] = from.split("-");
  const [y2, m2, d2] = to.split("-");

  const m1Name = MONTH_SHORT[parseInt(m1, 10) - 1];
  const m2Name = MONTH_SHORT[parseInt(m2, 10) - 1];

  if (from === to) {
    return `${m1Name} ${parseInt(d1, 10)}, ${y1}`;
  }
  if (y1 === y2 && m1 === m2) {
    return `${m1Name} ${parseInt(d1, 10)} – ${parseInt(d2, 10)}, ${y1}`;
  }
  if (y1 === y2) {
    return `${m1Name} ${parseInt(d1, 10)} – ${m2Name} ${parseInt(d2, 10)}, ${y1}`;
  }
  return `${m1Name} ${parseInt(d1, 10)}, ${y1} – ${m2Name} ${parseInt(d2, 10)}, ${y2}`;
}

// ================================================================
// URL QUERY SYNC
// ================================================================
function readURLState() {
  const params = new URLSearchParams(window.location.search);
  const from = params.get("from");
  const to = params.get("to");
  const month = params.get("month");
  const range = params.get("range");

  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    activeMode = "custom";
    customRange = {
      from: from <= to ? from : to,
      to: from <= to ? to : from
    };
  } else if (month && /^\d{4}-\d{2}$/.test(month)) {
    activeMode = "month";
    activeMonth = month;
  } else if (range && ["7d", "30d", "90d", "all"].includes(range.toLowerCase())) {
    activeMode = "preset";
    activePreset = range.toLowerCase();
  } else {
    activeMode = "preset";
    activePreset = "30d";
  }
}

function syncURLState() {
  const params = new URLSearchParams();

  if (activeMode === "preset") {
    params.set("range", activePreset);
  } else if (activeMode === "month") {
    params.set("month", activeMonth);
  } else if (activeMode === "custom") {
    params.set("from", customRange.from);
    params.set("to", customRange.to);
  }

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, "", newUrl);
}

window.addEventListener("popstate", () => {
  readURLState();
  render();
});

// ================================================================
// EVENT LISTENERS
// ================================================================
function setupEventListeners() {
  // 1. Presets
  $presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      activeMode = "preset";
      activePreset = btn.dataset.preset;
      closePopover();
      syncURLState();
      render();
    });
  });

  // 2. Month Stepper
  $stepperPrev.addEventListener("click", () => {
    if ($stepperPrev.disabled) return;
    activeMode = "month";
    activeMonth = prevMonth(activeMonth);
    closePopover();
    syncURLState();
    render();
  });

  $stepperNext.addEventListener("click", () => {
    if ($stepperNext.disabled) return;
    activeMode = "month";
    activeMonth = nextMonth(activeMonth);
    closePopover();
    syncURLState();
    render();
  });

  $stepperLabelBtn.addEventListener("click", () => {
    activeMode = "month";
    closePopover();
    syncURLState();
    render();
  });

  // 3. Custom Date Range Trigger & Popover
  $customBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePopover();
  });

  $popPrev.addEventListener("click", (e) => {
    e.stopPropagation();
    popMonth--;
    if (popMonth < 0) {
      popMonth = 11;
      popYear--;
    }
    renderPopoverCalendar();
  });

  $popNext.addEventListener("click", (e) => {
    e.stopPropagation();
    popMonth++;
    if (popMonth > 11) {
      popMonth = 0;
      popYear++;
    }
    renderPopoverCalendar();
  });

  $popCancel.addEventListener("click", (e) => {
    e.stopPropagation();
    closePopover();
  });

  $popApply.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!tempStart || !tempEnd) return;
    activeMode = "custom";
    customRange = {
      from: tempStart <= tempEnd ? tempStart : tempEnd,
      to: tempStart <= tempEnd ? tempEnd : tempStart
    };
    closePopover();
    syncURLState();
    render();
  });

  document.addEventListener("click", (e) => {
    if (!$popover.hidden && !$popover.contains(e.target) && !$customBtn.contains(e.target)) {
      closePopover();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$popover.hidden) {
      closePopover();
    }
  });

  // 4. Chart Controls: Aggregation Toggle
  $aggToggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      chartAggPref = btn.dataset.agg;
      render();
    });
  });

  // 5. Chart Controls: Type Toggle (Auto / Bars / Line)
  $typeToggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      chartTypePref = btn.dataset.type;
      render();
    });
  });

  // 6. Leaderboard Controls: Sort Toggle (Highest / Lowest)
  $lbSortBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      lbSort = btn.dataset.sort;
      renderLeaderboard(getFilteredData());
    });
  });

  // 7. Leaderboard Controls: Expand / Collapse Toggle
  $lbExpandBtn.addEventListener("click", () => {
    lbExpanded = !lbExpanded;
    renderLeaderboard(getFilteredData());
  });

  // 8. Error State: Retry Button
  if ($errorRetryBtn) {
    $errorRetryBtn.addEventListener("click", () => {
      init();
    });
  }

  // 9. Empty State: Reset to All Time Button
  if ($emptyResetBtn) {
    $emptyResetBtn.addEventListener("click", () => {
      activeMode = "preset";
      activePreset = "all";
      closePopover();
      syncURLState();
      render();
    });
  }

  // 10. Mobile Filter Toggle
  if ($mobileFilterToggle && $navFilterBar) {
    $mobileFilterToggle.addEventListener("click", () => {
      const isOpen = $navFilterBar.classList.toggle("is-open");
      $mobileFilterToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  // 11. Theme Toggle
  if ($themeToggle) {
    $themeToggle.addEventListener("click", () => {
      const nextTheme = getTheme() === "dark" ? "light" : "dark";
      setTheme(nextTheme, true);
    });
  }

  // 12. Listen to OS prefers-color-scheme changes when no manual override exists
  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!localStorage.getItem("theme")) {
        setTheme(e.matches ? "dark" : "light", false);
      }
    });
  } catch (e) {}
}

// ================================================================
// THEME MANAGEMENT
// ================================================================
function getTheme() {
  return document.documentElement.getAttribute("data-theme") || "light";
}

function initTheme() {
  const currentTheme = getTheme();
  updateThemeToggleUI(currentTheme);
}

function updateThemeToggleUI(theme) {
  if ($themeToggle) {
    const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    $themeToggle.setAttribute("aria-label", label);
    $themeToggle.setAttribute("title", label);
  }
}

function setTheme(theme, save = true) {
  document.documentElement.setAttribute("data-theme", theme);
  if (save) {
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {}
  }
  updateThemeToggleUI(theme);

  // If chart exists, re-render it to update gridlines, ticks, tooltips, and ghost bars
  if (vbucksChart) {
    const rawData = getFilteredData();
    const effectiveAgg = getEffectiveAgg(rawData);
    const buckets = aggregateData(rawData, effectiveAgg);
    renderChart(buckets, effectiveAgg);
  }
}

// ================================================================
// POPOVER CALENDAR
// ================================================================
function togglePopover() {
  if ($popover.hidden) {
    openPopover();
  } else {
    closePopover();
  }
}

function openPopover() {
  $popover.hidden = false;
  $customBtn.setAttribute("aria-expanded", "true");

  if (activeMode === "custom" && customRange.from && customRange.to) {
    tempStart = customRange.from;
    tempEnd = customRange.to;
    const [y, m] = customRange.from.split("-").map(Number);
    popYear = y;
    popMonth = m - 1;
  } else {
    tempStart = null;
    tempEnd = null;
    if (maxDateStr) {
      const [y, m] = maxDateStr.split("-").map(Number);
      popYear = y;
      popMonth = m - 1;
    } else {
      const now = new Date();
      popYear = now.getFullYear();
      popMonth = now.getMonth();
    }
  }

  renderPopoverCalendar();
}

function closePopover() {
  $popover.hidden = true;
  $customBtn.setAttribute("aria-expanded", "false");
}

function renderPopoverCalendar() {
  $popTitle.textContent = formatFullMonthYear(popYear, popMonth);

  const currentYM = `${popYear}-${String(popMonth + 1).padStart(2, "0")}`;
  $popPrev.disabled = minMonthStr && currentYM <= minMonthStr;
  $popNext.disabled = maxMonthStr && currentYM >= maxMonthStr;

  if (!tempStart) {
    $popHint.textContent = "Select start date";
    $popApply.disabled = true;
  } else if (!tempEnd) {
    $popHint.textContent = `${prettyDate(tempStart)} → Select end date`;
    $popApply.disabled = true;
  } else {
    $popHint.textContent = `${prettyDate(tempStart)} → ${prettyDate(tempEnd)}`;
    $popApply.disabled = false;
  }

  const firstDay = new Date(Date.UTC(popYear, popMonth, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(popYear, popMonth + 1, 0)).getUTCDate();

  let html = "";

  for (let i = 0; i < firstDay; i++) {
    html += `<button class="pop-day empty" disabled aria-hidden="true"></button>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${popYear}-${String(popMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isDisabled = (minDateStr && dateStr < minDateStr) || (maxDateStr && dateStr > maxDateStr);

    let classes = ["pop-day"];
    if (tempStart && tempEnd) {
      const start = tempStart <= tempEnd ? tempStart : tempEnd;
      const end = tempStart <= tempEnd ? tempEnd : tempStart;

      if (dateStr === start) classes.push("selected-start");
      if (dateStr === end) classes.push("selected-end");
      if (dateStr > start && dateStr < end) classes.push("in-range");
    } else if (tempStart && dateStr === tempStart) {
      classes.push("selected-start");
      classes.push("selected-end");
    }

    const disabledAttr = isDisabled ? "disabled" : "";
    html += `<button class="${classes.join(" ")}" data-date="${dateStr}" ${disabledAttr}>${day}</button>`;
  }

  $popGrid.innerHTML = html;

  $popGrid.querySelectorAll(".pop-day:not(:disabled):not(.empty)").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const date = btn.dataset.date;

      if (!tempStart || (tempStart && tempEnd)) {
        tempStart = date;
        tempEnd = null;
      } else if (tempStart && !tempEnd) {
        if (date < tempStart) {
          tempEnd = tempStart;
          tempStart = date;
        } else {
          tempEnd = date;
        }
      }
      renderPopoverCalendar();
    });
  });
}

// ================================================================
// DATA FILTERING & TIME-BUCKET AGGREGATION
// ================================================================
function getFilteredData() {
  if (!history.length) return [];

  if (activeMode === "preset") {
    if (activePreset === "all") return history;

    const daysMap = { "7d": 7, "30d": 30, "90d": 90 };
    const numDays = daysMap[activePreset] || 30;

    const latestDate = new Date(history[history.length - 1].date + "T23:59:59Z");
    const today = new Date();
    const anchor = latestDate > today ? latestDate : today;

    const cutoff = new Date(anchor);
    cutoff.setUTCDate(cutoff.getUTCDate() - numDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    return history.filter((d) => d.date >= cutoffStr);
  }

  if (activeMode === "month") {
    return history.filter((d) => d.date.startsWith(activeMonth));
  }

  if (activeMode === "custom") {
    const { from, to } = customRange;
    if (!from || !to) return history;
    return history.filter((d) => d.date >= from && d.date <= to);
  }

  return history;
}

function getEffectiveAgg(filteredData) {
  if (chartAggPref !== null) {
    return chartAggPref;
  }

  // Auto-default: Week if range exceeds 90 days, else Day
  if (filteredData.length >= 2) {
    const start = new Date(filteredData[0].date);
    const end = new Date(filteredData[filteredData.length - 1].date);
    const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
    if (diffDays > 90) return "week";
  } else if (activePreset === "all" || activePreset === "90d") {
    return "week";
  }
  return "day";
}

function aggregateData(filteredData, agg) {
  if (!filteredData.length) return [];

  if (agg === "day") {
    return filteredData.map((d) => ({
      key: d.date,
      label: shortDate(d.date),
      fullLabel: prettyDate(d.date),
      vbucks: d.totalVbucks,
      itemCount: d.itemCount,
      topItem: d.topItem,
      peakDay: d,
      isAggregated: false
    }));
  }

  if (agg === "week") {
    const groups = new Map();
    for (const item of filteredData) {
      const monday = getMondayDate(item.date);
      if (!groups.has(monday)) groups.set(monday, []);
      groups.get(monday).push(item);
    }

    const buckets = [];
    for (const [monday, records] of groups.entries()) {
      const sumVb = records.reduce((s, r) => s + r.totalVbucks, 0);
      const sumItems = records.reduce((s, r) => s + r.itemCount, 0);
      const avgVb = Math.round(sumVb / records.length);
      const avgItems = Math.round(sumItems / records.length);

      const peakDay = records.reduce((best, r) => (r.totalVbucks > best.totalVbucks ? r : best), records[0]);

      let notableItem = null;
      for (const r of records) {
        if (r.topItem && (!notableItem || (r.topItem.price > (notableItem.price || 0)))) {
          notableItem = r.topItem;
        }
      }

      buckets.push({
        key: monday,
        label: `Wk of ${shortDate(monday)}`,
        fullLabel: `Week of ${prettyDate(monday)} (${records.length} day${records.length > 1 ? 's' : ''})`,
        vbucks: avgVb,
        itemCount: avgItems,
        topItem: notableItem,
        peakDay: peakDay,
        isAggregated: true
      });
    }

    buckets.sort((a, b) => a.key.localeCompare(b.key));
    return buckets;
  }

  if (agg === "month") {
    const groups = new Map();
    for (const item of filteredData) {
      const ym = item.date.slice(0, 7);
      if (!groups.has(ym)) groups.set(ym, []);
      groups.get(ym).push(item);
    }

    const buckets = [];
    for (const [ym, records] of groups.entries()) {
      const sumVb = records.reduce((s, r) => s + r.totalVbucks, 0);
      const sumItems = records.reduce((s, r) => s + r.itemCount, 0);
      const avgVb = Math.round(sumVb / records.length);
      const avgItems = Math.round(sumItems / records.length);

      const peakDay = records.reduce((best, r) => (r.totalVbucks > best.totalVbucks ? r : best), records[0]);

      let notableItem = null;
      for (const r of records) {
        if (r.topItem && (!notableItem || (r.topItem.price > (notableItem.price || 0)))) {
          notableItem = r.topItem;
        }
      }

      const [y, m] = ym.split("-").map(Number);
      buckets.push({
        key: ym,
        label: formatMonthYear(ym),
        fullLabel: `${MONTH_NAMES[m - 1]} ${y} (${records.length} day${records.length > 1 ? 's' : ''})`,
        vbucks: avgVb,
        itemCount: avgItems,
        topItem: notableItem,
        peakDay: peakDay,
        isAggregated: true
      });
    }

    buckets.sort((a, b) => a.key.localeCompare(b.key));
    return buckets;
  }

  return [];
}

// ================================================================
// RENDER OVERVIEW
// ================================================================
function render() {
  updateControlsUI();

  const rawData = getFilteredData();

  if (rawData.length === 0) {
    if ($chartCard) $chartCard.hidden = true;
    if ($leaderboardCard) $leaderboardCard.hidden = true;
    if ($emptyCard) $emptyCard.hidden = false;
    renderKPIs(rawData);
    return;
  }

  if ($emptyCard) $emptyCard.hidden = true;
  if ($chartCard) $chartCard.hidden = false;
  if ($leaderboardCard) $leaderboardCard.hidden = false;

  const effectiveAgg = getEffectiveAgg(rawData);
  const buckets = aggregateData(rawData, effectiveAgg);

  updateChartControlsUI(effectiveAgg, buckets.length);
  renderKPIs(rawData);
  renderChart(buckets, effectiveAgg);
  renderLeaderboard(rawData);
}

// ── Control UI States ──
function updateControlsUI() {
  $presetBtns.forEach((btn) => {
    const isCurrent = activeMode === "preset" && btn.dataset.preset === activePreset;
    btn.classList.toggle("active", isCurrent);
    btn.setAttribute("aria-checked", String(isCurrent));
  });

  const isMonthMode = activeMode === "month";
  $monthStepper.classList.toggle("active", isMonthMode);
  $stepperLabel.textContent = formatMonthYear(activeMonth);

  $stepperPrev.disabled = minMonthStr && activeMonth <= minMonthStr;
  $stepperNext.disabled = maxMonthStr && activeMonth >= maxMonthStr;

  const isCustomMode = activeMode === "custom";
  $customBtn.classList.toggle("active", isCustomMode);

  if (isCustomMode && customRange.from && customRange.to) {
    $customBtnLabel.textContent = formatSpan(customRange.from, customRange.to);
  } else {
    $customBtnLabel.textContent = "Custom";
  }

  // Mobile Filter Button Label
  if ($mobileFilterLabel) {
    if (activeMode === "preset") {
      $mobileFilterLabel.textContent = activePreset.toUpperCase();
    } else if (activeMode === "month") {
      $mobileFilterLabel.textContent = formatMonthYear(activeMonth);
    } else if (activeMode === "custom") {
      $mobileFilterLabel.textContent = customRange.from && customRange.to ? "Custom" : "Custom";
    }
  }
}

function updateChartControlsUI(effectiveAgg, numBuckets) {
  // Aggregation buttons
  $aggToggleBtns.forEach((btn) => {
    const isSelected = btn.dataset.agg === effectiveAgg;
    btn.classList.toggle("active", isSelected);
    btn.setAttribute("aria-checked", String(isSelected));
  });

  // Chart type buttons
  $typeToggleBtns.forEach((btn) => {
    const isSelected = btn.dataset.type === chartTypePref;
    btn.classList.toggle("active", isSelected);
    btn.setAttribute("aria-checked", String(isSelected));
  });
}

// ── KPIs ──
function renderKPIs(data) {
  const today = data.length ? data[data.length - 1] : null;
  const yesterday = data.length > 1 ? data[data.length - 2] : null;

  const $todayVb  = document.getElementById("kpi-today-vbucks");
  const $pill     = document.getElementById("kpi-change-pill");
  const $yestLine = document.getElementById("kpi-yesterday-line");

  $todayVb.innerHTML = today ? `${fmt(today.totalVbucks)} <span class="kpi-unit">V-Bucks</span>` : "—";

  if (today && yesterday) {
    const diff  = today.totalVbucks - yesterday.totalVbucks;
    const pct   = yesterday.totalVbucks ? ((diff / yesterday.totalVbucks) * 100).toFixed(1) : 0;
    const sign  = diff > 0 ? "+" : "";
    const cls   = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
    const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";
    $pill.className   = `kpi-pill kpi-pill--${cls}`;
    $pill.textContent = `${arrow} ${sign}${pct}%`;
    $yestLine.textContent = `Yesterday: ${fmt(yesterday.totalVbucks)} V-Bucks`;
  } else {
    $pill.className   = "kpi-pill";
    $pill.textContent = "";
    $yestLine.textContent = today ? "No prior day in range" : "No data for selected period";
  }

  if (today && today.newVbucks != null) {
    $newVb.innerHTML = `${fmt(today.newVbucks)} <span class="kpi-unit">V-Bucks</span>`;
    const newCount = today.newItemCount ?? 0;
    const freshPct = today.totalVbucks > 0 ? ((today.newVbucks / today.totalVbucks) * 100).toFixed(1) : "0.0";
    $newDetail.textContent = `${fmt(newCount)} new item${newCount === 1 ? "" : "s"} · ${freshPct}% of shop`;
  } else {
    $newVb.textContent = "—";
    $newDetail.textContent = today ? "Tracking starts next rotation" : "No data for selected period";
  }

  const $peakVb     = document.getElementById("kpi-peak-vbucks");
  const $peakDetail = document.getElementById("kpi-peak-detail");

  if (history.length) {
    const peak = history.reduce((best, d) => (d.totalVbucks > best.totalVbucks ? d : best), history[0]);
    $peakVb.innerHTML = `${fmt(peak.totalVbucks)} <span class="kpi-unit">V-Bucks</span>`;
    const topName = peak.topItem?.name ?? "—";
    $peakDetail.textContent = `${prettyDate(peak.date)} · ${topName}`;
  } else {
    $peakVb.textContent = "—";
    $peakDetail.textContent = "";
  }

  const $avgVb     = document.getElementById("kpi-avg-vbucks");
  const $avgDetail = document.getElementById("kpi-avg-detail");

  if (data.length) {
    const avg = Math.round(data.reduce((s, d) => s + d.totalVbucks, 0) / data.length);
    $avgVb.innerHTML = `${fmt(avg)} <span class="kpi-unit">V-Bucks</span>`;
    $avgDetail.textContent = `Across ${data.length} recorded day${data.length > 1 ? "s" : ""}`;
  } else {
    $avgVb.textContent = "—";
    $avgDetail.textContent = "No data for selected range";
  }
}

// ── Chart Rendering ──
function renderChart(buckets, effectiveAgg) {
  if ($chartSkeleton) $chartSkeleton.hidden = true;
  const canvas = document.getElementById("vbucks-chart");

  if (!buckets.length) {
    if ($chartLegend) $chartLegend.hidden = true;
    if (vbucksChart) {
      vbucksChart.destroy();
      vbucksChart = null;
    }
    canvas.style.display = "none";
    $chartEmptyState.hidden = false;
    return;
  }

  canvas.style.display = "block";
  $chartEmptyState.hidden = true;

  // Mobile horizontal scroll scaling for dense datasets
  if ($chartCanvasWrap) {
    if (window.innerWidth < 768 && buckets.length > 12) {
      const minW = Math.max(buckets.length * 30, $chartScrollWrap ? $chartScrollWrap.clientWidth : 340);
      $chartCanvasWrap.style.minWidth = `${minW}px`;
      if ($chartScrollWrap) {
        requestAnimationFrame(() => {
          $chartScrollWrap.scrollLeft = $chartScrollWrap.scrollWidth;
        });
      }
    } else {
      $chartCanvasWrap.style.minWidth = "100%";
    }
  }

  // Determine effective chart type: Auto switches based on bucket count
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  let effectiveType = chartTypePref;
  if (chartTypePref === "auto") {
    effectiveType = buckets.length <= 31 ? "bar" : "line";
  }

  const allTimePeak = history.length ? Math.max(...history.map((d) => d.totalVbucks)) : 0;
  const meanValue = Math.round(buckets.reduce((s, b) => s + b.vbucks, 0) / buckets.length);

  if ($chartLegend) $chartLegend.hidden = false;
  if ($chartLegendAvg) $chartLegendAvg.textContent = `Avg ${fmt(meanValue)}`;

  const labels = buckets.map((b) => b.label);
  const values = buckets.map((b) => b.vbucks);
  const capValues = values.map(() => allTimePeak);

  let datasets = [];

  if (effectiveType === "bar") {
    datasets = [
      {
        label: "All-Time Peak",
        data: capValues,
        backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
        borderRadius: { topLeft: 6, topRight: 6 },
        borderSkipped: false,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
        order: 2,
      },
      {
        label: "V-Bucks",
        data: values,
        backgroundColor: "#9be12c",
        hoverBackgroundColor: "#8bd120",
        borderRadius: { topLeft: 6, topRight: 6 },
        borderSkipped: false,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
        order: 1,
      },
    ];
  } else {
    // Smooth Area / Line Chart
    datasets = [
      {
        label: "V-Bucks",
        data: values,
        borderColor: "#9be12c",
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return isDark ? "rgba(155, 225, 44, 0.18)" : "rgba(155, 225, 44, 0.15)";
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, isDark ? "rgba(155, 225, 44, 0.35)" : "rgba(155, 225, 44, 0.30)");
          gradient.addColorStop(1, "rgba(155, 225, 44, 0.0)");
          return gradient;
        },
        pointRadius: buckets.length <= 31 ? 3 : 0,
        pointHoverRadius: 6,
        pointBackgroundColor: isDark ? "#16181d" : "#ffffff",
        pointBorderColor: "#9be12c",
        pointBorderWidth: 2,
        pointHoverBackgroundColor: isDark ? "#f4f4f5" : "#111111",
        pointHoverBorderColor: "#9be12c",
        pointHoverBorderWidth: 2,
        order: 1,
      },
    ];
  }

  if (vbucksChart) vbucksChart.destroy();

  vbucksChart = new Chart(canvas, {
    type: effectiveType,
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      grouped: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        averageLine: {
          value: meanValue,
        },
        tooltip: {
          backgroundColor: isDark ? "#16181d" : "#111111",
          borderColor: isDark ? "#262930" : "transparent",
          borderWidth: isDark ? 1 : 0,
          titleColor: "#ffffff",
          bodyColor: isDark ? "#c2c6cf" : "#d6d8d0",
          cornerRadius: 10,
          padding: { top: 10, bottom: 12, left: 14, right: 14 },
          titleFont: { weight: "700", size: 13, family: "Inter" },
          bodyFont: { size: 12, family: "Inter" },
          displayColors: false,
          callbacks: {
            title(items) {
              const i = items[0].dataIndex;
              return buckets[i] ? buckets[i].fullLabel : "";
            },
            label(item) {
              if (effectiveType === "bar" && item.datasetIndex === 0) return null;
              const b = buckets[item.dataIndex];
              if (!b) return null;

              const lines = [];
              const valuePrefix = b.isAggregated ? "Avg Daily: " : "";
              lines.push(`${valuePrefix}${fmt(b.vbucks)} V-Bucks · ${fmt(b.itemCount)} items`);

              if (b.topItem) {
                lines.push(`Notable: ${b.topItem.name} (${fmt(b.topItem.price)} VB)`);
              }

              if (b.isAggregated && b.peakDay) {
                lines.push(`Peak Day: ${prettyDate(b.peakDay.date)} (${fmt(b.peakDay.totalVbucks)} VB)`);
              }

              return lines;
            },
          },
          filter(item) {
            return !(effectiveType === "bar" && item.datasetIndex === 0);
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: isDark ? "#9da1a8" : "#6b6d64", font: { size: 11 } },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          grid: { color: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)", drawTicks: false },
          ticks: {
            color: isDark ? "#9da1a8" : "#6b6d64",
            font: { size: 11 },
            padding: 8,
            callback: (v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v),
          },
          border: { display: false },
        },
      },
    },
  });
}

// ── Leaderboard Helpers ──
function isBundleDay(d) {
  if (d.hasBundle === true) return true;
  if (d.tags && Array.isArray(d.tags) && d.tags.some((t) => t.toLowerCase() === "bundle")) return true;
  if (!d.topItem) return false;
  const name = (d.topItem.name || "").toLowerCase();
  const price = d.topItem.price || 0;
  return name.includes("bundle") || price >= 2000;
}

function isCollabDay(d) {
  if (d.hasCollab === true) return true;
  if (d.tags && Array.isArray(d.tags) && d.tags.some((t) => t.toLowerCase() === "collab")) return true;
  if (!d.topItem?.name) return false;
  const name = d.topItem.name.toLowerCase();
  return COLLAB_KEYWORDS.some((kw) => name.includes(kw));
}

// ── Leaderboard ──
function renderLeaderboard(data) {
  const $lb = document.getElementById("leaderboard");
  if (!data.length) {
    if ($lbTitle) $lbTitle.textContent = lbSort === "desc" ? "Highest-Value Days" : "Lowest-Value Days";
    $lb.innerHTML = '<li style="color:var(--ink-muted);font-size:13px;padding:8px 0">No data for selected period</li>';
    if ($lbExpandBtn) $lbExpandBtn.hidden = true;
    return;
  }

  // Update Title
  if ($lbTitle) {
    $lbTitle.textContent = lbSort === "desc" ? "Highest-Value Days" : "Lowest-Value Days";
  }

  // Update Sort Button Active States
  $lbSortBtns.forEach((btn) => {
    const isSelected = btn.dataset.sort === lbSort;
    btn.classList.toggle("active", isSelected);
    btn.setAttribute("aria-checked", String(isSelected));
  });

  // Sort: desc = highest first, asc = lowest first
  const sorted = [...data].sort((a, b) =>
    lbSort === "desc" ? b.totalVbucks - a.totalVbucks : a.totalVbucks - b.totalVbucks
  );

  // Peak in active range for scaling
  const peak = Math.max(...data.map((d) => d.totalVbucks), 1);

  // Handle Expand / Collapse
  let itemsToRender;
  if (data.length > 5) {
    $lbExpandBtn.hidden = false;
    $lbExpandBtn.setAttribute("aria-expanded", String(lbExpanded));
    if (lbExpanded) {
      $lbExpandText.textContent = "Show top 5";
      $lbScroll.classList.add("is-expanded");
      itemsToRender = sorted;
    } else {
      $lbExpandText.textContent = `View all (${data.length})`;
      $lbScroll.classList.remove("is-expanded");
      itemsToRender = sorted.slice(0, 5);
    }
  } else {
    $lbExpandBtn.hidden = true;
    $lbScroll.classList.remove("is-expanded");
    itemsToRender = sorted;
  }

  $lb.innerHTML = itemsToRender.map((d, i) => {
    const pct = Math.max(((d.totalVbucks / peak) * 100), 2).toFixed(1);
    const hasBundle = isBundleDay(d);
    const hasCollab = isCollabDay(d);

    const tagsHtml = [
      hasBundle ? '<span class="tag tag-bundle">Bundle</span>' : '',
      hasCollab ? '<span class="tag tag-collab">Collab</span>' : '',
    ].filter(Boolean).join("");

    const topItemDetail = d.topItem
      ? `Top: <span class="lb-item-name">${d.topItem.name} (${fmt(d.topItem.price)} VB)</span>`
      : "";

    const newVbucksHtml = d.newVbucks != null
      ? `<span class="lb-new-vbucks">+${fmt(d.newVbucks)} new</span>`
      : "";

    return `<li class="lb-row">
      <div class="lb-top">
        <div class="lb-left">
          <span class="lb-rank">#${i + 1}</span>
          <span class="lb-date">${prettyDate(d.date)}</span>
          ${tagsHtml ? `<div class="lb-tags">${tagsHtml}</div>` : ''}
        </div>
        <div class="lb-right">
          <span class="lb-vbucks">${fmt(d.totalVbucks)} V-Bucks</span>
        </div>
      </div>
      ${(topItemDetail || newVbucksHtml) ? `<div class="lb-sub-row">
        <div class="lb-sub-meta">${topItemDetail}</div>
        ${newVbucksHtml}
      </div>` : ''}
      <div class="lb-bar-bg"><div class="lb-bar-fill" style="width:${pct}%"></div></div>
    </li>`;
  }).join("");
}

// ================================================================
// HELPERS
// ================================================================
function fmt(n) { return (n || 0).toLocaleString("en-US"); }

function prettyDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${MONTH_SHORT[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

function shortDate(iso) {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

// ── Mobile Responsive Resize Handler ──
window.addEventListener("resize", () => {
  if ($chartCanvasWrap && vbucksChart) {
    const rawData = getFilteredData();
    const effectiveAgg = getEffectiveAgg(rawData);
    const buckets = aggregateData(rawData, effectiveAgg);
    if (window.innerWidth < 768 && buckets.length > 12) {
      const minW = Math.max(buckets.length * 30, $chartScrollWrap ? $chartScrollWrap.clientWidth : 340);
      $chartCanvasWrap.style.minWidth = `${minW}px`;
    } else {
      $chartCanvasWrap.style.minWidth = "100%";
    }
  }
});

// ── Application Boot ──
await init();
