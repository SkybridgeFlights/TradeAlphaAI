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
const WRITE = process.argv.includes('--write');
const FETCH = process.argv.includes('--fetch');
const SOURCE_DIR = argValue('--source-dir');
const MAX_BARS = 90;
const MIN_BARS = 35;
const MAX_OVERLAYS = 5;

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
    source: 'Source',
    asof: 'As of',
    disclaimer: 'Observed market structure, not a forecast or trading signal',
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
    source: 'المصدر',
    asof: 'حتى',
    disclaimer: 'قراءة للبنية المرصودة، وليست توقعاً أو إشارة تداول',
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

function deriveOverlays(series) {
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
    { type: 'support_resistance', role: 'floor', value: recentLow },
    { type: 'support_resistance', role: 'ceiling', value: recentHigh },
    {
      type: 'structure',
      state: last.close > priorHigh ? 'expansion_up' : last.close < priorLow ? 'expansion_down' : 'inside',
      value: last.close,
    },
  ];
  if (recentAtr !== null && priorAtr !== null && priorAtr > 0 && recentAtr / priorAtr <= 0.72) {
    overlays.push({ type: 'volatility_compression', start_date: series.at(-10).date, end_date: last.date });
  }
  if (recentVolume !== null && priorVolume !== null && priorVolume > 0 && recentVolume / priorVolume <= 0.72) {
    overlays.push({ type: 'liquidity_zone', start_date: series.at(-10).date, end_date: last.date });
  }
  return overlays.slice(0, MAX_OVERLAYS);
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

function renderSvg(chart, locale) {
  const ar = locale === 'ar';
  const text = LABELS[locale];
  const width = 1200;
  const height = 620;
  const plot = { x: 72, y: 126, width: 1056, height: 330 };
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
  const tx = ar ? 1128 : 72;
  const direction = ar ? ' direction="rtl"' : '';
  const font = ar ? "'Tajawal','Cairo','Segoe UI',Arial,sans-serif" : "'Inter','Segoe UI',Arial,sans-serif";
  const parts = [
    '<rect width="1200" height="620" fill="#0b0e13"/>',
    '<rect width="1200" height="3" fill="#d8b15a" opacity=".88"/>',
    `<text x="${tx}" y="48" text-anchor="${anchor}"${direction} font-family="${font}" font-size="17" font-weight="700" fill="#d8b15a">${esc(text.kicker)}</text>`,
    `<text x="${tx}" y="86" text-anchor="${anchor}"${direction} font-family="${font}" font-size="30" font-weight="760" fill="#f4f7f1">${esc(title)}</text>`,
    `<rect x="${plot.x}" y="${plot.y}" width="${plot.width}" height="${plot.height}" rx="8" fill="#10151d" stroke="rgba(148,163,184,.2)"/>`,
  ];

  for (let i = 0; i <= 4; i++) {
    const value = yMin + ((yMax - yMin) * i / 4);
    const yy = y(value);
    parts.push(`<line x1="${plot.x}" y1="${yy.toFixed(1)}" x2="${plot.x + plot.width}" y2="${yy.toFixed(1)}" stroke="rgba(148,163,184,.12)"/>`);
    parts.push(`<text x="${plot.x + plot.width - 8}" y="${(yy - 6).toFixed(1)}" text-anchor="end" font-family="'Inter','Segoe UI',Arial,sans-serif" font-size="13" fill="#8d978f">${formatPrice(value)}</text>`);
  }

  const compression = chart.overlays.find((overlay) => overlay.type === 'volatility_compression');
  if (compression) {
    const startIndex = series.findIndex((bar) => bar.date === compression.start_date);
    const xx = x(Math.max(0, startIndex));
    parts.push(`<rect x="${xx.toFixed(1)}" y="${plot.y}" width="${(plot.x + plot.width - xx).toFixed(1)}" height="${plot.height}" fill="#d8b15a" opacity=".055"/>`);
  }

  for (const overlay of chart.overlays.filter((item) => item.type === 'support_resistance')) {
    const yy = y(overlay.value);
    const color = overlay.role === 'floor' ? '#6ee7d8' : '#d8b15a';
    parts.push(`<line x1="${plot.x}" y1="${yy.toFixed(1)}" x2="${plot.x + plot.width}" y2="${yy.toFixed(1)}" stroke="${color}" stroke-width="1.4" stroke-dasharray="7 7" opacity=".72"/>`);
  }

  parts.push(`<polyline points="${points}" fill="none" stroke="#d9e2dc" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`);
  const last = series.at(-1);
  parts.push(`<circle cx="${x(series.length - 1).toFixed(1)}" cy="${y(last.close).toFixed(1)}" r="4.5" fill="#f2d27b"/>`);

  const notes = chart.overlays.map((overlay) => {
    if (overlay.type === 'support_resistance') return overlay.role === 'floor' ? text.floor : text.ceiling;
    if (overlay.type === 'structure') return text[overlay.state];
    if (overlay.type === 'volatility_compression') return text.compression;
    return text.liquidity;
  });
  notes.slice(0, MAX_OVERLAYS).forEach((note, index) => {
    const rowY = 492 + index * 20;
    const markerX = ar ? 1122 : 72;
    const textX = ar ? 1108 : 88;
    parts.push(`<rect x="${markerX}" y="${rowY - 11}" width="5" height="13" fill="#d8b15a" opacity=".8"/>`);
    parts.push(`<text x="${textX}" y="${rowY}" text-anchor="${anchor}"${direction} font-family="${font}" font-size="14" fill="#cad3c7">${esc(note)}</text>`);
  });

  const source = ar ? chart.attribution.label_ar : chart.attribution.label_en;
  parts.push(`<text x="${tx}" y="586" text-anchor="${anchor}"${direction} font-family="${font}" font-size="13" fill="#8d978f">${esc(`${text.source}: ${source} · ${text.asof} ${chart.as_of}`)}</text>`);
  parts.push(`<text x="${tx}" y="606" text-anchor="${anchor}"${direction} font-family="${font}" font-size="12" fill="#5d675f">${esc(text.disclaimer)}</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 620" role="img" aria-label="${esc(title)}" preserveAspectRatio="xMidYMid meet"${direction} data-series-hash="${chart.series_hash}" data-bar-count="${series.length}">
${parts.join('\n')}
</svg>
`;
}

function buildChart(spec, rows, source) {
  const series = normalizeSeries(rows);
  if (series.length < MIN_BARS) return null;
  const seriesHash = hash(JSON.stringify(series));
  const overlays = deriveOverlays(series);
  const asOf = series.at(-1).date;
  const chart = {
    id: spec.id,
    symbol: spec.symbol,
    visual_type: spec.visual_type,
    chart_type: spec.visual_type,
    title_en: spec.title_en,
    title_ar: spec.title_ar,
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
  if (!FETCH) return null;
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

async function build() {
  const rendered = [];
  const unavailable = [];
  for (const spec of SPECS) {
    const sourced = await sourceFor(spec);
    if (!sourced) {
      unavailable.push({ symbol: spec.symbol, reason: 'approved_ohlcv_unavailable' });
      continue;
    }
    const result = buildChart(spec, sourced.rows, sourced.source);
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

async function main() {
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
  SPECS, MAX_BARS, MIN_BARS, MAX_OVERLAYS,
  normalizeSeries, deriveOverlays, renderSvg, buildChart, build,
};
