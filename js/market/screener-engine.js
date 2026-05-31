import { listMarketAssets } from "./market-data-provider.js";
import { buildTradeAlphaScore } from "./scoring-engine.js";
import { applyFilters, sortRows, getSetupLabels, getMomentumOptions } from "./filter-engine.js";
import { scheduleLivePricePatch } from "./ranking-engine.js";
import { createMockStatus, normalizeDataStatus } from "./data-status.js";
import { renderWatchlistStrip } from "./watchlist.js";

const SEMIS = ["NVDA","AMD","AVGO","TSM","ASML","QCOM","MU","INTC","ARM","MRVL","KLAC","AMAT","TXN","SMCI","SOXX","SMH","SOXL"];

function isAr() {
  return document.documentElement.lang === "ar" || document.documentElement.dir === "rtl";
}

function text(en, ar) { return isAr() ? ar : en; }
function get(sel) { const el = document.querySelector(sel); return el ? el.value : ""; }
function setHtml(sel, v) { const el = document.querySelector(sel); if (el) el.innerHTML = v; }
function setText(sel, v) { const el = document.querySelector(sel); if (el) el.textContent = v; }

const DEFAULT_STATE = {
  query: "", type: "all", minScore: 0, risk: "all", sector: "all",
  category: "all", sentiment: "all", momentum: "all", setupLabel: "all",
  sort: "score", minPrice: 0, maxPrice: 0
};

export async function initLiveScreener() {
  const assets = await listMarketAssets();
  const scores = assets.map(a => buildTradeAlphaScore(a));
  const state = { ...DEFAULT_STATE };

  populateSelects(assets);
  renderThemeStrips(assets, scores);
  renderResults(assets, scores, state);
  renderStatusBar(assets);
  renderWatchlistStrip("[data-watchlist-strip]");

  let timer;
  document.querySelectorAll("[data-screener-control]").forEach(ctrl => {
    ctrl.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        readState(state);
        renderResults(assets, scores, state);
      }, 140);
    });
  });
}

function readState(state) {
  state.query = get("[data-filter-query]").toUpperCase();
  state.type = get("[data-filter-type]") || "all";
  state.minScore = Number(get("[data-filter-score]") || 0);
  state.risk = get("[data-filter-risk]") || "all";
  state.sector = get("[data-filter-sector]") || "all";
  state.category = get("[data-filter-category]") || "all";
  state.sentiment = get("[data-filter-sentiment]") || "all";
  state.momentum = get("[data-filter-momentum]") || "all";
  state.setupLabel = get("[data-filter-setup]") || "all";
  state.sort = get("[data-filter-sort]") || "score";
}

function populateSelects(assets) {
  fill("[data-filter-type]", uniq(assets.map(a => a.type)), text("All assets", "كل الأصول"), {
    stock: text("Stocks", "أسهم"),
    etf: text("ETFs", "صناديق المؤشرات")
  });
  fill("[data-filter-risk]", uniq(assets.map(a => a.risk)).filter(Boolean), text("All risk levels", "كل مستويات المخاطر"), {
    low: text("Low risk", "مخاطر منخفضة"),
    medium: text("Medium risk", "مخاطر متوسطة"),
    high: text("High risk", "مخاطر مرتفعة")
  });
  fill("[data-filter-sector]", uniq(assets.map(a => (a.research && a.research.sector) || a.sector || a.category).filter(Boolean)).sort(),
    text("All sectors", "كل القطاعات"));
  fill("[data-filter-category]", uniq(assets.map(a => (a.research && (a.research.category || a.research.sector)) || a.category || a.sector).filter(Boolean)).sort(),
    text("All categories", "كل الفئات"));
  fill("[data-filter-sentiment]", uniq(assets.map(a => a.sentiment).filter(Boolean)),
    text("All sentiment", "كل المعنويات"), {
      positive: text("Positive", "إيجابي"),
      neutral: text("Neutral", "محايد"),
      mixed: text("Mixed", "مختلط")
    });
  fill("[data-filter-momentum]", getMomentumOptions(), text("All momentum", "كل الزخم"), {
    bullish: text("Bullish", "صاعد"),
    neutral: text("Neutral", "محايد"),
    bearish: text("Bearish", "هابط")
  });
  fill("[data-filter-setup]", getSetupLabels(), text("All setups", "كل الإعدادات"));
}

function fill(selector, options, allLabel, labels = {}) {
  const el = document.querySelector(selector);
  if (!el) return;
  const current = el.value;
  el.innerHTML = `<option value="all">${allLabel}</option>` +
    options.map(v => `<option value="${v}"${v === current ? " selected" : ""}>${labels[v] || v}</option>`).join("");
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function renderThemeStrips(assets, scores) {
  const rows = assets.map((a, i) => ({ asset: a, score: scores[i] }));

  renderStrip("[data-top-picks]",
    rows.filter(r => r.score.finalScore >= 65).slice(0, 6));

  renderStrip("[data-momentum-leaders]",
    [...rows].sort((a, b) => (b.asset.changePercent || 0) - (a.asset.changePercent || 0)).slice(0, 6));

  renderStrip("[data-trending-etfs]",
    rows.filter(r => r.asset.type === "etf")
      .sort((a, b) => b.score.finalScore - a.score.finalScore).slice(0, 6));

  renderStrip("[data-semiconductors]",
    rows.filter(r => /semiconductor/i.test(r.asset.sector || "") || SEMIS.includes(r.asset.symbol))
      .sort((a, b) => b.score.finalScore - a.score.finalScore).slice(0, 6));
}

function renderStrip(selector, rows) {
  const target = document.querySelector(selector);
  if (!target) return;
  target.innerHTML = rows.map(({ asset, score }) => {
    const folder = asset.type === "etf" ? "etfs" : "stocks";
    const href = isAr()
      ? `/ar/${folder}/${asset.symbol.toLowerCase()}.html`
      : `/${folder}/${asset.symbol.toLowerCase()}.html`;
    const momentumClass = asset.macdTrend === "bullish" ? "momentum-up" : asset.macdTrend === "bearish" ? "momentum-down" : "";
    return `<a class="compact-card" href="${href}">
      <strong>${asset.symbol}</strong>
      <span class="score-num">${score.finalScore}<small>/100</small></span>
      <small class="${momentumClass}">${score.label}</small>
    </a>`;
  }).join("");
}

function renderResults(assets, scores, state) {
  const target = document.querySelector("[data-screener-results]");
  if (!target) return;

  const filtered = applyFilters(assets, scores, state);
  const sorted = sortRows(filtered, state.sort);

  setText("[data-screener-count]", text(`${sorted.length} assets`, `${sorted.length} أصل`));

  if (!sorted.length) {
    target.innerHTML = `<div class="market-card empty-state">
      <h2>${text("No matching results", "لا توجد نتائج مطابقة")}</h2>
      <p>${text("Adjust the filters to broaden the screening view.", "عدّل المرشحات لتوسيع نطاق الفحص.")}</p>
    </div>`;
    return;
  }

  target.innerHTML = `
    <div class="screener-live-wrap">
      <table class="screener-live-table" aria-label="${text("Screener results", "نتائج الفحص")}">
        <thead>
          <tr>
            <th class="sortable" data-sort-col="symbol">${text("Symbol", "الرمز")} <span class="sort-icon">↕</span></th>
            <th>${text("Name", "الاسم")}</th>
            <th>${text("Type", "النوع")}</th>
            <th>${text("Sector", "القطاع")}</th>
            <th class="sortable" data-sort-col="change">${text("Change%", "التغيير%")} <span class="sort-icon">↕</span></th>
            <th class="sortable" data-sort-col="price">${text("Price", "السعر")} <span class="sort-icon">↕</span></th>
            <th>${text("Momentum", "الزخم")}</th>
            <th>${text("Risk", "المخاطر")}</th>
            <th class="sortable" data-sort-col="score">${text("Score", "الدرجة")} <span class="sort-icon">↓</span></th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map(({ asset, score }) => buildRow(asset, score)).join("")}
        </tbody>
      </table>
    </div>`;

  attachInlineSort(target);
  scheduleLivePricePatch(target, sorted.map(r => r.asset));
}

function buildRow(asset, score) {
  const folder = asset.type === "etf" ? "etfs" : "stocks";
  const href = isAr()
    ? `/ar/${folder}/${asset.symbol.toLowerCase()}.html`
    : `/${folder}/${asset.symbol.toLowerCase()}.html`;
  const sector = (asset.research && asset.research.sector) || asset.sector || asset.category || "—";
  const typeLabel = asset.type === "etf" ? text("ETF", "صندوق") : text("Stock", "سهم");
  const momentum = asset.macdTrend || "neutral";
  const momentumClass = momentum === "bullish" ? "momentum-up" : momentum === "bearish" ? "momentum-down" : "momentum-neutral";
  const momentumLabel = text(
    momentum === "bullish" ? "Bullish" : momentum === "bearish" ? "Bearish" : "Neutral",
    momentum === "bullish" ? "صاعد" : momentum === "bearish" ? "هابط" : "محايد"
  );
  const riskLabel = { low: text("Low", "منخفضة"), medium: text("Medium", "متوسطة"), high: text("High", "مرتفعة") }[asset.risk] || asset.risk || "—";
  const scoreClass = score.finalScore >= 70 ? "badge-strong" : score.finalScore >= 55 ? "badge-watch" : "badge-neutral";

  return `<tr data-symbol="${asset.symbol}">
    <td><a class="symbol-link" href="${href}"><strong>${asset.symbol}</strong></a></td>
    <td class="asset-name"><a href="${href}">${asset.name}</a></td>
    <td>${typeLabel}</td>
    <td class="sector-cell">${sector}</td>
    <td class="change-cell" data-live-change="${asset.symbol}"><span class="live-loading">…</span></td>
    <td class="price-cell" data-live-price="${asset.symbol}"><span class="live-loading">…</span></td>
    <td class="momentum-cell ${momentumClass}">${momentumLabel}</td>
    <td>${riskLabel}</td>
    <td class="score-cell"><span class="score-badge ${scoreClass}">${score.finalScore}</span> <small>${score.label}</small></td>
  </tr>`;
}

function attachInlineSort(container) {
  let currentSort = "score", dir = "desc";
  container.querySelectorAll("th[data-sort-col]").forEach(th => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      const key = th.dataset.sortCol;
      dir = (currentSort === key && dir === "desc") ? "asc" : "desc";
      currentSort = key;

      const tbody = container.querySelector("tbody");
      if (!tbody) return;
      const trs = Array.from(tbody.querySelectorAll("tr[data-symbol]"));

      trs.sort((a, b) => {
        if (key === "symbol") {
          return dir === "asc"
            ? a.dataset.symbol.localeCompare(b.dataset.symbol)
            : b.dataset.symbol.localeCompare(a.dataset.symbol);
        }
        let av = 0, bv = 0;
        if (key === "score") {
          av = parseFloat(a.querySelector(".score-badge")?.textContent) || 0;
          bv = parseFloat(b.querySelector(".score-badge")?.textContent) || 0;
        } else if (key === "price") {
          av = parseFloat(a.querySelector("[data-live-price]")?.textContent?.replace(/[$,]/g, "")) || 0;
          bv = parseFloat(b.querySelector("[data-live-price]")?.textContent?.replace(/[$,]/g, "")) || 0;
        } else if (key === "change") {
          av = parseFloat(a.querySelector("[data-live-change]")?.textContent) || 0;
          bv = parseFloat(b.querySelector("[data-live-change]")?.textContent) || 0;
        }
        return dir === "asc" ? av - bv : bv - av;
      });

      trs.forEach(tr => tbody.appendChild(tr));
      container.querySelectorAll("th[data-sort-col] .sort-icon").forEach(ic => {
        ic.textContent = ic.closest("th").dataset.sortCol === key ? (dir === "asc" ? "↑" : "↓") : "↕";
      });
    });
  });
}

function renderStatusBar(assets) {
  const target = document.querySelector("[data-screener-status]");
  if (!target) return;
  target.innerHTML = `
    <div class="screener-status-bar">
      <span class="setup-badge status-live">${text(`${assets.length} assets loaded`, `تم تحميل ${assets.length} أصلاً`)}</span>
      <span class="status-note">${text("Live prices loading in background", "جارٍ تحميل الأسعار الحية في الخلفية")}</span>
      <span class="live-dot" aria-hidden="true"></span>
    </div>`;
}
