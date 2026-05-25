(function () {
  const translations = {
    ar: {
      meta: {
        locale: "ar_AR",
        homeTitle: "TradeAlphaAI | منصة أبحاث السوق",
        homeDescription: "TradeAlphaAI منصة أبحاث سوق ثابتة لتحليل الأسهم وصناديق المؤشرات والتصنيفات والماسحات والمقالات التعليمية.",
        homeUrl: "https://www.tradealphaai.com/",
        homeOgType: "website",
        image: "https://www.tradealphaai.com/Image/og-image.svg",
        imageAlt: "معاينة منصة TradeAlphaAI للأبحاث",
        twitterCard: "summary_large_image"
      },
      "brand.tagline": "منصة أبحاث السوق"
    },
    en: {
      meta: {
        locale: "en_US",
        homeTitle: "TradeAlphaAI | Market Research Platform",
        homeDescription: "TradeAlphaAI is a static market research platform for stock analysis, ETF research, rankings, screeners, and educational articles.",
        homeUrl: "https://www.tradealphaai.com/",
        homeOgType: "website",
        image: "https://www.tradealphaai.com/Image/og-image.svg",
        imageAlt: "TradeAlphaAI market research platform preview",
        twitterCard: "summary_large_image"
      },
      "brand.tagline": "Market Research Platform"
    }
  };

  function getLanguage() {
    return document.documentElement.lang === "ar" || location.pathname.startsWith("/ar/") ? "ar" : "en";
  }

  window.TradeAlphaLandingI18n = {
    translations,
    getLanguage
  };
})();
