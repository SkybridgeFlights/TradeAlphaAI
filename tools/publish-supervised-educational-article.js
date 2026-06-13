'use strict';

// Phase 97: one-shot supervised educational publication.
// This script publishes one fixed, validator-approved institutional topic. It
// has no scheduler, provider calls, Telegram delivery, or social posting.

const fs = require('fs');
const path = require('path');
const { buildEducationalTopics } = require('./build-educational-topics');

const ROOT = path.resolve(__dirname, '..');
const TOPICS_PATH = path.join(ROOT, 'data', 'intelligence', 'educational-topics.json');
const SLUG = 'volatility-compression';
const DATE = '2026-06-13';
const WRITE = process.argv.includes('--write');
const REFRESH = process.argv.includes('--refresh');

const ARTICLE = {
  id: SLUG,
  title_en: 'Volatility Compression Is Not the Same as Market Stability',
  title_ar: 'انضغاط التقلب لا يعني أن السوق أصبح أكثر استقراراً',
  description_en: 'An institutional explanation of how volatility compression can coexist with concentrated positioning, catalyst sensitivity, and unresolved cross-asset tension.',
  description_ar: 'شرح مؤسسي لكيفية تزامن انضغاط التقلب مع تمركز المراكز وحساسية المحفزات والتوتر غير المحسوم بين الأصول.',
  sections: [
    {
      id: 'thesis',
      en: ['The institutional mistake is to treat a low volatility reading as proof that the market has become structurally safer. Volatility measures the realized or implied distribution of price changes; it does not directly measure the quality of participation, the balance of positioning, or the resilience of liquidity. A quiet tape can therefore describe either genuine equilibrium or a temporary absence of pressure strong enough to force repricing.',
        'The distinction matters most before a known catalyst. When VIX is subdued, index ranges are narrow, and intraday reversals are quickly absorbed, the surface appears stable. Yet that surface does not confirm that risk has disappeared. It may only show that buyers and sellers are temporarily matched while both sides wait for information capable of changing the policy path, earnings assumptions, or the price of liquidity.'],
      ar: ['الخطأ المؤسسي يبدأ حين تُعامل قراءة التقلب المنخفضة بوصفها دليلاً على أن بنية السوق أصبحت أكثر أماناً. فالتقلب يقيس توزيع حركة الأسعار المحققة أو المتوقعة، لكنه لا يقيس مباشرة جودة المشاركة أو توازن المراكز أو قدرة السيولة على امتصاص الضغط. لذلك قد يصف هدوء التداول توازناً حقيقياً، وقد يصف أيضاً غياباً مؤقتاً لقوة كافية لفرض إعادة تسعير.',
        'تزداد أهمية هذا التمييز قبل محفز معروف. فعندما يبقى VIX منخفضاً، وتضيق نطاقات المؤشرات، وتُمتص الانعكاسات اليومية سريعاً، يبدو السطح مستقراً. لكن هذا السطح لا يؤكد اختفاء المخاطر؛ بل قد يعني فقط أن المشترين والبائعين في حالة توازن مؤقت بانتظار معلومة تغير مسار السياسة النقدية أو افتراضات الأرباح أو تكلفة السيولة.'],
    },
    {
      id: 'mechanism',
      en: ['Compression develops when recent price changes become smaller and option markets assign less value to near-term movement. Several forces can produce that outcome: systematic volatility selling, steady passive inflows, dealer hedging that dampens moves, or simple uncertainty about the next macro release. None of those forces requires the underlying market structure to improve.',
        'A more useful desk question is therefore not whether volatility is low, but why it is low. Compression supported by broad participation, stable credit, orderly Treasury trading, and balanced leadership is different from compression supported by a handful of index weights and persistent option supply. The first configuration can absorb disagreement. The second can remain calm only while the flow that suppresses movement continues.'],
      ar: ['يتشكل الانضغاط عندما تصغر حركة الأسعار الأخيرة وتمنح أسواق الخيارات قيمة أقل للحركة القريبة. وقد ينتج ذلك عن بيع منهجي للتقلب، أو تدفقات سلبية منتظمة، أو تحوطات من صناع السوق تخفف الحركة، أو مجرد تردد قبل البيانات الكلية التالية. ولا تتطلب أي من هذه القوى تحسناً فعلياً في البنية الداخلية للسوق.',
        'لهذا لا يكون سؤال المكتب الأفضل: هل التقلب منخفض؟ بل: لماذا هو منخفض؟ فالانضغاط المدعوم بمشاركة واسعة وائتمان مستقر وتداول منظم في الخزانة وقيادة متوازنة يختلف عن انضغاط يعتمد على عدد محدود من أوزان المؤشر وعلى عرض مستمر للخيارات. البنية الأولى تمتص الخلاف، أما الثانية فتبقى هادئة فقط ما دامت التدفقات الكابحة للحركة مستمرة.'],
    },
    {
      id: 'positioning',
      en: ['Positioning changes the meaning of the same volatility number. If portfolios are lightly committed and hedges are already expensive, a low realized-volatility period may reflect genuine caution. If exposure is crowded, hedges have been reduced, and the dominant trade is reinforced by recent performance, the identical reading can indicate that the market has become dependent on continuity.',
        'That dependency is not a forecast of a reversal. It is a statement about asymmetry. A crowded market can continue trending while volatility remains compressed, but a modest challenge to the shared assumption may require more simultaneous adjustment than normal. Forced covering, dealer re-hedging, and thinner liquidity can then turn a small information shock into a larger price response without implying that the original catalyst was historically large.'],
      ar: ['يغير التمركز معنى رقم التقلب نفسه. فإذا كانت المحافظ قليلة الالتزام وكانت التحوطات مرتفعة التكلفة أصلاً، فقد تعكس فترة التقلب المحقق المنخفض حذراً حقيقياً. أما إذا كانت المراكز مزدحمة، وتراجعت التحوطات، وأصبح الأداء الحديث يعزز الصفقة السائدة، فقد تعني القراءة ذاتها أن السوق بات يعتمد على استمرار الظروف القائمة.',
        'هذا الاعتماد ليس توقعاً بانعكاس الاتجاه، بل وصف لعدم التماثل. فقد يواصل السوق المزدحم اتجاهه مع بقاء التقلب منضغطاً، لكن تحدياً محدوداً للافتراض المشترك قد يفرض تعديلاً متزامناً أكبر من المعتاد. عندها يمكن لتغطية المراكز وإعادة تحوط صناع السوق وضعف السيولة أن تحول صدمة معلومات صغيرة إلى استجابة سعرية أوسع، من دون أن يكون المحفز نفسه استثنائياً تاريخياً.'],
    },
    {
      id: 'cross-asset',
      en: ['Cross-asset confirmation separates calm from concealed tension. If SPY and QQQ advance while RSP participation improves, credit spreads remain orderly, Treasury yields trade consistently with the growth narrative, and DXY does not contradict the liquidity backdrop, lower volatility has a coherent foundation. Multiple markets are describing the same regime.',
        'The reading weakens when the index is quiet but its supporting relationships diverge. Examples include stable headline equities alongside deteriorating breadth, gold strength that conflicts with the prevailing dollar or real-yield explanation, or falling VIX while rate volatility remains elevated. No single divergence proves instability. Persistent disagreement, however, means the tape is not fully confirming its own calm.'],
      ar: ['يفصل التأكيد عبر الأصول بين الهدوء الحقيقي والتوتر المستتر. فإذا ارتفع SPY وQQQ مع تحسن مشاركة RSP، وبقيت فروق الائتمان منظمة، وتحركت عوائد الخزانة بما ينسجم مع سردية النمو، ولم يناقض DXY خلفية السيولة، يصبح انخفاض التقلب قائماً على أساس متماسك. عندها تصف أسواق متعددة النظام نفسه.',
        'تضعف القراءة عندما يهدأ المؤشر بينما تتباعد العلاقات التي يفترض أن تدعمه. ومن الأمثلة استقرار الأسهم الرئيسية مع تراجع الاتساع، أو قوة الذهب بما لا ينسجم مع تفسير الدولار أو العوائد الحقيقية، أو هبوط VIX بينما يبقى تقلب الفائدة مرتفعاً. لا يثبت انفصال واحد وجود هشاشة، لكن استمرار الخلاف يعني أن السوق لا يؤكد هدوءه بالكامل.'],
    },
    {
      id: 'catalyst',
      en: ['Catalysts matter because compressed markets often postpone disagreement rather than resolve it. Before CPI, an FOMC decision, payrolls, or a major earnings cluster, participants may reduce activity because the current information set does not justify paying the transaction cost of changing exposure. The resulting quiet is observationally real, but its durability is conditional on the next release preserving the assumptions embedded in positioning.',
        'This is why a catalyst calendar should be read together with volatility structure, not as a countdown to an expected direction. The relevant question is whether the event can challenge the variables holding the regime together: the rate path, earnings breadth, liquidity expectations, or concentration leadership. A catalyst has greater structural importance when several of those supports are already strained, even if spot volatility remains low.'],
      ar: ['تكتسب المحفزات أهميتها لأن الأسواق المنضغطة تؤجل الخلاف في كثير من الأحيان بدلاً من حسمه. فقبل بيانات التضخم أو قرار الفيدرالي أو الوظائف أو مجموعة نتائج كبيرة، قد يخفض المشاركون نشاطهم لأن المعلومات المتاحة لا تبرر تكلفة تعديل التعرض. الهدوء الناتج حقيقي من زاوية الرصد، لكن استمراره مشروط بألا تقوض البيانات التالية الافتراضات المضمنة في المراكز.',
        'لهذا يجب قراءة تقويم المحفزات إلى جانب بنية التقلب، لا باعتباره عدّاً تنازلياً لاتجاه متوقع. السؤال هو ما إذا كان الحدث قادراً على تحدي المتغيرات التي تمسك النظام: مسار الفائدة، واتساع الأرباح، وتوقعات السيولة، وقيادة الأسهم المركزة. وتزداد الأهمية الهيكلية للمحفز عندما تكون عدة ركائز متوترة أصلاً، حتى لو بقي التقلب الفوري منخفضاً.'],
    },
    {
      id: 'liquidity',
      en: ['Liquidity determines how pressure travels once it appears. Deep two-way markets allow new information to be distributed across time and instruments. Thin markets concentrate the adjustment. During compression, displayed liquidity can look abundant because few participants urgently demand execution; that appearance may change when many portfolios attempt the same hedge or reduction at once.',
        'Institutional monitoring therefore distinguishes quoted liquidity from executable resilience. Bid-ask spreads, market depth, option skew, Treasury volatility, and the behavior of high-beta assets provide different views of that resilience. The objective is not to predict a break. It is to identify whether the calm regime depends on liquidity that has not yet been tested by meaningful disagreement.'],
      ar: ['تحدد السيولة كيفية انتقال الضغط بعد ظهوره. فالأسواق العميقة ثنائية الاتجاه توزع المعلومات الجديدة عبر الزمن والأدوات، بينما تركز الأسواق الرقيقة عملية التعديل. وخلال الانضغاط قد تبدو السيولة المعروضة وفيرة لأن عدداً قليلاً من المشاركين يحتاج إلى التنفيذ العاجل؛ لكن هذا المظهر قد يتغير عندما تحاول محافظ كثيرة تنفيذ التحوط أو خفض التعرض في الوقت نفسه.',
        'لذلك يميز الرصد المؤسسي بين السيولة المعلنة والقدرة الفعلية على الصمود. تقدم فروق العرض والطلب وعمق السوق وانحراف الخيارات وتقلب الخزانة وسلوك الأصول مرتفعة الحساسية قراءات مختلفة لهذه القدرة. الهدف ليس توقع كسر، بل تحديد ما إذا كان نظام الهدوء يعتمد على سيولة لم تُختبر بعد بخلاف ذي معنى.'],
    },
    {
      id: 'monitoring',
      en: ['A disciplined monitoring framework looks for confirmation across layers. Realized volatility should be compared with implied volatility and option skew. Index calm should be compared with breadth, equal-weight performance, credit, and rate volatility. Leadership should be tested for expansion rather than inferred from the headline return alone. The next catalyst should be evaluated against the assumptions most responsible for the existing regime.',
        'The framework also needs an invalidation condition. The compressed-fragility interpretation would invalidate if participation broadens, cross-asset relationships become more coherent, hedging remains orderly through major catalysts, and liquidity continues to absorb repositioning without deterioration. In that case, low volatility would be increasingly consistent with stable structure rather than deferred adjustment.'],
      ar: ['يبحث إطار الرصد المنضبط عن التأكيد عبر طبقات متعددة. فيُقارن التقلب المحقق بالتقلب الضمني وانحراف الخيارات، ويُقارن هدوء المؤشر بالاتساع وأداء الوزن المتساوي والائتمان وتقلب الفائدة. كما تُختبر القيادة من حيث اتساعها بدلاً من استنتاجها من عائد المؤشر وحده، ويُقيّم المحفز التالي وفق الافتراضات الأكثر مسؤولية عن النظام القائم.',
        'ويحتاج الإطار أيضاً إلى شرط إبطال واضح. تُبطل هذه القراءة إذا اتسعت المشاركة، وأصبحت العلاقات بين الأصول أكثر اتساقاً، وظلت التحوطات منظمة خلال المحفزات الكبرى، واستمرت السيولة في امتصاص إعادة التموضع من دون تدهور. عندها يصبح انخفاض التقلب أكثر اتساقاً مع بنية مستقرة، لا مع تعديل مؤجل.'],
    },
    {
      id: 'conclusion',
      en: ['Volatility compression is best understood as a condition, not a conclusion. It tells the desk that observed movement has narrowed and that the market is assigning less immediate value to protection. It does not tell the desk whether participation is healthy, positioning is balanced, liquidity is durable, or the prevailing narrative can survive contrary information.',
        'The institutional edge comes from refusing to collapse those separate questions into one reassuring number. Calm supported by breadth, coherent cross-asset behavior, and resilient liquidity deserves a different interpretation from calm supported by concentration and untested positioning. The tape can remain quiet in both cases. What differs is the structure carrying that quiet.'],
      ar: ['الأدق أن يُفهم انضغاط التقلب بوصفه حالة لا خلاصة. فهو يخبر المكتب بأن الحركة المرصودة ضاقت وأن السوق يمنح الحماية القريبة قيمة أقل. لكنه لا يخبره ما إذا كانت المشاركة صحية، أو المراكز متوازنة، أو السيولة متينة، أو السردية السائدة قادرة على تحمل معلومات معاكسة.',
        'تنشأ الميزة المؤسسية من رفض اختزال هذه الأسئلة المنفصلة في رقم واحد مطمئن. فالهدوء المدعوم باتساع السوق واتساق العلاقات بين الأصول وصلابة السيولة يستحق قراءة مختلفة عن هدوء قائم على التركز وتموضع لم يُختبر. قد يبقى التداول هادئاً في الحالتين؛ لكن البنية التي تحمل هذا الهدوء ليست واحدة.'],
    },
  ],
};

function esc(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pageShell(locale) {
  const ar = locale === 'ar';
  const index = fs.readFileSync(path.join(ROOT, ar ? 'ar/articles/index.html' : 'articles/index.html'), 'utf8');
  const header = (index.match(/<!-- GLOBAL_HEADER_START -->[\s\S]*?<!-- GLOBAL_HEADER_END -->/) || [''])[0]
    .replace(/href="\/ar\/market-outlook\/"/g, `href="/ar/articles/${SLUG}.html"`)
    .replace(/href="\/market-outlook\/"/g, `href="/articles/${SLUG}.html"`)
    .replace(/href="\/ar\/articles\/"/g, `href="/ar/articles/${SLUG}.html"`)
    .replace(/href="\/articles\/"/g, `href="/articles/${SLUG}.html"`);
  const footer = index.slice(index.indexOf('<footer'));
  return { header, footer };
}

function render(locale) {
  const ar = locale === 'ar';
  const title = ar ? ARTICLE.title_ar : ARTICLE.title_en;
  const description = ar ? ARTICLE.description_ar : ARTICLE.description_en;
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}articles/${SLUG}.html`;
  const other = `https://www.tradealphaai.com/${ar ? '' : 'ar/'}articles/${SLUG}.html`;
  const shell = pageShell(locale);
  const sections = ARTICLE.sections.map((section) => `<section class="market-section" id="${section.id}" data-reasoning-module="${section.id}">
  <div class="market-section-head"><span class="eyebrow">${esc(ar ? 'قراءة هيكلية' : 'Structural reading')}</span><h2>${esc(sectionHeading(section.id, ar))}</h2></div>
  <div class="market-panel">${(ar ? section.ar : section.en).map((paragraph) => `<p class="market-copy">${esc(paragraph)}</p>`).join('\n')}</div>
</section>`).join('\n');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: DATE,
    dateModified: DATE,
    inLanguage: locale,
    author: { '@type': 'Organization', name: 'TradeAlphaAI Research' },
    publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' },
    mainEntityOfPage: url,
  };
  return `<!doctype html>
<html lang="${locale}" dir="${ar ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)} | TradeAlphaAI</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="${locale}" href="${url}" />
  <link rel="alternate" hreflang="${ar ? 'en' : 'ar'}" href="${other}" />
  <link rel="alternate" hreflang="x-default" href="https://www.tradealphaai.com/articles/${SLUG}.html" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
  <meta property="article:published_time" content="${DATE}" />
  <meta property="article:section" content="Institutional Market Structure Education" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
  <link rel="stylesheet" href="/css/global-layout.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
  <link rel="stylesheet" href="/css/global-header-canonical.css" />
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body class="market-page" data-educational-article="v1" data-editorial-intelligence="v2">
${shell.header}
<main class="market-shell"><div class="wrap">
  <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${ar ? 'الرئيسية' : 'Home'}</a><span>/</span><a href="${ar ? '/ar/articles/' : '/articles/'}">${ar ? 'الأبحاث المؤسسية' : 'Institutional Articles'}</a><span>/</span><span>${esc(title)}</span></nav>
  <header class="market-hero"><div class="market-hero-panel">
    <span class="eyebrow">${ar ? 'تعليم مؤسسي في بنية السوق' : 'Institutional Market-Structure Education'}</span>
    <h1>${esc(title)}</h1>
    <p class="market-lead">${esc(description)}</p>
    <p class="market-copy"><time datetime="${DATE}">${DATE}</time> · TradeAlphaAI Research</p>
  </div></header>
  <section class="market-section" id="articles-distinction"><div class="market-panel"><p class="market-copy">${ar ? 'ينتمي هذا البحث إلى مكتب التعليم المؤسسي في بنية السوق. أما الأبحاث التطبيقية حول الصناديق والقطاعات والأسهم فتبقى ضمن مكتبة الرؤى.' : 'This research belongs to the institutional market-structure education desk. Applied ETF, sector, and stock research remains in the Insights library.'}</p></div></section>
${sections}
  <section class="market-section" id="educational-disclaimer"><div class="market-panel"><h2>${ar ? 'إخلاء المسؤولية التعليمي' : 'Educational Disclaimer'}</h2><p class="market-copy">${ar ? 'هذا تحليل تعليمي لبنية السوق، وليس نصيحة استثمارية أو توصية تداول أو توقعاً لاتجاه الأسعار.' : 'This is educational market-structure analysis, not investment advice, a trading recommendation, or a directional forecast.'}</p></div></section>
</div></main>
${shell.footer}`;
}

function sectionHeading(id, ar) {
  const headings = {
    thesis: ['The false comfort of a quiet tape', 'الطمأنينة الزائفة في هدوء التداول'],
    mechanism: ['How compression is created', 'كيف يتشكل الانضغاط'],
    positioning: ['Positioning changes the meaning', 'التمركز يغير معنى الهدوء'],
    'cross-asset': ['Cross-asset confirmation', 'التأكيد عبر الأصول'],
    catalyst: ['Catalysts test the structure', 'المحفزات تختبر البنية'],
    liquidity: ['Liquidity is the transmission channel', 'السيولة هي قناة انتقال الضغط'],
    monitoring: ['A disciplined monitoring framework', 'إطار رصد منضبط'],
    conclusion: ['Condition, not conclusion', 'حالة وليست خلاصة'],
  };
  return headings[id][ar ? 1 : 0];
}

function writeFile(relative, content) {
  const file = path.join(ROOT, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${String(content).trimEnd()}\n`, 'utf8');
}

function updateMemory() {
  const current = JSON.parse(fs.readFileSync(TOPICS_PATH, 'utf8'));
  const alreadyPublished = (current.history || []).some((item) => item.slug === SLUG && item.status === 'published');
  if (alreadyPublished) {
    const rebuilt = buildEducationalTopics();
    fs.writeFileSync(TOPICS_PATH, `${JSON.stringify(rebuilt, null, 2)}\n`, 'utf8');
    return;
  }
  if (!current.eligible.some((topic) => topic.id === SLUG && topic.on_cooldown === false)) {
    throw new Error(`[educational-publish] ${SLUG} is not currently eligible`);
  }
  current.history = [...(current.history || []), {
    id: SLUG,
    slug: SLUG,
    selected_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
    status: 'published',
    supervised: true,
  }];
  fs.writeFileSync(TOPICS_PATH, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
  const rebuilt = buildEducationalTopics();
  fs.writeFileSync(TOPICS_PATH, `${JSON.stringify(rebuilt, null, 2)}\n`, 'utf8');
}

function main() {
  const topics = JSON.parse(fs.readFileSync(TOPICS_PATH, 'utf8'));
  const eligible = topics.eligible.some((topic) => topic.id === SLUG);
  const published = (topics.history || []).some((item) => item.slug === SLUG && item.status === 'published');
  if (!eligible && !(REFRESH && published)) throw new Error(`[educational-publish] ${SLUG} is not eligible`);
  const en = render('en');
  const ar = render('ar');
  if (!WRITE) {
    console.log(`[educational-publish] dry-run ${SLUG}: en=${en.length} ar=${ar.length}`);
    return;
  }
  if (fs.existsSync(path.join(ROOT, 'articles', `${SLUG}.html`)) && !REFRESH) throw new Error(`[educational-publish] refusing overwrite: ${SLUG}`);
  writeFile(`drafts/educational/${SLUG}/en.html`, en);
  writeFile(`drafts/educational/${SLUG}/ar.html`, ar);
  writeFile(`drafts/educational/${SLUG}/metadata.json`, `${JSON.stringify({ slug: SLUG, topic_id: SLUG, status: 'supervised-approved', published_at: new Date().toISOString(), visual_status: 'suppressed-no-verified-evidence' }, null, 2)}\n`);
  writeFile(`articles/${SLUG}.html`, en);
  writeFile(`ar/articles/${SLUG}.html`, ar);
  updateMemory();
  console.log(`[educational-publish] published one bilingual pair: ${SLUG}`);
}

if (require.main === module) main();

module.exports = { render, ARTICLE, SLUG };
