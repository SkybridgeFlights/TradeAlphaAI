'use strict';

const SITE_URL = 'https://www.tradealphaai.com';

function renderLongFormEditorial(topic, locale = 'en', context = {}, reasoningPlan = null) {
  const ar = locale === 'ar';
  const title = ar ? topic.title_ar : topic.title_en;
  const description = ar ? topic.description_ar : topic.description_en;
  const sections = reasoningPlan?.section_plan?.length
    ? (ar ? reasoningArabicSections(topic, reasoningPlan) : reasoningEnglishSections(topic, reasoningPlan))
    : topic.slug === 'healthcare-etf-research-guide'
    ? (ar ? healthcareArabicSections() : healthcareEnglishSections())
    : (ar ? genericArabicSections(topic) : genericEnglishSections(topic));

  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <title>${escapeHtml(title)} | TradeAlphaAI</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${SITE_URL}${ar ? '/ar' : ''}/insights/${topic.slug}.html" />
  <link rel="alternate" hreflang="en" href="${SITE_URL}/insights/${topic.slug}.html" />
  <link rel="alternate" hreflang="en-US" href="${SITE_URL}/en/insights/${topic.slug}.html" />
  <link rel="alternate" hreflang="ar" href="${SITE_URL}/ar/insights/${topic.slug}.html" />
  <link rel="alternate" hreflang="x-default" href="${SITE_URL}/insights/${topic.slug}.html" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:locale" content="${ar ? 'ar_AR' : 'en_US'}" />
  <meta property="og:url" content="${SITE_URL}${ar ? '/ar' : ''}/insights/${topic.slug}.html" />
  <meta property="og:image" content="${SITE_URL}/Image/og-image.svg" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <script type="application/ld+json">
${JSON.stringify(articleSchema(topic, ar), null, 2)}
  </script>
  <script type="application/ld+json">
${JSON.stringify(faqSchema(topic, ar), null, 2)}
  </script>
  <script type="application/ld+json">
${JSON.stringify(breadcrumbSchema(topic, ar), null, 2)}
  </script>
</head>
<body>
  <main>
    <article>
      <header>
        <span class="insight-category-badge">${escapeHtml(ar ? topic.category_ar || topic.category : topic.category)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p class="market-lead">${escapeHtml(description)}</p>
      </header>
      <div data-editorial-intelligence="v2" data-editorial-angle="${escapeHtml(context.selected_angle || 'research-framework')}" data-reasoning-module="${escapeHtml(reasoningPlan?.topic_module || 'legacy')}" hidden></div>
${sections.map((section, index) => renderSection(section, index, ar, reasoningPlan)).join('\n')}
${renderEditorialContext(context, ar)}
${renderInstitutionalRepairContext(context, ar)}
      <section id="related-research">
        <h2>${ar ? 'مسار بحث مرتبط' : 'A related research path'}</h2>
        <p>${ar ? 'يمكن للقراء الذين يقارنون القطاعات الدفاعية الانتقال من تحليل الصندوق إلى منهجية بناء المؤشر ثم إلى سلوك القطاع مقابل السوق الواسع.' : 'Readers comparing defensive sectors can extend the analysis from the fund itself to index construction, diversification mechanics, and the behavior of sector ETFs relative to the broad market.'}</p>
        <ul>
          <li><a href="${ar ? '/ar' : ''}/etfs/xlv.html">${ar ? 'صفحة بحث صندوق XLV' : 'XLV ETF research page'}</a></li>
          <li><a href="${ar ? '/ar' : ''}/insights/defensive-investing-explained.html">${ar ? 'شرح الاستثمار الدفاعي' : 'Defensive investing explained'}</a></li>
          <li><a href="${ar ? '/ar' : ''}/insights/sector-etfs-vs-broad-market.html">${ar ? 'صناديق القطاعات مقابل السوق الواسع' : 'Sector ETFs versus the broad market'}</a></li>
        </ul>
      </section>
      <section id="continue-learning">
        <h2>${ar ? 'الخطوة التالية في البحث' : 'The next research step'}</h2>
        <p>${ar ? 'بعد فهم الاختلاف بين XLV وVHT وIYH، تساعد هذه القراءات على فصل أثر الرسوم والسيولة والتركيز عن الرأي العام في قطاع الرعاية الصحية.' : 'After separating XLV, VHT, and IYH by index design, these guides help distinguish the effects of fees, liquidity, and concentration from a broad opinion about healthcare.'}</p>
        <ul>
          <li><a href="${ar ? '/ar' : ''}/insights/etf-research-methodology.html">${ar ? 'منهجية بحث صناديق المؤشرات' : 'ETF research methodology'}</a></li>
          <li><a href="${ar ? '/ar' : ''}/insights/etf-risk-comparison-guide.html">${ar ? 'دليل مقارنة مخاطر صناديق المؤشرات' : 'ETF risk comparison guide'}</a></li>
          <li><a href="${ar ? '/ar' : ''}/insights/etf-diversification-guide.html">${ar ? 'دليل تنويع صناديق المؤشرات' : 'ETF diversification guide'}</a></li>
        </ul>
      </section>
      <section id="faq">
        <h2>${ar ? 'أسئلة شائعة' : 'Frequently Asked Questions'}</h2>
${faqBlocks(ar)}
      </section>
      <footer>
        <p>${ar ? 'تنبيه تعليمي: هذا المحتوى لأغراض تعليمية ومعلوماتية فقط ولا يمثل نصيحة مالية أو استثمارية أو توصية بشراء أو بيع أي ورقة مالية.' : 'Educational disclaimer: this content is for educational and informational purposes only and does not constitute financial or investment advice, or a recommendation to buy or sell any security.'}</p>
      </footer>
    </article>
  </main>
</body>
</html>`;
}

function renderSection(section, index, ar, reasoningPlan) {
  return `      <section id="${section.id}">
${index > 0 ? `        <p class="editorial-transition">${escapeHtml(section.transition || defaultTransition(index, ar))}</p>\n` : ''}
        <h2>${escapeHtml(section.heading)}</h2>
${section.paragraphs.map((p) => `        <p>${escapeHtml(p)}</p>`).join('\n')}
${section.id === 'xlv-vht-iyh-comparison' ? renderHealthcareComparisonTable(ar) : ''}
${section.id === 'comparative-etf-construction' && reasoningPlan ? renderReasoningComparisonTable(reasoningPlan, ar) : ''}
${section.id === 'macro-and-policy-sensitivity' ? renderEducationalCallout(ar) : ''}
      </section>`;
}

function reasoningEnglishSections(topic, plan) {
  const title = topic.title_en || 'the selected exposure';
  const layer = plan.required_reasoning_layers;
  const moduleLabel = title.replace(/\s+(guide|explained|research framework).*$/i, '').trim();
  const comparison = plan.comparisons[0] || { left: 'the primary exposure', right: 'the alternative', reason: 'construction and concentration' };
  const scenarios = layer.probability_weighted_scenarios;
  const terms = plan.terminology;
  const risks = plan.risk_factors;
  const sections = [
    {
      heading: 'Macro transmission',
      paragraphs: [
        `${moduleLabel} cannot be evaluated independently of the discount rate, growth expectations, and market liquidity. ${layer.macro_transmission_chain[0].mechanism} The first-order effect is ${layer.macro_transmission_chain[0].intermediate_effect}, but the portfolio result depends on cash-flow timing, balance-sheet quality, and the weighting of the largest constituents.`,
        `${layer.macro_transmission_chain[1].mechanism} This channel matters because reported revenue can remain stable after new demand has weakened, while changes in ${terms[0]} or ${terms[1]} reveal pressure earlier. Evidence should therefore link a macro claim to observable yields, earnings revisions, breadth, or company guidance rather than to a broad narrative alone.`,
        `Cross-asset confirmation provides a useful discipline. Treasury yields alter financing costs, the dollar changes multinational translation and global liquidity, and volatility affects the risk premium investors require. When these signals disagree, the appropriate conclusion is elevated uncertainty, not a deterministic forecast for ${moduleLabel}.`
      ]
    },
    {
      heading: 'Comparative ETF construction',
      paragraphs: [
        `${comparison.left} and ${comparison.right} may share a theme, yet ${comparison.reason}. Index rules determine which companies qualify, how quickly new leaders enter, and whether market capitalization allows a handful of holdings to dominate performance. That construction choice can matter more than a small difference in the fund label.`,
        `An institutional comparison separates holdings breadth from effective diversification. A portfolio can own many securities while retaining substantial exposure to one revenue model, valuation factor, or macro driver. Top-ten concentration, overlap, rebalancing rules, and the distribution of position sizes show whether diversification is economic or merely numerical.`,
        `Expense ratios, bid-ask spreads, assets under management, and underlying trading volume belong in the same analysis. A lower headline fee does not offset weak implementation if spreads widen or creation baskets rely on less-liquid constituents. Conversely, deep liquidity does not remove concentration risk when the largest positions drive most of the return variance.`
      ]
    },
    {
      heading: 'Allocation tradeoffs',
      paragraphs: [
        `Portfolio construction begins with the role assigned to the exposure. An allocator seeking broad participation may prefer the implementation with greater holdings breadth, while a benchmark-aware allocation may accept concentration to obtain tighter tracking and deeper liquidity. Neither choice is inherently superior because the relevant constraint can be tracking error, capacity, factor balance, or downside risk.`,
        `${comparison.left} versus ${comparison.right} should also be tested against existing portfolio exposures. Overlap with broad indexes can make a nominal satellite allocation an additional bet on the same mega-cap companies. The decision therefore depends on marginal contribution to concentration, duration, earnings sensitivity, and sector risk rather than the standalone characteristics of the fund.`,
        `Institutional positioning is best described as a pattern, not a claim about actual desk holdings. ${plan.required_reasoning_layers.portfolio_construction_logic[0]?.tradeoff || comparison.reason} can support different allocations across risk budgets, but a sound process documents the intended function, the benchmark, and the conditions that would require reassessment.`
      ]
    },
    {
      heading: 'Valuation compression and expansion',
      paragraphs: [
        `Valuation sensitivity should be examined through ${layer.valuation_sensitivity.toLowerCase()} A higher discount rate reduces the present value of distant cash flows, so businesses priced on long-run growth usually experience greater multiple pressure than companies supported by current free cash flow. The magnitude is conditional on earnings revisions and the starting valuation.`,
        `Multiple expansion is not evidence of improving fundamentals by itself. Prices may rise because real yields fall, risk appetite improves, or positioning becomes less defensive even while revenue estimates remain unchanged. Separating the discount-rate contribution from the earnings contribution prevents a liquidity-driven rally from being mistaken for a durable change in business economics.`,
        `The risk premium also reflects ${risks.slice(0, 3).join(', ')}. When uncertainty around those variables rises, investors may demand more compensation even if the base-case cash-flow forecast is stable. A credible valuation discussion therefore presents ranges, identifies the assumptions behind them, and avoids unsupported fair-value precision.`
      ]
    },
    {
      heading: 'Probability-weighted scenario framework',
      paragraphs: [
        `The base case carries an indicative ${scenarios[0].probability_range[0]}% to ${scenarios[0].probability_range[1]}% range: ${scenarios[0].catalyst} ${scenarios[0].transmission} The market implication is that ${scenarios[0].implication.toLowerCase()} This scenario would need revision if ${scenarios[0].invalidation.toLowerCase()}`,
        `A constructive case carries a ${scenarios[1].probability_range[0]}% to ${scenarios[1].probability_range[1]}% range and begins when ${scenarios[1].catalyst.toLowerCase()} The transmission mechanism is ${scenarios[1].transmission.toLowerCase()} For the signal to be credible, participation, earnings revisions, and liquidity should confirm the price response rather than leave leadership concentrated.`,
        `An adverse case carries a ${scenarios[2].probability_range[0]}% to ${scenarios[2].probability_range[1]}% range: ${scenarios[2].catalyst} ${scenarios[2].transmission} The affected instruments would be the more concentrated, less-liquid, or higher-duration implementations first, although ${scenarios[2].invalidation.toLowerCase()} These ranges organize uncertainty; they are not forecasts or trading signals.`
      ]
    },
    {
      heading: 'Liquidity and volatility structure',
      paragraphs: [
        `${layer.liquidity_and_volatility} Secondary-market volume is only one layer of ETF liquidity because authorized participants also depend on the tradability and price discovery of the underlying basket. During stress, spreads can widen before the fund's investment thesis changes, making execution quality a separate risk from fundamental exposure.`,
        `Historical volatility should be decomposed rather than treated as a fixed product attribute. Concentration, factor duration, constituent size, and event risk can all change the distribution of returns. Comparing standard deviation and drawdown with a broad benchmark is useful, but regime-specific behavior is more informative than a single full-period average.`,
        `Liquidity and volatility interact through position size. A fund that appears easy to trade in normal conditions may require a smaller risk budget when its underlying holdings are narrow or when leadership is crowded. Capacity analysis should therefore consider spread behavior, average dollar volume, creation activity, and the likely cost of reducing exposure during a volatility expansion.`
      ]
    },
    {
      heading: 'Business-cycle and earnings alignment',
      paragraphs: [
        `${layer.business_cycle_alignment} This alignment explains why the same exposure can behave defensively in one phase and cyclically in another. The analytical task is to identify whether current earnings depend more on stable demand, financing availability, pricing power, inventory, or discretionary capital spending.`,
        `${layer.earnings_cash_flow_durability} Revenue visibility is not equivalent to earnings durability because margins, reinvestment needs, customer acquisition costs, and working capital can absorb reported growth. Cash-flow conversion and balance-sheet resilience provide an evidence bridge between a thematic narrative and investable economics.`,
        `A historical regime comparison should focus on mechanisms rather than isolated returns. Inflation persistence tests margins and valuation; disinflation can support duration; recession risk increases the value of durable cash flow; and a soft landing can broaden participation. The relevant analog is the one with similar rates, revisions, and liquidity, not simply a similar index chart.`
      ]
    },
    {
      heading: 'Portfolio use case and monitoring framework',
      paragraphs: [
        `${moduleLabel} can be used as an educational case study in exposure design, but the research process should begin with the portfolio problem. The analyst should specify whether the objective is diversification, benchmark completion, factor adjustment, or access to a structural theme. That definition determines which construction tradeoffs are acceptable.`,
        `A monitoring framework can track real yields, earnings-revision breadth, relative strength, concentration, fund flows, and spread quality. Changes in those variables help distinguish a fundamental transition from a short-lived price move. Claims about ${terms[2]} or ${terms[3]} should be linked to issuer materials, filings, or verified market data before publication.`,
        `The final conclusion remains conditional and non-advisory. ${comparison.left} and ${comparison.right} represent different implementations rather than automatic substitutes, and the preferred research path depends on risk tolerance, time horizon, existing exposures, and liquidity needs. This framework supports independent analysis; it does not constitute financial advice or a recommendation.`
      ]
    }
  ];
  return sections.map((section, index) => ({
    id: plan.section_plan[index].id,
    heading: section.heading,
    paragraphs: section.paragraphs
  }));
}

function reasoningArabicSections(topic, plan) {
  const title = topic.title_ar || topic.title_en;
  const comparison = plan.comparisons[0] || { left: 'الصندوق الأساسي', right: 'الصندوق البديل' };
  const headings = [
    'انتقال المتغيرات الكلية',
    'المقارنة بين بناء الصناديق',
    'مفاضلات التخصيص',
    'انكماش التقييم واتساعه',
    'إطار السيناريوهات الاحتمالية',
    'هيكل السيولة والتقلب',
    'دورة الأعمال ومتانة الأرباح',
    'استخدام المحفظة وإطار المتابعة'
  ];
  const paragraphs = [
    [
      `لا يمكن تحليل ${title} بمعزل عن أسعار الفائدة وتوقعات النمو والسيولة. ارتفاع العائد الحقيقي يرفع معدل الخصم وقد يضغط التقييمات، لكن الأثر النهائي يعتمد على توقيت التدفقات النقدية وجودة الميزانية وتركيز أكبر المكونات.`,
      'تنتقل الصدمة الكلية عبر تكلفة التمويل وهوامش الأرباح ومراجعات التوقعات قبل أن تظهر بالكامل في النتائج المعلنة. لذلك يجب ربط أي استنتاج ببيانات موثقة عن العوائد واتساع المشاركة والتقلب وإرشادات الشركات.',
      'توفر العلاقات بين الأصول اختبارا إضافيا. فالدولار يؤثر في ترجمة الإيرادات العالمية، وعوائد الخزانة تغير تكلفة رأس المال، بينما يحدد التقلب علاوة المخاطر المطلوبة. وعند تعارض الإشارات يكون عدم اليقين هو الاستنتاج المنضبط.'
    ],
    [
      `قد يشترك ${comparison.left} و${comparison.right} في الموضوع نفسه، لكن قواعد المؤشر وتوزيع الأوزان وعدد المكونات تصنع تعرضا مختلفا. المقارنة المؤسسية تدرس التركيز وتأثير أكبر الحيازات وسرعة إعادة التوازن بدلا من الاكتفاء باسم القطاع.`,
      'عدد الحيازات لا يساوي التنويع الاقتصادي دائما. فقد يضم الصندوق شركات كثيرة تعتمد على محرك إيرادات واحد أو عامل تقييم واحد، ولهذا يجب قياس التداخل وتوزيع الأوزان والتعرض للشركات الكبرى والصغيرة.',
      'تدخل الرسوم وفروق الأسعار وحجم الأصول وسيولة المكونات في قرار التنفيذ. قد يكون الصندوق منخفض التكلفة لكنه أكثر حساسية لاتساع السبريد، كما أن السيولة المرتفعة لا تلغي مخاطر التركيز في عدد محدود من الأسهم.'
    ],
    [
      'تبدأ مفاضلة التخصيص بتحديد وظيفة التعرض داخل المحفظة. قد يفضل الباحث المشاركة الواسعة، أو تتبع معيار محدد، أو تقليل حساسية عامل معين. تختلف النتيجة حسب قيود السعة والانحراف عن المؤشر وميزانية المخاطر.',
      `يجب مقارنة ${comparison.left} و${comparison.right} مع الحيازات الموجودة فعلا. التداخل مع المؤشرات الواسعة قد يحول التخصيص الفرعي إلى زيادة غير مقصودة في تركيز الشركات الكبرى أو حساسية المدة.`,
      'لا يدعي التحليل معرفة مراكز المؤسسات الفعلية. بل يشرح أنماط تخصيص محتملة تعتمد على جودة التدفق النقدي والسيولة والبناء، مع توثيق الهدف والمعيار والشروط التي تستدعي إعادة التقييم.'
    ],
    [
      'تتأثر التقييمات بمعدل الخصم وتوقعات الأرباح وعلاوة المخاطر. التدفقات البعيدة أكثر حساسية لارتفاع الفائدة من التدفقات الحالية، ولذلك يجب فصل أثر العوائد عن أثر تغير توقعات الإيرادات والهوامش.',
      'اتساع المضاعفات لا يثبت تحسن الأساسيات وحده. فقد ترتفع الأسعار مع انخفاض العائد الحقيقي أو تحسن شهية المخاطرة من دون تغير تقديرات الأرباح، مما يجعل تحليل مساهمة السيولة ضروريا.',
      'يجب عرض نطاقات تقييم مشروطة لا أهداف أسعار دقيقة. مخاطر المنافسة والتنظيم والتركيز والتنفيذ قد ترفع العائد المطلوب حتى عندما يبقى السيناريو الأساسي للتدفقات النقدية مستقرا.'
    ],
    [
      'يفترض السيناريو الأساسي بقاء الظروف مختلطة من دون تغير حاسم في النمو أو التضخم. في هذه الحالة تكتسب جودة الأرباح وبناء الصندوق أهمية أكبر من اتجاه الموضوع العام، وتظل النتيجة مشروطة باتساع المشاركة.',
      'يفترض السيناريو الإيجابي تراجع ضغط الخصم مع بقاء توقعات الأرباح متماسكة. يجب أن تؤكد مراجعات الأرباح والسيولة واتساع السوق حركة الأسعار، وإلا قد يبقى التحسن معتمدا على عدد محدود من المكونات.',
      'يفترض السيناريو السلبي ارتفاع علاوة المخاطر أو ضعف النمو أو اشتداد أحد المخاطر الخاصة بالقطاع. تنتقل الضغوط أولا إلى الأدوات الأعلى تركيزا أو الأقل سيولة. هذه السيناريوهات تعليمية وليست توقعات أو إشارات تداول.'
    ],
    [
      'السيولة الظاهرة في شاشة التداول ليست الصورة الكاملة، لأن صانع السوق يعتمد أيضا على سيولة السلة الأساسية وآلية الإنشاء والاسترداد. قد تتسع الفروق أثناء الضغط قبل أن تتغير الفرضية الأساسية.',
      'يجب تفكيك التقلب التاريخي إلى تركيز وحجم الشركات وحساسية المدة ومخاطر الأحداث. المقارنة مع مؤشر واسع مفيدة، لكن سلوك الصندوق عبر أنظمة مختلفة يقدم معلومات أفضل من متوسط واحد.',
      'يرتبط حجم المركز بالسيولة والتقلب. تحليل السعة يشمل متوسط قيمة التداول وفروق الأسعار وسيولة المكونات وتكلفة خفض التعرض في فترة توسع التقلب، ولا يعتمد على حجم الأصول وحده.'
    ],
    [
      'تحدد دورة الأعمال ما إذا كان الطلب مستقرا أو دوريا، وما إذا كانت الأرباح تعتمد على التسعير أو التمويل أو الإنفاق الرأسمالي. لهذا قد يتصرف التعرض نفسه دفاعيا في مرحلة ودوريا في مرحلة أخرى.',
      'وضوح الإيرادات لا يساوي متانة الأرباح. فقد تمتص الهوامش وإعادة الاستثمار ورأس المال العامل جزءا كبيرا من النمو المعلن، ولذلك يربط التحليل بين جودة التدفق النقدي وقوة الميزانية.',
      'تقارن الدراسة التاريخية آليات متشابهة لا رسوما متشابهة فقط. استمرار التضخم يختبر الهوامش والتقييم، والانكماش التضخمي قد يدعم المدة، بينما يزيد خطر الركود قيمة التدفقات الأكثر ثباتا.'
    ],
    [
      `يمكن استخدام ${title} كدراسة تعليمية في تصميم التعرض. يجب أولا تحديد ما إذا كان الهدف هو التنويع أو استكمال المؤشر أو تعديل عامل مخاطرة أو دراسة موضوع هيكلي.`,
      'يشمل إطار المتابعة العوائد الحقيقية واتساع مراجعات الأرباح والقوة النسبية والتركيز وتدفقات الصناديق وجودة السبريد. تساعد هذه المتغيرات على فصل التحول الأساسي عن الحركة القصيرة.',
      `يبقى الاستنتاج مشروطا وغير استشاري. يمثل ${comparison.left} و${comparison.right} طريقتين مختلفتين للتنفيذ، ويتوقف البحث المناسب على الأفق الزمني والتعرضات الحالية والسيولة وتحمل المخاطر. هذا المحتوى لا يشكل نصيحة مالية.`
    ]
  ];
  return headings.map((heading, index) => ({
    id: plan.section_plan[index].id,
    heading,
    paragraphs: paragraphs[index].map((paragraph) => `${paragraph} ضمن إطار بحثي مشروط ومدعوم بالأدلة بصورة منهجية.`)
  }));
}

function renderReasoningComparisonTable(plan, ar) {
  const rows = plan.comparisons.map((item) => [
    item.left,
    item.right,
    item.reason,
    ar ? 'راجع الوزن والتركيز والسيولة' : 'Review weighting, concentration, and liquidity'
  ]);
  const headers = ar
    ? ['الأداة الأساسية', 'الأداة المقارنة', 'سبب المقارنة', 'اختبار البحث']
    : ['Primary ETF', 'Comparison ETF', 'Construction difference', 'Research test'];
  return `        <div class="editorial-table-wrap" role="region" aria-label="${ar ? 'مقارنة بناء الصناديق' : 'ETF construction comparison'}" tabindex="0">
          <table class="editorial-comparison-table">
            <thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead>
            <tbody>${rows.map((row) => `<tr>${row.map((item) => `<td>${escapeHtml(item)}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>`;
}

function defaultTransition(index, ar) {
  const en = [
    'That distinction matters because sector labels can conceal very different economic exposures.',
    'Once the defensive case is clear, index construction becomes the next source of differentiation.',
    'The fund-level comparison is only useful when it is connected to the businesses underneath the index.',
    'Those subindustry differences also explain why the macro backdrop does not affect every healthcare fund equally.',
    'With the transmission channels established, the comparison can move from labels to measurable portfolio characteristics.',
    'The same framework also clarifies the environments in which defensive exposure can disappoint.',
    'Taken together, these mechanics support a research process rather than a directional conclusion.'
  ];
  const arText = [
    'هذا التمييز مهم لأن اسم القطاع قد يخفي تعرضات اقتصادية مختلفة.',
    'بعد توضيح الطابع الدفاعي يصبح بناء المؤشر مصدر الاختلاف التالي.',
    'لا تكتمل مقارنة الصناديق من دون ربطها بأعمال الشركات داخل المؤشر.',
    'وتفسر اختلافات الصناعات الفرعية أيضا لماذا لا يؤثر السياق الكلي بالطريقة نفسها في كل صندوق.',
    'بعد تحديد قنوات الانتقال يمكن الانتقال من التسميات إلى خصائص المحفظة القابلة للمقارنة.',
    'ويوضح الإطار نفسه البيئات التي قد يتأخر فيها التعرض الدفاعي.',
    'تدعم هذه الآليات مجتمعة عملية بحث ولا تقدم استنتاجا اتجاهيا.'
  ];
  return (ar ? arText : en)[Math.min(index - 1, 6)];
}

function renderEditorialContext(context, ar) {
  const label = context.evidence_status === 'verified'
    ? (ar ? 'سياق السوق الموثق' : 'Verified market context')
    : (ar ? 'منهج السياق' : 'Context discipline');
  const text = context.evidence_status === 'verified'
    ? (ar ? 'تم استخدام بيانات سوق محلية موثقة لصياغة التحليل الكلي مع الحفاظ على الطابع التعليمي.' : 'Verified local market-state fields informed the macro discussion while the conclusions remain conditional and educational.')
    : (ar ? 'لم تكن بيانات النظام اللحظية موثقة، لذلك يستخدم التحليل سيناريوهات مشروطة للفائدة والتقلب والدوران بدلا من عرض حالة سوق غير مؤكدة كحقيقة.' : 'Live regime fields were not verified, so rates, volatility, and defensive rotation are discussed conditionally rather than presented as current facts.');
  return `      <aside class="editorial-note market-context-note" data-context-status="${escapeHtml(context.evidence_status || 'conditional')}">
        <strong>${label}</strong>
        <p>${text}</p>
      </aside>`;
}

function renderInstitutionalRepairContext(context, ar) {
  if (ar || !context?.repair_spec?.context_injections?.length) return '';
  const paragraphs = [];
  for (const injection of context.repair_spec.context_injections) {
    const data = injection.context || {};
    if (injection.type === 'regime_context' && data.regime_summary) {
      paragraphs.push(`Regime context: ${data.regime_summary} This context is used as a conditional analytical frame, and the article does not treat it as a recommendation or a deterministic forecast.`);
    }
    if (injection.type === 'transmission_context') {
      for (const chain of data.relevant_chains || []) {
        if (chain.mechanism) paragraphs.push(`Transmission mechanism (${chain.key}): ${chain.mechanism}`);
      }
    }
    if (injection.type === 'etf_comparison_context') {
      for (const profile of data.etf_profiles || []) {
        const detail = [profile.institutional_interpretation, profile.comparison_note].filter(Boolean).join(' ');
        if (detail) paragraphs.push(`${profile.ticker} comparison context: ${detail}`);
      }
    }
    if (injection.type === 'rate_path_context' && data.narrative) {
      paragraphs.push(`Rate-path scenario: ${data.narrative} The relevant conclusion depends on confirmation from the yield curve, liquidity conditions, and participation rather than the policy label alone.`);
    }
  }
  if (!paragraphs.length) return '';
  return `      <section id="institutional-repair-context">
        <p class="editorial-transition">The next layer connects the educational framework to the specific transmission mechanisms identified during autonomous review.</p>
        <h2>Institutional transmission and comparison context</h2>
${paragraphs.slice(0, 6).map((paragraph) => `        <p>${escapeHtml(paragraph)}</p>`).join('\n')}
      </section>`;
}

function renderHealthcareComparisonTable(ar) {
  const rows = ar ? [
    ['XLV', '0.08%', 'نحو 59', 'شركات الرعاية الصحية في S&P 500', 'مرتفع بسبب عدد أقل من الشركات الكبرى', 'دفاعي نسبيا مع مخاطر تركيز', 'عميقة عادة'],
    ['VHT', '0.09%', 'نحو 398', 'سوق أمريكي واسع متعدد الأحجام', 'أقل من XLV مع بقاء وزن الشركات الكبرى مهما', 'أوسع وقد يتأثر أكثر بالشركات الأصغر', 'مرتفعة'],
    ['IYH', '0.38%', 'نحو 102', 'مؤشر رعاية صحية أمريكي مقيد الأوزان', 'متوسط إلى مرتفع', 'بين التعرض الكبير الواسع والمركز', 'مرتفعة']
  ] : [
    ['XLV', '0.08%', 'about 59', 'S&P 500 healthcare sleeve', 'High; fewer mega-cap constituents', 'Relatively defensive, with concentration risk', 'Typically deepest'],
    ['VHT', '0.09%', 'about 398', 'Broad U.S. all-cap healthcare', 'Lower than XLV, though mega-caps still matter', 'Broader; more small- and mid-cap sensitivity', 'High'],
    ['IYH', '0.38%', 'about 102', 'Capped U.S. healthcare index', 'Moderate to high', 'Between broad and concentrated sector exposure', 'High']
  ];
  const headers = ar
    ? ['الصندوق', 'نسبة المصروفات', 'عدد الحيازات التقريبي', 'أسلوب التركيز', 'تأثير أكبر الحيازات', 'نمط التقلب المعتاد', 'السيولة']
    : ['ETF', 'Expense ratio', 'Approx. holdings', 'Concentration style', 'Top-holdings influence', 'Typical volatility profile', 'Liquidity profile'];
  return `        <div class="editorial-table-wrap" role="region" aria-label="${ar ? 'مقارنة صناديق الرعاية الصحية' : 'Healthcare ETF comparison'}" tabindex="0">
          <table class="editorial-comparison-table">
            <thead><tr>${headers.map((item) => `<th>${item}</th>`).join('')}</tr></thead>
            <tbody>${rows.map((row) => `<tr>${row.map((item) => `<td>${item}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
        <p class="editorial-data-note">${ar ? 'بيانات الرسوم والحيازات تقريبية وتعكس مواد الجهات المصدرة المتاحة في مايو 2026؛ تتغير الحيازات ويجب مراجعة النشرة الحالية.' : 'Expense ratios and approximate holdings reflect issuer materials available in May 2026. Holdings change; verify current specifications with'} <a href="https://www.ssga.com/mainfund/xlv" rel="nofollow noopener">${ar ? 'State Street' : 'State Street'}</a>, <a href="https://investor.vanguard.com/investment-products/etfs/profile/vht" rel="nofollow noopener">${ar ? 'Vanguard' : 'Vanguard'}</a>, ${ar ? 'و' : 'and'} <a href="https://www.ishares.com/us/products/239511/IYH" rel="nofollow noopener">${ar ? 'iShares' : 'iShares'}</a>.</p>`;
}

function renderEducationalCallout(ar) {
  return `        <aside class="editorial-callout">
          <strong>${ar ? 'ملاحظة بحثية' : 'Research note'}</strong>
          <p>${ar ? 'الدفاعية ليست صفة ثابتة للصندوق. فهي نتيجة لتفاعل مزيج الصناعات وجودة الأرباح والتقييم والسيولة مع نظام السوق.' : 'Defensiveness is not a permanent ETF attribute. It emerges from the interaction between industry mix, earnings quality, valuation, liquidity, and the prevailing market regime.'}</p>
        </aside>`;
}

function healthcareEnglishSections() {
  return [
    {
      id: 'what-healthcare-etfs-represent',
      heading: 'What healthcare ETFs represent',
      paragraphs: [
        'Healthcare ETFs often move to the center of portfolio discussions when growth expectations soften, volatility rises, or investors begin questioning how much earnings risk sits inside cyclical and high-duration assets. The attraction is understandable: large pharmaceutical, insurance, and medical-device companies can generate relatively stable revenue even when broader activity slows. Yet the defensive label can be misleading because the same fund may also contain biotechnology, hospital, and life-science businesses whose returns depend on financing conditions, regulation, clinical execution, and innovation cycles.',
        'The educational value of studying healthcare ETFs is that they show how sector exposure can be diversified and concentrated at the same time. A fund can hold dozens or hundreds of companies while still being driven by a small set of large pharmaceutical, insurance, or medical-device names. XLV, VHT, and IYH all provide healthcare exposure, but their index design, number of holdings, concentration, and cost structure can lead to different research conclusions. A useful analysis therefore begins with what the ETF actually owns, not with the assumption that every healthcare fund represents the same risk profile.'
      ]
    },
    {
      id: 'defensive-sector-behavior',
      heading: 'Why healthcare can behave defensively',
      paragraphs: [
        'Healthcare is often described as defensive because demand for many medical products and services is less discretionary than demand for advertising, travel, luxury goods, or cyclical industrial equipment. People do not usually postpone essential prescriptions, insurance coverage, emergency care, or chronic-disease treatment simply because economic growth slows. That can make the earnings base of large pharmaceutical, managed-care, and medical-service companies appear more stable than sectors whose revenue depends heavily on consumer confidence or corporate capital spending.',
        'Defensive behavior does not mean healthcare ETFs always rise when the market falls. It means the sector may sometimes decline less, attract relative rotation, or hold earnings expectations better when investors reduce exposure to more cyclical areas. During periods of weaker growth, falling risk appetite, or elevated volatility, portfolio managers may compare healthcare with utilities, consumer staples, and other sectors that have steadier demand patterns. In that environment, the transmission mechanism is usually earnings resilience: if analysts believe healthcare cash flows are less exposed to the slowdown, the sector can receive a relative valuation premium. The cross-asset rate channel also matters because higher Treasury yields can trigger valuation repricing in biotech and other long-duration healthcare businesses even while mature pharmaceutical cash flows remain comparatively stable.'
      ]
    },
    {
      id: 'xlv-vht-iyh-comparison',
      heading: 'XLV, VHT, and IYH are not identical',
      paragraphs: [
        'XLV is commonly used as the most liquid healthcare sector ETF benchmark because it tracks healthcare companies inside the S&P 500. That gives it large-cap healthcare exposure, but it also means the fund is limited to companies that are S&P 500 constituents. The result is a concentrated, large-company portfolio where mega-cap pharmaceutical, managed-care, and device companies can dominate the return profile. For researchers, XLV is useful when the goal is to isolate healthcare exposure within the large-cap U.S. equity universe.',
        'VHT usually provides a broader healthcare universe because it tracks a wider investable market index. The fund may include more mid-cap and smaller healthcare companies than XLV, which can increase diversification by holdings count while also introducing more exposure to companies with less mature revenue streams. This matters because a broader healthcare ETF can behave differently when biotech, medical technology, or smaller life-science firms are leading or lagging. VHT may therefore be better suited for studying the full healthcare ecosystem rather than only the large-cap sector sleeve.',
        'IYH is another healthcare ETF with a different provider, index construction, expense ratio, and holdings mix. It can overlap heavily with XLV and VHT in the largest names, but overlap is not the same as equivalence. Researchers should compare expense ratio, assets under management, bid-ask spread, number of holdings, top-ten concentration, and sector-industry weights before treating IYH as interchangeable. The practical question is not which fund is universally superior; it is which ETF structure best matches the research question being asked.'
      ]
    },
    {
      id: 'industry-exposures',
      heading: 'Pharmaceuticals, biotech, insurance, devices, and hospitals',
      paragraphs: [
        'Pharmaceutical exposure often gives healthcare ETFs mature cash-flow characteristics, but it also introduces patent-cycle and drug-pricing risk. Large pharmaceutical firms may have global revenue, strong margins, and large research budgets, yet individual products can lose exclusivity, face competition, or become the focus of political pressure. When a fund has heavy pharmaceutical exposure, researchers should examine whether earnings are supported by diversified product lines or overly dependent on a small number of blockbuster drugs.',
        'Biotechnology exposure changes the risk profile because biotech companies can be more sensitive to clinical trial results, regulatory approvals, financing conditions, and acquisition activity. A broad healthcare ETF may hold biotechnology names, but the weight matters. A small biotech allocation can add innovation exposure without dominating fund behavior, while a larger allocation can increase volatility. Higher interest rates can also pressure speculative biotech because future cash flows and external financing become more costly, which links biotech risk to macro sensitivity.',
        'Managed care and insurance companies introduce a different set of mechanics. Their earnings depend on premium pricing, medical cost trends, enrollment, reimbursement policy, and government programs. Hospitals and care providers are exposed to labor costs, patient volumes, payer mix, and reimbursement rates. Medical-device companies can offer more global growth exposure but may be sensitive to procedure volumes, hospital capital budgets, and innovation cycles. A serious ETF comparison should identify which of these industry drivers are most important inside each fund.'
      ]
    },
    {
      id: 'macro-and-policy-sensitivity',
      heading: 'Interest rates, regulation, and defensive rotation',
      paragraphs: [
        'Healthcare ETFs are equity funds, so they remain exposed to broad market conditions, valuation changes, and liquidity cycles. Interest rates can affect the sector in several ways. Higher rates can reduce the valuation of long-duration growth companies, increase financing costs for smaller biotech firms, and shift investor preference toward companies with current cash flow. Lower rates can support risk appetite and innovation-sensitive subsectors, but they may also coincide with weaker growth, which changes the relative appeal of defensive sectors.',
        'Regulation is one of the sector’s central risks. Drug-pricing policy, insurance reimbursement, Medicare and Medicaid changes, antitrust enforcement, and approval standards can all affect healthcare earnings expectations. The impact is not evenly distributed. A drug-pricing proposal may pressure pharmaceutical companies more than device manufacturers, while reimbursement changes may affect insurers, hospitals, or service providers differently. This is why a healthcare ETF can be diversified but still exposed to concentrated policy themes.',
        'Defensive rotation is another important concept. When volatility rises or growth expectations weaken, investors may rotate toward sectors perceived to have more stable demand. Healthcare can participate in that rotation, but the degree depends on what the ETF owns. A fund dominated by mature pharmaceuticals and managed care may behave more defensively than one with heavier biotech or high-growth medical technology exposure. The transmission chain is sector mix -> earnings stability -> valuation preference -> relative ETF performance.'
      ]
    },
    {
      id: 'comparison-framework',
      heading: 'How to compare healthcare ETFs',
      paragraphs: [
        'A practical comparison of XLV, VHT, IYH, or any healthcare ETF should begin with holdings. Review the top ten positions, their weights, and the share of the fund represented by the largest companies. A portfolio with a high top-ten concentration may be efficient and liquid, but its performance can be driven by a small group of large names. A broader fund may look more diversified, yet the largest holdings can still dominate if the index is market-cap weighted.',
        'Expense ratio, liquidity, and trading costs also matter for research. A lower expense ratio can be relevant for long holding periods, while bid-ask spread and trading volume matter when studying execution quality. Assets under management can influence liquidity, but it should not be the only variable. Researchers should compare the fund’s average volume, spread behavior, and whether the underlying holdings are liquid enough to support the ETF structure during volatile markets.',
        'Historical volatility and drawdown behavior should be interpreted carefully. A healthcare ETF that has lower volatility over one period may not remain low-volatility when biotech risk, regulatory headlines, or valuation compression dominate. Compare volatility against SPY, sector peers, and the ETF’s own history. Also compare upside and downside capture during risk-on and risk-off periods. The goal is to understand how the fund has behaved under different market regimes, not to assume the past creates a guaranteed future pattern.'
      ]
    },
    {
      id: 'when-healthcare-may-lag',
      heading: 'When healthcare ETFs may lag the market',
      paragraphs: [
        'Healthcare ETFs can lag when investors favor cyclical recovery, high-beta technology, or sectors with stronger near-term earnings acceleration. In a broad risk-on phase, capital may flow toward semiconductors, consumer discretionary, financials, industrials, or small-cap equities if investors believe economic growth is improving. Healthcare may still produce stable earnings, but stability can be less attractive when the market is paying for acceleration and operating leverage.',
        'The sector can also lag when policy risk becomes the dominant narrative. Drug-pricing headlines, election-cycle healthcare proposals, reimbursement uncertainty, or pressure on insurance margins can lead to sector-specific valuation compression. Even diversified healthcare ETFs may be affected if the largest holdings are directly exposed to the policy issue. This is why headline risk should be evaluated alongside holdings concentration and industry weights.',
        'Another lag scenario occurs when innovation risk disappoints. Weak trial data, lower procedure volumes, funding stress for smaller biotech firms, or slowing medical-device demand can reduce investor enthusiasm for parts of the sector. Because ETFs combine many companies, a single event rarely defines the whole fund, but several related disappointments can pressure the sector. Educational research should therefore distinguish between broad defensive demand and the specific catalysts that can weaken subsector performance.'
      ]
    },
    {
      id: 'educational-framework',
      heading: 'Using healthcare ETFs as an educational research framework',
      paragraphs: [
        'Healthcare ETF research should be framed as exposure analysis rather than a buy-or-sell conclusion. The useful questions are concrete: which industries does the fund own, how concentrated is it, what does it cost, how liquid is it, and what risks dominate the holdings? This approach helps readers understand the relationship between ETF structure and sector mechanics without turning the article into a recommendation.',
        'For a structured workflow, compare XLV, VHT, and IYH across holdings, concentration, expense ratio, liquidity, historical volatility, and industry mix. Then connect those observations to macro and policy context: rates, defensive rotation, regulation, drug pricing, reimbursement, and innovation cycles. Finally, evaluate whether the fund is being studied as a broad healthcare benchmark, a defensive sector allocation, or a way to understand a specific part of the medical economy.',
        'The conclusion should remain conditional and educational. Healthcare ETFs may offer exposure to relatively stable demand, but they also carry equity-market risk, regulatory risk, company concentration, and innovation uncertainty. A disciplined research framework does not assume the sector is always defensive or always attractive. It explains the mechanics that can make healthcare ETFs behave differently across market regimes, allowing readers to continue their own research with clearer questions.'
      ]
    }
  ];
}

function healthcareArabicSections() {
  return [
    {
      id: 'what-healthcare-etfs-represent',
      heading: 'ما الذي تمثله صناديق الرعاية الصحية',
      paragraphs: [
        'صناديق الرعاية الصحية المتداولة تجمع شركات تعمل في الأدوية، التأمين الصحي، الأجهزة الطبية، المستشفيات، أدوات علوم الحياة، وخدمات العلاج والتشخيص. لذلك لا تمثل هذه الصناديق قطاعا دفاعيا بسيطا فقط، بل تجمع نماذج أعمال متعددة تختلف في استقرار الأرباح، حساسية التنظيم، دورات الابتكار، ومستوى التقلب. هذا التنوع يجعل تحليل الصندوق يبدأ من المكونات الفعلية لا من اسم القطاع وحده.',
        'القيمة التعليمية في دراسة هذه الصناديق أنها توضح كيف يمكن أن يكون القطاع متنوعا ومركزا في الوقت نفسه. قد يحتوي الصندوق على عشرات الشركات، لكن أداءه قد يعتمد على عدد محدود من شركات الأدوية الكبرى أو التأمين أو الأجهزة الطبية. لذلك يجب مقارنة XLV وVHT وIYH من حيث المؤشر، عدد المكونات، التركيز، التكلفة، السيولة، وتوزيع الصناعات الفرعية.',
        'الرعاية الصحية تقع بين الطلب الضروري ومخاطر الابتكار. كثير من الخدمات الطبية والأدوية والتغطية التأمينية تبقى مطلوبة في فترات التباطؤ، لكن مخاطر التجارب السريرية، التسعير الدوائي، القرارات التنظيمية، وبراءات الاختراع قد تخلق تقلبات واضحة. صندوق الرعاية الصحية يجمع هذه العوامل داخل أداة واحدة، ولهذا يحتاج إلى تحليل يفرق بين الاستقرار التشغيلي ومخاطر السياسة والابتكار.'
      ]
    },
    {
      id: 'defensive-sector-behavior',
      heading: 'لماذا قد يتصرف القطاع بشكل دفاعي',
      paragraphs: [
        'يوصف قطاع الرعاية الصحية أحيانا بأنه دفاعي لأن الطلب على كثير من خدماته أقل ارتباطا بالدورة الاقتصادية مقارنة بالسفر أو السلع الفاخرة أو الإنفاق الصناعي. المرضى لا يؤجلون دائما الأدوية الأساسية أو العلاج المزمن أو التأمين الصحي بسبب تباطؤ النمو. هذا يمكن أن يدعم استقرار الإيرادات لدى شركات الأدوية الكبيرة وشركات الرعاية المدارة وبعض مقدمي الخدمات.',
        'لكن السلوك الدفاعي لا يعني أن صناديق الرعاية الصحية ترتفع دائما عندما ينخفض السوق. المعنى الأدق هو أنها قد تتراجع بدرجة أقل أو تجذب تدفقات نسبية عندما يبحث المستثمرون عن أرباح أكثر استقرارا. آلية الانتقال تكون عادة من تباطؤ النمو إلى تفضيل القطاعات ذات الطلب المستمر، ثم إلى تقييم أعلى نسبيا للشركات التي تبدو أرباحها أقل حساسية للدورة.',
        'هذا الطابع الدفاعي قد يضعف عندما يفضل السوق النمو عالي المخاطر أو القطاعات الدورية. في مرحلة اندفاع نحو التكنولوجيا أو الشركات الصغيرة أو القطاعات المالية والصناعية، قد يتأخر قطاع الرعاية الصحية حتى لو بقيت أرباحه مستقرة. لذلك يجب فهم الدفاعية كصفة نسبية مرتبطة بالنظام السوقي وليست ضمانا للأداء.'
      ]
    },
    {
      id: 'xlv-vht-iyh-comparison',
      heading: 'الفروق بين XLV وVHT وIYH',
      paragraphs: [
        'صندوق XLV يستخدم غالبا كمعيار سائل لقطاع الرعاية الصحية داخل مؤشر S&P 500. هذا يجعله مركزا في الشركات الأمريكية الكبيرة المدرجة ضمن المؤشر، وبالتالي قد تهيمن عليه شركات أدوية وتأمين وأجهزة طبية ضخمة. يفيد XLV عندما يكون هدف البحث هو عزل قطاع الرعاية الصحية داخل عالم الأسهم الأمريكية الكبيرة.',
        'صندوق VHT عادة يمنح تعرضا أوسع لأنه يتبع مؤشرا يضم عددا أكبر من شركات الرعاية الصحية. هذا قد يضيف شركات متوسطة وأصغر حجما ويزيد تنوع المكونات، لكنه قد يرفع التعرض لشركات أقل نضجا أو أكثر حساسية للتمويل والابتكار. لذلك يمكن أن يكون VHT مناسبا لدراسة النظام الكامل للقطاع وليس فقط شريحة الشركات الكبرى.',
        'أما IYH فيأتي من مزود مختلف وله مؤشر وتكلفة ومزيج مكونات مختلف. قد يتداخل مع XLV وVHT في الأسماء الكبرى، لكن التداخل لا يعني التطابق. يجب مقارنة نسبة المصروفات، حجم الأصول، السبريد، عدد المكونات، تركيز أكبر عشر حيازات، وتوزيع الصناعات قبل اعتبار الصناديق قابلة للاستبدال.'
      ]
    },
    {
      id: 'industry-exposures',
      heading: 'الأدوية والتقنية الحيوية والتأمين والأجهزة والمستشفيات',
      paragraphs: [
        'تعرض الأدوية قد يمنح الصندوق خصائص تدفق نقدي أكثر نضجا، لكنه يضيف مخاطر براءات الاختراع وتسعير الدواء. شركات الأدوية الكبرى قد تملك هوامش قوية وأسواقا عالمية، لكنها قد تواجه انتهاء حماية منتجات مهمة أو ضغوطا سياسية حول الأسعار. لذلك يجب دراسة ما إذا كانت أرباح الشركة موزعة على منتجات عديدة أو تعتمد على عدد محدود من الأدوية.',
        'التقنية الحيوية تغير صورة المخاطر لأنها أكثر حساسية لنتائج التجارب السريرية، الموافقات التنظيمية، ظروف التمويل، ونشاط الاستحواذ. إذا كان وزن التقنية الحيوية صغيرا فقد يضيف ابتكارا دون أن يهيمن على الصندوق، أما الوزن الأكبر فقد يرفع التقلب. ارتفاع الفائدة قد يضغط هذا الجزء لأن التمويل يصبح أصعب وتقييم التدفقات المستقبلية يتراجع.',
        'شركات التأمين والرعاية المدارة تعتمد على التسعير، تكاليف العلاج، العضوية، وسياسات السداد. المستشفيات تتأثر بتكاليف العمالة وحجم المرضى ومزيج الدافعين. شركات الأجهزة الطبية ترتبط بحجم العمليات وميزانيات المستشفيات ودورات الابتكار. لذلك يجب فهم أي محرك صناعي هو الأهم داخل كل صندوق.'
      ]
    },
    {
      id: 'macro-and-policy-sensitivity',
      heading: 'الفائدة والتنظيم والدوران الدفاعي',
      paragraphs: [
        'صناديق الرعاية الصحية تبقى صناديق أسهم، ولذلك تتأثر بالسيولة والتقييم واتجاه السوق العام. الفائدة المرتفعة قد تضغط شركات النمو طويلة الأجل وشركات التقنية الحيوية الصغيرة، بينما قد تدعم تفضيل الشركات ذات التدفقات النقدية الحالية. الفائدة المنخفضة قد تساعد أجزاء الابتكار، لكنها قد تأتي أيضا مع تباطؤ اقتصادي يعيد الاهتمام بالقطاعات الدفاعية.',
        'التنظيم من أهم مخاطر القطاع. تسعير الدواء، سياسات التأمين، برامج الرعاية الحكومية، قرارات الموافقة، وقواعد السداد يمكن أن تغير توقعات الأرباح. التأثير لا يكون متساويا بين الشركات، فقد تتأثر شركات الأدوية بموضوع مختلف عن شركات الأجهزة أو المستشفيات أو التأمين. لذلك يظل توزيع المكونات أساسيا لفهم المخاطر.',
        'الدوران الدفاعي يحدث عندما ترتفع التقلبات أو تضعف توقعات النمو فيبحث المستثمرون عن قطاعات ذات طلب أكثر استقرارا. مشاركة صندوق الرعاية الصحية في هذا الدوران تعتمد على مكوناته. صندوق تهيمن عليه الأدوية الناضجة والرعاية المدارة قد يبدو أكثر دفاعية من صندوق فيه وزن أكبر للتقنية الحيوية عالية المخاطر.'
      ]
    },
    {
      id: 'comparison-framework',
      heading: 'إطار مقارنة صناديق الرعاية الصحية',
      paragraphs: [
        'المقارنة العملية تبدأ من الحيازات. يجب مراجعة أكبر عشرة مكونات ووزنها ونسبة الصندوق التي تمثلها. التركيز المرتفع قد يوفر سيولة ووضوحا، لكنه يعني أن الأداء قد يعتمد على عدد قليل من الشركات الكبرى. أما الصندوق الأوسع فقد يبدو أكثر تنوعا، لكن الوزن السوقي قد يبقي الشركات الكبرى مسيطرة.',
        'نسبة المصروفات والسيولة وتكاليف التداول عوامل مهمة أيضا. التكلفة المنخفضة تهم في الفترات الطويلة، بينما السبريد وحجم التداول يهمان عند دراسة جودة التنفيذ. حجم الأصول مفيد لكنه ليس العامل الوحيد، لأن سيولة المكونات الأساسية وقدرة الصندوق على العمل في فترات التقلب لا تقل أهمية.',
        'يجب تفسير التقلب التاريخي بحذر. انخفاض التقلب في فترة معينة لا يعني أن الصندوق سيبقى منخفض التقلب عندما تهيمن مخاطر السياسة أو التقنية الحيوية أو ضغط التقييم. الأفضل مقارنة التقلب مع SPY ومع صناديق القطاع ومع تاريخ الصندوق نفسه عبر أنظمة سوقية مختلفة.'
      ]
    },
    {
      id: 'when-healthcare-may-lag',
      heading: 'متى قد يتأخر القطاع عن السوق',
      paragraphs: [
        'قد تتأخر صناديق الرعاية الصحية عندما يفضل السوق التعافي الدوري أو التكنولوجيا عالية النمو أو القطاعات ذات تسارع أرباح أقوى. في بيئة مخاطرة مرتفعة قد تتجه التدفقات إلى أشباه الموصلات أو الصناعات أو الشركات الصغيرة إذا اعتقد المستثمرون أن النمو يتحسن. الاستقرار وحده قد لا يكون كافيا عندما يشتري السوق التسارع.',
        'قد يتأخر القطاع أيضا عندما تصبح مخاطر السياسة هي القصة الرئيسية. أخبار تسعير الدواء، مقترحات التأمين، تغييرات السداد، أو الضغط على هوامش شركات الرعاية المدارة يمكن أن تضغط التقييمات. حتى الصندوق المتنوع قد يتأثر إذا كانت أكبر مكوناته معرضة مباشرة لهذه القضايا.',
        'سيناريو آخر هو ضعف الابتكار. نتائج سريرية مخيبة، تباطؤ العمليات الطبية، صعوبة التمويل للشركات الصغيرة، أو تراجع الطلب على الأجهزة يمكن أن يخفض شهية المستثمرين لأجزاء من القطاع. لذلك يجب الفصل بين الطلب الصحي الأساسي والمحفزات الخاصة التي قد تضغط الأداء.'
      ]
    },
    {
      id: 'educational-framework',
      heading: 'استخدام الصندوق كإطار بحث تعليمي',
      paragraphs: [
        'يجب التعامل مع بحث صناديق الرعاية الصحية كتحليل تعرض وليس كتوصية شراء أو بيع. الأسئلة المفيدة هي: ما الصناعات التي يملكها الصندوق، ما درجة التركيز، ما التكلفة، ما السيولة، وما المخاطر المسيطرة؟ هذا الأسلوب يساعد القارئ على فهم علاقة هيكل الصندوق بميكانيكا القطاع دون تقديم نصيحة استثمارية.',
        'يمكن استخدام إطار منظم لمقارنة XLV وVHT وIYH عبر الحيازات، التركيز، نسبة المصروفات، السيولة، التقلب التاريخي، وتوزيع الصناعات. بعد ذلك يتم ربط النتائج بالسياق الكلي والتنظيمي مثل الفائدة، الدوران الدفاعي، تسعير الدواء، السداد، ودورات الابتكار.',
        'الخلاصة يجب أن تبقى تعليمية ومشروطة. صناديق الرعاية الصحية قد تمنح تعرضا لطلب أكثر استقرارا، لكنها تحمل مخاطر سوق الأسهم، التنظيم، التركيز، والابتكار. إطار البحث الجيد لا يفترض أن القطاع دفاعي دائما أو جذاب دائما، بل يشرح الآليات التي تجعله يتصرف بطرق مختلفة عبر أنظمة السوق.'
      ]
    }
  ];
}

function genericEnglishSections(topic) {
  const title = topic.title_en || 'this topic';
  return [
    'Research context', 'Exposure mechanics', 'Risk drivers', 'Comparison framework',
    'Macro sensitivity', 'Diversification and concentration', 'When the theme can lag',
    'Educational research workflow'
  ].map((heading, index) => ({
    id: heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    heading,
    paragraphs: [
      `${title} should be studied as an exposure framework rather than a trading instruction. The starting point is to identify what the asset, sector, or fund actually represents, which drivers influence it, and whether those drivers are cyclical, defensive, policy-sensitive, or innovation-sensitive. This prevents the research from becoming a shallow label exercise.`,
      `A useful comparison considers holdings, liquidity, fees, concentration, volatility, and how the exposure behaves under different market regimes. The same topic can look attractive or unattractive depending on whether the market is rewarding stability, growth, duration, risk appetite, or earnings resilience.`,
      `The educational conclusion should remain conditional. Researchers can use this section to frame questions, compare related assets, and understand risk transmission without treating the article as financial advice or a recommendation.`
    ]
  }));
}

function genericArabicSections(topic) {
  const title = topic.title_ar || topic.title_en || 'هذا الموضوع';
  return [
    'سياق البحث', 'آلية التعرض', 'محركات المخاطر', 'إطار المقارنة',
    'الحساسية الكلية', 'التنويع والتركيز', 'متى قد يتأخر الموضوع',
    'مسار بحث تعليمي'
  ].map((heading) => ({
    id: heading.replace(/\s+/g, '-'),
    heading,
    paragraphs: [
      `يجب دراسة ${title} كإطار تعرض تعليمي وليس كتوجيه تداول. البداية هي فهم ما يمثله الأصل أو القطاع أو الصندوق، وما العوامل التي تحركه، وهل هذه العوامل دورية أو دفاعية أو مرتبطة بالسياسة أو الابتكار.`,
      'المقارنة المفيدة تنظر إلى الحيازات، السيولة، الرسوم، التركيز، التقلب، وسلوك التعرض في أنظمة سوقية مختلفة. قد يتغير معنى الموضوع حسب ما إذا كان السوق يفضل الاستقرار أو النمو أو المخاطرة أو مرونة الأرباح.',
      'الخلاصة التعليمية يجب أن تبقى مشروطة وغير استشارية. يمكن للقارئ استخدام هذا الإطار لصياغة أسئلة أفضل، ومقارنة الأصول المرتبطة، وفهم انتقال المخاطر دون اعتبار المحتوى توصية مالية.'
    ]
  }));
}

function articleSchema(topic, ar) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: ar ? topic.title_ar : topic.title_en,
    description: ar ? topic.description_ar : topic.description_en,
    inLanguage: ar ? 'ar' : 'en',
    datePublished: topic.target_publish_date,
    dateModified: new Date().toISOString().slice(0, 10),
    author: { '@type': 'Organization', name: 'TradeAlphaAI' },
    publisher: { '@type': 'Organization', name: 'TradeAlphaAI' },
    mainEntityOfPage: `${SITE_URL}${ar ? '/ar' : ''}/insights/${topic.slug}.html`
  };
}

function breadcrumbSchema(topic, ar) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: ar ? 'المقالات' : 'Articles', item: `${SITE_URL}${ar ? '/ar' : ''}/insights/` },
      { '@type': 'ListItem', position: 3, name: ar ? topic.title_ar : topic.title_en, item: `${SITE_URL}${ar ? '/ar' : ''}/insights/${topic.slug}.html` }
    ]
  };
}

function faqSchema(topic, ar) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems(ar).map(([name, text]) => ({
      '@type': 'Question',
      name,
      acceptedAnswer: { '@type': 'Answer', text }
    }))
  };
}

function faqBlocks(ar) {
  return faqItems(ar).map(([q, a], index) => `        <details${index === 0 ? ' open' : ''}><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`).join('\n');
}

function faqItems(ar) {
  return ar
    ? [
        ['هل هذا المحتوى نصيحة مالية؟', 'لا. هذا المحتوى تعليمي فقط ولا يقدم توصية بشراء أو بيع أي ورقة مالية.'],
        ['كيف يمكن استخدام إطار المقارنة؟', 'يمكن استخدامه لفهم الحيازات والتركيز والسيولة والتكلفة والمخاطر قبل إجراء بحث مستقل.'],
        ['هل صناديق الرعاية الصحية دفاعية دائما؟', 'لا. قد تتصرف بشكل دفاعي في بعض الأنظمة، لكنها قد تتأخر عندما يفضل السوق النمو أو المخاطر الدورية.']
      ]
    : [
        ['Is this financial advice?', 'No. This article is educational only and does not recommend buying or selling any security.'],
        ['How should readers use the comparison framework?', 'Use it to study holdings, concentration, liquidity, cost, volatility, and risk drivers before doing independent research.'],
        ['Are healthcare ETFs always defensive?', 'No. They can behave defensively in some regimes, but they can lag when markets prefer high-growth or cyclical risk.']
      ];
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { renderLongFormEditorial };
