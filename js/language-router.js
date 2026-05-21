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
        "en": "/"
    },
    "/en/index.html": {
        "ar": "/ar/",
        "en": "/"
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
        "en": "/insights/"
    },
    "/en/insights/index.html": {
        "ar": "/ar/insights/",
        "en": "/insights/"
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
        "en": "/methodology.html"
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
        "en": "/ai-stocks.html"
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
        "en": "/semiconductor-stocks.html"
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
        "en": "/growth-stocks.html"
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
        "en": "/dividend-etfs.html"
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
        "en": "/stocks/nvda.html"
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
        "en": "/stocks/amd.html"
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
        "en": "/stocks/msft.html"
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
        "en": "/etfs/spy.html"
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
        "en": "/etfs/qqq.html"
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
        "en": "/etfs/soxx.html"
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
        "en": "/stocks.html"
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
        "en": "/etfs.html"
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
        "en": "/ai-stock-screener.html"
    },
    "/rankings.html": {
        "ar": "/ar/rankings.html",
        "en": "/rankings.html"
    },
    "/ar/rankings.html": {
        "ar": "/ar/rankings.html",
        "en": "/rankings.html"
    },
    "/en/rankings.html": {
        "ar": "/ar/rankings.html",
        "en": "/rankings.html"
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
        "en": "/market-data-status.html"
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
        "en": "/stocks/aapl.html"
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
        "en": "/stocks/tsla.html"
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
        "en": "/stocks/amzn.html"
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
        "en": "/stocks/meta.html"
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
        "en": "/stocks/googl.html"
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
        "en": "/stocks/avgo.html"
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
        "en": "/stocks/smci.html"
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
        "en": "/stocks/pltr.html"
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
        "en": "/etfs/vti.html"
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
        "en": "/etfs/voo.html"
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
        "en": "/etfs/gld.html"
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
        "en": "/etfs/tlt.html"
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
        "en": "/etfs/iwm.html"
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
        "en": "/etfs/xlk.html"
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
        "en": "/etfs/schd.html"
    },
    "/stocks/adbe.html": {
        "ar": "/ar/stocks/adbe.html",
        "en": "/stocks/adbe.html"
    },
    "/ar/stocks/adbe.html": {
        "ar": "/ar/stocks/adbe.html",
        "en": "/stocks/adbe.html"
    },
    "/en/stocks/adbe.html": {
        "ar": "/ar/stocks/adbe.html",
        "en": "/stocks/adbe.html"
    },
    "/stocks/arm.html": {
        "ar": "/ar/stocks/arm.html",
        "en": "/stocks/arm.html"
    },
    "/ar/stocks/arm.html": {
        "ar": "/ar/stocks/arm.html",
        "en": "/stocks/arm.html"
    },
    "/en/stocks/arm.html": {
        "ar": "/ar/stocks/arm.html",
        "en": "/stocks/arm.html"
    },
    "/stocks/asml.html": {
        "ar": "/ar/stocks/asml.html",
        "en": "/stocks/asml.html"
    },
    "/ar/stocks/asml.html": {
        "ar": "/ar/stocks/asml.html",
        "en": "/stocks/asml.html"
    },
    "/en/stocks/asml.html": {
        "ar": "/ar/stocks/asml.html",
        "en": "/stocks/asml.html"
    },
    "/stocks/crm.html": {
        "ar": "/ar/stocks/crm.html",
        "en": "/stocks/crm.html"
    },
    "/ar/stocks/crm.html": {
        "ar": "/ar/stocks/crm.html",
        "en": "/stocks/crm.html"
    },
    "/en/stocks/crm.html": {
        "ar": "/ar/stocks/crm.html",
        "en": "/stocks/crm.html"
    },
    "/stocks/crwd.html": {
        "ar": "/ar/stocks/crwd.html",
        "en": "/stocks/crwd.html"
    },
    "/ar/stocks/crwd.html": {
        "ar": "/ar/stocks/crwd.html",
        "en": "/stocks/crwd.html"
    },
    "/en/stocks/crwd.html": {
        "ar": "/ar/stocks/crwd.html",
        "en": "/stocks/crwd.html"
    },
    "/stocks/intc.html": {
        "ar": "/ar/stocks/intc.html",
        "en": "/stocks/intc.html"
    },
    "/ar/stocks/intc.html": {
        "ar": "/ar/stocks/intc.html",
        "en": "/stocks/intc.html"
    },
    "/en/stocks/intc.html": {
        "ar": "/ar/stocks/intc.html",
        "en": "/stocks/intc.html"
    },
    "/stocks/mu.html": {
        "ar": "/ar/stocks/mu.html",
        "en": "/stocks/mu.html"
    },
    "/ar/stocks/mu.html": {
        "ar": "/ar/stocks/mu.html",
        "en": "/stocks/mu.html"
    },
    "/en/stocks/mu.html": {
        "ar": "/ar/stocks/mu.html",
        "en": "/stocks/mu.html"
    },
    "/stocks/nflx.html": {
        "ar": "/ar/stocks/nflx.html",
        "en": "/stocks/nflx.html"
    },
    "/ar/stocks/nflx.html": {
        "ar": "/ar/stocks/nflx.html",
        "en": "/stocks/nflx.html"
    },
    "/en/stocks/nflx.html": {
        "ar": "/ar/stocks/nflx.html",
        "en": "/stocks/nflx.html"
    },
    "/stocks/now.html": {
        "ar": "/ar/stocks/now.html",
        "en": "/stocks/now.html"
    },
    "/ar/stocks/now.html": {
        "ar": "/ar/stocks/now.html",
        "en": "/stocks/now.html"
    },
    "/en/stocks/now.html": {
        "ar": "/ar/stocks/now.html",
        "en": "/stocks/now.html"
    },
    "/stocks/orcl.html": {
        "ar": "/ar/stocks/orcl.html",
        "en": "/stocks/orcl.html"
    },
    "/ar/stocks/orcl.html": {
        "ar": "/ar/stocks/orcl.html",
        "en": "/stocks/orcl.html"
    },
    "/en/stocks/orcl.html": {
        "ar": "/ar/stocks/orcl.html",
        "en": "/stocks/orcl.html"
    },
    "/stocks/panw.html": {
        "ar": "/ar/stocks/panw.html",
        "en": "/stocks/panw.html"
    },
    "/ar/stocks/panw.html": {
        "ar": "/ar/stocks/panw.html",
        "en": "/stocks/panw.html"
    },
    "/en/stocks/panw.html": {
        "ar": "/ar/stocks/panw.html",
        "en": "/stocks/panw.html"
    },
    "/stocks/qcom.html": {
        "ar": "/ar/stocks/qcom.html",
        "en": "/stocks/qcom.html"
    },
    "/ar/stocks/qcom.html": {
        "ar": "/ar/stocks/qcom.html",
        "en": "/stocks/qcom.html"
    },
    "/en/stocks/qcom.html": {
        "ar": "/ar/stocks/qcom.html",
        "en": "/stocks/qcom.html"
    },
    "/stocks/tsm.html": {
        "ar": "/ar/stocks/tsm.html",
        "en": "/stocks/tsm.html"
    },
    "/ar/stocks/tsm.html": {
        "ar": "/ar/stocks/tsm.html",
        "en": "/stocks/tsm.html"
    },
    "/en/stocks/tsm.html": {
        "ar": "/ar/stocks/tsm.html",
        "en": "/stocks/tsm.html"
    },
    "/stocks/txn.html": {
        "ar": "/ar/stocks/txn.html",
        "en": "/stocks/txn.html"
    },
    "/ar/stocks/txn.html": {
        "ar": "/ar/stocks/txn.html",
        "en": "/stocks/txn.html"
    },
    "/en/stocks/txn.html": {
        "ar": "/ar/stocks/txn.html",
        "en": "/stocks/txn.html"
    },
    "/etfs/dgro.html": {
        "ar": "/ar/etfs/dgro.html",
        "en": "/etfs/dgro.html"
    },
    "/ar/etfs/dgro.html": {
        "ar": "/ar/etfs/dgro.html",
        "en": "/etfs/dgro.html"
    },
    "/en/etfs/dgro.html": {
        "ar": "/ar/etfs/dgro.html",
        "en": "/etfs/dgro.html"
    },
    "/etfs/dia.html": {
        "ar": "/ar/etfs/dia.html",
        "en": "/etfs/dia.html"
    },
    "/ar/etfs/dia.html": {
        "ar": "/ar/etfs/dia.html",
        "en": "/etfs/dia.html"
    },
    "/en/etfs/dia.html": {
        "ar": "/ar/etfs/dia.html",
        "en": "/etfs/dia.html"
    },
    "/etfs/smh.html": {
        "ar": "/ar/etfs/smh.html",
        "en": "/etfs/smh.html"
    },
    "/ar/etfs/smh.html": {
        "ar": "/ar/etfs/smh.html",
        "en": "/etfs/smh.html"
    },
    "/en/etfs/smh.html": {
        "ar": "/ar/etfs/smh.html",
        "en": "/etfs/smh.html"
    },
    "/etfs/vig.html": {
        "ar": "/ar/etfs/vig.html",
        "en": "/etfs/vig.html"
    },
    "/ar/etfs/vig.html": {
        "ar": "/ar/etfs/vig.html",
        "en": "/etfs/vig.html"
    },
    "/en/etfs/vig.html": {
        "ar": "/ar/etfs/vig.html",
        "en": "/etfs/vig.html"
    },
    "/etfs/vtv.html": {
        "ar": "/ar/etfs/vtv.html",
        "en": "/etfs/vtv.html"
    },
    "/ar/etfs/vtv.html": {
        "ar": "/ar/etfs/vtv.html",
        "en": "/etfs/vtv.html"
    },
    "/en/etfs/vtv.html": {
        "ar": "/ar/etfs/vtv.html",
        "en": "/etfs/vtv.html"
    },
    "/etfs/vug.html": {
        "ar": "/ar/etfs/vug.html",
        "en": "/etfs/vug.html"
    },
    "/ar/etfs/vug.html": {
        "ar": "/ar/etfs/vug.html",
        "en": "/etfs/vug.html"
    },
    "/en/etfs/vug.html": {
        "ar": "/ar/etfs/vug.html",
        "en": "/etfs/vug.html"
    },
    "/etfs/xle.html": {
        "ar": "/ar/etfs/xle.html",
        "en": "/etfs/xle.html"
    },
    "/ar/etfs/xle.html": {
        "ar": "/ar/etfs/xle.html",
        "en": "/etfs/xle.html"
    },
    "/en/etfs/xle.html": {
        "ar": "/ar/etfs/xle.html",
        "en": "/etfs/xle.html"
    },
    "/etfs/xlf.html": {
        "ar": "/ar/etfs/xlf.html",
        "en": "/etfs/xlf.html"
    },
    "/ar/etfs/xlf.html": {
        "ar": "/ar/etfs/xlf.html",
        "en": "/etfs/xlf.html"
    },
    "/en/etfs/xlf.html": {
        "ar": "/ar/etfs/xlf.html",
        "en": "/etfs/xlf.html"
    },
    "/etfs/xlv.html": {
        "ar": "/ar/etfs/xlv.html",
        "en": "/etfs/xlv.html"
    },
    "/ar/etfs/xlv.html": {
        "ar": "/ar/etfs/xlv.html",
        "en": "/etfs/xlv.html"
    },
    "/en/etfs/xlv.html": {
        "ar": "/ar/etfs/xlv.html",
        "en": "/etfs/xlv.html"
    },
    "/etfs/xly.html": {
        "ar": "/ar/etfs/xly.html",
        "en": "/etfs/xly.html"
    },
    "/ar/etfs/xly.html": {
        "ar": "/ar/etfs/xly.html",
        "en": "/etfs/xly.html"
    },
    "/en/etfs/xly.html": {
        "ar": "/ar/etfs/xly.html",
        "en": "/etfs/xly.html"
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
        "en": "/insights/ai-inference-vs-training.html"
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
        "en": "/insights/ai-infrastructure-demand.html"
    },
    "/insights/ai-infrastructure-research-ai-inference-demand-and-capacity-planning.html": {
        "ar": "/ar/insights/ai-infrastructure-research-ai-inference-demand-and-capacity-planning.html",
        "en": "/insights/ai-infrastructure-research-ai-inference-demand-and-capacity-planning.html"
    },
    "/ar/insights/ai-infrastructure-research-ai-inference-demand-and-capacity-planning.html": {
        "ar": "/ar/insights/ai-infrastructure-research-ai-inference-demand-and-capacity-planning.html",
        "en": "/insights/ai-infrastructure-research-ai-inference-demand-and-capacity-planning.html"
    },
    "/en/insights/ai-infrastructure-research-ai-inference-demand-and-capacity-planning.html": {
        "ar": "/ar/insights/ai-infrastructure-research-ai-inference-demand-and-capacity-planning.html",
        "en": "/insights/ai-infrastructure-research-ai-inference-demand-and-capacity-planning.html"
    },
    "/insights/ai-infrastructure-research-data-center-bottlenecks-and-ai-compute-demand.html": {
        "ar": "/ar/insights/ai-infrastructure-research-data-center-bottlenecks-and-ai-compute-demand.html",
        "en": "/insights/ai-infrastructure-research-data-center-bottlenecks-and-ai-compute-demand.html"
    },
    "/ar/insights/ai-infrastructure-research-data-center-bottlenecks-and-ai-compute-demand.html": {
        "ar": "/ar/insights/ai-infrastructure-research-data-center-bottlenecks-and-ai-compute-demand.html",
        "en": "/insights/ai-infrastructure-research-data-center-bottlenecks-and-ai-compute-demand.html"
    },
    "/en/insights/ai-infrastructure-research-data-center-bottlenecks-and-ai-compute-demand.html": {
        "ar": "/ar/insights/ai-infrastructure-research-data-center-bottlenecks-and-ai-compute-demand.html",
        "en": "/insights/ai-infrastructure-research-data-center-bottlenecks-and-ai-compute-demand.html"
    },
    "/insights/ai-infrastructure-research-hyperscaler-spending-signals-for-ai-infrastructure.html": {
        "ar": "/ar/insights/ai-infrastructure-research-hyperscaler-spending-signals-for-ai-infrastructure.html",
        "en": "/insights/ai-infrastructure-research-hyperscaler-spending-signals-for-ai-infrastructure.html"
    },
    "/ar/insights/ai-infrastructure-research-hyperscaler-spending-signals-for-ai-infrastructure.html": {
        "ar": "/ar/insights/ai-infrastructure-research-hyperscaler-spending-signals-for-ai-infrastructure.html",
        "en": "/insights/ai-infrastructure-research-hyperscaler-spending-signals-for-ai-infrastructure.html"
    },
    "/en/insights/ai-infrastructure-research-hyperscaler-spending-signals-for-ai-infrastructure.html": {
        "ar": "/ar/insights/ai-infrastructure-research-hyperscaler-spending-signals-for-ai-infrastructure.html",
        "en": "/insights/ai-infrastructure-research-hyperscaler-spending-signals-for-ai-infrastructure.html"
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
        "en": "/insights/cloud-computing-ai-market-structure.html"
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
        "en": "/insights/custom-ai-chips-asics-tpus.html"
    },
    "/insights/etf-education-etf-structure-and-index-methodology.html": {
        "ar": "/ar/insights/etf-education-etf-structure-and-index-methodology.html",
        "en": "/insights/etf-education-etf-structure-and-index-methodology.html"
    },
    "/ar/insights/etf-education-etf-structure-and-index-methodology.html": {
        "ar": "/ar/insights/etf-education-etf-structure-and-index-methodology.html",
        "en": "/insights/etf-education-etf-structure-and-index-methodology.html"
    },
    "/en/insights/etf-education-etf-structure-and-index-methodology.html": {
        "ar": "/ar/insights/etf-education-etf-structure-and-index-methodology.html",
        "en": "/insights/etf-education-etf-structure-and-index-methodology.html"
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
        "en": "/insights/etf-expense-ratios-explained.html"
    },
    "/insights/gpu-market-research-accelerator-competition-across-ai-workloads.html": {
        "ar": "/ar/insights/gpu-market-research-accelerator-competition-across-ai-workloads.html",
        "en": "/insights/gpu-market-research-accelerator-competition-across-ai-workloads.html"
    },
    "/ar/insights/gpu-market-research-accelerator-competition-across-ai-workloads.html": {
        "ar": "/ar/insights/gpu-market-research-accelerator-competition-across-ai-workloads.html",
        "en": "/insights/gpu-market-research-accelerator-competition-across-ai-workloads.html"
    },
    "/en/insights/gpu-market-research-accelerator-competition-across-ai-workloads.html": {
        "ar": "/ar/insights/gpu-market-research-accelerator-competition-across-ai-workloads.html",
        "en": "/insights/gpu-market-research-accelerator-competition-across-ai-workloads.html"
    },
    "/insights/gpu-market-research-gpu-market-share-and-product-cycle-research.html": {
        "ar": "/ar/insights/gpu-market-research-gpu-market-share-and-product-cycle-research.html",
        "en": "/insights/gpu-market-research-gpu-market-share-and-product-cycle-research.html"
    },
    "/ar/insights/gpu-market-research-gpu-market-share-and-product-cycle-research.html": {
        "ar": "/ar/insights/gpu-market-research-gpu-market-share-and-product-cycle-research.html",
        "en": "/insights/gpu-market-research-gpu-market-share-and-product-cycle-research.html"
    },
    "/en/insights/gpu-market-research-gpu-market-share-and-product-cycle-research.html": {
        "ar": "/ar/insights/gpu-market-research-gpu-market-share-and-product-cycle-research.html",
        "en": "/insights/gpu-market-research-gpu-market-share-and-product-cycle-research.html"
    },
    "/insights/gpu-market-research-gpu-supply-and-demand-signals.html": {
        "ar": "/ar/insights/gpu-market-research-gpu-supply-and-demand-signals.html",
        "en": "/insights/gpu-market-research-gpu-supply-and-demand-signals.html"
    },
    "/ar/insights/gpu-market-research-gpu-supply-and-demand-signals.html": {
        "ar": "/ar/insights/gpu-market-research-gpu-supply-and-demand-signals.html",
        "en": "/insights/gpu-market-research-gpu-supply-and-demand-signals.html"
    },
    "/en/insights/gpu-market-research-gpu-supply-and-demand-signals.html": {
        "ar": "/ar/insights/gpu-market-research-gpu-supply-and-demand-signals.html",
        "en": "/insights/gpu-market-research-gpu-supply-and-demand-signals.html"
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
        "en": "/insights/gpu-vs-cpu-ai-workloads.html"
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
        "en": "/insights/growth-stocks-vs-value-stocks.html"
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
        "en": "/insights/hyperscaler-capex-cycles.html"
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
        "en": "/insights/interest-rates-and-tech-stocks.html"
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
        "en": "/insights/mega-cap-tech-index-concentration.html"
    },
    "/insights/mega-cap-tech-research-mega-cap-concentration-in-passive-indexes.html": {
        "ar": "/ar/insights/mega-cap-tech-research-mega-cap-concentration-in-passive-indexes.html",
        "en": "/insights/mega-cap-tech-research-mega-cap-concentration-in-passive-indexes.html"
    },
    "/ar/insights/mega-cap-tech-research-mega-cap-concentration-in-passive-indexes.html": {
        "ar": "/ar/insights/mega-cap-tech-research-mega-cap-concentration-in-passive-indexes.html",
        "en": "/insights/mega-cap-tech-research-mega-cap-concentration-in-passive-indexes.html"
    },
    "/en/insights/mega-cap-tech-research-mega-cap-concentration-in-passive-indexes.html": {
        "ar": "/ar/insights/mega-cap-tech-research-mega-cap-concentration-in-passive-indexes.html",
        "en": "/insights/mega-cap-tech-research-mega-cap-concentration-in-passive-indexes.html"
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
        "en": "/insights/portfolio-diversification-basics.html"
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
        "en": "/insights/sector-etfs-vs-broad-market.html"
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
        "en": "/insights/semiconductor-cycle-risks.html"
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
        "en": "/insights/semiconductor-market-research-ai-chip-supply-chain-constraints.html"
    },
    "/insights/semiconductor-market-research-inventory-cycles-in-ai-chip-markets.html": {
        "ar": "/ar/insights/semiconductor-market-research-inventory-cycles-in-ai-chip-markets.html",
        "en": "/insights/semiconductor-market-research-inventory-cycles-in-ai-chip-markets.html"
    },
    "/ar/insights/semiconductor-market-research-inventory-cycles-in-ai-chip-markets.html": {
        "ar": "/ar/insights/semiconductor-market-research-inventory-cycles-in-ai-chip-markets.html",
        "en": "/insights/semiconductor-market-research-inventory-cycles-in-ai-chip-markets.html"
    },
    "/en/insights/semiconductor-market-research-inventory-cycles-in-ai-chip-markets.html": {
        "ar": "/ar/insights/semiconductor-market-research-inventory-cycles-in-ai-chip-markets.html",
        "en": "/insights/semiconductor-market-research-inventory-cycles-in-ai-chip-markets.html"
    },
    "/insights/semiconductor-market-research-semiconductor-concentration-risk.html": {
        "ar": "/ar/insights/semiconductor-market-research-semiconductor-concentration-risk.html",
        "en": "/insights/semiconductor-market-research-semiconductor-concentration-risk.html"
    },
    "/ar/insights/semiconductor-market-research-semiconductor-concentration-risk.html": {
        "ar": "/ar/insights/semiconductor-market-research-semiconductor-concentration-risk.html",
        "en": "/insights/semiconductor-market-research-semiconductor-concentration-risk.html"
    },
    "/en/insights/semiconductor-market-research-semiconductor-concentration-risk.html": {
        "ar": "/ar/insights/semiconductor-market-research-semiconductor-concentration-risk.html",
        "en": "/insights/semiconductor-market-research-semiconductor-concentration-risk.html"
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
        "en": "/insights/spy-vs-qqq-explained.html"
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
        "en": "/insights/understanding-beta-in-stocks.html"
    }
};
  const currentPath = window.location.pathname;
  const routes = localizedRoutes[currentPath] || { ar: "/ar/", en: "/" };
  document.querySelectorAll("[data-locale-route]").forEach((link) => {
    const locale = link.getAttribute("data-locale-route");
    link.setAttribute("href", routes[locale] || routes.en || "/");
  });
})();
