'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const warnings = [];
const today = new Date().toISOString().slice(0, 10);
const forbiddenCertainty = /\b(?:guaranteed returns?|guaranteed profits?|certain profits?|guaranteed rally|will definitely|definitely will|certain to|must buy|must sell|sure profit|can't lose|can't miss|price target is certain|buy now|sell now|foolproof|life-changing returns|always rises|to the moon)\b|100%\s+(?:bullish|bearish)/i;
const fabricatedStats = /\b(?:according to unnamed sources|sources say|rumored data|estimated official CPI|fabricated|made-up)\b/i;
const fakeQuote = /\b(?:as told to us|according to our sources|we spoke with|our insider|unnamed trader|market insider told|source close to|unconfirmed reports)\b/i;
const unsupportedClaim = /\b(?:markets will|stocks will rally|guaranteed upside|inevitable crash|price will reach|will outperform the market|definitive price target)\b/i;
const excessiveBrand = /(?:TradeAlphaAI[\s\S]*){5,}/i;

const ALLOWED_NEWS_SOURCE_TYPES = new Set([
  'sec_filing', 'official_earnings_report', 'federal_reserve_release',
  'cpi_release', 'nfp_release', 'gdp_release', 'pce_release',
  'etf_provider_update', 'platform_market_data'
]);
const OUTLOOK_DISCLAIMER_EN = 'This analysis is educational market commentary only. It is not investment advice, financial advice, or a recommendation to buy or sell any asset. Market regimes can shift rapidly and uncertainty remains present.';
const OUTLOOK_DISCLAIMER_EN_LEGACY = 'This analysis is educational market commentary only. It is not investment advice, financial advice, or a recommendation to buy or sell any asset. Market conditions can change rapidly and uncertainty remains present.';
const OUTLOOK_DISCLAIMER_AR = 'هذا التحليل عبارة عن تعليق تعليمي حول الأسواق المالية فقط، ولا يُعتبر نصيحة استثمارية أو مالية أو توصية شراء أو بيع لأي أصل مالي. قد تتغير ظروف السوق بسرعة وتبقى حالة عدم اليقين قائمة.';

checkEconomicCalendar();
checkMarketRegime();
checkLiveMarketState();
checkEditorialQueue();
checkMarketOutlookQueue();
checkNewsQueue();
checkNewsSourceRegistry();
checkDraftTree(path.join(ROOT, 'drafts', 'editorial'), 'editorial');
checkDraftTree(path.join(ROOT, 'drafts', 'market-outlook'), 'market_outlook');
checkDraftTree(path.join(ROOT, 'drafts', 'news-analysis'), 'news_analysis');

if (warnings.length) {
  console.warn('Publishing safety warnings:');
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (failures.length) {
  console.error('Publishing safety check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Publishing safety check passed.');

function checkEconomicCalendar() {
  const calendar = readJson('data/economic-calendar.json', { events: [] });
  for (const event of calendar.events || []) {
    const label = `economic-calendar:${event.id || '<no-id>'}`;
    if (event.status === 'cancelled') failures.push(`${label}: event is cancelled`);
    if (!event.event_time || Number.isNaN(Date.parse(event.event_time))) failures.push(`${label}: invalid timestamp`);
    if (!event.event_name && !event.name) failures.push(`${label}: missing title`);
  }
}

function checkMarketRegime() {
  const regime = readJson('data/market-regime-state.json', { state: {}, sources: [] });
  const state = regime.state || {};
  const sourceRequired = Object.values(state).some((value) => Array.isArray(value) ? value.length : value && value !== 'unverified');
  if (sourceRequired && (!Array.isArray(regime.sources) || !regime.sources.length)) failures.push('market-regime-state: verified regime labels require source URLs');
  for (const source of regime.sources || []) {
    if (!/^https?:\/\//.test(source.url || '')) failures.push('market-regime-state: source missing valid URL');
  }
}

function checkEditorialQueue() {
  const queue = readJson('data/editorial-topic-queue.json', { topics: [] });
  checkQueueBasics('editorial', queue.topics || []);
  checkClusterCooldown('editorial', queue.topics || [], 3);
}

function checkMarketOutlookQueue() {
  const queue = readJson('data/market-outlook-queue.json', { topics: [] });
  checkQueueBasics('market_outlook', queue.topics || []);
  checkClusterCooldown('market_outlook', queue.topics || [], 14);
  if (queue.policy) {
    if (queue.policy.disclaimer_en !== OUTLOOK_DISCLAIMER_EN && queue.policy.disclaimer_en !== OUTLOOK_DISCLAIMER_EN_LEGACY) failures.push('market_outlook policy: required EN disclaimer mismatch');
    if (queue.policy.disclaimer_ar !== OUTLOOK_DISCLAIMER_AR) failures.push('market_outlook policy: required AR disclaimer mismatch');
  }
  for (const topic of queue.topics || []) {
    const text = JSON.stringify(topic);
    if (topic.disclaimer_en && !text.includes(OUTLOOK_DISCLAIMER_EN) && !text.includes(OUTLOOK_DISCLAIMER_EN_LEGACY)) failures.push(`${topic.slug}: market outlook missing required EN disclaimer`);
    if (topic.disclaimer_ar && !text.includes(OUTLOOK_DISCLAIMER_AR)) failures.push(`${topic.slug}: market outlook missing required AR disclaimer`);
  }
}

function checkNewsQueue() {
  const queue = readJson('data/news-analysis-queue.json', { topics: [] });
  checkQueueBasics('news_analysis', queue.topics || []);
  for (const topic of queue.topics || []) {
    if (!Array.isArray(topic.sources) || topic.sources.length === 0) {
      failures.push(`${topic.slug}: news_analysis requires explicit real sources`);
      continue;
    }
    for (const source of topic.sources || []) {
      if (!source.url || !/^https?:\/\//.test(source.url)) failures.push(`${topic.slug}: news_analysis source missing valid URL`);
      if (!source.type || !ALLOWED_NEWS_SOURCE_TYPES.has(source.type)) failures.push(`${topic.slug}: news_analysis source has unsupported type "${source.type || '<missing>'}"`);
    }
  }
}

function checkNewsSourceRegistry() {
  const registry = readJson('data/news-source-registry.json', { sources: [] });
  if (registry.policy && registry.policy.auto_publish !== false) failures.push('news-source-registry: policy.auto_publish must be false');
  for (const source of registry.sources || []) {
    const label = source.source_name || '<unnamed>';
    if (!source.source_url || !/^https?:\/\//.test(source.source_url)) failures.push(`news-source-registry:${label}: missing valid source_url`);
    if (!source.source_type || !ALLOWED_NEWS_SOURCE_TYPES.has(source.source_type)) failures.push(`news-source-registry:${label}: unsupported source_type "${source.source_type || '<missing>'}"`);
    if (!source.fetched_at || !/^\d{4}-\d{2}-\d{2}/.test(source.fetched_at)) failures.push(`news-source-registry:${label}: fetched_at must be YYYY-MM-DD`);
    if (!Array.isArray(source.related_tickers) || !source.related_tickers.length) failures.push(`news-source-registry:${label}: related_tickers must be a non-empty array`);
  }
}

function checkLiveMarketState() {
  const state = readJson('data/live-market-state.json', null);
  if (!state) return;
  const status = state.metadata && state.metadata.status;
  if (!status || status === 'fallback') return;

  const NUMERIC_BOUNDS = {
    sp500: [100, 100000], nasdaq: [100, 100000], dowjones: [1000, 200000],
    russell2000: [50, 10000], vix: [1, 200], us10y_yield: [-5, 25],
    dxy: [50, 200], gold: [100, 15000], bitcoin: [100, 10000000]
  };
  const STRING_ALLOWED = {
    ai_sector_momentum: new Set(['bullish', 'bearish', 'neutral', 'mixed', 'unverified']),
    semiconductor_momentum: new Set(['bullish', 'bearish', 'neutral', 'mixed', 'unverified']),
    market_regime: new Set(['risk-on', 'risk-off', 'mixed', 'unverified']),
    risk_state: new Set(['elevated', 'moderate', 'low', 'unverified']),
    volatility_state: new Set(['elevated', 'moderate', 'low', 'unverified'])
  };
  const STALENESS_MS = 26 * 3600 * 1000;

  for (const [field, [min, max]] of Object.entries(NUMERIC_BOUNDS)) {
    const entry = state[field];
    if (!entry || entry.value === null) continue;
    if (typeof entry.value !== 'number' || !isFinite(entry.value)) {
      failures.push('live-market-state:' + field + ': value must be a finite number');
    } else if (entry.value < min || entry.value > max) {
      failures.push('live-market-state:' + field + ': value ' + entry.value + ' outside valid range [' + min + ', ' + max + ']');
    }
    if (!entry.source_url || !/^https?:\/\//.test(entry.source_url)) {
      failures.push('live-market-state:' + field + ': non-null value requires valid source_url');
    }
    if (entry.fetched_at) {
      const age = Date.now() - new Date(entry.fetched_at).getTime();
      if (isNaN(age) || age > STALENESS_MS) warnings.push('live-market-state:' + field + ': fetched_at ' + entry.fetched_at + ' may be stale (>26h)');
    }
  }
  for (const [field, allowed] of Object.entries(STRING_ALLOWED)) {
    const entry = state[field];
    if (!entry || entry.value === null) continue;
    if (!allowed.has(entry.value)) failures.push('live-market-state:' + field + ': value "' + entry.value + '" not in allowed set');
  }
}

function checkQueueBasics(name, topics) {
  const slugs = new Set();
  const titles = [];
  for (const topic of topics) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.slug || '')) failures.push(`${name}: malformed slug ${topic.slug || '<missing>'}`);
    if (slugs.has(topic.slug)) failures.push(`${name}: duplicate slug ${topic.slug}`);
    slugs.add(topic.slug);
    const title = normalize(topic.title_en || topic.title || '');
    if (title) {
      const duplicate = titles.find((existing) => similarity(existing, title) >= 0.82);
      if (duplicate) failures.push(`${name}:${topic.slug}: near-identical title to "${duplicate}"`);
      titles.push(title);
    }
  }
}

function checkClusterCooldown(name, topics, cooldownDays) {
  const recent = topics
    .filter((topic) => ['reviewed', 'scheduled', 'published'].includes(topic.status))
    .filter((topic) => topic.target_publish_date || topic.published_at)
    .sort((a, b) => String(a.target_publish_date || a.published_at).localeCompare(String(b.target_publish_date || b.published_at)));
  const lastByCluster = new Map();
  for (const topic of recent) {
    const cluster = topic.discovery_cluster || topic.category || topic.topic_cluster;
    if (!cluster) continue;
    const day = topic.target_publish_date || topic.published_at || today;
    const previous = lastByCluster.get(cluster);
    if (previous && daysBetween(previous.day, day) < cooldownDays) {
      warnings.push(`${name}:${topic.slug}: cluster "${cluster}" repeats within ${cooldownDays} days of ${previous.slug}`);
    }
    lastByCluster.set(cluster, { slug: topic.slug, day });
  }
}

function checkDraftTree(dir, type) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folder = path.join(dir, entry.name);
    for (const name of ['en.html', 'ar.html']) {
      const file = path.join(folder, name);
      if (!fs.existsSync(file)) continue;
      const rel = relative(file);
      const html = fs.readFileSync(file, 'utf8');
      const plain = stripHtml(html);
      const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
      const editorialPlain = stripHtml(articleMatch ? articleMatch[1] : html);
      if (/[\uFFFD]/.test(html) || /\?{3,}/.test(html)) failures.push(`${rel}: malformed UTF-8 or placeholder text`);
      if (name === 'ar.html' && !/<html[^>]+lang="ar"[^>]+dir="rtl"/.test(html)) failures.push(`${rel}: missing Arabic RTL marker`);
      if (forbiddenCertainty.test(plain)) failures.push(`${rel}: forbidden overconfident or advice language`);
      if (fabricatedStats.test(plain)) failures.push(`${rel}: fabricated-source wording found`);
      if (excessiveBrand.test(editorialPlain)) failures.push(`${rel}: excessive TradeAlphaAI repetition`);
      if (!/educational-disclaimer|Educational disclaimer|insight-disclaimer|إخلاء المسؤولية التعليمي|تنبيه تعليمي|educational market commentary|تعليق تعليمي/.test(html)) {
        failures.push(`${rel}: missing educational disclaimer`);
      }
      if (type === 'market_outlook') {
        const required = name === 'ar.html' ? OUTLOOK_DISCLAIMER_AR : OUTLOOK_DISCLAIMER_EN;
        const legacy = name === 'ar.html' ? null : OUTLOOK_DISCLAIMER_EN_LEGACY;
        if (!plain.includes(required) && !(legacy && plain.includes(legacy))) {
          failures.push(`${rel}: missing required market outlook disclaimer`);
        }
      }
      if (type === 'market_outlook') {
        const BANNED = [
          'data is not currently sourced',
          'not currently sourced',
          'educational context:',
          'analysis uses structural context only',
          'editors should verify',
          'framework derived from',
          'placeholder',
          'TODO',
          'TBD',
          'lorem ipsum'
        ];
        for (const phrase of BANNED) {
          if (plain.toLowerCase().includes(phrase.toLowerCase())) {
            failures.push(`${rel}: market_outlook draft contains banned placeholder phrase: "${phrase}"`);
          }
        }
        if (name === 'ar.html') {
          const cleaned = plain
            .replace(/\b(TradeAlphaAI|VIX|NASDAQ|S&P|ETF|CPI|NFP|PCE|FOMC|GDP|DXY)\b/gi, '')
            .replace(/\b[A-Z]{1,5}\b/g, '')
            .replace(/[\d.,%-]+/g, '');
          if (/[A-Za-z]{3,}(\s+[A-Za-z]{3,}){4,}/.test(cleaned)) {
            failures.push(`${rel}: market_outlook AR draft contains English sentence fragments`);
          }
        }
      }
      if (type === 'news_analysis' && !/id="sources"/.test(html)) failures.push(`${rel}: news-analysis draft missing id="sources" section`);
      if (type === 'news_analysis' && name === 'ar.html' && !/[؀-ۿ]/.test(plain)) failures.push(`${rel}: news-analysis Arabic draft contains no Arabic text`);
    }
  }
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function similarity(a, b) {
  const aSet = new Set(a.split(' ').filter(Boolean));
  const bSet = new Set(b.split(' ').filter(Boolean));
  if (!aSet.size || !bSet.size) return 0;
  const overlap = [...aSet].filter((word) => bSet.has(word)).length;
  return overlap / Math.max(aSet.size, bSet.size);
}

function daysBetween(a, b) {
  return Math.abs((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}

function stripHtml(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function readJson(rel, fallback) {
  const file = path.join(ROOT, rel);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}
