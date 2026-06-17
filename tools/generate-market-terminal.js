'use strict';

// Phase 200 / Workstream C — /market-terminal/ + /ar/market-terminal/.
// A centralized institutional dashboard that COMPOSES existing verified
// artifacts into one restrained surface: regime + liquidity snapshot, tactical
// context, market-structure read, cross-asset state, multi-asset chart
// availability, the real SPY OHLCV chart, and links to the latest research /
// market news / structure / educational content. Deterministic, bilingual,
// RTL-correct. No fabrication: every value is read from a canonical artifact and
// degrades honestly to "unavailable / indeterminate". No raw JSON, no
// system-status, no operational monitors are exposed. Production-safe clone of
// the validator-green market-outlook header/footer (no nav re-bake).
//
// Output: market-terminal/index.html, ar/market-terminal/index.html
// Usage:  node tools/generate-market-terminal.js --write

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGIME_PATH = path.join(ROOT, 'data', 'intelligence', 'liquidity-regime.json');
const TACTICAL_PATH = path.join(ROOT, 'data', 'intelligence', 'tactical-context.json');
const STRUCTURE_PATH = path.join(ROOT, 'data', 'intelligence', 'market-structure.json');
const CROSS_PATH = path.join(ROOT, 'data', 'intelligence', 'cross-asset-state.json');
const CHARTS_PATH = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const COGNITIVE_PATH = path.join(ROOT, 'data', 'intelligence', 'cognitive-network.json');
const ASSET_INTEL_PATH = path.join(ROOT, 'data', 'intelligence', 'asset-intelligence.json');
const ASSET_STRUCTURE_PATH = path.join(ROOT, 'data', 'intelligence', 'asset-structure.json');
const ASSET_TACTICAL_PATH = path.join(ROOT, 'data', 'intelligence', 'asset-tactical.json');
const ASSET_LIQUIDITY_PATH = path.join(ROOT, 'data', 'intelligence', 'asset-liquidity.json');
const PROVIDER_COVERAGE_PATH = path.join(ROOT, 'data', 'intelligence', 'provider-coverage.json');
const DATA_QUALITY_PATH = path.join(ROOT, 'data', 'intelligence', 'data-quality.json');
const SECTOR_ROTATION_PATH = path.join(ROOT, 'data', 'intelligence', 'sector-rotation.json');
const SECTOR_COGNITIVE_PATH = path.join(ROOT, 'data', 'intelligence', 'sector-cognitive-network.json');
const SECTOR_STRUCTURE_PATH = path.join(ROOT, 'data', 'intelligence', 'sector-structure.json');
const SECTOR_CHARTS_PATH = path.join(ROOT, 'data', 'visual', 'sector-charts.json');
const SECTOR_REG = require('./sector-registry');
const EQUITY_REG = require('./equity-registry');
const EQUITY_INTEL_PATH = path.join(ROOT, 'data', 'intelligence', 'equity-intelligence.json');
const EQUITY_NETWORK_PATH = path.join(ROOT, 'data', 'intelligence', 'equity-cognitive-network.json');
const DOLLAR_PATH = path.join(ROOT, 'data', 'intelligence', 'dollar-intelligence.json');
const YIELD_PATH = path.join(ROOT, 'data', 'intelligence', 'yield-intelligence.json');
const VOLATILITY_PATH = path.join(ROOT, 'data', 'intelligence', 'volatility-intelligence.json');
const MACRO_REGIME_PATH = path.join(ROOT, 'data', 'intelligence', 'macro-regime.json');
const STALE_HOURS = 72;
const UNAVAIL_REASON_AR = {
  unavailable_offline: 'بانتظار بيانات مزوّد معتمدة', no_provider_keys: 'بانتظار بيانات مزوّد معتمدة',
  rate_limited: 'مؤجَّل بسبب حدود المزوّد', approved_ohlcv_unavailable: 'بيانات OHLCV المعتمدة غير متاحة',
  insufficient_valid_bars: 'عدد الأشرطة الموثّقة غير كافٍ', fixture_missing: 'بيانات المصدر غير متاحة',
};
const UNAVAIL_REASON_EN = {
  unavailable_offline: 'awaiting approved provider data', no_provider_keys: 'awaiting approved provider data',
  rate_limited: 'deferred (provider limit)', approved_ohlcv_unavailable: 'approved OHLCV unavailable',
  insufficient_valid_bars: 'insufficient verified bars', fixture_missing: 'source data unavailable',
};

function readJson(p, fallback = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } }
function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fresh(a) { return a && a.generated_at && (Date.now() - new Date(a.generated_at).getTime()) / 3600000 <= STALE_HOURS; }

// ── Native-Arabic value maps (no English leaks on the AR surface). Unknown
// values fall back to an Arabic neutral term rather than leaking the raw token.
const REGIME_AR = {
  crowded_growth_positioning: 'تموضع نمو مزدحم', risk_on: 'إقبال على المخاطر', risk_off: 'إحجام عن المخاطر',
  defensive_rotation: 'تدوير دفاعي', balanced: 'متوازن', fragile_expansion: 'توسّع هش', stable_expansion: 'توسّع مستقر',
  liquidity_tightening: 'تشديد سيولة', late_cycle: 'مرحلة متأخرة من الدورة', indeterminate: 'غير محدد',
};
const LIQ_AR = { ample: 'وفيرة', tightening: 'متشددة', draining: 'تنزف', supportive: 'داعمة', neutral: 'محايدة', constrained: 'مقيّدة', indeterminate: 'غير محدد' };
const STAB_AR = { stable: 'مستقر', fragile: 'هش', deteriorating: 'يتدهور', improving: 'يتحسّن', firm: 'متين', indeterminate: 'غير محدد' };
const DIR_AR = { risk_on: 'إقبال على المخاطر', risk_off: 'إحجام عن المخاطر', mixed: 'مختلط', neutral: 'محايد', indeterminate: 'غير محدد' };

function humanize(v) { return String(v ?? '').replace(/_/g, ' ').trim() || 'indeterminate'; }
function val(map, v, ar, neutralAr) {
  if (v == null || v === '') return ar ? (neutralAr || 'غير محدد') : 'indeterminate';
  if (ar) return map[v] || neutralAr || 'غير محدد';
  return humanize(v);
}

// ── SEO head (mirrors the structure-index pattern). ──
function buildHead(ar) {
  const url = ar ? 'https://www.tradealphaai.com/ar/market-terminal/' : 'https://www.tradealphaai.com/market-terminal/';
  const title = ar
    ? 'الطرفية المؤسسية للسوق | النظام والسياق التكتيكي والبنية والمخططات | TradeAlphaAI'
    : 'Institutional Market Terminal | Regime, Tactical Context, Structure & Charts | TradeAlphaAI';
  const desc = ar
    ? 'لوحة مؤسسية مركزية: نظام السيولة، والسياق التكتيكي، وبنية السوق، والحالة عبر الأصول، وتوافر المخططات متعددة الأصول، ومخطط SPY المرصود — تركيب حتمي لإشارات موثّقة. سياق تعليمي وليس نصيحة استثمارية أو إشارات تداول.'
    : 'A centralized institutional dashboard: liquidity regime, tactical context, market structure, cross-asset state, multi-asset chart availability and the observed SPY chart — a deterministic composition of verified signals. Educational context, not investment advice or trading signals.';
  const css = ar
    ? ['/css/global-header.css', '../../styles.css', '../../landing.css', '../../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css']
    : ['/css/global-header.css', '../styles.css', '../landing.css', '../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
        { '@type': 'ListItem', position: 2, name: ar ? 'الطرفية المؤسسية' : 'Market Terminal', item: url },
      ] },
    ],
  };
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="https://www.tradealphaai.com/market-terminal/" />
  <link rel="alternate" hreflang="ar" href="https://www.tradealphaai.com/ar/market-terminal/" />
  <link rel="alternate" hreflang="x-default" href="https://www.tradealphaai.com/market-terminal/" />
  <meta property="og:locale" content="${ar ? 'ar_AR' : 'en_US'}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
  <meta property="og:image:alt" content="TradeAlphaAI institutional market terminal preview" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
${css.map((href) => `  <link rel="stylesheet" href="${href}" />`).join('\n')}
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>`;
}

// ── Environment snapshot (regime, liquidity, stability, coherence). ──
function environmentBlock(ar, regime, cross) {
  const t = (en, arT) => (ar ? arT : en);
  if (!fresh(regime)) {
    return `      <section class="market-section" id="market-environment">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Market environment', 'بيئة السوق'))}</span><h2>${esc(t('Market environment', 'بيئة السوق'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t('The market environment read is currently unavailable on the observed dimensions and is reported plainly rather than inferred.', 'قراءة بيئة السوق غير متاحة حالياً وفق الأبعاد المرصودة، وتُذكر صراحة بدل استنتاجها.'))}</p></div>
      </section>`;
  }
  const coherence = (cross && cross.coherence) || (regime && regime.cross_asset_coherence) || {};
  const asOf = (regime.generated_at || '').slice(0, 10) || '—';
  const cards = [
    [t('Regime', 'النظام'), val(REGIME_AR, regime.regime, ar, 'نظام مركّب')],
    [t('Liquidity', 'السيولة'), val(LIQ_AR, regime.liquidity_state, ar)],
    [t('Stability', 'الاستقرار'), val(STAB_AR, regime.stability, ar)],
    [t('Cross-asset coherence', 'الاتساق عبر الأصول'), `${coherence.score != null ? coherence.score : '—'} · ${val(DIR_AR, coherence.direction, ar)}`],
  ];
  return `      <section class="market-section" id="market-environment">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Market environment', 'بيئة السوق'))}</span><h2>${esc(t('Regime, liquidity and stability', 'النظام والسيولة والاستقرار'))}</h2></div>
        <p class="market-copy">${esc(t('Snapshot · as of', 'لقطة · بتاريخ'))} ${esc(asOf)} · ${esc(t('deterministic composition of verified signals', 'تركيب حتمي لإشارات موثّقة'))}</p>
        <div class="market-grid">
${cards.map(([k, v]) => `          <article class="market-card"><span class="market-card-kicker">${esc(k)}</span><h3>${esc(v)}</h3></article>`).join('\n')}
        </div>
      </section>`;
}

// ── Tactical context (advice-free; reads from the tactical-context artifact). ──
function tacticalBlock(ar, tactical) {
  const t = (en, arT) => (ar ? arT : en);
  if (!tactical || tactical.available !== true) {
    return `      <section class="market-section" id="tactical-context">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Tactical context', 'السياق التكتيكي'))}</span><h2>${esc(t('Tactical context', 'السياق التكتيكي'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t('Tactical context is not supported by current evidence and is withheld rather than asserted.', 'السياق التكتيكي غير مدعوم بالأدلة الحالية ويُمتنع عنه بدل تأكيده.'))}</p></div>
      </section>`;
  }
  const dims = tactical.dimensions || {};
  const order = ['tactical_bias', 'directional_pressure', 'continuation', 'participation_quality', 'confirmation_quality', 'liquidity_support'];
  const heads = {
    tactical_bias: t('Bias', 'الانحياز'), directional_pressure: t('Directional pressure', 'الضغط الاتجاهي'),
    continuation: t('Continuation', 'الاستمرارية'), participation_quality: t('Participation', 'المشاركة'),
    confirmation_quality: t('Confirmation', 'التأكيد'), liquidity_support: t('Liquidity support', 'دعم السيولة'),
  };
  const band = ar ? (tactical.confidence_band_ar || tactical.confidence_band) : tactical.confidence_band;
  const cards = order.filter((d) => dims[d]).map((d) => {
    const label = ar ? dims[d].label_ar : dims[d].label_en;
    return `          <article class="market-card"><span class="market-card-kicker">${esc(heads[d])}</span><h3>${esc(label)}</h3></article>`;
  }).join('\n');
  return `      <section class="market-section" id="tactical-context">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Tactical context', 'السياق التكتيكي'))}</span><h2>${esc(t('Conditional tactical read', 'قراءة تكتيكية مشروطة'))}</h2></div>
        <p class="market-copy">${esc(t('Confidence', 'الثقة'))}: ${esc(band)} · ${esc(t('This is probabilistic context, not a forecast or a recommendation.', 'هذا سياق احتمالي، وليس توقعاً ولا توصية.'))}</p>
        <div class="market-grid">
${cards}
        </div>
      </section>`;
}

// ── Market structure read. ──
function structureBlock(ar, structure) {
  const t = (en, arT) => (ar ? arT : en);
  if (!structure || structure.available !== true) {
    return `      <section class="market-section" id="market-structure">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Market structure', 'بنية السوق'))}</span><h2>${esc(t('Market structure', 'بنية السوق'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t('The structural read is currently indeterminate and is reported plainly rather than inferred.', 'القراءة الهيكلية غير محددة حالياً وتُذكر صراحة بدل استنتاجها.'))}</p></div>
      </section>`;
  }
  const dims = structure.dimensions || {};
  const order = ['participation', 'volatility_structure', 'cross_asset', 'rotation', 'concentration', 'stability'];
  const heads = {
    participation: t('Participation', 'المشاركة'), volatility_structure: t('Volatility', 'التذبذب'), cross_asset: t('Cross-asset', 'عبر الأصول'),
    rotation: t('Rotation', 'التدوير'), concentration: t('Concentration', 'التركّز'), stability: t('Stability', 'الاستقرار'),
  };
  const cards = order.filter((d) => dims[d]).map((d) => `          <article class="market-card"><span class="market-card-kicker">${esc(heads[d])}</span><h3>${esc(ar ? dims[d].label_ar : dims[d].label_en)}</h3></article>`).join('\n');
  return `      <section class="market-section" id="market-structure">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Market structure', 'بنية السوق'))}</span><h2>${esc(t('What the structure desk reads', 'ما يقرأه مكتب البنية'))}</h2></div>
        <p class="market-copy">${esc(t('Structural confidence', 'الثقة الهيكلية'))} ${esc(structure.structural_confidence != null ? structure.structural_confidence : '—')}/100 · <a href="${ar ? '/ar/market-structure/' : '/market-structure/'}">${esc(t('full structure desk', 'مكتب البنية الكامل'))}</a></p>
        <div class="market-grid three">
${cards}
        </div>
      </section>`;
}

// ── Multi-asset chart availability + embedded SPY chart (real OHLCV only). ──
const UNAVAIL_AR = {
  unavailable_offline: 'بانتظار بيانات مزوّد معتمدة', no_provider_keys: 'بانتظار بيانات مزوّد معتمدة',
  rate_limited: 'مؤجَّل مؤقتاً بسبب حدود المزوّد', approved_ohlcv_unavailable: 'بيانات OHLCV المعتمدة غير متاحة',
  insufficient_valid_bars: 'عدد الأشرطة الموثّقة غير كافٍ', fixture_missing: 'بيانات المصدر غير متاحة',
};
const UNAVAIL_EN = {
  unavailable_offline: 'awaiting approved provider data', no_provider_keys: 'awaiting approved provider data',
  rate_limited: 'temporarily deferred (provider limit)', approved_ohlcv_unavailable: 'approved OHLCV unavailable',
  insufficient_valid_bars: 'insufficient verified bars', fixture_missing: 'source data unavailable',
};

function tacticalLinkageInline(chart, tactical, ar) {
  const SS = ar ? { supported: 'مدعومة بالمخطط', mixed: 'مختلطة', unsupported: 'غير مدعومة بالمخطط', unavailable: 'الأدلة غير متاحة' }
    : { supported: 'chart-supported', mixed: 'mixed', unsupported: 'not chart-supported', unavailable: 'evidence unavailable' };
  const LL = ar ? { supportive: 'بنية داعمة', fragile: 'استمرار هش', narrowing: 'مشاركة آخذة في التضيّق', liquidity: 'ضغط سيولة', fading: 'ضغط متلاشٍ', mixed: 'تأكيد مختلط', unavailable: 'الأدلة غير متاحة' }
    : { supportive: 'supportive structure', fragile: 'fragile continuation', narrowing: 'narrowing participation', liquidity: 'liquidity pressure', fading: 'fading pressure', mixed: 'mixed confirmation', unavailable: 'evidence unavailable' };
  if (!tactical || tactical.available !== true) return { state: SS.unavailable, label: LL.unavailable };
  const d = tactical.dimensions || {};
  const st = (k) => (d[k] ? d[k].state : null);
  const so = (chart.overlays || []).find((o) => o.type === 'structure');
  const chartBias = so && so.state === 'expansion_up' ? 1 : so && so.state === 'expansion_down' ? -1 : 0;
  const dp = st('directional_pressure'); const cont = st('continuation');
  let tacBias = 0;
  if (dp === 'building') tacBias = 1;
  else if (dp === 'fading' || dp === 'stalling' || cont === 'fragile_continuation' || cont === 'exhaustion_risk') tacBias = -1;
  let state = chartBias === tacBias ? SS.supported : (chartBias === 0 || tacBias === 0 ? SS.mixed : SS.unsupported);
  let label;
  if (cont === 'fragile_continuation' || cont === 'exhaustion_risk') label = LL.fragile;
  else if (st('participation_quality') === 'narrowing' || st('participation_quality') === 'narrow') label = LL.narrowing;
  else if (st('liquidity_support') === 'draining') label = LL.liquidity;
  else if (dp === 'fading' || dp === 'stalling') label = LL.fading;
  else if (tacBias > 0 && chartBias >= 0) label = LL.supportive;
  else label = LL.mixed;
  return { state, label };
}

function chartFigure(chart, ar, tactical) {
  if (!chart || !chart.files || !chart.files[ar ? 'ar' : 'en']) return '';
  let svg = '';
  try { svg = fs.readFileSync(path.join(ROOT, chart.files[ar ? 'ar' : 'en']), 'utf8'); } catch { return ''; }
  svg = svg.replace(/(<svg\b[^>]*?)\s+width="\d+"\s+height="\d+"/, '$1');
  const title = ar ? chart.title_ar : chart.title_en;
  const hook = chart.narrative_hook && chart.narrative_hook[ar ? 'ar' : 'en'];
  const provider = (chart.attribution && chart.attribution.provider) || '—';
  const srcWord = ar ? 'المصدر' : 'Source';
  const asOfWord = ar ? 'بتاريخ' : 'As of';
  const relevanceTopic = (chart.related_topics || [])[0] || chart.chart_type || chart.visual_type || 'structure';
  const link = tacticalLinkageInline(chart, tactical, ar);
  const linkLine = ar
    ? `الارتباط التكتيكي: القراءة الهيكلية ${link.state} بهذه البنية السعرية (${link.label}).`
    : `Tactical linkage: the structural read is ${link.state} by this price structure (${link.label}).`;
  return `<figure class="institutional-chart" data-symbol="${esc(chart.symbol)}" data-chart-type="${esc(chart.chart_type || chart.visual_type)}" data-series-hash="${esc(chart.series_hash)}" data-as-of="${esc(chart.as_of)}" data-relevance-topic="${esc(relevanceTopic)}">
  <div class="ic-svg">${svg}</div>
  <figcaption class="ic-caption">
    <span class="ic-hook">${esc(hook || title)}</span>
    <span class="ic-linkage" data-support="${esc(link.state)}">${esc(linkLine)}</span>
    <span class="ic-attrib">${esc(`${srcWord}: ${provider} · ${asOfWord} ${chart.as_of}`)}</span>
  </figcaption>
</figure>`;
}

function chartsBlock(ar, charts, tactical) {
  const t = (en, arT) => (ar ? arT : en);
  const manifest = charts || {};
  const available = (manifest.charts || []).filter((c) => c && c.verified === true);
  const unavailable = manifest.unavailable || [];
  const spy = available.find((c) => c.symbol === 'SPY') || available[0] || null;

  // Availability grid — honest per-asset state (no placeholder charts).
  const availCards = available.map((c) => `          <article class="market-card"><span class="market-card-kicker">${esc(c.symbol)}</span><h3>${esc(t('chart available', 'مخطط متاح'))}</h3><p class="market-copy">${esc(t('As of', 'بتاريخ'))} ${esc(c.as_of)}</p></article>`);
  const unavailCards = unavailable.map((u) => `          <article class="market-card"><span class="market-card-kicker">${esc(u.symbol)}</span><h3>${esc(t('unavailable', 'غير متاح'))}</h3><p class="market-copy">${esc(ar ? (UNAVAIL_AR[u.reason] || 'غير متاح') : (UNAVAIL_EN[u.reason] || 'unavailable'))}</p></article>`);
  const grid = availCards.concat(unavailCards).join('\n');
  const fig = spy ? chartFigure(spy, ar, tactical) : '';
  const figBlock = fig
    ? `        <div class="market-panel">${fig}</div>`
    : `        <div class="market-panel"><p class="market-copy">${esc(t('No verified institutional chart is available right now; no placeholder chart is shown.', 'لا يوجد مخطط مؤسسي موثّق متاح حالياً، ولا يُعرض أي مخطط بديل.'))}</p></div>`;

  return `      <section class="market-section" id="institutional-charts">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Institutional charts', 'المخططات المؤسسية'))}</span><h2>${esc(t('Multi-asset chart availability', 'توافر المخططات متعددة الأصول'))}</h2></div>
        <p class="market-copy">${esc(t('Real sourced OHLCV only. Assets without approved provider data are shown as unavailable — never as a fabricated chart.', 'بيانات OHLCV موثّقة فقط. تُعرض الأصول التي لا تتوفر لها بيانات مزوّد معتمدة بوصفها غير متاحة — لا كمخطط مُفبرك أبداً.'))}</p>
        <div class="market-grid">
${grid}
        </div>
${figBlock}
      </section>`;
}

// ── Latest intelligence links (outbound to content surfaces). ──
function latestFrom(relDir, hrefBase, limit = 3) {
  const dir = path.join(ROOT, relDir);
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html'); } catch { return []; }
  return files.map((f) => {
    let title = f.replace(/\.html$/, '');
    let mtime = 0;
    try { mtime = fs.statSync(path.join(dir, f)).mtimeMs; } catch { /* keep */ }
    try { const m = fs.readFileSync(path.join(dir, f), 'utf8').match(/<h1>([\s\S]*?)<\/h1>/i); if (m) title = m[1].replace(/<[^>]+>/g, '').trim(); } catch { /* keep slug */ }
    return { href: `${hrefBase}${f}`, title, mtime };
  }).sort((a, b) => b.mtime - a.mtime).slice(0, limit);
}

function latestBlock(ar) {
  const t = (en, arT) => (ar ? arT : en);
  const groups = [
    [t('Latest research & news', 'أحدث الأبحاث والأخبار'), latestFrom(ar ? 'ar/market-news' : 'market-news', ar ? '/ar/market-news/' : '/market-news/', 3)],
    [t('Latest structure notes', 'أحدث مذكرات البنية'), latestFrom(ar ? 'ar/market-structure' : 'market-structure', ar ? '/ar/market-structure/' : '/market-structure/', 3)],
    [t('Latest educational concepts', 'أحدث المفاهيم التعليمية'), latestFrom(ar ? 'ar/articles' : 'articles', ar ? '/ar/articles/' : '/articles/', 3)],
  ].filter(([, items]) => items.length);
  if (!groups.length) return '';
  const cards = groups.map(([head, items]) => `          <article class="market-card"><span class="market-card-kicker">${esc(head)}</span>
${items.map((i) => `            <h3><a href="${esc(i.href)}">${esc(i.title)}</a></h3>`).join('\n')}
          </article>`).join('\n');
  return `      <section class="market-section" id="latest-intelligence">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Latest intelligence', 'أحدث الاستخبارات'))}</span><h2>${esc(t('Across the desk', 'عبر المكتب'))}</h2></div>
        <div class="market-grid three">
${cards}
        </div>
      </section>`;
}

// ── Asset intelligence table — per-asset score + link to the asset page. ──
function assetIntelBlock(ar, intel) {
  const t = (en, arT) => (ar ? arT : en);
  if (!intel || intel.available !== true || !Array.isArray(intel.assets)) {
    return `      <section class="market-section" id="asset-intelligence">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Asset intelligence', 'استخبارات الأصول'))}</span><h2>${esc(t('Asset intelligence', 'استخبارات الأصول'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t('Per-asset intelligence is not available right now and is reported plainly.', 'استخبارات الأصول غير متاحة حالياً وتُذكر صراحة.'))}</p></div>
      </section>`;
  }
  const cards = intel.assets.map((a) => {
    const score = ar ? a.score_label_ar : a.score_label_en;
    const dq = ar ? a.data_quality_ar : a.data_quality_en;
    return `          <article class="market-card"><span class="market-card-kicker">${esc(a.symbol)}</span><h3><a href="${ar ? '/ar/markets/' : '/markets/'}${esc(a.slug)}/">${esc(score)}</a></h3><p class="market-copy">${esc(t('data quality', 'جودة البيانات'))}: ${esc(dq)}</p></article>`;
  }).join('\n');
  return `      <section class="market-section" id="asset-intelligence">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Asset intelligence', 'استخبارات الأصول'))}</span><h2>${esc(t('Institutional read by asset', 'القراءة المؤسسية حسب الأصل'))}</h2></div>
        <p class="market-copy">${esc(t('Qualitative institutional labels — not recommendations or trade instructions. Open an asset for its full read.', 'تسميات مؤسسية نوعية — ليست توصيات أو تعليمات تداول. افتح أي أصل لقراءته الكاملة.'))}</p>
        <div class="market-grid three">
${cards}
        </div>
      </section>`;
}

// ── Cognitive network snapshot — dominant cross-asset state + relationships. ──
function cognitiveBlock(ar, net) {
  const t = (en, arT) => (ar ? arT : en);
  if (!net || net.available !== true) {
    return `      <section class="market-section" id="cognitive-network">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Cognitive network', 'الشبكة الإدراكية'))}</span><h2>${esc(t('Cognitive network', 'الشبكة الإدراكية'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t('Cross-asset network evidence is not available right now.', 'أدلة الشبكة عبر الأصول غير متاحة حالياً.'))}</p></div>
      </section>`;
  }
  const dom = ar ? net.dominant_network_state.label_ar : net.dominant_network_state.label_en;
  const band = ar ? net.confidence_band_ar : net.confidence_band_en;
  const relCards = (net.relationships || []).map((r) => `          <article class="market-card"><span class="market-card-kicker">${esc(ar ? r.label_ar : r.label_en)}</span><h3>${esc(ar ? r.state_ar : r.state_en)}</h3></article>`).join('\n');
  return `      <section class="market-section" id="cognitive-network">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Cognitive network', 'الشبكة الإدراكية'))}</span><h2>${esc(t('Dominant cross-asset state', 'الحالة المهيمنة عبر الأصول'))}: ${esc(dom)}</h2></div>
        <p class="market-copy">${esc(t('Confidence', 'الثقة'))}: ${esc(band)} · ${esc(t('a deterministic read of how assets confirm or diverge — not a forecast.', 'قراءة حتمية لكيفية تأكيد الأصول أو تباعدها — وليست توقعاً.'))}</p>
        <div class="market-grid three">
${relCards}
        </div>
      </section>`;
}

// ── Provider health — honest per-asset availability + mode. ──
function providerHealthBlock(ar, charts) {
  const t = (en, arT) => (ar ? arT : en);
  const ph = charts && charts.provider_health;
  if (!ph) return '';
  const available = (charts.charts || []).map((c) => `          <article class="market-card"><span class="market-card-kicker">${esc(c.symbol)}</span><h3>${esc(t('available', 'متاح'))}</h3><p class="market-copy">${esc(t('As of', 'بتاريخ'))} ${esc(c.as_of)}</p></article>`);
  const unavailable = (charts.unavailable || []).map((u) => `          <article class="market-card"><span class="market-card-kicker">${esc(u.symbol)}</span><h3>${esc(t('unavailable', 'غير متاح'))}</h3><p class="market-copy">${esc(ar ? (UNAVAIL_REASON_AR[u.reason] || 'غير متاح') : (UNAVAIL_REASON_EN[u.reason] || 'unavailable'))}</p></article>`);
  return `      <section class="market-section" id="provider-health">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Provider health', 'حالة المزوّدين'))}</span><h2>${esc(t('Data provider availability', 'توافر مزوّدي البيانات'))}</h2></div>
        <p class="market-copy">${esc(t('Mode', 'الوضع'))}: ${esc(ph.mode)} · ${esc(ph.assets_available)}/${esc(ph.assets_total)} ${esc(t('assets with verified charts. Real sourced OHLCV only — no fabricated availability.', 'أصول لديها مخططات موثّقة. بيانات OHLCV موثّقة فقط — دون افتراض توافر.'))}</p>
        <div class="market-grid three">
${available.concat(unavailable).join('\n')}
        </div>
      </section>`;
}

// ── Per-asset layer tables (structure / tactical / liquidity) + availability. ──
function layerTable(ar, id, eyebrow, heading, intro, artifact, cellFor) {
  const t = (en, arT) => (ar ? arT : en);
  if (!artifact || !Array.isArray(artifact.assets)) {
    return `      <section class="market-section" id="${id}">
        <div class="market-section-head"><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(heading)}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t('Not available right now and reported plainly.', 'غير متاح حالياً ويُذكر صراحة.'))}</p></div>
      </section>`;
  }
  const cards = artifact.assets.map((a) => {
    const cell = a.available ? cellFor(a) : t('indeterminate', 'غير محدد');
    return `          <article class="market-card"><span class="market-card-kicker">${esc(a.symbol)}</span><h3>${esc(cell)}</h3></article>`;
  }).join('\n');
  return `      <section class="market-section" id="${id}">
        <div class="market-section-head"><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(heading)}</h2></div>
        <p class="market-copy">${esc(intro)}</p>
        <div class="market-grid three">
${cards}
        </div>
      </section>`;
}

function availabilityBlock(ar, structureArtifact) {
  const t = (en, arT) => (ar ? arT : en);
  const matrix = (structureArtifact && structureArtifact.availability_matrix) || [];
  if (!matrix.length) return '';
  const yes = ar ? 'متاح' : 'available';
  const no = ar ? 'بانتظار البيانات' : 'awaiting data';
  const cards = matrix.map((m) => `          <article class="market-card"><span class="market-card-kicker">${esc(m.symbol)}</span><h3>${esc(m.chart ? yes : no)}</h3><p class="market-copy">${esc(t('chart', 'مخطط'))}: ${m.chart ? '✓' : '—'} · ${esc(t('structure', 'بنية'))}: ${m.structure ? '✓' : '—'} · ${esc(t('cross-asset', 'عبر الأصول'))}: ${m.cross_asset ? '✓' : '—'}</p></article>`).join('\n');
  return `      <section class="market-section" id="availability-matrix">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Availability matrix', 'مصفوفة التوافر'))}</span><h2>${esc(t('What real data backs each asset', 'ما البيانات الحقيقية التي تدعم كل أصل'))}</h2></div>
        <p class="market-copy">${esc(t('Honest per-asset data availability — unavailable assets stay unavailable, never fabricated.', 'توافر بيانات نزيه لكل أصل — تبقى الأصول غير المتاحة كذلك، دون افتراض.'))}</p>
        <div class="market-grid three">
${cards}
        </div>
      </section>`;
}

// ── Provider coverage matrix (operational control). ──
function providerCoverageBlock(ar, cov) {
  const t = (en, arT) => (ar ? arT : en);
  if (!cov || !Array.isArray(cov.providers)) return '';
  const cards = cov.providers.map((p) => `          <article class="market-card"><span class="market-card-kicker">${esc(p.name)}</span><h3>${esc(p.key_present ? (ar ? 'مفتاح متاح' : 'key present') : (p.keyed ? (ar ? 'بلا مفتاح' : 'no key') : (ar ? 'بلا مفتاح (مصدر عام)' : 'keyless')))}</h3><p class="market-copy">${esc(t('resolved', 'حُلّ'))}: ${esc(p.assets_resolved)}/${esc(cov.assets_total)}</p></article>`).join('\n');
  return `      <section class="market-section" id="provider-coverage">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Provider coverage', 'تغطية المزوّدين'))}</span><h2>${esc(t('Which provider backs the data', 'أي مزوّد يدعم البيانات'))}</h2></div>
        <p class="market-copy">${esc(t('Honest provider attribution — a provider is credited only where it resolved real sourced bars.', 'نسب نزيه للمزوّد — يُنسب المزوّد فقط حيث وفّر أشرطة موثّقة حقيقية.'))}</p>
        <div class="market-grid">
${cards}
        </div>
      </section>`;
}

// ── Data quality matrix. ──
function dataQualityBlock(ar, q) {
  const t = (en, arT) => (ar ? arT : en);
  if (!q || !Array.isArray(q.assets)) return '';
  const cards = q.assets.map((a) => `          <article class="market-card"><span class="market-card-kicker">${esc(a.symbol)}</span><h3>${esc(ar ? a.activation_ar : a.activation_en)}</h3><p class="market-copy">${esc(t('coverage', 'التغطية'))}: ${esc(ar ? a.coverage_ar : a.coverage_en)} · ${esc(t('freshness', 'الحداثة'))}: ${esc(ar ? a.freshness_ar : a.freshness_en)}</p></article>`).join('\n');
  return `      <section class="market-section" id="data-quality">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Data quality', 'جودة البيانات'))}</span><h2>${esc(t('Per-asset data quality', 'جودة البيانات لكل أصل'))}</h2></div>
        <p class="market-copy">${esc(t('Qualitative — activation requires a real verified chart; no fabricated precision.', 'نوعية — يتطلب التفعيل مخططاً موثّقاً حقيقياً؛ دون دقّة مُفبركة.'))}</p>
        <div class="market-grid three">
${cards}
        </div>
      </section>`;
}

// ── Macro intelligence: dollar / yield / volatility / macro regime. ──
function macroBlock(ar, dollar, yieldArt, volatility, macro) {
  const t = (en, arT) => (ar ? arT : en);
  if (!macro) return '';
  const reg = (a, key) => (a ? (ar ? a[`${key}_ar`] : a[`${key}_en`]) : t('indeterminate', 'غير محدد'));
  const cards = [
    [t('Dollar regime', 'نظام الدولار'), reg(dollar, 'dollar_regime')],
    [t('Yield regime', 'نظام العوائد'), reg(yieldArt, 'yield_regime')],
    [t('Volatility regime', 'نظام التقلب'), reg(volatility, 'volatility_regime')],
  ];
  const macroLabel = ar ? macro.macro_regime_ar : macro.macro_regime_en;
  const band = ar ? macro.confidence_band_ar : macro.confidence_band_en;
  return `      <section class="market-section" id="macro-regime">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Macro regime', 'النظام الكلي'))}</span><h2>${esc(t('Why the tape looks like this', 'لماذا يبدو السوق هكذا'))}: ${esc(macroLabel)}</h2></div>
        <p class="market-copy">${esc(t('Confidence', 'الثقة'))}: ${esc(band)} · ${esc(t('a deterministic composition of the dollar, yield and volatility regimes — context, not a forecast.', 'تركيب حتمي لأنظمة الدولار والعوائد والتقلب — سياق، وليس توقعاً.'))}</p>
        <div class="market-grid three">
${cards.map(([k, v]) => `          <article class="market-card"><span class="market-card-kicker">${esc(k)}</span><h3>${esc(v)}</h3></article>`).join('\n')}
        </div>
      </section>`;
}

// ── Transmission network snapshot (macro → risk). ──
function transmissionBlock(ar, net) {
  const t = (en, arT) => (ar ? arT : en);
  const chains = net && Array.isArray(net.transmission_chains) ? net.transmission_chains : [];
  if (!chains.length) return '';
  const stateLabel = (s) => ({ confirmation: t('confirmation', 'تأكيد'), contradiction: t('contradiction', 'تناقض'), stress: t('stress', 'ضغط'), evidence_unavailable: t('evidence unavailable', 'الأدلة غير متاحة') }[s] || s);
  const cards = chains.map((c) => `          <article class="market-card"><span class="market-card-kicker">${esc(c.from)} → ${esc(c.to)}</span><h3>${esc(stateLabel(c.state))}</h3></article>`).join('\n');
  return `      <section class="market-section" id="transmission-network">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Transmission network', 'شبكة الانتقال'))}</span><h2>${esc(t('How macro pressure reaches equities', 'كيف يصل الضغط الكلي إلى الأسهم'))}</h2></div>
        <p class="market-copy">${esc(t('Observed macro-to-risk transmission — confirmation, contradiction or stress. Mechanism, not prediction.', 'انتقال مرصود من الكلي إلى المخاطر — تأكيد أو تناقض أو ضغط. آلية، وليست تنبؤاً.'))}</p>
        <div class="market-grid three">
${cards}
        </div>
      </section>`;
}

// ── Sector rotation + leadership/weakness + cognitive + availability/links. ──
function sectorBlock(ar, rotation, cognitive, sectorCharts, sectorStructure) {
  const t = (en, arT) => (ar ? arT : en);
  if (!rotation && !sectorCharts) return '';
  const bySlug = new Map(SECTOR_REG.SECTORS.map((s) => [s.symbol, s]));
  const name = (sym) => { const s = bySlug.get(sym); return s ? (ar ? s.name_ar : s.name_en) : sym; };
  const slug = (sym) => { const s = bySlug.get(sym); return s ? s.slug : ''; };
  let rotationLine = t('indeterminate', 'غير محدد');
  if (rotation && rotation.available) rotationLine = ar ? rotation.rotation_state_ar : rotation.rotation_state_en;
  const leaders = (rotation && rotation.leadership_sectors || []).map((x) => `          <article class="market-card"><span class="market-card-kicker">${esc(t('Leading', 'يقود'))}</span><h3><a href="${ar ? '/ar/sectors/' : '/sectors/'}${esc(slug(x.symbol))}/">${esc(name(x.symbol))}</a></h3></article>`);
  const laggards = (rotation && rotation.weakening_sectors || []).map((x) => `          <article class="market-card"><span class="market-card-kicker">${esc(t('Lagging', 'يتخلّف'))}</span><h3><a href="${ar ? '/ar/sectors/' : '/sectors/'}${esc(slug(x.symbol))}/">${esc(name(x.symbol))}</a></h3></article>`);
  const dom = cognitive && cognitive.dominant_sector_state ? (ar ? cognitive.dominant_sector_state.label_ar : cognitive.dominant_sector_state.label_en) : t('indeterminate', 'غير محدد');
  const availCount = sectorCharts && Array.isArray(sectorCharts.charts) ? sectorCharts.charts.length : 0;
  const total = SECTOR_REG.SECTORS.length;
  // All-sector link grid (each sector page).
  const linkCards = SECTOR_REG.SECTORS.map((s) => `          <article class="market-card"><span class="market-card-kicker">${esc(s.symbol)}</span><h3><a href="${ar ? '/ar/sectors/' : '/sectors/'}${esc(s.slug)}/">${esc(ar ? s.name_ar : s.name_en)}</a></h3><p class="market-copy">${esc(stateOfSector(sectorStructure, s.symbol, ar))}</p></article>`).join('\n');
  return `      <section class="market-section" id="sector-rotation">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Sector rotation', 'تدوير القطاعات'))}</span><h2>${esc(t('Where capital is rotating', 'إلى أين يتحرّك رأس المال'))}: ${esc(rotationLine)}</h2></div>
        <p class="market-copy">${esc(t('Sector cognitive read', 'القراءة الإدراكية للقطاعات'))}: ${esc(dom)} · ${esc(availCount)}/${esc(total)} ${esc(t('sectors charted. Observed relative strength — not a forecast or recommendation.', 'قطاعات مرسومة. قوة نسبية مرصودة — وليست توقعاً أو توصية.'))}</p>
        <div class="market-grid three">
${leaders.concat(laggards).join('\n') || `          <article class="market-card"><span class="market-card-kicker">${esc(t('Rotation', 'تدوير'))}</span><h3>${esc(t('indeterminate', 'غير محدد'))}</h3></article>`}
        </div>
      </section>
      <section class="market-section" id="sector-network">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Sectors', 'القطاعات'))}</span><h2>${esc(t('All sectors', 'كل القطاعات'))}</h2></div>
        <div class="market-grid three">
${linkCards}
        </div>
      </section>`;
}
function stateOfSector(art, symbol, ar) { const s = art && Array.isArray(art.sectors) ? art.sectors.find((x) => x.symbol === symbol) : null; return s ? (ar ? s.label_ar : s.label_en) : (ar ? 'غير محدد' : 'indeterminate'); }

// ── Equity intelligence panel — per-equity score + dominant state + links. ──
function equityBlock(ar, intel, network) {
  const t = (en, arT) => (ar ? arT : en);
  if (!intel || !Array.isArray(intel.equities)) return '';
  const bySym = new Map(EQUITY_REG.EQUITIES.map((e) => [e.symbol, e]));
  const dom = network && network.dominant_equity_state ? (ar ? network.dominant_equity_state.label_ar : network.dominant_equity_state.label_en) : t('indeterminate', 'غير محدد');
  const cards = intel.equities.map((e) => {
    const eq = bySym.get(e.symbol); const slug = eq ? eq.slug : e.slug;
    const name = eq ? (ar ? eq.name_ar : eq.name_en) : e.symbol;
    const score = ar ? e.score_label_ar : e.score_label_en;
    return `          <article class="market-card"><span class="market-card-kicker">${esc(e.symbol)}</span><h3><a href="${ar ? '/ar/equities/' : '/equities/'}${esc(slug)}/">${esc(score)}</a></h3><p class="market-copy">${esc(name)}</p></article>`;
  }).join('\n');
  return `      <section class="market-section" id="equity-intelligence-panel">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Equity intelligence', 'استخبارات الأسهم'))}</span><h2>${esc(t('Single-name read', 'قراءة الأسهم المنفردة'))}: ${esc(dom)}</h2></div>
        <p class="market-copy">${esc(t('Qualitative institutional labels along the macro → sector → equity chain — not recommendations or trade instructions. Open an equity for its full read.', 'تسميات مؤسسية نوعية على سلسلة الكلي ← القطاع ← السهم — ليست توصيات أو تعليمات تداول. افتح أي سهم لقراءته الكاملة.'))}</p>
        <div class="market-grid three">
${cards}
        </div>
      </section>`;
}

function buildMain(ar) {
  const t = (en, arT) => (ar ? arT : en);
  const regime = readJson(REGIME_PATH);
  const tactical = readJson(TACTICAL_PATH);
  const structure = readJson(STRUCTURE_PATH);
  const cross = readJson(CROSS_PATH);
  const charts = readJson(CHARTS_PATH);
  const cognitive = readJson(COGNITIVE_PATH);
  const intel = readJson(ASSET_INTEL_PATH);
  const assetStructure = readJson(ASSET_STRUCTURE_PATH);
  const assetTactical = readJson(ASSET_TACTICAL_PATH);
  const assetLiquidity = readJson(ASSET_LIQUIDITY_PATH);
  const providerCoverage = readJson(PROVIDER_COVERAGE_PATH);
  const dataQuality = readJson(DATA_QUALITY_PATH);
  const dollar = readJson(DOLLAR_PATH);
  const yieldArt = readJson(YIELD_PATH);
  const volatility = readJson(VOLATILITY_PATH);
  const macro = readJson(MACRO_REGIME_PATH);
  const sectorRotation = readJson(SECTOR_ROTATION_PATH);
  const sectorCognitive = readJson(SECTOR_COGNITIVE_PATH);
  const sectorCharts = readJson(SECTOR_CHARTS_PATH);
  const sectorStructure = readJson(SECTOR_STRUCTURE_PATH);
  const equityIntel = readJson(EQUITY_INTEL_PATH);
  const equityNetwork = readJson(EQUITY_NETWORK_PATH);
  return `  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><span>${esc(t('Market Terminal', 'الطرفية المؤسسية'))}</span></nav>

      <section class="market-hero">
        <div class="market-hero-panel">
          <span class="eyebrow">${esc(t('Institutional Market Terminal', 'الطرفية المؤسسية للسوق'))}</span>
          <h1>${esc(t('One connected institutional read of the tape', 'قراءة مؤسسية واحدة ومترابطة للسوق'))}</h1>
          <p class="market-lead">${esc(t('A centralized dashboard that composes the regime, tactical context, market structure, cross-asset state and the real observed price structure into one view. A deterministic composition of verified signals. Educational context, not trading signals or investment advice.', 'لوحة مركزية تجمع النظام والسياق التكتيكي وبنية السوق والحالة عبر الأصول والبنية السعرية المرصودة الحقيقية في عرض واحد. تركيب حتمي لإشارات موثّقة. سياق تعليمي وليس إشارات تداول أو نصيحة استثمارية.'))}</p>
        </div>
      </section>

${environmentBlock(ar, regime, cross)}
${macroBlock(ar, dollar, yieldArt, volatility, macro)}
${tacticalBlock(ar, tactical)}
${cognitiveBlock(ar, cognitive)}
${transmissionBlock(ar, cognitive)}
${structureBlock(ar, structure)}
${sectorBlock(ar, sectorRotation, sectorCognitive, sectorCharts, sectorStructure)}
${equityBlock(ar, equityIntel, equityNetwork)}
${assetIntelBlock(ar, intel)}
${layerTable(ar, 'asset-structure-table', t('Asset structure', 'بنية الأصول'), t('Per-asset structure state', 'حالة بنية كل أصل'), t('Each read derived independently from that asset’s own observed price structure.', 'كل قراءة مشتقة باستقلال من البنية السعرية المرصودة لذلك الأصل.'), assetStructure, (a) => (ar ? a.label_ar : a.label_en))}
${layerTable(ar, 'asset-tactical-table', t('Asset tactical', 'تكتيك الأصول'), t('Per-asset tactical pressure', 'الضغط التكتيكي لكل أصل'), t('Directional pressure and continuation derived per asset — conditional, not a forecast.', 'الضغط الاتجاهي والاستمرارية مشتقان لكل أصل — مشروطان، وليسا توقعاً.'), assetTactical, (a) => `${ar ? a.dimensions.directional_pressure.label_ar : a.dimensions.directional_pressure.label_en} · ${ar ? a.dimensions.continuation.label_ar : a.dimensions.continuation.label_en}`)}
${layerTable(ar, 'asset-liquidity-table', t('Asset liquidity', 'سيولة الأصول'), t('Per-asset liquidity condition', 'حالة سيولة كل أصل'), t('Liquidity condition and support derived from each asset’s observed volume.', 'حالة السيولة والدعم مشتقة من حجم التداول المرصود لكل أصل.'), assetLiquidity, (a) => `${ar ? a.dimensions.condition.label_ar : a.dimensions.condition.label_en} · ${ar ? a.dimensions.support.label_ar : a.dimensions.support.label_en}`)}
${availabilityBlock(ar, assetStructure)}
${chartsBlock(ar, charts, tactical)}
${providerCoverageBlock(ar, providerCoverage)}
${dataQualityBlock(ar, dataQuality)}
${providerHealthBlock(ar, charts)}
${latestBlock(ar)}

      <section class="market-section" id="terminal-disclaimer">
        <div class="market-panel"><p class="market-copy">${esc(t('TradeAlphaAI market terminal presents institutional interpretation of observed market conditions only. It is not technical trading analysis, signals, price targets, forecasts, recommendations or investment advice.', 'تقدم الطرفية المؤسسية لـ TradeAlphaAI تفسيراً مؤسسياً للظروف المرصودة للسوق فقط، وليست تحليل تداول فنياً أو إشارات أو أهدافاً سعرية أو توقعات أو توصيات أو نصيحة استثمارية.'))}</p></div>
      </section>
    </div>
  </main>`;
}

function generate(ar) {
  const templatePath = path.join(ROOT, ar ? 'ar/market-outlook/index.html' : 'market-outlook/index.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const bodyOpenIdx = template.indexOf('<body');
  const headerEndMarker = '<!-- GLOBAL_HEADER_END -->';
  const headerEndIdx = template.indexOf(headerEndMarker) + headerEndMarker.length;
  const mainEndIdx = template.indexOf('</main>') + '</main>'.length;
  const bodyOpenTagEnd = template.indexOf('>', bodyOpenIdx) + 1;
  const bodyTag = template.slice(bodyOpenIdx, bodyOpenTagEnd);
  const headerBlock = template.slice(bodyOpenTagEnd, headerEndIdx)
    .replace('data-active-section="market-outlook"', 'data-active-section="market-structure"')
    .replace(/(class="lang-switch"\s+data-locale-route="ar"\s+href=")[^"]*(")/, '$1/ar/market-terminal/$2')
    .replace(/(class="lang-switch"\s+data-locale-route="en"\s+href=")[^"]*(")/, '$1/market-terminal/$2');
  const footer = template.slice(mainEndIdx);
  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${buildHead(ar)}
${bodyTag}${headerBlock}

${buildMain(ar)}
${footer}`;
}

function main() {
  const write = process.argv.includes('--write');
  for (const [ar, outRel] of [[false, 'market-terminal/index.html'], [true, 'ar/market-terminal/index.html']]) {
    const html = generate(ar);
    if (write) {
      const outPath = path.join(ROOT, outRel);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, html, 'utf8');
      console.log(`[market-terminal] wrote ${outRel} (${html.length} chars)`);
    } else {
      console.log(`[market-terminal] dry-run ${outRel}: ${html.length} chars`);
    }
  }
}

if (require.main === module) main();

module.exports = { generate };
