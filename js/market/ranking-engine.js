import { buildTradeAlphaScore } from "./scoring-engine.js";

function isAr() {
  return document.documentElement.lang === "ar" || document.documentElement.dir === "rtl";
}

function text(en, ar) { return isAr() ? ar : en; }

function assetHref(asset) {
  const folder = asset.type === "etf" ? "etfs" : "stocks";
  const file = `/${folder}/${asset.symbol.toLowerCase()}.html`;
  return isAr() ? `/ar${file}` : file;
}

function fmtPrice(p) {
  if (p == null) return null;
  return "$" + Number(p).toFixed(2);
}

function fmtChange(c) {
  if (c == null) return null;
  const n = Number(c);
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

function scoreLabel(finalScore) {
  if (finalScore >= 78) return text("Strong Setup", "إعداد قوي");
  if (finalScore >= 64) return text("Watchlist Candidate", "مرشح للمتابعة");
  if (finalScore >= 46) return text("Neutral", "محايد");
  return text("Weak Setup", "إعداد ضعيف");
}

// Shared live-price cache and in-flight guard across all tables on the page
const _priceCache = {};
const _inFlight = new Set();
const ETF_SYMBOLS = new Set([
  "ARKG", "ARKK", "ARKQ", "BND", "BOTZ", "DGRO", "DIA", "EEM", "EFA", "GDX",
  "GLD", "HYG", "ICLN", "IEF", "IEMG", "IWM", "JEPI", "LQD", "MTUM", "QQQ",
  "QUAL", "ROBO", "RSP", "SCHD", "SCHG", "SMH", "SOXL", "SOXX", "SPY", "TLT",
  "TQQQ", "VIG", "VLUE", "VNQ", "VOO", "VTI", "VTV", "VUG", "VXUS", "XBI",
  "XLE", "XLF", "XLK", "XLV", "XLY"
]);

export async function scheduleLivePricePatch(container, assets) {
  const requests = assets.map(normalizePriceRequest);
  await batchFetchPrices(requests, (symbol, data) => {
    patchCells(container, symbol, data);
  });
}

function normalizePriceRequest(asset) {
  const symbol = String(asset?.symbol || asset || "").toUpperCase();
  const explicitType = String(asset?.type || "").toLowerCase();
  return {
    symbol,
    type: explicitType === "etf" || ETF_SYMBOLS.has(symbol) ? "etf" : "stock"
  };
}

async function batchFetchPrices(requests, callback) {
  const CONCURRENCY = 3;
  const queue = requests.map(normalizePriceRequest);

  async function worker() {
    while (queue.length) {
      const { symbol, type } = queue.shift();
      if (!symbol) continue;
      const cacheKey = `${symbol}:${type}`;
      if (_priceCache[cacheKey]) {
        callback(symbol, _priceCache[cacheKey]);
        continue;
      }
      if (_inFlight.has(cacheKey)) continue;
      _inFlight.add(cacheKey);
      try {
        const res = await fetch(`/api/market-data?symbol=${encodeURIComponent(symbol)}&type=${encodeURIComponent(type)}`, {
          headers: { Accept: "application/json" }
        });
        if (res.ok) {
          const payload = await res.json();
          if (payload && payload.asset) {
            const data = {
              price: payload.asset.price,
              changePercent: payload.asset.changePercent,
              isMock: !!(payload.fallback || payload.provider === "mock")
            };
            _priceCache[cacheKey] = data;
            callback(symbol, data);
          }
        }
      } catch (_) {
        // silent — keep placeholder
      } finally {
        _inFlight.delete(cacheKey);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

function patchCells(container, symbol, data) {
  const root = container || document;
  const priceEl = root.querySelector(`[data-live-price="${symbol}"]`);
  const changeEl = root.querySelector(`[data-live-change="${symbol}"]`);

  if (priceEl && data.price != null) {
    priceEl.textContent = fmtPrice(data.price);
    priceEl.classList.toggle("live-price", !data.isMock);
    priceEl.classList.remove("live-loading");
  }
  if (changeEl && data.changePercent != null) {
    changeEl.textContent = fmtChange(data.changePercent);
    changeEl.className = "change-cell " + (data.changePercent >= 0 ? "price-up" : "price-down");
    if (!data.isMock) changeEl.classList.add("live-change");
  }
}

export function renderRankingTable(selector, assets, opts = {}) {
  const target = document.querySelector(selector);
  if (!target) return;

  const rows = assets.map(asset => ({ asset, score: buildTradeAlphaScore(asset) }));
  rows.sort((a, b) => b.score.finalScore - a.score.finalScore);

  target.innerHTML = buildTableHtml(rows, opts.caption);
  attachSortHandlers(target);
  scheduleLivePricePatch(target, assets);
}

function buildTableHtml(rows, caption) {
  const hSymbol = text("Symbol", "الرمز");
  const hName = text("Name", "الاسم");
  const hScore = text("Score", "الدرجة");
  const hPrice = text("Price", "السعر");
  const hChange = text("Change%", "التغيير%");
  const hSector = text("Sector / Category", "القطاع / الفئة");
  const hMomentum = text("Momentum", "الزخم");

  return `
<div class="ranking-table-wrap">
  <table class="ranking-table" aria-label="${caption || ""}">
    <thead>
      <tr>
        <th class="col-rank">#</th>
        <th class="col-symbol sortable" data-sort="symbol">${hSymbol} <span class="sort-icon">↕</span></th>
        <th class="col-name">${hName}</th>
        <th class="col-score sortable" data-sort="score">${hScore} <span class="sort-icon">↓</span></th>
        <th class="col-price sortable" data-sort="price">${hPrice} <span class="sort-icon">↕</span></th>
        <th class="col-change sortable" data-sort="change">${hChange} <span class="sort-icon">↕</span></th>
        <th class="col-sector">${hSector}</th>
        <th class="col-momentum">${hMomentum}</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((row, i) => buildTableRow(row, i + 1)).join("")}
    </tbody>
  </table>
</div>`;
}

function buildTableRow({ asset, score }, rank) {
  const href = assetHref(asset);
  const sector = (asset.research && asset.research.sector) || asset.sector || asset.category || "—";
  const momentum = asset.macdTrend || "neutral";
  const momentumClass = momentum === "bullish" ? "momentum-up" : momentum === "bearish" ? "momentum-down" : "momentum-neutral";
  const momentumLabel = text(
    momentum === "bullish" ? "Bullish" : momentum === "bearish" ? "Bearish" : "Neutral",
    momentum === "bullish" ? "صاعد" : momentum === "bearish" ? "هابط" : "محايد"
  );
  const scoreClass = score.finalScore >= 70 ? "badge-strong" : score.finalScore >= 55 ? "badge-watch" : "badge-neutral";

  return `<tr data-symbol="${asset.symbol}">
    <td class="col-rank rank-num">${rank}</td>
    <td class="col-symbol"><a class="symbol-link" href="${href}"><strong>${asset.symbol}</strong></a></td>
    <td class="col-name asset-name"><a href="${href}">${asset.name}</a></td>
    <td class="col-score score-cell">
      <span class="score-badge ${scoreClass}">${score.finalScore}</span>
      <small>${score.label}</small>
    </td>
    <td class="col-price price-cell" data-live-price="${asset.symbol}">
      <span class="live-loading">…</span>
    </td>
    <td class="col-change change-cell" data-live-change="${asset.symbol}">
      <span class="live-loading">…</span>
    </td>
    <td class="col-sector sector-cell">${sector}</td>
    <td class="col-momentum momentum-cell ${momentumClass}">${momentumLabel}</td>
  </tr>`;
}

function attachSortHandlers(container) {
  let currentSort = "score";
  let currentDir = "desc";

  container.querySelectorAll("th[data-sort]").forEach(th => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      currentDir = (currentSort === key && currentDir === "desc") ? "asc" : "desc";
      currentSort = key;
      reSort(container, key, currentDir);
      container.querySelectorAll("th[data-sort] .sort-icon").forEach(ic => {
        ic.textContent = ic.closest("th").dataset.sort === key
          ? (currentDir === "asc" ? "↑" : "↓")
          : "↕";
      });
    });
  });
}

function reSort(container, key, dir) {
  const tbody = container.querySelector("tbody");
  if (!tbody) return;
  const trs = Array.from(tbody.querySelectorAll("tr[data-symbol]"));
  trs.sort((a, b) => {
    let av = 0, bv = 0;
    if (key === "symbol") {
      return dir === "asc"
        ? a.dataset.symbol.localeCompare(b.dataset.symbol)
        : b.dataset.symbol.localeCompare(a.dataset.symbol);
    }
    if (key === "score") {
      av = parseFloat(a.querySelector(".score-badge")?.textContent) || 0;
      bv = parseFloat(b.querySelector(".score-badge")?.textContent) || 0;
    }
    if (key === "price") {
      av = parseFloat(a.querySelector("[data-live-price]")?.textContent?.replace(/[$,+%]/g, "")) || 0;
      bv = parseFloat(b.querySelector("[data-live-price]")?.textContent?.replace(/[$,+%]/g, "")) || 0;
    }
    if (key === "change") {
      av = parseFloat(a.querySelector("[data-live-change]")?.textContent) || 0;
      bv = parseFloat(b.querySelector("[data-live-change]")?.textContent) || 0;
    }
    return dir === "asc" ? av - bv : bv - av;
  });
  trs.forEach((tr, i) => {
    const rankEl = tr.querySelector(".rank-num");
    if (rankEl) rankEl.textContent = i + 1;
    tbody.appendChild(tr);
  });
}
