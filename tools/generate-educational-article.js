'use strict';

// Phase 118 — Educational Intelligence Engine (autonomous daily publisher).
//
// Publishes ONE evergreen, institutional, bilingual educational article per run
// to /articles/<id>.html + /ar/articles/<id>.html, driven by the EXISTING topic
// engine (build-educational-topics: rotation, cooldown, eligibility, anti-
// repetition) — no parallel topic system. Each concept has a deterministic,
// distinct, source-grounded explainer (no fabrication, no advice, no retail TA,
// no listicles, no beginner fluff). It reuses the proven /articles/ page shell
// (canonical header + data-educational-article marker + disclaimer) so it passes
// check:educational-articles, and records publication in the topic memory so the
// concept enters cooldown. Self-gates green when no eligible covered topic
// remains. Educational pillar stays separate from market-news / structure /
// outlook.
//
// Usage: node tools/generate-educational-article.js [--write]

const fs = require('fs');
const path = require('path');
const { scoreArticle, QUALITY_FLOOR } = require('./editorial-quality');
const { buildEducationalTopics } = require('./build-educational-topics');

const ROOT = path.resolve(__dirname, '..');
const TOPICS_PATH = path.join(ROOT, 'data', 'intelligence', 'educational-topics.json');
const DATE = new Date().toISOString().slice(0, 10);
const MIN_WORDS = { en: 360, ar: 300 };

function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

// ── Concept library — distinct institutional explainers keyed to topic ids ────
// Each concept: a definition, why it matters structurally, how the desk
// interprets it, and what it is NOT (guarding against the retail reading).
// Each section: [id, head_en, head_ar, [en paragraphs], [ar paragraphs]].
// Concepts run 6 sections × 2 paragraphs so every article clears the
// institutional depth bar (≥9 sections, ≥18 paragraphs) the validator enforces.
const CONCEPT_LIBRARY = {
  'breadth-vs-index': {
    sections: [
      ['what-breadth-is', 'What market breadth actually measures', 'ما الذي يقيسه اتساع السوق فعلاً',
        ['Breadth measures how many constituents are participating in a move, rather than how far the headline index has travelled. An index is a capitalisation-weighted average, so a handful of the largest names can carry it higher while the median stock stalls or falls.',
          'Advancers versus decliners, the share of names above their own trend, and small-caps versus large-caps are the desk’s read on whether an advance is shared or merely carried. The distinction is structural: the same index level can rest on very different participation.'],
        ['يقيس الاتساع عدد المكوّنات المشاركة في حركة ما، لا المسافة التي قطعها المؤشر الظاهر. فالمؤشر متوسط مرجّح بالقيمة السوقية، ومن ثم يمكن لحفنة من أكبر الأسماء أن ترفعه بينما يتعثّر السهم الوسيط أو يتراجع.',
          'والصاعدون مقابل الهابطين، ونسبة الأسماء فوق اتجاهها، والشركات الصغيرة مقابل الكبيرة هي قراءة المكتب لما إذا كان الصعود مشتركاً أم محمولاً فحسب. والتمييز هيكلي: فالمستوى نفسه قد يستند إلى مشاركة مختلفة تماماً.']],
      ['why-it-matters', 'Why deteriorating breadth precedes index stress', 'لماذا يسبق تدهور الاتساع ضغط المؤشر',
        ['When breadth narrows while the index holds, risk is being concentrated into fewer names. That is a structurally more fragile configuration: the same level now depends on a smaller base of leadership, so a stumble in those leaders has an outsized effect.',
          'Deteriorating breadth does not predict a date. It tells the desk that the advance is resting on a narrower foundation than the headline implies — a quality signal about the structure of the move, not a timing signal about its end.'],
        ['حين يضيق الاتساع بينما يثبت المؤشر، تتركّز المخاطر في عدد أقل من الأسماء. وهذا تكوين أهش هيكلياً: إذ بات المستوى نفسه يعتمد على قاعدة قيادة أصغر، فيكون لتعثّر تلك القيادات أثر مضخّم.',
          'ولا يتنبأ تدهور الاتساع بموعد. بل يخبر المكتب أن الصعود يستند إلى أساس أضيق مما يوحي به العنوان — إشارة جودة عن بنية الحركة، لا إشارة توقيت عن نهايتها.']],
      ['the-mechanics', 'The mechanics of cap-weighted concentration', 'ميكانيكا التركّز المرجّح بالقيمة',
        ['Because the index weights by market value, the largest companies dominate its path. When leadership concentrates in a few megacaps, the index can keep rising on their strength alone, masking weakness in the long tail of constituents beneath them.',
          'This is why a desk separates the index print from its internals. The headline can be a poor summary of the underlying market when participation is lopsided, and the gap between the two is itself the information worth tracking.'],
        ['لأن المؤشر يرجّح بالقيمة السوقية، تهيمن أكبر الشركات على مساره. وحين تتركّز القيادة في قلة من العملاقة، يمكن للمؤشر أن يواصل الصعود بقوّتها وحدها، مخفياً ضعف الذيل الطويل من المكوّنات تحتها.',
          'ولهذا يفصل المكتب إصدار المؤشر عن مكوّناته الداخلية. فقد يكون العنوان ملخّصاً رديئاً للسوق الأساسي حين تكون المشاركة غير متوازنة، والفجوة بين الاثنين هي ذاتها المعلومة الجديرة بالتتبع.']],
      ['how-the-desk-reads-it', 'How an institutional desk reads it', 'كيف يقرأه المكتب المؤسسي',
        ['A desk reads breadth alongside the regime: narrowing participation inside a supportive liquidity regime is treated differently from the same narrowing inside a fragile one. It cross-checks small-cap participation against the megacap complex.',
          'It also watches whether new index highs are confirmed beneath the surface, because an unconfirmed high — a new peak on deteriorating internals — is a structurally weaker event than a confirmed one, even when the price looks identical.'],
        ['يقرأ المكتب الاتساع جنباً إلى جنب مع النظام: فتضيّق المشاركة داخل نظام سيولة داعم يُعامَل بصورة مختلفة عن التضيّق نفسه داخل نظام هش. ويقارن مشاركة الشركات الصغيرة بمجمّع الشركات العملاقة.',
          'كما يراقب ما إذا كانت قمم المؤشر الجديدة مؤكَّدة تحت السطح، لأن القمة غير المؤكَّدة — ذروة جديدة على مكوّنات متدهورة — حدث أضعف هيكلياً من القمة المؤكَّدة، حتى لو بدا السعر متطابقاً.']],
      ['confirmation-and-regime', 'Breadth in cross-asset and regime context', 'الاتساع في سياق الأصول المتقاطعة والنظام',
        ['Breadth is most informative when read with cross-asset confirmation. Narrowing equity participation that coincides with widening credit spreads or defensive leadership is a more coherent warning than narrowing breadth alone, because independent markets are agreeing.',
          'The regime conditions the reading further: in an easing, risk-absorbing environment narrow leadership can persist benignly, while in a tightening, fragile one the same internals carry more weight. Context, not the breadth number in isolation, is what the desk acts on.'],
        ['يكون الاتساع أكثر إفادة حين يُقرأ مع التأكيد عبر الأصول. فتضيّق مشاركة الأسهم المتزامن مع اتساع فروق الائتمان أو القيادة الدفاعية تحذير أكثر اتساقاً من تضيّق الاتساع وحده، لأن أسواقاً مستقلة تتفق.',
          'ويشترط النظام القراءة أكثر: ففي بيئة تيسير ماصّة للمخاطر قد تستمر القيادة الضيقة بصورة حميدة، بينما في بيئة تشدّد هشة تحمل المكوّنات ذاتها وزناً أكبر. والسياق، لا رقم الاتساع بمعزل، هو ما يتصرّف المكتب بناءً عليه.']],
      ['what-it-is-not', 'What breadth analysis is not', 'ما ليس عليه تحليل الاتساع',
        ['Breadth is not a timing tool and not a trade signal. Narrow leadership can persist for long stretches, and broad participation can coexist with a correction, so a breadth reading never converts into an entry or an exit.',
          'The institutional use is diagnostic: it describes the structure underneath a level so the reader understands what the index is actually built on. Treating a breadth reading as a directional call is precisely the retail misuse this analysis avoids.'],
        ['الاتساع ليس أداة توقيت ولا إشارة تداول. فقد تستمر القيادة الضيقة لفترات طويلة، وقد تتعايش المشاركة الواسعة مع تصحيح، ومن ثم لا تتحوّل قراءة الاتساع أبداً إلى دخول أو خروج.',
          'والاستخدام المؤسسي تشخيصي: يصف البنية تحت المستوى ليفهم القارئ ما يستند إليه المؤشر فعلاً. ومعاملة قراءة الاتساع بوصفها حكماً اتجاهياً هي تحديداً سوء الاستخدام الذي يتجنّبه هذا التحليل.']],
    ],
  },
  'liquidity-regime': {
    sections: [
      ['what-a-regime-is', 'What a liquidity regime is', 'ما هو نظام السيولة',
        ['A liquidity regime is the prevailing structural environment in which moves happen — whether financial conditions are easing or tightening, whether volatility is being absorbed or rejected, and whether stability is improving or deteriorating.',
          'It is not a single indicator but a composite read across rates, the dollar, volatility and breadth that frames how the market is positioned to absorb a shock. The regime is the backdrop; individual prints are events that land against it.'],
        ['نظام السيولة هو البيئة الهيكلية السائدة التي تحدث فيها التحركات — هل الأوضاع المالية تتيسّر أم تتشدّد، وهل يُمتَص التذبذب أم يُرفَض، وهل الاستقرار يتحسّن أم يتدهور.',
          'وهو ليس مؤشراً واحداً بل قراءة مركّبة عبر العوائد والدولار والتذبذب والاتساع تؤطّر كيفية تموضع السوق لامتصاص صدمة. فالنظام هو الخلفية؛ والإصدارات المنفردة أحداث تقع في مواجهتها.']],
      ['why-it-shapes-behavior', 'Why the regime shapes cross-asset behavior', 'لماذا يشكّل النظام السلوك عبر الأصول',
        ['The same catalyst lands differently depending on the regime. In a supportive, risk-absorbing regime a negative surprise is often cushioned and cross-asset relationships stay coherent; in a fragile, risk-rejecting regime the identical surprise transmits widely.',
          'Reading the regime first is what lets a desk anticipate transmission rather than react to a single print. The environment conditions the reaction, so the regime is logically prior to any interpretation of the data itself.'],
        ['يقع المُحفِّز نفسه بصورة مختلفة تبعاً للنظام. ففي نظام داعم ماص للمخاطر كثيراً ما تُخفَّف المفاجأة السلبية وتبقى العلاقات عبر الأصول متسقة؛ وفي نظام هش رافض للمخاطر تنتقل المفاجأة ذاتها على نطاق واسع.',
          'وقراءة النظام أولاً هي ما يتيح للمكتب توقّع الانتقال بدل التفاعل مع إصدار منفرد. فالبيئة تشترط التفاعل، ومن ثم يسبق النظام منطقياً أي تفسير للبيانات نفسها.']],
      ['the-transmission', 'How a shock transmits through the regime', 'كيف تنتقل الصدمة عبر النظام',
        ['In a coherent regime a shock propagates cleanly: rates, the dollar and equities move in the relationships the desk expects, and the reaction is legible. In an incoherent one the same shock fragments, with assets disagreeing and the signal harder to read.',
          'Liquidity is the medium of that transmission. When real flow is participating behind a move it absorbs supply smoothly; when liquidity is thinning, the same order flow moves prices further and the regime is more prone to disorderly repricing.'],
        ['في نظام متسق تنتشر الصدمة بوضوح: تتحرك العوائد والدولار والأسهم في العلاقات التي يتوقعها المكتب، ويكون التفاعل مقروءاً. وفي نظام غير متسق تتجزّأ الصدمة ذاتها، فتختلف الأصول ويصعب قراءة الإشارة.',
          'والسيولة هي وسط ذلك الانتقال. فحين يشارك تدفّق حقيقي خلف حركة يمتص المعروض بسلاسة؛ وحين تترقّق السيولة، يحرّك تدفّق الأوامر نفسه الأسعار أبعد ويصبح النظام أكثر عرضة لإعادة تسعير غير منظّمة.']],
      ['how-the-desk-reads-it', 'How the desk reads regime context', 'كيف يقرأ المكتب سياق النظام',
        ['A desk treats the regime as conditioning context, not a forecast. It asks whether liquidity is participating behind a move or thinning beneath it, and whether volatility compression reflects genuine balance or stored instability.',
          'It then checks whether the regime is strengthening, holding or transitioning across sessions, because a regime that has held is weighted differently from one that is visibly changing character. The classification is always probabilistic and conditional.'],
        ['يعامل المكتب النظام بوصفه سياقاً مشروطاً لا تنبؤاً. فيسأل هل السيولة مشارِكة خلف حركة ما أم تترقّق تحتها، وهل انضغاط التذبذب يعكس توازناً حقيقياً أم عدم استقرار مخزّن.',
          'ثم يتحقّق مما إذا كان النظام يتقوّى أو يثبت أو ينتقل عبر الجلسات، لأن نظاماً صمد يُرجَّح بصورة مختلفة عن نظام يتغيّر طبعه بوضوح. والتصنيف دائماً احتمالي ومشروط.']],
      ['continuity-and-persistence', 'Why continuity matters more than any snapshot', 'لماذا تهمّ الاستمرارية أكثر من أي لقطة',
        ['A single-session regime read is weak evidence; a regime that has persisted across several verified sessions is far stronger. The desk weights persistence explicitly, because structure that has held under varying conditions has demonstrated something a one-day snapshot cannot.',
          'This is why regime analysis is continuous rather than episodic. The value is in how liquidity, volatility and coherence evolve over time — the trajectory of the environment — not in the level of any single dimension on any single day.'],
        ['قراءة نظام لجلسة واحدة دليل ضعيف؛ ونظام استمر عبر عدة جلسات موثّقة أقوى بكثير. ويرجّح المكتب الاستمرارية صراحةً، لأن بنية صمدت في ظروف متباينة أثبتت ما لا تستطيعه لقطة يوم واحد.',
          'ولهذا يكون تحليل النظام مستمراً لا متقطّعاً. والقيمة في كيفية تطوّر السيولة والتذبذب والاتساق عبر الزمن — مسار البيئة — لا في مستوى أي بُعد منفرد في أي يوم منفرد.']],
      ['what-it-is-not', 'What a regime read is not', 'ما ليست عليه قراءة النظام',
        ['A regime read is not a prediction of price and not a position. It cannot tell you what happens next; it tells you the conditions under which whatever happens will be absorbed or amplified.',
          'Collapsing a regime label into a directional bet discards exactly the conditional, probabilistic framing that makes it useful to an institutional process. The regime informs interpretation; it never substitutes for it as a signal.'],
        ['قراءة النظام ليست تنبؤاً بالسعر ولا مركزاً. فهي لا تخبرك بما سيحدث تالياً؛ بل تخبرك بالظروف التي سيُمتَص في ظلّها أو يُضخَّم ما سيحدث.',
          'واختزال تسمية النظام في رهان اتجاهي يهدر تحديداً الإطار المشروط الاحتمالي الذي يجعلها مفيدة لعملية مؤسسية. فالنظام يُنير التفسير؛ ولا يحلّ محلّه أبداً بوصفه إشارة.']],
    ],
  },
};


// ── Topic selection — drive the EXISTING engine; pick the top eligible topic
//    that has a library entry and is not already published on disk. ───────────
function selectTopic() {
  const topics = readJson(TOPICS_PATH, { eligible: [] });
  const eligible = (topics.eligible || []).slice().sort((a, b) => (b.priority || 0) - (a.priority || 0));
  for (const t of eligible) {
    if (!CONCEPT_LIBRARY[t.id]) continue;
    if (fs.existsSync(path.join(ROOT, 'articles', `${t.id}.html`))) continue; // already published
    return t;
  }
  return null;
}

function pageShell(locale, slug) {
  const ar = locale === 'ar';
  const index = fs.readFileSync(path.join(ROOT, ar ? 'ar/articles/index.html' : 'articles/index.html'), 'utf8');
  const header = (index.match(/<!-- GLOBAL_HEADER_START -->[\s\S]*?<!-- GLOBAL_HEADER_END -->/) || [''])[0]
    .replace(/href="\/ar\/articles\/"/g, `href="/ar/articles/${slug}.html"`)
    .replace(/href="\/articles\/"/g, `href="/articles/${slug}.html"`);
  // Build the footer + closing scripts DETERMINISTICALLY (absolute paths, valid
  // from any depth) — the /articles/ index footer markup is not reliably
  // present across locales, so slicing it is fragile (it dropped global-header.js
  // on the AR page). global-header.js is required by check:header-runtime.
  const footer = ar
    ? `  <footer class="site-footer"><div class="wrap site-footer-inner"><div><strong>TradeAlphaAI</strong><p>أبحاث مالية تعليمية غير استشارية.</p></div><nav aria-label="تنقّل التذييل"><a href="/ar/insights/">الرؤى</a><a href="/ar/market-outlook/">توقعات السوق</a><a href="/ar/economic-calendar/">التقويم الاقتصادي</a><a href="/ar/methodology.html">المنهجية</a></nav><small>&copy; 2026 TradeAlphaAI</small></div></footer>
  <script src="/js/language-router.js" defer></script>
  <script src="/js/global-header.js" defer></script>
</body>
</html>`
    : `  <footer class="site-footer"><div class="wrap site-footer-inner"><div><strong>TradeAlphaAI</strong><p>Educational, non-advisory financial research.</p></div><nav aria-label="Footer navigation"><a href="/insights/">Insights</a><a href="/market-outlook/">Market Outlook</a><a href="/economic-calendar/">Economic Calendar</a><a href="/methodology.html">Methodology</a><a href="/methodology.html#disclaimer">Disclaimer</a></nav><small>&copy; 2026 TradeAlphaAI</small></div></footer>
  <script src="/js/language-router.js" defer></script>
  <script src="/js/global-header.js" defer></script>
</body>
</html>`;
  return { header, footer };
}

// "Where this connects" — the mandated internal links (separate pillar links).
function connectsSection(ar) {
  const t = (en, arT) => (ar ? arT : en);
  const base = ar ? '/ar' : '';
  const links = [
    [`${base}/economic-calendar/`, t('the economic calendar', 'التقويم الاقتصادي')],
    [`${base}/market-news/`, t('market news', 'أخبار السوق')],
    [`${base}/market-outlook/`, t('the market outlook', 'توقعات السوق')],
    [`${base}/market-structure/`, t('market structure', 'بنية السوق')],
    [`${base}/articles/`, t('related research', 'أبحاث ذات صلة')],
  ].map(([href, label]) => `<a href="${esc(href)}">${esc(label)}</a>`).join(' · ');
  return `<section class="market-section" id="where-this-connects"><div class="market-section-head"><span class="eyebrow">${esc(t('Where this connects', 'حيث يتصل هذا'))}</span><h2>${esc(t('Seeing the concept in the live desk', 'رؤية المفهوم في المكتب الحيّ'))}</h2></div><div class="market-panel"><p class="market-copy">${esc(t('This concept is not abstract — it runs through the desk’s live work, where the same structural logic is applied to the current tape rather than explained in the general case.', 'هذا المفهوم ليس مجرّداً — بل يجري في عمل المكتب الحيّ، حيث يُطبَّق المنطق الهيكلي نفسه على السوق الراهن بدل شرحه في الحالة العامة.'))}</p><p class="market-copy">${esc(t('See it applied in', 'شاهده مطبّقاً في'))} ${links}.</p></div></section>`;
}

function render(locale, topic) {
  const ar = locale === 'ar';
  const slug = topic.id;
  const concept = CONCEPT_LIBRARY[slug];
  const title = ar ? topic.title_ar : topic.title_en;
  const lead = concept.sections[0];
  const description = ar
    ? `شرح مؤسسي تعليمي لمفهوم ${title} — البنية والتفسير دون نصيحة استثمارية.`
    : `An institutional educational explainer of ${String(title).toLowerCase()} — structure and interpretation, without investment advice.`;
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}articles/${slug}.html`;
  const other = `https://www.tradealphaai.com/${ar ? '' : 'ar/'}articles/${slug}.html`;
  const shell = pageShell(locale, slug);

  const sections = concept.sections.map(([id, head_en, head_ar, enParas, arParas]) => {
    const paras = (ar ? arParas : enParas).map((p) => `<p class="market-copy">${esc(p)}</p>`).join('');
    return `<section class="market-section" id="${esc(id)}" data-reasoning-module="${esc(id)}">
  <div class="market-section-head"><span class="eyebrow">${esc(ar ? 'قراءة هيكلية' : 'Structural reading')}</span><h2>${esc(ar ? head_ar : head_en)}</h2></div>
  <div class="market-panel">${paras}</div>
</section>`;
  }).join('\n');

  const schema = { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, datePublished: DATE, dateModified: DATE, inLanguage: locale, author: { '@type': 'Organization', name: 'TradeAlphaAI Research' }, publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' }, mainEntityOfPage: url };

  const html = `<!doctype html>
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
  <link rel="alternate" hreflang="x-default" href="https://www.tradealphaai.com/articles/${slug}.html" />
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
${connectsSection(ar)}
  <section class="market-section" id="educational-disclaimer"><div class="market-panel"><h2>${ar ? 'إخلاء المسؤولية التعليمي' : 'Educational Disclaimer'}</h2><p class="market-copy">${ar ? 'هذا تحليل تعليمي لبنية السوق، وليس نصيحة استثمارية أو توصية تداول أو توقعاً لاتجاه الأسعار.' : 'This is educational market-structure analysis, not investment advice, a trading recommendation, or a directional forecast.'}</p></div></section>
</div></main>
${shell.footer}`;

  const text = html.match(/<main[\s\S]*?<\/main>/)[0].replace(/<[^>]+>/g, ' ');
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return { html, wordCount, text, title, slug };
}

function recordPublication(slug) {
  // Append to history + rebuild the topic memory so the concept enters cooldown.
  const current = readJson(TOPICS_PATH, { history: [] });
  current.history = (current.history || []).concat([{ id: slug, slug, selected_at: new Date().toISOString(), published_at: new Date().toISOString(), status: 'published', supervised: false }]);
  fs.writeFileSync(TOPICS_PATH, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
  const rebuilt = buildEducationalTopics();
  fs.writeFileSync(TOPICS_PATH, `${JSON.stringify(rebuilt, null, 2)}\n`, 'utf8');
}

function publish(write) {
  const topic = selectTopic();
  if (!topic) {
    console.log('[educational] no eligible covered topic available (all cooled or already published) — exiting green with no publish.');
    return { published: false, reason: 'no_eligible_topic' };
  }
  const en = render('en', topic);
  const arDoc = render('ar', topic);
  if (en.wordCount < MIN_WORDS.en || arDoc.wordCount < MIN_WORDS.ar) {
    console.log(`[educational] below word floor (en=${en.wordCount}/${MIN_WORDS.en}, ar=${arDoc.wordCount}/${MIN_WORDS.ar}) — not publishing.`);
    return { published: false, reason: 'below_min_words' };
  }
  const quality = scoreArticle({ en: en.text, ar: arDoc.text });
  if (quality.flags.length || quality.min_score < QUALITY_FLOOR) {
    console.log(`[educational] editorial-quality gate failed (min_score=${quality.min_score}, flags=${JSON.stringify(quality.flags)}) — not publishing.`);
    return { published: false, reason: 'below_quality_floor' };
  }
  console.log(`[educational] topic "${topic.id}" → articles/${topic.id}.html (en=${en.wordCount}w/${quality.en.score} ar=${arDoc.wordCount}w/${quality.ar.score})`);
  if (!write) return { published: false, reason: 'dry_run', slug: topic.id };

  fs.writeFileSync(path.join(ROOT, 'articles', `${topic.id}.html`), en.html.trimEnd() + '\n', 'utf8');
  fs.mkdirSync(path.join(ROOT, 'ar', 'articles'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'ar', 'articles', `${topic.id}.html`), arDoc.html.trimEnd() + '\n', 'utf8');
  recordPublication(topic.id);
  console.log(`[educational] published /articles/${topic.id}.html + /ar/articles/${topic.id}.html`);
  return { published: true, slug: topic.id, topic: topic.id };
}

if (require.main === module) {
  publish(process.argv.includes('--write'));
  process.exit(0);
}

module.exports = { publish, render, selectTopic, CONCEPT_LIBRARY, MIN_WORDS };
