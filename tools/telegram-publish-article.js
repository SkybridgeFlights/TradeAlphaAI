'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { calculateConfidence } = require('./calculate-market-confidence.js');
const { readMemory, buildSnapshot } = require('./macro-intelligence-core');
const { detectNarrativeDrift } = require('./detect-narrative-drift');
const { buildRegimeSequence } = require('./build-regime-sequence');
const { detectCrossAssetDivergence } = require('./detect-cross-asset-divergence');

const ROOT = path.resolve(__dirname, '..');
const EDITORIAL_QUEUE = path.join(ROOT, 'data', 'editorial-topic-queue.json');
const OUTLOOK_QUEUE = path.join(ROOT, 'data', 'market-outlook-queue.json');
const slug = argValue('--slug');
const localeArg = argValue('--locale') || 'both';
const dryRun = !process.argv.includes('--send');
const forceSend = process.argv.includes('--force-send');
const delayMs = Number(argValue('--delay-ms') || 0);
const siteUrl = (process.env.SITE_URL || 'https://www.tradealphaai.com').replace(/\/$/, '');

if (!slug) fail('Usage: node tools/telegram-publish-article.js --slug=<slug> [--locale=en|ar|both] [--send] [--force-send] [--delay-ms=5000]');
if (!['en', 'ar', 'both'].includes(localeArg)) fail('--locale must be en, ar, or both');

const topic = findTopic(slug);
if (!topic) fail(`Editorial topic not found: ${slug}`);
if (!forceSend && !['published', 'reviewed'].includes(topic.status)) {
  fail(`Refusing to post topic with status=${topic.status}. Telegram announcements require status=published or status=reviewed. Use --force-send only for manual recovery.`);
}

const posts = [];
if (localeArg === 'en' || localeArg === 'both') posts.push(formatPost(topic, 'en'));
if (localeArg === 'ar' || localeArg === 'both') posts.push(formatPost(topic, 'ar'));

if (dryRun) {
  console.log('DRY_RUN active. No Telegram message was sent.');
  posts.forEach((post, index) => {
    console.log(`\n--- Telegram preview ${index + 1} (${post.locale}) ---`);
    console.log(post.text);
  });
  process.exit(0);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHANNEL_ID;
if (!token || !chatId) fail('TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID are required when --send is used.');

(async () => {
  for (const post of posts) {
    if (delayMs > 0) await wait(delayMs);
    await sendTelegram(token, chatId, post.text);
    console.log(`Sent Telegram post for ${topic.slug} (${post.locale}).`);
  }
})().catch((error) => fail(error.message));

function findTopic(slugValue) {
  const editorial = readJson(EDITORIAL_QUEUE, { topics: [] });
  const foundEditorial = (editorial.topics || []).find((item) => item.slug === slugValue);
  if (foundEditorial) return { ...foundEditorial, content_type: 'insight' };
  const outlook = readJson(OUTLOOK_QUEUE, { topics: [] });
  const foundOutlook = (outlook.topics || []).find((item) => item.slug === slugValue);
  return foundOutlook ? { ...foundOutlook, content_type: 'market_outlook' } : null;
}

function formatPost(topic, locale) {
  const title = resolveTitle(topic, locale);
  const summary = resolveSummary(topic, locale);
  const url = `${siteUrl}${locale === 'ar' ? '/ar' : ''}/${contentPath(topic)}/${topic.slug}.html`;
  const ar = locale === 'ar';

  if (topic.content_type === 'market_outlook') {
    const confidence = computeMarketConfidence();
    const toneEmoji = confidence ? confidence.market_tone_emoji : categoryEmoji(topic);

    // Directional bias line — use stored AI-generated bias when available
    const biasValue = topic.directional_bias || null;
    const biasBadge = biasValue
      ? (ar
          ? `🧭 ${biasValue}`
          : `🧭 Directional bias: ${biasValue}`)
      : (confidence
          ? (ar
              ? `📊 نبرة تعليمية: ${confidenceLabelAr(confidence.label)} · ${uncertaintyLabelAr(confidence.uncertainty_label)}`
              : `📊 Educational tone: ${titleCase(confidence.label)} · ${confidence.uncertainty_label}`)
          : '');

    const disclaimer = ar
      ? '⚠️ هذا تعليق تعليمي فقط. ليس نصيحة استثمارية.'
      : '⚠️ Educational commentary only. Not investment advice.';

    // Live regime context line (only when live data is available)
    const liveMarket = readLiveMarketState();
    const liveRegimeLine = (() => {
      if (!liveMarket.metadata || liveMarket.metadata.status !== 'live') return null;
      const r = liveMarket.computed_regime || {};
      const mr = r.market_regime;
      const vixLevel = liveMarket.vix && liveMarket.vix.value;
      if (!mr || mr === 'mixed' || mr === 'unverified') return null;
      const regimeLabel = {
        growth_momentum: ar ? 'زخم النمو' : 'Growth momentum',
        defensive_rotation: ar ? 'تناوب دفاعي' : 'Defensive rotation',
        'risk-on': ar ? 'شهية المخاطرة' : 'Risk-on',
        'risk-off': ar ? 'تجنب المخاطر' : 'Risk-off',
        rates_pressure: ar ? 'ضغط معدلات الفائدة' : 'Rates pressure',
        volatility_spike: ar ? 'ارتفاع التقلب' : 'Volatility spike',
      }[mr] || mr;
      const vixNote = typeof vixLevel === 'number'
        ? (ar ? ` · VIX ${vixLevel.toFixed(1)}` : ` · VIX ${vixLevel.toFixed(1)}`) : '';
      return ar
        ? `📡 نظام السوق: ${regimeLabel}${vixNote}`
        : `📡 Market regime: ${regimeLabel}${vixNote}`;
    })();

    const label = ar ? 'تعليق سوقي تعليمي' : 'Educational Market Outlook';
    const lines = [`${toneEmoji} ${label}`, title, '', summary];
    if (biasBadge) lines.push('', biasBadge);
    if (liveRegimeLine) lines.push('', liveRegimeLine);
    const evolution = buildTelegramEvolutionBlock(topic, ar);
    if (evolution.length) lines.push('', ...evolution);
    lines.push('', disclaimer, '', url, '', hashtags(topic, locale));
    return { locale, text: lines.join('\n') };
  }

  return {
    locale,
    text: `${categoryEmoji(topic)} ${title}\n\n${summary}\n\n${url}\n\n${hashtags(topic, locale)}`
  };
}

function buildTelegramEvolutionBlock(topic, ar) {
  try {
    const current = buildSnapshot({ slug: topic.slug, topic });
    const memory = readMemory();
    const drift = detectNarrativeDrift(current, memory);
    const sequence = buildRegimeSequence(current, memory);
    const divergence = detectCrossAssetDivergence(current);
    if (ar) {
      return [
        `Regime shift: ${truncate(drift.notes[0] || 'Macro narrative continuity is stable.', 120)}`,
        `Dominant condition: ${truncate(current.dominant_macro_narrative, 110)}`,
        `Internal divergence: ${truncate(divergence.primary_tension.signal, 90)}`,
        `Risk appetite: ${current.dominant_risk_regime || 'unverified'} · ${sequence.primary_sequence.transition_maturity}`
      ];
    }
    return [
      `Regime transition note: ${truncate(drift.notes[0] || 'Macro narrative continuity is stable.', 135)}`,
      `Dominant macro condition: ${truncate(current.dominant_macro_narrative, 125)}`,
      `Internal divergence signal: ${truncate(divergence.primary_tension.signal, 100)}`,
      `Risk appetite state: ${current.dominant_risk_regime || 'unverified'} · sequence ${sequence.primary_sequence.transition_maturity}`
    ];
  } catch (_) {
    return [];
  }
}

function resolveTitle(topic, locale) {
  const ar = locale === 'ar';
  const paths = articlePaths(topic, locale);
  const candidates = ar
    ? [
        ...paths.flatMap((rel) => [extractHtmlMeta(rel, ['og:title', 'twitter:title']), extractHtmlTitle(rel)]),
        topic.title_ar
      ]
    : [
        topic.title_en,
        ...paths.flatMap((rel) => [extractHtmlMeta(rel, ['og:title', 'twitter:title']), extractHtmlTitle(rel)])
      ];
  for (const candidate of candidates) {
    const clean = cleanText(candidate, { requireArabic: ar, stripBrand: true });
    if (isSafeText(clean, ar)) return clean;
  }
  return ar ? 'بحث تعليمي جديد من TradeAlphaAI' : topic.title_en || 'New TradeAlphaAI Educational Research';
}

function resolveSummary(topic, locale) {
  const ar = locale === 'ar';
  const cluster = topic.discovery_cluster || topic.category || 'market research';
  const paths = articlePaths(topic, locale);
  const candidates = ar
    ? [readArLocalizationSummary(topic.slug), topic.summary_ar, ...paths.map(extractHtmlDescription)]
    : [topic.summary_en, ...paths.map(extractHtmlDescription)];
  for (const candidate of candidates) {
    const clean = cleanText(candidate, { requireArabic: ar });
    if (isSafeText(clean, ar)) return truncate(clean, ar ? 180 : 170);
  }
  return ar
    ? 'ملخص تعليمي قصير من TradeAlphaAI يوضح الفكرة البحثية دون تقديم نصيحة مالية.'
    : `Short educational summary from TradeAlphaAI on ${cluster}. No financial advice.`;
}

function articlePaths(topic, locale) {
  const ar = locale === 'ar';
  const base = contentPath(topic);
  const draftBase = topic.content_type === 'market_outlook' ? 'drafts/market-outlook' : 'drafts/editorial';
  return ar
    ? [`ar/${base}/${topic.slug}.html`, `${draftBase}/${topic.slug}/ar.html`]
    : [`${base}/${topic.slug}.html`, `${draftBase}/${topic.slug}/en.html`];
}

function contentPath(topic) {
  return topic.content_type === 'market_outlook' ? 'market-outlook' : 'insights';
}

function categoryEmoji(topic) {
  const value = topicText(topic);
  if (value.includes('market_outlook') || value.includes('outlook')) return '📊';
  if (value.includes('dividend')) return '💵';
  if (value.includes('semiconductor') || value.includes('ai')) return '🧠';
  if (value.includes('risk') || value.includes('defensive')) return '🛡️';
  if (value.includes('etf')) return '📘';
  return '📈';
}

function hashtags(topic, locale) {
  const value = topicText(topic);
  const tags = ['#TradeAlphaAI'];
  if (topic.content_type === 'market_outlook') tags.push('#MarketOutlook');
  for (const eventTag of topic.event_tags || []) {
    const tag = hashtagForEvent(eventTag);
    if (tag) tags.push(tag);
  }
  if (value.includes('macro') || value.includes('rates') || value.includes('fed')) tags.push('#Macro');
  if (value.includes('semiconductor')) tags.push('#Semiconductors');
  if (value.includes('ai')) tags.push('#AIStocks');
  if (value.includes('dividend')) tags.push('#DividendETF');
  if (value.includes('etf')) tags.push(topic.content_type === 'market_outlook' ? '#ETFResearch' : '#ETF');

  // Market-state-aware tags (non-promotional — only added when live data exists)
  const market = readLiveMarketState();
  if (market.metadata && market.metadata.status === 'live') {
    const vix = market.vix && market.vix.value;
    if (typeof vix === 'number' && vix > 30) tags.push('#MarketStress');
    else if (typeof vix === 'number' && vix > 20) tags.push('#HighVolatility');
    // v2.0 computed_regime signals
    const regime = market.computed_regime || {};
    const mr = regime.market_regime;
    if (mr === 'growth_momentum') tags.push('#GrowthMomentum');
    else if (mr === 'defensive_rotation') tags.push('#DefensiveRotation');
    else if (mr === 'risk-on') tags.push('#RiskOn');
    else if (mr === 'risk-off') tags.push('#RiskOff');
    else if (mr === 'rates_pressure') tags.push('#RatesPressure');
    // AI/semiconductor momentum
    const aiMom = regime.ai_sector_momentum || (market.ai_sector_momentum && market.ai_sector_momentum.value);
    if (aiMom === 'bullish') tags.push('#AIRally');
    else if (aiMom === 'bearish') tags.push('#TechPressure');
    const semiStr = regime.semiconductor_strength;
    if (semiStr === 'strong' && !tags.includes('#AIRally') && !tags.includes('#Semiconductors')) tags.push('#SemiRally');
    // VIX-based fallback
    const volRegime = regime.volatility_regime;
    if ((volRegime === 'elevated' || volRegime === 'stress') &&
        !tags.some(t => t.includes('Volatility') || t.includes('Stress'))) tags.push('#MarketVolatility');
  }

  tags.push(locale === 'ar' ? '#استثمار' : '#Investing');
  return [...new Set(tags)].slice(0, 6).join(' ');
}

function readLiveMarketState() {
  const file = path.join(ROOT, 'data', 'live-market-state.json');
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  } catch (_) {
    return {};
  }
}

function computeMarketConfidence() {
  const market = readLiveMarketState();
  if (!market.metadata || market.metadata.status !== 'live') return null;
  const valueOf = (field) => (market[field] && market[field].value !== undefined ? market[field].value : null);
  const calendarFile = path.join(ROOT, 'data', 'economic-calendar.json');
  let proximityDays = null;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const cal = fs.existsSync(calendarFile) ? JSON.parse(fs.readFileSync(calendarFile, 'utf8')) : { events: [] };
    const upcoming = (cal.events || []).filter((e) => e.date >= today && e.status === 'confirmed').sort((a, b) => a.date.localeCompare(b.date));
    if (upcoming[0]) proximityDays = Math.floor((new Date(upcoming[0].date + 'T00:00:00Z') - Date.now()) / 86400000);
  } catch (_) {}
  return calculateConfidence({
    vix: valueOf('vix'),
    volatilityState: valueOf('volatility_state'),
    riskState: valueOf('risk_state'),
    aiMomentum: valueOf('ai_sector_momentum'),
    marketRegime: valueOf('market_regime'),
    eventProximityDays: proximityDays
  });
}

function confidenceLabelAr(label) {
  const map = { constructive: 'بنّاء', 'improving breadth': 'تحسّن التوسع', cautious: 'حذر', defensive: 'دفاعي', volatile: 'متقلب', 'elevated uncertainty': 'ارتفاع عدم اليقين' };
  return map[label] || label;
}

function uncertaintyLabelAr(label) {
  const map = { 'low uncertainty': 'عدم يقين منخفض', 'moderate uncertainty': 'عدم يقين معتدل', 'elevated uncertainty': 'ارتفاع عدم اليقين', 'high uncertainty': 'عدم يقين مرتفع' };
  return map[label] || label;
}

function topicText(topic) {
  return `${topic.content_type || ''} ${topic.category || ''} ${topic.discovery_cluster || ''} ${topic.topic_cluster || ''} ${(topic.tags || []).join(' ')} ${(topic.event_tags || []).join(' ')}`.toLowerCase();
}

function hashtagForEvent(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('cpi')) return '#CPI';
  if (normalized.includes('fomc')) return '#FOMC';
  if (normalized.includes('nfp')) return '#NFP';
  if (normalized.includes('pce')) return '#PCE';
  if (normalized.includes('gdp')) return '#GDP';
  if (normalized.includes('jobless')) return '#JoblessClaims';
  if (normalized.includes('earnings')) return '#Earnings';
  return '';
}

function readArLocalizationSummary(slugValue) {
  const file = path.join(ROOT, 'data', 'localization', 'ar-insight-content', `${slugValue}.json`);
  if (!fs.existsSync(file)) return '';
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return data.summary || data.description || '';
  } catch (_) {
    return '';
  }
}

function extractHtmlDescription(relPath) {
  return extractHtmlMeta(relPath, ['description', 'og:description', 'twitter:description']);
}

function extractHtmlTitle(relPath) {
  const html = readTextIfExists(relPath);
  if (!html) return '';
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? title[1] : '';
}

function extractHtmlMeta(relPath, names) {
  const html = readTextIfExists(relPath);
  if (!html) return '';
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i')
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return match[1];
    }
  }
  return '';
}

function readTextIfExists(relPath) {
  const file = path.join(ROOT, relPath);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function cleanText(value, options = {}) {
  if (!value) return '';
  let text = String(value);
  text = decodeHtmlEntities(text.replace(/<[^>]+>/g, ' '));
  text = repairMojibake(text);
  text = decodeHtmlEntities(text);
  text = text.replace(/\s+/g, ' ').trim();
  if (options.stripBrand) text = text.replace(/\s*\|\s*TradeAlphaAI\s*$/i, '').trim();
  return text;
}

function repairMojibake(value) {
  if (!/[\u00d8\u00d9\u00c2\u00e2]/.test(value)) return value;
  try {
    const repaired = Buffer.from(value, 'latin1').toString('utf8');
    return scoreText(repaired) > scoreText(value) ? repaired : value;
  } catch (_) {
    return value;
  }
}

function scoreText(value) {
  const arabic = (value.match(/[\u0600-\u06ff]/g) || []).length;
  const broken = (value.match(/[\ufffd\u00d8\u00d9\u00c2\u00e2]|\?{2,}/g) || []).length;
  return arabic * 3 - broken * 4;
}

function isSafeText(value, requireArabic) {
  if (!value) return false;
  if (/[\ufffd]/.test(value) || /\?{2,}/.test(value)) return false;
  if (/[\u00d8\u00d9\u00c2\u00e2]/.test(value)) return false;
  if (requireArabic && !/[\u0600-\u06ff]/.test(value)) return false;
  return value.length >= 8;
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength - 3).replace(/\s+\S*$/, '') + '...';
}

function titleCase(value) {
  return String(value || '').replace(/\b\w/g, (char) => char.toUpperCase());
}

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sendTelegram(tokenValue, chatIdValue, text) {
  const body = JSON.stringify({ chat_id: chatIdValue, text, disable_web_page_preview: false });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${tokenValue}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body, 'utf8')
    }
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error(`Telegram API failed with ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body, 'utf8');
    req.end();
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson(file, fallback = {}) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  } catch (error) {
    fail(`Unable to read ${path.relative(ROOT, file)}: ${error.message}`);
  }
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : '';
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
