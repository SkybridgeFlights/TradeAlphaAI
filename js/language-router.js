(function () {
  const localizedRoutes = {
    "/": {
        "ar": "/ar/",
        "en": "/"
    },
    "/index.html": {
        "ar": "/ar/",
        "en": "/"
    },
    "/ar/": {
        "ar": "/ar/",
        "en": "/"
    },
    "/ar/index.html": {
        "ar": "/ar/",
        "en": "/"
    },
    "/en/": {
        "ar": "/ar/",
        "en": "/en/"
    },
    "/en/index.html": {
        "ar": "/ar/",
        "en": "/en/"
    },
    "/insights/": {
        "ar": "/ar/insights/",
        "en": "/insights/"
    },
    "/insights/index.html": {
        "ar": "/ar/insights/",
        "en": "/insights/"
    },
    "/ar/insights/": {
        "ar": "/ar/insights/",
        "en": "/insights/"
    },
    "/ar/insights/index.html": {
        "ar": "/ar/insights/",
        "en": "/insights/"
    },
    "/en/insights/": {
        "ar": "/ar/insights/",
        "en": "/en/insights/"
    },
    "/en/insights/index.html": {
        "ar": "/ar/insights/",
        "en": "/en/insights/"
    },
    "/methodology.html": {
        "ar": "/ar/methodology.html",
        "en": "/methodology.html"
    },
    "/ar/methodology.html": {
        "ar": "/ar/methodology.html",
        "en": "/methodology.html"
    },
    "/en/methodology.html": {
        "ar": "/ar/methodology.html",
        "en": "/en/methodology.html"
    },
    "/insights/ai-infrastructure-demand.html": {
        "ar": "/ar/insights/ai-infrastructure-demand.html",
        "en": "/insights/ai-infrastructure-demand.html"
    },
    "/ar/insights/ai-infrastructure-demand.html": {
        "ar": "/ar/insights/ai-infrastructure-demand.html",
        "en": "/insights/ai-infrastructure-demand.html"
    },
    "/en/insights/ai-infrastructure-demand.html": {
        "ar": "/ar/insights/ai-infrastructure-demand.html",
        "en": "/en/insights/ai-infrastructure-demand.html"
    },
    "/insights/spy-vs-qqq-explained.html": {
        "ar": "/ar/insights/spy-vs-qqq-explained.html",
        "en": "/insights/spy-vs-qqq-explained.html"
    },
    "/ar/insights/spy-vs-qqq-explained.html": {
        "ar": "/ar/insights/spy-vs-qqq-explained.html",
        "en": "/insights/spy-vs-qqq-explained.html"
    },
    "/en/insights/spy-vs-qqq-explained.html": {
        "ar": "/ar/insights/spy-vs-qqq-explained.html",
        "en": "/en/insights/spy-vs-qqq-explained.html"
    },
    "/insights/semiconductor-cycle-risks.html": {
        "ar": "/ar/insights/semiconductor-cycle-risks.html",
        "en": "/insights/semiconductor-cycle-risks.html"
    },
    "/ar/insights/semiconductor-cycle-risks.html": {
        "ar": "/ar/insights/semiconductor-cycle-risks.html",
        "en": "/insights/semiconductor-cycle-risks.html"
    },
    "/en/insights/semiconductor-cycle-risks.html": {
        "ar": "/ar/insights/semiconductor-cycle-risks.html",
        "en": "/en/insights/semiconductor-cycle-risks.html"
    },
    "/ai-stocks.html": {
        "ar": "/ar/ai-stocks.html",
        "en": "/ai-stocks.html"
    },
    "/ar/ai-stocks.html": {
        "ar": "/ar/ai-stocks.html",
        "en": "/ai-stocks.html"
    },
    "/en/ai-stocks.html": {
        "ar": "/ar/ai-stocks.html",
        "en": "/en/ai-stocks.html"
    },
    "/semiconductor-stocks.html": {
        "ar": "/ar/semiconductor-stocks.html",
        "en": "/semiconductor-stocks.html"
    },
    "/ar/semiconductor-stocks.html": {
        "ar": "/ar/semiconductor-stocks.html",
        "en": "/semiconductor-stocks.html"
    },
    "/en/semiconductor-stocks.html": {
        "ar": "/ar/semiconductor-stocks.html",
        "en": "/en/semiconductor-stocks.html"
    },
    "/growth-stocks.html": {
        "ar": "/ar/growth-stocks.html",
        "en": "/growth-stocks.html"
    },
    "/ar/growth-stocks.html": {
        "ar": "/ar/growth-stocks.html",
        "en": "/growth-stocks.html"
    },
    "/en/growth-stocks.html": {
        "ar": "/ar/growth-stocks.html",
        "en": "/en/growth-stocks.html"
    },
    "/dividend-etfs.html": {
        "ar": "/ar/dividend-etfs.html",
        "en": "/dividend-etfs.html"
    },
    "/ar/dividend-etfs.html": {
        "ar": "/ar/dividend-etfs.html",
        "en": "/dividend-etfs.html"
    },
    "/en/dividend-etfs.html": {
        "ar": "/ar/dividend-etfs.html",
        "en": "/en/dividend-etfs.html"
    },
    "/stocks/nvda.html": {
        "ar": "/ar/stocks/nvda.html",
        "en": "/stocks/nvda.html"
    },
    "/ar/stocks/nvda.html": {
        "ar": "/ar/stocks/nvda.html",
        "en": "/stocks/nvda.html"
    },
    "/en/stocks/nvda.html": {
        "ar": "/ar/stocks/nvda.html",
        "en": "/en/stocks/nvda.html"
    },
    "/stocks/amd.html": {
        "ar": "/ar/stocks/amd.html",
        "en": "/stocks/amd.html"
    },
    "/ar/stocks/amd.html": {
        "ar": "/ar/stocks/amd.html",
        "en": "/stocks/amd.html"
    },
    "/en/stocks/amd.html": {
        "ar": "/ar/stocks/amd.html",
        "en": "/en/stocks/amd.html"
    },
    "/stocks/msft.html": {
        "ar": "/ar/stocks/msft.html",
        "en": "/stocks/msft.html"
    },
    "/ar/stocks/msft.html": {
        "ar": "/ar/stocks/msft.html",
        "en": "/stocks/msft.html"
    },
    "/en/stocks/msft.html": {
        "ar": "/ar/stocks/msft.html",
        "en": "/en/stocks/msft.html"
    },
    "/etfs/spy.html": {
        "ar": "/ar/etfs/spy.html",
        "en": "/etfs/spy.html"
    },
    "/ar/etfs/spy.html": {
        "ar": "/ar/etfs/spy.html",
        "en": "/etfs/spy.html"
    },
    "/en/etfs/spy.html": {
        "ar": "/ar/etfs/spy.html",
        "en": "/en/etfs/spy.html"
    },
    "/etfs/qqq.html": {
        "ar": "/ar/etfs/qqq.html",
        "en": "/etfs/qqq.html"
    },
    "/ar/etfs/qqq.html": {
        "ar": "/ar/etfs/qqq.html",
        "en": "/etfs/qqq.html"
    },
    "/en/etfs/qqq.html": {
        "ar": "/ar/etfs/qqq.html",
        "en": "/en/etfs/qqq.html"
    },
    "/etfs/soxx.html": {
        "ar": "/ar/etfs/soxx.html",
        "en": "/etfs/soxx.html"
    },
    "/ar/etfs/soxx.html": {
        "ar": "/ar/etfs/soxx.html",
        "en": "/etfs/soxx.html"
    },
    "/en/etfs/soxx.html": {
        "ar": "/ar/etfs/soxx.html",
        "en": "/en/etfs/soxx.html"
    }
};

  const currentPath = window.location.pathname;
  const routes = localizedRoutes[currentPath] || { ar: "/ar/", en: "/" };

  document.querySelectorAll("[data-locale-route]").forEach((link) => {
    const locale = link.getAttribute("data-locale-route");
    link.setAttribute("href", routes[locale] || routes.en || "/");
  });
})();
