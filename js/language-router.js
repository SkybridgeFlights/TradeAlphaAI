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
    },
    "/stocks.html": {
        "ar": "/ar/stocks.html",
        "en": "/stocks.html"
    },
    "/ar/stocks.html": {
        "ar": "/ar/stocks.html",
        "en": "/stocks.html"
    },
    "/en/stocks.html": {
        "ar": "/ar/stocks.html",
        "en": "/en/stocks.html"
    },
    "/etfs.html": {
        "ar": "/ar/etfs.html",
        "en": "/etfs.html"
    },
    "/ar/etfs.html": {
        "ar": "/ar/etfs.html",
        "en": "/etfs.html"
    },
    "/en/etfs.html": {
        "ar": "/ar/etfs.html",
        "en": "/en/etfs.html"
    },
    "/ai-stock-screener.html": {
        "ar": "/ar/ai-stock-screener.html",
        "en": "/ai-stock-screener.html"
    },
    "/ar/ai-stock-screener.html": {
        "ar": "/ar/ai-stock-screener.html",
        "en": "/ai-stock-screener.html"
    },
    "/en/ai-stock-screener.html": {
        "ar": "/ar/ai-stock-screener.html",
        "en": "/en/ai-stock-screener.html"
    },
    "/market-data-status.html": {
        "ar": "/ar/market-data-status.html",
        "en": "/market-data-status.html"
    },
    "/ar/market-data-status.html": {
        "ar": "/ar/market-data-status.html",
        "en": "/market-data-status.html"
    },
    "/en/market-data-status.html": {
        "ar": "/ar/market-data-status.html",
        "en": "/en/market-data-status.html"
    },
    "/stocks/aapl.html": {
        "ar": "/ar/stocks/aapl.html",
        "en": "/stocks/aapl.html"
    },
    "/ar/stocks/aapl.html": {
        "ar": "/ar/stocks/aapl.html",
        "en": "/stocks/aapl.html"
    },
    "/en/stocks/aapl.html": {
        "ar": "/ar/stocks/aapl.html",
        "en": "/en/stocks/aapl.html"
    },
    "/stocks/tsla.html": {
        "ar": "/ar/stocks/tsla.html",
        "en": "/stocks/tsla.html"
    },
    "/ar/stocks/tsla.html": {
        "ar": "/ar/stocks/tsla.html",
        "en": "/stocks/tsla.html"
    },
    "/en/stocks/tsla.html": {
        "ar": "/ar/stocks/tsla.html",
        "en": "/en/stocks/tsla.html"
    },
    "/stocks/amzn.html": {
        "ar": "/ar/stocks/amzn.html",
        "en": "/stocks/amzn.html"
    },
    "/ar/stocks/amzn.html": {
        "ar": "/ar/stocks/amzn.html",
        "en": "/stocks/amzn.html"
    },
    "/en/stocks/amzn.html": {
        "ar": "/ar/stocks/amzn.html",
        "en": "/en/stocks/amzn.html"
    },
    "/stocks/meta.html": {
        "ar": "/ar/stocks/meta.html",
        "en": "/stocks/meta.html"
    },
    "/ar/stocks/meta.html": {
        "ar": "/ar/stocks/meta.html",
        "en": "/stocks/meta.html"
    },
    "/en/stocks/meta.html": {
        "ar": "/ar/stocks/meta.html",
        "en": "/en/stocks/meta.html"
    },
    "/stocks/googl.html": {
        "ar": "/ar/stocks/googl.html",
        "en": "/stocks/googl.html"
    },
    "/ar/stocks/googl.html": {
        "ar": "/ar/stocks/googl.html",
        "en": "/stocks/googl.html"
    },
    "/en/stocks/googl.html": {
        "ar": "/ar/stocks/googl.html",
        "en": "/en/stocks/googl.html"
    },
    "/stocks/avgo.html": {
        "ar": "/ar/stocks/avgo.html",
        "en": "/stocks/avgo.html"
    },
    "/ar/stocks/avgo.html": {
        "ar": "/ar/stocks/avgo.html",
        "en": "/stocks/avgo.html"
    },
    "/en/stocks/avgo.html": {
        "ar": "/ar/stocks/avgo.html",
        "en": "/en/stocks/avgo.html"
    },
    "/stocks/smci.html": {
        "ar": "/ar/stocks/smci.html",
        "en": "/stocks/smci.html"
    },
    "/ar/stocks/smci.html": {
        "ar": "/ar/stocks/smci.html",
        "en": "/stocks/smci.html"
    },
    "/en/stocks/smci.html": {
        "ar": "/ar/stocks/smci.html",
        "en": "/en/stocks/smci.html"
    },
    "/stocks/pltr.html": {
        "ar": "/ar/stocks/pltr.html",
        "en": "/stocks/pltr.html"
    },
    "/ar/stocks/pltr.html": {
        "ar": "/ar/stocks/pltr.html",
        "en": "/stocks/pltr.html"
    },
    "/en/stocks/pltr.html": {
        "ar": "/ar/stocks/pltr.html",
        "en": "/en/stocks/pltr.html"
    },
    "/etfs/vti.html": {
        "ar": "/ar/etfs/vti.html",
        "en": "/etfs/vti.html"
    },
    "/ar/etfs/vti.html": {
        "ar": "/ar/etfs/vti.html",
        "en": "/etfs/vti.html"
    },
    "/en/etfs/vti.html": {
        "ar": "/ar/etfs/vti.html",
        "en": "/en/etfs/vti.html"
    },
    "/etfs/voo.html": {
        "ar": "/ar/etfs/voo.html",
        "en": "/etfs/voo.html"
    },
    "/ar/etfs/voo.html": {
        "ar": "/ar/etfs/voo.html",
        "en": "/etfs/voo.html"
    },
    "/en/etfs/voo.html": {
        "ar": "/ar/etfs/voo.html",
        "en": "/en/etfs/voo.html"
    },
    "/etfs/gld.html": {
        "ar": "/ar/etfs/gld.html",
        "en": "/etfs/gld.html"
    },
    "/ar/etfs/gld.html": {
        "ar": "/ar/etfs/gld.html",
        "en": "/etfs/gld.html"
    },
    "/en/etfs/gld.html": {
        "ar": "/ar/etfs/gld.html",
        "en": "/en/etfs/gld.html"
    },
    "/etfs/tlt.html": {
        "ar": "/ar/etfs/tlt.html",
        "en": "/etfs/tlt.html"
    },
    "/ar/etfs/tlt.html": {
        "ar": "/ar/etfs/tlt.html",
        "en": "/etfs/tlt.html"
    },
    "/en/etfs/tlt.html": {
        "ar": "/ar/etfs/tlt.html",
        "en": "/en/etfs/tlt.html"
    },
    "/etfs/iwm.html": {
        "ar": "/ar/etfs/iwm.html",
        "en": "/etfs/iwm.html"
    },
    "/ar/etfs/iwm.html": {
        "ar": "/ar/etfs/iwm.html",
        "en": "/etfs/iwm.html"
    },
    "/en/etfs/iwm.html": {
        "ar": "/ar/etfs/iwm.html",
        "en": "/en/etfs/iwm.html"
    },
    "/etfs/xlk.html": {
        "ar": "/ar/etfs/xlk.html",
        "en": "/etfs/xlk.html"
    },
    "/ar/etfs/xlk.html": {
        "ar": "/ar/etfs/xlk.html",
        "en": "/etfs/xlk.html"
    },
    "/en/etfs/xlk.html": {
        "ar": "/ar/etfs/xlk.html",
        "en": "/en/etfs/xlk.html"
    },
    "/etfs/schd.html": {
        "ar": "/ar/etfs/schd.html",
        "en": "/etfs/schd.html"
    },
    "/ar/etfs/schd.html": {
        "ar": "/ar/etfs/schd.html",
        "en": "/etfs/schd.html"
    },
    "/en/etfs/schd.html": {
        "ar": "/ar/etfs/schd.html",
        "en": "/en/etfs/schd.html"
    },
    "/insights/ai-inference-vs-training.html": {
        "ar": "/ar/insights/ai-inference-vs-training.html",
        "en": "/insights/ai-inference-vs-training.html"
    },
    "/ar/insights/ai-inference-vs-training.html": {
        "ar": "/ar/insights/ai-inference-vs-training.html",
        "en": "/insights/ai-inference-vs-training.html"
    },
    "/en/insights/ai-inference-vs-training.html": {
        "ar": "/ar/insights/ai-inference-vs-training.html",
        "en": "/en/insights/ai-inference-vs-training.html"
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
    "/insights/cloud-computing-ai-market-structure.html": {
        "ar": "/ar/insights/cloud-computing-ai-market-structure.html",
        "en": "/insights/cloud-computing-ai-market-structure.html"
    },
    "/ar/insights/cloud-computing-ai-market-structure.html": {
        "ar": "/ar/insights/cloud-computing-ai-market-structure.html",
        "en": "/insights/cloud-computing-ai-market-structure.html"
    },
    "/en/insights/cloud-computing-ai-market-structure.html": {
        "ar": "/ar/insights/cloud-computing-ai-market-structure.html",
        "en": "/en/insights/cloud-computing-ai-market-structure.html"
    },
    "/insights/custom-ai-chips-asics-tpus.html": {
        "ar": "/ar/insights/custom-ai-chips-asics-tpus.html",
        "en": "/insights/custom-ai-chips-asics-tpus.html"
    },
    "/ar/insights/custom-ai-chips-asics-tpus.html": {
        "ar": "/ar/insights/custom-ai-chips-asics-tpus.html",
        "en": "/insights/custom-ai-chips-asics-tpus.html"
    },
    "/en/insights/custom-ai-chips-asics-tpus.html": {
        "ar": "/ar/insights/custom-ai-chips-asics-tpus.html",
        "en": "/en/insights/custom-ai-chips-asics-tpus.html"
    },
    "/insights/etf-expense-ratios-explained.html": {
        "ar": "/ar/insights/etf-expense-ratios-explained.html",
        "en": "/insights/etf-expense-ratios-explained.html"
    },
    "/ar/insights/etf-expense-ratios-explained.html": {
        "ar": "/ar/insights/etf-expense-ratios-explained.html",
        "en": "/insights/etf-expense-ratios-explained.html"
    },
    "/en/insights/etf-expense-ratios-explained.html": {
        "ar": "/ar/insights/etf-expense-ratios-explained.html",
        "en": "/en/insights/etf-expense-ratios-explained.html"
    },
    "/insights/gpu-vs-cpu-ai-workloads.html": {
        "ar": "/ar/insights/gpu-vs-cpu-ai-workloads.html",
        "en": "/insights/gpu-vs-cpu-ai-workloads.html"
    },
    "/ar/insights/gpu-vs-cpu-ai-workloads.html": {
        "ar": "/ar/insights/gpu-vs-cpu-ai-workloads.html",
        "en": "/insights/gpu-vs-cpu-ai-workloads.html"
    },
    "/en/insights/gpu-vs-cpu-ai-workloads.html": {
        "ar": "/ar/insights/gpu-vs-cpu-ai-workloads.html",
        "en": "/en/insights/gpu-vs-cpu-ai-workloads.html"
    },
    "/insights/growth-stocks-vs-value-stocks.html": {
        "ar": "/ar/insights/growth-stocks-vs-value-stocks.html",
        "en": "/insights/growth-stocks-vs-value-stocks.html"
    },
    "/ar/insights/growth-stocks-vs-value-stocks.html": {
        "ar": "/ar/insights/growth-stocks-vs-value-stocks.html",
        "en": "/insights/growth-stocks-vs-value-stocks.html"
    },
    "/en/insights/growth-stocks-vs-value-stocks.html": {
        "ar": "/ar/insights/growth-stocks-vs-value-stocks.html",
        "en": "/en/insights/growth-stocks-vs-value-stocks.html"
    },
    "/insights/hyperscaler-capex-cycles.html": {
        "ar": "/ar/insights/hyperscaler-capex-cycles.html",
        "en": "/insights/hyperscaler-capex-cycles.html"
    },
    "/ar/insights/hyperscaler-capex-cycles.html": {
        "ar": "/ar/insights/hyperscaler-capex-cycles.html",
        "en": "/insights/hyperscaler-capex-cycles.html"
    },
    "/en/insights/hyperscaler-capex-cycles.html": {
        "ar": "/ar/insights/hyperscaler-capex-cycles.html",
        "en": "/en/insights/hyperscaler-capex-cycles.html"
    },
    "/insights/interest-rates-and-tech-stocks.html": {
        "ar": "/ar/insights/interest-rates-and-tech-stocks.html",
        "en": "/insights/interest-rates-and-tech-stocks.html"
    },
    "/ar/insights/interest-rates-and-tech-stocks.html": {
        "ar": "/ar/insights/interest-rates-and-tech-stocks.html",
        "en": "/insights/interest-rates-and-tech-stocks.html"
    },
    "/en/insights/interest-rates-and-tech-stocks.html": {
        "ar": "/ar/insights/interest-rates-and-tech-stocks.html",
        "en": "/en/insights/interest-rates-and-tech-stocks.html"
    },
    "/insights/mega-cap-tech-index-concentration.html": {
        "ar": "/ar/insights/mega-cap-tech-index-concentration.html",
        "en": "/insights/mega-cap-tech-index-concentration.html"
    },
    "/ar/insights/mega-cap-tech-index-concentration.html": {
        "ar": "/ar/insights/mega-cap-tech-index-concentration.html",
        "en": "/insights/mega-cap-tech-index-concentration.html"
    },
    "/en/insights/mega-cap-tech-index-concentration.html": {
        "ar": "/ar/insights/mega-cap-tech-index-concentration.html",
        "en": "/en/insights/mega-cap-tech-index-concentration.html"
    },
    "/insights/portfolio-diversification-basics.html": {
        "ar": "/ar/insights/portfolio-diversification-basics.html",
        "en": "/insights/portfolio-diversification-basics.html"
    },
    "/ar/insights/portfolio-diversification-basics.html": {
        "ar": "/ar/insights/portfolio-diversification-basics.html",
        "en": "/insights/portfolio-diversification-basics.html"
    },
    "/en/insights/portfolio-diversification-basics.html": {
        "ar": "/ar/insights/portfolio-diversification-basics.html",
        "en": "/en/insights/portfolio-diversification-basics.html"
    },
    "/insights/sector-etfs-vs-broad-market.html": {
        "ar": "/ar/insights/sector-etfs-vs-broad-market.html",
        "en": "/insights/sector-etfs-vs-broad-market.html"
    },
    "/ar/insights/sector-etfs-vs-broad-market.html": {
        "ar": "/ar/insights/sector-etfs-vs-broad-market.html",
        "en": "/insights/sector-etfs-vs-broad-market.html"
    },
    "/en/insights/sector-etfs-vs-broad-market.html": {
        "ar": "/ar/insights/sector-etfs-vs-broad-market.html",
        "en": "/en/insights/sector-etfs-vs-broad-market.html"
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
    "/insights/semiconductor-market-research-ai-chip-supply-chain-constraints.html": {
        "ar": "/ar/insights/semiconductor-market-research-ai-chip-supply-chain-constraints.html",
        "en": "/insights/semiconductor-market-research-ai-chip-supply-chain-constraints.html"
    },
    "/ar/insights/semiconductor-market-research-ai-chip-supply-chain-constraints.html": {
        "ar": "/ar/insights/semiconductor-market-research-ai-chip-supply-chain-constraints.html",
        "en": "/insights/semiconductor-market-research-ai-chip-supply-chain-constraints.html"
    },
    "/en/insights/semiconductor-market-research-ai-chip-supply-chain-constraints.html": {
        "ar": "/ar/insights/semiconductor-market-research-ai-chip-supply-chain-constraints.html",
        "en": "/en/insights/semiconductor-market-research-ai-chip-supply-chain-constraints.html"
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
    "/insights/understanding-beta-in-stocks.html": {
        "ar": "/ar/insights/understanding-beta-in-stocks.html",
        "en": "/insights/understanding-beta-in-stocks.html"
    },
    "/ar/insights/understanding-beta-in-stocks.html": {
        "ar": "/ar/insights/understanding-beta-in-stocks.html",
        "en": "/insights/understanding-beta-in-stocks.html"
    },
    "/en/insights/understanding-beta-in-stocks.html": {
        "ar": "/ar/insights/understanding-beta-in-stocks.html",
        "en": "/en/insights/understanding-beta-in-stocks.html"
    }
};

  const currentPath = window.location.pathname;
  const routes = localizedRoutes[currentPath] || { ar: "/ar/", en: "/" };

  document.querySelectorAll("[data-locale-route]").forEach((link) => {
    const locale = link.getAttribute("data-locale-route");
    link.setAttribute("href", routes[locale] || routes.en || "/");
  });
})();
