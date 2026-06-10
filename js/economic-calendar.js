(function () {
  'use strict';

  // ── i18n ──────────────────────────────────────────────────────────────────
  var T = {
    en: {
      today: 'Today', tomorrow: 'Tomorrow', thisWeek: 'This Week', nextWeek: 'Next Week',
      allImpact: 'All Impact', allCountries: 'All Countries', search: 'Search events…',
      colTime: 'Time (Local)', colCountry: 'Country', colEvent: 'Event',
      colImpact: 'Impact', colActual: 'Actual', colForecast: 'Forecast', colPrevious: 'Previous',
      noEvents: 'No events found for this period.',
      noEventsHint: 'Try adjusting the date range or check provider status.',
      loading: 'Loading calendar…',
      high: 'High', medium: 'Medium', low: 'Low', holiday: 'Holiday',
      srcLive: 'Live data', srcCache: 'Cached data', srcDegraded: 'Provider unavailable',
      labelSrc: 'Source', labelUpdated: 'Updated',
      labelEvents: 'events', labelFetched: 'fetched', labelShown: 'shown',
      detailCountry: 'Country / Currency',
      detailActual: 'Actual', detailForecast: 'Forecast', detailPrevious: 'Previous',
      detailAssets: 'Asset sensitivity',
      detailWhat: 'What it measures', detailWhy: 'Why it matters',
      detailSurpriseAbove: 'Above forecast', detailSurpriseBelow: 'Below forecast',
      detailSurpriseInline: 'In line with forecast',
      disclaimer: 'Economic calendar information only. Not financial advice.',
      dueSoon:   'Upcoming',
      releasing: 'Live',
      released:  'Released',
      upcoming:  'Upcoming',
      live:      'Live',
      mostImportantToday: 'Most Important Today',
      filterGold:         'Gold Events',
      filterFed:          'Fed Events',
      volatilityHigh:     'High Volatility',
      volatilityMedium:   'Moderate Volatility',
      volatilityLow:      'Low Volatility',
      marketImpact:       'Expected Market Impact',
      historicalNote:     'Historical Context',
    },
    ar: {
      today: 'اليوم', tomorrow: 'غداً', thisWeek: 'هذا الأسبوع', nextWeek: 'الأسبوع القادم',
      allImpact: 'كل التأثيرات', allCountries: 'كل الدول', search: 'ابحث عن أحداث…',
      colTime: 'الوقت المحلي', colCountry: 'الدولة / العملة', colEvent: 'الحدث',
      colImpact: 'التأثير', colActual: 'الفعلي', colForecast: 'التوقع', colPrevious: 'السابق',
      noEvents: 'لا توجد أحداث لهذه الفترة.',
      noEventsHint: 'جرّب نطاقاً زمنياً مختلفاً أو تحقق من حالة المزود.',
      loading: 'جارٍ التحميل…',
      high: 'مرتفع', medium: 'متوسط', low: 'منخفض', holiday: 'عطلة',
      srcLive: 'بيانات حية', srcCache: 'بيانات مخزنة', srcDegraded: 'المزود غير متاح',
      labelSrc: 'المصدر', labelUpdated: 'آخر تحديث',
      labelEvents: 'أحداث', labelFetched: 'مجلوبة', labelShown: 'ظاهرة',
      detailCountry: 'الدولة / العملة',
      detailActual: 'الفعلي', detailForecast: 'التوقع', detailPrevious: 'السابق',
      detailAssets: 'حساسية الأصول',
      detailWhat: 'ما الذي يقيسه', detailWhy: 'لماذا يهم',
      detailSurpriseAbove: 'أعلى من التوقع', detailSurpriseBelow: 'أقل من التوقع',
      detailSurpriseInline: 'مطابق للتوقع',
      disclaimer: 'معلومات التقويم الاقتصادي فقط. لا تمثل نصيحة مالية.',
      dueSoon:   'قادم',
      releasing: 'مباشر',
      released:  'صدر',
      upcoming:  'قادم',
      live:      'مباشر',
      mostImportantToday: 'أهم أحداث اليوم',
      filterGold:         'أحداث الذهب',
      filterFed:          'أحداث الفيدرالي',
      volatilityHigh:     'تذبذب مرتفع',
      volatilityMedium:   'تذبذب متوسط',
      volatilityLow:      'تذبذب منخفض',
      marketImpact:       'التأثير المتوقع على السوق',
      historicalNote:     'السياق التاريخي',
    }
  };

  var lang  = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  var L     = T[lang];
  var isRTL = document.documentElement.dir === 'rtl';

  // ── Category descriptions (client-side, educational only) ─────────────────
  var CAT_DESC = {
    inflation:    { en: { what: 'Measures changes in the price level of consumer goods and services.', why: 'Central banks use inflation data to calibrate interest rate policy.' }, ar: { what: 'يقيس التغيرات في مستوى أسعار السلع والخدمات الاستهلاكية.', why: 'تستخدم البنوك المركزية بيانات التضخم لضبط سياسة أسعار الفائدة.' } },
    labor:        { en: { what: 'Tracks employment levels, job creation, wage growth, and unemployment.', why: 'Employment reflects the underlying health of the economy and consumer spending power.' }, ar: { what: 'يتتبع مستويات التوظيف وخلق الوظائف ونمو الأجور والبطالة.', why: 'يعكس التوظيف صحة الاقتصاد الأساسية وقدرة المستهلك على الإنفاق.' } },
    central_bank: { en: { what: 'Sets the benchmark interest rate, influencing borrowing costs across the economy.', why: 'Rate decisions signal the future direction of monetary policy — among the highest-impact events in global markets.' }, ar: { what: 'يحدد المعدل المرجعي للاقتصاد، ويؤثر على تكاليف الاقتراض.', why: 'تشير قرارات الأسعار إلى الاتجاه المستقبلي للسياسة النقدية — من أعلى الأحداث تأثيراً في الأسواق.' } },
    growth:       { en: { what: 'Measures total economic output (Gross Domestic Product).', why: 'GDP growth signals overall economic health and influences corporate earnings expectations.' }, ar: { what: 'يقيس إجمالي الناتج الاقتصادي (الناتج المحلي الإجمالي).', why: 'يشير نمو الناتج إلى الصحة الاقتصادية ويؤثر على توقعات أرباح الشركات.' } },
    consumption:  { en: { what: 'Tracks household spending on goods and services.', why: 'Consumer spending drives a large portion of economic output in developed economies.' }, ar: { what: 'يتتبع إنفاق الأسر على السلع والخدمات.', why: 'الإنفاق الاستهلاكي يحرّك جزءاً كبيراً من الناتج الاقتصادي في الدول المتقدمة.' } },
    pmi:          { en: { what: 'Purchasing Managers\' Index surveys business conditions. A reading above 50 indicates expansion.', why: 'PMI is a leading indicator for GDP growth, employment, and corporate earnings.' }, ar: { what: 'يستطلع مؤشر مديري المشتريات الأوضاع التجارية. قراءة فوق 50 = توسع.', why: 'مؤشر مديري المشتريات مؤشر قيادي للنمو والتوظيف وأرباح الشركات.' } },
    housing:      { en: { what: 'Tracks construction starts, building permits, home sales, and prices.', why: 'Housing reflects interest rate sensitivity and consumer credit conditions.' }, ar: { what: 'يتتبع مبادرات البناء وتصاريح البناء ومبيعات المنازل والأسعار.', why: 'يعكس الإسكان حساسية أسعار الفائدة وأوضاع ائتمان المستهلك.' } },
    trade:        { en: { what: 'Measures the difference between a country\'s exports and imports.', why: 'Trade balances reflect international competitiveness and can influence currency valuations.' }, ar: { what: 'يقيس الفرق بين صادرات الدولة وواردتها.', why: 'يعكس التوازن التجاري القدرة التنافسية الدولية ويؤثر على تقييمات العملات.' } },
    energy:       { en: { what: 'Tracks oil inventories, production levels, and related commodity metrics.', why: 'Energy prices affect production costs across industries and influence inflation readings.' }, ar: { what: 'يتتبع مخزونات النفط ومستويات الإنتاج والمقاييس ذات الصلة.', why: 'أسعار الطاقة تؤثر على تكاليف الإنتاج في جميع الصناعات وعلى التضخم.' } },
    treasury:     { en: { what: 'Auctions of government debt securities to market participants.', why: 'Auction results signal market appetite for government debt and influence benchmark yields.' }, ar: { what: 'مزادات أوراق الدين الحكومية لمشاركي السوق.', why: 'تشير نتائج المزادات إلى شهية السوق للديون الحكومية وتؤثر على عوائد المؤشرات.' } },
    holiday:      { en: { what: 'A market holiday — financial markets may be closed or operating with reduced liquidity.', why: 'Market closures affect liquidity and volume across all asset classes.' }, ar: { what: 'عطلة سوق — قد تكون الأسواق مغلقة أو تعمل بسيولة منخفضة.', why: 'إغلاقات السوق تؤثر على السيولة وحجم التداول في جميع فئات الأصول.' } },
    other:        { en: { what: 'Economic data relevant to the current macroeconomic environment.', why: 'Economic releases contribute to the overall picture of economic health and policy expectations.' }, ar: { what: 'بيانات اقتصادية ذات صلة بالبيئة الاقتصادية الكلية.', why: 'تساهم الإصدارات في الصورة الشاملة للصحة الاقتصادية وتوقعات السياسة.' } },
  };

  // ── Market intelligence lookup table ──────────────────────────────────────
  // Each entry maps event name patterns to asset tags, volatility, Fed/gold flags,
  // and bilingual interpretation + historical context text.
  var EVENT_INTEL_MAP = [
    {
      p: /\bnonfarm\s*payrolls?\b|\bnfp\b/i,
      assets: ['USD', 'Gold', 'S&P500', 'Nasdaq'], volatility: 'high', fed: false, gold: true,
      impact: {
        en: 'NFP is the most market-moving US labor report. Strong payrolls typically lift USD and equities while pressuring gold. Watch wage growth — elevated wages alongside strong jobs signal sticky inflation.',
        ar: 'تقرير الرواتب غير الزراعية هو أكثر تقارير العمل تأثيراً. الأرقام القوية ترفع الدولار والأسهم وتضغط على الذهب. نمو الأجور مؤشر ثانوي مهم للتضخم.'
      },
      history: {
        en: 'Historically, NFP beats above +100K vs forecast trigger 0.5%+ USD moves. Gold often inverts the USD reaction within 30 minutes as traders reprice Fed rate expectations.',
        ar: 'تاريخياً، تجاوز التوقعات بأكثر من 100 ألف وظيفة يحرّك الدولار أكثر من 0.5%. غالباً ما يعكس الذهب الحركة خلال 30 دقيقة مع إعادة تسعير توقعات الفائدة.'
      }
    },
    {
      p: /\bfomc\b|\bfederal\s+open\s+market\b/i,
      assets: ['USD', 'Gold', 'Bonds', 'S&P500', 'Nasdaq'], volatility: 'high', fed: true, gold: true,
      impact: {
        en: 'FOMC decisions are the single highest-impact macro event. Rate hikes strengthen USD and bond yields, pressuring gold and growth equities. Rate cuts or dovish signals lift gold and risk assets significantly.',
        ar: 'قرارات FOMC هي الأعلى تأثيراً. رفع الفائدة يقوي الدولار ويضغط على الذهب والأسهم النامية. التخفيض أو الإشارات المرنة تدعم الذهب وأصول الخطر.'
      },
      history: {
        en: 'FOMC decisions historically move gold ±1–3% intraday. Surprise rate hikes (above consensus) produce the sharpest gold selloffs. Post-statement press conferences often reverse initial market moves.',
        ar: 'تاريخياً، تحرّك قرارات FOMC الذهب ±1-3% خلال الجلسة. رفع الفائدة فوق التوقعات ينتج أشد موجات بيع الذهب. مؤتمرات الصحافة اللاحقة كثيراً ما تعكس الحركات الأولية.'
      }
    },
    {
      p: /\bconsumer\s+price\s+index\b|\bcpi\b/i,
      assets: ['USD', 'Gold', 'Bonds', 'S&P500', 'Nasdaq'], volatility: 'high', fed: false, gold: true,
      impact: {
        en: 'CPI directly drives Fed rate expectations. Hotter-than-expected inflation typically rallies gold and bond yields while pressuring rate-sensitive growth stocks. Surprise beats cause sharp multi-asset repricing within minutes.',
        ar: 'مؤشر أسعار المستهلك يقود مباشرة توقعات الفائدة. التضخم الأعلى من المتوقع يدعم الذهب ويضغط على الأسهم النامية.'
      },
      history: {
        en: 'Since 2021, CPI beats above +0.2% MoM vs forecast triggered average gold moves of +0.8% within 2 hours. Core CPI (ex food & energy) is the more Fed-sensitive component.',
        ar: 'منذ 2021، أدت تجاوزات CPI فوق +0.2% شهرياً إلى تحريك الذهب بمعدل +0.8% خلال ساعتين. المؤشر الأساسي (باستثناء الغذاء والطاقة) هو الأكثر حساسية للاحتياطي الفيدرالي.'
      }
    },
    {
      p: /\bpce\b|\bpersonal\s+consumption\s+expenditures?\b/i,
      assets: ['USD', 'Gold', 'Bonds'], volatility: 'high', fed: true, gold: true,
      impact: {
        en: "PCE is the Fed's preferred inflation gauge. Core PCE surprises move Fed rate expectations most directly. A hot PCE print can revive rate-hike fears, pressuring bonds and gold.",
        ar: 'نفقات الاستهلاك الشخصي هي المقياس المفضل للاحتياطي الفيدرالي للتضخم. المفاجآت تؤثر مباشرة على توقعات الفائدة.'
      },
      history: {
        en: 'Core PCE tends to move markets less dramatically than CPI due to its methodological lag, but it is the definitive Fed policy input. Post-PCE Fed communications are often more market-moving than the data itself.',
        ar: 'يحرّك مؤشر نفقات الاستهلاك الأساسية الأسواق بشكل أقل من CPI، لكنه المدخل الحاسم لسياسة الاحتياطي الفيدرالي.'
      }
    },
    {
      p: /\bproducer\s+price\s+index\b|\bppi\b/i,
      assets: ['USD', 'Bonds'], volatility: 'medium', fed: false, gold: false,
      impact: {
        en: 'PPI measures upstream inflation at the producer level, acting as a leading indicator for future CPI. A PPI beat signals potential consumer price pressure ahead, supporting rate-hold expectations.',
        ar: 'مؤشر أسعار المنتجين يقيس التضخم عند مستوى الإنتاج وهو مؤشر قيادي لمؤشر أسعار المستهلكين المستقبلي.'
      },
      history: null
    },
    {
      p: /\bgross\s+domestic\s+product\b|\bgdp\b/i,
      assets: ['USD', 'S&P500', 'Nasdaq'], volatility: 'high', fed: false, gold: false,
      impact: {
        en: 'GDP gauges total economic output. Stronger-than-expected growth lifts USD and equities on improved earnings visibility. Weak GDP raises recession fears and typically boosts gold as a safe-haven alternative.',
        ar: 'الناتج المحلي الإجمالي يقيس إجمالي الإنتاج. النمو الأقوى من المتوقع يرفع الدولار والأسهم. الضعف يثير مخاوف الركود ويدعم الذهب ملاذاً آمناً.'
      },
      history: null
    },
    {
      p: /\binitial\s+jobless\s+claims?\b|\bjobless\s+claims?\b/i,
      assets: ['USD', 'S&P500'], volatility: 'medium', fed: false, gold: false,
      impact: {
        en: 'Weekly jobless claims are the highest-frequency US labor market indicator. Elevated claims signal labor softening — typically USD-negative and can prompt modest safe-haven gold demand if trend persists.',
        ar: 'طلبات إعانة البطالة الأسبوعية هي أعلى مؤشرات سوق العمل الأمريكية تكراراً. ارتفاعها يضغط على الدولار ويمكن أن يحفز الطلب على الذهب.'
      },
      history: null
    },
    {
      p: /\bism\b|\bpurchasing\s+managers/i,
      assets: ['USD', 'S&P500', 'Nasdaq'], volatility: 'medium', fed: false, gold: false,
      impact: {
        en: 'PMI/ISM surveys proxy near-term economic momentum. Readings above 50 signal expansion, supporting USD and risk assets. Below 50 signals contraction — watch for recession narrative building if sustained.',
        ar: 'مسوح PMI/ISM تعكس الزخم الاقتصادي قصير الأجل. فوق 50 = توسع يدعم الدولار، تحت 50 = انكماش.'
      },
      history: null
    },
    {
      p: /\bretail\s+sales\b/i,
      assets: ['USD', 'S&P500'], volatility: 'medium', fed: false, gold: false,
      impact: {
        en: 'Retail sales directly measures consumer spending power, the largest component of US GDP. A beat signals economic resilience, supporting USD and consumer-sector equities.',
        ar: 'مبيعات التجزئة تقيس مباشرة قدرة الإنفاق الاستهلاكي، أكبر مكونات الناتج المحلي الإجمالي الأمريكي.'
      },
      history: null
    },
    {
      p: /\bdurable\s+goods\s+orders?\b/i,
      assets: ['USD', 'S&P500', 'Nasdaq'], volatility: 'medium', fed: false, gold: false,
      impact: {
        en: 'Durable goods orders reflect business capital investment intentions. Strong data signals corporate confidence and can boost industrial and technology equity sectors.',
        ar: 'طلبات السلع المعمّرة تعكس نوايا الاستثمار التجاري. البيانات القوية تدل على ثقة الشركات وتعزز قطاعات التصنيع والتكنولوجيا.'
      },
      history: null
    },
    {
      p: /\btrade\s+balance\b|\bbalance\s+of\s+trade\b/i,
      assets: ['USD'], volatility: 'low', fed: false, gold: false,
      impact: {
        en: 'Trade balance measures the export/import differential. A widening deficit is typically USD-negative as it reflects higher demand for foreign currencies to finance imports.',
        ar: 'الميزان التجاري يقيس الفرق بين الصادرات والواردات. العجز المتسع يضغط على الدولار.'
      },
      history: null
    },
    {
      p: /\bhousing\s+starts?\b|\bbuilding\s+permits?\b|\bhome\s+sales?\b|\bnew\s+home\s+sales?\b/i,
      assets: ['S&P500'], volatility: 'low', fed: false, gold: false,
      impact: {
        en: 'Housing data reflects the interest-rate-sensitive real estate sector. Persistent weakness signals that higher rates are cooling the economy and may support rate-cut expectations.',
        ar: 'بيانات الإسكان تعكس حساسية قطاع العقارات لأسعار الفائدة. الضعف المستمر قد يدعم توقعات خفض الفائدة.'
      },
      history: null
    },
    {
      p: /\bfed\s+(?:chair|minutes|speak|speech|member|governor|president|statement)\b|\bbeige\s+book\b/i,
      assets: ['USD', 'Gold', 'Bonds'], volatility: 'medium', fed: true, gold: true,
      impact: {
        en: 'Fed communications shape forward rate expectations. Hawkish language ("higher for longer", "not yet confident") typically pressures gold; dovish signals ("cuts appropriate", "inflation near target") support gold.',
        ar: 'تصريحات الاحتياطي الفيدرالي تشكّل توقعات الفائدة المستقبلية. اللغة المتشددة تضغط على الذهب؛ الإشارات المرنة تدعمه.'
      },
      history: null
    },
    {
      p: /\binterest\s+rate\s+decision\b|\brate\s+decision\b/i,
      assets: ['USD', 'Gold', 'Bonds', 'S&P500', 'Nasdaq'], volatility: 'high', fed: true, gold: true,
      impact: {
        en: 'Central bank rate decisions are the highest-impact single events. Unexpected rate changes cause sharp multi-asset repricing across currencies, bonds, and commodities within seconds.',
        ar: 'قرارات البنوك المركزية بشأن أسعار الفائدة من أعلى الأحداث تأثيراً. التغييرات غير المتوقعة تعيد تسعير الأسواق بحدة خلال ثوانٍ.'
      },
      history: null
    },
    {
      p: /\bunemployment\s+rate\b/i,
      assets: ['USD', 'S&P500'], volatility: 'medium', fed: false, gold: false,
      impact: {
        en: 'Unemployment rate is a lagging labor market indicator. Rising unemployment can trigger safe-haven flows into gold and bonds while weighing on growth equities and USD.',
        ar: 'معدل البطالة مؤشر متأخر لسوق العمل. ارتفاعه يحفّز تدفقات الملاذ الآمن نحو الذهب والسندات.'
      },
      history: null
    },
    {
      p: /\bconsumer\s+confidence\b|\bconsumer\s+sentiment\b|\bumich\b|\buniversity\s+of\s+michigan/i,
      assets: ['USD', 'S&P500'], volatility: 'low', fed: false, gold: false,
      impact: {
        en: 'Consumer confidence surveys measure household spending expectations. Low confidence signals upcoming economic weakness and mild risk-off pressure on equities.',
        ar: 'استطلاعات ثقة المستهلك تعكس توقعات الإنفاق. انخفاض الثقة يشير إلى ضعف اقتصادي محتمل وضغط خفيف على الأسهم.'
      },
      history: null
    },
    {
      p: /\bcrude\s+oil\b|\beia\s+crude\b|\bpetroleum\s+inventories?\b/i,
      assets: ['Gold', 'S&P500'], volatility: 'medium', fed: false, gold: false,
      impact: {
        en: 'Oil inventory data affects energy prices and broader inflation expectations. Large inventory builds can weigh on oil prices and indirectly affect gold via the inflation channel.',
        ar: 'بيانات مخزون النفط تؤثر على أسعار الطاقة وتوقعات التضخم. ارتفاع المخزونات يضغط على أسعار النفط ويؤثر على الذهب عبر قناة التضخم.'
      },
      history: null
    },
  ];

  // ── DOM refs ──────────────────────────────────────────────────────────────
  var elPrev          = document.getElementById('ec-prev');
  var elNext          = document.getElementById('ec-next');
  var elToday         = document.getElementById('ec-today');
  var elTomorrow      = document.getElementById('ec-tomorrow');
  var elWeek          = document.getElementById('ec-week');
  var elNextWeek      = document.getElementById('ec-next-week');
  var elRefresh       = document.getElementById('ec-refresh');
  var elDatePicker    = document.getElementById('ec-date-picker');
  var elFilterImpact  = document.getElementById('ec-filter-impact');
  var elFilterCountry = document.getElementById('ec-filter-country');
  var elSearch        = document.getElementById('ec-search');
  var elTableWrap     = document.getElementById('ec-table-wrap');
  var elStatus        = document.getElementById('ec-status');

  if (!elTableWrap) return;

  // ── State ─────────────────────────────────────────────────────────────────
  var allEvents     = [];
  var calMeta       = {};
  var selectedDate  = todayStr();
  var viewMode      = 'day';
  var filterImpact  = '';
  var filterCountry = '';
  var searchText    = '';
  var filterGold    = false;
  var filterFed     = false;

  // Request lifecycle — latest-request-wins with AbortController
  var activeController = null;
  var requestSeq       = 0;

  // Refresh intervals
  var REFRESH_NORMAL_MS = 5 * 60 * 1000;
  var REFRESH_ACTIVE_MS = 30 * 1000;
  var REFRESH_WINDOW_MS = 30 * 60 * 1000;
  var refreshTimer      = null;
  var countdownTimer    = null;

  // Enable production diagnostics by appending ?ec_debug to the URL
  var EC_DEBUG = typeof window !== 'undefined' && window.location &&
                 window.location.search.indexOf('ec_debug') !== -1;

  // ── Date utilities ────────────────────────────────────────────────────────
  function todayStr() { return new Date().toISOString().slice(0, 10); }

  function addDays(d, n) {
    var dt = new Date(d + 'T00:00:00Z');
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }

  function weekStart(d) {
    var dt = new Date(d + 'T00:00:00Z');
    dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
    return dt.toISOString().slice(0, 10);
  }

  function weekEnd(d) { return addDays(weekStart(d), 6); }

  function eventDate(e) {
    var raw = String(e.event_time || e.date || '');
    return raw.length >= 10 ? raw.slice(0, 10) : '';
  }

  function fmtTime(dtStr) {
    if (!dtStr) return '—';
    try {
      if (/T00:00:00Z$/.test(dtStr)) return '—';
      var d = new Date(dtStr);
      if (isNaN(d.valueOf())) return String(dtStr).slice(11, 16);
      return d.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch (_) { return String(dtStr).slice(11, 16); }
  }

  function fmtDateLabel(d) {
    try {
      return new Date(d + 'T12:00:00Z').toLocaleDateString(
        lang === 'ar' ? 'ar-SA' : 'en-US',
        { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }
      );
    } catch (_) { return d; }
  }

  function fmtDateGroupLabel(d) {
    try {
      return new Date(d + 'T12:00:00Z').toLocaleDateString(
        lang === 'ar' ? 'ar-SA' : 'en-US',
        { weekday: 'long', month: 'long', day: 'numeric' }
      );
    } catch (_) { return d; }
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function numVal(n, unit) {
    if (n === null || n === undefined || n === '') return '—';
    return esc(String(n)) + (unit ? ' ' + esc(unit) : '');
  }

  // ── Country / currency ────────────────────────────────────────────────────
  var CCY = { US: 'USD', EU: 'EUR', GB: 'GBP', JP: 'JPY', CN: 'CNY', DE: 'EUR',
              FR: 'EUR', IT: 'EUR', CA: 'CAD', AU: 'AUD', NZ: 'NZD', CH: 'CHF' };

  function countryCurrency(country) {
    var c   = String(country || '').toUpperCase();
    var ccy = CCY[c];
    return ccy ? c + ' \xB7 ' + ccy : (c || '—');
  }

  // ── Arabic event name translations ────────────────────────────────────────
  var AR_EVENTS = [
    { p: /\bunemployment\s+rate\b/i,               ar: 'معدل البطالة' },
    { p: /\binflation\s+rate\s+mom\b/i,            ar: 'معدل التضخم الشهري' },
    { p: /\binflation\s+rate\s+yoy\b/i,            ar: 'معدل التضخم السنوي' },
    { p: /\binflation\s+rate\b/i,                  ar: 'معدل التضخم' },
    { p: /\bconsumer\s+confidence\b/i,             ar: 'ثقة المستهلك' },
    { p: /\bbusiness\s+confidence\b/i,             ar: 'ثقة الأعمال' },
    { p: /\bconstruction\s+pmi\b/i,                ar: 'مؤشر مديري مشتريات البناء' },
    { p: /\bservices?\s+pmi\b/i,                   ar: 'مؤشر مديري مشتريات الخدمات' },
    { p: /\bmanufacturing\s+pmi\b/i,               ar: 'مؤشر مديري مشتريات التصنيع' },
    { p: /\bbalance\s+of\s+trade\b/i,              ar: 'الميزان التجاري' },
    { p: /\btrade\s+balance\b/i,                   ar: 'الميزان التجاري' },
    { p: /\bexports?\b/i,                          ar: 'الصادرات' },
    { p: /\bimports?\b/i,                          ar: 'الواردات' },
    { p: /\bexisting\s+home\s+sales\b/i,           ar: 'مبيعات المنازل القائمة' },
    { p: /\bfed\s+(?:chair(?:man)?)\s+speech\b/i, ar: 'خطاب رئيس الاحتياطي الفيدرالي' },
    { p: /\bfed\s+speech\b/i,                      ar: 'خطاب الاحتياطي الفيدرالي' },
    { p: /\binitial\s+jobless\s+claims\b/i,        ar: 'طلبات إعانة البطالة الأولية' },
    { p: /\bjobless\s+claims\b/i,                  ar: 'طلبات إعانة البطالة' },
    { p: /\bcore\s+cpi\b/i,                        ar: 'مؤشر أسعار المستهلك الأساسي' },
    { p: /\bcpi\b/i,                               ar: 'مؤشر أسعار المستهلك' },
    { p: /\bgdp\b/i,                               ar: 'الناتج المحلي الإجمالي' },
    { p: /\bretail\s+sales\b/i,                    ar: 'مبيعات التجزئة' },
    { p: /\bcore\s+pce\b/i,                        ar: 'نفقات الاستهلاك الشخصي الأساسية' },
    { p: /\bpce\b/i,                               ar: 'نفقات الاستهلاك الشخصي' },
    { p: /\binterest\s+rate\s+decision\b/i,        ar: 'قرار أسعار الفائدة' },
    { p: /\bfomc\b/i,                              ar: 'لجنة السوق المفتوحة الفيدرالية' },
    { p: /\bnonfarm\s+payrolls?\b/i,               ar: 'الرواتب غير الزراعية' },
  ];

  function translateEventName(name, locale) {
    if (locale !== 'ar') return name;
    var s = String(name || '');
    for (var i = 0; i < AR_EVENTS.length; i++) {
      if (AR_EVENTS[i].p.test(s)) return AR_EVENTS[i].ar;
    }
    return s;
  }

  // ── Freshness status ──────────────────────────────────────────────────────
  // Returns: 'due-soon' | 'releasing' | 'released' | null
  // 'upcoming' (far future) intentionally returns null — handled by upcomingBadgeHtml.
  function freshnessStatus(e) {
    if (!e.event_time || e.importance === 'holiday') return null;
    var t = Date.parse(e.event_time);
    if (isNaN(t)) return null;
    var diff = t - Date.now(); // positive = future, negative = past
    var hasActual = e.actual !== null && e.actual !== undefined;
    if (hasActual) return 'released';
    if (diff > 0 && diff <= REFRESH_WINDOW_MS) return 'due-soon';
    if (diff <= 0 && diff > -REFRESH_WINDOW_MS) return 'releasing';
    return null;
  }

  function freshnessHtml(e) {
    var s = freshnessStatus(e);
    if (!s) return '';
    var label = L[s === 'due-soon' ? 'dueSoon' : s] || s;
    return '<span class="ec-freshness ec-freshness-' + s + '" aria-label="' + esc(label) + '">'
         + esc(label) + '</span>';
  }

  // ── Market intelligence helpers ───────────────────────────────────────────
  function getEventIntelEntry(e) {
    var name = String(e.event_name || '');
    for (var i = 0; i < EVENT_INTEL_MAP.length; i++) {
      if (EVENT_INTEL_MAP[i].p.test(name)) return EVENT_INTEL_MAP[i];
    }
    return null;
  }

  function getAssetTags(e) {
    if (e.importance === 'holiday') return [];
    if (Array.isArray(e.historical_asset_sensitivity) && e.historical_asset_sensitivity.length) {
      return e.historical_asset_sensitivity;
    }
    if (e.intelligence && Array.isArray(e.intelligence.market_sensitivity) && e.intelligence.market_sensitivity.length) {
      return e.intelligence.market_sensitivity;
    }
    var entry = getEventIntelEntry(e);
    return entry ? entry.assets.slice() : [];
  }

  function getVolatilityLabel(e) {
    if (e.importance === 'holiday') return null;
    var entry = getEventIntelEntry(e);
    if (entry) return entry.volatility;
    if (e.importance === 'high')   return 'high';
    if (e.importance === 'medium') return 'medium';
    if (e.importance === 'low')    return 'low';
    return null;
  }

  function getVolatilityHtml(e) {
    var v = getVolatilityLabel(e);
    if (!v) return '';
    var label = v === 'high'   ? L.volatilityHigh
              : v === 'medium' ? L.volatilityMedium
              : L.volatilityLow;
    return '<span class="ec-volatility ec-volatility-' + v + '">' + esc(label) + '</span>';
  }

  function getMarketInterpretation(e) {
    if (e.importance === 'holiday') return '';
    var entry = getEventIntelEntry(e);
    if (!entry || !entry.impact) return '';
    return (entry.impact[lang] || entry.impact.en) || '';
  }

  function getHistoricalNote(e) {
    if (e.importance === 'holiday') return '';
    var entry = getEventIntelEntry(e);
    if (!entry || !entry.history) return '';
    return (entry.history[lang] || entry.history.en) || '';
  }

  function isFedEvent(e) {
    if (e.country && String(e.country).toUpperCase() !== 'US') return false;
    var entry = getEventIntelEntry(e);
    if (entry) return !!entry.fed;
    var name = String(e.event_name || '').toLowerCase();
    return /\bfed\b|\bfomc\b|\bfederal\s+reserve\b|\bbeige\s+book\b/.test(name);
  }

  function isGoldEvent(e) {
    var entry = getEventIntelEntry(e);
    if (entry) return !!entry.gold;
    return getAssetTags(e).indexOf('Gold') !== -1;
  }

  // ── Release state badge (broader than freshness — covers all today events) ─
  function upcomingBadgeHtml(e) {
    // Show "Upcoming" for today's high/medium future events beyond the ±30min freshness window
    if (freshnessStatus(e) !== null) return ''; // already has a badge
    if (!e.event_time || e.importance === 'holiday') return '';
    var t = Date.parse(e.event_time);
    if (isNaN(t)) return '';
    var diff = t - Date.now();
    if (diff <= 0) return '';
    if (e.importance !== 'high' && e.importance !== 'medium') return '';
    if (eventDate(e) !== todayStr()) return '';
    return '<span class="ec-release-state ec-release-upcoming">' + esc(L.upcoming || 'Upcoming') + '</span>';
  }

  // ── Pre-release countdown timer ───────────────────────────────────────────
  function countdownHtml(e) {
    if (!e.event_time || e.importance === 'holiday') return '';
    var t = Date.parse(e.event_time);
    if (isNaN(t)) return '';
    var diff = t - Date.now();
    if (diff <= 0) return '';
    var hasActual = e.actual !== null && e.actual !== undefined;
    if (hasActual) return '';
    if (eventDate(e) !== todayStr()) return ''; // only countdown for today's events
    var h = Math.floor(diff / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    var txt = h > 0 ? h + 'h ' + m + 'm' : m > 0 ? m + 'm ' + s + 's' : s + 's';
    // data-target enables live 1-second ticking for near events
    var dataAttr = diff <= REFRESH_WINDOW_MS ? ' data-target="' + t + '"' : '';
    return '<span class="ec-countdown"' + dataAttr + '>' + esc(txt) + '</span>';
  }

  function startCountdownTicker() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    var els = typeof document !== 'undefined' ? document.querySelectorAll('.ec-countdown[data-target]') : [];
    if (!els.length) return;
    countdownTimer = setInterval(function () {
      var targets = document.querySelectorAll('.ec-countdown[data-target]');
      var anyLeft = false;
      targets.forEach(function (el) {
        var ts   = parseInt(el.getAttribute('data-target'), 10);
        var diff = ts - Date.now();
        if (diff <= 0) {
          el.textContent = L.live || 'Live';
          el.className   = 'ec-freshness ec-freshness-releasing';
          el.removeAttribute('data-target');
          return;
        }
        anyLeft = true;
        var m = Math.floor(diff / 60000);
        var s = Math.floor((diff % 60000) / 1000);
        el.textContent = m > 0 ? m + 'm ' + s + 's' : s + 's';
      });
      if (!anyLeft) { clearInterval(countdownTimer); countdownTimer = null; }
    }, 1000);
  }

  // ── Most Important Today section ──────────────────────────────────────────
  function renderTopEvents() {
    if (viewMode !== 'day' || selectedDate !== todayStr()) return '';
    var today = todayStr();
    var topEvents = allEvents.filter(function (e) {
      return e.importance === 'high' && eventDate(e) === today;
    });
    if (!topEvents.length) {
      topEvents = allEvents.filter(function (e) {
        return e.importance === 'medium' && eventDate(e) === today;
      }).slice(0, 3);
    }
    if (!topEvents.length) return '';

    var cards = topEvents.map(function (e) {
      var assets = getAssetTags(e);
      var tagHtml = assets.map(function (a) {
        return '<span class="ec-asset-tag">' + esc(a) + '</span>';
      }).join('');
      var interpretation = getMarketInterpretation(e);
      var fs    = freshnessStatus(e);
      var badge = fs ? freshnessHtml(e) : upcomingBadgeHtml(e);
      var cdHtml = countdownHtml(e);
      return (
        '<div class="ec-top-event-card">' +
          '<div class="ec-top-event-header">' +
            '<span class="ec-top-event-name">' + esc(translateEventName(e.event_name || '—', lang)) + '</span>' +
            badge +
          '</div>' +
          '<div class="ec-top-event-meta">' +
            badgeHtml(e.importance) +
            getVolatilityHtml(e) +
          '</div>' +
          '<div class="ec-top-event-time">' +
            esc(fmtTime(e.event_time)) +
            (cdHtml ? ' · ' + cdHtml : '') +
          '</div>' +
          (tagHtml ? '<div class="ec-top-event-assets">' + tagHtml + '</div>' : '') +
          (interpretation ? '<p class="ec-top-event-impact">' + esc(interpretation) + '</p>' : '') +
        '</div>'
      );
    }).join('');

    return (
      '<div class="ec-top-events">' +
        '<div class="ec-top-events-title">' + esc(L.mostImportantToday) + '</div>' +
        '<div class="ec-top-events-list">' + cards + '</div>' +
      '</div>'
    );
  }

  // ── Filtering ─────────────────────────────────────────────────────────────
  function eventsForPeriod() {
    var from, to;
    if (viewMode === 'week') { from = weekStart(selectedDate); to = weekEnd(selectedDate); }
    else { from = to = selectedDate; }

    if (EC_DEBUG) {
      console.log('[ec] filter — mode:', viewMode, 'date:', selectedDate,
                  'from:', from, 'to:', to, 'pool:', allEvents.length);
    }

    return allEvents.filter(function (e) {
      var d = eventDate(e);
      if (!d) return false;
      if (d < from || d > to) return false;
      if (filterImpact  && e.importance !== filterImpact)  return false;
      if (filterCountry && e.country    !== filterCountry) return false;
      if (filterGold && !isGoldEvent(e)) return false;
      if (filterFed  && !isFedEvent(e))  return false;
      if (searchText) {
        var nm = String(e.event_name || '').toLowerCase();
        if (nm.indexOf(searchText.toLowerCase()) === -1) return false;
      }
      return true;
    });
  }

  // ── Country dropdown ──────────────────────────────────────────────────────
  function populateCountries() {
    if (!elFilterCountry) return;
    var seen = {};
    allEvents.forEach(function (e) { if (e.country) seen[e.country] = true; });
    var countries = Object.keys(seen).sort();
    while (elFilterCountry.options.length > 1) elFilterCountry.remove(1);
    countries.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c;
      elFilterCountry.appendChild(o);
    });
  }

  // ── Impact badge ──────────────────────────────────────────────────────────
  function badgeHtml(imp) {
    var cls = imp === 'high'    ? 'ec-badge-high'
            : imp === 'medium'  ? 'ec-badge-medium'
            : imp === 'low'     ? 'ec-badge-low'
            : imp === 'holiday' ? 'ec-badge-holiday'
            : 'ec-badge-low';
    return '<span class="ec-badge ' + cls + '">' + esc(L[imp] || imp || '') + '</span>';
  }

  // ── Intelligence panel ────────────────────────────────────────────────────
  function intelligenceHtml(e) {
    try {
      var intel = e.intelligence;
      if (!intel || !intel.category) return '';
      if (e.importance === 'holiday') return '';
      var catKey  = intel.category;
      var catData = CAT_DESC[catKey] || CAT_DESC.other;
      var desc    = catData[lang] || catData.en;
      var html    = '';
      if (desc.what) html += '<dt>' + esc(L.detailWhat) + '</dt><dd>' + esc(desc.what) + '</dd>';
      if (desc.why)  html += '<dt>' + esc(L.detailWhy)  + '</dt><dd>' + esc(desc.why)  + '</dd>';
      var sur         = intel.surprise;
      var hasForecast = e.forecast !== null && e.forecast !== undefined;
      if (sur && sur.available && hasForecast && sur.direction !== 'unknown') {
        var sLabel = sur.direction === 'above' ? L.detailSurpriseAbove
                   : sur.direction === 'below' ? L.detailSurpriseBelow
                   : L.detailSurpriseInline;
        var sCls   = sur.direction === 'above' ? 'ec-surprise-hot'
                   : sur.direction === 'below' ? 'ec-surprise-soft'
                   : 'ec-surprise-inline';
        html += '<dt>Surprise</dt><dd class="' + sCls + '">' + esc(sLabel) +
                ' <small>(' + esc(sur.magnitude || '') + ')</small></dd>';
      }
      if (!html) return '';
      return '<div class="ec-detail-intelligence"><dl>' + html + '</dl></div>';
    } catch (_) { return ''; }
  }

  // ── Detail panel content ──────────────────────────────────────────────────
  function detailContent(e) {
    try {
      var isHoliday = e.importance === 'holiday';
      var assets = getAssetTags(e);
      var tags = assets.map(function (a) {
        return '<span class="ec-asset-tag">' + esc(a) + '</span>';
      }).join('');
      var html = '<dt>' + esc(L.detailCountry)  + '</dt><dd>' + esc(countryCurrency(e.country)) + '</dd>';
      html    += '<dt>' + esc(L.detailActual)    + '</dt><dd>' + (isHoliday ? '—' : numVal(e.actual,   e.unit)) + '</dd>';
      html    += '<dt>' + esc(L.detailForecast)  + '</dt><dd>' + (isHoliday ? '—' : numVal(e.forecast, e.unit)) + '</dd>';
      html    += '<dt>' + esc(L.detailPrevious)  + '</dt><dd>' + (isHoliday ? '—' : numVal(e.previous, e.unit)) + '</dd>';
      var out = '<dl>' + html + '</dl>';
      out += intelligenceHtml(e);
      if (tags && !isHoliday) {
        out += '<div class="ec-detail-assets">'
            +  '<dt>' + esc(L.detailAssets) + '</dt>'
            +  '<div class="ec-asset-tags">' + tags + '</div>'
            +  '</div>';
      }
      var interpretation = !isHoliday ? getMarketInterpretation(e) : '';
      var historicalNote = !isHoliday ? getHistoricalNote(e) : '';
      if (interpretation) {
        out += '<div class="ec-detail-interpretation">'
            +  '<dt>' + esc(L.marketImpact) + '</dt>'
            +  '<dd class="ec-interpretation-text">' + esc(interpretation) + '</dd>'
            +  '</div>';
      }
      if (historicalNote) {
        out += '<div class="ec-detail-history">'
            +  '<dt>' + esc(L.historicalNote) + '</dt>'
            +  '<dd class="ec-history-text">' + esc(historicalNote) + '</dd>'
            +  '</div>';
      }
      out += '<p class="ec-detail-disclaimer">' + esc(L.disclaimer) + '</p>';
      return out;
    } catch (_) { return '<p class="ec-detail-disclaimer">' + esc(L.disclaimer) + '</p>'; }
  }

  // ── Date grouping ─────────────────────────────────────────────────────────
  function groupByDate(events) {
    var groups  = [];
    var lastKey = null;
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      var d;
      try { d = eventDate(e) || 'unknown'; } catch (_) { d = 'unknown'; }
      if (d !== lastKey) { groups.push({ date: d, events: [] }); lastKey = d; }
      groups[groups.length - 1].events.push(e);
    }
    return groups;
  }

  // ── Table build ───────────────────────────────────────────────────────────
  function buildTable(events) {
    var cols = 7;
    var ths;
    if (isRTL) {
      ths = '<th>' + L.colPrevious + '</th><th>' + L.colForecast + '</th>' +
            '<th>' + L.colActual   + '</th><th>' + L.colImpact   + '</th>' +
            '<th>' + L.colEvent    + '</th><th>' + L.colCountry  + '</th>' +
            '<th>' + L.colTime     + '</th>';
    } else {
      ths = '<th>' + L.colTime     + '</th><th>' + L.colCountry  + '</th>' +
            '<th>' + L.colEvent    + '</th><th>' + L.colImpact   + '</th>' +
            '<th>' + L.colActual   + '</th><th>' + L.colForecast + '</th>' +
            '<th>' + L.colPrevious + '</th>';
    }

    var tbody       = '';
    var rowIdx      = 0;
    var rowsSkipped = 0;
    var groups = viewMode === 'week' ? groupByDate(events.slice()) : [{ date: null, events: events.slice() }];

    groups.forEach(function (group) {
      if (viewMode === 'week' && group.date && group.date !== 'unknown') {
        tbody += '<tr class="ec-date-group-row"><td colspan="' + cols + '" class="ec-date-group-cell">'
              +  esc(fmtDateGroupLabel(group.date)) + '</td></tr>';
      }
      group.events.forEach(function (e) {
        try {
          var intel       = e.intelligence || {};
          var sur         = intel.surprise  || {};
          var isHoliday   = e.importance === 'holiday';
          var released    = !isHoliday && e.actual   !== null && e.actual   !== undefined;
          var hasForecast = !isHoliday && e.forecast !== null && e.forecast !== undefined;

          var actualCls = 'ec-col-num';
          if (released && hasForecast) {
            var dir = e.surprise_direction || (sur.direction === 'above' ? 'hotter_or_stronger'
                                             : sur.direction === 'below' ? 'softer_or_weaker' : '');
            if (dir === 'hotter_or_stronger' || sur.direction === 'above') actualCls += ' ec-val-hot';
            else if (dir === 'softer_or_weaker' || sur.direction === 'below') actualCls += ' ec-val-soft';
            else actualCls += ' ec-val-set';
          } else if (released) {
            actualCls += ' ec-val-set';
          }

          var dispActual   = isHoliday ? '—' : numVal(e.actual,   e.unit);
          var dispForecast = isHoliday ? '—' : numVal(e.forecast, e.unit);
          var dispPrevious = isHoliday ? '—' : numVal(e.previous, e.unit);

          var evtDisplayName = esc(translateEventName(e.event_name || '—', lang));
          var evtSub = e.type && e.type !== e.event_name ? '<small>' + esc(e.type) + '</small>' : '';
          evtSub += getVolatilityHtml(e);

          var cdHtml  = countdownHtml(e);
          var tdTime  = '<td class="ec-col-time">' +
            esc(fmtTime(e.event_time)) +
            freshnessHtml(e) +
            upcomingBadgeHtml(e) +
            (cdHtml ? cdHtml : '') +
            '</td>';
          var tdCountry = '<td class="ec-col-country">' + esc(countryCurrency(e.country)) + '</td>';
          var tdEvent   = '<td class="ec-col-event"><strong>' + evtDisplayName + '</strong>' + evtSub + '</td>';
          var tdImpact  = '<td>' + badgeHtml(e.importance) + '</td>';
          var tdActual  = '<td class="' + actualCls + '">' + dispActual   + '</td>';
          var tdFcast   = '<td class="ec-col-num">'         + dispForecast + '</td>';
          var tdPrev    = '<td class="ec-col-num">'         + dispPrevious + '</td>';
          var cells     = isRTL
            ? tdPrev + tdFcast + tdActual + tdImpact + tdEvent + tdCountry + tdTime
            : tdTime + tdCountry + tdEvent + tdImpact + tdActual + tdFcast + tdPrev;
          tbody += '<tr class="ec-row" data-ec-i="' + rowIdx + '" tabindex="0" role="button" aria-expanded="false">'
                +  cells + '</tr>';
          rowIdx++;
        } catch (rowErr) {
          rowsSkipped++;
          if (EC_DEBUG) console.error('[ec] buildTable row error (idx=' + rowIdx + '):', rowErr);
        }
      });
    });

    if (EC_DEBUG && rowsSkipped > 0) {
      console.warn('[ec] buildTable — skipped', rowsSkipped, 'malformed rows');
    }

    return {
      html:       '<table class="ec-table"><thead><tr>' + ths + '</tr></thead><tbody>' + tbody + '</tbody></table>',
      cols:       cols,
      rendered:   rowIdx,
      skipped:    rowsSkipped,
      groupCount: groups.length,
    };
  }

  // ── Card build (mobile) ───────────────────────────────────────────────────
  function buildCards(events) {
    var parts        = [];
    var cardsSkipped = 0;
    var groups = viewMode === 'week' ? groupByDate(events.slice()) : [{ date: null, events: events.slice() }];
    var cardIdx = 0;
    groups.forEach(function (group) {
      if (viewMode === 'week' && group.date && group.date !== 'unknown') {
        parts.push('<div class="ec-date-group-header">' + esc(fmtDateGroupLabel(group.date)) + '</div>');
      }
      group.events.forEach(function (e) {
        try {
          var isHoliday = e.importance === 'holiday';
          var assets = getAssetTags(e);
          var tags = isHoliday ? '' : assets.map(function (a) {
            return '<span class="ec-asset-tag">' + esc(a) + '</span>';
          }).join('');
          var dispActual   = isHoliday ? '—' : numVal(e.actual,   e.unit);
          var dispForecast = isHoliday ? '—' : numVal(e.forecast, e.unit);
          var dispPrevious = isHoliday ? '—' : numVal(e.previous, e.unit);
          var cdHtml = countdownHtml(e);
          parts.push(
            '<div class="ec-card" data-ec-i="' + cardIdx + '" tabindex="0" role="button" aria-expanded="false">' +
            '<div class="ec-card-header">' +
              '<div class="ec-card-event"><strong>' + esc(translateEventName(e.event_name || '—', lang)) + '</strong>' +
                '<small>' + esc(countryCurrency(e.country)) + '</small></div>' +
              badgeHtml(e.importance) +
            '</div>' +
            '<div class="ec-card-time">' +
              esc(fmtTime(e.event_time)) +
              freshnessHtml(e) +
              upcomingBadgeHtml(e) +
              (cdHtml ? cdHtml : '') +
            '</div>' +
            (!isHoliday ? getVolatilityHtml(e) : '') +
            '<div class="ec-card-nums">' +
              '<div class="ec-card-num-cell"><span class="ec-card-num-label">' + esc(L.colActual)   + '</span><span class="ec-card-num-val">' + dispActual   + '</span></div>' +
              '<div class="ec-card-num-cell"><span class="ec-card-num-label">' + esc(L.colForecast) + '</span><span class="ec-card-num-val">' + dispForecast + '</span></div>' +
              '<div class="ec-card-num-cell"><span class="ec-card-num-label">' + esc(L.colPrevious) + '</span><span class="ec-card-num-val">' + dispPrevious + '</span></div>' +
            '</div>' +
            '<div class="ec-card-detail">' +
              intelligenceHtml(e) +
              (tags ? '<div class="ec-card-assets">' + tags + '</div>' : '') +
              '<p class="ec-card-disclaimer">' + esc(L.disclaimer) + '</p>' +
            '</div>' +
            '</div>'
          );
          cardIdx++;
        } catch (cardErr) {
          cardsSkipped++;
          if (EC_DEBUG) console.error('[ec] buildCards card error (idx=' + cardIdx + '):', cardErr);
        }
      });
    });

    if (EC_DEBUG && cardsSkipped > 0) {
      console.warn('[ec] buildCards — skipped', cardsSkipped, 'malformed cards');
    }

    return '<div class="ec-cards">' + parts.join('') + '</div>';
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    updateQuickBtns();
    if (elDatePicker && viewMode !== 'week') elDatePicker.value = selectedDate;

    var events = eventsForPeriod();
    var label  = viewMode === 'week'
      ? fmtDateLabel(weekStart(selectedDate)) + ' – ' + fmtDateLabel(weekEnd(selectedDate))
      : fmtDateLabel(selectedDate);

    updateStatus(allEvents.length, events.length);

    if (!events.length) {
      elTableWrap.innerHTML =
        '<div class="ec-empty-state"><strong>' + esc(label) + '</strong>' +
        '<p>' + esc(L.noEvents) + '</p>' +
        '<p class="ec-empty-hint">' + esc(L.noEventsHint) + '</p>' +
        '</div>';
      if (EC_DEBUG) {
        console.log('[ec] render — empty | fetched:', allEvents.length,
                    'filtered:', events.length, 'mode:', viewMode, 'date:', selectedDate);
      }
      return;
    }

    var tbl, cardsHtml;
    try {
      tbl = buildTable(events);
    } catch (tblErr) {
      if (EC_DEBUG) console.error('[ec] buildTable fatal:', tblErr);
      tbl = { html: '', cols: 7, rendered: 0, skipped: events.length, groupCount: 0 };
    }
    try {
      cardsHtml = buildCards(events);
    } catch (cardErr) {
      if (EC_DEBUG) console.error('[ec] buildCards fatal:', cardErr);
      cardsHtml = '<div class="ec-cards"></div>';
    }

    var topHtml = renderTopEvents();

    if (!tbl.html && cardsHtml === '<div class="ec-cards"></div>') {
      elTableWrap.innerHTML = topHtml +
        '<div class="ec-empty-state"><strong>' + esc(label) + '</strong>' +
        '<p>' + esc(L.noEvents) + '</p>' +
        '<p class="ec-empty-hint">' + esc(L.noEventsHint) + '</p>' +
        '</div>';
    } else {
      elTableWrap.innerHTML = topHtml + tbl.html + cardsHtml;
      attachListeners(tbl.cols, events);
    }

    startCountdownTicker();

    if (EC_DEBUG) {
      console.log('[ec] render — fetched:', allEvents.length,
                  '| filtered:', events.length,
                  '| hidden:', (allEvents.length - events.length),
                  '| groups:', (tbl.groupCount || 0),
                  '| rendered:', (tbl.rendered || 0),
                  '| skipped:', (tbl.skipped || 0),
                  '| mode:', viewMode, '| date:', selectedDate);
    }
  }

  // ── Row expand (desktop) ──────────────────────────────────────────────────
  function attachListeners(cols, events) {
    var rows = elTableWrap.querySelectorAll('tr.ec-row');
    rows.forEach(function (row) {
      row.addEventListener('click', function () { toggleRow(this, cols, events); });
      row.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleRow(this, cols, events); }
      });
    });
    var cards = elTableWrap.querySelectorAll('.ec-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        this.classList.toggle('ec-card-expanded');
        this.setAttribute('aria-expanded', this.classList.contains('ec-card-expanded') ? 'true' : 'false');
      });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); this.click(); }
      });
    });
  }

  function toggleRow(row, cols, events) {
    try {
      var idx  = Number(row.getAttribute('data-ec-i'));
      var e    = events[idx];
      if (!e) return;
      var expanded = row.classList.contains('ec-row-expanded');
      var next     = row.nextElementSibling;
      if (next && next.classList.contains('ec-detail-row')) next.remove();
      if (!expanded) {
        row.classList.add('ec-row-expanded');
        row.setAttribute('aria-expanded', 'true');
        var tr = document.createElement('tr');
        tr.className = 'ec-detail-row';
        var td = document.createElement('td');
        td.colSpan = cols;
        td.innerHTML = '<div class="ec-detail-inner">' + detailContent(e) + '</div>';
        tr.appendChild(td);
        row.parentNode.insertBefore(tr, row.nextSibling);
      } else {
        row.classList.remove('ec-row-expanded');
        row.setAttribute('aria-expanded', 'false');
      }
    } catch (_) {}
  }

  // ── Status bar ────────────────────────────────────────────────────────────
  function updateStatus(fetchedCount, visibleCount) {
    if (!elStatus) return;
    var src    = calMeta.source || calMeta.provider || '';
    var upd    = calMeta.updated_at || '';
    var isLive    = (src === 'live' || src === 'fmp' || src === 'finnhub' || src === 'fred' || src === 'te');
    var isCached  = (src === 'cache' || src === 'stale_cache' || src === 'static_cache');
    var cls       = isLive ? 'ec-status-live' : isCached ? 'ec-status-cache' : 'ec-status-degraded';
    elStatus.className = 'ec-status-bar ' + cls;

    var srcLabel = src === 'degraded' ? L.srcDegraded
                 : isCached           ? L.srcCache
                 : isLive             ? (L.srcLive + (src !== 'live' ? ' (' + src + ')' : ''))
                 : L.srcCache;

    var updLabel = upd ? ' \xB7 ' + L.labelUpdated + ': ' + new Date(upd).toLocaleString(
      lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    ) : '';

    var provText = '';
    if (calMeta.providers && typeof calMeta.providers === 'object') {
      var okProviders = Object.keys(calMeta.providers).filter(function (k) {
        return calMeta.providers[k] && calMeta.providers[k].status === 'ok';
      });
      if (okProviders.length) provText = ' \xB7 ' + okProviders.join('+');
    }

    var countText = '';
    if (visibleCount !== undefined && fetchedCount !== undefined && fetchedCount !== visibleCount) {
      countText = ' \xB7 ' + fetchedCount + ' ' + L.labelFetched + ' \xB7 ' + visibleCount + ' ' + L.labelShown;
    } else if (visibleCount !== undefined) {
      countText = ' \xB7 ' + visibleCount + ' ' + L.labelEvents;
    }

    elStatus.textContent = L.labelSrc + ': ' + srcLabel + updLabel + provText + countText;
  }

  // ── Quick button active state ─────────────────────────────────────────────
  function updateQuickBtns() {
    var today         = todayStr();
    var tomorrow      = addDays(today, 1);
    var nextWeekStart = weekStart(addDays(today, 7));
    [elToday, elTomorrow, elWeek, elNextWeek].forEach(function (el) {
      if (el) el.classList.remove('ec-active');
    });
    if (viewMode === 'week') {
      if (weekStart(selectedDate) === nextWeekStart) {
        if (elNextWeek) elNextWeek.classList.add('ec-active');
      } else {
        if (elWeek) elWeek.classList.add('ec-active');
      }
    } else if (selectedDate === today) {
      if (elToday) elToday.classList.add('ec-active');
    } else if (selectedDate === tomorrow) {
      if (elTomorrow) elTomorrow.classList.add('ec-active');
    }
  }

  // ── Refresh lifecycle ─────────────────────────────────────────────────────
  function getRefreshInterval() {
    var now  = Date.now();
    var from, to;
    if (viewMode === 'week') { from = weekStart(selectedDate); to = weekEnd(selectedDate); }
    else { from = to = selectedDate; }
    var hasHighImpactSoon = allEvents.some(function (e) {
      if (e.importance !== 'high') return false;
      var d = eventDate(e);
      if (!d || d < from || d > to) return false;
      var t = Date.parse(e.event_time);
      if (isNaN(t)) return false;
      var diff = t - now;
      return diff > -REFRESH_WINDOW_MS && diff < REFRESH_WINDOW_MS;
    });
    return hasHighImpactSoon ? REFRESH_ACTIVE_MS : REFRESH_NORMAL_MS;
  }

  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    if (typeof document !== 'undefined' && document.hidden) return;
    var interval = getRefreshInterval();
    refreshTimer = setTimeout(function () {
      refreshTimer = null;
      load();
    }, interval);
    if (EC_DEBUG) {
      console.log('[ec] scheduleRefresh — next in', Math.round(interval / 1000) + 's');
    }
  }

  // ── Bind controls ─────────────────────────────────────────────────────────
  function bindControls() {
    if (elPrev) elPrev.addEventListener('click', function () {
      selectedDate = addDays(selectedDate, viewMode === 'week' ? -7 : -1); load();
    });
    if (elNext) elNext.addEventListener('click', function () {
      selectedDate = addDays(selectedDate, viewMode === 'week' ? 7 : 1); load();
    });
    if (elToday)    elToday.addEventListener('click',    function () { viewMode = 'day';  selectedDate = todayStr();             load(); });
    if (elTomorrow) elTomorrow.addEventListener('click', function () { viewMode = 'day';  selectedDate = addDays(todayStr(), 1); load(); });
    if (elWeek)     elWeek.addEventListener('click',     function () { viewMode = 'week'; selectedDate = todayStr();             load(); });
    if (elNextWeek) elNextWeek.addEventListener('click', function () { viewMode = 'week'; selectedDate = addDays(todayStr(), 7); load(); });
    if (elRefresh)  elRefresh.addEventListener('click',  function () { load(); });
    if (elDatePicker) {
      elDatePicker.value = selectedDate;
      elDatePicker.addEventListener('change', function () {
        if (this.value) { viewMode = 'day'; selectedDate = this.value; load(); }
      });
    }
    if (elFilterImpact)  elFilterImpact.addEventListener('change',  function () { filterImpact  = this.value; render(); });
    if (elFilterCountry) elFilterCountry.addEventListener('change', function () { filterCountry = this.value; render(); });
    if (elSearch) {
      var t;
      elSearch.addEventListener('input', function () {
        var v = this.value;
        clearTimeout(t);
        t = setTimeout(function () { searchText = v; render(); }, 220);
      });
    }

    // Inject Gold and Fed filter toggle buttons into .ec-filters
    var elFilters = document.querySelector('.ec-filters');
    if (elFilters) {
      var elFilterGoldBtn = document.createElement('button');
      elFilterGoldBtn.type      = 'button';
      elFilterGoldBtn.className = 'ec-btn-quick ec-btn-filter-toggle';
      elFilterGoldBtn.textContent = L.filterGold;
      elFilterGoldBtn.setAttribute('aria-pressed', 'false');
      elFilterGoldBtn.addEventListener('click', function () {
        filterGold = !filterGold;
        this.classList.toggle('ec-active', filterGold);
        this.setAttribute('aria-pressed', filterGold ? 'true' : 'false');
        render();
      });

      var elFilterFedBtn = document.createElement('button');
      elFilterFedBtn.type      = 'button';
      elFilterFedBtn.className = 'ec-btn-quick ec-btn-filter-toggle';
      elFilterFedBtn.textContent = L.filterFed;
      elFilterFedBtn.setAttribute('aria-pressed', 'false');
      elFilterFedBtn.addEventListener('click', function () {
        filterFed = !filterFed;
        this.classList.toggle('ec-active', filterFed);
        this.setAttribute('aria-pressed', filterFed ? 'true' : 'false');
        render();
      });

      elFilters.appendChild(elFilterGoldBtn);
      elFilters.appendChild(elFilterFedBtn);
    }
  }

  // ── Load data ─────────────────────────────────────────────────────────────
  function load() {
    if (activeController) {
      try { activeController.abort(); } catch (_) {}
      activeController = null;
    }

    var seq        = ++requestSeq;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    activeController = controller;
    var signal = controller ? controller.signal : undefined;

    elTableWrap.innerHTML = '<p class="calendar-loading">' + esc(L.loading) + '</p>';
    if (elRefresh) { elRefresh.disabled = true; elRefresh.setAttribute('aria-busy', 'true'); }

    scheduleRefresh();

    var qs         = endpointQuery();
    var fetchStart = EC_DEBUG ? Date.now() : 0;

    if (EC_DEBUG) {
      console.log('[ec] load — seq:', seq, '| mode:', viewMode,
                  '| date:', selectedDate, '| query:', qs);
    }

    function fetchOne(url) {
      var opts = signal ? { signal: signal } : {};
      return fetch(url, opts).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    }

    var usedFallback = false;

    fetchOne('/api/economic-calendar' + qs)
      .catch(function (err) {
        if (err && err.name === 'AbortError') throw err;
        return fetchOne('/.netlify/functions/economic-calendar' + qs);
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') throw err;
        usedFallback = true;
        return fetchOne('/data/economic-calendar.json');
      })
      .then(function (data) {
        if (seq !== requestSeq) {
          if (EC_DEBUG) console.log('[ec] discarding stale response (seq=' + seq + ')');
          return;
        }
        activeController = null;
        if (elRefresh) { elRefresh.disabled = false; elRefresh.removeAttribute('aria-busy'); }

        calMeta = data || {};
        if (usedFallback && calMeta.source !== 'degraded') {
          calMeta = Object.assign({}, calMeta, { source: 'cache' });
        }
        allEvents = Array.isArray(data && data.events) ? data.events.slice() : [];

        if (EC_DEBUG) {
          var elapsed = Date.now() - fetchStart;
          console.log('[ec] fetched — seq:', seq, '| events:', allEvents.length,
                      '| source:', calMeta.source, '| elapsed:', elapsed + 'ms');
          if (calMeta.providers && typeof calMeta.providers === 'object') {
            Object.keys(calMeta.providers).forEach(function (k) {
              var p = calMeta.providers[k];
              if (p && p.status === 'ok') {
                console.log('[ec] provider', k,
                            '— normalized:', p.normalized,
                            '| completeness:', p.completeness_score + '%',
                            '| actual:', p.with_actual,
                            '| forecast:', p.with_forecast);
              }
            });
          }
        }

        populateCountries();
        render();
        maybeStaleCacheNotice(calMeta.source);
        maybeShowExternalFallback(allEvents.length);
        scheduleRefresh();
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') {
          if (EC_DEBUG) console.log('[ec] fetch aborted (seq=' + seq + ')');
          return;
        }
        if (seq !== requestSeq) return;

        activeController = null;
        if (elRefresh) { elRefresh.disabled = false; elRefresh.removeAttribute('aria-busy'); }
        if (EC_DEBUG) console.error('[ec] fetch failed (seq=' + seq + '):', err);

        elTableWrap.innerHTML =
          '<div class="ec-empty-state"><strong>' + esc(L.srcDegraded) + '</strong>' +
          '<p>' + esc(L.noEvents) + '</p></div>';
        if (elStatus) {
          elStatus.className    = 'ec-status-bar ec-status-degraded';
          elStatus.textContent  = L.srcDegraded;
        }
        maybeStaleCacheNotice(null);
        maybeShowExternalFallback(0);
      });
  }

  function endpointQuery() {
    if (viewMode === 'week') {
      return '?from=' + weekStart(selectedDate) + '&to=' + weekEnd(selectedDate);
    }
    return '?date=' + selectedDate;
  }

  // ── Stale cache notice ────────────────────────────────────────────────────
  // When the API returns cached (not live) data, show a compact recovery notice
  // near the calendar table so the user knows it is not freshly fetched.
  function maybeStaleCacheNotice(source) {
    var noticeId = 'ec-stale-cache-notice';
    var existing = document.getElementById(noticeId);
    var isStale  = (source === 'stale_cache' || source === 'cache' || source === 'static_cache');
    if (!isStale) {
      if (existing) existing.remove();
      return;
    }
    if (!existing) {
      var tableWrap = document.getElementById('ec-table-wrap');
      if (!tableWrap || !tableWrap.parentNode) return;
      var notice = document.createElement('p');
      notice.id        = noticeId;
      notice.style.cssText =
        'font-size:0.82rem;color:var(--text-muted,#666);' +
        'background:var(--surface-2,#f9fafb);border:1px solid var(--border,#e0e0e0);' +
        'border-radius:6px;padding:0.5rem 1rem;margin:0.5rem 0 0;';
      notice.textContent = lang === 'ar'
        ? 'يتم عرض آخر بيانات اقتصادية محفوظة مؤقتًا حتى عودة المزودات الحية.'
        : 'Showing latest cached macro events while live providers recover.';
      tableWrap.parentNode.insertBefore(notice, tableWrap);
    }
  }

  // ── External iframe fallback ─────────────────────────────────────────────
  // When all live providers and static cache return 0 events, surface the
  // #external-calendar section with a compact notice so the page is never empty.
  function maybeShowExternalFallback(eventCount) {
    var extSection = document.getElementById('external-calendar');
    if (!extSection) return;
    var noticeId = 'ec-external-notice';
    var existing = document.getElementById(noticeId);
    if (eventCount > 0) {
      if (existing) existing.remove();
      return;
    }
    if (!existing) {
      var notice = document.createElement('p');
      notice.id        = noticeId;
      notice.className = 'ec-external-notice';
      notice.style.cssText =
        'font-size:0.85rem;color:var(--text-muted,#666);' +
        'background:var(--surface-2,#f9fafb);border:1px solid var(--border,#e0e0e0);' +
        'border-radius:6px;padding:0.6rem 1rem;margin-bottom:0.75rem;';
      notice.textContent = lang === 'ar'
        ? 'مزودات البيانات الحية غير متاحة مؤقتًا. يتم عرض التقويم الخارجي للتحقق.'
        : 'Live providers are temporarily unavailable. External calendar is shown for cross-checking.';
      extSection.insertBefore(notice, extSection.firstChild);
    }
  }

  // ── Visibility-based pause/resume ─────────────────────────────────────────
  if (typeof document !== 'undefined' && 'hidden' in document) {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
        if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
        if (EC_DEBUG) console.log('[ec] tab hidden — refresh paused');
      } else {
        if (EC_DEBUG) console.log('[ec] tab visible — reloading');
        load();
      }
    });
  }

  bindControls();
  load();
})();
