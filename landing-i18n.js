(function () {
  const translations = {
    ar: {
      meta: {
        locale: "ar_AR",
        homeTitle: "TradeAlphaAI | منصة أبحاث السوق",
        homeDescription: "TradeAlphaAI منصة أبحاث السوق لتحليل الأسهم وصناديق المؤشرات والتصنيفات والماسحات والمقالات التعليمية.",
        homeUrl: "https://www.tradealphaai.com/",
        homeOgType: "website",
        image: "https://www.tradealphaai.com/Image/og-image.svg",
        imageAlt: "منصة TradeAlphaAI لأبحاث السوق",
        twitterCard: "summary_large_image"
      },
      "brand.tagline": "منصة أبحاث السوق"
    },
    en: {
      meta: {
        locale: "en_US",
        homeTitle: "TradeAlphaAI | Market Research Platform",
        homeDescription: "TradeAlphaAI is a market research platform for stock analysis, ETF research, rankings, screeners, and educational articles.",
        homeUrl: "https://www.tradealphaai.com/",
        homeOgType: "website",
        image: "https://www.tradealphaai.com/Image/og-image.svg",
        imageAlt: "TradeAlphaAI market research platform",
        twitterCard: "summary_large_image"
      },
      "brand.tagline": "Research Platform"
    }
  };
  window.TradeAlphaLandingI18n = { translations, getLanguage: () => document.documentElement.lang === "ar" ? "ar" : "en" };
})();
