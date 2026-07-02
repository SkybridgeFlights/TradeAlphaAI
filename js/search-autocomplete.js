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
    input.setAttribute("aria-autocomplete", "list");

    var panel = document.createElement("div");
    panel.className = "search-suggest-panel";
    panel.hidden = true;
    panel.setAttribute("role", "listbox");
    input.insertAdjacentElement("afterend", panel);
    var activeIndex = -1;

    function close() {
      panel.hidden = true;
      panel.innerHTML = "";
      activeIndex = -1;
      input.removeAttribute("aria-activedescendant");
    }

    function setActive(index) {
      var links = Array.prototype.slice.call(panel.querySelectorAll("a"));
      if (!links.length) return;
      activeIndex = (index + links.length) % links.length;
      links.forEach(function (link, linkIndex) {
        var active = linkIndex === activeIndex;
        link.classList.toggle("is-active", active);
        link.setAttribute("aria-selected", active ? "true" : "false");
        if (active) input.setAttribute("aria-activedescendant", link.id);
      });
    }

    function open(items) {
      if (!items.length) return close();
      var ar = isArabic();
      activeIndex = -1;
      panel.innerHTML = items.map(function (item, index) {
        var href = ar ? item.arHref : item.href;
        var type = ar ? (item.type === "etf" ? "\u0635\u0646\u062f\u0648\u0642 \u0645\u0624\u0634\u0631\u0627\u062a" : "\u0633\u0647\u0645") : item.type.toUpperCase();
        return '<a id="search-suggest-' + index + '" role="option" aria-selected="false" href="' + href + '"><strong>' + item.symbol + '</strong><span>' + item.name + '</span><small>' + type + ' / ' + (item.sector || item.category || '') + '</small></a>';
      }).join("");
      panel.hidden = false;
    }

    input.addEventListener("input", function () {
      loadIndex().then(function (items) { open(matchItems(items, input.value)); });
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowDown" && !panel.hidden) {
        event.preventDefault();
        setActive(activeIndex + 1);
      }
      if (event.key === "ArrowUp" && !panel.hidden) {
        event.preventDefault();
        setActive(activeIndex - 1);
      }
      if (event.key === "Enter" && !panel.hidden) {
        var links = panel.querySelectorAll("a");
        var selected = links[activeIndex] || links[0];
        if (selected && normalize(input.value).length >= 2) {
          event.preventDefault();
          window.location.href = selected.href;
        }
      }
    });

    document.addEventListener("click", function (event) {
      if (!panel.contains(event.target) && event.target !== input) close();
    });
  }

  function init() {
    document.querySelectorAll('.market-search[type="search"], input[type="search"][data-filter-query], input[type="search"][data-site-search]').forEach(attach);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
}());
