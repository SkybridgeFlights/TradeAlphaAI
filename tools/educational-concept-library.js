'use strict';

// Evergreen institutional education contracts. The factory keeps the schema
// consistent while each definition supplies its own causal thesis and lens.

const SECTION_HEADINGS = [
  ['Definition and scope', 'التعريف والنطاق'],
  ['Causal mechanism', 'الآلية السببية'],
  ['Institutional interpretation', 'القراءة المؤسسية'],
  ['Confirmation framework', 'إطار التأكيد'],
  ['Limits and false signals', 'الحدود والإشارات المضللة'],
  ['Regime and catalyst context', 'سياق النظام والمحفزات'],
];

const FORBIDDEN_FRAMING = [
  'buy, sell, entry, exit, target, or signal language',
  'directional prediction or guaranteed outcome',
  'listicle, beginner-guide, or get-rich framing',
  'unsupported current-market claims or fabricated metrics',
];

function paragraphs(def, index, locale) {
  const ar = locale === 'ar';
  const thesis = ar ? def.thesis_ar : def.thesis_en;
  const lens = ar ? def.lens_ar : def.lens_en;
  const evidence = ar
    ? def.fingerprints.map((item) => item.replace(/-/g, ' ')).join('، ')
    : def.fingerprints.map((item) => item.replace(/-/g, ' ')).join(', ');
  const bodies = ar ? [
    [`يُعرّف ${def.title_ar} بوصفه إطاراً لفهم بنية السوق، لا حكماً على حركة سعرية منفردة.`, thesis],
    [lens, 'تنتقل الآلية عبر التمويل والتسعير والمشاركة، مع اختلاف وزن كل قناة باختلاف النظام السائد.'],
    [`في القراءة المؤسسية يفصل المكتب بين المشاهدة والسبب، ثم يختبر تحديداً ${evidence} قبل اعتماد التفسير.`, `ومن ثم يُستخدم هذا الاختبار لتحديد ما إذا كانت ${lens} تمثل آلية مستمرة أم أثراً مؤقتاً مرتبطاً ببنية الأداة.`],
    ['يتأكد الإطار عندما تتحرك قنوات الأدلة بصورة مستقلة ومتسقة مع الأطروحة الأساسية عبر العوائد والدولار والأسهم والتذبذب.', `ولأن التأكيد مؤسسي، يتمثل السؤال الخاص بمفهوم ${def.title_ar} في مدى صمود القنوات بعد المحفز.`],
    [`ومع أن الحركة قد تبدو متسقة، تظهر قراءة مضللة لمفهوم ${def.title_ar} عندما لا تُفحص ملكية التدفق أو الأفق الزمني.`, `ومع ذلك يقارن المكتب النتيجة مع ${lens} قبل استبعاد إعادة الموازنة أو نقص السيولة أو اختلاف تصميم الأداة.`],
    ['يتغير وزن المفهوم مع نظام السيولة والتقلب وقرب المحفز، لذلك تبقى الأطروحة مشروطة بالسياق.', 'ومن ثم يعيد المكتب تقييم قنوات الأدلة بعد الحدث لتمييز إعادة التسعير المستمرة عن الاستجابة التي لم تحافظ على تأكيدها.'],
  ] : [
    [`${def.title_en} is an institutional framework for reading market structure, not a conclusion drawn from one price move.`, thesis],
    [lens, 'The mechanism transmits through funding, valuation, and participation, with each channel carrying different weight across regimes.'],
    [`In the institutional reading, the desk separates observation from cause and tests ${evidence} before adopting the interpretation.`, `Therefore that test determines whether ${lens.toLowerCase()} describes a persistent mechanism or a temporary effect created by instrument structure.`],
    ['While the framework needs independent evidence across rates, the dollar, equities, and volatility, coherence with the central thesis remains the decisive test.', `Because confirmation is institutional, the question for ${def.title_en.toLowerCase()} is whether the evidence channels survive the catalyst.`],
    [`Although the movement may appear coherent, a false reading of ${def.title_en.toLowerCase()} arises when flow ownership or horizon is not tested.`, `However, the desk compares the outcome with ${lens.toLowerCase()} before excluding rebalancing, thin liquidity, or instrument-design effects.`],
    ['The weight assigned to the concept changes with liquidity, volatility, and catalyst proximity, so the thesis remains conditional.', 'Therefore, after the event, the desk reassesses the evidence channels to distinguish persistent repricing from a response that failed to retain confirmation.'],
  ];
  return bodies[index].map((paragraph) => {
    if (paragraph.length >= (ar ? 45 : 60)) return paragraph;
    return `${paragraph} ${ar
      ? 'وتبقى القراءة مشروطة بجودة الأدلة واستمرارها عبر السياق المؤسسي.'
      : 'The reading remains conditional on evidence quality and persistence across the institutional context.'}`;
  });
}

function buildConcept(def) {
  const sections_en = SECTION_HEADINGS.map(([heading], index) => ({
    heading,
    paragraphs: paragraphs(def, index, 'en'),
  }));
  const sections_ar = SECTION_HEADINGS.map(([, heading], index) => ({
    heading,
    paragraphs: paragraphs(def, index, 'ar'),
  }));
  return {
    id: def.id,
    slug: def.id,
    category: def.category,
    title_en: def.title_en,
    title_ar: def.title_ar,
    thesis_en: def.thesis_en,
    thesis_ar: def.thesis_ar,
    sections_en,
    sections_ar,
    sections: sections_en.map((section, index) => ({
      id: `concept-${index + 1}`,
      heading_en: section.heading,
      heading_ar: sections_ar[index].heading,
      paragraphs_en: section.paragraphs,
      paragraphs_ar: sections_ar[index].paragraphs,
    })),
    institutional_examples: {
      en: [`A macro desk would use ${def.title_en.toLowerCase()} to test ${def.lens_en.toLowerCase()} without converting the observation into a directional call.`],
      ar: [`يستخدم المكتب الكلي مفهوم «${def.title_ar}» لاختبار ${def.lens_ar} من دون تحويل الملاحظة إلى دعوة اتجاهية.`],
    },
    internal_links: ['/articles/', '/market-outlook/', '/briefs/'],
    visual_intent: {
      type: def.visual,
      purpose_en: `Explain the causal structure of ${def.title_en.toLowerCase()} without prices or fabricated metrics.`,
      purpose_ar: `شرح البنية السببية لمفهوم «${def.title_ar}» من دون أسعار أو مقاييس مصطنعة.`,
      metric_free: true,
    },
    forbidden_framing: [...FORBIDDEN_FRAMING],
    related_concepts: def.related,
    fingerprints: [def.id.replace(/-/g, ' '), ...def.fingerprints],
    fingerprint: [def.id.replace(/-/g, ' '), ...def.fingerprints],
  };
}

const DEFINITIONS = [
  {
    id: 'liquidity-tightening', category: 'macro-liquidity',
    title_en: 'Liquidity tightening and market transmission', title_ar: 'تشدد السيولة وانتقاله إلى الأسواق',
    thesis_en: 'Liquidity tightening reduces marginal risk-bearing capacity before every asset shows the same response.',
    thesis_ar: 'يخفض تشدد السيولة القدرة الهامشية على تحمّل المخاطر قبل أن تظهر الاستجابة نفسها في جميع الأصول.',
    lens_en: 'Funding cost, collateral availability, dealer capacity, and market depth must be read together.',
    lens_ar: 'يجب قراءة كلفة التمويل وتوافر الضمانات وقدرة الوسطاء وعمق السوق معاً.',
    visual: 'liquidity-transmission-map', related: ['liquidity-absorption', 'dollar-global-liquidity'], fingerprints: ['funding restraint', 'market depth'],
  },
  {
    id: 'liquidity-absorption', category: 'macro-liquidity',
    title_en: 'Liquidity absorption and balance-sheet capacity', title_ar: 'امتصاص السيولة وقدرة الميزانيات',
    thesis_en: 'Issuance, collateral demand, and defensive cash needs can absorb liquidity without an obvious market shock.',
    thesis_ar: 'قد تمتص الإصدارات والضمانات والطلب الدفاعي على النقد السيولة من دون صدمة سوقية ظاهرة.',
    lens_en: 'The relevant question is who can warehouse new supply and how much marginal balance-sheet capacity remains.',
    lens_ar: 'السؤال المحوري هو من يستطيع حمل المعروض الجديد ومقدار ما تبقى من قدرة هامشية في الميزانيات.',
    visual: 'balance-sheet-flow', related: ['liquidity-tightening', 'participation-quality'], fingerprints: ['issuance absorption', 'dealer capacity'],
  },
  {
    id: 'risk-on-risk-off-regimes', category: 'macro-liquidity',
    title_en: 'Risk-on and risk-off as coherent regimes', title_ar: 'الإقبال والعزوف عن المخاطر كنظامين متماسكين',
    thesis_en: 'A risk regime is credible only when funding, breadth, volatility, and defensive demand form a coherent pattern.',
    thesis_ar: 'لا يكتسب نظام المخاطرة صدقيته إلا عندما تتسق شروط التمويل والاتساع والتقلب والطلب الدفاعي.',
    lens_en: 'One equity index cannot define a cross-asset risk regime.',
    lens_ar: 'لا يستطيع مؤشر أسهم واحد تحديد نظام مخاطر عابر للأصول.',
    visual: 'regime-matrix', related: ['defensive-rotation', 'regime-context'], fingerprints: ['risk regime', 'defensive demand'],
  },
  {
    id: 'defensive-rotation', category: 'macro-liquidity',
    title_en: 'Defensive rotation without broad liquidation', title_ar: 'الدوران الدفاعي من دون تصفية شاملة',
    thesis_en: 'Defensive rotation can reveal declining participation quality before broad risk aversion appears.',
    thesis_ar: 'قد يكشف الدوران الدفاعي تراجع جودة المشاركة قبل ظهور عزوف واسع عن المخاطر.',
    lens_en: 'Sector leadership, credit quality, duration demand, and breadth distinguish caution from liquidation.',
    lens_ar: 'تميّز قيادة القطاعات وجودة الائتمان والطلب على المدة والاتساع بين الحذر والتصفية.',
    visual: 'rotation-map', related: ['risk-on-risk-off-regimes', 'participation-quality'], fingerprints: ['defensive leadership', 'cyclical participation'],
  },
  {
    id: 'yield-curve-pressure', category: 'macro-liquidity',
    title_en: 'Yield-curve pressure and financial conditions', title_ar: 'ضغوط منحنى العائد والأوضاع المالية',
    thesis_en: 'Curve pressure matters through the source and location of the move, not a mechanical steepening or flattening label.',
    thesis_ar: 'تنبع أهمية ضغط المنحنى من مصدر الحركة وموضعها، لا من تسمية آلية للتحدب أو التسطح.',
    lens_en: 'Front-end policy pricing, long-end term premium, and issuance supply transmit differently.',
    lens_ar: 'ينتقل تسعير السياسة في الآجال القصيرة وعلاوة الأجل والمعروض في الآجال الطويلة بطرق مختلفة.',
    visual: 'curve-transmission', related: ['central-bank-reaction-function', 'tlt-duration-sensitivity'], fingerprints: ['curve shape', 'term premium'],
  },
  {
    id: 'real-yields-gold', category: 'macro-liquidity',
    title_en: 'Real yields and gold through opportunity cost', title_ar: 'العوائد الحقيقية والذهب عبر كلفة الفرصة',
    thesis_en: 'Real yields influence gold through opportunity cost, while currency, reserve, and stress demand can offset that channel.',
    thesis_ar: 'تؤثر العوائد الحقيقية في الذهب عبر كلفة الفرصة، فيما قد تعاكسها قنوات العملة والاحتياطيات والتحوط.',
    lens_en: 'The rate channel must be separated from official demand, dollar effects, and systemic hedging.',
    lens_ar: 'يجب فصل قناة العائد عن الطلب الرسمي وأثر الدولار والتحوط من المخاطر النظامية.',
    visual: 'gold-channel-map', related: ['dxy-gold-relationship', 'inflation-surprise-mechanics'], fingerprints: ['gold opportunity cost', 'inflation adjusted yield'],
  },
  {
    id: 'dollar-global-liquidity', category: 'macro-liquidity',
    title_en: 'Dollar strength and global liquidity', title_ar: 'قوة الدولار والسيولة العالمية',
    thesis_en: 'Dollar strength can tighten global conditions through liabilities, trade finance, and collateral networks.',
    thesis_ar: 'قد تشدد قوة الدولار الأوضاع العالمية عبر الالتزامات وتمويل التجارة وشبكات الضمانات.',
    lens_en: 'Currency breadth, funding spreads, external credit, and commodity participation identify the dominant channel.',
    lens_ar: 'تحدد قوة العملة الواسعة وفروق التمويل والائتمان الخارجي ومشاركة السلع القناة المهيمنة.',
    visual: 'global-funding-map', related: ['liquidity-tightening', 'dxy-gold-relationship'], fingerprints: ['dollar funding', 'cross border liquidity'],
  },
  {
    id: 'inflation-surprise-mechanics', category: 'macro-liquidity',
    title_en: 'Inflation surprise mechanics', title_ar: 'آلية مفاجآت التضخم',
    thesis_en: 'Inflation data matter through deviation from priced expectations and the resulting policy-path repricing.',
    thesis_ar: 'تهم بيانات التضخم عبر انحرافها عن التوقعات المسعّرة وما ينتج منه من إعادة تسعير لمسار السياسة.',
    lens_en: 'Headline, core, services, revisions, and market expectations must not be collapsed into one number.',
    lens_ar: 'لا يجوز اختزال التضخم العام والأساسي والخدمات والمراجعات وتوقعات السوق في رقم واحد.',
    visual: 'surprise-transmission', related: ['why-forecasts-matter', 'central-bank-reaction-function'], fingerprints: ['priced expectations', 'inflation composition'],
  },
  {
    id: 'central-bank-reaction-function', category: 'macro-liquidity',
    title_en: 'The central-bank reaction function', title_ar: 'دالة استجابة البنك المركزي',
    thesis_en: 'The reaction function links verified evidence to conditional policy choices rather than fixed promises.',
    thesis_ar: 'تربط دالة الاستجابة الأدلة الموثقة بخيارات سياسة مشروطة، لا بوعود ثابتة.',
    lens_en: 'Inflation, employment, financial stability, transmission, and communication thresholds interact.',
    lens_ar: 'تتفاعل عتبات التضخم والتوظيف والاستقرار المالي وانتقال السياسة والاتصال.',
    visual: 'policy-decision-map', related: ['inflation-surprise-mechanics', 'catalyst-windows'], fingerprints: ['policy threshold', 'data dependence'],
  },
  {
    id: 'breadth-deterioration', category: 'market-structure',
    title_en: 'Breadth deterioration beneath resilient indices', title_ar: 'تدهور الاتساع تحت مؤشرات متماسكة',
    thesis_en: 'Breadth deterioration shows that fewer securities are carrying headline index strength.',
    thesis_ar: 'يكشف تدهور الاتساع أن عدداً أقل من الأوراق يحمل القوة الظاهرة للمؤشر.',
    lens_en: 'Equal-weight performance, advance-decline behavior, sectors, and persistence reveal participation.',
    lens_ar: 'يكشف الأداء المتساوي الأوزان وخطوط الصعود والهبوط والقطاعات والاستمرار حقيقة المشاركة.',
    visual: 'breadth-index-diagram', related: ['narrow-leadership', 'participation-quality'], fingerprints: ['equal weight participation', 'advance decline'],
  },
  {
    id: 'narrow-leadership', category: 'market-structure',
    title_en: 'Narrow leadership and index resilience', title_ar: 'ضيق القيادة وتماسك المؤشرات',
    thesis_en: 'Narrow leadership sustains an index while increasing dependence on a compact set of earnings and liquidity assumptions.',
    thesis_ar: 'تحافظ القيادة الضيقة على المؤشر بينما تزيد اعتماده على مجموعة محدودة من افتراضات الأرباح والسيولة.',
    lens_en: 'Contribution, earnings breadth, factor exposure, and alternative leadership determine resilience quality.',
    lens_ar: 'تحدد مساهمة المكونات واتساع الأرباح والتعرض للعوامل وتوافر قيادة بديلة جودة التماسك.',
    visual: 'leadership-contribution-map', related: ['breadth-deterioration', 'concentration-risk'], fingerprints: ['index contribution', 'leadership concentration'],
  },
  {
    id: 'volatility-compression', category: 'market-structure',
    title_en: 'Volatility compression and hidden capacity', title_ar: 'انضغاط التقلب والقدرة الكامنة',
    thesis_en: 'Persistent volatility compression can support leverage and conceal unresolved structural tension.',
    thesis_ar: 'قد يدعم استمرار انضغاط التقلب الرافعة ويحجب توترات هيكلية غير محسومة.',
    lens_en: 'Realized ranges, option structure, positioning, breadth, and liquidity distinguish calm from fragility.',
    lens_ar: 'تميّز نطاقات الحركة وهيكل الخيارات والتمركز والاتساع والسيولة بين الهدوء والهشاشة.',
    visual: 'compression-lifecycle', related: ['volatility-expansion', 'structural-instability'], fingerprints: ['compressed volatility', 'risk budget'],
  },
  {
    id: 'volatility-expansion', category: 'market-structure',
    title_en: 'Volatility expansion and uncertainty repricing', title_ar: 'اتساع التقلب وإعادة تسعير عدم اليقين',
    thesis_en: 'Volatility expansion reflects changing uncertainty, liquidity, or positioning rather than a directional forecast.',
    thesis_ar: 'يعكس اتساع التقلب تغير عدم اليقين أو السيولة أو التمركز، لا توقعاً لاتجاه السوق.',
    lens_en: 'Realized movement, implied protection, correlation, breadth, and depth identify the type of expansion.',
    lens_ar: 'تحدد الحركة المحققة والحماية الضمنية والارتباط والاتساع والعمق نوع اتساع التقلب.',
    visual: 'volatility-state-map', related: ['volatility-compression', 'vix-equity-breadth'], fingerprints: ['realized range', 'implied protection'],
  },
  {
    id: 'trend-persistence', category: 'market-structure',
    title_en: 'Trend persistence after the first catalyst', title_ar: 'استمرار الاتجاه بعد المحفز الأول',
    thesis_en: 'Trends persist through gradual information diffusion, portfolio adjustment, and repeated confirmation.',
    thesis_ar: 'تستمر الاتجاهات عبر تدرج انتقال المعلومات وتعديل المحافظ وتكرار التأكيد.',
    lens_en: 'Breadth, flow quality, pullback absorption, and cross-asset support separate durable transmission from mechanics.',
    lens_ar: 'يفصل الاتساع وجودة التدفق واستيعاب التراجعات والدعم عبر الأصول بين الانتقال المستدام والحركة الآلية.',
    visual: 'persistence-chain', related: ['momentum-deterioration', 'news-vs-reaction'], fingerprints: ['information diffusion', 'systematic flows'],
  },
  {
    id: 'momentum-deterioration', category: 'market-structure',
    title_en: 'Momentum deterioration within an intact trend', title_ar: 'تدهور الزخم داخل اتجاه قائم',
    thesis_en: 'Momentum deterioration describes weaker participation and follow-through without forecasting reversal.',
    thesis_ar: 'يصف تدهور الزخم ضعف المشاركة وامتداد الحركة من دون توقع انعكاس.',
    lens_en: 'Price progress, breadth, leadership, catalyst response, and retention reveal momentum quality.',
    lens_ar: 'يكشف تقدم السعر والاتساع والقيادة والاستجابة للمحفز والاحتفاظ بالحركة جودة الزخم.',
    visual: 'momentum-quality-map', related: ['trend-persistence', 'why-confirmation-matters'], fingerprints: ['weaker follow through', 'price progress'],
  },
  {
    id: 'concentration-risk', category: 'market-structure',
    title_en: 'Concentration risk as shared dependence', title_ar: 'مخاطر التركّز بوصفها اعتماداً مشتركاً',
    thesis_en: 'Concentration risk rises when outcomes depend on a small group of securities, factors, owners, or narratives.',
    thesis_ar: 'ترتفع مخاطر التركّز عندما تعتمد النتائج على مجموعة محدودة من الأوراق أو العوامل أو المالكين أو الروايات.',
    lens_en: 'Weight, ownership overlap, factor covariance, earnings dependence, and liquidity are distinct dimensions.',
    lens_ar: 'يمثل الوزن وتداخل الملكية وتغاير العوامل والاعتماد على الأرباح والسيولة أبعاداً مستقلة.',
    visual: 'dependency-network', related: ['narrow-leadership', 'spy-qqq-leadership'], fingerprints: ['ownership overlap', 'shared factor'],
  },
  {
    id: 'participation-quality', category: 'market-structure',
    title_en: 'Participation quality beyond advancing counts', title_ar: 'جودة المشاركة أبعد من أعداد الصاعدين',
    thesis_en: 'Participation quality combines breadth, persistence, liquidity, and diversity of underlying drivers.',
    thesis_ar: 'تجمع جودة المشاركة بين الاتساع والاستمرار والسيولة وتنوع المحركات الأساسية.',
    lens_en: 'A superficially broad move can remain fragile when depth is thin or all assets share one factor.',
    lens_ar: 'قد تبقى الحركة الواسعة ظاهرياً هشة عندما يضعف العمق أو تشترك الأصول في عامل واحد.',
    visual: 'participation-quality-matrix', related: ['breadth-deterioration', 'structural-instability'], fingerprints: ['driver diversity', 'market participation'],
  },
  {
    id: 'structural-instability', category: 'market-structure',
    title_en: 'Structural instability beneath orderly prices', title_ar: 'عدم الاستقرار الهيكلي تحت أسعار منضبطة',
    thesis_en: 'Price calm can depend on narrowing liquidity, concentrated leadership, and unresolved cross-asset contradictions.',
    thesis_ar: 'قد يعتمد هدوء الأسعار على سيولة أضيق وقيادة مركزة وتناقضات غير محسومة بين الأصول.',
    lens_en: 'Surface calm must be tested against participation, positioning, funding, volatility, and coherence.',
    lens_ar: 'يجب اختبار هدوء السطح في ضوء المشاركة والتمركز والتمويل والتقلب والتماسك.',
    visual: 'stability-layer-map', related: ['volatility-compression', 'cross-asset-confirmation'], fingerprints: ['fragile equilibrium', 'internal coherence'],
  },
  {
    id: 'dxy-gold-relationship', category: 'cross-asset',
    title_en: 'The dollar-gold relationship beyond correlation', title_ar: 'علاقة الدولار بالذهب أبعد من الارتباط',
    thesis_en: 'Dollar and gold behavior reflects competing currency, real-yield, reserve, and stress channels.',
    thesis_ar: 'يعكس سلوك الدولار والذهب تنافس قنوات العملة والعائد الحقيقي والاحتياطيات والضغط.',
    lens_en: 'Correlation alone cannot identify which channel dominates or whether the relationship changed.',
    lens_ar: 'لا يستطيع الارتباط وحده تحديد القناة المهيمنة أو إثبات تغير العلاقة.',
    visual: 'dxy-gold-channel-map', related: ['real-yields-gold', 'dollar-global-liquidity'], fingerprints: ['dollar gold', 'gold correlation'],
  },
  {
    id: 'yields-growth-equities', category: 'cross-asset',
    title_en: 'Yields and growth-equity duration', title_ar: 'العوائد ومدة أسهم النمو',
    thesis_en: 'Yields affect growth equities through discounting, financing, earnings expectations, and the reason rates moved.',
    thesis_ar: 'تؤثر العوائد في أسهم النمو عبر الخصم والتمويل وتوقعات الأرباح وسبب تحرك الفائدة.',
    lens_en: 'Real yields, term premium, growth expectations, and earnings revisions must be decomposed.',
    lens_ar: 'يجب تفكيك العوائد الحقيقية وعلاوة الأجل وتوقعات النمو ومراجعات الأرباح.',
    visual: 'duration-transmission', related: ['yield-curve-pressure', 'spy-qqq-leadership'], fingerprints: ['equity duration', 'discount rate'],
  },
  {
    id: 'vix-equity-breadth', category: 'cross-asset',
    title_en: 'VIX versus equity breadth', title_ar: 'مؤشر التقلب في مقابل اتساع الأسهم',
    thesis_en: 'Protection pricing and constituent participation describe different dimensions of market health.',
    thesis_ar: 'يصف تسعير الحماية ومشاركة المكونات بُعدين مختلفين لصحة السوق.',
    lens_en: 'Low implied volatility is more credible when breadth, depth, and realized behavior confirm it.',
    lens_ar: 'يكون انخفاض التقلب الضمني أكثر صدقية عندما يؤكده الاتساع والعمق والسلوك المحقق.',
    visual: 'volatility-breadth-matrix', related: ['breadth-deterioration', 'volatility-compression'], fingerprints: ['implied volatility breadth', 'protection pricing'],
  },
  {
    id: 'oil-inflation-pressure', category: 'cross-asset',
    title_en: 'Oil and inflation-pressure transmission', title_ar: 'النفط وانتقال ضغوط التضخم',
    thesis_en: 'Oil reaches inflation through direct energy costs, production chains, expectations, and policy interpretation.',
    thesis_ar: 'ينتقل أثر النفط إلى التضخم عبر كلفة الطاقة وسلاسل الإنتاج والتوقعات وتفسير السياسة.',
    lens_en: 'Supply, demand, inventories, currency, refined products, and persistence determine the macro effect.',
    lens_ar: 'يحدد المعروض والطلب والمخزونات والعملة والمنتجات المكررة والاستمرار الأثر الكلي.',
    visual: 'oil-inflation-map', related: ['inflation-surprise-mechanics', 'central-bank-reaction-function'], fingerprints: ['energy pass through', 'oil transmission'],
  },
  {
    id: 'tlt-duration-sensitivity', category: 'cross-asset',
    title_en: 'Treasury duration sensitivity beyond the ticker', title_ar: 'حساسية مدة سندات الخزانة أبعد من رمز التداول',
    thesis_en: 'Long-duration Treasury exposure responds to yield changes, curve shape, convexity, and supply; the instrument is only a proxy.',
    thesis_ar: 'يتأثر التعرض طويل المدة بتغير العوائد وشكل المنحنى والتحدب والمعروض؛ فالأداة ليست سوى وكيل.',
    lens_en: 'Maturity, duration, convexity, distributions, and curve location must remain distinct.',
    lens_ar: 'يجب إبقاء الاستحقاق والمدة والتحدب والتوزيعات وموضع المنحنى مفاهيم منفصلة.',
    visual: 'duration-curve-map', related: ['yield-curve-pressure', 'proxy-not-consensus'], fingerprints: ['treasury duration', 'bond convexity'],
  },
  {
    id: 'spy-qqq-leadership', category: 'cross-asset',
    title_en: 'SPY versus QQQ as a leadership comparison', title_ar: 'SPY في مقابل QQQ كقراءة للقيادة',
    thesis_en: 'Relative index performance can reveal leadership and duration exposure but cannot define the regime alone.',
    thesis_ar: 'قد يكشف الأداء النسبي للمؤشرين القيادة والتعرض للمدة، لكنه لا يحدد النظام بمفرده.',
    lens_en: 'Sector weights, concentration, equal-weight breadth, rates, and earnings explain the comparison.',
    lens_ar: 'تفسر الأوزان القطاعية والتركّز والاتساع المتساوي والعوائد والأرباح هذه المقارنة.',
    visual: 'leadership-decomposition', related: ['narrow-leadership', 'yields-growth-equities'], fingerprints: ['growth leadership', 'index composition'],
  },
  {
    id: 'news-vs-reaction', category: 'research-process',
    title_en: 'News versus the market reaction', title_ar: 'الخبر في مقابل استجابة السوق',
    thesis_en: 'News supplies information, while the reaction reveals prior expectations, positioning, liquidity, and the dominant channel.',
    thesis_ar: 'يوفر الخبر المعلومة، بينما تكشف الاستجابة التوقعات السابقة والتمركز والسيولة والقناة المهيمنة.',
    lens_en: 'Direction, breadth, persistence, and cross-asset quality matter more than the first tick.',
    lens_ar: 'يهم اتجاه الاستجابة واتساعها واستمرارها وجودتها عبر الأصول أكثر من الحركة الأولى.',
    visual: 'reaction-framework', related: ['why-confirmation-matters', 'catalyst-windows'], fingerprints: ['market reaction', 'prior expectations'],
  },
  {
    id: 'why-confirmation-matters', category: 'research-process',
    title_en: 'Why confirmation matters', title_ar: 'لماذا يهم التأكيد',
    thesis_en: 'Confirmation reduces dependence on one noisy observation by requiring independent evidence for the same causal reading.',
    thesis_ar: 'يقلل التأكيد الاعتماد على ملاحظة مشوشة واحدة عبر طلب أدلة مستقلة للقراءة السببية نفسها.',
    lens_en: 'Independent mechanisms add evidence; correlated duplicates do not.',
    lens_ar: 'تضيف الآليات المستقلة دليلاً، أما التكرارات المترابطة فلا تفعل.',
    visual: 'confirmation-matrix', related: ['cross-asset-confirmation', 'news-vs-reaction'], fingerprints: ['independent evidence', 'causal confirmation'],
  },
  {
    id: 'why-forecasts-matter', category: 'research-process',
    title_en: 'Why forecasts matter as baselines', title_ar: 'لماذا تهم التوقعات كخط أساس',
    thesis_en: 'Forecasts define expectation baselines for interpreting surprises; they are conditional estimates, not promises.',
    thesis_ar: 'تحدد التوقعات خط أساس لتفسير المفاجآت؛ فهي تقديرات مشروطة وليست وعوداً.',
    lens_en: 'Distributions, assumptions, revisions, and market pricing matter more than one consensus point.',
    lens_ar: 'يهم توزيع التقديرات وافتراضاتها ومراجعاتها وتسعير السوق أكثر من رقم إجماع واحد.',
    visual: 'expectation-distribution', related: ['inflation-surprise-mechanics', 'proxy-not-consensus'], fingerprints: ['expectation baseline', 'forecast distribution'],
  },
  {
    id: 'proxy-not-consensus', category: 'research-process',
    title_en: 'Why a proxy is not consensus', title_ar: 'لماذا لا يساوي المؤشر البديل إجماع التوقعات',
    thesis_en: 'A proxy measures a related process, while consensus aggregates explicit estimates; substituting them creates false precision.',
    thesis_ar: 'يقيس المؤشر البديل عملية مرتبطة، بينما يجمع الإجماع تقديرات صريحة؛ واستبدالهما يولد دقة زائفة.',
    lens_en: 'Causal rationale, horizon, omitted components, revisions, and structural stability determine proxy quality.',
    lens_ar: 'يحدد المنطق السببي والأفق والمكونات المهملة والمراجعات والاستقرار الهيكلي جودة المؤشر البديل.',
    visual: 'evidence-taxonomy', related: ['why-forecasts-matter', 'why-confirmation-matters'], fingerprints: ['indirect indicator', 'forecast consensus'],
  },
  {
    id: 'regime-context', category: 'research-process',
    title_en: 'How to read regime context', title_ar: 'كيف تُقرأ سياقات الأنظمة',
    thesis_en: 'The same observation can carry different meaning across liquidity, inflation, growth, volatility, and positioning regimes.',
    thesis_ar: 'قد تحمل الملاحظة نفسها معنى مختلفاً باختلاف أنظمة السيولة والتضخم والنمو والتقلب والتمركز.',
    lens_en: 'Drivers, financial conditions, market structure, and behavioral constraints define the active context.',
    lens_ar: 'تحدد المحركات والأوضاع المالية وبنية السوق والقيود السلوكية السياق النشط.',
    visual: 'regime-context-map', related: ['risk-on-risk-off-regimes', 'cross-asset-confirmation'], fingerprints: ['market regime', 'asset sensitivity'],
  },
  {
    id: 'catalyst-windows', category: 'research-process',
    title_en: 'How catalyst windows organize observation', title_ar: 'كيف تنظّم نوافذ المحفزات عملية المراقبة',
    thesis_en: 'A catalyst window structures expectations, pre-event positioning, immediate reaction, confirmation, and post-event digestion.',
    thesis_ar: 'تنظم نافذة المحفز التوقعات والتمركز السابق والاستجابة الفورية والتأكيد والاستيعاب اللاحق.',
    lens_en: 'Liquidity and hedging distortions around events must be separated from persistent repricing.',
    lens_ar: 'يجب فصل تشوهات السيولة والتحوط حول الأحداث عن إعادة التسعير المستمرة.',
    visual: 'catalyst-lifecycle', related: ['news-vs-reaction', 'why-forecasts-matter'], fingerprints: ['post event confirmation', 'event positioning'],
  },
  {
    id: 'cross-asset-confirmation', category: 'cross-asset',
    title_en: 'Cross-asset confirmation of macro causality', title_ar: 'التأكيد عبر الأصول للسببية الكلية',
    thesis_en: 'Cross-asset confirmation tests whether independently priced markets reflect the same proposed macro mechanism.',
    thesis_ar: 'يختبر التأكيد عبر الأصول ما إذا كانت أسواق مسعّرة بصورة مستقلة تعكس الآلية الكلية المقترحة نفسها.',
    lens_en: 'Primary, secondary, lagging, and contradictory markets must be mapped before evidence is counted.',
    lens_ar: 'يجب تحديد الأسواق الأولية والثانوية والمتأخرة والمتعارضة قبل احتساب الأدلة.',
    visual: 'confirmation-network', related: ['why-confirmation-matters', 'structural-instability'], fingerprints: ['macro causality', 'asset coherence'],
  },
];

const ACTIVE_CONCEPT_IDS = [
  'liquidity-tightening',
  'liquidity-absorption',
  'defensive-rotation',
  'yield-curve-pressure',
  'real-yields-gold',
  'dollar-global-liquidity',
  'inflation-surprise-mechanics',
  'central-bank-reaction-function',
  'breadth-deterioration',
  'narrow-leadership',
  'volatility-compression',
  'volatility-expansion',
  'concentration-risk',
  'structural-instability',
  'dxy-gold-relationship',
  'yields-growth-equities',
  'oil-inflation-pressure',
  'tlt-duration-sensitivity',
  'cross-asset-confirmation',
  'news-vs-reaction',
  'why-confirmation-matters',
  'why-forecasts-matter',
  'proxy-not-consensus',
  'catalyst-windows',
];

const definitionsById = new Map(DEFINITIONS.map((definition) => [definition.id, definition]));
const CONCEPT_FAMILIES = DEFINITIONS.map(buildConcept);
const CONCEPT_LIBRARY = Object.fromEntries(CONCEPT_FAMILIES.map((concept) => [concept.slug, concept]));

module.exports = { CONCEPT_FAMILIES, CONCEPT_LIBRARY };
