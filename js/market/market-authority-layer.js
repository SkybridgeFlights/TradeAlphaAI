/* Static market authority layer: educational snapshots, freshness notes, and internal research links. */
(function () {
  "use strict";

  var DATA_PATH = "/data/market-authority-layer.json";
  var cache = null;

  function isAr() {
    return document.documentElement.lang === "ar" || document.documentElement.dir === "rtl";
  }

  function locale() {
    return isAr() ? "ar" : "en";
  }

  function t(entry) {
    return entry && (entry[locale()] || entry.en) || {};
  }

  function rootPrefix() {
    var path = window.location.pathname || "/";
    if (path.startsWith("/ar/")) return "/ar";
    return "";
  }

  function localHref(href) {
    if (!href || href[0] !== "/") return href || "#";
    if (isAr()) return "/ar" + href;
    return href;
  }

  function load() {
    if (cache) return Promise.resolve(cache);
    return fetch(DATA_PATH, { headers: { Accept: "application/json" } })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        cache = data || {};
        return cache;
      })
      .catch(function () { return {}; });
  }

  function renderAll() {
    load().then(function (data) {
      document.querySelectorAll("[data-market-authority]").forEach(function (node) {
        renderAuthority(node, data);
      });
    });
  }

  function renderAuthority(node, data) {
    var placement = node.getAttribute("data-market-authority") || "market";
    var mode = node.getAttribute("data-authority-mode") || "full";
    var placementData = data.placements && data.placements[placement] || data.placements && data.placements.market || {};
    var freshness = t(data.freshness && (data.freshness[placement] || data.freshness.market));
    var snapshots = byKeys(data.snapshots, placementData.snapshots);
    var insights = byKeys(data.insightBlocks, placementData.insights);

    var html = "";
    if (mode !== "insights") html += freshnessHtml(freshness, data.generatedAt);
    if (mode !== "freshness" && mode !== "insights") html += snapshotsHtml(snapshots);
    if (mode !== "freshness" && mode !== "snapshots") html += insightsHtml(insights);
    node.innerHTML = html;
    patchLiveSnapshots(node, snapshots);
  }

  function byKeys(items, keys) {
    var map = {};
    (items || []).forEach(function (item) { map[item.key] = item; });
    return (keys || []).map(function (key) { return map[key]; }).filter(Boolean);
  }

  function freshnessHtml(item, generatedAt) {
    if (!item.title) return "";
    var asOf = generatedAt ? escapeHtml(generatedAt) : "";
    return [
      '<div class="authority-freshness">',
      '<span class="eyebrow">' + escapeHtml(item.eyebrow || "Research Layer") + '</span>',
      '<h2>' + escapeHtml(item.title) + '</h2>',
      '<p class="market-copy">' + escapeHtml(item.body || "") + '</p>',
      asOf ? '<small>' + escapeHtml(isAr() ? "تاريخ سجل البحث الثابت: " : "Static research registry date: ") + asOf + '</small>' : "",
      '</div>'
    ].join("");
  }

  function snapshotsHtml(items) {
    if (!items.length) return "";
    return [
      '<div class="authority-grid authority-snapshots">',
      items.map(function (item) {
        var copy = t(item);
        return [
          '<article class="authority-card" data-authority-symbol="' + escapeAttr(item.symbol) + '" data-authority-type="' + escapeAttr(item.type) + '">',
          '<span class="authority-label">' + escapeHtml(copy.label || item.theme || "") + '</span>',
          '<h3>' + escapeHtml(copy.title || item.symbol) + '</h3>',
          '<p>' + escapeHtml(copy.body || "") + '</p>',
          '<div class="authority-live-row"><strong data-authority-price="' + escapeAttr(item.symbol) + '">' + escapeHtml(item.symbol) + '</strong><span data-authority-change="' + escapeAttr(item.symbol) + '">' + escapeHtml(isAr() ? "ربط مباشر عند التوفر" : "Live hook when available") + '</span></div>',
          '</article>'
        ].join("");
      }).join(""),
      '</div>'
    ].join("");
  }

  function insightsHtml(items) {
    if (!items.length) return "";
    return [
      '<div class="authority-grid authority-insights">',
      items.map(function (item) {
        var copy = t(item);
        var links = (item.links || []).slice(0, 3).map(function (href) {
          return '<a href="' + escapeAttr(localHref(href)) + '">' + escapeHtml(labelFromHref(href)) + '</a>';
        }).join("");
        return [
          '<article class="authority-card authority-insight">',
          '<h3>' + escapeHtml(copy.title || "") + '</h3>',
          '<p>' + escapeHtml(copy.body || "") + '</p>',
          links ? '<div class="authority-links">' + links + '</div>' : "",
          '</article>'
        ].join("");
      }).join(""),
      '</div>'
    ].join("");
  }

  function patchLiveSnapshots(root, snapshots) {
    snapshots.forEach(function (item) {
      if (!item.symbol || !item.type) return;
      fetch("/api/market-data?symbol=" + encodeURIComponent(item.symbol) + "&type=" + encodeURIComponent(item.type), {
        headers: { Accept: "application/json" }
      })
        .then(function (response) { return response.ok ? response.json() : null; })
        .then(function (payload) {
          if (!payload || !payload.asset || payload.fallback) return;
          root.querySelectorAll('[data-authority-price="' + item.symbol + '"]').forEach(function (node) {
            node.textContent = money(payload.asset.price);
          });
          root.querySelectorAll('[data-authority-change="' + item.symbol + '"]').forEach(function (node) {
            var value = Number(payload.asset.changePercent);
            node.textContent = (value >= 0 ? "+" : "") + value.toFixed(2) + "%";
            node.classList.toggle("positive", value >= 0);
            node.classList.toggle("negative", value < 0);
          });
        })
        .catch(function () {});
    });
  }

  function money(value) {
    return Number(value).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  }

  function labelFromHref(href) {
    var clean = String(href || "").replace(/^\/|\.html$/g, "").split("/").pop() || "Research";
    return clean.split("-").filter(Boolean).map(function (part) {
      return part.toUpperCase() === part ? part : part.charAt(0).toUpperCase() + part.slice(1);
    }).join(" ");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderAll);
  } else {
    renderAll();
  }
})();
