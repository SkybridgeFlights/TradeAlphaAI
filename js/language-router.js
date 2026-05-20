(function () {
  const localizedRoutes = {
    "/": { ar: "/ar/", en: "/" },
    "/index.html": { ar: "/ar/", en: "/" },
    "/insights/": { ar: "/ar/insights/", en: "/insights/" },
    "/insights/index.html": { ar: "/ar/insights/", en: "/insights/" },
    "/methodology.html": { ar: "/ar/methodology.html", en: "/methodology.html" },
    "/insights/ai-infrastructure-demand.html": { ar: "/ar/insights/ai-infrastructure-demand.html", en: "/insights/ai-infrastructure-demand.html" },
    "/insights/spy-vs-qqq-explained.html": { ar: "/ar/insights/spy-vs-qqq-explained.html", en: "/insights/spy-vs-qqq-explained.html" },
    "/insights/semiconductor-cycle-risks.html": { ar: "/ar/insights/semiconductor-cycle-risks.html", en: "/insights/semiconductor-cycle-risks.html" },
    "/ar/": { ar: "/ar/", en: "/" },
    "/ar/index.html": { ar: "/ar/", en: "/" },
    "/ar/insights/": { ar: "/ar/insights/", en: "/insights/" },
    "/ar/insights/index.html": { ar: "/ar/insights/", en: "/insights/" },
    "/ar/methodology.html": { ar: "/ar/methodology.html", en: "/methodology.html" },
    "/ar/insights/ai-infrastructure-demand.html": { ar: "/ar/insights/ai-infrastructure-demand.html", en: "/insights/ai-infrastructure-demand.html" },
    "/ar/insights/spy-vs-qqq-explained.html": { ar: "/ar/insights/spy-vs-qqq-explained.html", en: "/insights/spy-vs-qqq-explained.html" },
    "/ar/insights/semiconductor-cycle-risks.html": { ar: "/ar/insights/semiconductor-cycle-risks.html", en: "/insights/semiconductor-cycle-risks.html" },
    "/en/": { ar: "/ar/", en: "/en/" },
    "/en/index.html": { ar: "/ar/", en: "/en/" },
    "/en/insights/": { ar: "/ar/insights/", en: "/en/insights/" },
    "/en/insights/index.html": { ar: "/ar/insights/", en: "/en/insights/" },
    "/en/methodology.html": { ar: "/ar/methodology.html", en: "/en/methodology.html" },
    "/en/insights/ai-infrastructure-demand.html": { ar: "/ar/insights/ai-infrastructure-demand.html", en: "/en/insights/ai-infrastructure-demand.html" },
    "/en/insights/spy-vs-qqq-explained.html": { ar: "/ar/insights/spy-vs-qqq-explained.html", en: "/en/insights/spy-vs-qqq-explained.html" },
    "/en/insights/semiconductor-cycle-risks.html": { ar: "/ar/insights/semiconductor-cycle-risks.html", en: "/en/insights/semiconductor-cycle-risks.html" }
  };

  const path = window.location.pathname.endsWith("/index.html")
    ? window.location.pathname
    : window.location.pathname;
  const routes = localizedRoutes[path] || { ar: "/ar/", en: "/" };

  document.querySelectorAll("[data-locale-route]").forEach((link) => {
    const locale = link.getAttribute("data-locale-route");
    link.setAttribute("href", routes[locale] || routes.en || "/");
  });
})();
