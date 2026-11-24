/* ================================================================
   app.js — Shop Value Tracker (ES module)
   ================================================================ */

let history = [];
let timeframeDays = 30;
let vbucksChart = null;

const $timeframe = document.getElementById("timeframe");

// ── Boot ──
await init();

async function init() {
  const res = await fetch("data/summary.json");
  history = await res.json();
  setupTimeframe();
  render();
}

// ================================================================
// TIMEFRAME
// ================================================================
function setupTimeframe() {
  $timeframe.addEventListener("change", () => {
    timeframeDays = $timeframe.value === "all" ? Infinity : Number($timeframe.value);
    render();
  });
}

function filtered() {
  if (timeframeDays === Infinity) return history;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - timeframeDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return history.filter((d) => d.date >= cutoffStr);
}

// ================================================================
// RENDER
// ================================================================
function render() {
  const data      = filtered();
  const today     = data.length ? data[data.length - 1] : null;
  const yesterday = data.length > 1 ? data[data.length - 2] : null;

  // --- KPI 1: Today's Shop Value ---
  const $todayVb  = document.getElementById("kpi-today-vbucks");
  const $pill     = document.getElementById("kpi-change-pill");
  const $yestLine = document.getElementById("kpi-yesterday-line");

  $todayVb.textContent = today ? fmt(today.totalVbucks) : "—";

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
    $yestLine.textContent = today ? "No previous day to compare" : "";
  }

  // --- KPI 2: All-Time Highest Shop ---
  const $peakVb     = document.getElementById("kpi-peak-vbucks");
  const $peakDetail = document.getElementById("kpi-peak-detail");

  if (history.length) {
    const peak = history.reduce((best, d) => d.totalVbucks > best.totalVbucks ? d : best, history[0]);
    $peakVb.textContent = fmt(peak.totalVbucks);
    const topName = peak.topItem?.name ?? "—";
    $peakDetail.textContent = `${prettyDate(peak.date)} · ${topName}`;
  } else {
    $peakVb.textContent = "—";
    $peakDetail.textContent = "";
  }

  // --- KPI 3: Average Daily Value ---
  const $avgVb     = document.getElementById("kpi-avg-vbucks");
  const $avgDetail = document.getElementById("kpi-avg-detail");

  if (data.length) {
    const avg = Math.round(data.reduce((s, d) => s + d.totalVbucks, 0) / data.length);
    $avgVb.textContent = fmt(avg);
    $avgDetail.textContent = `Across ${data.length} day${data.length > 1 ? "s" : ""}`;
  } else {
    $avgVb.textContent = "—";
    $avgDetail.textContent = "";
  }

  // --- Chart ---
  renderChart(data);

  // --- Leaderboard ---
  renderLeaderboard(data);
}

// ================================================================
// CHART
// ================================================================
function renderChart(data) {
  const ctx = document.getElementById("vbucks-chart");
  const allTimePeak = history.length ? Math.max(...history.map((d) => d.totalVbucks)) : 0;

  const labels    = data.map((d) => shortDate(d.date));
  const values    = data.map((d) => d.totalVbucks);
  const capValues = values.map(() => allTimePeak);

  if (vbucksChart) vbucksChart.destroy();

  vbucksChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "All-Time Peak",
          data: capValues,
          backgroundColor: "rgba(0,0,0,.04)",
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
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      grouped: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111",
          titleColor: "#fff",
          bodyColor: "#ccc",
          cornerRadius: 8,
          padding: 12,
          titleFont: { weight: "700", size: 13 },
          bodyFont: { size: 12 },
          displayColors: false,
          callbacks: {
            title(items) {
              const i = items[0].dataIndex;
              return data[i] ? prettyDate(data[i].date) : "";
            },
            label(item) {
              if (item.datasetIndex === 0) return null;
              const d = data[item.dataIndex];
              return [`V-Bucks: ${fmt(d.totalVbucks)}`, `Items: ${d.itemCount}`];
            },
          },
          filter(item) { return item.datasetIndex === 1; },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#6b6d64", font: { size: 11 } },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,.05)", drawTicks: false },
          ticks: {
            color: "#6b6d64",
            font: { size: 11 },
            padding: 8,
            callback: (v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v,
          },
          border: { display: false },
        },
      },
    },
  });
}

// ================================================================
// LEADERBOARD
// ================================================================
function renderLeaderboard(data) {
  const $lb = document.getElementById("leaderboard");
  if (!data.length) {
    $lb.innerHTML = '<li style="color:var(--ink-muted);font-size:13px;padding:8px 0">No data yet</li>';
    return;
  }

  const sorted = [...data].sort((a, b) => b.totalVbucks - a.totalVbucks).slice(0, 5);
  const peak   = sorted[0].totalVbucks || 1;

  $lb.innerHTML = sorted.map((d, i) => {
    const pct = ((d.totalVbucks / peak) * 100).toFixed(1);
    return `<li class="lb-row">
      <div class="lb-top">
        <span><span class="lb-rank">#${i + 1}</span><span class="lb-date">${prettyDate(d.date)}</span></span>
        <span class="lb-vbucks">${fmt(d.totalVbucks)}</span>
      </div>
      <div class="lb-bar-bg"><div class="lb-bar-fill" style="width:${pct}%"></div></div>
    </li>`;
  }).join("");
}

// ================================================================
// HELPERS
// ================================================================
function fmt(n) { return n.toLocaleString(); }

function prettyDate(iso) {
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

function shortDate(iso) {
  const [, m, d] = iso.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}
