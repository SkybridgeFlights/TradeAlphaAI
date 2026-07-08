#!/usr/bin/env node
'use strict';

// E-E-A-T trust pages: /about/, /editorial-policy/, /contact/ (EN + AR).
//
// Financial content is YMYL ("Your Money or Your Life") — Google will not
// rank, and readers will not trust, a site with no visible identity. These
// three pages give the site a real editorial identity, a transparent
// methodology + data-source disclosure, and a contact surface. The market-
// shell + empty GLOBAL_HEADER markers let apply-global-header.js bake the
// canonical header/footer/fonts, so they match every other page exactly.
//
// Usage: node tools/generate-trust-pages.js [--write]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const SITE = 'https://www.tradealphaai.com';
const GA4 = 'G-C8REB6WQP1';
const DESK = 'TradeAlphaAI Research Desk';

const SOCIALS = [
  'https://www.instagram.com/tradealpha_ai',
  'https://x.com/tradealpha_ai',
  'https://www.facebook.com/share/1Bbe48PFss/',
  'https://t.me/TradeAlphaAI',
];

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ── Page content (EN + AR) ──────────────────────────────────────────────────
const PAGES = {
  about: {
    slug: 'about',
    en: {
      title: 'About TradeAlphaAI — Educational Market Research Desk',
      desc: 'Who is behind TradeAlphaAI: an educational stock and ETF research desk publishing bilingual market analysis, comparisons, and macro context — never financial advice.',
      eyebrow: 'About us',
      h1: 'About TradeAlphaAI',
      lead: 'TradeAlphaAI is an independent educational research desk covering global stock and ETF markets. We publish daily bilingual (English & Arabic) analysis, comparisons, market outlooks, and an economic calendar — built to teach how markets work, not to sell signals.',
      schemaType: 'AboutPage',
      sections: [
        ['Who we are', `${DESK} is a research and technology team focused on making institutional-grade market context understandable for individual investors and learners. Every article, outlook, and comparison is produced through a documented, rule-based methodology and reviewed against a strict quality standard before publication.`],
        ['What we publish', 'Daily educational articles on ETFs, sectors, and portfolio construction; market outlooks with conditional scenarios; a live economic calendar aggregated from multiple public data sources; head-to-head comparisons; and a financial glossary. All content is available in English and Arabic.'],
        ['How we are different', 'We do not sell buy/sell signals, price targets, or guaranteed returns. Our purpose is educational: to explain the mechanisms behind market moves — inflation, rates, breadth, volatility, sector rotation — so readers can build their own understanding. Read our <a href="/editorial-policy/">editorial policy</a> and <a href="/methodology.html">scoring methodology</a>.'],
        ['Our commitment', 'Transparency about data sources and their state (live, cached, or estimated), no fabricated numbers, and a clear separation between educational context and financial advice. Nothing on this site is a recommendation or solicitation to buy or sell any security.'],
      ],
    },
    ar: {
      title: 'عن TradeAlphaAI — مكتب أبحاث سوق تعليمي',
      desc: 'من يقف خلف TradeAlphaAI: مكتب أبحاث تعليمي للأسهم والصناديق ينشر تحليلات سوق ثنائية اللغة ومقارنات وسياقاً كلياً — دون تقديم نصيحة مالية.',
      eyebrow: 'من نحن',
      h1: 'عن TradeAlphaAI',
      lead: 'TradeAlphaAI مكتب أبحاث تعليمي مستقل يغطّي أسواق الأسهم والصناديق العالمية. ننشر يومياً تحليلات ثنائية اللغة (الإنجليزية والعربية) ومقارنات ونظرات سوق ومفكرة اقتصادية — هدفها تعليم كيف تعمل الأسواق، لا بيع إشارات.',
      schemaType: 'AboutPage',
      sections: [
        ['من نحن', 'فريق أبحاث وتقنية يعمل على جعل سياق السوق المؤسسي مفهوماً للمستثمرين الأفراد والمتعلّمين. كل مقال ونظرة ومقارنة تُنتَج عبر منهجية موثّقة قائمة على قواعد، وتُراجَع وفق معيار جودة صارم قبل النشر.'],
        ['ماذا ننشر', 'مقالات تعليمية يومية عن الصناديق والقطاعات وبناء المحافظ؛ نظرات سوق بسيناريوهات مشروطة؛ مفكرة اقتصادية حية مجمّعة من مصادر بيانات عامة متعددة؛ مقارنات مباشرة؛ ومسرد مالي. كل المحتوى متاح بالإنجليزية والعربية.'],
        ['ما الذي يميّزنا', 'لا نبيع إشارات شراء/بيع ولا أهداف أسعار ولا عوائد مضمونة. غايتنا تعليمية: شرح آليات تحرّكات السوق — التضخم، الفائدة، اتساع السوق، التقلب، تناوب القطاعات — كي يبني القارئ فهمه بنفسه. اطّلع على <a href="/ar/editorial-policy/">سياستنا التحريرية</a> و<a href="/ar/methodology.html">منهجية التقييم</a>.'],
        ['التزامنا', 'الشفافية حول مصادر البيانات وحالتها (حية أو مخزّنة أو تقديرية)، دون أرقام ملفّقة، وفصل واضح بين السياق التعليمي والنصيحة المالية. لا شيء في هذا الموقع توصية أو دعوة لشراء أو بيع أي ورقة مالية.'],
      ],
    },
  },
  'editorial-policy': {
    slug: 'editorial-policy',
    en: {
      title: 'Editorial Policy — How TradeAlphaAI Produces Research',
      desc: 'How TradeAlphaAI produces and reviews content: rule-based methodology, multi-source data with state disclosure, quality gates, corrections, and a strict no-advice standard.',
      eyebrow: 'Editorial standards',
      h1: 'Editorial Policy',
      lead: 'This policy explains how TradeAlphaAI research is produced, sourced, reviewed, and corrected. It applies to every article, market outlook, comparison, and data surface on the site.',
      schemaType: 'AboutPage',
      sections: [
        ['Production & review', 'Content is generated through a documented, rule-based pipeline and scored against a multi-check quality standard (structure, specificity, evidence, language purity, and a no-advice governance gate). Drafts that fail any hard gate are not published.'],
        ['Data sources & transparency', 'Market data is aggregated from multiple public providers and the state of every dataset — live, cached, estimated, or unavailable — is disclosed on the page. We never fabricate a value; when a figure is not available it is shown as pending, not invented.'],
        ['No financial advice', 'TradeAlphaAI publishes educational research and market context only. Nothing we publish is a recommendation, price target, or solicitation to buy or sell any security. Trading involves substantial risk of loss; readers are responsible for their own decisions and should consult a licensed professional.'],
        ['Corrections', 'When an error is identified, the affected page is updated and, where material, the correction is noted. To report an issue, use our <a href="/contact/">contact page</a>.'],
      ],
    },
    ar: {
      title: 'السياسة التحريرية — كيف تُنتِج TradeAlphaAI أبحاثها',
      desc: 'كيف تُنتِج TradeAlphaAI محتواها وتراجعه: منهجية قائمة على قواعد، بيانات متعددة المصادر مع إفصاح عن حالتها، بوابات جودة، تصحيحات، ومعيار صارم بعدم تقديم نصيحة.',
      eyebrow: 'المعايير التحريرية',
      h1: 'السياسة التحريرية',
      lead: 'توضّح هذه السياسة كيف تُنتَج أبحاث TradeAlphaAI وتُصنَّف مصادرها وتُراجَع وتُصحَّح. وتنطبق على كل مقال ونظرة سوق ومقارنة وسطح بيانات في الموقع.',
      schemaType: 'AboutPage',
      sections: [
        ['الإنتاج والمراجعة', 'يُنتَج المحتوى عبر خط موثّق قائم على قواعد، ويُصنَّف وفق معيار جودة متعدّد الفحوص (البنية، التحديد، الأدلة، نقاء اللغة، وبوابة حوكمة تمنع النصيحة). أي مسودة ترسب في بوابة صارمة لا تُنشَر.'],
        ['مصادر البيانات والشفافية', 'تُجمَع بيانات السوق من مزوّدين عامّين متعددين، وتُعرَض حالة كل مجموعة بيانات على الصفحة — حية أو مخزّنة أو تقديرية أو غير متاحة. لا نلفّق قيمة أبداً؛ وحين لا يتوفّر رقم يُعرَض كـ«قيد الانتظار» لا مُختَلَقاً.'],
        ['لا نصيحة مالية', 'تنشر TradeAlphaAI أبحاثاً تعليمية وسياق سوق فقط. لا شيء ننشره توصية أو هدف سعر أو دعوة لشراء أو بيع أي ورقة مالية. التداول ينطوي على مخاطر خسارة كبيرة؛ والقارئ مسؤول عن قراراته وعليه استشارة مختصّ مرخّص.'],
        ['التصحيحات', 'عند اكتشاف خطأ تُحدَّث الصفحة المعنية، ويُشار إلى التصحيح عند أهميته. للإبلاغ عن مشكلة استخدم <a href="/ar/contact/">صفحة التواصل</a>.'],
      ],
    },
  },
  contact: {
    slug: 'contact',
    en: {
      title: 'Contact TradeAlphaAI',
      desc: 'Reach the TradeAlphaAI research desk — questions, corrections, and feedback. Educational market research; not financial advice.',
      eyebrow: 'Get in touch',
      h1: 'Contact Us',
      lead: 'Questions about our research, a correction to report, or feedback on the site? Reach the TradeAlphaAI research desk through any of the channels below.',
      schemaType: 'ContactPage',
      sections: [
        ['Email', 'General enquiries and corrections: <a href="mailto:contact@tradealphaai.com">contact@tradealphaai.com</a>'],
        ['Follow us', `We publish daily on Telegram, Facebook, and Instagram. Links are in the site header and footer, and on our <a href="/links/">links page</a>.`],
        ['Newsletter', 'Get the daily digest of new research in your inbox — subscribe from the <a href="/newsletter/">newsletter page</a>.'],
        ['A note on scope', 'TradeAlphaAI provides educational market research only and cannot offer personalized financial, investment, tax, or legal advice. For those, please consult a licensed professional.'],
      ],
    },
    ar: {
      title: 'تواصل مع TradeAlphaAI',
      desc: 'تواصل مع مكتب أبحاث TradeAlphaAI — أسئلة وتصحيحات وملاحظات. أبحاث سوق تعليمية؛ وليست نصيحة مالية.',
      eyebrow: 'تواصل معنا',
      h1: 'تواصل معنا',
      lead: 'لديك سؤال عن أبحاثنا، أو تصحيح تبلّغ عنه، أو ملاحظة على الموقع؟ تواصل مع مكتب أبحاث TradeAlphaAI عبر أي من القنوات أدناه.',
      schemaType: 'ContactPage',
      sections: [
        ['البريد الإلكتروني', 'الاستفسارات العامة والتصحيحات: <a href="mailto:contact@tradealphaai.com">contact@tradealphaai.com</a>'],
        ['تابعنا', 'ننشر يومياً على تيليجرام وفيسبوك وإنستغرام. الروابط في رأس الموقع وتذييله، وعلى <a href="/ar/links/">صفحة الروابط</a>.'],
        ['النشرة البريدية', 'استلم موجز الأبحاث الجديدة يومياً في بريدك — اشترك من <a href="/ar/newsletter/">صفحة النشرة</a>.'],
        ['ملاحظة حول النطاق', 'تقدّم TradeAlphaAI أبحاث سوق تعليمية فقط، ولا يمكنها تقديم نصيحة مالية أو استثمارية أو ضريبية أو قانونية شخصية. لذلك يُرجى استشارة مختصّ مرخّص.'],
      ],
    },
  },
};

function schemaFor(page, locale) {
  const c = page[locale];
  const url = locale === 'ar' ? `${SITE}/ar/${page.slug}/` : `${SITE}/${page.slug}/`;
  return {
    '@context': 'https://schema.org',
    '@type': c.schemaType,
    name: c.h1,
    description: c.desc,
    url,
    inLanguage: locale === 'ar' ? 'ar' : 'en',
    isPartOf: { '@type': 'WebSite', '@id': `${SITE}/#website`, name: 'TradeAlphaAI' },
    about: {
      '@type': 'Organization',
      '@id': `${SITE}/#organization`,
      name: 'TradeAlphaAI',
      url: `${SITE}/`,
      logo: `${SITE}/Image/og-image.svg`,
      sameAs: SOCIALS,
    },
  };
}

function render(page, locale) {
  const c = page[locale];
  const ar = locale === 'ar';
  const enUrl = `${SITE}/${page.slug}/`;
  const arUrl = `${SITE}/ar/${page.slug}/`;
  const canonical = ar ? arUrl : enUrl;
  const cssPrefix = ar ? '/' : '/'; // absolute paths keep both depths correct
  const sectionsHtml = c.sections.map(([h, body]) => `      <section class="market-section">
        <div class="market-panel">
          <h2>${esc(h)}</h2>
          <p class="market-copy">${body}</p>
        </div>
      </section>`).join('\n');

  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(c.title)}</title>
  <meta name="description" content="${esc(c.desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="en" href="${enUrl}" />
  <link rel="alternate" hreflang="ar" href="${arUrl}" />
  <link rel="alternate" hreflang="x-default" href="${enUrl}" />
  <meta property="og:title" content="${esc(c.title)}" />
  <meta property="og:description" content="${esc(c.desc)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${SITE}/Image/og-image.svg" />
  <meta property="og:locale" content="${ar ? 'ar_AR' : 'en_US'}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(c.title)}" />
  <meta name="twitter:description" content="${esc(c.desc)}" />
  <link rel="stylesheet" href="${cssPrefix}styles.css" />
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
  <script type="application/ld+json">${JSON.stringify(schemaFor(page, locale))}</script>
<!-- GA4_INSTALLED:${GA4} -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA4}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA4}', { anonymize_ip: true });
</script>
</head>
<body class="market-page">
  <!-- GLOBAL_HEADER_START -->
  <!-- GLOBAL_HEADER_END -->

  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${ar ? 'الرئيسية' : 'Home'}</a><span>/</span><span>${esc(c.h1)}</span></nav>
      <section class="market-hero">
        <div class="market-hero-panel">
          <span class="eyebrow">${esc(c.eyebrow)}</span>
          <h1>${esc(c.h1)}</h1>
          <p class="market-lead">${esc(c.lead)}</p>
        </div>
      </section>
${sectionsHtml}
    </div>
  </main>
</body>
</html>
`;
}

let written = 0;
for (const page of Object.values(PAGES)) {
  for (const locale of ['en', 'ar']) {
    const dir = locale === 'ar' ? path.join(ROOT, 'ar', page.slug) : path.join(ROOT, page.slug);
    const file = path.join(dir, 'index.html');
    const html = render(page, locale);
    if (WRITE) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, html, 'utf8');
      written++;
    }
    console.log(`[trust-pages] ${WRITE ? 'wrote' : 'would write'} ${path.relative(ROOT, file).replace(/\\/g, '/')}`);
  }
}
console.log(`[trust-pages] ${WRITE ? 'wrote' : 'dry-run'} ${written || Object.keys(PAGES).length * 2} page(s)`);
