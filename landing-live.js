(function () {
  const SOURCE = "runtime/performance.json";
  const LIVE_STATE = "Live tracking";
  const LIVE_METRIC = "Live on Myfxbook";

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const node = byId(id);
    if (node) {
      node.textContent = value;
    }
  }

  function normalizeNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const num = typeof value === "number" ? value : Number(String(value).replace(/[%,$\s]/g, ""));
    return Number.isFinite(num) ? num : null;
  }

  function formatMetric(value, options) {
    const num = normalizeNumber(value);
    if (num === null || num === 0) {
      return LIVE_METRIC;
    }

    if (options && options.percent) {
      const raw = String(value);
      return raw.includes("%") ? raw : num.toFixed(2).replace(/\.00$/, "") + "%";
    }

    return String(value);
  }

  function formatUpdated(value) {
    if (!value || value === "0") {
      return LIVE_STATE;
    }

    return String(value);
  }

  function applyLiveState() {
    setText("perf-gain", LIVE_METRIC);
    setText("perf-drawdown", LIVE_METRIC);
    setText("perf-trades", LIVE_METRIC);
    setText("perf-updated", LIVE_STATE);
  }

  function renderPerformance(data) {
    const gain = data && data.gain;
    const drawdown = data && data.drawdown;
    const trades = data && data.trades;
    const lastUpdated = data && data.last_updated;
    const myfxbookUrl = data && data.myfxbook_url;

    setText("perf-gain", formatMetric(gain, { percent: true }));
    setText("perf-drawdown", formatMetric(drawdown, { percent: true }));
    setText("perf-trades", formatMetric(trades));
    setText("perf-updated", formatUpdated(lastUpdated));

    if (myfxbookUrl) {
      const cta = byId("proof-cta-link");
      if (cta) {
        cta.href = myfxbookUrl;
      }
    }
  }

  async function loadPerformance() {
    try {
      const response = await fetch(SOURCE, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Performance source unavailable");
      }

      const data = await response.json();
      renderPerformance(data || {});
    } catch (error) {
      applyLiveState();
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyLiveState();
    loadPerformance();
  });
})();
