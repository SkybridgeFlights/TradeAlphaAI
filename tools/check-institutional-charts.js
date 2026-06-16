'use strict';

// Integrity gate for deterministic, evidence-grounded institutional OHLCV charts.
// An honest empty manifest passes. Any rendered chart must satisfy every gate.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MIN_BARS, MAX_OVERLAYS } = require('./build-institutional-charts');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const ARABIC = /[\u0600-\u06ff]/;
const APPROVED_PROVIDERS = new Set(['FMP', 'Finnhub', 'AlphaVantage', 'Approved fixture']);
const SUPPORTED_ASSETS = new Set(['SPY', 'QQQ', 'IWM', 'GLD', 'TLT', 'UUP', 'DXY', 'VIX', 'VIXY']);
const OVERLAY_TYPES = new Set([
  'support_resistance_zone',
  'structure',
  'volatility_compression',
  'breadth_deterioration',
  'liquidity_zone',
  'tactical_context',
]);
const TACTICAL_STATES = new Set([
  'fragile_continuation',
  'fading_pressure',
  'narrowing_participation',
  'liquidity_pressure',
  'mixed_confirmation',
  'supportive_structure',
  'evidence_unavailable',
]);
const MIN_VIEWBOX_WIDTH = 960;
const MIN_VIEWBOX_HEIGHT = 500;
const MIN_LABEL_FONT = 11;
const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\blong\b/i, /\bshort\b/i, /\bentry\b/i,
  /\bstop[- ]?loss\b/i, /\btarget\b/i, /\bsignal\b/i, /\bRSI\b/, /\bMACD\b/,
  /\bgolden cross\b/i, /\bmoon\b/i, /\boversold\b/i, /\boverbought\b/i,
  /(?:شراء|بيع|دخول|هدف|وقف\s*الخسارة|إشارة)/,
];

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function evidenceRefs(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim())
    : [];
}

function plainText(markup) {
  return String(markup || '').replace(/<[^>]+>/g, ' ');
}

function validateZone(zone, series, id, index) {
  const failures = [];
  const label = `${id}: zone ${index + 1}`;
  if (!zone || typeof zone !== 'object') return [`${label} is not an object`];
  if (!finite(zone.lower) || !finite(zone.upper) || zone.lower >= zone.upper) {
    failures.push(`${label} requires finite lower < upper`);
  }
  if (!String(zone.method || '').trim()) failures.push(`${label} missing observed-OHLCV method`);
  if (!evidenceRefs(zone.evidence_refs).length) failures.push(`${label} missing evidence_refs`);
  if (series.length && finite(zone.lower) && finite(zone.upper)) {
    const observedLow = Math.min(...series.map((bar) => bar.low));
    const observedHigh = Math.max(...series.map((bar) => bar.high));
    if (zone.lower < observedLow || zone.upper > observedHigh) {
      failures.push(`${label} lies outside observed OHLCV range`);
    }
  }
  return failures;
}

function validateOverlay(overlay, id, index) {
  const failures = [];
  const label = `${id}: overlay ${index + 1}`;
  if (!overlay || typeof overlay !== 'object') return [`${label} is not an object`];
  if (!OVERLAY_TYPES.has(overlay.type)) failures.push(`${label} unsupported type "${overlay.type}"`);

  if (overlay.type === 'support_resistance_zone') {
    if (!finite(overlay.lower) || !finite(overlay.upper) || overlay.lower >= overlay.upper) {
      failures.push(`${label} requires finite lower < upper`);
    }
    if (!String(overlay.method || '').trim() || !evidenceRefs(overlay.evidence_refs).length) {
      failures.push(`${label} missing observed-zone method/evidence_refs`);
    }
  } else if (overlay.type === 'tactical_context') {
    if (!TACTICAL_STATES.has(overlay.state)) failures.push(`${label} unsupported tactical state "${overlay.state}"`);
    if (overlay.state !== 'evidence_unavailable' && !evidenceRefs(overlay.evidence_refs).length) {
      failures.push(`${label} tactical state missing evidence_refs`);
    }
  } else if (!evidenceRefs(overlay.evidence_refs).length && !String(overlay.method || '').trim()) {
    failures.push(`${label} missing evidence_refs or deterministic method`);
  }
  return failures;
}

function validateSvg(svg, chart, locale, id) {
  const failures = [];
  const root = (svg.match(/<svg\b[^>]*>/i) || [''])[0];
  const viewBox = root.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/i);
  if (!viewBox) failures.push(`${id}: ${locale} SVG missing viewBox`);
  if (viewBox && (Number(viewBox[1]) < MIN_VIEWBOX_WIDTH || Number(viewBox[2]) < MIN_VIEWBOX_HEIGHT)) {
    failures.push(`${id}: ${locale} SVG canvas too small for institutional readability`);
  }
  if (/\bwidth="\d/i.test(root) || /\bheight="\d/i.test(root)) {
    failures.push(`${id}: ${locale} SVG has fixed root dimensions`);
  }
  if (!/preserveAspectRatio="xMidYMid meet"/i.test(root)) {
    failures.push(`${id}: ${locale} SVG missing mobile-safe preserveAspectRatio`);
  }
  if (!/data-time-axis="true"/i.test(root)) failures.push(`${id}: ${locale} SVG missing data-time-axis=true`);
  const tickCount = Number((root.match(/data-time-ticks="(\d+)"/i) || [])[1] || 0);
  const dateLabels = plainText(svg).match(/\b\d{4}-\d{2}(?:-\d{2})?\b/g) || [];
  if (tickCount < 3 && dateLabels.length < 3) {
    failures.push(`${id}: ${locale} SVG time axis lacks start/mid/end ticks`);
  }
  if (!svg.includes(`data-series-hash="${chart.series_hash}"`)) {
    failures.push(`${id}: ${locale} SVG series-hash attr missing/mismatch`);
  }
  if (locale === 'ar' && !/direction="rtl"/i.test(root)) failures.push(`${id}: AR SVG not RTL`);

  const text = plainText(svg);
  for (const pattern of FORBIDDEN) {
    if (pattern.test(text)) failures.push(`${id}: ${locale} SVG forbidden retail/advice language ${pattern}`);
  }
  if (!/(Source|المصدر)/i.test(text)) failures.push(`${id}: ${locale} SVG missing source attribution`);
  if (!/(As of|حتى|بتاريخ)/i.test(text)) failures.push(`${id}: ${locale} SVG missing as-of`);

  if (viewBox) {
    const width = Number(viewBox[1]);
    const height = Number(viewBox[2]);
    for (const match of svg.matchAll(/<text\b([^>]*)>/gi)) {
      const attrs = match[1];
      const x = attrs.match(/\bx="(-?[\d.]+)"/i);
      const y = attrs.match(/\by="(-?[\d.]+)"/i);
      const font = attrs.match(/font-size="([\d.]+)"/i);
      const anchor = (attrs.match(/text-anchor="([^"]+)"/i) || [])[1];
      if (x && (Number(x[1]) < 0 || Number(x[1]) > width)) failures.push(`${id}: ${locale} SVG text x=${x[1]} off-canvas`);
      if (y && (Number(y[1]) < 0 || Number(y[1]) > height)) failures.push(`${id}: ${locale} SVG text y=${y[1]} off-canvas`);
      if (x && Number(x[1]) === 0 && anchor === 'end') failures.push(`${id}: ${locale} SVG end-anchored text extends left of canvas`);
      if (x && Number(x[1]) === width && (!anchor || anchor === 'start')) failures.push(`${id}: ${locale} SVG start-anchored text extends right of canvas`);
      if (font && Number(font[1]) < MIN_LABEL_FONT) failures.push(`${id}: ${locale} SVG label font-size ${font[1]} unreadable`);
    }
  }
  return failures;
}

function validate(manifest, options = {}) {
  const failures = [];
  if (!manifest || typeof manifest !== 'object') return ['manifest not an object'];
  if (manifest.schema_version !== '1.0') failures.push(`unexpected schema_version ${manifest.schema_version}`);
  if (!['available', 'partial', 'unavailable'].includes(manifest.status)) failures.push(`invalid status ${manifest.status}`);
  if (!/Approved provider OHLCV only/.test(String(manifest.source_policy || ''))) failures.push('missing/weak source_policy');
  if (!(manifest.max_overlays_per_chart <= MAX_OVERLAYS)) failures.push(`max_overlays_per_chart > ${MAX_OVERLAYS}`);
  if (!(manifest.max_charts_per_article <= 2)) failures.push('max_charts_per_article > 2');

  const charts = Array.isArray(manifest.charts) ? manifest.charts : [];
  const unavailable = Array.isArray(manifest.unavailable) ? manifest.unavailable : [];
  if (manifest.status === 'unavailable' && charts.length) failures.push('status unavailable but charts present');
  if (manifest.status === 'available' && (!charts.length || unavailable.length)) failures.push('status available but charts missing or some unavailable');
  if (manifest.status === 'partial' && (!charts.length || !unavailable.length)) failures.push('status partial but not a mix');
  for (const item of unavailable) {
    if (!item.symbol || !item.reason) failures.push('unavailable entry missing symbol/reason');
    if (item.symbol && !SUPPORTED_ASSETS.has(item.symbol)) failures.push(`unavailable entry has unsupported asset ${item.symbol}`);
  }

  for (const chart of charts) {
    const id = chart.id || chart.symbol || '?';
    if (!chart.symbol) failures.push(`${id}: missing symbol`);
    else if (!SUPPORTED_ASSETS.has(chart.symbol)) failures.push(`${id}: unsupported asset ${chart.symbol}`);
    if (!chart.title_en) failures.push(`${id}: missing EN title`);
    if (!chart.title_ar || !ARABIC.test(chart.title_ar)) failures.push(`${id}: missing native AR title`);
    if (!Array.isArray(chart.related_topics) || !chart.related_topics.length) failures.push(`${id}: missing relevance metadata related_topics`);
    if (!Array.isArray(chart.allowed_surfaces) || !chart.allowed_surfaces.length) failures.push(`${id}: missing relevance metadata allowed_surfaces`);

    const series = Array.isArray(chart.series) ? chart.series : [];
    if (series.length < MIN_BARS) failures.push(`${id}: ${series.length} bars < ${MIN_BARS}`);
    for (const bar of series) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(bar.date))) {
        failures.push(`${id}: bad bar date ${bar.date}`);
        break;
      }
      if (![bar.open, bar.high, bar.low, bar.close].every(finite)) {
        failures.push(`${id}: non-finite OHLC`);
        break;
      }
      if (bar.low > bar.high || bar.open < bar.low || bar.open > bar.high || bar.close < bar.low || bar.close > bar.high) {
        failures.push(`${id}: impossible OHLC bar (${bar.date})`);
        break;
      }
    }
    if (chart.series_hash !== sha256(JSON.stringify(series))) failures.push(`${id}: series_hash does not match series`);
    if (chart.bar_count !== series.length) failures.push(`${id}: bar_count mismatch`);
    if (series.length && chart.as_of !== series[series.length - 1].date) failures.push(`${id}: as_of does not match last bar`);

    const overlays = Array.isArray(chart.overlays) ? chart.overlays : [];
    if (overlays.length > MAX_OVERLAYS) failures.push(`${id}: ${overlays.length} overlays > ${MAX_OVERLAYS}`);
    if (chart.overlay_count !== overlays.length) failures.push(`${id}: overlay_count mismatch`);
    overlays.forEach((overlay, index) => validateOverlay(overlay, id, index).forEach((issue) => failures.push(issue)));
    const zones = Array.isArray(chart.zones) ? chart.zones : [];
    if (overlays.length + zones.length > MAX_OVERLAYS) failures.push(`${id}: visual evidence layers exceed cap ${MAX_OVERLAYS}`);
    zones.forEach((zone, index) => validateZone(zone, series, id, index).forEach((issue) => failures.push(issue)));

    const attribution = chart.attribution || {};
    if (!APPROVED_PROVIDERS.has(attribution.provider)) failures.push(`${id}: provider "${attribution.provider}" not approved`);
    if (!attribution.source_url || !attribution.fetched_at || !attribution.response_hash) failures.push(`${id}: incomplete attribution`);
    if (!attribution.label_en || !attribution.label_ar || !ARABIC.test(String(attribution.label_ar))) failures.push(`${id}: missing bilingual attribution`);
    if (chart.verified !== true) failures.push(`${id}: not marked verified`);

    const chartText = JSON.stringify({
      title_en: chart.title_en,
      title_ar: chart.title_ar,
      analytical_reason: chart.analytical_reason,
      narrative_hook: chart.narrative_hook,
      overlays,
      zones,
    });
    for (const pattern of FORBIDDEN) {
      if (pattern.test(chartText)) failures.push(`${id}: forbidden retail/advice language ${pattern}`);
    }

    if (!options.skipSvg) {
      for (const locale of ['en', 'ar']) {
        const relative = chart.files && chart.files[locale];
        if (!relative) {
          failures.push(`${id}: missing ${locale} file ref`);
          continue;
        }
        const absolute = path.join(ROOT, relative);
        if (!fs.existsSync(absolute)) {
          failures.push(`${id}: ${locale} SVG missing on disk`);
          continue;
        }
        validateSvg(fs.readFileSync(absolute, 'utf8'), chart, locale, id).forEach((issue) => failures.push(issue));
      }
    }
  }
  return failures;
}

function fixture() {
  const series = Array.from({ length: MIN_BARS }, (_, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, '0')}`,
    open: 100, high: 101, low: 99, close: 100, volume: 1,
  }));
  return {
    schema_version: '1.0',
    status: 'available',
    source_policy: 'Approved provider OHLCV only; no inferred or placeholder bars.',
    max_overlays_per_chart: 5,
    max_charts_per_article: 2,
    unavailable: [],
    charts: [{
      id: 'fixture',
      symbol: 'SPY',
      title_en: 'Observed structure',
      title_ar: 'البنية المرصودة',
      bar_count: series.length,
      as_of: series[series.length - 1].date,
      related_topics: ['breadth-vs-index'],
      allowed_surfaces: ['market-news'],
      zones: [{ lower: 99, upper: 101, method: 'observed_range', evidence_refs: ['series:recent'] }],
      overlays: [{ type: 'structure', state: 'inside', method: 'observed_close_vs_range' }],
      overlay_count: 1,
      verified: true,
      attribution: {
        provider: 'FMP', source_url: 'https://example.test', fetched_at: '2026-01-30T00:00:00Z',
        response_hash: 'response', label_en: 'Source', label_ar: 'المصدر',
      },
      series,
      series_hash: sha256(JSON.stringify(series)),
      files: { en: 'fixture-en.svg', ar: 'fixture-ar.svg' },
    }],
  };
}

function runSelfTest() {
  const base = fixture();
  const clone = () => JSON.parse(JSON.stringify(base));
  const cases = [
    ['tampered hash', (m) => { m.charts[0].series_hash = 'deadbeef'; }],
    ['impossible bar', (m) => { m.charts[0].series[0].low = 999; m.charts[0].series_hash = sha256(JSON.stringify(m.charts[0].series)); }],
    ['bad provider', (m) => { m.charts[0].attribution.provider = 'TradingView'; }],
    ['too few bars', (m) => { m.charts[0].series = m.charts[0].series.slice(0, 10); m.charts[0].bar_count = 10; m.charts[0].series_hash = sha256(JSON.stringify(m.charts[0].series)); }],
    ['status contradiction', (m) => { m.status = 'unavailable'; }],
    ['unsupported asset', (m) => { m.charts[0].symbol = 'DOGE'; }],
    ['missing relevance', (m) => { m.charts[0].related_topics = []; }],
    ['zone without evidence', (m) => { m.charts[0].zones[0].evidence_refs = []; }],
    ['zone outside OHLCV', (m) => { m.charts[0].zones[0].upper = 999; }],
    ['unsupported overlay', (m) => { m.charts[0].overlays[0].type = 'rsi'; }],
    ['overlay cap exceeded', (m) => {
      m.charts[0].overlays = Array.from({ length: MAX_OVERLAYS + 1 }, () => ({ type: 'structure', method: 'observed_close_vs_range' }));
      m.charts[0].overlay_count = m.charts[0].overlays.length;
    }],
    ['visual layer cap exceeded', (m) => {
      m.charts[0].zones = Array.from({ length: MAX_OVERLAYS }, () => ({ lower: 99, upper: 101, method: 'observed_range', evidence_refs: ['series:recent'] }));
    }],
    ['tactical overlay without evidence', (m) => { m.charts[0].overlays[0] = { type: 'tactical_context', state: 'fragile_continuation' }; }],
    ['forbidden language', (m) => { m.charts[0].title_en = 'Entry signal'; }],
  ];
  let passed = 0;
  for (const [name, mutate] of cases) {
    const candidate = clone();
    mutate(candidate);
    if (validate(candidate, { skipSvg: true }).length) passed += 1;
    else console.error(`SELF-TEST FAIL: "${name}" not rejected`);
  }
  if (!validate(clone(), { skipSvg: true }).length) passed += 1;
  else console.error('SELF-TEST FAIL: clean manifest rejected', validate(clone(), { skipSvg: true }));

  const svg = '<svg viewBox="0 0 1200 620" preserveAspectRatio="xMidYMid meet" data-time-axis="true" data-time-ticks="3" data-series-hash="hash"><text x="80" y="40" font-size="14">Source As of 2026-01-01 2026-01-15 2026-01-30</text></svg>';
  const svgChart = { series_hash: 'hash' };
  const svgCases = [
    ['missing time axis', svg.replace(' data-time-axis="true"', '')],
    ['small canvas', svg.replace('1200 620', '600 300')],
    ['off-canvas text', svg.replace('x="80"', 'x="1300"')],
    ['fixed dimensions', svg.replace('viewBox=', 'width="1200" viewBox=')],
    ['missing mobile aspect ratio', svg.replace(' preserveAspectRatio="xMidYMid meet"', '')],
    ['unsafe text anchor', svg.replace('x="80"', 'x="0" text-anchor="end"')],
    ['forbidden SVG language', svg.replace('Source', 'Entry signal Source')],
  ];
  for (const [name, candidate] of svgCases) {
    if (validateSvg(candidate, svgChart, 'en', name).length) passed += 1;
    else console.error(`SELF-TEST FAIL: "${name}" not rejected`);
  }
  if (!validateSvg(svg, svgChart, 'en', 'clean-svg').length) passed += 1;
  else console.error('SELF-TEST FAIL: clean SVG rejected', validateSvg(svg, svgChart, 'en', 'clean-svg'));

  const total = cases.length + svgCases.length + 2;
  console.log(`[institutional-charts] self-test: ${passed}/${total} passed`);
  return passed === total;
}

if (require.main === module && process.argv.includes('--self-test')) {
  process.exit(runSelfTest() ? 0 : 1);
}

if (require.main === module) {
  if (!fs.existsSync(MANIFEST)) {
    console.log('[institutional-charts] no manifest yet - nothing to validate (non-fatal).');
    console.log('[institutional-charts] check:institutional-charts passed.');
    process.exit(0);
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  } catch (error) {
    console.error(`[institutional-charts] FAIL: malformed JSON: ${error.message}`);
    process.exit(1);
  }
  const failures = validate(manifest);
  if (failures.length) {
    failures.forEach((message) => console.error(`[institutional-charts] FAIL: ${message}`));
    process.exit(1);
  }
  console.log(`[institutional-charts] check:institutional-charts passed (${manifest.charts.length} chart(s); sourced, evidence-grounded, time-scaled, responsive, bilingual, no retail labels).`);
}

module.exports = { validate, validateSvg, validateOverlay, validateZone, runSelfTest };
