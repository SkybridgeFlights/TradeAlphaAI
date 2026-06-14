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

// Phase 121 — deep concept narrative. Concepts carrying a `depth` object are
// rendered from concept-SPECIFIC source material (no generic factory tails) as
// an institutional long-form essay. Each depth key supplies two substantive
// bilingual paragraphs; the order below is the narrative arc.
const DEPTH_HEADINGS = [
  ['context', 'Definition and institutional context', 'التعريف والسياق المؤسسي'],
  ['why', 'Why it matters', 'لماذا يهمّ'],
  ['desk', 'How desks interpret it', 'كيف تقرؤه المكاتب'],
  ['transmission', 'The transmission mechanism', 'آلية الانتقال'],
  ['connection', 'Cross-asset and regime connection', 'الصلة عبر الأصول والنظام'],
  ['misread', 'The common misread', 'القراءة الخاطئة الشائعة'],
  ['framework', 'A practical reading framework', 'إطار قراءة عملي'],
  ['visual', 'Reading the visual', 'قراءة الشكل البصري'],
];

function depthSections(def, locale) {
  const ar = locale === 'ar';
  return DEPTH_HEADINGS.map(([key, en, arH]) => ({
    heading: ar ? arH : en,
    paragraphs: (def.depth[key] && def.depth[key][locale]) || [],
  }));
}

function buildConcept(def) {
  const deep = def.depth && DEPTH_HEADINGS.every(([k]) => def.depth[k] && Array.isArray(def.depth[k].en) && Array.isArray(def.depth[k].ar));
  const sections_en = deep ? depthSections(def, 'en') : SECTION_HEADINGS.map(([heading], index) => ({
    heading,
    paragraphs: paragraphs(def, index, 'en'),
  }));
  const sections_ar = deep ? depthSections(def, 'ar') : SECTION_HEADINGS.map(([, heading], index) => ({
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
    is_deep: deep,
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
    depth: {
      context: { en: [
        'Liquidity tightening describes a contraction in the system\'s marginal capacity to fund, warehouse, and intermediate risk. It is distinct from a fall in prices: prices are an outcome, while tightening is a change in the conditions under which positions can be financed and moved. A desk treats it as a structural shift in the cost and availability of balance sheet rather than as a directional event.',
        'The institutional context is that most risk-taking is leveraged or financed in some form, so the price of funding and the willingness of intermediaries to extend it set the boundary on how much risk the system can hold. When that boundary contracts, the same fundamental news lands on a market with less room to absorb it, which is why tightening is read as an environment rather than a signal.',
      ], ar: [
        'يصف تشدد السيولة انكماشاً في القدرة الهامشية للنظام على تمويل المخاطر وحملها والوساطة فيها. وهو يختلف عن هبوط الأسعار: فالأسعار نتيجة، بينما التشدد تغيّر في الظروف التي يمكن في ظلها تمويل المراكز وتحريكها. ويعدّه المكتب تحولاً هيكلياً في كلفة الميزانية وتوافرها لا حدثاً اتجاهياً.',
        'والسياق المؤسسي أن معظم تحمّل المخاطر مموَّل أو برافعة بشكل ما، لذا تحدد كلفة التمويل واستعداد الوسطاء لتقديمه سقفَ ما يستطيع النظام حمله من مخاطر. وحين ينكمش ذلك السقف، يقع الخبر الأساسي نفسه على سوق أقل قدرة على امتصاصه، ولهذا يُقرأ التشدد بوصفه بيئة لا إشارة.',
      ] },
      why: { en: [
        'Tightening matters because it changes the market\'s capacity to absorb a shock before any shock arrives. A market funded generously can take a negative surprise and pass it around; a tightening one has fewer marginal buyers and thinner intermediation, so the identical surprise produces a larger, less orderly move.',
        'It also matters for sequencing. Funding stress typically appears in the plumbing — repo, cross-currency basis, dealer balance sheets — before it is visible in headline indices, so reading tightening early gives a desk a structural warning that the environment has become less forgiving, even while the surface tape still looks calm.',
      ], ar: [
        'يهمّ التشدد لأنه يغيّر قدرة السوق على امتصاص صدمة قبل وقوع أي صدمة. فالسوق الممول بسخاء يتحمّل مفاجأة سلبية ويوزّعها؛ أما السوق المتشدد فلديه مشترون هامشيون أقل ووساطة أرقّ، فتنتج المفاجأة نفسها حركة أكبر وأقل انتظاماً.',
        'ويهمّ أيضاً في التسلسل. فعادةً يظهر ضغط التمويل في البنية التحتية — إعادة الشراء وأساس مبادلة العملات وميزانيات الوسطاء — قبل أن يُرى في المؤشرات المعلنة، لذا تمنح القراءة المبكرة للتشدد المكتب تحذيراً هيكلياً بأن البيئة أصبحت أقل تسامحاً، حتى بينما يبدو سطح السوق هادئاً.',
      ] },
      desk: { en: [
        'A desk does not read tightening from one indicator. It reads funding cost, collateral availability, dealer capacity, and market depth together, because each can move for benign technical reasons in isolation, and only their joint movement describes a genuine change in risk-bearing capacity.',
        'The interpretation is conditional and continuous rather than a single call. The desk asks whether tightening is broadening across channels or confined to one, whether it is persisting across sessions, and whether it coincides with the regime turning less supportive — and it weights a tightening that several independent channels confirm far above one that a single series implies.',
      ], ar: [
        'لا يقرأ المكتب التشدد من مؤشر واحد. بل يقرأ كلفة التمويل وتوافر الضمانات وقدرة الوسطاء وعمق السوق معاً، لأن كلاً منها قد يتحرك لأسباب فنية حميدة بمعزل، ولا يصف تغيّراً حقيقياً في القدرة على تحمّل المخاطر إلا تحركها المشترك.',
        'والتفسير مشروط ومستمر لا حكم منفرد. فيسأل المكتب هل يتسع التشدد عبر القنوات أم ينحصر في واحدة، وهل يستمر عبر الجلسات، وهل يتزامن مع تحول النظام إلى أقل دعماً — ويرجّح تشدداً تؤكده عدة قنوات مستقلة أكثر بكثير من تشدد توحي به سلسلة واحدة.',
      ] },
      transmission: { en: [
        'The mechanism transmits through three linked channels. Higher funding costs raise the hurdle on every leveraged position; reduced collateral value and availability shrink how much can be borrowed against the same assets; and constrained dealer balance sheets widen the cost of moving risk, so liquidity thins exactly when it is most needed.',
        'Because these channels reinforce one another, tightening tends to be non-linear. Small initial increments are absorbed quietly, but past a threshold the same increment forces deleveraging that itself consumes more liquidity, which is why a desk watches for the point at which the channels begin to feed back on each other rather than tracking any single level.',
      ], ar: [
        'تنتقل الآلية عبر ثلاث قنوات مترابطة. فارتفاع كلفة التمويل يرفع العتبة على كل مركز برافعة؛ وتراجع قيمة الضمانات وتوافرها يقلّص ما يمكن اقتراضه مقابل الأصول نفسها؛ وتقييد ميزانيات الوسطاء يوسّع كلفة تحريك المخاطر، فتترقّق السيولة في اللحظة التي تشتد فيها الحاجة إليها.',
        'ولأن هذه القنوات يعزّز بعضها بعضاً، يميل التشدد إلى اللاخطية. فالزيادات الأولية الصغيرة تُمتص بهدوء، لكن بعد عتبة معينة تفرض الزيادة نفسها تقليصاً للرافعة يستهلك بدوره مزيداً من السيولة، ولهذا يترقّب المكتب النقطة التي تبدأ القنوات عندها بالتغذية المتبادلة بدل تتبّع أي مستوى منفرد.',
      ] },
      connection: { en: [
        'Across assets, tightening usually shows first where leverage and duration are most concentrated: the long end of the curve, the dollar as a funding currency, and the most rate-sensitive equity segments. Coherent confirmation — the dollar firming, real yields rising, and risk breadth narrowing together — is what distinguishes genuine tightening from an isolated move in one market.',
        'In regime terms, tightening is the bridge between a supportive and a fragile environment. The same liquidity-regime read that frames how a shock is absorbed is downstream of funding conditions, so a desk treats tightening as one of the earliest inputs into whether the prevailing regime is strengthening, holding, or beginning to transition.',
      ], ar: [
        'عبر الأصول، يظهر التشدد أولاً عادةً حيث تتركّز الرافعة والحساسية للأجل: الطرف الطويل من المنحنى، والدولار بوصفه عملة تمويل، وأكثر شرائح الأسهم حساسية للفائدة. والتأكيد المتسق — تصلّب الدولار وارتفاع العوائد الحقيقية وتضيّق اتساع المخاطر معاً — هو ما يميّز التشدد الحقيقي عن حركة منعزلة في سوق واحد.',
        'وبلغة النظام، يمثّل التشدد الجسر بين بيئة داعمة وأخرى هشة. فقراءة نظام السيولة التي تؤطّر كيفية امتصاص الصدمة لاحقة لشروط التمويل، لذا يعدّ المكتب التشدد من أبكر المدخلات في تحديد ما إذا كان النظام السائد يتقوّى أو يثبت أو يبدأ في الانتقال.',
      ] },
      misread: { en: [
        'The common misread is to treat a single funding series — an isolated repo spike or a one-day basis move — as proof of systemic tightening. Many such moves are technical: quarter-end balance-sheet management, settlement effects, or instrument-specific supply, none of which describe a durable change in risk-bearing capacity.',
        'The opposite error is reading calm prices as proof that liquidity is ample. Because tightening appears in the plumbing before the tape, a quiet index can coexist with deteriorating funding conditions, and mistaking surface stability for structural liquidity is precisely the failure that disciplined cross-channel reading is meant to prevent.',
      ], ar: [
        'القراءة الخاطئة الشائعة هي معاملة سلسلة تمويل واحدة — قفزة معزولة في إعادة الشراء أو حركة أساس ليوم واحد — دليلاً على تشدد نظامي. فكثير من هذه الحركات فني: إدارة ميزانية نهاية الربع، وآثار التسوية، أو معروض خاص بأداة، ولا يصف أيٌّ منها تغيّراً دائماً في القدرة على تحمّل المخاطر.',
        'والخطأ المعاكس هو قراءة هدوء الأسعار دليلاً على وفرة السيولة. فلأن التشدد يظهر في البنية التحتية قبل السطح، يمكن أن يتعايش مؤشر هادئ مع تدهور شروط التمويل، وخلط الاستقرار السطحي بالسيولة الهيكلية هو تحديداً العطب الذي تهدف القراءة المنضبطة عبر القنوات إلى منعه.',
      ] },
      framework: { en: [
        'A practical framework reads the channels in order of lead time. First the plumbing — funding spreads, the cross-currency basis, and dealer positioning — then collateral conditions, then the asset-level confirmation in the dollar, real yields, and risk breadth, and only last the index level, which lags the others.',
        'The desk then asks three structural questions rather than seeking a number: is the tightening broadening across channels, is it persisting across sessions, and is it coherent with the regime read. A configuration that answers yes to all three is treated as a genuine environment change; one that does not is held as conditional and provisional.',
      ], ar: [
        'يقرأ الإطار العملي القنوات بترتيب زمن الاستباق. أولاً البنية التحتية — فروق التمويل وأساس مبادلة العملات وتموضع الوسطاء — ثم شروط الضمانات، ثم التأكيد على مستوى الأصول في الدولار والعوائد الحقيقية واتساع المخاطر، وأخيراً فقط مستوى المؤشر الذي يتأخر عن البقية.',
        'ثم يطرح المكتب ثلاثة أسئلة هيكلية بدل البحث عن رقم: هل يتسع التشدد عبر القنوات، وهل يستمر عبر الجلسات، وهل يتسق مع قراءة النظام. والتكوين الذي يجيب بنعم على الثلاثة يُعامَل تغيّراً حقيقياً في البيئة؛ وما عداه يُحتفظ به مشروطاً ومؤقتاً.',
      ] },
      visual: { en: [
        'The liquidity-transmission visual maps how a change in funding conditions propagates outward through collateral and dealer capacity to the asset level, without attaching any price or fabricated metric. Its purpose is to make the sequencing legible — to show why the plumbing leads and the index lags — rather than to decorate the page.',
        'Read it as a causal map, not a forecast: it shows the channels through which tightening would transmit if it broadened, so the reader can locate where to look first and understand why a single-channel move is not yet a system-level read.',
      ], ar: [
        'يرسم شكل انتقال السيولة كيفية انتشار تغيّر شروط التمويل إلى الخارج عبر الضمانات وقدرة الوسطاء وصولاً إلى مستوى الأصول، دون إلحاق أي سعر أو مقياس مصطنع. وغرضه جعل التسلسل مقروءاً — إظهار سبب استباق البنية التحتية وتأخر المؤشر — لا تزيين الصفحة.',
        'اقرأه خريطةً سببية لا تنبؤاً: فهو يُظهر القنوات التي سينتقل عبرها التشدد لو اتسع، ليحدد القارئ أين ينظر أولاً ويفهم لماذا لا تمثّل حركة قناة واحدة قراءةً على مستوى النظام بعد.',
      ] },
    },
  },
  {
    id: 'liquidity-absorption', category: 'macro-liquidity',
    title_en: 'Liquidity absorption and balance-sheet capacity', title_ar: 'امتصاص السيولة وقدرة الميزانيات',
    thesis_en: 'Issuance, collateral demand, and defensive cash needs can absorb liquidity without an obvious market shock.',
    thesis_ar: 'قد تمتص الإصدارات والضمانات والطلب الدفاعي على النقد السيولة من دون صدمة سوقية ظاهرة.',
    lens_en: 'The relevant question is who can warehouse new supply and how much marginal balance-sheet capacity remains.',
    lens_ar: 'السؤال المحوري هو من يستطيع حمل المعروض الجديد ومقدار ما تبقى من قدرة هامشية في الميزانيات.',
    visual: 'balance-sheet-flow', related: ['liquidity-tightening', 'dollar-global-liquidity', 'participation-quality'], fingerprints: ['issuance absorption', 'dealer capacity'],
    depth: {
      context: { en: [
        'Liquidity absorption is the quiet counterpart to liquidity tightening: it describes how new supply of assets — government issuance, collateral demand, defensive cash holdings — is soaked up by the system\'s balance-sheet capacity without necessarily producing a visible price shock. The drain on liquidity is real, but it happens through who holds what, not through a dramatic move.',
        'The institutional context is that liquidity is not destroyed when it is absorbed; it is reallocated into instruments and holders that immobilise it. A desk reads absorption as a slow change in the system\'s free capacity to take risk, which is why it can tighten conditions structurally while the headline tape stays calm.',
      ], ar: [
        'امتصاص السيولة هو النظير الهادئ لتشدد السيولة: فهو يصف كيف يُمتَص المعروض الجديد من الأصول — الإصدارات الحكومية والطلب على الضمانات والاحتفاظ الدفاعي بالنقد — بقدرة ميزانيات النظام دون أن ينتج بالضرورة صدمة سعرية ظاهرة. فالاستنزاف حقيقي لكنه يحدث عبر من يحمل ماذا لا عبر حركة درامية.',
        'والسياق المؤسسي أن السيولة لا تُدمَّر حين تُمتَص؛ بل يُعاد تخصيصها في أدوات وحائزين يجمّدونها. ويقرأ المكتب الامتصاص بوصفه تغيّراً بطيئاً في القدرة الحرة للنظام على تحمّل المخاطر، ولهذا قد يشدّد الظروف هيكلياً بينما يبقى السطح هادئاً.',
      ] },
      why: { en: [
        'Absorption matters because it tightens conditions silently. A large wave of issuance that the market absorbs smoothly still removes marginal balance-sheet capacity, so the next shock lands on a system with less room — even though no single day looked stressful while the supply was being taken down.',
        'It also matters because it is frequently misattributed. When risk assets struggle during heavy absorption, the move is often blamed on sentiment or fundamentals when the binding constraint is simply that balance sheets are full, which is a structurally different and more persistent pressure than a sentiment wobble.',
      ], ar: [
        'يهمّ الامتصاص لأنه يشدّد الظروف بصمت. فموجة إصدار كبيرة يمتصها السوق بسلاسة تزيل مع ذلك قدرة هامشية من الميزانيات، فتقع الصدمة التالية على نظام بمساحة أقل — رغم أن أي يوم منفرد لم يبدُ متوتراً أثناء استيعاب المعروض.',
        'ويهمّ أيضاً لأنه كثيراً ما يُنسَب خطأً. فحين تتعثّر الأصول الخطرة أثناء امتصاص كثيف، يُعزى التحرك غالباً إلى المعنويات أو الأساسيات بينما القيد الفعلي هو ببساطة أن الميزانيات ممتلئة، وهو ضغط هيكلي مختلف وأكثر استمراراً من تذبذب معنوي.',
      ] },
      desk: { en: [
        'A desk reads absorption by asking who can warehouse the new supply and how much marginal capacity remains, rather than by watching price alone. It tracks issuance calendars, collateral demand, dealer inventories, and the cash that defensive holders are parking, because the binding question is capacity, not direction.',
        'The interpretation is about reserve: a market that absorbs supply with ample spare capacity is structurally stronger than one that absorbs the same supply only by exhausting its buffers. The desk grades absorption by how much cushion is being consumed, and treats near-exhaustion as a fragility signal even when prices hold.',
      ], ar: [
        'يقرأ المكتب الامتصاص بسؤال من يستطيع حمل المعروض الجديد ومقدار ما تبقى من قدرة هامشية، لا بمراقبة السعر وحده. ويتتبّع جداول الإصدار والطلب على الضمانات ومخزونات الوسطاء والنقد الذي يركنه الحائزون الدفاعيون، لأن السؤال المُلزِم هو القدرة لا الاتجاه.',
        'والتفسير يتعلق بالاحتياطي: فالسوق الذي يمتص المعروض بقدرة فائضة وافرة أقوى هيكلياً من سوق يمتص المعروض نفسه باستنزاف وسائده فقط. ويدرّج المكتب الامتصاص بمقدار الوسادة المستهلكة، ويعدّ قرب الاستنزاف إشارة هشاشة حتى لو صمدت الأسعار.',
      ] },
      transmission: { en: [
        'The mechanism runs through balance-sheet space. Each unit of new supply must be held by someone — a dealer, a bank, a fund — and warehousing it consumes capital and collateral capacity. As that capacity fills, the cost of intermediating any further risk rises, and the marginal buyer for unrelated assets quietly disappears.',
        'Because the constraint is cumulative, absorption transmits with a lag and then non-linearly. The system takes supply comfortably until buffers thin, after which a modest additional wave can force the same deleveraging that liquidity tightening produces — which is why absorption and tightening are best read as two views of one balance-sheet constraint.',
      ], ar: [
        'تجري الآلية عبر حيّز الميزانية. فكل وحدة من المعروض الجديد يجب أن يحملها أحد — وسيط أو بنك أو صندوق — وحملها يستهلك رأس المال وقدرة الضمانات. ومع امتلاء تلك القدرة ترتفع كلفة الوساطة في أي مخاطر إضافية، ويختفي بهدوء المشتري الهامشي لأصول غير ذات صلة.',
        'ولأن القيد تراكمي، ينتقل الامتصاص بتأخّر ثم بلاخطية. فيستوعب النظام المعروض براحة حتى ترقّ الوسائد، وبعدها قد تفرض موجة إضافية متواضعة تقليص الرافعة نفسه الذي ينتجه تشدد السيولة — ولهذا يُقرأ الامتصاص والتشدد على أفضل وجه بوصفهما رؤيتين لقيد ميزانية واحد.',
      ] },
      connection: { en: [
        'Across assets, heavy absorption shows up as a firmer dollar, richer collateral, and underperformance in the assets most dependent on abundant balance sheet — long duration and the more leveraged corners of risk. Reading these together separates a genuine capacity constraint from an ordinary risk-off move.',
        'In regime terms, absorption is upstream of the liquidity regime: it is one of the channels through which a supportive environment quietly becomes a constrained one. A desk pairs it with the liquidity-tightening read, since the two describe the supply side and the price-of-funding side of the same shrinking capacity.',
      ], ar: [
        'عبر الأصول، يظهر الامتصاص الكثيف في دولار أصلب وضمانات أغلى وأداء أضعف في الأصول الأكثر اعتماداً على وفرة الميزانية — الأجل الطويل والزوايا الأكثر رفعاً من المخاطر. وقراءة هذه معاً تفصل قيد القدرة الحقيقي عن حركة عزوف اعتيادية.',
        'وبلغة النظام، يسبق الامتصاص نظام السيولة: فهو إحدى القنوات التي تتحول عبرها بيئة داعمة بهدوء إلى مقيّدة. ويقرنه المكتب بقراءة تشدد السيولة، إذ يصف الاثنان جانب المعروض وجانب كلفة التمويل للقدرة المتقلّصة نفسها.',
      ] },
      misread: { en: [
        'The common misread is to equate smooth absorption with abundant liquidity. A market can take down a large supply wave without a hiccup precisely while it is using up the last of its spare capacity, so the calm itself can be the warning rather than the reassurance.',
        'The opposite error is to read every soft patch during issuance as a capacity crisis. Much supply is absorbed routinely with ample room, so a desk requires corroboration — firming collateral, fuller dealer balance sheets, duration underperformance — before treating absorption as a binding structural constraint.',
      ], ar: [
        'القراءة الخاطئة الشائعة هي مساواة الامتصاص السلس بوفرة السيولة. فقد يستوعب السوق موجة معروض كبيرة دون تعثّر في اللحظة ذاتها التي يستنفد فيها آخر قدرته الفائضة، فيكون الهدوء نفسه التحذير لا الطمأنة.',
        'والخطأ المعاكس قراءة كل وهن أثناء الإصدار أزمةَ قدرة. فكثير من المعروض يُمتَص روتينياً بمساحة وافرة، لذا يشترط المكتب تأكيداً — تصلّب الضمانات وامتلاء ميزانيات الوسطاء وضعف أداء الأجل الطويل — قبل معاملة الامتصاص قيداً هيكلياً مُلزِماً.',
      ] },
      framework: { en: [
        'A practical framework tracks capacity rather than price: the issuance calendar against estimated balance-sheet room, collateral conditions, dealer inventory levels, and the share of new supply ending up in immobilising hands. The question is always how much cushion remains, not whether today\'s auction cleared.',
        'The desk then asks whether absorption is broadening, persisting, and coinciding with funding stress — the same three structural tests applied to tightening. A configuration that consumes buffers across sessions while funding firms is treated as a genuine constraint; an isolated heavy day that the system shrugs off is not.',
      ], ar: [
        'يتتبّع الإطار العملي القدرة لا السعر: جدول الإصدار مقابل تقدير حيّز الميزانية، وشروط الضمانات، ومستويات مخزون الوسطاء، وحصة المعروض الجديد المنتهية إلى أيدٍ تجمّده. والسؤال دائماً كم تبقّى من وسادة، لا هل نجح مزاد اليوم.',
        'ثم يسأل المكتب هل يتسع الامتصاص ويستمر ويتزامن مع ضغط تمويل — الاختبارات الهيكلية الثلاثة نفسها المطبَّقة على التشدد. والتكوين الذي يستهلك الوسائد عبر الجلسات بينما يتصلّب التمويل يُعامَل قيداً حقيقياً؛ ويومٌ ثقيل معزول يتجاوزه النظام ليس كذلك.',
      ] },
      visual: { en: [
        'The balance-sheet-flow visual traces where new supply ends up — which holders absorb it and how much marginal capacity that consumes — without attaching prices or fabricated quantities. Its purpose is to make the capacity drain legible, showing why a calm absorption can still tighten the system.',
        'Read it as a stock-and-flow map rather than a forecast: it depicts the channels through which supply immobilises balance sheet, so the reader can judge how much spare capacity remains rather than inferring stress from price action alone.',
      ], ar: [
        'يتتبّع شكل تدفق الميزانية أين ينتهي المعروض الجديد — أي الحائزين يمتصونه وكم يستهلك ذلك من قدرة هامشية — دون إلحاق أسعار أو كميات مصطنعة. وغرضه جعل استنزاف القدرة مقروءاً، مُظهراً كيف يظل بإمكان امتصاص هادئ أن يشدّد النظام.',
        'اقرأه خريطة مخزون وتدفّق لا تنبؤاً: فهو يصوّر القنوات التي يجمّد عبرها المعروض الميزانية، ليحكم القارئ على ما تبقّى من قدرة فائضة بدل استنتاج الضغط من حركة السعر وحدها.',
      ] },
    },
  },
  {
    id: 'risk-on-risk-off-regimes', category: 'macro-liquidity',
    title_en: 'Risk-on and risk-off as coherent regimes', title_ar: 'الإقبال والعزوف عن المخاطر كنظامين متماسكين',
    thesis_en: 'A risk regime is credible only when funding, breadth, volatility, and defensive demand form a coherent pattern.',
    thesis_ar: 'لا يكتسب نظام المخاطرة صدقيته إلا عندما تتسق شروط التمويل والاتساع والتقلب والطلب الدفاعي.',
    lens_en: 'One equity index cannot define a cross-asset risk regime.',
    lens_ar: 'لا يستطيع مؤشر أسهم واحد تحديد نظام مخاطر عابر للأصول.',
    visual: 'regime-matrix', related: ['defensive-rotation', 'regime-context'], fingerprints: ['risk regime', 'defensive demand'],
    depth: {
      context: { en: [
        'A risk-on or risk-off regime is a coherent configuration of behaviour across markets, not a label applied to a single up or down day. It describes a state in which funding conditions, market breadth, volatility, and defensive demand are aligned in the same direction, so the whole complex is leaning toward or away from risk together.',
        'The institutional context is that genuine regimes are rare and persistent, while day-to-day moves are frequent and noisy. Treating every green or red session as a regime change would make the concept useless; a desk reserves the term for states where the independent channels corroborate one another and hold across sessions.',
      ], ar: [
        'نظام الإقبال أو العزوف عن المخاطر تكوين متماسك للسلوك عبر الأسواق، لا تسمية تُطلق على يوم صاعد أو هابط واحد. فهو يصف حالة تتسق فيها شروط التمويل واتساع السوق والتذبذب والطلب الدفاعي في الاتجاه نفسه، فيميل المجمّع كله نحو المخاطر أو بعيداً عنها معاً.',
        'والسياق المؤسسي أن الأنظمة الحقيقية نادرة ومستمرة، بينما التحركات اليومية متكررة وكثيرة الضجيج. ومعاملة كل جلسة خضراء أو حمراء تغيّراً في النظام تجعل المفهوم بلا فائدة؛ لذا يحتفظ المكتب بالمصطلح للحالات التي تتآزر فيها القنوات المستقلة وتصمد عبر الجلسات.',
      ] },
      why: { en: [
        'The regime matters because it conditions how every other signal should be read. The same earnings beat, data surprise, or headline is absorbed differently in a risk-on regime, where the system is leaning into risk, than in a risk-off one, where defensive demand dominates and surprises are met with hedging rather than buying.',
        'It also matters for risk management at the portfolio level: correlations themselves change with the regime. In risk-off states assets that normally diversify each other tend to move together, so a desk reads the regime partly to understand whether its diversification assumptions still hold or are quietly breaking down.',
      ], ar: [
        'يهمّ النظام لأنه يشترط كيفية قراءة كل إشارة أخرى. فتجاوز الأرباح للتوقعات أو مفاجأة البيانات أو العنوان نفسه يُمتص بصورة مختلفة في نظام إقبال على المخاطر، حيث يميل النظام نحو المخاطرة، عنه في نظام عزوف، حيث يهيمن الطلب الدفاعي وتُقابَل المفاجآت بالتحوّط لا بالشراء.',
        'ويهمّ أيضاً لإدارة المخاطر على مستوى المحفظة: فالارتباطات نفسها تتغير مع النظام. ففي حالات العزوف تميل الأصول التي تنوّع بعضها عادةً إلى التحرك معاً، لذا يقرأ المكتب النظام جزئياً ليفهم ما إذا كانت افتراضات التنويع لديه ما زالت قائمة أم تنهار بهدوء.',
      ] },
      desk: { en: [
        'A desk confirms a regime by requiring agreement across independent channels rather than trusting any single one. It asks whether funding is easy or stressed, whether breadth is broad or narrow, whether volatility is being absorbed or rejected, and whether leadership is cyclical or defensive — and it calls a regime only when these point the same way.',
        'The reading is explicitly probabilistic. The desk grades regime conviction by how many channels agree and how long the alignment has persisted, and it treats a regime confirmed by four coherent channels across several sessions very differently from a tentative one implied by a single strong day.',
      ], ar: [
        'يؤكد المكتب النظام باشتراط اتفاق القنوات المستقلة لا بالثقة بأي قناة منفردة. فيسأل هل التمويل ميسور أم متوتر، وهل الاتساع واسع أم ضيق، وهل يُمتَص التذبذب أم يُرفَض، وهل القيادة دورية أم دفاعية — ولا يعلن نظاماً إلا حين تشير هذه جميعها الوجهة نفسها.',
        'والقراءة احتمالية صراحةً. فيدرّج المكتب القناعة بالنظام بعدد القنوات المتفقة وطول استمرار الاتساق، ويعامل نظاماً تؤكده أربع قنوات متسقة عبر عدة جلسات معاملةً مختلفة تماماً عن نظام مبدئي توحي به جلسة قوية واحدة.',
      ] },
      transmission: { en: [
        'A regime propagates through positioning and correlation. As participants recognise a risk-on state they extend exposure in a self-reinforcing way, breadth widens, and volatility compresses; in a risk-off state the reverse runs, with deleveraging, narrowing participation, and rising hedging demand feeding on one another.',
        'Because the mechanism is reflexive, regimes tend to overshoot and then transition abruptly rather than fading gently. A desk therefore watches the channels that usually break first — breadth and funding — because the earliest sign of a regime ending is typically internal deterioration beneath a still-rising or still-calm index.',
      ], ar: [
        'ينتشر النظام عبر التموضع والارتباط. فمع إدراك المشاركين لحالة إقبال على المخاطر يوسّعون انكشافهم بصورة ذاتية التعزيز، فيتسع الاتساع وينضغط التذبذب؛ وفي حالة العزوف يجري العكس، إذ يتغذّى تقليص الرافعة وتضيّق المشاركة وارتفاع الطلب على التحوّط بعضها على بعض.',
        'ولأن الآلية انعكاسية، تميل الأنظمة إلى التجاوز ثم الانتقال المفاجئ بدل التلاشي التدريجي. لذا يراقب المكتب القنوات التي تنكسر أولاً عادةً — الاتساع والتمويل — لأن أبكر علامة على انتهاء نظام هي عادةً تدهور داخلي تحت مؤشر ما زال صاعداً أو هادئاً.',
      ] },
      connection: { en: [
        'Across assets the regime is the organising frame: in risk-on the dollar tends to soften, cyclicals lead, credit spreads compress, and gold\'s safe-haven bid fades, while risk-off reverses each. Reading these relationships together, rather than any one pair, is how a desk verifies that a regime is real and coherent.',
        'The regime read is the same structural environment the liquidity-regime engine frames, viewed from the demand side. Where liquidity tightening describes the funding constraint, the risk regime describes the collective posture toward risk that sits on top of it, and the two are most informative when read as one system.',
      ], ar: [
        'عبر الأصول يكون النظام الإطار المنظِّم: ففي الإقبال يميل الدولار إلى الليونة، وتقود الأسهم الدورية، وتنضغط فروق الائتمان، ويخبو الطلب على الذهب كملاذ، بينما يعكس العزوف كلاً منها. وقراءة هذه العلاقات معاً، لا أي زوج منفرد، هي كيف يتحقق المكتب من أن النظام حقيقي ومتماسك.',
        'وقراءة النظام هي البيئة الهيكلية نفسها التي يؤطّرها محرك نظام السيولة، منظوراً إليها من جانب الطلب. فحيث يصف تشدد السيولة قيد التمويل، يصف نظام المخاطر الموقف الجماعي تجاه المخاطرة القائم فوقه، ويكون الاثنان أكثر إفادة حين يُقرآن نظاماً واحداً.',
      ] },
      misread: { en: [
        'The common misread is to declare a regime from price alone — a strong rally read as risk-on, a sharp drop as risk-off — without checking whether the supporting channels agree. A rally on narrowing breadth with rising hedging demand is not a clean risk-on regime, however green the index looks.',
        'The second error is assuming regimes change slowly. Because the mechanism is reflexive, transitions can be abrupt, and a desk that anchors to yesterday\'s regime risks reading new information through a frame that has already broken — which is why the regime is re-tested continuously rather than assumed to persist.',
      ], ar: [
        'القراءة الخاطئة الشائعة هي إعلان نظام من السعر وحده — صعود قوي يُقرأ إقبالاً، وهبوط حاد عزوفاً — دون التحقق من اتفاق القنوات الداعمة. فالصعود على اتساع آخذ في التضيّق مع ارتفاع الطلب على التحوّط ليس نظام إقبال نظيفاً مهما بدا المؤشر أخضر.',
        'والخطأ الثاني افتراض أن الأنظمة تتغير ببطء. فلأن الآلية انعكاسية قد تكون الانتقالات مفاجئة، والمكتب الذي يتمسك بنظام الأمس يخاطر بقراءة معلومات جديدة عبر إطار انكسر فعلاً — ولهذا يُعاد اختبار النظام باستمرار بدل افتراض استمراره.',
      ] },
      framework: { en: [
        'A practical framework scores the four channels — funding, breadth, volatility, and defensive demand — as agreeing or disagreeing with the apparent risk direction, then reads the regime from their coherence rather than from price. Four-channel agreement is a high-conviction regime; a split is a contested tape that does not yet warrant the label.',
        'The desk then tracks persistence and the order of breakage: which channel would crack first if the regime turned. Framing it this way keeps the read structural and conditional — it describes the state and what would invalidate it, without converting the regime into a directional position.',
      ], ar: [
        'يقيّم الإطار العملي القنوات الأربع — التمويل والاتساع والتذبذب والطلب الدفاعي — بوصفها متفقة أو مختلفة مع اتجاه المخاطر الظاهر، ثم يقرأ النظام من اتساقها لا من السعر. فاتفاق القنوات الأربع نظام عالي القناعة؛ والانقسام سوق متنازَع عليه لا يستحق التسمية بعد.',
        'ثم يتتبّع المكتب الاستمرارية وترتيب الانكسار: أي قناة ستنكسر أولاً لو انقلب النظام. وتأطيرها هكذا يبقي القراءة هيكلية ومشروطة — تصف الحالة وما الذي يبطلها، دون تحويل النظام إلى مركز اتجاهي.',
      ] },
      visual: { en: [
        'The regime-matrix visual places the independent channels against the apparent risk direction so the reader can see at a glance whether they agree, without attaching any price or fabricated probability. Its purpose is to make coherence visible — to show when the channels line up and when they conflict — not to decorate the analysis.',
        'Read it as a coherence check rather than a forecast: a matrix where every channel agrees depicts a high-conviction regime, while a mixed matrix depicts exactly the contested state in which the regime label should be withheld until the evidence resolves.',
      ], ar: [
        'يضع شكل مصفوفة النظام القنوات المستقلة مقابل اتجاه المخاطر الظاهر ليرى القارئ للوهلة ما إذا كانت متفقة، دون إلحاق أي سعر أو احتمال مصطنع. وغرضه جعل الاتساق مرئياً — إظهار متى تصطف القنوات ومتى تتعارض — لا تزيين التحليل.',
        'اقرأه فحصاً للاتساق لا تنبؤاً: فالمصفوفة التي تتفق فيها كل قناة تصوّر نظاماً عالي القناعة، بينما تصوّر المصفوفة المختلطة تحديداً الحالة المتنازَع عليها التي ينبغي فيها حجب تسمية النظام حتى تُحسم الأدلة.',
      ] },
    },
  },
  {
    id: 'defensive-rotation', category: 'macro-liquidity',
    title_en: 'Defensive rotation without broad liquidation', title_ar: 'الدوران الدفاعي من دون تصفية شاملة',
    thesis_en: 'Defensive rotation can reveal declining participation quality before broad risk aversion appears.',
    thesis_ar: 'قد يكشف الدوران الدفاعي تراجع جودة المشاركة قبل ظهور عزوف واسع عن المخاطر.',
    lens_en: 'Sector leadership, credit quality, duration demand, and breadth distinguish caution from liquidation.',
    lens_ar: 'تميّز قيادة القطاعات وجودة الائتمان والطلب على المدة والاتساع بين الحذر والتصفية.',
    visual: 'rotation-map', related: ['risk-on-risk-off-regimes', 'breadth-deterioration', 'participation-quality'], fingerprints: ['defensive leadership', 'cyclical participation'],
    depth: {
      context: { en: [
        'Defensive rotation is a change in leadership toward defensive sectors — utilities, staples, healthcare — that occurs without broad liquidation. The index can hold or even rise while the composition of what is leading quietly shifts toward safety, which is why it is a structural tell rather than a price event.',
        'The institutional context is that rotation reveals positioning intent before it shows up in aggregate risk aversion. A market that is still advancing but doing so on defensive leadership is expressing caution through composition, and a desk reads that composition as information about conviction beneath the surface.',
      ], ar: [
        'الدوران الدفاعي تحوّل في القيادة نحو القطاعات الدفاعية — المرافق والسلع الأساسية والرعاية الصحية — يحدث دون تصفية شاملة. فقد يثبت المؤشر أو حتى يرتفع بينما يتحوّل بهدوء تركيب ما يقود نحو الأمان، ولهذا يكون مؤشراً هيكلياً لا حدثاً سعرياً.',
        'والسياق المؤسسي أن الدوران يكشف نيّة التموضع قبل أن تظهر في عزوف إجمالي عن المخاطر. فالسوق الذي ما زال يصعد لكن على قيادة دفاعية يعبّر عن الحذر عبر التركيب، ويقرأ المكتب ذلك التركيب بوصفه معلومة عن القناعة تحت السطح.',
      ] },
      why: { en: [
        'Rotation matters because it is an early and relatively clean read on conviction. Participants can keep an index aloft while repositioning toward safety, so defensive leadership inside a rising tape signals that the advance is being led by caution rather than risk appetite — a structurally weaker configuration than the same level on cyclical leadership.',
        'It also matters because it precedes, rather than coincides with, broad risk-off. By the time aggregate risk aversion is obvious in the index, the rotation that warned of it has usually been underway for some time, so reading leadership composition gives a desk lead time that price alone does not.',
      ], ar: [
        'يهمّ الدوران لأنه قراءة مبكرة ونظيفة نسبياً للقناعة. فيستطيع المشاركون إبقاء المؤشر مرتفعاً بينما يعيدون التموضع نحو الأمان، فتشير القيادة الدفاعية داخل سوق صاعد إلى أن الصعود تقوده الحيطة لا شهية المخاطرة — تكوين أضعف هيكلياً من المستوى نفسه على قيادة دورية.',
        'ويهمّ أيضاً لأنه يسبق العزوف الواسع عن المخاطر لا يتزامن معه. فحين يصبح العزوف الإجمالي واضحاً في المؤشر يكون الدوران الذي حذّر منه قد بدأ منذ حين عادةً، فتمنح قراءة تركيب القيادة المكتب وقت استباق لا يمنحه السعر وحده.',
      ] },
      desk: { en: [
        'A desk distinguishes caution from liquidation by reading sector leadership, credit quality, duration demand, and breadth together. Defensive leadership with stable credit and orderly breadth is a cautious tilt; the same leadership with widening credit spreads and narrowing breadth is the early signature of genuine de-risking.',
        'The interpretation is conditional on the regime. Defensive rotation inside a supportive liquidity regime is often a healthy consolidation; the identical rotation inside a tightening regime carries far more weight, so the desk reads rotation against funding conditions rather than in isolation.',
      ], ar: [
        'يميّز المكتب الحذر عن التصفية بقراءة قيادة القطاعات وجودة الائتمان والطلب على المدة والاتساع معاً. فالقيادة الدفاعية مع ائتمان مستقر واتساع منظّم ميلٌ حذِر؛ والقيادة نفسها مع اتساع فروق الائتمان وتضيّق الاتساع هي التوقيع المبكر لخفض حقيقي للمخاطر.',
        'والتفسير مشروط بالنظام. فالدوران الدفاعي داخل نظام سيولة داعم كثيراً ما يكون تماسكاً صحياً؛ والدوران نفسه داخل نظام متشدد يحمل وزناً أكبر بكثير، لذا يقرأ المكتب الدوران مقابل شروط التمويل لا بمعزل.',
      ] },
      transmission: { en: [
        'The mechanism is a reallocation of capital along the risk spectrum rather than its withdrawal. Money leaving cyclicals for staples keeps aggregate exposure roughly constant but lowers the beta of the market\'s leadership, so the same index level now rests on lower-conviction risk-taking.',
        'Because rotation is gradual, it transmits as a slow erosion of the advance\'s quality. The danger is that the index masks it: leadership can deteriorate for an extended period while the headline holds, and the rotation only becomes a price event if and when the defensive bid itself gives way.',
      ], ar: [
        'الآلية إعادة تخصيص لرأس المال على طيف المخاطر لا سحبٌ له. فالأموال المغادرة الأسهم الدورية إلى السلع الأساسية تُبقي الانكشاف الإجمالي ثابتاً تقريباً لكنها تخفض «بيتا» قيادة السوق، فيستند المستوى نفسه إلى مخاطرة أقل قناعة.',
        'ولأن الدوران تدريجي، ينتقل بوصفه تآكلاً بطيئاً لجودة الصعود. والخطر أن يخفيه المؤشر: فقد تتدهور القيادة لفترة ممتدة بينما يثبت العنوان، ولا يصبح الدوران حدثاً سعرياً إلا إذا تخلّى الطلب الدفاعي نفسه.',
      ] },
      connection: { en: [
        'Across assets, defensive rotation typically pairs with firmer duration demand, a steady-to-firmer dollar, and a fading bid for the most speculative risk. Reading equity leadership alongside the bond and dollar signals confirms whether the rotation reflects genuine caution or merely sector-specific news.',
        'In regime terms, defensive rotation is one of the channels feeding the risk-on/risk-off read: it is the leadership dimension of the broader regime. A desk treats persistent defensive leadership as evidence that the regime is drifting from supportive toward fragile, well before that shift is confirmed in the index.',
      ], ar: [
        'عبر الأصول، يقترن الدوران الدفاعي عادةً بطلب أصلب على المدة، ودولار ثابت إلى أصلب، وتلاشي الطلب على أكثر المخاطر مضاربةً. وقراءة قيادة الأسهم إلى جانب إشارات السندات والدولار تؤكد ما إذا كان الدوران يعكس حذراً حقيقياً أم مجرد خبر خاص بقطاع.',
        'وبلغة النظام، الدوران الدفاعي إحدى القنوات التي تغذّي قراءة الإقبال والعزوف: فهو بُعد القيادة في النظام الأوسع. ويعدّ المكتب القيادة الدفاعية المستمرة دليلاً على انجراف النظام من الداعم نحو الهش، قبل وقت طويل من تأكيد ذلك في المؤشر.',
      ] },
      misread: { en: [
        'The common misread is to dismiss defensive rotation because the index is still rising. The level is precisely what hides the change: a market making highs on defensive leadership is structurally different from one making highs on cyclical leadership, even though the price looks identical.',
        'The opposite error is to read every defensive day as the start of a risk-off regime. Single-session sector noise, rebalancing, and idiosyncratic moves are common, so a desk requires persistence and cross-asset corroboration before treating rotation as a genuine deterioration in participation quality.',
      ], ar: [
        'القراءة الخاطئة الشائعة هي تجاهل الدوران الدفاعي لأن المؤشر ما زال يصعد. فالمستوى هو تحديداً ما يخفي التغيّر: فالسوق الذي يسجّل قمماً على قيادة دفاعية يختلف هيكلياً عن سوق يسجّلها على قيادة دورية، وإن بدا السعر متطابقاً.',
        'والخطأ المعاكس قراءة كل يوم دفاعي بدايةً لنظام عزوف. فضجيج القطاعات لجلسة واحدة وإعادة الموازنة والتحركات الفردية شائعة، لذا يشترط المكتب الاستمرارية والتأكيد عبر الأصول قبل معاملة الدوران تدهوراً حقيقياً في جودة المشاركة.',
      ] },
      framework: { en: [
        'A practical framework reads four dimensions in concert: which sectors lead, whether credit quality is holding, whether duration is being bid, and whether breadth is broadening or narrowing. Caution shows as defensive leadership with otherwise orderly internals; liquidation shows as defensive leadership with credit and breadth deteriorating together.',
        'The desk then tests persistence and regime context — is the rotation holding across sessions, and is the funding backdrop supportive or tightening. A persistent defensive tilt in a tightening regime is treated as a meaningful structural warning; an isolated defensive session in a supportive regime is not.',
      ], ar: [
        'يقرأ الإطار العملي أربعة أبعاد معاً: أي القطاعات تقود، وهل تصمد جودة الائتمان، وهل يُطلَب على المدة، وهل يتسع الاتساع أم يضيق. فالحذر يظهر قيادةً دفاعية مع داخليات منظّمة؛ والتصفية تظهر قيادةً دفاعية مع تدهور الائتمان والاتساع معاً.',
        'ثم يختبر المكتب الاستمرارية وسياق النظام — هل يصمد الدوران عبر الجلسات، وهل خلفية التمويل داعمة أم متشددة. والميل الدفاعي المستمر في نظام متشدد يُعامَل تحذيراً هيكلياً ذا معنى؛ وجلسة دفاعية معزولة في نظام داعم ليست كذلك.',
      ] },
      visual: { en: [
        'The rotation-map visual shows the shift in leadership across the risk spectrum — from cyclical toward defensive or back — without attaching prices or fabricated flows. Its purpose is to make the change in composition visible, so the reader can see leadership move while the index level stays flat.',
        'Read it as a composition map rather than a forecast: it depicts where leadership sits now relative to caution and risk, letting the reader judge the quality of an advance instead of inferring it from the headline level alone.',
      ], ar: [
        'يُظهر شكل خريطة الدوران تحوّل القيادة عبر طيف المخاطر — من الدورية نحو الدفاعية أو العكس — دون إلحاق أسعار أو تدفقات مصطنعة. وغرضه جعل تغيّر التركيب مرئياً، ليرى القارئ القيادة تتحرك بينما يبقى مستوى المؤشر ثابتاً.',
        'اقرأه خريطة تركيب لا تنبؤاً: فهو يصوّر أين تقع القيادة الآن نسبةً إلى الحذر والمخاطرة، ليحكم القارئ على جودة الصعود بدل استنتاجها من المستوى المعلن وحده.',
      ] },
    },
  },
  {
    id: 'yield-curve-pressure', category: 'macro-liquidity',
    title_en: 'Yield-curve pressure and financial conditions', title_ar: 'ضغوط منحنى العائد والأوضاع المالية',
    thesis_en: 'Curve pressure matters through the source and location of the move, not a mechanical steepening or flattening label.',
    thesis_ar: 'تنبع أهمية ضغط المنحنى من مصدر الحركة وموضعها، لا من تسمية آلية للتحدب أو التسطح.',
    lens_en: 'Front-end policy pricing, long-end term premium, and issuance supply transmit differently.',
    lens_ar: 'ينتقل تسعير السياسة في الآجال القصيرة وعلاوة الأجل والمعروض في الآجال الطويلة بطرق مختلفة.',
    visual: 'curve-transmission', related: ['central-bank-reaction-function', 'real-yields-gold', 'tlt-duration-sensitivity'], fingerprints: ['curve shape', 'term premium'],
    depth: {
      context: { en: [
        'Yield-curve pressure describes a change in the shape of the curve — the relationship between short and long rates — that alters financial conditions. What matters is not the steepening-or-flattening label but the source and location of the move: the same shape change means very different things depending on whether the front end, the long end, or both are driving it.',
        'The institutional context is that the curve encodes two distinct stories at once: the front end is dominated by expected policy, while the long end reflects growth, inflation, and term premium. A desk reads curve pressure by decomposing the move into those drivers rather than reacting to the headline spread.',
      ], ar: [
        'تصف ضغوط منحنى العائد تغيّراً في شكل المنحنى — العلاقة بين الفائدة القصيرة والطويلة — يبدّل الأوضاع المالية. والمهم ليس تسمية التحدّب أو التسطّح بل مصدر الحركة وموضعها: فتغيّر الشكل نفسه يعني أموراً مختلفة تماماً تبعاً لما إذا كان الطرف القصير أو الطويل أو كلاهما يقوده.',
        'والسياق المؤسسي أن المنحنى يرمّز قصتين متمايزتين في آن: فالطرف القصير تهيمن عليه السياسة المتوقعة، بينما يعكس الطرف الطويل النمو والتضخم وعلاوة الأجل. ويقرأ المكتب ضغط المنحنى بتفكيك الحركة إلى تلك المحرّكات لا بالتفاعل مع الفارق المعلن.',
      ] },
      why: { en: [
        'Curve pressure matters because it is a primary channel of financial conditions. A long-end-led rise tightens conditions on the most duration-sensitive assets and re-rates growth equities; a front-end-led move is mostly about policy expectations; and a flattening driven by long-end demand carries a different message than one driven by front-end repricing.',
        'It also matters because the location of the move tells a desk what the market is actually pricing. The same ten-basis-point change in a headline spread can reflect easing policy expectations, rising term premium, or a flight to duration — and conflating them is one of the most common ways a curve read goes wrong.',
      ], ar: [
        'تهمّ ضغوط المنحنى لأنها قناة أساسية للأوضاع المالية. فارتفاع يقوده الطرف الطويل يشدّد الظروف على أكثر الأصول حساسية للأجل ويعيد تسعير أسهم النمو؛ وحركة يقودها الطرف القصير تتعلق غالباً بتوقعات السياسة؛ وتسطّح يقوده الطلب على الأجل الطويل يحمل رسالة مختلفة عن تسطّح يقوده إعادة تسعير الطرف القصير.',
        'وتهمّ أيضاً لأن موضع الحركة يخبر المكتب بما يسعّره السوق فعلاً. فتغيّر عشر نقاط أساس نفسه في فارق معلن قد يعكس توقعات تيسير، أو ارتفاع علاوة الأجل، أو هروباً نحو المدة — وخلطها من أكثر الطرق شيوعاً لانحراف قراءة المنحنى.',
      ] },
      desk: { en: [
        'A desk reads the curve by decomposing it: front-end policy pricing, long-end term premium, and issuance supply each transmit differently, so the first task is to attribute the move before interpreting it. A long-end move on heavy supply is a different signal from the same move on a growth re-rating.',
        'The interpretation is about transmission, not prediction. The desk asks which assets the specific curve move re-prices — duration-heavy equities, the dollar, mortgage and credit spreads — and treats the curve as an input into financial conditions rather than a directional forecast of rates.',
      ], ar: [
        'يقرأ المكتب المنحنى بتفكيكه: فتسعير السياسة في الطرف القصير، وعلاوة الأجل في الطرف الطويل، ومعروض الإصدار، ينتقل كلٌّ منها بطريقة مختلفة، لذا تكون المهمة الأولى عزو الحركة قبل تفسيرها. فحركة في الطرف الطويل على معروض ثقيل إشارة مختلفة عن الحركة نفسها على إعادة تسعير للنمو.',
        'والتفسير يتعلق بالانتقال لا التنبؤ. فيسأل المكتب أي الأصول تعيد حركة المنحنى المحددة تسعيرها — الأسهم كثيفة الأجل والدولار وفروق الرهن والائتمان — ويعدّ المنحنى مدخلاً للأوضاع المالية لا تنبؤاً اتجاهياً بالفائدة.',
      ] },
      transmission: { en: [
        'The mechanism runs through the discount rate and the cost of leverage. A higher long end raises the rate at which distant cash flows are discounted, compressing long-duration valuations first, while a higher front end raises the cost of carry and financing across the system. Each location of the curve therefore hits a different part of the market.',
        'Because the curve sits upstream of so many assets, its moves propagate widely but unevenly. A desk traces the specific channel — duration, carry, or term premium — rather than assuming a uniform effect, because a steepening that helps banks can simultaneously pressure the growth complex through the very same long-end move.',
      ], ar: [
        'تجري الآلية عبر معدل الخصم وكلفة الرافعة. فارتفاع الطرف الطويل يرفع المعدل الذي تُخصَم به التدفقات البعيدة، فيضغط تقييمات الأجل الطويل أولاً، بينما يرفع ارتفاع الطرف القصير كلفة الحمل والتمويل عبر النظام. فيصيب كل موضع من المنحنى جزءاً مختلفاً من السوق.',
        'ولأن المنحنى يقع أعلى كثير من الأصول، تنتشر حركاته على نطاق واسع لكن بتفاوت. ويتتبّع المكتب القناة المحددة — المدة أو الحمل أو علاوة الأجل — بدل افتراض أثر موحّد، لأن تحدّباً يفيد البنوك قد يضغط في آنٍ مجمّع النمو عبر حركة الطرف الطويل ذاتها.',
      ] },
      connection: { en: [
        'Across assets, curve pressure is most visible where duration concentrates: long bonds, the most rate-sensitive equities, the dollar as rate differentials shift, and gold through the real-yield channel. Reading these together is how a desk confirms that a curve move is transmitting rather than sitting isolated in the rates market.',
        'In regime terms, the curve is one of the earliest inputs into the liquidity and risk regimes. A long-end-led tightening is often the leading edge of a regime turning less supportive, so a desk pairs the curve read with funding conditions and the real-yield/gold relationship to judge whether financial conditions are genuinely tightening.',
      ], ar: [
        'عبر الأصول، يكون ضغط المنحنى أوضح حيث تتركّز المدة: السندات الطويلة، وأكثر الأسهم حساسية للفائدة، والدولار مع تبدّل فوارق الفائدة، والذهب عبر قناة العائد الحقيقي. وقراءة هذه معاً هي كيف يؤكد المكتب أن حركة المنحنى تنتقل لا أنها معزولة في سوق الفائدة.',
        'وبلغة النظام، المنحنى من أبكر مدخلات نظامَي السيولة والمخاطر. فالتشدد الذي يقوده الطرف الطويل كثيراً ما يكون الحافة الأمامية لنظام يتحول إلى أقل دعماً، لذا يقرن المكتب قراءة المنحنى بشروط التمويل وعلاقة العائد الحقيقي بالذهب ليحكم على ما إذا كانت الأوضاع المالية تتشدّد فعلاً.',
      ] },
      misread: { en: [
        'The common misread is to treat a steepening or flattening label as self-explanatory. A flattening can be benign (front-end policy pricing catching up) or ominous (long-end demand signalling growth fear), and the label alone hides which — so reacting to the spread without attributing the source is a frequent error.',
        'The second error is assuming the curve forecasts recessions or rallies mechanically. The curve is an input into financial conditions, not a timing device; a desk reads what the specific move re-prices now rather than treating a shape as a deterministic prediction of the future.',
      ], ar: [
        'القراءة الخاطئة الشائعة هي معاملة تسمية التحدّب أو التسطّح بوصفها مفسِّرة لذاتها. فالتسطّح قد يكون حميداً (لحاق تسعير السياسة في الطرف القصير) أو منذراً (طلب الطرف الطويل يشير إلى خوف على النمو)، والتسمية وحدها تخفي أيّهما — فالتفاعل مع الفارق دون عزو المصدر خطأ متكرر.',
        'والخطأ الثاني افتراض أن المنحنى يتنبأ بالركود أو الصعود آلياً. فالمنحنى مدخل للأوضاع المالية لا أداة توقيت؛ ويقرأ المكتب ما تعيد الحركة المحددة تسعيره الآن بدل معاملة الشكل تنبؤاً حتمياً بالمستقبل.',
      ] },
      framework: { en: [
        'A practical framework attributes before it interprets: first locate the move (front end, long end, or both), then identify the driver (policy pricing, term premium, or supply), and only then read which assets it re-prices. The sequence prevents the headline spread from masking the mechanism.',
        'The desk then checks coherence and persistence — whether the dollar, duration-sensitive equities, and gold confirm the implied tightening or easing, and whether the move holds across sessions. A curve move that the rest of the complex confirms is treated as a genuine change in financial conditions; an isolated one is held as provisional.',
      ], ar: [
        'يعزو الإطار العملي قبل أن يفسّر: أولاً يحدد موضع الحركة (الطرف القصير أو الطويل أو كليهما)، ثم يحدد المحرّك (تسعير السياسة أو علاوة الأجل أو المعروض)، وبعدها فقط يقرأ أي الأصول تعيد تسعيرها. ويمنع هذا التسلسل الفارق المعلن من إخفاء الآلية.',
        'ثم يتحقق المكتب من الاتساق والاستمرارية — هل يؤكد الدولار والأسهم الحساسة للأجل والذهب التشدد أو التيسير الضمني، وهل تصمد الحركة عبر الجلسات. وحركة منحنى يؤكدها بقية المجمّع تُعامَل تغيّراً حقيقياً في الأوضاع المالية؛ والمعزولة تُحتفظ بها مؤقتة.',
      ] },
      visual: { en: [
        'The curve-transmission visual maps how a move at a given point on the curve propagates to the assets it re-prices — duration, carry, and term-premium channels — without attaching levels or fabricated forecasts. Its purpose is to make the location-dependence legible, showing why where the move happens matters more than the headline spread.',
        'Read it as a transmission map rather than a forecast: it depicts which channel a front-end versus a long-end move travels through, so the reader can attribute a curve change to its driver instead of reading a steepening or flattening label at face value.',
      ], ar: [
        'يرسم شكل انتقال المنحنى كيفية انتشار حركة عند نقطة معينة على المنحنى إلى الأصول التي تعيد تسعيرها — قنوات المدة والحمل وعلاوة الأجل — دون إلحاق مستويات أو تنبؤات مصطنعة. وغرضه جعل الاعتماد على الموضع مقروءاً، مُظهراً لماذا يهمّ مكان الحركة أكثر من الفارق المعلن.',
        'اقرأه خريطة انتقال لا تنبؤاً: فهو يصوّر القناة التي تسلكها حركة الطرف القصير مقابل الطويل، ليعزو القارئ تغيّر المنحنى إلى محرّكه بدل قراءة تسمية التحدّب أو التسطّح على ظاهرها.',
      ] },
    },
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

module.exports = { CONCEPT_FAMILIES, CONCEPT_LIBRARY, DEPTH_HEADINGS };
