'use strict';

// Phase 126: deterministic institutional OHLCV chart engine.
// Fetching is explicit (--fetch). The rendering core is a pure function of
// sourced daily bars. Missing provider data produces an honest empty manifest.

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const OUT_DIR = path.join(ROOT, 'data', 'visual', 'institutional-charts');
const TACTICAL_CONTEXT = path.join(ROOT, 'data', 'intelligence', 'tactical-context.json');
const WRITE = process.argv.includes('--write');
const FETCH = process.argv.includes('--fetch');
const SOURCE_DIR = argValue('--source-dir');
const SELF_TEST = process.argv.includes('--self-test');
const MAX_BARS = 90;
const MIN_BARS = 35;
const MAX_OVERLAYS = 5;
const RANGE_WINDOW = 20;
const TACTICAL_MAX_AGE_HOURS = 72;
const TACTICAL_STATES = new Set([
  'fragile_continuation',
  'fading_pressure',
  'narrowing_participation',
  'liquidity_pressure',
  'mixed_confirmation',
  'supportive_structure',
  'evidence_unavailable',
]);

const SPECS = [
  {
    id: 'spy-market-structure',
    symbol: 'SPY',
    visual_type: 'price_structure',
    title_en: 'SPY observed price structure',
    title_ar: 'البنية السعرية المرصودة لمؤشر SPY',
    allowed_surfaces: ['market-structure', 'market-news'],
    related_topics: ['participation_breadth', 'structural_stability', 'breadth-vs-index'],
  },
  {
    id: 'qqq-duration-structure',
    symbol: 'QQQ',
    visual_type: 'duration_pressure',
    title_en: 'QQQ duration-sensitive structure',
    title_ar: 'بنية QQQ الحساسة للعوائد',
    allowed_surfaces: ['market-structure', 'market-news', 'articles'],
    related_topics: ['cross_asset_structure', 'momentum', 'yields-growth-equities'],
  },
  {
    id: 'gld-real-yield-context',
    symbol: 'GLD',
    visual_type: 'real_yield_context',
    title_en: 'Gold price structure in macro context',
    title_ar: 'بنية الذهب ضمن السياق الكلي',
    allowed_surfaces: ['market-news', 'articles'],
    related_topics: ['real-yields-gold', 'dxy-gold-relationship'],
  },
  {
    id: 'tlt-yield-pressure',
    symbol: 'TLT',
    visual_type: 'yield_pressure',
    title_en: 'Treasury duration under yield pressure',
    title_ar: 'حساسية سندات الخزانة لضغط العوائد',
    allowed_surfaces: ['market-structure', 'market-news', 'articles'],
    related_topics: ['yield-curve-pressure', 'tlt-duration-sensitivity'],
  },
  {
    id: 'iwm-participation-structure',
    symbol: 'IWM',
    visual_type: 'participation_structure',
    title_en: 'IWM participation and breadth structure',
    title_ar: 'بنية المشاركة واتساع السوق في IWM',
    allowed_surfaces: ['market-structure', 'market-news', 'articles'],
    related_topics: ['participation_breadth', 'breadth-vs-index', 'narrow-leadership', 'participation-quality'],
  },
  {
    id: 'uup-dollar-liquidity',
    symbol: 'UUP',
    proxy_for: 'US Dollar Index exposure',
    visual_type: 'dollar_liquidity',
    title_en: 'UUP dollar-liquidity proxy structure',
    title_ar: 'بنية أداة UUP بوصفها مؤشراً بديلاً لسيولة الدولار',
    allowed_surfaces: ['market-news', 'articles'],
    related_topics: ['dollar-strength-global-liquidity', 'dxy-gold-relationship', 'liquidity-tightening'],
  },
  {
    id: 'vixy-volatility-proxy',
    symbol: 'VIXY',
    proxy_for: 'front-month VIX futures exposure',
    visual_type: 'volatility_proxy',
    title_en: 'VIXY volatility-futures proxy structure',
    title_ar: 'بنية أداة VIXY بوصفها مؤشراً بديلاً لعقود التقلب',
    allowed_surfaces: ['market-structure', 'market-news', 'articles'],
    related_topics: ['volatility-compression', 'volatility-expansion', 'vix-equity-breadth'],
  },
];

const LABELS = {
  en: {
    kicker: 'Institutional Price Structure',
    observed: 'Observed daily close',
    floor: 'Observed range floor',
    ceiling: 'Observed range ceiling',
    compression: 'Recent range compression',
    expansion_up: 'Close above prior observed range',
    expansion_down: 'Close below prior observed range',
    inside: 'Close remains inside prior observed range',
    liquidity: 'Recent volume participation is thinner',
    tactical: {
      fragile_continuation: 'Tactical context: fragile continuation',
      fading_pressure: 'Tactical context: fading pressure',
      narrowing_participation: 'Tactical context: narrowing participation',
      liquidity_pressure: 'Tactical context: liquidity pressure',
      mixed_confirmation: 'Tactical context: mixed confirmation',
      supportive_structure: 'Tactical context: supportive structure',
      evidence_unavailable: 'Tactical context: evidence unavailable',
    },
    source: 'Source',
    asof: 'As of',
    disclaimer: 'Observed market structure, not a forecast or recommendation',
  },
  ar: {
    kicker: 'البنية السعرية المؤسسية',
    observed: 'الإغلاق اليومي المرصود',
    floor: 'الحد الأدنى للنطاق المرصود',
    ceiling: 'الحد الأعلى للنطاق المرصود',
    compression: 'انضغاط حديث في النطاق',
    expansion_up: 'الإغلاق أعلى النطاق المرصود السابق',
    expansion_down: 'الإغلاق أدنى النطاق المرصود السابق',
    inside: 'الإغلاق ما زال داخل النطاق المرصود السابق',
    liquidity: 'مشاركة أحجام التداول الأخيرة أضعف',
    tactical: {
      fragile_continuation: 'السياق التكتيكي: استمرار هش',
      fading_pressure: 'السياق التكتيكي: تراجع الضغط',
      narrowing_participation: 'السياق التكتيكي: تضيق المشاركة',
      liquidity_pressure: 'السياق التكتيكي: ضغط سيولة',
      mixed_confirmation: 'السياق التكتيكي: تأكيدات مختلطة',
      supportive_structure: 'السياق التكتيكي: بنية داعمة',
      evidence_unavailable: 'السياق التكتيكي: الأدلة غير متاحة',
    },
    source: 'المصدر',
    asof: 'حتى',
    disclaimer: 'قراءة للبنية المرصودة، وليست توقعاً أو توصية',
  },
};

function argValue(name) {
  const prefix = `${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeSeries(rows) {
  const byDate = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = String(row.date || row.timestamp || '').slice(0, 10);
    const open = finite(row.open);
    const high = finite(row.high);
    const low = finite(row.low);
    const close = finite(row.close);
    const volume = finite(row.volume);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if ([open, high, low, close].some((value) => value === null)) continue;
    if (low > high || open < low || open > high || close < low || close > high) continue;
    byDate.set(date, { date, open, high, low, close, volume: volume === null ? 0 : Math.max(0, volume) });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_BARS);
}

function average(values) {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

function trueRanges(series) {
  return series.map((bar, index) => {
    const prior = index ? series[index - 1].close : bar.open;
    return Math.max(bar.high - bar.low, Math.abs(bar.high - prior), Math.abs(bar.low - prior));
  });
}

function deriveObservedZones(series) {
  if (series.length < MIN_BARS) return [];
  const recent = series.slice(-RANGE_WINDOW);
  const recentHigh = Math.max(...recent.map((bar) => bar.high));
  const recentLow = Math.min(...recent.map((bar) => bar.low));
  const observedRange = recentHigh - recentLow;
  if (!(observedRange > 0)) return [];
  const recentAtr = average(trueRanges(series).slice(-10));
  const bandDepth = Math.max(
    Math.min((recentAtr || observedRange * 0.08) * 0.45, observedRange * 0.1),
    observedRange * 0.025,
  );
  const evidence = {
    basis: 'observed_ohlcv',
    window_sessions: RANGE_WINDOW,
    start_date: recent[0].date,
    end_date: recent.at(-1).date,
    low_field: 'low',
    high_field: 'high',
  };
  return [
    {
      type: 'support_resistance_zone',
      role: 'floor',
      lower: recentLow,
      upper: Math.min(recentHigh, recentLow + bandDepth),
      value: recentLow + bandDepth / 2,
      method: '20_session_extreme_atr_band',
      evidence: { ...evidence, observed_extreme: recentLow },
      evidence_refs: [`ohlcv:${recent[0].date}:${recent.at(-1).date}:low`],
    },
    {
      type: 'support_resistance_zone',
      role: 'ceiling',
      lower: Math.max(recentLow, recentHigh - bandDepth),
      upper: recentHigh,
      value: recentHigh - bandDepth / 2,
      method: '20_session_extreme_atr_band',
      evidence: { ...evidence, observed_extreme: recentHigh },
      evidence_refs: [`ohlcv:${recent[0].date}:${recent.at(-1).date}:high`],
    },
  ];
}

function normalizeTacticalOverlay(input) {
  if (!input || typeof input !== 'object') return null;
  const state = String(input.state || input.classification || '').trim();
  if (!TACTICAL_STATES.has(state)) return null;
  const evidence = (Array.isArray(input.evidence) ? input.evidence : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 4);
  if (state !== 'evidence_unavailable' && evidence.length === 0) return null;
  return {
    type: 'tactical_context',
    state,
    evidence,
    evidence_refs: evidence.map((item) => `tactical-context:${item}`),
    source_artifact: String(input.source_artifact || 'data/intelligence/tactical-context.json'),
    generated_at: Number.isFinite(Date.parse(String(input.generated_at || '')))
      ? new Date(Date.parse(String(input.generated_at))).toISOString()
      : null,
    as_of: /^\d{4}-\d{2}-\d{2}/.test(String(input.as_of || ''))
      ? String(input.as_of).slice(0, 10)
      : null,
    affects_price_scale: false,
  };
}

function parseArtifactTimestamp(artifact) {
  const value = artifact && (artifact.as_of || artifact.generated_at);
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function mapTacticalContextArtifact(artifact, now = Date.now()) {
  if (!artifact || artifact.available !== true || artifact.source_layer !== 'tactical-context') return null;
  const timestamp = parseArtifactTimestamp(artifact);
  if (timestamp === null || !Number.isFinite(now) || timestamp > now + 5 * 60 * 1000) return null;
  const ageHours = (now - timestamp) / 3600000;
  if (ageHours > TACTICAL_MAX_AGE_HOURS) return null;
  const marketStateAge = finite(artifact.attribution && artifact.attribution.market_state_age_hours);
  if (marketStateAge !== null && marketStateAge > TACTICAL_MAX_AGE_HOURS) return null;
  const dimensions = artifact.dimensions && typeof artifact.dimensions === 'object' ? artifact.dimensions : {};
  const candidates = [
    ['continuation', new Set(['exhaustion_risk', 'fragile_continuation']), 'fragile_continuation'],
    ['directional_pressure', new Set(['fading', 'stalling']), 'fading_pressure'],
    ['participation_quality', new Set(['narrowing', 'narrow']), 'narrowing_participation'],
    ['liquidity_support', new Set(['draining']), 'liquidity_pressure'],
    ['confirmation_quality', new Set(['partial']), 'mixed_confirmation'],
    ['participation_quality', new Set(['mixed']), 'mixed_confirmation'],
    ['tactical_bias', new Set(['supportive']), 'supportive_structure'],
  ];
  for (const [dimension, states, mappedState] of candidates) {
    const value = dimensions[dimension];
    const evidence = Array.isArray(value && value.evidence)
      ? value.evidence.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    if (!value || !states.has(value.state) || evidence.length === 0) continue;
    return normalizeTacticalOverlay({
      state: mappedState,
      evidence: evidence.map((item) => `${dimension}:${item}`),
      source_artifact: 'data/intelligence/tactical-context.json',
      generated_at: new Date(timestamp).toISOString(),
      as_of: new Date(timestamp).toISOString().slice(0, 10),
    });
  }
  return null;
}

function loadTacticalContextOverlay(now = Date.now()) {
  try {
    return mapTacticalContextArtifact(JSON.parse(fs.readFileSync(TACTICAL_CONTEXT, 'utf8')), now);
  } catch {
    return null;
  }
}

function deriveOverlays(series, tacticalInput = null) {
  if (series.length < MIN_BARS) return [];
  const recent = series.slice(-20);
  const prior = series.slice(-40, -20);
  const last = series.at(-1);
  const priorHigh = Math.max(...prior.map((bar) => bar.high));
  const priorLow = Math.min(...prior.map((bar) => bar.low));
  const recentHigh = Math.max(...recent.map((bar) => bar.high));
  const recentLow = Math.min(...recent.map((bar) => bar.low));
  const ranges = trueRanges(series);
  const recentAtr = average(ranges.slice(-10));
  const priorAtr = average(ranges.slice(-40, -10));
  const recentVolume = average(recent.slice(-10).map((bar) => bar.volume).filter((value) => value > 0));
  const priorVolume = average(series.slice(-40, -10).map((bar) => bar.volume).filter((value) => value > 0));
  const overlays = [
    ...deriveObservedZones(series),
    {
      type: 'structure',
      state: last.close > priorHigh ? 'expansion_up' : last.close < priorLow ? 'expansion_down' : 'inside',
      value: last.close,
      method: 'latest_close_vs_prior_20_session_range',
      evidence: {
        basis: 'observed_ohlcv',
        prior_start_date: prior[0].date,
        prior_end_date: prior.at(-1).date,
        prior_low: priorLow,
        prior_high: priorHigh,
        observed_close: last.close,
        observed_date: last.date,
      },
      evidence_refs: [
        `ohlcv:${prior[0].date}:${prior.at(-1).date}:range`,
        `ohlcv:${last.date}:close`,
      ],
    },
  ];
  if (recentAtr !== null && priorAtr !== null && priorAtr > 0 && recentAtr / priorAtr <= 0.72) {
    overlays.push({
      type: 'volatility_compression',
      start_date: series.at(-10).date,
      end_date: last.date,
      method: '10_session_true_range_vs_prior_30_session_average',
      evidence: { basis: 'observed_ohlcv', recent_atr: recentAtr, prior_atr: priorAtr, ratio: recentAtr / priorAtr },
      evidence_refs: [`ohlcv:${series.at(-40).date}:${last.date}:true_range`],
    });
  }
  if (recentVolume !== null && priorVolume !== null && priorVolume > 0 && recentVolume / priorVolume <= 0.72) {
    overlays.push({
      type: 'liquidity_zone',
      start_date: series.at(-10).date,
      end_date: last.date,
      method: '10_session_volume_vs_prior_30_session_average',
      evidence: { basis: 'observed_ohlcv', recent_volume: recentVolume, prior_volume: priorVolume, ratio: recentVolume / priorVolume },
      evidence_refs: [`ohlcv:${series.at(-40).date}:${last.date}:volume`],
    });
  }
  const tactical = normalizeTacticalOverlay(tacticalInput);
  if (tactical) return overlays.slice(0, MAX_OVERLAYS - 1).concat(tactical);
  return overlays.slice(0, MAX_OVERLAYS);
}

function selectTimeTicks(series, maximum = 5) {
  if (!Array.isArray(series) || series.length === 0) return [];
  const count = Math.max(2, Math.min(5, Math.trunc(maximum) || 5, series.length));
  const indexes = new Set();
  for (let index = 0; index < count; index++) {
    indexes.add(Math.round(index * (series.length - 1) / (count - 1)));
  }
  return [...indexes].sort((a, b) => a - b).map((index) => ({ index, date: series[index].date }));
}

function formatDateTick(date, locale) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!match) return '';
  const months = locale === 'ar'
    ? ['ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون', 'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const year = match[1];
  const month = months[Number(match[2]) - 1];
  const day = String(Number(match[3]));
  return locale === 'ar' ? `${day} ${month} ${year}` : `${month} ${day}, ${year}`;
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatPrice(value) {
  if (!Number.isFinite(value)) return '';
  return value >= 100 ? value.toFixed(2) : value.toFixed(3);
}

function dataList(values) {
  return esc((Array.isArray(values) ? values : []).map((value) => String(value)).join('|'));
}

function renderSvg(chart, locale) {
  const ar = locale === 'ar';
  const text = LABELS[locale];
  const width = 1400;
  const height = 900;
  // Arabic labels are end-anchored. Keep the plot and all label anchors inside
  // a wider safe gutter so RTL text never hugs the right edge of the canvas.
  const plot = ar ? { x: 92, y: 142, width: 1088, height: 480 } : { x: 92, y: 142, width: 1216, height: 480 };
  const series = chart.series;
  const lows = series.map((bar) => bar.low);
  const highs = series.map((bar) => bar.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const pad = Math.max((max - min) * 0.08, max * 0.002);
  const yMin = min - pad;
  const yMax = max + pad;
  const x = (index) => plot.x + (index / Math.max(1, series.length - 1)) * plot.width;
  const y = (value) => plot.y + (1 - (value - yMin) / Math.max(0.000001, yMax - yMin)) * plot.height;
  const points = series.map((bar, index) => `${x(index).toFixed(1)},${y(bar.close).toFixed(1)}`).join(' ');
  const title = ar ? chart.title_ar : chart.title_en;
  const anchor = ar ? 'end' : 'start';
  const tx = ar ? 1180 : 92;
  const direction = ar ? ' direction="rtl"' : '';
  const font = ar ? "'Tajawal','Cairo','Segoe UI',Arial,sans-serif" : "'Inter','Segoe UI',Arial,sans-serif";
  const tactical = chart.overlays.find((overlay) => overlay.type === 'tactical_context');
  const timeTicks = selectTimeTicks(series, 5);
  const parts = [
    `<rect width="${width}" height="${height}" fill="#0b0e13"/>`,
    `<rect width="${width}" height="3" fill="#d8b15a" opacity=".88"/>`,
    `<text x="${tx}" y="52" text-anchor="${anchor}"${direction} font-family="${font}" font-size="18" font-weight="700" fill="#d8b15a">${esc(text.kicker)}</text>`,
    `<text x="${tx}" y="96" text-anchor="${anchor}"${direction} font-family="${font}" font-size="34" font-weight="760" fill="#f4f7f1">${esc(title)}</text>`,
    `<rect x="${plot.x}" y="${plot.y}" width="${plot.width}" height="${plot.height}" rx="8" fill="#10151d" stroke="rgba(148,163,184,.2)"/>`,
  ];

  if (tactical) {
    const tacticalFill = {
      fragile_continuation: '#b58b56',
      fading_pressure: '#7890a8',
      narrowing_participation: '#9f7c63',
      liquidity_pressure: '#8d6d79',
      mixed_confirmation: '#8c8570',
      supportive_structure: '#477e73',
      evidence_unavailable: '#626a70',
    }[tactical.state];
    parts.push(`<rect x="${plot.x}" y="${plot.y}" width="${plot.width}" height="${plot.height}" rx="8" fill="${tacticalFill}" opacity=".045"/>`);
    const badgeWidth = ar ? 250 : 300;
    const badgeX = ar ? plot.x + plot.width - badgeWidth - 18 : plot.x + 18;
    parts.push(`<rect x="${badgeX}" y="${plot.y + 16}" width="${badgeWidth}" height="34" rx="5" fill="${tacticalFill}" opacity=".2" stroke="${tacticalFill}" stroke-opacity=".45"/>`);
    parts.push(`<text x="${ar ? badgeX + badgeWidth - 12 : badgeX + 12}" y="${plot.y + 39}" text-anchor="${anchor}"${direction} font-family="${font}" font-size="14" font-weight="650" fill="#dbe2dc">${esc(text.tactical[tactical.state])}</text>`);
  }

  for (let i = 0; i <= 5; i++) {
    const value = yMin + ((yMax - yMin) * i / 5);
    const yy = y(value);
    parts.push(`<line x1="${plot.x}" y1="${yy.toFixed(1)}" x2="${plot.x + plot.width}" y2="${yy.toFixed(1)}" stroke="rgba(148,163,184,.12)"/>`);
    parts.push(`<text x="${plot.x + plot.width - 10}" y="${(yy - 7).toFixed(1)}" text-anchor="end" font-family="'Inter','Segoe UI',Arial,sans-serif" font-size="15" fill="#9aa49d">${formatPrice(value)}</text>`);
  }

  const compression = chart.overlays.find((overlay) => overlay.type === 'volatility_compression');
  if (compression) {
    const startIndex = series.findIndex((bar) => bar.date === compression.start_date);
    const xx = x(Math.max(0, startIndex));
    parts.push(`<rect x="${xx.toFixed(1)}" y="${plot.y}" width="${(plot.x + plot.width - xx).toFixed(1)}" height="${plot.height}" fill="#d8b15a" opacity=".055"/>`);
  }

  for (const overlay of chart.overlays.filter((item) => item.type === 'support_resistance_zone')) {
    const zoneTop = y(overlay.upper);
    const zoneBottom = y(overlay.lower);
    const zoneHeight = Math.max(2, zoneBottom - zoneTop);
    const color = overlay.role === 'floor' ? '#6ee7d8' : '#d8b15a';
    parts.push(`<rect x="${plot.x}" y="${zoneTop.toFixed(1)}" width="${plot.width}" height="${zoneHeight.toFixed(1)}" fill="${color}" opacity=".09"/>`);
    parts.push(`<line x1="${plot.x}" y1="${zoneTop.toFixed(1)}" x2="${plot.x + plot.width}" y2="${zoneTop.toFixed(1)}" stroke="${color}" stroke-width="1.2" opacity=".58"/>`);
    parts.push(`<line x1="${plot.x}" y1="${zoneBottom.toFixed(1)}" x2="${plot.x + plot.width}" y2="${zoneBottom.toFixed(1)}" stroke="${color}" stroke-width="1.2" opacity=".58"/>`);
  }

  parts.push(`<polyline points="${points}" fill="none" stroke="#d9e2dc" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`);
  const last = series.at(-1);
  parts.push(`<circle cx="${x(series.length - 1).toFixed(1)}" cy="${y(last.close).toFixed(1)}" r="5.5" fill="#f2d27b"/>`);

  for (const tick of timeTicks) {
    const xx = x(tick.index);
    const tickAnchor = tick.index === 0 ? 'start' : tick.index === series.length - 1 ? 'end' : 'middle';
    parts.push(`<line x1="${xx.toFixed(1)}" y1="${plot.y + plot.height}" x2="${xx.toFixed(1)}" y2="${plot.y + plot.height + 8}" stroke="#69746d" stroke-width="1"/>`);
    parts.push(`<text x="${xx.toFixed(1)}" y="${plot.y + plot.height + 30}" text-anchor="${tickAnchor}" font-family="${font}" font-size="14" fill="#9aa49d"${direction}>${esc(formatDateTick(tick.date, locale))}</text>`);
  }

  const notes = chart.overlays.map((overlay) => {
    let note = text.liquidity;
    if (overlay.type === 'support_resistance_zone') note = overlay.role === 'floor' ? text.floor : text.ceiling;
    if (overlay.type === 'structure') note = text[overlay.state];
    if (overlay.type === 'volatility_compression') note = text.compression;
    if (overlay.type === 'tactical_context') note = text.tactical[overlay.state];
    return { note, overlay };
  });
  notes.slice(0, MAX_OVERLAYS).forEach(({ note, overlay }, index) => {
    const rowY = 690 + index * 22;
    const markerX = ar ? 1174 : 92;
    const textX = ar ? 1160 : 108;
    let metadata = ` data-overlay-type="${esc(overlay.type)}" data-evidence-refs="${dataList(overlay.evidence_refs)}"`;
    if (overlay.type === 'support_resistance_zone') {
      metadata += ` data-zone-type="support_resistance_zone" data-zone-role="${esc(overlay.role)}" data-lower="${esc(overlay.lower)}" data-upper="${esc(overlay.upper)}" data-method="${esc(overlay.method)}"`;
    } else if (overlay.type === 'tactical_context') {
      metadata += ` data-tactical-state="${esc(overlay.state)}" data-source-artifact="${esc(overlay.source_artifact)}"`;
    } else if (overlay.method) {
      metadata += ` data-method="${esc(overlay.method)}"`;
    }
    parts.push(`<g${metadata}>`);
    parts.push(`<rect x="${markerX}" y="${rowY - 12}" width="5" height="14" fill="#d8b15a" opacity=".8"/>`);
    parts.push(`<text x="${textX}" y="${rowY}" text-anchor="${anchor}"${direction} font-family="${font}" font-size="15" fill="#cad3c7">${esc(note)}</text>`);
    parts.push('</g>');
  });

  const source = ar ? chart.attribution.label_ar : chart.attribution.label_en;
  parts.push(`<text x="${tx}" y="870" text-anchor="${anchor}"${direction} font-family="${font}" font-size="13" fill="#8d978f">${esc(`${text.source}: ${source} · ${text.asof} ${chart.as_of}`)}</text>`);
  parts.push(`<text x="${tx}" y="890" text-anchor="${anchor}"${direction} font-family="${font}" font-size="12" fill="#5d675f">${esc(text.disclaimer)}</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}" preserveAspectRatio="xMidYMid meet"${direction} data-series-hash="${chart.series_hash}" data-bar-count="${series.length}" data-overlay-count="${chart.overlays.length}" data-time-axis="true" data-time-ticks="${timeTicks.length}" data-time-tick-dates="${dataList(timeTicks.map((tick) => tick.date))}">
${parts.join('\n')}
</svg>
`;
}

function buildChart(spec, rows, source, options = {}) {
  const series = normalizeSeries(rows);
  if (series.length < MIN_BARS) return null;
  const seriesHash = hash(JSON.stringify(series));
  const overlays = deriveOverlays(series, options.tactical_overlay);
  const observedZones = overlays.filter((overlay) => overlay.type === 'support_resistance_zone');
  const asOf = series.at(-1).date;
  const chart = {
    id: spec.id,
    symbol: spec.symbol,
    visual_type: spec.visual_type,
    chart_type: spec.visual_type,
    title_en: spec.title_en,
    title_ar: spec.title_ar,
    proxy_for: spec.proxy_for || null,
    analytical_reason: {
      en: 'Shows the observed price structure and whether range, participation, and volatility are confirming the article thesis.',
      ar: 'يوضح البنية السعرية المرصودة وما إذا كان النطاق والمشاركة والتقلب يؤكدان أطروحة المقال.',
    },
    narrative_hook: {
      en: 'The chart anchors the structural reading in sourced daily prices rather than an inferred or decorative pattern.',
      ar: 'يربط المخطط القراءة الهيكلية بأسعار يومية موثقة بدلاً من نمط مستنتج أو زخرفي.',
    },
    allowed_surfaces: spec.allowed_surfaces,
    related_topics: spec.related_topics,
    time_axis: {
      method: 'deterministic_evenly_spaced_observation_ticks',
      ticks: selectTimeTicks(series, 5),
    },
    observed_zones: observedZones,
    overlays,
    overlay_count: overlays.length,
    series,
    series_hash: seriesHash,
    bar_count: series.length,
    as_of: asOf,
    attribution: {
      provider: source.provider,
      source_url: source.source_url,
      fetched_at: source.fetched_at,
      response_hash: source.response_hash,
      label_en: `${source.provider} daily OHLCV`,
      label_ar: `بيانات OHLCV اليومية من ${source.provider}`,
    },
    files: {
      en: `data/visual/institutional-charts/${spec.id}-en.svg`,
      ar: `data/visual/institutional-charts/${spec.id}-ar.svg`,
    },
    verified: true,
    stale: false,
  };
  return {
    chart,
    svg: { en: renderSvg(chart, 'en'), ar: renderSvg(chart, 'ar') },
  };
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 20000, headers: { 'User-Agent': 'TradeAlphaAI-Institutional-Charts/1.0' } }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve({ parsed: JSON.parse(body), body }); } catch { reject(new Error('non-JSON provider response')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('provider timeout')); });
  });
}

async function fetchFmp(symbol, from, to, key) {
  if (!key) return null;
  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(symbol)}?from=${from}&to=${to}&apikey=${encodeURIComponent(key)}`;
  const response = await requestJson(url);
  const rows = Array.isArray(response.parsed.historical) ? response.parsed.historical : [];
  return rows.length ? providerResult('FMP', 'https://financialmodelingprep.com/', response.body, rows) : null;
}

async function fetchFinnhub(symbol, from, to, key) {
  if (!key) return null;
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${encodeURIComponent(key)}`;
  const response = await requestJson(url);
  const data = response.parsed;
  if (!Array.isArray(data.t) || data.s !== 'ok') return null;
  const rows = data.t.map((timestamp, index) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    open: data.o[index], high: data.h[index], low: data.l[index], close: data.c[index], volume: data.v[index],
  }));
  return providerResult('Finnhub', 'https://finnhub.io/', response.body, rows);
}

async function fetchAlphaVantage(symbol, key) {
  if (!key) return null;
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&outputsize=compact&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;
  const response = await requestJson(url);
  const daily = response.parsed['Time Series (Daily)'];
  if (!daily || typeof daily !== 'object') return null;
  const rows = Object.entries(daily).map(([date, values]) => ({
    date,
    open: values['1. open'], high: values['2. high'], low: values['3. low'],
    close: values['4. close'], volume: values['5. volume'],
  }));
  return providerResult('AlphaVantage', 'https://www.alphavantage.co/', response.body, rows);
}

function providerResult(provider, sourceUrl, body, rows) {
  return {
    rows,
    source: {
      provider,
      source_url: sourceUrl,
      fetched_at: new Date().toISOString(),
      response_hash: hash(body),
    },
  };
}

async function sourceFor(spec) {
  if (SOURCE_DIR) {
    const file = path.resolve(ROOT, SOURCE_DIR, `${spec.symbol}.json`);
    if (!fs.existsSync(file)) return null;
    const body = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(body);
    return providerResult(parsed.provider || 'Approved fixture', parsed.source_url || 'local-source', body, parsed.series || parsed.rows || []);
  }
  if (!FETCH) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
      const chart = (existing.charts || []).find((item) => item.symbol === spec.symbol && Array.isArray(item.series));
      if (chart) {
        return {
          rows: chart.series,
          source: chart.attribution || {
            provider: 'Existing approved OHLCV manifest',
            source_url: 'data/visual/institutional-charts.json',
            fetched_at: existing.generated_at || null,
            response_hash: hash(JSON.stringify(chart.series)),
          },
        };
      }
    } catch {
      return null;
    }
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  const fromSeconds = now - 220 * 86400;
  const fromDate = new Date(fromSeconds * 1000).toISOString().slice(0, 10);
  const toDate = new Date(now * 1000).toISOString().slice(0, 10);
  const attempts = [
    () => fetchFmp(spec.symbol, fromDate, toDate, process.env.FMP_API_KEY || process.env.FINANCIAL_MODELING_PREP_API_KEY),
    () => fetchFinnhub(spec.symbol, fromSeconds, now, process.env.FINNHUB_API_KEY),
    () => fetchAlphaVantage(spec.symbol, process.env.ALPHAVANTAGE_API_KEY),
  ];
  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (result && normalizeSeries(result.rows).length >= MIN_BARS) return result;
    } catch (error) {
      console.warn(`[institutional-charts] ${spec.symbol}: provider attempt degraded (${error.message})`);
    }
  }
  return null;
}

async function build(options = {}) {
  const rendered = [];
  const unavailable = [];
  const sharedTacticalOverlay = Object.prototype.hasOwnProperty.call(options, 'tactical_overlay')
    ? normalizeTacticalOverlay(options.tactical_overlay)
    : loadTacticalContextOverlay(options.now);
  for (const spec of SPECS) {
    const sourced = await sourceFor(spec);
    if (!sourced) {
      unavailable.push({ symbol: spec.symbol, reason: 'approved_ohlcv_unavailable' });
      continue;
    }
    const tacticalOverlay = options.tactical_overlays
      ? normalizeTacticalOverlay(options.tactical_overlays[spec.id] || options.tactical_overlays[spec.symbol])
      : sharedTacticalOverlay;
    const result = buildChart(spec, sourced.rows, sourced.source, { tactical_overlay: tacticalOverlay });
    if (result) rendered.push(result);
    else unavailable.push({ symbol: spec.symbol, reason: 'insufficient_valid_bars' });
  }
  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    status: rendered.length ? (unavailable.length ? 'partial' : 'available') : 'unavailable',
    source_policy: 'Approved provider OHLCV only; no inferred or placeholder bars.',
    max_charts_per_article: 2,
    max_overlays_per_chart: MAX_OVERLAYS,
    charts: rendered.map((item) => item.chart),
    unavailable,
    _svg: rendered.map((item) => ({ files: item.chart.files, svg: item.svg })),
  };
}

function selfTestSeries(length = 60) {
  const rows = [];
  for (let index = 0; index < length; index++) {
    const date = new Date(Date.UTC(2026, 0, 2 + index));
    const base = 480 + index * 0.35 + Math.sin(index / 4) * 2.5;
    rows.push({
      date: date.toISOString().slice(0, 10),
      open: base - 0.6,
      high: base + 2.1,
      low: base - 2.2,
      close: base + 0.8,
      volume: 1000000 - index * 2500,
    });
  }
  return rows;
}

function runSelfTest() {
  const source = {
    provider: 'Approved deterministic fixture',
    source_url: 'local-self-test',
    fetched_at: '2026-03-02T00:00:00.000Z',
    response_hash: hash('phase-130-self-test'),
  };
  const tactical = {
    state: 'mixed_confirmation',
    evidence: ['fixture:cross_asset_confirmation=mixed'],
    source_artifact: 'self-test',
    generated_at: '2026-03-02T00:00:00.000Z',
    as_of: '2026-03-02',
  };
  const result = buildChart(SPECS[0], selfTestSeries(), source, { tactical_overlay: tactical });
  if (!result) throw new Error('self-test chart was not built');
  const zones = result.chart.observed_zones;
  if (zones.length !== 2 || zones.some((zone) => zone.type !== 'support_resistance_zone' || !Number.isFinite(zone.lower) || !Number.isFinite(zone.upper) || zone.lower >= zone.upper)) {
    throw new Error('observed support/resistance zones are malformed');
  }
  if (zones.some((zone) => !zone.method || zone.evidence?.basis !== 'observed_ohlcv' || !zone.evidence_refs?.length)) {
    throw new Error('observed zones are missing method/evidence');
  }
  if (result.chart.overlays.length > MAX_OVERLAYS || !result.chart.overlays.some((overlay) => overlay.type === 'tactical_context')) {
    throw new Error('tactical overlay governance failed');
  }
  if (result.chart.time_axis.ticks.length < 3 || !result.svg.en.includes('data-time-axis="true"')) {
    throw new Error('deterministic time axis was not rendered');
  }
  if (!result.svg.en.includes(`data-overlay-count="${result.chart.overlay_count}"`)
    || !result.svg.en.includes('data-time-ticks="5"')
    || !result.svg.en.includes('data-time-tick-dates="')
    || !result.svg.en.includes('data-zone-type="support_resistance_zone"')
    || !result.svg.en.includes('data-zone-role="floor"')
    || !result.svg.en.includes('data-lower="')
    || !result.svg.en.includes('data-upper="')
    || !result.svg.en.includes('data-method="20_session_extreme_atr_band"')
    || !result.svg.en.includes('data-evidence-refs="ohlcv:')
    || !result.svg.en.includes('data-overlay-type="tactical_context"')
    || !result.svg.en.includes('data-tactical-state="mixed_confirmation"')) {
    throw new Error('SVG overlay contract metadata was not rendered');
  }
  const renderedOverlayCount = (result.svg.en.match(/\sdata-overlay-type="/g) || []).length;
  if (renderedOverlayCount !== result.chart.overlay_count) {
    throw new Error(`rendered overlay metadata count ${renderedOverlayCount} does not match ${result.chart.overlay_count}`);
  }
  for (const overlay of result.chart.overlays) {
    if (!result.svg.en.includes(`data-overlay-type="${esc(overlay.type)}"`)) {
      throw new Error(`rendered overlay metadata missing for ${overlay.type}`);
    }
  }
  if (!/viewBox="0 0 1400 900"/.test(result.svg.en) || /<svg[^>]*\s(?:width|height)=/.test(result.svg.en)) {
    throw new Error('SVG must be viewBox-only');
  }
  if (!result.svg.ar.includes('direction="rtl"') || result.svg.en !== renderSvg(result.chart, 'en')) {
    throw new Error('bilingual or deterministic rendering failed');
  }
  const freshAt = Date.parse('2026-03-02T12:00:00.000Z');
  const artifact = {
    source_layer: 'tactical-context',
    available: true,
    generated_at: '2026-03-02T00:00:00.000Z',
    dimensions: {
      continuation: { state: 'exhaustion_risk', evidence: ['persistence=persistent', 'fragility=fragile'] },
      directional_pressure: { state: 'fading', evidence: ['momentum=early_deterioration'] },
    },
  };
  const mapped = mapTacticalContextArtifact(artifact, freshAt);
  if (mapped?.state !== 'fragile_continuation' || mapped.source_artifact !== 'data/intelligence/tactical-context.json' || !mapped.evidence_refs?.length) {
    throw new Error('verified tactical artifact mapping failed');
  }
  if (mapTacticalContextArtifact(artifact, Date.parse('2026-03-06T00:00:01.000Z')) !== null) {
    throw new Error('stale tactical artifact was not omitted');
  }
  const mappingCases = [
    ['directional_pressure', 'stalling', 'fading_pressure'],
    ['participation_quality', 'narrow', 'narrowing_participation'],
    ['liquidity_support', 'draining', 'liquidity_pressure'],
    ['confirmation_quality', 'partial', 'mixed_confirmation'],
    ['tactical_bias', 'supportive', 'supportive_structure'],
  ];
  for (const [dimension, state, expected] of mappingCases) {
    const mappedCase = mapTacticalContextArtifact({
      source_layer: 'tactical-context',
      available: true,
      as_of: '2026-03-02T00:00:00.000Z',
      dimensions: { [dimension]: { state, evidence: [`fixture:${dimension}=${state}`] } },
    }, freshAt);
    if (mappedCase?.state !== expected) throw new Error(`tactical mapping failed for ${dimension}:${state}`);
  }
  const staleMarketState = { ...artifact, attribution: { market_state_age_hours: TACTICAL_MAX_AGE_HOURS + 1 } };
  if (mapTacticalContextArtifact(staleMarketState, freshAt) !== null) {
    throw new Error('artifact backed by stale market state was not omitted');
  }
  const missingEvidence = JSON.parse(JSON.stringify(artifact));
  missingEvidence.dimensions.continuation.evidence = [];
  missingEvidence.dimensions.directional_pressure.evidence = [];
  if (mapTacticalContextArtifact(missingEvidence, freshAt) !== null) {
    throw new Error('evidence-free tactical artifact was not omitted');
  }
  console.log('[institutional-charts] self-test passed (zones, time axis, tactical mapping/staleness, RTL, deterministic SVG)');
}

async function main() {
  if (SELF_TEST) {
    runSelfTest();
    return;
  }
  const result = await build();
  console.log(`[institutional-charts] status=${result.status} charts=${result.charts.length} unavailable=${result.unavailable.length}`);
  if (!WRITE) return;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const keep = new Set();
  for (const item of result._svg) {
    for (const locale of ['en', 'ar']) {
      const absolute = path.join(ROOT, item.files[locale]);
      keep.add(path.basename(absolute));
      fs.writeFileSync(absolute, item.svg[locale], 'utf8');
    }
  }
  for (const file of fs.readdirSync(OUT_DIR)) {
    if (file.endsWith('.svg') && !keep.has(file)) fs.unlinkSync(path.join(OUT_DIR, file));
  }
  const persisted = { ...result };
  delete persisted._svg;
  fs.writeFileSync(OUT, `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[institutional-charts] ${error.stack || error.message}`);
    process.exit(1);
  });
}

module.exports = {
  SPECS, MAX_BARS, MIN_BARS, MAX_OVERLAYS, RANGE_WINDOW, TACTICAL_STATES, TACTICAL_MAX_AGE_HOURS,
  normalizeSeries, deriveObservedZones, normalizeTacticalOverlay, deriveOverlays,
  parseArtifactTimestamp, mapTacticalContextArtifact, loadTacticalContextOverlay,
  selectTimeTicks, formatDateTick, renderSvg, buildChart, build, runSelfTest,
};
