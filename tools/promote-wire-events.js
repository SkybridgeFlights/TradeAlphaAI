'use strict';

// Phase 72 — Wire Promotion Engine.
// Newsroom escalation: when a high-urgency sourced wire event persists, it is
// promoted into the EXISTING market-outlook queue as a planned topic candidate
// and flows through every existing gate (draft generation, review, publish
// quality, publication transaction, [PUBLISH_VERIFY], Telegram dedupe).
// This engine never publishes directly and never generates content itself.
//
// Anti-spam / anti-loop guarantees:
//   - max 1 promotion per run
//   - 72h cooldown per cluster (promotion ledger)
//   - persistence requirement: event must be >= MIN_AGE_HOURS old
//   - skip if the queue already has a pending (non-published) topic
//   - skip if a same-cluster topic is already pending
//   - promoted topics enter as status=planned (NOT auto-approved)
//
// Run: node tools/promote-wire-events.js --write

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WIRE_PATH = path.join(ROOT, 'data', 'newswire', 'wire-events.json');
const LEDGER_PATH = path.join(ROOT, 'data', 'newswire', 'promotion-ledger.json');
const QUEUE_PATH = path.join(ROOT, 'data', 'market-outlook-queue.json');

const URGENCY_THRESHOLD = 90;
const MIN_AGE_HOURS = 2;
const CLUSTER_COOLDOWN_HOURS = 72;
const TODAY = new Date().toISOString().slice(0, 10);

const CLUSTER_TOPICS = {
  inflation: { en: 'Inflation Print Reaction: Cross-Asset Repricing and Conditional Scenarios', ar: 'تفاعل الأسواق مع بيانات التضخم: إعادة التسعير عبر الأصول وسيناريوهات مشروطة', tags: ['CPI', 'inflation', 'yields', 'Fed policy'] },
  labor: { en: 'Labor Data Reaction: Rate Path Implications and Market Scenarios', ar: 'تفاعل الأسواق مع بيانات سوق العمل: تداعيات مسار الفائدة وسيناريوهات السوق', tags: ['labor market', 'jobless claims', 'rate path'] },
  fed: { en: 'Fed Decision Context: Policy Path Repricing and Cross-Asset Scenarios', ar: 'سياق قرار الفيدرالي: إعادة تسعير مسار السياسة النقدية وسيناريوهات الأصول', tags: ['FOMC', 'Fed policy', 'rate path', 'yields'] },
  growth: { en: 'Growth Data Reaction: Macro Signals and Conditional Market Scenarios', ar: 'تفاعل الأسواق مع بيانات النمو: إشارات الماكرو وسيناريوهات مشروطة', tags: ['GDP', 'economic growth', 'macro data'] },
  rates: { en: 'Rates Repricing Context: Curve Dynamics and Duration Scenarios', ar: 'سياق إعادة تسعير الفائدة: ديناميكيات المنحنى وسيناريوهات الحساسية للفائدة', tags: ['Treasury yields', 'yield curve', 'duration'] },
  volatility: { en: 'Volatility Expansion Context: Hedging Demand and Risk Scenarios', ar: 'سياق تمدد التقلب: الطلب على التحوط وسيناريوهات المخاطر', tags: ['VIX', 'volatility', 'risk signals'] },
  'ai-momentum': { en: 'AI Leadership Move: Concentration Risk and Rotation Scenarios', ar: 'تحرك قيادة الذكاء الاصطناعي: مخاطر التركز وسيناريوهات التناوب', tags: ['AI', 'semiconductors', 'momentum', 'concentration'] },
  tape: { en: 'Cross-Asset Move Context: Transmission Chains and Market Scenarios', ar: 'سياق تحرك الأصول: سلاسل الانتقال وسيناريوهات السوق', tags: ['cross-asset', 'market regime'] },
};

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function hoursSince(iso) {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? (Date.now() - t) / 3600000 : 0;
}

function main() {
  const write = process.argv.includes('--write');
  const wire = readJson(WIRE_PATH, { items: [] });
  const ledger = readJson(LEDGER_PATH, { promotions: [] });
  const queue = readJson(QUEUE_PATH, { topics: [] });

  const log = (decision, detail) => {
    console.log('[WIRE_PROMOTION]');
    console.log(`decision=${decision}`);
    console.log(`detail=${detail}`);
  };

  // Existing pending work blocks promotion (anti-spam: one story at a time).
  const pending = (queue.topics || []).filter((t) => !['published', 'rejected'].includes(t.status));
  if (pending.length > 0) {
    return log('skip', `queue already has ${pending.length} pending topic(s) — promotion waits`);
  }

  const candidates = (wire.items || []).filter((item) => {
    if (item.kind !== 'economic_release' && item.kind !== 'market_move') return false;
    if (item.urgency < URGENCY_THRESHOLD) return false;
    if (hoursSince(item.timestamp) < MIN_AGE_HOURS) return false; // persistence
    const clusterCooldown = (ledger.promotions || []).find(
      (p) => p.cluster === item.cluster && hoursSince(p.promoted_at) < CLUSTER_COOLDOWN_HOURS
    );
    if (clusterCooldown) return false;
    if ((ledger.promotions || []).some((p) => p.wire_id === item.id)) return false; // dedupe
    return true;
  }).sort((a, b) => b.urgency - a.urgency);

  if (!candidates.length) {
    return log('none', 'no persistent high-urgency wire events eligible for promotion');
  }

  const event = candidates[0];
  const template = CLUSTER_TOPICS[event.cluster] || CLUSTER_TOPICS.tape;
  const slug = `wire-${event.cluster}-${TODAY}`;

  if ((queue.topics || []).some((t) => t.slug === slug)) {
    return log('skip', `topic ${slug} already exists — duplicate suppressed`);
  }

  const topic = {
    slug,
    title_en: template.en,
    title_ar: template.ar,
    category: 'market_outlook',
    content_type: 'market_outlook',
    topic_cluster: `wire_${event.cluster}_reaction`,
    discovery_cluster: 'newswire_escalation',
    status: 'planned',
    review_status: 'pending',
    target_publish_date: TODAY,
    macro_tags: template.tags,
    event_tags: [],
    regime_tags: ['unverified'],
    confidence_label: 'cautious',
    summary_en: `Educational cross-asset reaction analysis following: ${event.headline}. Conditional scenarios only — not investment advice.`,
    summary_ar: 'تحليل تعليمي لتفاعل الأصول بعد حدث موثق من الموجز الإخباري، بسيناريوهات مشروطة فقط — وليس نصيحة استثمارية.',
    language_support: ['en', 'ar'],
    seeded_at: TODAY,
    seeder_version: 'wire-promotion-1.0',
    revision_count: 0,
    promotion_source: { wire_id: event.id, headline: event.headline, urgency: event.urgency, attribution: event.attribution },
  };

  if (!write) {
    return log('dry_run', `would promote ${event.id} -> ${slug} (urgency=${event.urgency})`);
  }

  queue.topics.push(topic);
  queue.updated = TODAY;
  writeJson(QUEUE_PATH, queue);
  ledger.promotions = [...(ledger.promotions || []), {
    wire_id: event.id,
    cluster: event.cluster,
    slug,
    urgency: event.urgency,
    promoted_at: new Date().toISOString(),
  }].slice(-50);
  writeJson(LEDGER_PATH, ledger);
  log('promoted', `${event.id} -> ${slug} (urgency=${event.urgency}); topic enters the standard gated pipeline as planned/pending`);
}

main();
