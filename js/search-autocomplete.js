(function () {
  var indexPromise;

  function isArabic() {
    return document.documentElement.lang === "ar" || document.documentElement.dir === "rtl";
  }

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch("/data/search-index.json", { headers: { Accept: "application/json" } })
        .then(function (response) { return response.ok ? response.json() : { items: [] }; })
        .then(function (data) { return data.items || []; })
        .catch(function () { return []; });
    }
    return indexPromise;
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function matchItems(items, query) {
    var q = normalize(query);
    if (!q) return [];
    return items.filter(function (item) {
      return normalize([item.symbol, item.name, item.sector, item.category, item.keywords, item.arKeywords].join(" ")).indexOf(q) !== -1;
    }).slice(0, 8);
  }

  function attach(input) {
    if (input.dataset.autocompleteReady === "true") return;
    input.dataset.autocompleteReady = "true";
    input.setAttribute("autocomplete", "off");

    var panel = document.createElement("div");
    panel.className = "search-suggest-panel";
    panel.hidden = true;
    input.insertAdjacentElement("afterend", panel);

    function close() {
      panel.hidden = true;
      panel.innerHTML = "";
    }

    function open(items) {
      if (!items.length) return close();
      var ar = isArabic();
      panel.innerHTML = items.map(function (item) {
        var href = ar ? item.arHref : item.href;
        var type = ar ? (item.type === "etf" ? "صندوق مؤشرات" : "سهم") : item.type.toUpperCase();
        return '<a href="' + href + '"><strong>' + item.symbol + '</strong><span>' + item.name + '</span><small>' + type + ' / ' + (item.sector || item.category || '') + '</small></a>';
      }).join("");
      panel.hidden = false;
    }

    input.addEventListener("input", function () {
      loadIndex().then(function (items) { open(matchItems(items, input.value)); });
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Escape") close();
      if (event.key === "Enter" && !panel.hidden) {
        var first = panel.querySelector("a");
        if (first && normalize(input.value).length >= 2) {
          event.preventDefault();
          window.location.href = first.href;
        }
      }
    });

    document.addEventListener("click", function (event) {
      if (!panel.contains(event.target) && event.target !== input) close();
    });
  }

  function init() {
    document.querySelectorAll('.market-search[type="search"], input[type="search"][data-filter-query]').forEach(attach);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
}());
