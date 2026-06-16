'use strict';

// Validates institutional charts after they are embedded in public article bodies.
// The manifest proves the series; this gate proves relevance, evidence linkage,
// responsive geometry, time context, and safe institutional language in-page.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const SURFACES = [
  ['market-structure', 'ar/market-structure'],
  ['market-news', 'ar/market-news'],
  ['articles', 'ar/articles'],
];
const FIG_RE = /<figure class="institutional-chart"[\s\S]*?<\/figure>/gi;
const SUPPORTED_ASSETS = new Set(['SPY', 'QQQ', 'IWM', 'GLD', 'TLT', 'UUP', 'DXY', 'VIX', 'VIXY']);
const TACTICAL_STATES = new Set([
  'fragile_continuation', 'fading_pressure', 'narrowing_participation',
  'liquidity_pressure', 'mixed_confirmation', 'supportive_structure',
  'evidence_unavailable',
]);
const OVERLAY_TYPES = new Set([
  'support_resistance_zone', 'structure', 'volatility_compression',
  'breadth_deterioration', 'liquidity_zone', 'tactical_context',
]);
const ZONE_TYPES = new Set(['support_resistance_zone']);
const MIN_FONT = 11;
const MIN_WIDTH = 960;
const MIN_HEIGHT = 500;
const MAX_OVERLAYS = 5;
const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\blong\b/i, /\bshort\b/i, /\bentry\b/i,
  /\bstop[- ]?loss\b/i, /\btarget\b/i, /\bsignal\b/i, /\btake[- ]?profit\b/i,
  /\btrade setup\b/i, /\bRSI\b/, /\bMACD\b/, /\bgolden cross\b/i,
  /(?:شراء|بيع|دخول|هدف|وقف\s*الخسارة|إشارة)/,
];

function attribute(markup, name) {
  const match = String(markup).match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
  return match ? match[1] : null;
}

function normalizeTopic(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function topicsRelated(left, right) {
  const ignored = new Set(['and', 'vs', 'market', 'research', 'structure', 'article']);
  const tokens = (value) => new Set(normalizeTopic(value).split('-').filter((token) => token.length > 3 && !ignored.has(token)));
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  return [...leftTokens].some((token) => rightTokens.has(token));
}

function evidenceList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function loadManifestIndex() {
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    return new Map((manifest.charts || []).filter((chart) => chart.series_hash).map((chart) => [chart.series_hash, chart]));
  } catch {
    return new Map();
  }
}

function validateEvidenceElements(svg, label) {
  const failures = [];
  const overlayCount = Number(attribute(svg.match(/<svg\b[^>]*>/i)?.[0] || '', 'data-overlay-count'));
  if (!Number.isInteger(overlayCount) || overlayCount < 0) failures.push(`${label}: SVG missing valid data-overlay-count`);
  else if (overlayCount > MAX_OVERLAYS) failures.push(`${label}: ${overlayCount} overlays exceeds cap ${MAX_OVERLAYS}`);

  const evidenceElements = [...svg.matchAll(/<[^>]+\bdata-(?:zone-type|tactical-state|overlay-type)="[^"]+"[^>]*>/gi)].map((match) => match[0]);
  if (Number.isInteger(overlayCount) && evidenceElements.length !== overlayCount) {
    failures.push(`${label}: data-overlay-count does not match rendered evidence overlays`);
  }
  for (const element of evidenceElements) {
    const zoneType = attribute(element, 'data-zone-type');
    const tacticalState = attribute(element, 'data-tactical-state');
    const overlayType = attribute(element, 'data-overlay-type');
    const refs = evidenceList(attribute(element, 'data-evidence-refs'));
    if (zoneType) {
      if (!ZONE_TYPES.has(zoneType)) failures.push(`${label}: unsupported rendered zone "${zoneType}"`);
      const lower = Number(attribute(element, 'data-lower'));
      const upper = Number(attribute(element, 'data-upper'));
      if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper) {
        failures.push(`${label}: rendered zone requires finite lower < upper`);
      }
      if (!attribute(element, 'data-method') || !refs.length) {
        failures.push(`${label}: rendered zone missing observed method/evidence`);
      }
    }
    if (tacticalState) {
      if (!TACTICAL_STATES.has(tacticalState)) failures.push(`${label}: unsupported tactical state "${tacticalState}"`);
      if (tacticalState !== 'evidence_unavailable' && !refs.length) {
        failures.push(`${label}: tactical overlay missing evidence refs`);
      }
    }
    if (overlayType) {
      if (!OVERLAY_TYPES.has(overlayType)) failures.push(`${label}: unsupported rendered overlay "${overlayType}"`);
      if (!refs.length && !attribute(element, 'data-method')) {
        failures.push(`${label}: rendered overlay missing evidence refs or deterministic method`);
      }
    }
  }
  return failures;
}

function validateFigure(figure, context) {
  const { lang, charts, label, surface, topic } = context;
  const failures = [];
  const symbol = attribute(figure, 'data-symbol');
  const chartType = attribute(figure, 'data-chart-type');
  const seriesHash = attribute(figure, 'data-series-hash');
  const asOf = attribute(figure, 'data-as-of');
  const relevanceTopic = attribute(figure, 'data-relevance-topic');

  if (!symbol) failures.push(`${label}: missing data-symbol`);
  else if (!SUPPORTED_ASSETS.has(symbol)) failures.push(`${label}: unsupported asset ${symbol}`);
  if (!chartType) failures.push(`${label}: missing data-chart-type`);
  if (!asOf || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) failures.push(`${label}: missing/invalid data-as-of`);
  if (!seriesHash) failures.push(`${label}: missing data-series-hash`);
  if (!relevanceTopic) failures.push(`${label}: missing data-relevance-topic`);

  const chart = seriesHash ? charts.get(seriesHash) : null;
  if (!charts.size) failures.push(`${label}: manifest has no verified chart series`);
  else if (!chart) failures.push(`${label}: series_hash not in manifest`);
  if (chart) {
    if (chart.symbol !== symbol) failures.push(`${label}: embedded symbol does not match manifest series`);
    if (!Array.isArray(chart.allowed_surfaces) || !chart.allowed_surfaces.includes(surface)) {
      failures.push(`${label}: chart is not allowed on ${surface}`);
    }
    const allowedTopics = (chart.related_topics || []).map(normalizeTopic);
    if (!relevanceTopic || !allowedTopics.includes(normalizeTopic(relevanceTopic))) {
      failures.push(`${label}: relevance topic is not supported by chart metadata`);
    }
    if (topic && normalizeTopic(topic) !== normalizeTopic(relevanceTopic) && !topicsRelated(topic, relevanceTopic)) {
      failures.push(`${label}: embedded relevance topic does not match article topic`);
    }
  }

  const svgMatch = figure.match(/<svg[\s\S]*?<\/svg>/i);
  if (!svgMatch) {
    failures.push(`${label}: embedded chart has no SVG`);
    return failures;
  }
  const svg = svgMatch[0];
  const root = (svg.match(/<svg\b[^>]*>/i) || [''])[0];
  const viewBox = root.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/i);
  if (!viewBox) failures.push(`${label}: SVG missing viewBox`);
  if (viewBox && (Number(viewBox[1]) < MIN_WIDTH || Number(viewBox[2]) < MIN_HEIGHT)) {
    failures.push(`${label}: SVG plot dimensions are too small`);
  }
  if (/\bwidth="\d/i.test(root) || /\bheight="\d/i.test(root)) failures.push(`${label}: SVG has fixed root dimensions`);
  if (!/preserveAspectRatio="xMidYMid meet"/i.test(root)) failures.push(`${label}: SVG missing mobile-safe preserveAspectRatio`);
  if (!/data-time-axis="true"/i.test(root)) failures.push(`${label}: SVG missing data-time-axis=true`);
  const ticks = Number(attribute(root, 'data-time-ticks') || 0);
  const dateLabels = svg.replace(/<[^>]+>/g, ' ').match(/\b\d{4}-\d{2}(?:-\d{2})?\b/g) || [];
  if (ticks < 3 && dateLabels.length < 3) failures.push(`${label}: time axis lacks start/mid/end ticks`);
  if (!/<(?:polyline|path)\b/i.test(svg)) failures.push(`${label}: SVG has no real price path`);
  if (lang === 'ar' && !/direction="rtl"/i.test(root)) failures.push(`${label}: AR SVG not RTL`);
  if (seriesHash && !svg.includes(`data-series-hash="${seriesHash}"`)) failures.push(`${label}: SVG series hash mismatch`);

  if (viewBox) {
    const width = Number(viewBox[1]);
    const height = Number(viewBox[2]);
    for (const match of svg.matchAll(/<text\b([^>]*)>/gi)) {
      const attrs = match[1];
      const x = attrs.match(/\bx="(-?[\d.]+)"/i);
      const y = attrs.match(/\by="(-?[\d.]+)"/i);
      const font = attrs.match(/font-size="([\d.]+)"/i);
      const anchor = (attrs.match(/text-anchor="([^"]+)"/i) || [])[1];
      if (x && (Number(x[1]) < 0 || Number(x[1]) > width)) failures.push(`${label}: SVG text x=${x[1]} off-canvas`);
      if (y && (Number(y[1]) < 0 || Number(y[1]) > height)) failures.push(`${label}: SVG text y=${y[1]} off-canvas`);
      if (x && Number(x[1]) === 0 && anchor === 'end') failures.push(`${label}: end-anchored SVG text extends left of canvas`);
      if (x && Number(x[1]) === width && (!anchor || anchor === 'start')) failures.push(`${label}: start-anchored SVG text extends right of canvas`);
      if (font && Number(font[1]) < MIN_FONT) failures.push(`${label}: microscopic SVG label font-size ${font[1]}`);
    }
  }
  validateEvidenceElements(svg, label).forEach((issue) => failures.push(issue));

  const captionMatch = figure.match(/<figcaption[\s\S]*?<\/figcaption>/i);
  const caption = (captionMatch ? captionMatch[0] : '').replace(/<[^>]+>/g, ' ');
  if (!caption.trim()) failures.push(`${label}: missing caption`);
  if (!/(source|المصدر)/i.test(caption)) failures.push(`${label}: caption missing source`);
  if (!/(as of|حتى|بتاريخ)/i.test(caption)) failures.push(`${label}: caption missing as-of`);
  if (!/ic-linkage/.test(figure)) failures.push(`${label}: caption missing tactical linkage`);
  if (/\b(undefined|NaN|null)\b/.test(caption)) failures.push(`${label}: caption leaks null/undefined`);

  const publicText = `${caption} ${svg.replace(/<[^>]+>/g, ' ')}`;
  for (const pattern of FORBIDDEN) {
    if (pattern.test(publicText)) failures.push(`${label}: forbidden retail/advice language ${pattern}`);
  }
  return failures;
}

function listArticles(relative) {
  const directory = path.join(ROOT, relative);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((file) => file.endsWith('.html') && file !== 'index.html');
}

function topicFromFile(file) {
  return file
    .replace(/\.html$/, '')
    .replace(/^(?:structure|research|article)-/, '')
    .replace(/-\d{4}-\d{2}-\d{2}$/, '');
}

function run() {
  const charts = loadManifestIndex();
  const failures = [];
  let scanned = 0;
  for (const [en, ar] of SURFACES) {
    for (const file of listArticles(en)) {
      const enHtml = fs.readFileSync(path.join(ROOT, en, file), 'utf8');
      const enFigures = enHtml.match(FIG_RE) || [];
      const arPath = path.join(ROOT, ar, file);
      const arHtml = fs.existsSync(arPath) ? fs.readFileSync(arPath, 'utf8') : '';
      const arFigures = arHtml.match(FIG_RE) || [];
      if (!enFigures.length && !arFigures.length) continue;
      if (enFigures.length !== arFigures.length) failures.push(`${en}/${file}: EN/AR chart count parity break`);
      scanned += enFigures.length;
      const topic = topicFromFile(file);
      enFigures.forEach((figure, index) => {
        validateFigure(figure, { lang: 'en', charts, label: `${en}/${file}#${index + 1}`, surface: en, topic })
          .forEach((issue) => failures.push(issue));
      });
      arFigures.forEach((figure, index) => {
        validateFigure(figure, { lang: 'ar', charts, label: `${ar}/${file}#${index + 1}`, surface: en, topic })
          .forEach((issue) => failures.push(issue));
      });
    }
  }
  return { failures, scanned };
}

function fixtureFigure() {
  return '<figure class="institutional-chart" data-symbol="SPY" data-chart-type="price_structure" data-series-hash="realhash" data-as-of="2026-06-12" data-relevance-topic="breadth-vs-index"><div class="ic-svg"><svg viewBox="0 0 1200 620" preserveAspectRatio="xMidYMid meet" direction="rtl" data-series-hash="realhash" data-time-axis="true" data-time-ticks="3" data-overlay-count="1"><polyline points="1,2 3,4"/><rect data-zone-type="support_resistance_zone" data-lower="99" data-upper="101" data-method="recent_extrema" data-evidence-refs="series:recent"/><text x="72" y="48" font-size="14">2026-01-01 2026-03-01 2026-06-12</text></svg></div><figcaption class="ic-caption"><span class="ic-linkage">Mixed confirmation</span><span>Source: AlphaVantage - As of 2026-06-12</span></figcaption></figure>';
}

function runSelfTest() {
  const chart = {
    symbol: 'SPY',
    series_hash: 'realhash',
    related_topics: ['breadth-vs-index'],
    allowed_surfaces: ['market-news'],
  };
  const context = { lang: 'ar', charts: new Map([['realhash', chart]]), label: 'fixture', surface: 'market-news', topic: 'breadth-vs-index' };
  const good = fixtureFigure();
  const cases = [
    ['unsupported asset', good.replace('data-symbol="SPY"', 'data-symbol="DOGE"')],
    ['missing relevance', good.replace(' data-relevance-topic="breadth-vs-index"', '')],
    ['irrelevant topic', good.replace('breadth-vs-index', 'gold-real-yields')],
    ['small chart', good.replace('1200 620', '600 300')],
    ['missing time axis', good.replace(' data-time-axis="true"', '')],
    ['too few time ticks', good.replace('data-time-ticks="3"', 'data-time-ticks="1"').replace('2026-01-01 2026-03-01 ', '')],
    ['fixed root size', good.replace('viewBox=', 'width="1200" viewBox=')],
    ['off-canvas text', good.replace('x="72"', 'x="1300"')],
    ['microscopic text', good.replace('font-size="14"', 'font-size="7"')],
    ['zone without evidence', good.replace(' data-evidence-refs="series:recent"', '')],
    ['bad zone bounds', good.replace('data-lower="99" data-upper="101"', 'data-lower="102" data-upper="101"')],
    ['overlay cap', good.replace('data-overlay-count="1"', 'data-overlay-count="6"')],
    ['overlay count mismatch', good.replace('data-overlay-count="1"', 'data-overlay-count="0"')],
    ['unsupported zone type', good.replace('data-zone-type="support_resistance_zone"', 'data-zone-type="observed_range"')],
    ['tactical without evidence', good.replace('<rect data-zone-type="support_resistance_zone" data-lower="99" data-upper="101" data-method="recent_extrema" data-evidence-refs="series:recent"/>', '<rect data-tactical-state="fragile_continuation"/>')],
    ['unsupported tactical state', good.replace('<rect data-zone-type="support_resistance_zone" data-lower="99" data-upper="101" data-method="recent_extrema" data-evidence-refs="series:recent"/>', '<rect data-tactical-state="urgent_breakout" data-evidence-refs="tactical:1"/>')],
    ['unsupported rendered overlay', good.replace('<rect data-zone-type="support_resistance_zone" data-lower="99" data-upper="101" data-method="recent_extrema" data-evidence-refs="series:recent"/>', '<rect data-overlay-type="rsi" data-method="indicator"/>')],
    ['unsafe text anchor', good.replace('x="72"', 'x="0" text-anchor="end"')],
    ['forbidden language', good.replace('Mixed confirmation', 'Entry signal')],
  ];
  let passed = 0;
  for (const [name, candidate] of cases) {
    if (validateFigure(candidate, context).length) passed += 1;
    else console.error(`SELF-TEST FAIL: "${name}" not rejected`);
  }
  if (!validateFigure(good, context).length) passed += 1;
  else console.error('SELF-TEST FAIL: clean figure rejected', validateFigure(good, context));
  console.log(`[embedded-charts] self-test: ${passed}/${cases.length + 1} passed`);
  return passed === cases.length + 1;
}

if (require.main === module && process.argv.includes('--self-test')) {
  process.exit(runSelfTest() ? 0 : 1);
}

if (require.main === module) {
  const { failures, scanned } = run();
  if (failures.length) {
    failures.forEach((message) => console.error(`[embedded-charts] FAIL: ${message}`));
    process.exit(1);
  }
  console.log(`[embedded-charts] check:embedded-charts passed (${scanned} chart(s); relevant, evidence-grounded, time-scaled, responsive, bilingual, RTL-safe).`);
}

module.exports = { validateFigure, validateEvidenceElements, run, runSelfTest };
