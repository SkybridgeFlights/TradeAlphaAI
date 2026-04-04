(function () {
  const SOURCE = "https://api.tradealphaai.com/api/performance";
  const liveCopy = {
    ar: {
      metric: "مباشر على Myfxbook",
      updated: "تتبع مباشر"
    },
    en: {
      metric: "Live on Myfxbook",
      updated: "Live tracking"
    },
    de: {
      metric: "Live auf Myfxbook",
      updated: "Live-Tracking"
    }
  };
  let lastPayload = null;

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

  function currentLiveCopy() {
    const lang = document.documentElement.lang === "ar" ? "ar" : document.documentElement.lang === "de" ? "de" : "en";
    return liveCopy[lang] || liveCopy.en;
  }

  function formatMetric(value, options) {
    const labels = currentLiveCopy();
    const num = normalizeNumber(value);
    if (num === null || num === 0) {
      return labels.metric;
    }

    if (options && options.percent) {
      const raw = String(value);
      return raw.includes("%") ? raw : num.toFixed(2).replace(/\.00$/, "") + "%";
    }

    return String(value);
  }

  function formatUpdated(value) {
    const labels = currentLiveCopy();
    if (!value || value === "0") {
      return labels.updated;
    }

    return String(value);
  }

  function applyLiveState() {
    const labels = currentLiveCopy();
    setText("perf-gain", labels.metric);
    setText("perf-drawdown", labels.metric);
    setText("perf-trades", labels.metric);
    setText("perf-updated", labels.updated);
  }

  function renderPerformance(data) {
    lastPayload = data || {};
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
      lastPayload = null;
      applyLiveState();
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyLiveState();
    loadPerformance();
  });

  window.addEventListener("storage", function (event) {
    if (event.key === "ta_lang") {
      if (lastPayload) {
        renderPerformance(lastPayload);
      } else {
        applyLiveState();
      }
    }
  });

  window.addEventListener("ta:languagechange", function () {
    if (lastPayload) {
      renderPerformance(lastPayload);
    } else {
      applyLiveState();
    }
  });
})();
