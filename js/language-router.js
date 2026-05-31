(function () {
  const localizedRoutes = {
    "/": {
        "ar": "/ar/",
        "en": "/"
    },
    "/index.html": {
        "ar": "/ar/index.html",
        "en": "/index.html"
    },
    "/ar/": {
        "ar": "/ar/",
        "en": "/"
    },
    "/ar/index.html": {
        "ar": "/ar/index.html",
        "en": "/index.html"
    },
    "/en/": {
        "ar": "/ar/",
        "en": "/"
    },
    "/en/index.html": {
        "ar": "/ar/index.html",
        "en": "/index.html"
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
    "/insights/": {
        "ar": "/ar/insights/",
        "en": "/insights/"
    },
    "/insights/index.html": {
        "ar": "/ar/insights/index.html",
        "en": "/insights/index.html"
    },
    "/ar/insights/": {
        "ar": "/ar/insights/",
        "en": "/insights/"
    },
    "/ar/insights/index.html": {
        "ar": "/ar/insights/index.html",
        "en": "/insights/index.html"
    },
    "/en/insights/": {
        "ar": "/ar/insights/",
        "en": "/insights/"
    },
    "/en/insights/index.html": {
        "ar": "/ar/insights/index.html",
        "en": "/insights/index.html"
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
    "/cybersecurity-stocks.html": {
        "ar": "/ar/cybersecurity-stocks.html",
        "en": "/cybersecurity-stocks.html"
    },
    "/ar/cybersecurity-stocks.html": {
        "ar": "/ar/cybersecurity-stocks.html",
        "en": "/cybersecurity-stocks.html"
    },
    "/en/cybersecurity-stocks.html": {
        "ar": "/ar/cybersecurity-stocks.html",
        "en": "/cybersecurity-stocks.html"
    },
    "/cloud-stocks.html": {
        "ar": "/ar/cloud-stocks.html",
        "en": "/cloud-stocks.html"
    },
    "/ar/cloud-stocks.html": {
        "ar": "/ar/cloud-stocks.html",
        "en": "/cloud-stocks.html"
    },
    "/en/cloud-stocks.html": {
        "ar": "/ar/cloud-stocks.html",
        "en": "/cloud-stocks.html"
    },
    "/fintech-stocks.html": {
        "ar": "/ar/fintech-stocks.html",
        "en": "/fintech-stocks.html"
    },
    "/ar/fintech-stocks.html": {
        "ar": "/ar/fintech-stocks.html",
        "en": "/fintech-stocks.html"
    },
    "/en/fintech-stocks.html": {
        "ar": "/ar/fintech-stocks.html",
        "en": "/fintech-stocks.html"
    },
    "/defensive-stocks.html": {
        "ar": "/ar/defensive-stocks.html",
        "en": "/defensive-stocks.html"
    },
    "/ar/defensive-stocks.html": {
        "ar": "/ar/defensive-stocks.html",
        "en": "/defensive-stocks.html"
    },
    "/en/defensive-stocks.html": {
        "ar": "/ar/defensive-stocks.html",
        "en": "/defensive-stocks.html"
    },
    "/ai-etfs.html": {
        "ar": "/ar/ai-etfs.html",
        "en": "/ai-etfs.html"
    },
    "/ar/ai-etfs.html": {
        "ar": "/ar/ai-etfs.html",
        "en": "/ai-etfs.html"
    },
    "/en/ai-etfs.html": {
        "ar": "/ar/ai-etfs.html",
        "en": "/ai-etfs.html"
    },
    "/defensive-etfs.html": {
        "ar": "/ar/defensive-etfs.html",
        "en": "/defensive-etfs.html"
    },
    "/ar/defensive-etfs.html": {
        "ar": "/ar/defensive-etfs.html",
        "en": "/defensive-etfs.html"
    },
    "/en/defensive-etfs.html": {
        "ar": "/ar/defensive-etfs.html",
        "en": "/defensive-etfs.html"
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
    "/stocks/abbv.html": {
        "ar": "/ar/stocks/abbv.html",
        "en": "/stocks/abbv.html"
    },
    "/ar/stocks/abbv.html": {
        "ar": "/ar/stocks/abbv.html",
        "en": "/stocks/abbv.html"
    },
    "/en/stocks/abbv.html": {
        "ar": "/ar/stocks/abbv.html",
        "en": "/stocks/abbv.html"
    },
    "/stocks/abnb.html": {
        "ar": "/ar/stocks/abnb.html",
        "en": "/stocks/abnb.html"
    },
    "/ar/stocks/abnb.html": {
        "ar": "/ar/stocks/abnb.html",
        "en": "/stocks/abnb.html"
    },
    "/en/stocks/abnb.html": {
        "ar": "/ar/stocks/abnb.html",
        "en": "/stocks/abnb.html"
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
    "/stocks/amat.html": {
        "ar": "/ar/stocks/amat.html",
        "en": "/stocks/amat.html"
    },
    "/ar/stocks/amat.html": {
        "ar": "/ar/stocks/amat.html",
        "en": "/stocks/amat.html"
    },
    "/en/stocks/amat.html": {
        "ar": "/ar/stocks/amat.html",
        "en": "/stocks/amat.html"
    },
    "/stocks/amgn.html": {
        "ar": "/ar/stocks/amgn.html",
        "en": "/stocks/amgn.html"
    },
    "/ar/stocks/amgn.html": {
        "ar": "/ar/stocks/amgn.html",
        "en": "/stocks/amgn.html"
    },
    "/en/stocks/amgn.html": {
        "ar": "/ar/stocks/amgn.html",
        "en": "/stocks/amgn.html"
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
    "/stocks/ba.html": {
        "ar": "/ar/stocks/ba.html",
        "en": "/stocks/ba.html"
    },
    "/ar/stocks/ba.html": {
        "ar": "/ar/stocks/ba.html",
        "en": "/stocks/ba.html"
    },
    "/en/stocks/ba.html": {
        "ar": "/ar/stocks/ba.html",
        "en": "/stocks/ba.html"
    },
    "/stocks/blk.html": {
        "ar": "/ar/stocks/blk.html",
        "en": "/stocks/blk.html"
    },
    "/ar/stocks/blk.html": {
        "ar": "/ar/stocks/blk.html",
        "en": "/stocks/blk.html"
    },
    "/en/stocks/blk.html": {
        "ar": "/ar/stocks/blk.html",
        "en": "/stocks/blk.html"
    },
    "/stocks/cat.html": {
        "ar": "/ar/stocks/cat.html",
        "en": "/stocks/cat.html"
    },
    "/ar/stocks/cat.html": {
        "ar": "/ar/stocks/cat.html",
        "en": "/stocks/cat.html"
    },
    "/en/stocks/cat.html": {
        "ar": "/ar/stocks/cat.html",
        "en": "/stocks/cat.html"
    },
    "/stocks/cost.html": {
        "ar": "/ar/stocks/cost.html",
        "en": "/stocks/cost.html"
    },
    "/ar/stocks/cost.html": {
        "ar": "/ar/stocks/cost.html",
        "en": "/stocks/cost.html"
    },
    "/en/stocks/cost.html": {
        "ar": "/ar/stocks/cost.html",
        "en": "/stocks/cost.html"
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
    "/stocks/cvx.html": {
        "ar": "/ar/stocks/cvx.html",
        "en": "/stocks/cvx.html"
    },
    "/ar/stocks/cvx.html": {
        "ar": "/ar/stocks/cvx.html",
        "en": "/stocks/cvx.html"
    },
    "/en/stocks/cvx.html": {
        "ar": "/ar/stocks/cvx.html",
        "en": "/stocks/cvx.html"
    },
    "/stocks/ddog.html": {
        "ar": "/ar/stocks/ddog.html",
        "en": "/stocks/ddog.html"
    },
    "/ar/stocks/ddog.html": {
        "ar": "/ar/stocks/ddog.html",
        "en": "/stocks/ddog.html"
    },
    "/en/stocks/ddog.html": {
        "ar": "/ar/stocks/ddog.html",
        "en": "/stocks/ddog.html"
    },
    "/stocks/de.html": {
        "ar": "/ar/stocks/de.html",
        "en": "/stocks/de.html"
    },
    "/ar/stocks/de.html": {
        "ar": "/ar/stocks/de.html",
        "en": "/stocks/de.html"
    },
    "/en/stocks/de.html": {
        "ar": "/ar/stocks/de.html",
        "en": "/stocks/de.html"
    },
    "/stocks/dis.html": {
        "ar": "/ar/stocks/dis.html",
        "en": "/stocks/dis.html"
    },
    "/ar/stocks/dis.html": {
        "ar": "/ar/stocks/dis.html",
        "en": "/stocks/dis.html"
    },
    "/en/stocks/dis.html": {
        "ar": "/ar/stocks/dis.html",
        "en": "/stocks/dis.html"
    },
    "/stocks/ftnt.html": {
        "ar": "/ar/stocks/ftnt.html",
        "en": "/stocks/ftnt.html"
    },
    "/ar/stocks/ftnt.html": {
        "ar": "/ar/stocks/ftnt.html",
        "en": "/stocks/ftnt.html"
    },
    "/en/stocks/ftnt.html": {
        "ar": "/ar/stocks/ftnt.html",
        "en": "/stocks/ftnt.html"
    },
    "/stocks/ge.html": {
        "ar": "/ar/stocks/ge.html",
        "en": "/stocks/ge.html"
    },
    "/ar/stocks/ge.html": {
        "ar": "/ar/stocks/ge.html",
        "en": "/stocks/ge.html"
    },
    "/en/stocks/ge.html": {
        "ar": "/ar/stocks/ge.html",
        "en": "/stocks/ge.html"
    },
    "/stocks/gild.html": {
        "ar": "/ar/stocks/gild.html",
        "en": "/stocks/gild.html"
    },
    "/ar/stocks/gild.html": {
        "ar": "/ar/stocks/gild.html",
        "en": "/stocks/gild.html"
    },
    "/en/stocks/gild.html": {
        "ar": "/ar/stocks/gild.html",
        "en": "/stocks/gild.html"
    },
    "/stocks/gs.html": {
        "ar": "/ar/stocks/gs.html",
        "en": "/stocks/gs.html"
    },
    "/ar/stocks/gs.html": {
        "ar": "/ar/stocks/gs.html",
        "en": "/stocks/gs.html"
    },
    "/en/stocks/gs.html": {
        "ar": "/ar/stocks/gs.html",
        "en": "/stocks/gs.html"
    },
    "/stocks/hon.html": {
        "ar": "/ar/stocks/hon.html",
        "en": "/stocks/hon.html"
    },
    "/ar/stocks/hon.html": {
        "ar": "/ar/stocks/hon.html",
        "en": "/stocks/hon.html"
    },
    "/en/stocks/hon.html": {
        "ar": "/ar/stocks/hon.html",
        "en": "/stocks/hon.html"
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
    "/stocks/intu.html": {
        "ar": "/ar/stocks/intu.html",
        "en": "/stocks/intu.html"
    },
    "/ar/stocks/intu.html": {
        "ar": "/ar/stocks/intu.html",
        "en": "/stocks/intu.html"
    },
    "/en/stocks/intu.html": {
        "ar": "/ar/stocks/intu.html",
        "en": "/stocks/intu.html"
    },
    "/stocks/jnj.html": {
        "ar": "/ar/stocks/jnj.html",
        "en": "/stocks/jnj.html"
    },
    "/ar/stocks/jnj.html": {
        "ar": "/ar/stocks/jnj.html",
        "en": "/stocks/jnj.html"
    },
    "/en/stocks/jnj.html": {
        "ar": "/ar/stocks/jnj.html",
        "en": "/stocks/jnj.html"
    },
    "/stocks/jpm.html": {
        "ar": "/ar/stocks/jpm.html",
        "en": "/stocks/jpm.html"
    },
    "/ar/stocks/jpm.html": {
        "ar": "/ar/stocks/jpm.html",
        "en": "/stocks/jpm.html"
    },
    "/en/stocks/jpm.html": {
        "ar": "/ar/stocks/jpm.html",
        "en": "/stocks/jpm.html"
    },
    "/stocks/klac.html": {
        "ar": "/ar/stocks/klac.html",
        "en": "/stocks/klac.html"
    },
    "/ar/stocks/klac.html": {
        "ar": "/ar/stocks/klac.html",
        "en": "/stocks/klac.html"
    },
    "/en/stocks/klac.html": {
        "ar": "/ar/stocks/klac.html",
        "en": "/stocks/klac.html"
    },
    "/stocks/ko.html": {
        "ar": "/ar/stocks/ko.html",
        "en": "/stocks/ko.html"
    },
    "/ar/stocks/ko.html": {
        "ar": "/ar/stocks/ko.html",
        "en": "/stocks/ko.html"
    },
    "/en/stocks/ko.html": {
        "ar": "/ar/stocks/ko.html",
        "en": "/stocks/ko.html"
    },
    "/stocks/lly.html": {
        "ar": "/ar/stocks/lly.html",
        "en": "/stocks/lly.html"
    },
    "/ar/stocks/lly.html": {
        "ar": "/ar/stocks/lly.html",
        "en": "/stocks/lly.html"
    },
    "/en/stocks/lly.html": {
        "ar": "/ar/stocks/lly.html",
        "en": "/stocks/lly.html"
    },
    "/stocks/lmt.html": {
        "ar": "/ar/stocks/lmt.html",
        "en": "/stocks/lmt.html"
    },
    "/ar/stocks/lmt.html": {
        "ar": "/ar/stocks/lmt.html",
        "en": "/stocks/lmt.html"
    },
    "/en/stocks/lmt.html": {
        "ar": "/ar/stocks/lmt.html",
        "en": "/stocks/lmt.html"
    },
    "/stocks/lulu.html": {
        "ar": "/ar/stocks/lulu.html",
        "en": "/stocks/lulu.html"
    },
    "/ar/stocks/lulu.html": {
        "ar": "/ar/stocks/lulu.html",
        "en": "/stocks/lulu.html"
    },
    "/en/stocks/lulu.html": {
        "ar": "/ar/stocks/lulu.html",
        "en": "/stocks/lulu.html"
    },
    "/stocks/ma.html": {
        "ar": "/ar/stocks/ma.html",
        "en": "/stocks/ma.html"
    },
    "/ar/stocks/ma.html": {
        "ar": "/ar/stocks/ma.html",
        "en": "/stocks/ma.html"
    },
    "/en/stocks/ma.html": {
        "ar": "/ar/stocks/ma.html",
        "en": "/stocks/ma.html"
    },
    "/stocks/mcd.html": {
        "ar": "/ar/stocks/mcd.html",
        "en": "/stocks/mcd.html"
    },
    "/ar/stocks/mcd.html": {
        "ar": "/ar/stocks/mcd.html",
        "en": "/stocks/mcd.html"
    },
    "/en/stocks/mcd.html": {
        "ar": "/ar/stocks/mcd.html",
        "en": "/stocks/mcd.html"
    },
    "/stocks/mdb.html": {
        "ar": "/ar/stocks/mdb.html",
        "en": "/stocks/mdb.html"
    },
    "/ar/stocks/mdb.html": {
        "ar": "/ar/stocks/mdb.html",
        "en": "/stocks/mdb.html"
    },
    "/en/stocks/mdb.html": {
        "ar": "/ar/stocks/mdb.html",
        "en": "/stocks/mdb.html"
    },
    "/stocks/mrk.html": {
        "ar": "/ar/stocks/mrk.html",
        "en": "/stocks/mrk.html"
    },
    "/ar/stocks/mrk.html": {
        "ar": "/ar/stocks/mrk.html",
        "en": "/stocks/mrk.html"
    },
    "/en/stocks/mrk.html": {
        "ar": "/ar/stocks/mrk.html",
        "en": "/stocks/mrk.html"
    },
    "/stocks/mrvl.html": {
        "ar": "/ar/stocks/mrvl.html",
        "en": "/stocks/mrvl.html"
    },
    "/ar/stocks/mrvl.html": {
        "ar": "/ar/stocks/mrvl.html",
        "en": "/stocks/mrvl.html"
    },
    "/en/stocks/mrvl.html": {
        "ar": "/ar/stocks/mrvl.html",
        "en": "/stocks/mrvl.html"
    },
    "/stocks/ms.html": {
        "ar": "/ar/stocks/ms.html",
        "en": "/stocks/ms.html"
    },
    "/ar/stocks/ms.html": {
        "ar": "/ar/stocks/ms.html",
        "en": "/stocks/ms.html"
    },
    "/en/stocks/ms.html": {
        "ar": "/ar/stocks/ms.html",
        "en": "/stocks/ms.html"
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
    "/stocks/net.html": {
        "ar": "/ar/stocks/net.html",
        "en": "/stocks/net.html"
    },
    "/ar/stocks/net.html": {
        "ar": "/ar/stocks/net.html",
        "en": "/stocks/net.html"
    },
    "/en/stocks/net.html": {
        "ar": "/ar/stocks/net.html",
        "en": "/stocks/net.html"
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
    "/stocks/nke.html": {
        "ar": "/ar/stocks/nke.html",
        "en": "/stocks/nke.html"
    },
    "/ar/stocks/nke.html": {
        "ar": "/ar/stocks/nke.html",
        "en": "/stocks/nke.html"
    },
    "/en/stocks/nke.html": {
        "ar": "/ar/stocks/nke.html",
        "en": "/stocks/nke.html"
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
    "/stocks/nvo.html": {
        "ar": "/ar/stocks/nvo.html",
        "en": "/stocks/nvo.html"
    },
    "/ar/stocks/nvo.html": {
        "ar": "/ar/stocks/nvo.html",
        "en": "/stocks/nvo.html"
    },
    "/en/stocks/nvo.html": {
        "ar": "/ar/stocks/nvo.html",
        "en": "/stocks/nvo.html"
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
    "/stocks/pep.html": {
        "ar": "/ar/stocks/pep.html",
        "en": "/stocks/pep.html"
    },
    "/ar/stocks/pep.html": {
        "ar": "/ar/stocks/pep.html",
        "en": "/stocks/pep.html"
    },
    "/en/stocks/pep.html": {
        "ar": "/ar/stocks/pep.html",
        "en": "/stocks/pep.html"
    },
    "/stocks/pg.html": {
        "ar": "/ar/stocks/pg.html",
        "en": "/stocks/pg.html"
    },
    "/ar/stocks/pg.html": {
        "ar": "/ar/stocks/pg.html",
        "en": "/stocks/pg.html"
    },
    "/en/stocks/pg.html": {
        "ar": "/ar/stocks/pg.html",
        "en": "/stocks/pg.html"
    },
    "/stocks/pypl.html": {
        "ar": "/ar/stocks/pypl.html",
        "en": "/stocks/pypl.html"
    },
    "/ar/stocks/pypl.html": {
        "ar": "/ar/stocks/pypl.html",
        "en": "/stocks/pypl.html"
    },
    "/en/stocks/pypl.html": {
        "ar": "/ar/stocks/pypl.html",
        "en": "/stocks/pypl.html"
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
    "/stocks/rtx.html": {
        "ar": "/ar/stocks/rtx.html",
        "en": "/stocks/rtx.html"
    },
    "/ar/stocks/rtx.html": {
        "ar": "/ar/stocks/rtx.html",
        "en": "/stocks/rtx.html"
    },
    "/en/stocks/rtx.html": {
        "ar": "/ar/stocks/rtx.html",
        "en": "/stocks/rtx.html"
    },
    "/stocks/sbux.html": {
        "ar": "/ar/stocks/sbux.html",
        "en": "/stocks/sbux.html"
    },
    "/ar/stocks/sbux.html": {
        "ar": "/ar/stocks/sbux.html",
        "en": "/stocks/sbux.html"
    },
    "/en/stocks/sbux.html": {
        "ar": "/ar/stocks/sbux.html",
        "en": "/stocks/sbux.html"
    },
    "/stocks/shop.html": {
        "ar": "/ar/stocks/shop.html",
        "en": "/stocks/shop.html"
    },
    "/ar/stocks/shop.html": {
        "ar": "/ar/stocks/shop.html",
        "en": "/stocks/shop.html"
    },
    "/en/stocks/shop.html": {
        "ar": "/ar/stocks/shop.html",
        "en": "/stocks/shop.html"
    },
    "/stocks/slb.html": {
        "ar": "/ar/stocks/slb.html",
        "en": "/stocks/slb.html"
    },
    "/ar/stocks/slb.html": {
        "ar": "/ar/stocks/slb.html",
        "en": "/stocks/slb.html"
    },
    "/en/stocks/slb.html": {
        "ar": "/ar/stocks/slb.html",
        "en": "/stocks/slb.html"
    },
    "/stocks/snow.html": {
        "ar": "/ar/stocks/snow.html",
        "en": "/stocks/snow.html"
    },
    "/ar/stocks/snow.html": {
        "ar": "/ar/stocks/snow.html",
        "en": "/stocks/snow.html"
    },
    "/en/stocks/snow.html": {
        "ar": "/ar/stocks/snow.html",
        "en": "/stocks/snow.html"
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
    "/stocks/ttd.html": {
        "ar": "/ar/stocks/ttd.html",
        "en": "/stocks/ttd.html"
    },
    "/ar/stocks/ttd.html": {
        "ar": "/ar/stocks/ttd.html",
        "en": "/stocks/ttd.html"
    },
    "/en/stocks/ttd.html": {
        "ar": "/ar/stocks/ttd.html",
        "en": "/stocks/ttd.html"
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
    "/stocks/uber.html": {
        "ar": "/ar/stocks/uber.html",
        "en": "/stocks/uber.html"
    },
    "/ar/stocks/uber.html": {
        "ar": "/ar/stocks/uber.html",
        "en": "/stocks/uber.html"
    },
    "/en/stocks/uber.html": {
        "ar": "/ar/stocks/uber.html",
        "en": "/stocks/uber.html"
    },
    "/stocks/unh.html": {
        "ar": "/ar/stocks/unh.html",
        "en": "/stocks/unh.html"
    },
    "/ar/stocks/unh.html": {
        "ar": "/ar/stocks/unh.html",
        "en": "/stocks/unh.html"
    },
    "/en/stocks/unh.html": {
        "ar": "/ar/stocks/unh.html",
        "en": "/stocks/unh.html"
    },
    "/stocks/v.html": {
        "ar": "/ar/stocks/v.html",
        "en": "/stocks/v.html"
    },
    "/ar/stocks/v.html": {
        "ar": "/ar/stocks/v.html",
        "en": "/stocks/v.html"
    },
    "/en/stocks/v.html": {
        "ar": "/ar/stocks/v.html",
        "en": "/stocks/v.html"
    },
    "/stocks/wday.html": {
        "ar": "/ar/stocks/wday.html",
        "en": "/stocks/wday.html"
    },
    "/ar/stocks/wday.html": {
        "ar": "/ar/stocks/wday.html",
        "en": "/stocks/wday.html"
    },
    "/en/stocks/wday.html": {
        "ar": "/ar/stocks/wday.html",
        "en": "/stocks/wday.html"
    },
    "/stocks/wmt.html": {
        "ar": "/ar/stocks/wmt.html",
        "en": "/stocks/wmt.html"
    },
    "/ar/stocks/wmt.html": {
        "ar": "/ar/stocks/wmt.html",
        "en": "/stocks/wmt.html"
    },
    "/en/stocks/wmt.html": {
        "ar": "/ar/stocks/wmt.html",
        "en": "/stocks/wmt.html"
    },
    "/stocks/xom.html": {
        "ar": "/ar/stocks/xom.html",
        "en": "/stocks/xom.html"
    },
    "/ar/stocks/xom.html": {
        "ar": "/ar/stocks/xom.html",
        "en": "/stocks/xom.html"
    },
    "/en/stocks/xom.html": {
        "ar": "/ar/stocks/xom.html",
        "en": "/stocks/xom.html"
    },
    "/stocks/zs.html": {
        "ar": "/ar/stocks/zs.html",
        "en": "/stocks/zs.html"
    },
    "/ar/stocks/zs.html": {
        "ar": "/ar/stocks/zs.html",
        "en": "/stocks/zs.html"
    },
    "/en/stocks/zs.html": {
        "ar": "/ar/stocks/zs.html",
        "en": "/stocks/zs.html"
    },
    "/etfs/arkg.html": {
        "ar": "/ar/etfs/arkg.html",
        "en": "/etfs/arkg.html"
    },
    "/ar/etfs/arkg.html": {
        "ar": "/ar/etfs/arkg.html",
        "en": "/etfs/arkg.html"
    },
    "/en/etfs/arkg.html": {
        "ar": "/ar/etfs/arkg.html",
        "en": "/etfs/arkg.html"
    },
    "/etfs/arkk.html": {
        "ar": "/ar/etfs/arkk.html",
        "en": "/etfs/arkk.html"
    },
    "/ar/etfs/arkk.html": {
        "ar": "/ar/etfs/arkk.html",
        "en": "/etfs/arkk.html"
    },
    "/en/etfs/arkk.html": {
        "ar": "/ar/etfs/arkk.html",
        "en": "/etfs/arkk.html"
    },
    "/etfs/arkq.html": {
        "ar": "/ar/etfs/arkq.html",
        "en": "/etfs/arkq.html"
    },
    "/ar/etfs/arkq.html": {
        "ar": "/ar/etfs/arkq.html",
        "en": "/etfs/arkq.html"
    },
    "/en/etfs/arkq.html": {
        "ar": "/ar/etfs/arkq.html",
        "en": "/etfs/arkq.html"
    },
    "/etfs/bnd.html": {
        "ar": "/ar/etfs/bnd.html",
        "en": "/etfs/bnd.html"
    },
    "/ar/etfs/bnd.html": {
        "ar": "/ar/etfs/bnd.html",
        "en": "/etfs/bnd.html"
    },
    "/en/etfs/bnd.html": {
        "ar": "/ar/etfs/bnd.html",
        "en": "/etfs/bnd.html"
    },
    "/etfs/botz.html": {
        "ar": "/ar/etfs/botz.html",
        "en": "/etfs/botz.html"
    },
    "/ar/etfs/botz.html": {
        "ar": "/ar/etfs/botz.html",
        "en": "/etfs/botz.html"
    },
    "/en/etfs/botz.html": {
        "ar": "/ar/etfs/botz.html",
        "en": "/etfs/botz.html"
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
    "/etfs/eem.html": {
        "ar": "/ar/etfs/eem.html",
        "en": "/etfs/eem.html"
    },
    "/ar/etfs/eem.html": {
        "ar": "/ar/etfs/eem.html",
        "en": "/etfs/eem.html"
    },
    "/en/etfs/eem.html": {
        "ar": "/ar/etfs/eem.html",
        "en": "/etfs/eem.html"
    },
    "/etfs/efa.html": {
        "ar": "/ar/etfs/efa.html",
        "en": "/etfs/efa.html"
    },
    "/ar/etfs/efa.html": {
        "ar": "/ar/etfs/efa.html",
        "en": "/etfs/efa.html"
    },
    "/en/etfs/efa.html": {
        "ar": "/ar/etfs/efa.html",
        "en": "/etfs/efa.html"
    },
    "/etfs/gdx.html": {
        "ar": "/ar/etfs/gdx.html",
        "en": "/etfs/gdx.html"
    },
    "/ar/etfs/gdx.html": {
        "ar": "/ar/etfs/gdx.html",
        "en": "/etfs/gdx.html"
    },
    "/en/etfs/gdx.html": {
        "ar": "/ar/etfs/gdx.html",
        "en": "/etfs/gdx.html"
    },
    "/etfs/hyg.html": {
        "ar": "/ar/etfs/hyg.html",
        "en": "/etfs/hyg.html"
    },
    "/ar/etfs/hyg.html": {
        "ar": "/ar/etfs/hyg.html",
        "en": "/etfs/hyg.html"
    },
    "/en/etfs/hyg.html": {
        "ar": "/ar/etfs/hyg.html",
        "en": "/etfs/hyg.html"
    },
    "/etfs/icln.html": {
        "ar": "/ar/etfs/icln.html",
        "en": "/etfs/icln.html"
    },
    "/ar/etfs/icln.html": {
        "ar": "/ar/etfs/icln.html",
        "en": "/etfs/icln.html"
    },
    "/en/etfs/icln.html": {
        "ar": "/ar/etfs/icln.html",
        "en": "/etfs/icln.html"
    },
    "/etfs/ief.html": {
        "ar": "/ar/etfs/ief.html",
        "en": "/etfs/ief.html"
    },
    "/ar/etfs/ief.html": {
        "ar": "/ar/etfs/ief.html",
        "en": "/etfs/ief.html"
    },
    "/en/etfs/ief.html": {
        "ar": "/ar/etfs/ief.html",
        "en": "/etfs/ief.html"
    },
    "/etfs/iemg.html": {
        "ar": "/ar/etfs/iemg.html",
        "en": "/etfs/iemg.html"
    },
    "/ar/etfs/iemg.html": {
        "ar": "/ar/etfs/iemg.html",
        "en": "/etfs/iemg.html"
    },
    "/en/etfs/iemg.html": {
        "ar": "/ar/etfs/iemg.html",
        "en": "/etfs/iemg.html"
    },
    "/etfs/jepi.html": {
        "ar": "/ar/etfs/jepi.html",
        "en": "/etfs/jepi.html"
    },
    "/ar/etfs/jepi.html": {
        "ar": "/ar/etfs/jepi.html",
        "en": "/etfs/jepi.html"
    },
    "/en/etfs/jepi.html": {
        "ar": "/ar/etfs/jepi.html",
        "en": "/etfs/jepi.html"
    },
    "/etfs/lqd.html": {
        "ar": "/ar/etfs/lqd.html",
        "en": "/etfs/lqd.html"
    },
    "/ar/etfs/lqd.html": {
        "ar": "/ar/etfs/lqd.html",
        "en": "/etfs/lqd.html"
    },
    "/en/etfs/lqd.html": {
        "ar": "/ar/etfs/lqd.html",
        "en": "/etfs/lqd.html"
    },
    "/etfs/mtum.html": {
        "ar": "/ar/etfs/mtum.html",
        "en": "/etfs/mtum.html"
    },
    "/ar/etfs/mtum.html": {
        "ar": "/ar/etfs/mtum.html",
        "en": "/etfs/mtum.html"
    },
    "/en/etfs/mtum.html": {
        "ar": "/ar/etfs/mtum.html",
        "en": "/etfs/mtum.html"
    },
    "/etfs/qual.html": {
        "ar": "/ar/etfs/qual.html",
        "en": "/etfs/qual.html"
    },
    "/ar/etfs/qual.html": {
        "ar": "/ar/etfs/qual.html",
        "en": "/etfs/qual.html"
    },
    "/en/etfs/qual.html": {
        "ar": "/ar/etfs/qual.html",
        "en": "/etfs/qual.html"
    },
    "/etfs/robo.html": {
        "ar": "/ar/etfs/robo.html",
        "en": "/etfs/robo.html"
    },
    "/ar/etfs/robo.html": {
        "ar": "/ar/etfs/robo.html",
        "en": "/etfs/robo.html"
    },
    "/en/etfs/robo.html": {
        "ar": "/ar/etfs/robo.html",
        "en": "/etfs/robo.html"
    },
    "/etfs/rsp.html": {
        "ar": "/ar/etfs/rsp.html",
        "en": "/etfs/rsp.html"
    },
    "/ar/etfs/rsp.html": {
        "ar": "/ar/etfs/rsp.html",
        "en": "/etfs/rsp.html"
    },
    "/en/etfs/rsp.html": {
        "ar": "/ar/etfs/rsp.html",
        "en": "/etfs/rsp.html"
    },
    "/etfs/schg.html": {
        "ar": "/ar/etfs/schg.html",
        "en": "/etfs/schg.html"
    },
    "/ar/etfs/schg.html": {
        "ar": "/ar/etfs/schg.html",
        "en": "/etfs/schg.html"
    },
    "/en/etfs/schg.html": {
        "ar": "/ar/etfs/schg.html",
        "en": "/etfs/schg.html"
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
    "/etfs/soxl.html": {
        "ar": "/ar/etfs/soxl.html",
        "en": "/etfs/soxl.html"
    },
    "/ar/etfs/soxl.html": {
        "ar": "/ar/etfs/soxl.html",
        "en": "/etfs/soxl.html"
    },
    "/en/etfs/soxl.html": {
        "ar": "/ar/etfs/soxl.html",
        "en": "/etfs/soxl.html"
    },
    "/etfs/tqqq.html": {
        "ar": "/ar/etfs/tqqq.html",
        "en": "/etfs/tqqq.html"
    },
    "/ar/etfs/tqqq.html": {
        "ar": "/ar/etfs/tqqq.html",
        "en": "/etfs/tqqq.html"
    },
    "/en/etfs/tqqq.html": {
        "ar": "/ar/etfs/tqqq.html",
        "en": "/etfs/tqqq.html"
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
    "/etfs/vlue.html": {
        "ar": "/ar/etfs/vlue.html",
        "en": "/etfs/vlue.html"
    },
    "/ar/etfs/vlue.html": {
        "ar": "/ar/etfs/vlue.html",
        "en": "/etfs/vlue.html"
    },
    "/en/etfs/vlue.html": {
        "ar": "/ar/etfs/vlue.html",
        "en": "/etfs/vlue.html"
    },
    "/etfs/vnq.html": {
        "ar": "/ar/etfs/vnq.html",
        "en": "/etfs/vnq.html"
    },
    "/ar/etfs/vnq.html": {
        "ar": "/ar/etfs/vnq.html",
        "en": "/etfs/vnq.html"
    },
    "/en/etfs/vnq.html": {
        "ar": "/ar/etfs/vnq.html",
        "en": "/etfs/vnq.html"
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
    "/etfs/vxus.html": {
        "ar": "/ar/etfs/vxus.html",
        "en": "/etfs/vxus.html"
    },
    "/ar/etfs/vxus.html": {
        "ar": "/ar/etfs/vxus.html",
        "en": "/etfs/vxus.html"
    },
    "/en/etfs/vxus.html": {
        "ar": "/ar/etfs/vxus.html",
        "en": "/etfs/vxus.html"
    },
    "/etfs/xbi.html": {
        "ar": "/ar/etfs/xbi.html",
        "en": "/etfs/xbi.html"
    },
    "/ar/etfs/xbi.html": {
        "ar": "/ar/etfs/xbi.html",
        "en": "/etfs/xbi.html"
    },
    "/en/etfs/xbi.html": {
        "ar": "/ar/etfs/xbi.html",
        "en": "/etfs/xbi.html"
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
    "/insights/etf-education-expense-ratios-and-tracking-differences.html": {
        "ar": "/ar/insights/etf-education-expense-ratios-and-tracking-differences.html",
        "en": "/insights/etf-education-expense-ratios-and-tracking-differences.html"
    },
    "/ar/insights/etf-education-expense-ratios-and-tracking-differences.html": {
        "ar": "/ar/insights/etf-education-expense-ratios-and-tracking-differences.html",
        "en": "/insights/etf-education-expense-ratios-and-tracking-differences.html"
    },
    "/en/insights/etf-education-expense-ratios-and-tracking-differences.html": {
        "ar": "/ar/insights/etf-education-expense-ratios-and-tracking-differences.html",
        "en": "/insights/etf-education-expense-ratios-and-tracking-differences.html"
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
    "/insights/interest-rate-research-interest-rate-sensitivity-in-growth-stocks.html": {
        "ar": "/ar/insights/interest-rate-research-interest-rate-sensitivity-in-growth-stocks.html",
        "en": "/insights/interest-rate-research-interest-rate-sensitivity-in-growth-stocks.html"
    },
    "/ar/insights/interest-rate-research-interest-rate-sensitivity-in-growth-stocks.html": {
        "ar": "/ar/insights/interest-rate-research-interest-rate-sensitivity-in-growth-stocks.html",
        "en": "/insights/interest-rate-research-interest-rate-sensitivity-in-growth-stocks.html"
    },
    "/en/insights/interest-rate-research-interest-rate-sensitivity-in-growth-stocks.html": {
        "ar": "/ar/insights/interest-rate-research-interest-rate-sensitivity-in-growth-stocks.html",
        "en": "/insights/interest-rate-research-interest-rate-sensitivity-in-growth-stocks.html"
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
  const isArabicPath = currentPath === "/ar" || currentPath.startsWith("/ar/");
  const currentLocale = isArabicPath ? "ar" : "en";
  function resolveRoute(p) {
    if (localizedRoutes[p]) return localizedRoutes[p];
    var withExt = (!p.endsWith('/') && !p.endsWith('.html')) ? p + '.html' : p;
    if (withExt !== p && localizedRoutes[withExt]) return localizedRoutes[withExt];
    var n = withExt, m;
    m = n.match(/^\/stocks\/([a-z0-9.-]+\.html)$/i);
    if (m) { var f = m[1].toLowerCase(); return { ar: "/ar/stocks/" + f, en: "/stocks/" + f }; }
    m = n.match(/^\/ar\/stocks\/([a-z0-9.-]+\.html)$/i);
    if (m) { var f = m[1].toLowerCase(); return { ar: "/ar/stocks/" + f, en: "/stocks/" + f }; }
    m = n.match(/^\/en\/stocks\/([a-z0-9.-]+\.html)$/i);
    if (m) { var f = m[1].toLowerCase(); return { ar: "/ar/stocks/" + f, en: "/stocks/" + f }; }
    m = n.match(/^\/etfs\/([a-z0-9.-]+\.html)$/i);
    if (m) { var f = m[1].toLowerCase(); return { ar: "/ar/etfs/" + f, en: "/etfs/" + f }; }
    m = n.match(/^\/ar\/etfs\/([a-z0-9.-]+\.html)$/i);
    if (m) { var f = m[1].toLowerCase(); return { ar: "/ar/etfs/" + f, en: "/etfs/" + f }; }
    m = n.match(/^\/en\/etfs\/([a-z0-9.-]+\.html)$/i);
    if (m) { var f = m[1].toLowerCase(); return { ar: "/ar/etfs/" + f, en: "/etfs/" + f }; }
    m = n.match(/^\/insights\/([a-z0-9.-]+\.html)$/i);
    if (m) { var f = m[1].toLowerCase(); return { ar: "/ar/insights/" + f, en: "/insights/" + f }; }
    m = n.match(/^\/ar\/insights\/([a-z0-9.-]+\.html)$/i);
    if (m) { var f = m[1].toLowerCase(); return { ar: "/ar/insights/" + f, en: "/insights/" + f }; }
    m = n.match(/^\/en\/insights\/([a-z0-9.-]+\.html)$/i);
    if (m) { var f = m[1].toLowerCase(); return { ar: "/ar/insights/" + f, en: "/insights/" + f }; }
    return { ar: "/ar/", en: "/" };
  }
  const routes = resolveRoute(currentPath);
  document.documentElement.lang = currentLocale;
  document.documentElement.dir = currentLocale === "ar" ? "rtl" : "ltr";
  document.body.classList.toggle("localized-ar", currentLocale === "ar");
  document.body.classList.toggle("localized-en", currentLocale === "en");
  try { localStorage.setItem("ta_lang", currentLocale); } catch (_) {}
  function setActiveLanguage(link, locale) {
    var active = locale === currentLocale;
    link.classList.toggle("active", active);
    if (active) { link.setAttribute("aria-current", "true"); } else { link.removeAttribute("aria-current"); }
  }
  document.querySelectorAll("[data-locale-route]").forEach(function (link) {
    var locale = link.getAttribute("data-locale-route");
    link.setAttribute("href", routes[locale] || routes.en || "/");
    link.textContent = locale === "ar" ? "\u0627\u0644\u0639\u0631\u0628\u064a\u0629" : "English";
    link.addEventListener("click", function () {
      try { localStorage.setItem("ta_lang", locale); } catch (_) {}
    });
    setActiveLanguage(link, locale);
  });
  document.querySelectorAll("a[href]").forEach(function (link) {
    if (link.hasAttribute("data-locale-route") || link.target === "_blank") return;
    var rawHref = link.getAttribute("href");
    if (!rawHref || rawHref.startsWith("#") || /^(mailto:|tel:|https?:\/\/|\/\/)/i.test(rawHref)) return;
    var url;
    try { url = new URL(rawHref, window.location.origin); } catch (_) { return; }
    if (url.origin !== window.location.origin) return;
    var mapped = localizedRoutes[url.pathname];
    if (!mapped || !mapped[currentLocale]) return;
    link.setAttribute("href", mapped[currentLocale] + url.search + url.hash);
  });
})();
