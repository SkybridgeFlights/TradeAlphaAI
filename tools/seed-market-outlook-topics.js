'use strict';

// ── Market Outlook Topic Seeder ───────────────────────────────────────────────
// Generates up to 4 planned market outlook topics for upcoming publish slots,
// seeded from macro calendar events and structural ETF/rate/regime themes.
//
// LEGAL: All seeded titles and summaries are educational. No certainty language.
// No guaranteed predictions. No investment advice. No price targets.

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const QUEUE_PATH    = path.join(ROOT, 'data', 'market-outlook-queue.json');
const CALENDAR_PATH = path.join(ROOT, 'data', 'economic-calendar.json');
const MEMORY_PATH   = path.join(ROOT, 'data', 'topic-memory.json');

const MAX_SEED             = 4;
const HORIZON_DAYS         = 28;
const PUBLISH_DAYS         = [1, 2, 4, 6]; // Mon=1 Tue=2 Thu=4 Sat=6 (UTC)
const COOLDOWN_DEFAULT     = 14;
const COOLDOWN_ETF         = 30;
const COOLDOWN_MACRO_EVENT = 21;
const SIMILARITY_THRESHOLD = 0.82;
const SEEDER_VERSION       = '1.0';

// ── Template library ──────────────────────────────────────────────────────────
// Indexed by semantic cluster. event_types[] links to economic-calendar types.
// Structural themes have empty event_types and activate as fallback.

const TEMPLATES = [
  {
    key: 'FOMC',
    slug_prefix: 'fomc-watch',
    event_types: ['FOMC', 'Fed Speech'],
    topic_cluster: 'fomc_macro_outlook',
    discovery_cluster: 'macro_event_preview',
    macro_tags: ['FOMC', 'Federal Reserve', 'interest rates', 'monetary policy'],
    event_tags: ['FOMC'],
    cooldown_days: COOLDOWN_MACRO_EVENT,
    title_en: 'FOMC Watch: Federal Reserve Meeting Context and Educational Market Scenarios',
    title_ar: 'مراقبة الاحتياطي الفيدرالي: سياق الاجتماع وسيناريوهات السوق التعليمية',
    summary_en: 'Educational overview of upcoming Federal Reserve meeting context, interest rate environment, and conditional market scenarios — not a prediction or investment recommendation.',
    summary_ar: 'نظرة تعليمية عامة على سياق اجتماع الاحتياطي الفيدرالي القادم وبيئة أسعار الفائدة والسيناريوهات السوقية المشروطة — وليست توقعًا أو توصية استثمارية.',
  },
  {
    key: 'CPI',
    slug_prefix: 'cpi-context',
    event_types: ['CPI', 'Core CPI'],
    topic_cluster: 'cpi_inflation_context',
    discovery_cluster: 'macro_event_preview',
    macro_tags: ['CPI', 'inflation', 'consumer prices', 'price index'],
    event_tags: ['CPI'],
    cooldown_days: COOLDOWN_MACRO_EVENT,
    title_en: 'CPI Release Context: Reading Inflation in the Current Market Environment',
    title_ar: 'سياق بيانات مؤشر أسعار المستهلك: قراءة التضخم في بيئة السوق الحالية',
    summary_en: 'Educational analysis of CPI inflation data context, historical ranges, and conditional market scenarios — not investment advice.',
    summary_ar: 'تحليل تعليمي لسياق بيانات التضخم لمؤشر أسعار المستهلك والنطاقات التاريخية والسيناريوهات السوقية المشروطة — وليست نصيحة استثمارية.',
  },
  {
    key: 'NFP',
    slug_prefix: 'nfp-preview',
    event_types: ['NFP', 'Unemployment'],
    topic_cluster: 'nfp_labor_context',
    discovery_cluster: 'macro_event_preview',
    macro_tags: ['NFP', 'non-farm payrolls', 'labor market', 'employment'],
    event_tags: ['NFP'],
    cooldown_days: COOLDOWN_MACRO_EVENT,
    title_en: 'NFP Jobs Report Context: Labor Market Signals and Educational Scenarios',
    title_ar: 'سياق تقرير الوظائف: إشارات سوق العمل والسيناريوهات التعليمية',
    summary_en: 'Educational overview of non-farm payrolls data context, labor market signals, and conditional market scenarios — not a forecast or investment recommendation.',
    summary_ar: 'نظرة تعليمية عامة على سياق بيانات الوظائف خارج القطاع الزراعي وإشارات سوق العمل والسيناريوهات السوقية المشروطة — وليست توقعًا أو توصية استثمارية.',
  },
  {
    key: 'PCE',
    slug_prefix: 'pce-inflation',
    event_types: ['PCE'],
    topic_cluster: 'pce_inflation_context',
    discovery_cluster: 'macro_event_preview',
    macro_tags: ['PCE', 'inflation', 'Federal Reserve', 'personal consumption'],
    event_tags: ['PCE'],
    cooldown_days: COOLDOWN_MACRO_EVENT,
    title_en: "PCE Inflation Context: The Fed's Preferred Measure and Educational Scenarios",
    title_ar: 'سياق تضخم مؤشر نفقات الاستهلاك الشخصي: المقياس المفضل للاحتياطي الفيدرالي والسيناريوهات التعليمية',
    summary_en: 'Educational context for the PCE inflation release, its role in Federal Reserve policy, and conditional market scenarios — not investment advice.',
    summary_ar: 'سياق تعليمي لبيانات تضخم مؤشر نفقات الاستهلاك الشخصي ودوره في سياسة الاحتياطي الفيدرالي والسيناريوهات السوقية المشروطة — وليست نصيحة استثمارية.',
  },
  {
    key: 'GDP',
    slug_prefix: 'gdp-context',
    event_types: ['GDP'],
    topic_cluster: 'gdp_growth_context',
    discovery_cluster: 'macro_event_preview',
    macro_tags: ['GDP', 'economic growth', 'growth data', 'output'],
    event_tags: ['GDP'],
    cooldown_days: COOLDOWN_MACRO_EVENT,
    title_en: 'GDP Context: Growth Signals and Educational Market Scenarios',
    title_ar: 'سياق الناتج المحلي الإجمالي: إشارات النمو والسيناريوهات السوقية التعليمية',
    summary_en: 'Educational analysis of GDP release context, economic growth trajectories, and conditional market scenarios — not a forecast or investment recommendation.',
    summary_ar: 'تحليل تعليمي لسياق بيانات الناتج المحلي الإجمالي ومسارات النمو الاقتصادي والسيناريوهات السوقية المشروطة — وليست توقعًا أو توصية استثمارية.',
  },
  {
    key: 'RETAIL_SALES',
    slug_prefix: 'retail-sales',
    event_types: ['Retail Sales'],
    topic_cluster: 'retail_sales_context',
    discovery_cluster: 'macro_event_preview',
    macro_tags: ['Retail Sales', 'consumer spending', 'economic data'],
    event_tags: ['Retail Sales'],
    cooldown_days: COOLDOWN_DEFAULT,
    title_en: 'Retail Sales Context: Consumer Spending Signals and Educational Market Scenarios',
    title_ar: 'سياق مبيعات التجزئة: إشارات الإنفاق الاستهلاكي والسيناريوهات السوقية التعليمية',
    summary_en: 'Educational overview of retail sales data context, consumer spending trends, and conditional market scenarios — not investment advice.',
    summary_ar: 'نظرة تعليمية عامة على سياق بيانات مبيعات التجزئة واتجاهات الإنفاق الاستهلاكي والسيناريوهات السوقية المشروطة — وليست نصيحة استثمارية.',
  },
  {
    key: 'JOBLESS_CLAIMS',
    slug_prefix: 'jobless-claims',
    event_types: ['Jobless Claims'],
    topic_cluster: 'jobless_claims_context',
    discovery_cluster: 'macro_event_preview',
    macro_tags: ['Jobless Claims', 'unemployment', 'labor market', 'weekly data'],
    event_tags: ['Jobless Claims'],
    cooldown_days: COOLDOWN_DEFAULT,
    title_en: 'Jobless Claims Context: Weekly Labor Market Signals and Educational Scenarios',
    title_ar: 'سياق طلبات إعانة البطالة: إشارات سوق العمل الأسبوعية والسيناريوهات التعليمية',
    summary_en: 'Educational overview of weekly jobless claims context, labor market signals, and conditional scenarios — not a forecast or investment recommendation.',
    summary_ar: 'نظرة تعليمية عامة على سياق طلبات إعانة البطالة الأسبوعية وإشارات سوق العمل والسيناريوهات المشروطة — وليست توقعًا أو توصية استثمارية.',
  },
  // ── Structural themes (event-independent fallbacks) ───────────────────────
  {
    key: 'AI_SEMICONDUCTOR',
    slug_prefix: 'ai-sector',
    event_types: [],
    topic_cluster: 'ai_semiconductor_outlook',
    discovery_cluster: 'tech_sector_theme',
    macro_tags: ['AI', 'semiconductors', 'technology', 'sector momentum'],
    event_tags: [],
    cooldown_days: COOLDOWN_DEFAULT,
    title_en: 'AI and Semiconductor Sector Context: Educational Momentum and Scenario Review',
    title_ar: 'سياق قطاع الذكاء الاصطناعي وأشباه الموصلات: مراجعة تعليمية للزخم والسيناريوهات',
    summary_en: 'Educational overview of AI and semiconductor sector momentum signals, ETF rotation context, and conditional scenarios — not investment advice or a directional recommendation.',
    summary_ar: 'نظرة تعليمية عامة على إشارات زخم قطاع الذكاء الاصطناعي وأشباه الموصلات وسياق التناوب في الصناديق المتداولة والسيناريوهات المشروطة — وليست نصيحة استثمارية.',
  },
  {
    key: 'ETF_ROTATION',
    slug_prefix: 'etf-rotation',
    event_types: [],
    topic_cluster: 'etf_rotation_outlook',
    discovery_cluster: 'etf_flow_theme',
    macro_tags: ['ETF flows', 'sector rotation', 'defensive ETFs', 'growth ETFs'],
    event_tags: [],
    cooldown_days: COOLDOWN_ETF,
    title_en: 'ETF Rotation Context: Flow Signals and Educational Sector Scenarios',
    title_ar: 'سياق التناوب في الصناديق المتداولة: إشارات التدفق والسيناريوهات القطاعية التعليمية',
    summary_en: 'Educational analysis of ETF flow themes, sector rotation signals, and conditional market scenarios — not a prediction or investment recommendation.',
    summary_ar: 'تحليل تعليمي لموضوعات تدفق صناديق المؤشرات وإشارات التناوب القطاعي والسيناريوهات السوقية المشروطة — وليس توقعًا أو توصية استثمارية.',
  },
  {
    key: 'TREASURY_YIELDS',
    slug_prefix: 'yield-context',
    event_types: [],
    topic_cluster: 'yield_rates_context',
    discovery_cluster: 'rates_macro_theme',
    macro_tags: ['Treasury yields', 'interest rates', 'yield curve', 'bond market'],
    event_tags: [],
    cooldown_days: COOLDOWN_DEFAULT,
    title_en: 'Treasury Yields and Rate Context: Educational Framework for Market Scenarios',
    title_ar: 'عائدات الخزانة وسياق أسعار الفائدة: إطار تعليمي للسيناريوهات السوقية',
    summary_en: 'Educational overview of Treasury yield movements, rate environment context, and conditional market scenarios — not a forecast or investment recommendation.',
    summary_ar: 'نظرة تعليمية عامة على تحركات عائدات الخزانة وسياق بيئة الفائدة والسيناريوهات السوقية المشروطة — وليست توقعًا أو توصية استثمارية.',
  },
  {
    key: 'MARKET_REGIME',
    slug_prefix: 'market-regime',
    event_types: [],
    topic_cluster: 'market_regime_context',
    discovery_cluster: 'regime_macro_theme',
    macro_tags: ['market regime', 'risk signals', 'volatility', 'market breadth'],
    event_tags: [],
    cooldown_days: COOLDOWN_DEFAULT,
    title_en: 'Market Regime Context: Risk Signals and Educational Outlook Scenarios',
    title_ar: 'سياق نظام السوق: إشارات المخاطر والسيناريوهات التعليمية للتوقعات',
    summary_en: 'Educational context for current market regime signals, risk dynamics, and conditional scenarios — not a prediction or investment recommendation.',
    summary_ar: 'سياق تعليمي لإشارات نظام السوق الحالي وديناميكيات المخاطرة والسيناريوهات المشروطة — وليس توقعًا أو توصية استثمارية.',
  },
];

// ── Slot date helper (defensive multi-field) ──────────────────────────────────
// Topics may use any of these fields for their publish date. Check all.
function getSlotDate(topic) {
  return topic.publish_date || topic.target_publish_date || topic.date || topic.publishDate || null;
}

// ── Main execution ─────────────────────────────────────────────────────────────

const debugMode = process.argv.includes('--debug');

const queue    = readJson(QUEUE_PATH, { topics: [] });
const calendar = readJson(CALENDAR_PATH, { events: [] });
const memory   = readJson(MEMORY_PATH, { recent_topics: [] });
const today    = new Date().toISOString().slice(0, 10);

console.log(`Market outlook topic seeder — ${today}`);
console.log(`Queue has ${(queue.topics || []).length} existing topic(s).`);

// ── Step 1: Print raw topic fields for runtime debugging ──────────────────────
for (const t of (queue.topics || [])) {
  const slotDate = getSlotDate(t);
  const counted = slotDate && ['planned', 'in_review', 'pending', 'generated', 'reviewed', 'published'].includes(t.status);
  console.log(
    `[QUEUE RAW TOPIC] slug=${t.slug} status=${t.status}` +
    ` date=${t.date || 'n/a'} publish_date=${t.publish_date || 'n/a'}` +
    ` target_publish_date=${t.target_publish_date || 'n/a'}` +
    ` counted_occupied=${counted ? 'yes' : 'no'}`
  );
}

// ── Step 2: Build occupied date set — ALL non-cancelled topics occupy their slot
const OCCUPIED_STATUSES = new Set(['planned', 'in_review', 'pending', 'generated', 'reviewed', 'published']);
const occupiedDates = new Set();
for (const t of (queue.topics || [])) {
  const slotDate = getSlotDate(t);
  if (!slotDate) continue;
  const counted = OCCUPIED_STATUSES.has(t.status);
  console.log(`[QUEUE OCCUPANCY] date=${slotDate} slug=${t.slug} status=${t.status} counted=${counted ? 'yes' : 'no'}`);
  if (counted) occupiedDates.add(slotDate);
}

// ── Step 3: Hard assertion — published topics MUST be counted ─────────────────
const publishedWithDates = (queue.topics || []).filter(
  (t) => t.status === 'published' && getSlotDate(t)
);
if (publishedWithDates.length > 0 && occupiedDates.size === 0) {
  console.error(`[BUG] ${publishedWithDates.length} published topic(s) with date fields exist but occupied count is 0`);
  console.error(`[BUG] Published topics: ${publishedWithDates.map((t) => `${t.slug}(${getSlotDate(t)})`).join(', ')}`);
  throw new Error('[BUG] Published market-outlook topics were not counted as occupied — check getSlotDate()');
}

// ── Step 4: Compute free publish slots ────────────────────────────────────────
const candidateDates = getPublishDates(today, HORIZON_DAYS);
const freeDates = candidateDates.filter((d) => !occupiedDates.has(d)).slice(0, MAX_SEED);

console.log(`Occupied slots: ${occupiedDates.size} | Free slots: ${freeDates.length}`);

if (!freeDates.length) {
  console.log(`No free publish slots in the next ${HORIZON_DAYS} days. All slots occupied.`);
  writeSeederOutput(null, 0);
  process.exit(0);
}

console.log(`Free publish slots: ${freeDates.join(', ')}`);

// Resolve upcoming macro events from calendar
const upcomingEvents = (calendar.events || [])
  .filter((e) => e.date >= today && e.status === 'confirmed')
  .sort((a, b) => a.date.localeCompare(b.date));

console.log(`Upcoming calendar events: ${upcomingEvents.length}`);

// Select templates for each free date (cluster+date dedup happens inside)
const assignments = selectTemplates(freeDates, upcomingEvents);

if (!assignments.length) {
  console.log('All eligible templates are in cooldown. No topics seeded this run.');
  writeSeederOutput(null, 0);
  process.exit(0);
}

// ── Step 5: Build topic objects, deduplicate against existing slugs ────────────
const existingSlugs = new Set((queue.topics || []).map((t) => t.slug));
const newTopics = [];
for (const { template, date } of assignments) {
  const topic = buildTopic(template, date);
  if (existingSlugs.has(topic.slug)) {
    console.log(`[SEEDER SKIP] slug=${topic.slug} reason=already_exists`);
  } else {
    newTopics.push(topic);
  }
}

if (!newTopics.length) {
  console.log('All generated topics already exist in the queue. No changes made.');
  writeSeederOutput(null, 0);
  process.exit(0);
}

// ── Step 6: Persist to queue and write machine-readable output for brain ───────
queue.topics  = [...(queue.topics || []), ...newTopics];
queue.updated = today;
fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');

const selectedSlug = newTopics[0].slug;
writeSeederOutput(selectedSlug, newTopics.length);

console.log(`\nSeeded ${newTopics.length} topic(s) into data/market-outlook-queue.json:`);
newTopics.forEach((t) => {
  console.log(`  ${t.slug}`);
  console.log(`    cluster: ${t.topic_cluster}`);
  console.log(`    date:    ${t.target_publish_date}`);
});
console.log(`[SEEDER SELECTED] slug=${selectedSlug}`);

// ── Machine-readable seeder output for brain ──────────────────────────────────
function writeSeederOutput(slug, count) {
  const outDir = path.join(ROOT, 'data', 'intelligence');
  try {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'seeder-last-run.json'),
      JSON.stringify({ slug: slug || null, count: count || 0, seeded_at: today }, null, 2) + '\n',
      'utf8'
    );
  } catch (e) {
    console.warn(`[seeder] Could not write seeder-last-run.json: ${e.message}`);
  }
}

// ── Template selection ─────────────────────────────────────────────────────────

function selectTemplates(freeDates, upcomingEvents) {
  const assignments = [];
  const usedKeys    = new Set();

  const prioritized = getPrioritizedTemplates(upcomingEvents);

  for (const date of freeDates) {
    let assigned = false;
    for (const template of prioritized) {
      if (usedKeys.has(template.key)) continue;
      if (isInCooldown(template))     continue;
      if (hasHeadlineSimilarity(template)) continue;
      // Never re-seed same cluster+date regardless of slug difference
      const clusterDateConflict = (queue.topics || []).some(
        (t) => t.topic_cluster === template.topic_cluster && getSlotDate(t) === date
      );
      if (clusterDateConflict) {
        console.log(`  [skip] ${template.key}: cluster "${template.topic_cluster}" already exists for date ${date}`);
        continue;
      }
      usedKeys.add(template.key);
      assignments.push({ template, date });
      assigned = true;
      break;
    }
    if (!assigned) {
      console.log(`  No eligible template for slot ${date} — all remaining templates in cooldown or already assigned.`);
    }
  }

  return assignments;
}

function getPrioritizedTemplates(upcomingEvents) {
  const eventTemplates    = [];
  const usedTemplateKeys  = new Set();

  // Event-driven templates: match calendar events within 14 days
  for (const event of upcomingEvents) {
    if (daysBetween(today, event.date) > 14) break; // sorted, so safe to break
    const template = TEMPLATES.find(
      (t) => t.event_types.includes(event.type) && !usedTemplateKeys.has(t.key)
    );
    if (template) {
      eventTemplates.push(template);
      usedTemplateKeys.add(template.key);
    }
  }

  // Structural fallbacks — sorted by least-recently-used (oldest publish date first)
  const structural = TEMPLATES
    .filter((t) => t.event_types.length === 0)
    .sort((a, b) => getLastUsedDate(a.topic_cluster).localeCompare(getLastUsedDate(b.topic_cluster)));

  return [...eventTemplates, ...structural];
}

// ── Cooldown and duplicate checks ──────────────────────────────────────────────

function isInCooldown(template) {
  const clusterCooldown = template.cooldown_days;

  // 1. Cluster in topic-memory
  const recentMemory = memory.recent_topics || [];
  if (recentMemory.some(
    (e) => e.cluster === template.topic_cluster && daysSince(e.published_at || e.created_at) < clusterCooldown
  )) {
    console.log(`  [skip] ${template.key}: cluster "${template.topic_cluster}" in topic-memory cooldown (${clusterCooldown}d)`);
    return true;
  }

  // 2. Active topic with same cluster in pipeline, or recently published within cooldown window
  const activeConflict = (queue.topics || []).some((t) => {
    if (t.topic_cluster !== template.topic_cluster) return false;
    if (['planned', 'in_review', 'reviewed'].includes(t.status)) return true;
    if (t.status === 'published') {
      const refDate = getSlotDate(t) || t.last_reviewed || t.published_at;
      return daysSince(refDate) < clusterCooldown;
    }
    return false;
  });
  if (activeConflict) {
    console.log(`  [skip] ${template.key}: cluster "${template.topic_cluster}" already active or recently published (cooldown: ${clusterCooldown}d)`);
    return true;
  }

  // 3. Same macro event tag published within cooldown window
  if (template.event_tags.length > 0) {
    const recentMacro = (queue.topics || []).some(
      (t) =>
        t.status === 'published' &&
        (t.event_tags || []).some((tag) => template.event_tags.includes(tag)) &&
        daysSince(t.target_publish_date || t.last_reviewed) < clusterCooldown
    );
    if (recentMacro) {
      console.log(`  [skip] ${template.key}: macro event tag recently published (cooldown: ${clusterCooldown}d)`);
      return true;
    }
  }

  return false;
}

function hasHeadlineSimilarity(template) {
  const recentTopics = (queue.topics || []).filter(
    (t) => ['reviewed', 'published'].includes(t.status) &&
    daysSince(getSlotDate(t) || t.last_reviewed) < COOLDOWN_DEFAULT
  );
  const aWords = normalize(template.title_en).split(' ').filter(Boolean);
  for (const recent of recentTopics) {
    if (!recent.title_en) continue;
    const bWords = normalize(recent.title_en).split(' ').filter(Boolean);
    if (titleSimilarity(aWords, bWords) >= SIMILARITY_THRESHOLD) {
      console.log(`  [skip] ${template.key}: headline similarity >= ${SIMILARITY_THRESHOLD} vs "${recent.slug}"`);
      return true;
    }
  }
  return false;
}

// ── Topic builder ─────────────────────────────────────────────────────────────

function buildTopic(template, publishDate) {
  return {
    slug:                `${template.slug_prefix}-${publishDate}`,
    title_en:            template.title_en,
    title_ar:            template.title_ar,
    category:            'market_outlook',
    content_type:        'market_outlook',
    topic_cluster:       template.topic_cluster,
    discovery_cluster:   template.discovery_cluster,
    status:              'planned',
    review_status:       'pending',
    target_publish_date: publishDate,
    macro_tags:          template.macro_tags,
    event_tags:          template.event_tags,
    regime_tags:         [],
    confidence_label:    null,
    summary_en:          template.summary_en,
    summary_ar:          template.summary_ar,
    language_support:    ['en', 'ar'],
    seeded_at:           today,
    seeder_version:      SEEDER_VERSION,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPublishDates(fromDate, horizonDays) {
  const dates = [];
  const start = new Date(fromDate + 'T00:00:00Z');
  for (let i = 1; i <= horizonDays && dates.length < MAX_SEED * 3; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    if (PUBLISH_DAYS.includes(d.getUTCDay())) dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function getLastUsedDate(cluster) {
  const entries = (queue.topics || [])
    .filter((t) => t.topic_cluster === cluster)
    .map((t) => t.target_publish_date || '1970-01-01')
    .sort()
    .reverse();
  return entries[0] || '1970-01-01';
}

function daysBetween(dateA, dateB) {
  return Math.floor((new Date(dateB + 'T00:00:00Z') - new Date(dateA + 'T00:00:00Z')) / 86400000);
}

function daysSince(date) {
  if (!date) return Infinity;
  return Math.floor((Date.now() - new Date(`${date}T00:00:00Z`).getTime()) / 86400000);
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function titleSimilarity(aWords, bWords) {
  if (!aWords.length || !bWords.length) return 0;
  const aSet = new Set(aWords);
  const bSet = new Set(bWords);
  const overlap = [...aSet].filter((w) => bSet.has(w)).length;
  return overlap / Math.max(aSet.size, bSet.size);
}

function readJson(file, fallback) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  } catch (error) {
    console.error(`Failed to read ${path.relative(ROOT, file)}: ${error.message}`);
    return fallback;
  }
}
