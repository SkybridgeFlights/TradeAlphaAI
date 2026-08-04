'use strict';

// ETF Intelligence Center — /etfs/methodology/ (+ Arabic).
//
// Publishes exactly how the TradeAlpha Score is produced: the components, their
// weights, the inputs behind each one, the stated assumptions and the known
// limits. Values are read from the live artifact rather than restated here, so
// the published method can never drift from the model that is actually running.
//
// Usage: node tools/generate-etf-methodology-page.js [--write]

const fs = require('fs');
const path = require('path');

const shell = require('./etf-center-shell');
const { esc, tr } = shell;

const ROOT = shell.ROOT;
const SCORE = path.join(ROOT, 'data/intelligence/etf-score.json');
const ANALYTICS = path.join(ROOT, 'data/intelligence/etf-analytics.json');
const FACTS = path.join(ROOT, 'data/intelligence/etf-facts.json');
const SLUG = 'etfs/methodology/';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Component descriptions. Kept beside the weights they document so a new
// component cannot be added to the model without a reader-facing explanation.
const COMPONENTS = {
  cost: {
    en: ['Cost', 'The published total expense ratio, mapped across the 0.03%–0.75% range that index-tracking funds occupy. Cheaper scores higher.'],
    ar: ['التكلفة', 'نسبة المصاريف الإجمالية المنشورة، موزعة على النطاق 0.03%–0.75% الذي تشغله الصناديق المتتبعة للمؤشرات. كلما انخفضت التكلفة ارتفعت الدرجة.'],
    input_en: 'Requires a verified expense ratio. No free provider publishes one today, so this component is currently indeterminate for every fund and its weight is redistributed.',
    input_ar: 'يتطلب نسبة مصاريف موثّقة. ولا يوفرها أي مزود مجاني اليوم، لذا يبقى هذا المكوّن غير محدد لكل الصناديق ويُعاد توزيع وزنه.',
  },
  diversification: {
    en: ['Diversification', 'How broad the mandate is, reduced where the fund has actually behaved far more volatilely than the broad market — a concentrated fund is concentrated regardless of how its mandate reads.'],
    ar: ['التنويع', 'مدى اتساع تفويض الصندوق، مع خفض الدرجة عندما يكون تذبذبه الفعلي أعلى بكثير من السوق الواسع — فالصندوق المركّز يبقى مركّزا مهما كانت صياغة تفويضه.'],
    input_en: 'Mandate breadth tier plus observed volatility versus a broad-market reference.',
    input_ar: 'شريحة اتساع التفويض إضافة إلى التذبذب المرصود مقارنة بمرجع السوق الواسع.',
  },
  liquidity: {
    en: ['Liquidity', 'Median daily turnover over the trailing year, on a logarithmic scale spanning 1M to 10B units of the listing currency.'],
    ar: ['السيولة', 'وسيط قيمة التداول اليومية خلال السنة الماضية، على مقياس لوغاريتمي يمتد من مليون إلى 10 مليارات من عملة الإدراج.'],
    input_en: 'Computed from observed exchange volume and closing prices.',
    input_ar: 'محتسبة من أحجام التداول المرصودة في البورصة وأسعار الإغلاق.',
  },
  tracking_quality: {
    en: ['Tracking quality', 'Annualised tracking error against a same-currency proxy for the index the fund states it tracks. Scored only where such a proxy exists, and never against the fund itself.'],
    ar: ['جودة التتبع', 'خطأ التتبع السنوي مقابل مؤشر بديل بالعملة نفسها للمؤشر الذي يعلن الصندوق تتبعه. ويُحتسب فقط عند توفر هذا البديل، ولا يُقارن الصندوق بنفسه أبدا.'],
    input_en: 'Computed from observed prices; indeterminate for most funds, which is stated openly on each page.',
    input_ar: 'محتسبة من الأسعار المرصودة؛ وتبقى غير محددة لمعظم الصناديق، وهو ما يُذكر بوضوح في كل صفحة.',
  },
  tax_characteristics: {
    en: ['Structural tax characteristics', 'Fund domicile and distribution policy — the two structural features that change withholding treatment most.'],
    ar: ['الخصائص الضريبية الهيكلية', 'مقر الصندوق وسياسة التوزيع — وهما السمتان الهيكليتان الأكثر تأثيرا في معاملة الاستقطاع الضريبي.'],
    input_en: 'Distribution policy read from the provider fund name where it states one; fund domicile is awaiting a verified source.',
    input_ar: 'سياسة التوزيع مقروءة من اسم الصندوق لدى المزود حين يذكرها؛ أما مقر الصندوق فبانتظار مصدر موثّق.',
  },
  long_term_suitability: {
    en: ['Long-horizon composite', 'Combines the cost and diversification components with the length of observable history and the depth of the worst recorded drawdown.'],
    ar: ['المركّب طويل الأجل', 'يجمع بين مكوّني التكلفة والتنويع وطول التاريخ القابل للرصد وعمق أسوأ تراجع مسجل.'],
    input_en: 'Derived from the other components plus observed price history.',
    input_ar: 'مشتق من المكوّنات الأخرى إضافة إلى تاريخ الأسعار المرصود.',
  },
};

function weightsTable(ar, score) {
  const t = tr(ar);
  const weights = score.method.weights || {};
  const rows = Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
    .map(([key, weight]) => {
      const c = COMPONENTS[key];
      const [name, description] = c ? (ar ? c.ar : c.en) : [key, ''];
      const input = c ? (ar ? c.input_ar : c.input_en) : '';
      return `<tr><th scope="row">${esc(name)}</th><td class="num">${(weight * 100).toFixed(0)}%</td><td style="white-space:normal">${esc(description)}</td><td style="white-space:normal">${esc(input)}</td></tr>`;
    }).join('\n');

  return `<div class="etf-table-wrap"><table class="etf-table">
    <thead><tr>
      <th scope="col">${esc(t('Component', 'المكوّن'))}</th>
      <th scope="col">${esc(t('Weight', 'الوزن'))}</th>
      <th scope="col">${esc(t('What it measures', 'ما الذي يقيسه'))}</th>
      <th scope="col">${esc(t('Where the input comes from', 'مصدر المدخلات'))}</th>
    </tr></thead>
    <tbody>
${rows}
    </tbody>
  </table></div>`;
}

function bandsTable(ar, score) {
  const t = tr(ar);
  const bands = [
    ['exceptional', 'استثنائي', '85 – 100'],
    ['strong', 'قوي', '72 – 84.9'],
    ['solid', 'متين', '58 – 71.9'],
    ['adequate', 'كافٍ', '42 – 57.9'],
    ['limited', 'محدود', '0 – 41.9'],
    ['indeterminate', 'غير محدد', t('below the coverage floor', 'دون حد التغطية')],
  ];
  const rows = bands.map(([en, arLabel, range]) => `<tr><th scope="row" style="text-transform:capitalize">${esc(ar ? arLabel : en)}</th><td class="num">${esc(range)}</td></tr>`).join('\n');
  return `<div class="etf-table-wrap"><table class="etf-table">
    <thead><tr><th scope="col">${esc(t('Label', 'التصنيف'))}</th><th scope="col">${esc(t('Overall score', 'الدرجة الإجمالية'))}</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table></div>`;
}

function body(ar, score, analytics, facts) {
  const t = tr(ar);
  const floorPct = (score.method.min_weight_coverage * 100).toFixed(0);
  const scored = score.coverage.scored;
  const total = score.coverage.total;
  const totals = facts.coverage.totals || {};
  const verifiedFields = totals.fetched || 0;
  const awaitingFields = totals.unavailable || 0;

  const section = (id, eyebrowEn, eyebrowAr, titleEn, titleAr, inner) => `      <section class="market-section" id="${id}">
        <div class="market-section-head"><span class="eyebrow">${esc(t(eyebrowEn, eyebrowAr))}</span><h2>${esc(t(titleEn, titleAr))}</h2></div>
        ${inner}
      </section>`;

  const overview = `<div class="market-panel">
          <p class="market-copy">${esc(t(
    'The TradeAlpha Score describes the structural quality of a fund — what it costs to own, how broadly it is spread, how easily it trades, how closely it follows its index, and how it is structured. It does not describe what a fund is going to do next, and it is not a ranking of expected return.',
    'يصف مؤشر TradeAlpha الجودة الهيكلية للصندوق — كم يكلّف امتلاكه، ومدى اتساع توزيعه، وسهولة تداوله، ودقة تتبعه لمؤشره، وكيف جرت هيكلته. وهو لا يصف ما سيفعله الصندوق لاحقا، وليس ترتيبا للعائد المتوقع.',
  ))}</p>
          <p class="market-copy">${esc(t(
    'Every component is computed from inputs this platform can evidence. Where an input does not exist, the component is marked indeterminate, dropped from the total, and the remaining weights are rebalanced so the result is never quietly padded with an assumption.',
    'يُحتسب كل مكوّن من مدخلات تستطيع المنصة إثباتها. وعند غياب أي مدخل يُصنَّف المكوّن كغير محدد ويُستبعد من الإجمالي، وتُعاد موازنة الأوزان المتبقية حتى لا تُحشى النتيجة بافتراض غير معلن.',
  ))}</p>
          <div class="etf-grid narrow" style="margin-block-start:16px">
            ${shell.stat(t('Funds covered', 'الصناديق المغطاة'), String(total))}
            ${shell.stat(t('Funds scored', 'الصناديق المُقيَّمة'), String(scored))}
            ${shell.stat(t('Verified fields', 'حقول موثّقة'), String(verifiedFields))}
            ${shell.stat(t('Awaiting verified data', 'بانتظار بيانات موثّقة'), String(awaitingFields))}
            ${shell.stat(t('Coverage floor', 'حد التغطية'), `${floorPct}%`, t('of model weight required', 'من وزن النموذج مطلوب'))}
          </div>
        </div>`;

  const dataTiers = `<div class="market-panel">
          <p class="market-copy">${esc(t('Every figure on an ETF page belongs to one of three tiers.', 'ينتمي كل رقم في صفحات الصناديق إلى واحدة من ثلاث فئات.'))}</p>
          <div class="etf-grid" style="margin-block-start:14px">
            <article class="market-card"><h3>${esc(t('Computed', 'محتسب'))}</h3><p class="market-copy">${esc(t(
    'Performance, volatility, Sharpe, Sortino, beta, maximum drawdown, tracking error and similarity. Calculated by TradeAlphaAI from observed daily closing prices, refreshed on every build.',
    'الأداء والتذبذب ونسبتا شارب وسورتينو وبيتا وأقصى تراجع وخطأ التتبع والتشابه. تحتسبها TradeAlphaAI من أسعار الإغلاق اليومية المرصودة، وتُحدَّث مع كل بناء.',
  ))}</p></article>
            <article class="market-card"><h3>${esc(t('Verified', 'موثّق'))}</h3><p class="market-copy">${esc(t(
    'Fund name, trading currency, exchange and first trading date, returned by a data provider and stored with the hash of that response. Issuer and distribution policy are read from the verified fund name, which is quoted alongside them.',
    'اسم الصندوق وعملة التداول والبورصة وأول تاريخ تداول، وردت من مزود بيانات وتُخزَّن مع بصمة استجابته. أما الجهة المُصدِرة وسياسة التوزيع فتُقرأان من اسم الصندوق الموثّق الذي يُقتبس نصه بجانبهما.',
  ))}</p></article>
            <article class="market-card"><h3>${esc(t('Awaiting verified data', 'بانتظار بيانات موثّقة'))}</h3><p class="market-copy">${esc(t(
    'Expense ratio, ISIN, domicile, replication method, fund size and inception date have no free verifiable source. They are shown with that status on every surface rather than estimated, and the fund still appears in every ranking and table.',
    'نسبة المصاريف ورقم ISIN والمقر وطريقة المحاكاة وحجم الصندوق وتاريخ التأسيس لا مصدر مجاني موثّقا لها. وتظهر بهذه الحالة في كل الأسطح بدلا من تقديرها، ويبقى الصندوق مدرجا في كل الترتيبات والجداول.',
  ))}</p></article>
          </div>
        </div>`;

  const isinNote = `<div class="etf-note">${esc(t(
    'No value anywhere in this section is asserted from prior knowledge. Every field is traceable to a provider response, a computation over verified prices, or a labelled TradeAlphaAI classification — and a validator rejects the build if any factual field lacks one of those. Connecting a verified data source will populate the awaiting fields automatically, without changing a single page.',
    'لا تُؤكَّد أي قيمة في هذا القسم استنادا إلى معرفة سابقة. فكل حقل يمكن إرجاعه إلى استجابة مزود أو حساب على أسعار موثّقة أو تصنيف مُعلَن من TradeAlphaAI — ويرفض مدقق آلي البناء إذا افتقر أي حقل واقعي إلى أحد هذه الأسس. وسيؤدي ربط مصدر بيانات موثّق إلى تعبئة الحقول المنتظرة تلقائيا دون تغيير أي صفحة.',
  ))}</div>`;

  const currency = `<div class="market-panel">
          <p class="market-copy">${esc(ar ? analytics.method.currency_note_ar : analytics.method.currency_note_en)}</p>
          <p class="market-copy">${esc(t(
    'This is why a European fund shows its returns but not a benchmark-relative figure: comparing a euro-quoted fund against a dollar-quoted index would report the exchange-rate move as if the fund had produced it.',
    'ولهذا يعرض الصندوق الأوروبي عوائده دون رقم نسبي مقابل المؤشر: فمقارنة صندوق مسعّر باليورو بمؤشر مسعّر بالدولار تُظهر حركة سعر الصرف وكأن الصندوق هو من حققها.',
  ))}</p>
        </div>`;

  const assumption = `<div class="market-panel">
          <p class="market-copy">${esc(ar ? score.method.tax_assumption_ar : score.method.tax_assumption_en)}</p>
          <p class="market-copy">${esc(t(
    'Tax treatment depends on where an individual is resident and on rules that change. The component describes fund structure only; it cannot and does not model any individual situation.',
    'تعتمد المعاملة الضريبية على مكان إقامة الفرد وعلى قواعد متغيرة. ويصف هذا المكوّن بنية الصندوق فقط، ولا يمكنه تمثيل أي وضع فردي ولا يفعل ذلك.',
  ))}</p>
        </div>`;

  const limits = `<div class="market-panel"><ul class="market-copy">
          <li>${esc(t('Tracking quality is indeterminate for most funds, because a same-currency proxy for their index is not available from free data.', 'تبقى جودة التتبع غير محددة لمعظم الصناديق، لعدم توفر مؤشر بديل بالعملة نفسها ضمن البيانات المجانية.'))}</li>
          <li>${esc(t('Holdings and country weights are not yet published for every fund. Where they are absent the section is omitted rather than estimated.', 'لم تُنشر بعد المكونات والأوزان الجغرافية لكل صندوق. وعند غيابها يُحذف القسم بدلا من تقديره.'))}</li>
          <li>${esc(t('Fund size is a point-in-time figure shown with its date, not a live number.', 'حجم الصندوق رقم عند تاريخ محدد يُعرض مع تاريخه، وليس رقما لحظيا.'))}</li>
          <li>${esc(t('Turnover uses adjusted closing prices, so it ranks relative liquidity rather than stating an exact traded amount.', 'تستخدم قيمة التداول أسعار الإغلاق المعدلة، لذا فهي ترتّب السيولة النسبية ولا تذكر مبلغا متداولا دقيقا.'))}</li>
          <li>${esc(t('Historical measurement describes what has already happened. It carries no implication about what follows.', 'يصف القياس التاريخي ما حدث بالفعل، ولا يحمل أي دلالة عمّا سيأتي بعده.'))}</li>
        </ul></div>`;

  const reproduce = `<div class="market-panel"><p class="market-copy">${esc(t(
    'Each component on a fund page lists the evidence it used — the observation count, the window, the source document. Because the weights and bands on this page are published, any score shown on the site can be recomputed from those figures.',
    'يعرض كل مكوّن في صفحة الصندوق الأدلة التي استُخدمت فيه — عدد المشاهدات والنافذة الزمنية والوثيقة المصدر. وبما أن الأوزان والنطاقات المنشورة هنا معلنة، يمكن إعادة احتساب أي درجة معروضة على الموقع من تلك الأرقام.',
  ))}</p></div>`;

  return [
    section('etf-method-overview', 'What this measures', 'ما الذي يقيسه', 'The TradeAlpha Score', 'مؤشر TradeAlpha', overview),
    section('etf-method-components', 'Components', 'المكوّنات', 'Weights and inputs', 'الأوزان والمدخلات', weightsTable(ar, score)),
    section('etf-method-bands', 'Bands', 'النطاقات', 'How the label is assigned', 'كيف يُسنَد التصنيف', bandsTable(ar, score)),
    section('etf-method-tiers', 'Data policy', 'سياسة البيانات', 'Where every number comes from', 'من أين يأتي كل رقم', dataTiers + isinNote),
    section('etf-method-currency', 'Currency', 'العملة', 'Why some comparisons are withheld', 'لماذا تُحجب بعض المقارنات', currency),
    section('etf-method-assumption', 'Stated assumption', 'افتراض معلن', 'The tax perspective used', 'المنظور الضريبي المستخدم', assumption),
    section('etf-method-limits', 'Limits', 'الحدود', 'What this does not cover', 'ما لا يغطيه هذا المؤشر', limits),
    section('etf-method-reproduce', 'Reproducibility', 'قابلية إعادة الاحتساب', 'Checking the numbers', 'التحقق من الأرقام', reproduce),
  ].join('\n');
}

function buildPages() {
  const score = readJson(SCORE);
  const analytics = readJson(ANALYTICS);
  const facts = readJson(FACTS);

  const pages = [];
  for (const ar of [false, true]) {
    const titleEn = 'ETF Score Methodology';
    const titleAr = 'منهجية تقييم صناديق المؤشرات';
    const descEn = 'How the TradeAlpha ETF Score is calculated: every component, its weight, the inputs behind it, the assumptions stated openly and the limits acknowledged.';
    const descAr = 'كيف يُحتسب مؤشر TradeAlpha لصناديق المؤشرات: كل مكوّن ووزنه والمدخلات وراءه والافتراضات المعلنة والحدود المعترف بها.';
    pages.push({
      out: path.join(ROOT, ar ? 'ar/etfs/methodology/index.html' : 'etfs/methodology/index.html'),
      html: shell.page({
        ar,
        slugPath: SLUG,
        titleEn,
        titleAr,
        descEn,
        descAr,
        eyebrowEn: 'Methodology',
        eyebrowAr: 'المنهجية',
        trail: [[ar ? titleAr : titleEn, null]],
        body: body(ar, score, analytics, facts),
      }),
    });
  }
  return pages;
}

function main() {
  for (const file of [SCORE, ANALYTICS, FACTS]) {
    if (!fs.existsSync(file)) {
      console.error(`[etf-methodology] FAILED: missing ${path.relative(ROOT, file)}`);
      process.exit(1);
    }
  }
  shell.writePages(buildPages(), 'etf-methodology');
}

if (require.main === module) main();

module.exports = { buildPages };
