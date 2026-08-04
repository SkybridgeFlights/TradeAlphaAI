'use strict';

// ETF Intelligence Center — premium detail-page sections.
//
// Every value rendered here carries a provenance class from tools/etf-provenance.js
// and is labelled accordingly:
//
//   Verified   returned by a data provider, stored with that response's hash
//   Derived    computed by us, or read out of a verified string that is quoted
//   Registry   inherited from the pre-existing project registry, marked as
//              not independently verified
//   Awaiting   no verified source — shown as an explicit status, never blank
//              and never estimated
//
// The page ends with a provenance audit listing every field and its class, so a
// reader can see exactly which parts of the page are evidence and which are not.

const { esc, tr, pct, signedPct, compact, stat } = require('./etf-center-shell');
const P = require('./etf-provenance');

/** Ratios display to two decimals; the artifact keeps more. */
function ratio(value) {
  return Number.isFinite(value) ? value.toFixed(2) : null;
}

const HORIZON_LABELS = [
  ['1y', '1Y', 'سنة'],
  ['3y', '3Y', '3 سنوات'],
  ['5y', '5Y', '5 سنوات'],
  ['10y', '10Y', '10 سنوات'],
];

const REPLICATION_LABELS = {
  physical_full: ['Full physical replication', 'محاكاة مادية كاملة'],
  physical_sampling: ['Physical sampling', 'محاكاة مادية بالعينة'],
  synthetic: ['Synthetic (swap-based)', 'تركيبية (قائمة على المقايضة)'],
  physical_backed: ['Physically backed', 'مدعوم ماديا'],
};

const DISTRIBUTION_LABELS = {
  accumulating: ['Accumulating', 'تراكمي'],
  distributing: ['Distributing', 'موزِّع'],
  none: ['No distributions', 'بدون توزيعات'],
};

// Reader-facing field names for the audit and the information table.
const FIELD_LABELS = {
  fund_name: ['Fund name', 'اسم الصندوق'],
  issuer: ['Issuer', 'الجهة المُصدِرة'],
  benchmark: ['Benchmark index', 'المؤشر المرجعي'],
  currency: ['Trading currency', 'عملة التداول'],
  exchange: ['Exchange', 'البورصة'],
  instrument_type: ['Instrument type', 'نوع الأداة'],
  listing_date: ['First trading date', 'أول تاريخ تداول'],
  isin: ['ISIN', 'رقم ISIN'],
  ter_pct: ['Total expense ratio', 'نسبة المصاريف الإجمالية'],
  aum: ['Fund size', 'حجم الصندوق'],
  domicile: ['Domicile', 'المقر'],
  replication: ['Replication method', 'طريقة المحاكاة'],
  distribution: ['Distribution policy', 'سياسة التوزيع'],
  inception: ['Fund inception', 'تأسيس الصندوق'],
};

/** Internal identifiers are snake_case; readers should never see that. */
function humanise(value) {
  return String(value || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function section(id, eyebrow, title, inner) {
  return `      <section class="market-section" id="${id}">
        <div class="market-section-head"><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2></div>
        ${inner}
      </section>`;
}

const fieldLabel = (ar, name) => {
  const pair = FIELD_LABELS[name];
  return pair ? (ar ? pair[1] : pair[0]) : name;
};

const classLabel = (ar, cls) => {
  const pair = P.LABELS[cls];
  return pair ? (ar ? pair[1] : pair[0]) : cls;
};

/** Human-readable value for a provenance record, or the awaiting status. */
function displayValue(ar, name, record) {
  const t = tr(ar);
  if (!P.hasValue(record)) return t(P.AWAITING_EN, P.AWAITING_AR);
  const value = record.value;
  if (name === 'replication' && REPLICATION_LABELS[value]) return ar ? REPLICATION_LABELS[value][1] : REPLICATION_LABELS[value][0];
  if (name === 'distribution' && DISTRIBUTION_LABELS[value]) return ar ? DISTRIBUTION_LABELS[value][1] : DISTRIBUTION_LABELS[value][0];
  if (name === 'ter_pct') return `${value}%`;
  if (name === 'aum') return compact(value);
  return String(value);
}

/** Short provenance note shown beside a value. */
function provenanceNote(ar, record) {
  const t = tr(ar);
  if (!record) return '';
  if (record.provenance === P.FETCHED) {
    return `${t('Verified from', 'موثّق من')} ${esc(record.source.provider)} · ${esc(String(record.source.fetched_at).slice(0, 10))}`;
  }
  if (record.provenance === P.DERIVED) {
    return record.from_text
      ? `${t('Read from the provider fund name', 'مقروء من اسم الصندوق لدى المزود')}: "${esc(record.from_text)}"`
      : `${t('Computed from', 'محتسب من')} ${esc((record.inputs || []).join(', '))}`;
  }
  if (record.provenance === P.DECLARED) {
    return record.basis === P.REGISTRY_BASIS
      ? t('From the project registry — not independently verified', 'من سجل المشروع — غير موثّق بشكل مستقل')
      : t('TradeAlphaAI classification', 'تصنيف TradeAlphaAI');
  }
  const reason = P.REASON_LABELS[record.reason];
  return reason ? (ar ? reason[1] : reason[0]) : '';
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function heroExtra(ar, entry, facts, analytics, score) {
  const t = tr(ar);
  const fields = (facts && facts.fields) || {};
  const chips = [];

  const chip = (name, accent) => {
    if (!P.hasValue(fields[name])) return;
    chips.push(`<span class="etf-chip${accent ? ' accent' : ''}">${esc(displayValue(ar, name, fields[name]))}</span>`);
  };

  chip('exchange');
  chip('currency');
  chip('issuer');
  chip('distribution', true);

  const name = P.hasValue(fields.fund_name) ? fields.fund_name.value : entry.ticker;

  const identity = `<div class="etf-identity">
          <span class="etf-ticker-badge">${esc(entry.ticker)}</span>
          <span class="etf-identity-name">${esc(name)}</span>
        </div>`;

  return `\n        ${identity}\n        <div class="etf-chips">${chips.join('')}</div>${scoreDial(ar, score)}`;
}

function arLabel(label) {
  return {
    exceptional: 'استثنائي', strong: 'قوي', solid: 'متين',
    adequate: 'كافٍ', limited: 'محدود', indeterminate: 'غير محدد',
  }[label] || label;
}

function scoreDial(ar, score) {
  const t = tr(ar);
  if (!score) return '';
  if (score.overall === null) {
    return `\n        <div class="etf-score" style="margin-block-start:20px">
          <div class="etf-score-dial withheld"><span class="etf-score-figure"><span class="etf-score-value">${esc(t('Withheld', 'محجوبة'))}</span></span></div>
          <div class="etf-score-meta">
            <div class="etf-score-label">${esc(t('Score withheld', 'الدرجة محجوبة'))}</div>
            <p class="etf-score-coverage">${esc(t(
      `Only ${(score.model_coverage * 100).toFixed(0)}% of the scoring model could be evaluated for this fund, below the published floor. The components that could be measured are shown below.`,
      `أمكن تقييم ${(score.model_coverage * 100).toFixed(0)}% فقط من نموذج التقييم لهذا الصندوق، وهو دون الحد المنشور. وتظهر أدناه المكوّنات التي أمكن قياسها.`,
    ))}</p>
          </div>
        </div>`;
  }
  return `\n        <div class="etf-score" style="margin-block-start:20px">
          <div class="etf-score-dial" style="--score:${score.overall}">
            <span class="etf-score-figure"><span class="etf-score-value">${score.overall}</span><span class="etf-score-max">/ 100</span></span>
          </div>
          <div class="etf-score-meta">
            <div class="etf-score-label">${esc(t(score.label, arLabel(score.label)))}</div>
            <p class="etf-score-coverage">${esc(t(
    `TradeAlpha Score, covering ${(score.model_coverage * 100).toFixed(0)}% of the model. Structural quality only — not a view on future performance.`,
    `مؤشر TradeAlpha، ويغطي ${(score.model_coverage * 100).toFixed(0)}% من النموذج. جودة هيكلية فقط — وليس رأيا في الأداء المستقبلي.`,
  ))}</p>
          </div>
        </div>`;
}

// ---------------------------------------------------------------------------
// Score breakdown
// ---------------------------------------------------------------------------

const SUBSCORE_LABELS = {
  cost: ['Cost', 'التكلفة'],
  diversification: ['Diversification', 'التنويع'],
  liquidity: ['Liquidity', 'السيولة'],
  tracking_quality: ['Tracking quality', 'جودة التتبع'],
  tax_characteristics: ['Structural tax characteristics', 'الخصائص الضريبية الهيكلية'],
  long_term_suitability: ['Long-horizon composite', 'المركّب طويل الأجل'],
};

function scoreBreakdown(ar, score, config) {
  const t = tr(ar);
  if (!score) return '';

  const entries = Object.entries(score.sub_scores);
  // Measured components lead, strongest first; components awaiting inputs are
  // summarised once at the end rather than interrupting the read.
  const measured = entries.filter(([, s2]) => s2.status === 'computed').sort((a, b) => b[1].value - a[1].value);
  const pending = entries.filter(([, s2]) => s2.status !== 'computed');

  const rows = measured.map(([key, sub]) => {
    const label = SUBSCORE_LABELS[key] ? (ar ? SUBSCORE_LABELS[key][1] : SUBSCORE_LABELS[key][0]) : humanise(key);
    const tier = sub.value >= 75 ? 'high' : (sub.value < 45 ? 'low' : '');
    const evidence = (sub.evidence || []).map((e) => `<li>${esc(humanise(e).replace(/^(\w)/, (c) => c.toLowerCase()))}</li>`).join('');
    return `<div class="etf-subscore ${tier}">
            <div class="etf-subscore-head"><span class="etf-subscore-name">${esc(label)}</span><span class="etf-subscore-number">${sub.value}</span></div>
            <div class="etf-subscore-track"><span class="etf-subscore-fill" style="inline-size:${sub.value}%"></span></div>
            <details class="etf-evidence"><summary>${esc(t('How this was measured', 'كيف قيس هذا'))}</summary><ul>${evidence}</ul></details>
          </div>`;
  }).join('\n          ');

  // One line for everything not yet measurable, instead of a row each.
  const pendingBlock = pending.length
    ? `<p class="etf-pending-note">${esc(t(
      `Not yet measurable for this fund: ${pending.map(([key]) => (SUBSCORE_LABELS[key] ? SUBSCORE_LABELS[key][0] : humanise(key)).toLowerCase()).join(', ')}. Their weight is redistributed across the components above.`,
      `غير قابلة للقياس بعد لهذا الصندوق: ${pending.map(([key]) => (SUBSCORE_LABELS[key] ? SUBSCORE_LABELS[key][1] : humanise(key))).join('، ')}. ويُعاد توزيع أوزانها على المكوّنات أعلاه.`,
    ))}</p>`
    : '';

  const coverage = `<span class="etf-coverage-chip">${esc(t(
    `${(score.model_coverage * 100).toFixed(0)}% of model measured`,
    `تم قياس ${(score.model_coverage * 100).toFixed(0)}% من النموذج`,
  ))}</span>`;

  return section('etf-score-breakdown', t('TradeAlpha Score', 'مؤشر TradeAlpha'), t('How this fund scores', 'كيف يُقيَّم هذا الصندوق'),
    `<div class="market-panel">
          <div class="etf-score-meta-row">${coverage}<a class="etf-method-link" href="${ar ? '/ar/etfs/methodology/' : '/etfs/methodology/'}">${esc(t('How the score works', 'كيف يعمل المؤشر'))}</a></div>
          <div class="etf-subscores">
          ${rows}
          </div>
          ${pendingBlock}
        </div>`);
}

// ---------------------------------------------------------------------------
// Fund information
// ---------------------------------------------------------------------------

const INFO_FIELDS = [
  'fund_name', 'issuer', 'benchmark', 'exchange', 'currency',
  'listing_date', 'isin', 'ter_pct', 'domicile', 'replication',
  'distribution', 'inception', 'aum',
];

function fundInformation(ar, entry, facts) {
  const t = tr(ar);
  const fields = (facts && facts.fields) || {};

  const present = INFO_FIELDS.filter((name) => P.hasValue(fields[name]));
  const pending = INFO_FIELDS.filter((name) => !P.hasValue(fields[name]));

  // Only fields we actually have get a row. Repeating a status thirteen times
  // taught the reader nothing; one line at the end says the same thing better.
  const rows = present.map((name) => {
    const record = fields[name];
    const cls = P.auditClass(name, record);
    return `<tr>
            <th scope="row">${esc(fieldLabel(ar, name))}</th>
            <td style="white-space:normal"><strong>${esc(displayValue(ar, name, record))}</strong></td>
            <td style="white-space:normal"><span class="etf-prov etf-prov-${esc(cls)}">${esc(classLabel(ar, cls))}</span></td>
          </tr>`;
  }).join('');

  if (!rows) return '';

  const pendingBlock = pending.length
    ? `<p class="etf-pending-note">${esc(t(
      `Awaiting a verified source: ${pending.map((n) => fieldLabel(false, n).toLowerCase()).join(', ')}.`,
      `بانتظار مصدر موثّق: ${pending.map((n) => fieldLabel(true, n)).join('، ')}.`,
    ))} <a href="${ar ? '/ar/etfs/data-audit/' : '/etfs/data-audit/'}">${esc(t('Why', 'لماذا'))}</a></p>`
    : '';

  return section('etf-fund-information', t('Fund information', 'معلومات الصندوق'), t('Structure and identifiers', 'البنية والمعرّفات'),
    `<div class="etf-table-wrap"><table class="etf-table">
          <thead><tr>
            <th scope="col">${esc(t('Field', 'الحقل'))}</th>
            <th scope="col">${esc(t('Value', 'القيمة'))}</th>
            <th scope="col">${esc(t('Source', 'المصدر'))}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table></div>${pendingBlock}`);
}

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

function performance(ar, analytics) {
  const t = tr(ar);
  if (!analytics || !analytics.available) return '';
  const perf = analytics.performance;
  if (!perf) return '';

  const cells = [];
  for (const [key, en, arText] of HORIZON_LABELS) {
    const cum = perf.cumulative[key];
    const ann = perf.annualized[key];
    if (cum === null && ann === null) continue;
    const note = ann !== null ? `${pct(ann)} ${t('annualised', 'سنويا')}` : t('cumulative', 'تراكمي');
    cells.push(stat(ar ? arText : en, signedPct(cum), note));
  }
  if (perf.cumulative.since_listing !== null) {
    const ann = perf.annualized.since_listing;
    cells.push(stat(t('Since listing', 'منذ الإدراج'), signedPct(perf.cumulative.since_listing), ann !== null ? `${pct(ann)} ${t('annualised', 'سنويا')}` : null));
  }
  if (!cells.filter(Boolean).length) return '';

  const relRows = [];
  const BENCH_LABELS = { sp500: ['S&P 500', 'S&P 500'], nasdaq100: ['Nasdaq-100', 'ناسداك 100'], world: ['MSCI World', 'MSCI العالمي'] };
  let suppressed = null;
  for (const [key, block] of Object.entries(analytics.relative || {})) {
    const label = BENCH_LABELS[key] ? (ar ? BENCH_LABELS[key][1] : BENCH_LABELS[key][0]) : key;
    if (!block) continue;
    if (block.unavailable === 'currency_mismatch') { suppressed = block; continue; }
    const values = HORIZON_LABELS.map(([h]) => {
      const v = block[h];
      return v === null
        ? `<td class="num etf-awaiting">${esc(t(P.AWAITING_EN, P.AWAITING_AR))}</td>`
        : `<td class="num ${v >= 0 ? 'positive' : 'negative'}">${esc(signedPct(v))}</td>`;
    }).join('');
    relRows.push(`<tr><th scope="row">${esc(label)}</th>${values}</tr>`);
  }

  let relative = '';
  if (relRows.length) {
    const heads = HORIZON_LABELS.map(([, en, arText]) => `<th scope="col" class="num">${esc(ar ? arText : en)}</th>`).join('');
    relative = `<h3 style="margin-block-start:22px">${esc(t('Return gap versus benchmarks', 'الفارق في العائد مقابل المؤشرات'))}</h3>
        <div class="etf-table-wrap"><table class="etf-table">
          <thead><tr><th scope="col">${esc(t('Benchmark', 'المؤشر'))}</th>${heads}</tr></thead>
          <tbody>${relRows.join('')}</tbody>
        </table></div>`;
  } else if (suppressed) {
    relative = `<div class="etf-note">${esc(t(
      `Benchmark-relative figures are withheld for this fund. It trades in ${suppressed.fund_currency} while the benchmark proxies are quoted in ${suppressed.benchmark_currency}, so any comparison would report the exchange-rate move as fund performance.`,
      `حُجبت الأرقام النسبية مقابل المؤشر لهذا الصندوق. فهو يُتداول بعملة ${suppressed.fund_currency} بينما تُسعَّر المؤشرات البديلة بعملة ${suppressed.benchmark_currency}، ما يجعل أي مقارنة تُظهر حركة سعر الصرف وكأنها أداء للصندوق.`,
    ))}</div>`;
  }

  const basisNote = analytics.return_basis === 'total_return'
    ? t('Total return with distributions reinvested.', 'العائد الإجمالي مع إعادة استثمار التوزيعات.')
    : t('Price return only — distributions are not reflected.', 'عائد سعري فقط — لا يعكس التوزيعات.');

  return section('etf-performance', t('Performance', 'الأداء'), t('Historical measurement', 'القياس التاريخي'),
    `<div class="market-panel">
          <div class="etf-grid narrow">${cells.join('')}</div>
          ${relative}
          <p class="etf-source" style="margin-block-start:14px">${esc(basisNote)} ${esc(t(
      `Derived by TradeAlphaAI from ${analytics.bars} verified daily closes between ${analytics.first_observation} and ${analytics.last_observation}, in ${analytics.currency}. Past measurement does not indicate future results.`,
      `مشتقة بواسطة TradeAlphaAI من ${analytics.bars} إغلاقا يوميا موثّقا بين ${analytics.first_observation} و${analytics.last_observation}، بعملة ${analytics.currency}. والقياس السابق لا يدل على نتائج مستقبلية.`,
    ))}</p>
        </div>`);
}

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

function risk(ar, analytics) {
  const t = tr(ar);
  if (!analytics || !analytics.available || !analytics.risk) return '';
  const r = analytics.risk;
  const tiles = [
    stat(t('Volatility (1Y)', 'التذبذب (سنة)'), pct(r.volatility_1y)),
    stat(t('Volatility (3Y)', 'التذبذب (3 سنوات)'), pct(r.volatility_3y)),
    stat(t('Maximum drawdown', 'أقصى تراجع'), pct(r.max_drawdown)),
    stat(t('Sharpe ratio', 'نسبة شارب'), ratio(r.sharpe)),
    stat(t('Sortino ratio', 'نسبة سورتينو'), ratio(r.sortino)),
    stat(t('Beta vs MSCI World', 'بيتا مقابل MSCI العالمي'), ratio(r.beta_vs_world_proxy)),
    stat(t('Tracking error', 'خطأ التتبع'), pct(r.tracking_error_vs_world_proxy, 2)),
    stat(t('Correlation vs MSCI World', 'الارتباط مقابل MSCI العالمي'), ratio(r.correlation_vs_world_proxy)),
  ].filter(Boolean);
  if (!tiles.length) return '';

  const note = String(r.benchmark_comparability || '').startsWith('suppressed_')
    ? `<div class="etf-note">${esc(t(
      'Beta, tracking error and correlation are withheld here because this fund and the benchmark proxy are quoted in different currencies — the result would measure the exchange rate as much as the fund.',
      'حُجبت بيتا وخطأ التتبع والارتباط هنا لأن هذا الصندوق والمؤشر البديل مسعّران بعملتين مختلفتين — إذ ستقيس النتيجة سعر الصرف بقدر ما تقيس الصندوق.',
    ))}</div>`
    : '';

  return section('etf-risk', t('Risk', 'المخاطر'), t('Observed risk profile', 'ملف المخاطر المرصود'),
    `<div class="market-panel">
          <div class="etf-grid narrow">${tiles.join('')}</div>
          ${note}
          <p class="etf-source" style="margin-block-start:14px">${esc(t(
      'All figures are derived by TradeAlphaAI from verified daily closes. Volatility, Sharpe and Sortino are annualised; drawdown is the deepest peak-to-trough decline in the observed window.',
      'جميع الأرقام مشتقة بواسطة TradeAlphaAI من إغلاقات يومية موثّقة. ويُحتسب التذبذب وشارب وسورتينو على أساس سنوي، أما التراجع فهو أعمق هبوط من القمة إلى القاع ضمن النافذة المرصودة.',
    ))}</p>
        </div>`);
}

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------

function cost(ar, facts, analytics) {
  const t = tr(ar);
  const fields = (facts && facts.fields) || {};
  const ter = fields.ter_pct;

  if (!P.hasValue(ter)) {
    // The section stays, stating the gap plainly rather than disappearing.
    return section('etf-cost', t('Cost analysis', 'تحليل التكلفة'), t('What holding this costs', 'كم يكلّف الاحتفاظ به'),
      `<div class="market-panel">
          <p class="market-copy etf-awaiting">${esc(t(P.AWAITING_EN, P.AWAITING_AR))}</p>
          <p class="market-copy">${esc(t(
        'No free, checkable source publishes this fund\'s expense ratio, so no cost figure or fee projection is shown. Publishing an approximate cost would be worse than publishing none — ongoing charges compound, and an error here misleads more than it informs.',
        'لا يوجد مصدر مجاني قابل للتحقق ينشر نسبة مصاريف هذا الصندوق، لذا لا يُعرض أي رقم للتكلفة أو إسقاط للرسوم. فنشر تكلفة تقريبية أسوأ من عدم النشر — لأن الرسوم الجارية تتراكم، والخطأ هنا يضلل أكثر مما يفيد.',
      ))}</p>
          <div class="etf-note">${esc(t(
        'The expense ratio is published in the fund\'s own KIID or factsheet. Connecting a verified data source will populate this section, the cost component of the score, and the lowest-cost ranking together.',
        'تُنشر نسبة المصاريف في وثيقة معلومات المستثمر أو نشرة الصندوق. وسيؤدي ربط مصدر بيانات موثّق إلى تعبئة هذا القسم ومكوّن التكلفة في الدرجة وترتيب الأقل تكلفة معا.',
      ))}</div>
        </div>`);
  }

  const value = ter.value;
  const currency = (analytics && analytics.currency) || 'USD';
  const rows = [10, 20].map((years) => {
    const remaining = (1 - value / 100) ** years;
    const drag = 10000 * (1 - remaining);
    return `<tr><th scope="row">${esc(`10,000 ${currency}`)}</th><td class="num">${years}</td><td class="num">${esc(`${drag.toFixed(0)} ${currency}`)}</td></tr>`;
  }).join('');

  return section('etf-cost', t('Cost analysis', 'تحليل التكلفة'), t('What holding this costs', 'كم يكلّف الاحتفاظ به'),
    `<div class="market-panel">
          <div class="etf-grid narrow">
            ${stat(t('Total expense ratio', 'نسبة المصاريف الإجمالية'), `${value}%`, t('per year', 'سنويا'))}
            ${stat(t('Annual cost per 10,000', 'التكلفة السنوية لكل 10,000'), `${(10000 * value / 100).toFixed(0)} ${currency}`)}
          </div>
          <h3 style="margin-block-start:22px">${esc(t('Cumulative fee drag', 'الأثر التراكمي للرسوم'))}</h3>
          <div class="etf-table-wrap"><table class="etf-table">
            <thead><tr><th scope="col">${esc(t('Amount held', 'المبلغ المحتفظ به'))}</th><th scope="col" class="num">${esc(t('Years', 'السنوات'))}</th><th scope="col" class="num">${esc(t('Paid in fees', 'المدفوع كرسوم'))}</th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
          <div class="etf-note">${esc(t(
      'This isolates the expense ratio compounded over time, assuming no market growth. It excludes broker commissions, bid-ask spread and taxes, which vary by broker, venue and country.',
      'يعزل هذا الحساب نسبة المصاريف مركَّبة عبر الزمن بافتراض عدم وجود نمو سوقي. وهو يستثني عمولات الوسيط وفارق العرض والطلب والضرائب، لاختلافها باختلاف الوسيط والسوق والدولة.',
    ))}</div>
          <p class="etf-source" style="margin-block-start:10px">${provenanceNote(ar, ter)}</p>
        </div>`);
}

// ---------------------------------------------------------------------------
// Similar funds
// ---------------------------------------------------------------------------

function similar(ar, similarity, factsBySlug) {
  const t = tr(ar);
  if (!similarity || !similarity.available || !similarity.peers.length) return '';

  const rows = similarity.peers.map((peer) => {
    const peerFacts = factsBySlug && factsBySlug.get ? factsBySlug.get(peer.slug) : null;
    const name = peerFacts && P.hasValue(peerFacts.fields.fund_name) ? peerFacts.fields.fund_name.value : peer.symbol;
    const href = `${ar ? '/ar' : ''}/research/etfs/${peer.slug}/`;
    return `<div class="etf-similar-row">
            <a class="etf-similar-symbol" href="${esc(href)}">${esc(peer.symbol)}</a>
            <div><div class="etf-similar-track"><span class="etf-similar-fill" style="inline-size:${peer.similarity_pct}%"></span></div><span class="etf-source">${esc(name)}</span></div>
            <span class="etf-similar-pct">${peer.similarity_pct}%</span>
          </div>`;
  }).join('\n          ');

  return section('etf-similar', t('Similar funds', 'صناديق مشابهة'), t('Funds that have behaved alike', 'صناديق تشابه سلوكها'),
    `<div class="market-panel">
          <div class="etf-similar">
          ${rows}
          </div>
          <p class="etf-source" style="margin-block-start:14px">${esc(t(
      'Similarity is derived from observed return correlation, volatility proximity and structural agreement. It describes how alike two funds have behaved historically — it is not a ranking and not a substitute.',
      'مقياس التشابه مشتق من الارتباط المرصود للعوائد وتقارب التذبذب والاتفاق الهيكلي. وهو يصف مدى تشابه سلوك الصندوقين تاريخيا — وليس ترتيبا ولا بديلا.',
    ))}</p>
        </div>`);
}

// ---------------------------------------------------------------------------
// Exposure profile
// ---------------------------------------------------------------------------

const RESEARCH_CONTEXTS = {
  world_equity: [['Single-fund global coverage', 'تغطية عالمية بصندوق واحد'], ['Long-horizon core holdings', 'مكوّنات جوهرية طويلة الأجل'], ['Regular monthly accumulation', 'تراكم شهري منتظم']],
  broad_market: [['Broad domestic equity exposure', 'تعرض واسع لأسهم السوق المحلي'], ['Benchmark reference', 'مرجع للقياس'], ['Long-horizon core holdings', 'مكوّنات جوهرية طويلة الأجل']],
  dividend_quality: [['Income orientation', 'توجه نحو الدخل'], ['Defensive equity tilt', 'ميل دفاعي في الأسهم']],
  growth: [['Growth-oriented exposure', 'تعرض موجّه نحو النمو'], ['Higher volatility tolerance', 'تحمّل أعلى للتذبذب']],
  value: [['Value-oriented exposure', 'تعرض موجّه نحو القيمة'], ['Cyclical tilt', 'ميل دوري']],
  sector: [['Sector-specific research', 'بحث خاص بقطاع محدد'], ['Rotation analysis', 'تحليل التدوير القطاعي']],
  semiconductors: [['Industry-concentrated exposure', 'تعرض مركّز على صناعة بعينها'], ['High volatility tolerance', 'تحمّل مرتفع للتذبذب']],
  thematic_ai: [['Thematic exposure', 'تعرض موضوعي'], ['High volatility tolerance', 'تحمّل مرتفع للتذبذب']],
  fixed_income: [['Duration and rates context', 'سياق المدة وأسعار الفائدة'], ['Portfolio ballast', 'موازن للمحفظة']],
  credit: [['Credit-spread context', 'سياق فروقات الائتمان'], ['Risk-appetite reading', 'قراءة شهية المخاطر']],
  commodity: [['Diversification away from equities', 'تنويع بعيدا عن الأسهم'], ['Inflation context', 'سياق التضخم']],
  real_estate: [['Real-asset exposure', 'تعرض للأصول العينية'], ['Rate sensitivity research', 'بحث حساسية أسعار الفائدة']],
  emerging_markets: [['Emerging-market allocation', 'تخصيص للأسواق الناشئة'], ['Pairing with a developed core', 'الإقران بنواة من الأسواق المتقدمة']],
  esg: [['Screened equity exposure', 'تعرض للأسهم بعد الفرز'], ['Long-horizon core holdings', 'مكوّنات جوهرية طويلة الأجل']],
};

function exposureProfile(ar, entry, analytics, facts) {
  const t = tr(ar);
  const contexts = RESEARCH_CONTEXTS[entry.category] || [];
  const fields = (facts && facts.fields) || {};
  const chips = contexts.map(([en, arText]) => `<span class="etf-chip accent">${esc(ar ? arText : en)}</span>`);

  const dist = fields.distribution;
  if (P.hasValue(dist) && dist.value === 'accumulating') {
    chips.push(`<span class="etf-chip">${esc(t('Accumulation without manual reinvestment', 'تراكم دون إعادة استثمار يدوية'))}</span>`);
  }
  if (P.hasValue(dist) && dist.value === 'distributing') {
    chips.push(`<span class="etf-chip">${esc(t('Cash income received directly', 'دخل نقدي يُستلم مباشرة'))}</span>`);
  }
  if (!chips.length) return '';

  const considerations = [];
  if (analytics && analytics.risk) {
    const dd = analytics.risk.max_drawdown;
    if (Number.isFinite(dd) && dd <= -0.30) {
      considerations.push(t(
        `This fund has fallen ${Math.abs(dd * 100).toFixed(0)}% peak-to-trough within the observed window.`,
        `تراجع هذا الصندوق بنسبة ${Math.abs(dd * 100).toFixed(0)}% من القمة إلى القاع ضمن النافذة المرصودة.`,
      ));
    }
    const vol = analytics.risk.volatility_1y;
    if (Number.isFinite(vol) && vol >= 0.25) {
      considerations.push(t(
        `Trailing one-year volatility of ${(vol * 100).toFixed(0)}% places it among the more volatile funds covered here.`,
        `يضعه تذبذب السنة الماضية البالغ ${(vol * 100).toFixed(0)}% ضمن الصناديق الأكثر تذبذبا المغطاة هنا.`,
      ));
    }
  }

  const considerationBlock = considerations.length
    ? `<h3 style="margin-block-start:20px">${esc(t('Structural considerations', 'اعتبارات هيكلية'))}</h3><ul class="market-copy">${considerations.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`
    : '';

  return section('etf-exposure-profile', t('Exposure profile', 'ملف التعرض'), t('Where this sits in a portfolio', 'أين يقع هذا ضمن المحفظة'),
    `<div class="market-panel">
          <p class="market-copy">${esc(t('Contexts in which this exposure is commonly researched:', 'السياقات التي يُبحث فيها هذا التعرض عادة:'))}</p>
          <div class="etf-chips">${chips.join('')}</div>
          ${considerationBlock}
          <div class="etf-note">${esc(t(
      'These are TradeAlphaAI classifications describing what the fund is exposed to and how it has behaved, not guidance about whether it suits any particular person.',
      'هذه تصنيفات من TradeAlphaAI تصف ما يتعرض له الصندوق وكيف تصرّف تاريخيا، وليست إرشادا بشأن ملاءمته لأي شخص بعينه.',
    ))}</div>
        </div>`);
}

// ---------------------------------------------------------------------------
// Provenance audit — the explicit verified/derived listing
// ---------------------------------------------------------------------------

function provenanceAudit(ar, entry, facts, analytics, score) {
  const t = tr(ar);
  const fields = (facts && facts.fields) || {};
  const counts = facts ? facts.provenance_counts : P.summarise(fields);

  const factRows = INFO_FIELDS.map((name) => {
    const record = fields[name];
    const cls = P.auditClass(name, record);
    return `<tr>
            <th scope="row">${esc(fieldLabel(ar, name))}</th>
            <td><span class="etf-prov etf-prov-${esc(cls)}">${esc(classLabel(ar, cls))}</span></td>
            <td style="white-space:normal"><span class="etf-source">${provenanceNote(ar, record)}</span></td>
          </tr>`;
  }).join('');

  // Everything computed on this page, listed as derived with its input.
  const derivedRows = [
    [t('Performance (all horizons)', 'الأداء (كل الآفاق)'), analytics && analytics.available],
    [t('Volatility, drawdown, Sharpe, Sortino', 'التذبذب والتراجع وشارب وسورتينو'), analytics && analytics.available],
    [t('Beta, tracking error, correlation', 'بيتا وخطأ التتبع والارتباط'), analytics && analytics.risk && analytics.risk.benchmark_comparability === 'same_currency'],
    [t('Observed liquidity', 'السيولة المرصودة'), analytics && analytics.liquidity && analytics.liquidity.median_daily_turnover !== null],
    [t('Similar funds', 'الصناديق المشابهة'), true],
    [t('TradeAlpha Score', 'مؤشر TradeAlpha'), score && score.overall !== null],
  ].map(([label, ok]) => `<tr>
            <th scope="row">${esc(label)}</th>
            <td><span class="etf-prov etf-prov-${ok ? 'derived' : 'unavailable'}">${esc(ok ? classLabel(ar, 'derived') : classLabel(ar, 'unavailable'))}</span></td>
            <td style="white-space:normal"><span class="etf-source">${esc(ok
    ? t('Computed by TradeAlphaAI from verified daily closing prices', 'محتسب بواسطة TradeAlphaAI من أسعار إغلاق يومية موثّقة')
    : t('Inputs not available for this fund', 'المدخلات غير متوفرة لهذا الصندوق'))}</span></td>
          </tr>`).join('');

  const classificationRow = `<tr>
            <th scope="row">${esc(t('Category and exposure type', 'الفئة ونوع التعرض'))}</th>
            <td><span class="etf-prov etf-prov-declared">${esc(classLabel(ar, 'declared'))}</span></td>
            <td style="white-space:normal"><span class="etf-source">${esc(t('Authored by TradeAlphaAI as an editorial classification, not a fund fact', 'من تأليف TradeAlphaAI كتصنيف تحريري، وليست حقيقة عن الصندوق'))}</span></td>
          </tr>`;

  return section('etf-provenance-audit', t('Data provenance', 'مصادر البيانات'), t('What is verified on this page, and what is not', 'ما هو موثّق في هذه الصفحة وما ليس كذلك'),
    `<div class="market-panel">
          <div class="etf-grid narrow">
            ${stat(t('Verified fields', 'حقول موثّقة'), String(counts.fetched || 0))}
            ${stat(t('Derived fields', 'حقول مشتقة'), String(counts.derived || 0))}
            ${stat(t('Project registry', 'سجل المشروع'), String(counts.registry || 0))}
            ${stat(t('Awaiting verified data', 'بانتظار بيانات موثّقة'), String(counts.unavailable || 0))}
          </div>
          <h3 style="margin-block-start:20px">${esc(t('Fund facts', 'حقائق الصندوق'))}</h3>
          <div class="etf-table-wrap"><table class="etf-table">
            <thead><tr><th scope="col">${esc(t('Field', 'الحقل'))}</th><th scope="col">${esc(t('Status', 'الحالة'))}</th><th scope="col">${esc(t('Basis', 'الأساس'))}</th></tr></thead>
            <tbody>${factRows}${classificationRow}</tbody>
          </table></div>
          <h3 style="margin-block-start:20px">${esc(t('Measurements', 'القياسات'))}</h3>
          <div class="etf-table-wrap"><table class="etf-table">
            <thead><tr><th scope="col">${esc(t('Measure', 'المقياس'))}</th><th scope="col">${esc(t('Status', 'الحالة'))}</th><th scope="col">${esc(t('Basis', 'الأساس'))}</th></tr></thead>
            <tbody>${derivedRows}</tbody>
          </table></div>
          <div class="etf-note">${esc(t(
      'No value on this page is asserted from prior knowledge. Anything that cannot be traced to a provider response, a computation over verified prices, or a labelled TradeAlphaAI classification is published as awaiting verified data.',
      'لا تُؤكَّد أي قيمة في هذه الصفحة استنادا إلى معرفة سابقة. وكل ما لا يمكن إرجاعه إلى استجابة مزود أو حساب على أسعار موثّقة أو تصنيف مُعلَن من TradeAlphaAI يُنشر على أنه بانتظار بيانات موثّقة.',
    ))} <a href="${ar ? '/ar/etfs/data-audit/' : '/etfs/data-audit/'}">${esc(t('Coverage across all funds', 'التغطية عبر كل الصناديق'))}</a></div>
        </div>`);
}

/** All premium sections, in reading order. */
function premiumSections(ar, entry, data) {
  const { facts, analytics, score, similarity, factsBySlug } = data;
  return [
    scoreBreakdown(ar, score, data.config),
    performance(ar, analytics),
    risk(ar, analytics),
    fundInformation(ar, entry, facts),
    cost(ar, facts, analytics),
    exposureProfile(ar, entry, analytics, facts),
    similar(ar, similarity, factsBySlug),
    provenanceAudit(ar, entry, facts, analytics, score),
  ].filter(Boolean).join('\n');
}

module.exports = {
  premiumSections, heroExtra, scoreDial, scoreBreakdown, fundInformation,
  performance, risk, cost, similar, exposureProfile, provenanceAudit,
  section, provenanceNote, displayValue, fieldLabel, classLabel, arLabel,
  REPLICATION_LABELS, DISTRIBUTION_LABELS, RESEARCH_CONTEXTS, SUBSCORE_LABELS,
  INFO_FIELDS, FIELD_LABELS,
};
