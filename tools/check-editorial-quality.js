'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'editorial-topic-queue.json');
const DRAFT_DIR = path.join(ROOT, 'drafts', 'editorial');
const failures = [];

const queue = readJson(QUEUE_PATH);
const topics = Array.isArray(queue.topics) ? queue.topics : [];
const slugs = new Set();
const allowedStatuses = new Set(queue.policy?.allowed_statuses || ['draft', 'planned', 'queued', 'in_review', 'review', 'reviewed', 'scheduled', 'published']);

if (!topics.length) failures.push('data/editorial-topic-queue.json: topics must not be empty');
if (queue.policy?.auto_publish !== false) failures.push('data/editorial-topic-queue.json: policy.auto_publish must be false');

for (const topic of topics) {
  checkTopic(topic, slugs);
  checkDraftIfPresent(topic);
}

if (failures.length) {
  console.error('Editorial quality check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Editorial quality check passed for ${topics.length} queued topic(s).`);

function checkTopic(topic, slugs) {
  const label = topic.slug || '<missing slug>';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.slug || '')) failures.push(`${label}: malformed editorial slug`);
  if (slugs.has(topic.slug)) failures.push(`${label}: duplicate editorial slug`);
  slugs.add(topic.slug);
  if (!topic.title_en || !topic.title_ar) failures.push(`${label}: missing bilingual titles`);
  if (!topic.category) failures.push(`${label}: missing category`);
  if (!Array.isArray(topic.tags) || topic.tags.length < 2) failures.push(`${label}: needs at least 2 tags`);
  if (!Array.isArray(topic.language_support) || !topic.language_support.includes('en') || !topic.language_support.includes('ar')) failures.push(`${label}: must include EN and AR language support`);
  if (!allowedStatuses.has(topic.status)) failures.push(`${label}: invalid status ${topic.status}`);
  if (topic.status === 'published') checkPublishedTopic(topic);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(topic.target_publish_date || '')) failures.push(`${label}: target_publish_date must be YYYY-MM-DD`);
  if (!Number.isInteger(topic.estimated_read_time) || topic.estimated_read_time < 4 || topic.estimated_read_time > 15) failures.push(`${label}: estimated_read_time must be 4-15 minutes`);
  if (!topic.evergreen_category) failures.push(`${label}: missing evergreen_category`);
  if (!topic.discovery_cluster) failures.push(`${label}: missing discovery_cluster`);
  if (!Array.isArray(topic.related_comparisons)) failures.push(`${label}: related_comparisons must be an array`);
  if (!Array.isArray(topic.related_hubs) || topic.related_hubs.length < 1) failures.push(`${label}: needs at least one related hub`);
  if ([...(topic.related_stocks || []), ...(topic.related_etfs || [])].some((symbol) => !/^[A-Z0-9.]+$/.test(symbol))) failures.push(`${label}: related symbols must be uppercase tickers`);
  if (forbiddenClaims(JSON.stringify(topic))) failures.push(`${label}: forbidden promotional or advice wording found`);
}

function checkDraftIfPresent(topic) {
  const dir = path.join(DRAFT_DIR, topic.slug || '');
  if (!fs.existsSync(dir)) return;
  // Published topics: draft folder is stale staging; published files are validated by checkPublishedTopic
  if (topic.status === 'published') return;
  const files = ['en.html', 'ar.html', 'metadata.json'];
  for (const file of files) {
    if (!fs.existsSync(path.join(dir, file))) failures.push(`${relative(dir)}: missing ${file}`);
  }
  // Only actual publish CANDIDATES must meet publication depth. A `planned`
  // topic has not been through generation+review yet — any draft folder
  // present is a stale prior attempt that the pipeline regenerates when the
  // topic is picked. `manual_revision_required` is a known-failing state.
  // Neither should hard-fail preflight; the publish transaction's own scorer
  // (min-score 90/92) is the real quality gate. Without this, the workflow
  // commits a failed `planned` draft and it blocks the NEXT run's preflight —
  // a self-inflicted publishing deadlock.
  const NON_CANDIDATE = new Set(['manual_revision_required', 'planned', 'failed_generation']);
  const requiresPublicationDepth = !NON_CANDIDATE.has(topic.status);
  for (const locale of ['en', 'ar']) {
    const file = path.join(dir, `${locale}.html`);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const rel = relative(file);
    // Drafts are copied as-is to insights/ by publish-reviewed-article.js — they must be publication-ready
    if (hasCorruptedText(html)) failures.push(`${rel}: corrupted or mojibake text found`);
    if (!/<title>[^<]{10,}<\/title>/.test(html)) failures.push(`${rel}: missing meaningful title`);
    if (!/<meta name="description" content="[^"]{50,}"/.test(html)) failures.push(`${rel}: missing meaningful meta description`);
    if (!/<meta name="robots" content="index,follow/.test(html)) failures.push(`${rel}: must have index,follow robots (draft is copied directly to insights/ on publish)`);
    if (!/<link rel="canonical"/.test(html)) failures.push(`${rel}: missing canonical link`);
    if (!/<link rel="alternate" hreflang="en"/.test(html) || !/<link rel="alternate" hreflang="ar"/.test(html)) failures.push(`${rel}: missing bilingual hreflang`);
    if (!/<meta property="og:title"/.test(html) || !/<meta property="og:description"/.test(html)) failures.push(`${rel}: missing social metadata`);
    if (!/<meta name="twitter:card"/.test(html)) failures.push(`${rel}: missing twitter:card`);
    if (!/<script type="application\/ld\+json">[\s\S]*"Article"[\s\S]*<\/script>/.test(html)) failures.push(`${rel}: missing Article schema`);
    if (!/<script type="application\/ld\+json">[\s\S]*"FAQPage"[\s\S]*<\/script>/.test(html)) failures.push(`${rel}: missing FAQPage schema`);
    if ((html.match(/<details/g) || []).length < 3) failures.push(`${rel}: needs at least 3 FAQ blocks`);
    if (!/id="related-research"/.test(html)) failures.push(`${rel}: missing related-research section`);
    if (!/id="continue-learning"/.test(html)) failures.push(`${rel}: missing continue-learning section`);
    if (!/educational-disclaimer|Educational disclaimer|insight-disclaimer|إخلاء المسؤولية التعليمي|تنبيه تعليمي/.test(html)) failures.push(`${rel}: missing educational disclaimer`);
    if (locale === 'ar' && !/<html[^>]+lang="ar"[^>]+dir="rtl"/.test(html)) failures.push(`${rel}: missing Arabic RTL markers`);
    if (forbiddenClaims(stripHtml(html))) failures.push(`${rel}: forbidden promotional or advice wording found`);
    // Manual-revision drafts remain blocked from approval and publishing. Every other
    // draft must satisfy the same institutional depth gates regardless of source.
    if (locale === 'en' && requiresPublicationDepth && /data-editorial-intelligence="v(?:1|2)"/.test(html)) checkInstitutionalEditorial(html, rel);
  }
  const metadata = path.join(dir, 'metadata.json');
  if (fs.existsSync(metadata)) {
    const data = readJson(metadata);
    const rel = relative(metadata);
    if (hasCorruptedText(JSON.stringify(data))) failures.push(`${rel}: corrupted or mojibake text found`);
    if (data.auto_publish !== false) failures.push(`${rel}: auto_publish must be false`);
    if (topic.status === 'in_review' && data.public_site_updated !== false) failures.push(`${rel}: public_site_updated must be false for generated drafts`);
    if (!Array.isArray(data.languages) || !data.languages.includes('en') || !data.languages.includes('ar')) failures.push(`${rel}: missing bilingual language metadata`);
  }
}

function checkInstitutionalEditorial(html, rel) {
  const text = stripHtml(html);
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter((paragraph) => paragraph.split(/\s+/).length >= 18);
  // Count bullets ONLY within the article body — exclude the global header
  // nav dropdowns and the sidebar related-research chips, which are chrome
  // and would otherwise false-fail `excessive bullet dependency` on every
  // well-formed article.
  const articleBody = html
    .replace(/<!--\s*GLOBAL_HEADER_START\s*-->[\s\S]*?<!--\s*GLOBAL_HEADER_END\s*-->/, '')
    .replace(/<aside class="insight-sidebar"[\s\S]*?<\/aside>/g, '');
  const bullets = (articleBody.match(/<li\b/gi) || []).length;
  const transitions = (html.match(/class="editorial-transition"/g) || []).length;
  const analytical = text.split(/[.!?]+/).filter((sentence) =>
    sentence.split(/\s+/).length >= 12 &&
    /(because|while|however|risk|valuation|concentration|volatility|liquidity|rates|earnings|holdings|expense ratio|transmission|regime|duration)/i.test(sentence)
  ).length;
  const openings = text.split(/[.!?]+/)
    .map((sentence) => sentence.trim().toLowerCase().split(/\s+/).slice(0, 3).join(' '))
    .filter((opening) => opening.split(/\s+/).length >= 2);
  const openingDiversity = openings.length ? new Set(openings).size / openings.length : 0;
  const genericPhrases = (text.match(/it is important to note|investors should consider|can help investors|offers exposure to/gi) || []).length;
  const semanticGroups = [
    /(pharmaceutical|biotech|managed care|medical device|semiconductor|wafer|foundry|cloud|software|cybersecurity|endpoint|duration|yield curve|sector rotation|earnings breadth|subindustry|sector mechanics)/i,
    /(diversification|holdings count|market-cap weighted)/i,
    /(interest rates|defensive rotation|macro|risk appetite)/i,
    /(valuation|cash flow|earnings expectations|risk premium)/i,
    /(concentration|top-ten|largest holdings|mega-cap)/i,
    /(volatility|drawdown|standard deviation)/i,
    /(liquidity|bid-ask spread|trading volume)/i,
    /(portfolio construction|research process|research question|benchmark)/i
  ];

  if (transitions < 6) failures.push(`${rel}: low narrative continuity`);
  if (analytical < 32) failures.push(`${rel}: low analytical density`);
  if (!semanticGroups.every((pattern) => pattern.test(text))) failures.push(`${rel}: low institutional semantic depth`);
  if (openingDiversity < 0.72) failures.push(`${rel}: repetitive sentence openings`);
  if (genericPhrases > 2) failures.push(`${rel}: repetitive generic editorial phrasing`);
  if (bullets >= paragraphs.length) failures.push(`${rel}: excessive bullet dependency`);
  if (/\bETF(s)?\b/i.test(text) && !/class="editorial-comparison-table"/.test(html)) failures.push(`${rel}: shallow ETF comparison coverage`);

  // ── Phase 62: Anti-Generic Hard Gates V2 ─────────────────────────────────────

  // V2 gate: banned generic phrases (institutional quality requires evidence-grounded language)
  checkGenericPhrasesV2(text, rel);

  // V2 gate: macro transmission depth (must explain WHY, not just THAT)
  const transmissionPatterns = [/transmission/i, /rate\s+channel/i, /policy\s+(channel|pathway|mechanism)/i, /repricing/i, /cross.asset/i, /discount\s+rate/i];
  const transmissionHits = transmissionPatterns.filter((p) => p.test(text)).length;
  if (transmissionHits < 2) failures.push(`${rel}: low macro_transmission_depth — article lacks cross-asset transmission reasoning`);

  // V2 gate: comparative depth (ETF comparisons must address structure, not just direction)
  if (/\bETF(s)?\b/i.test(text)) {
    const comparativePatterns = [/concentration\s+risk|holdings\s+structure|allocation\s+implication|sector\s+tilt/i, /idiosyncratic|rate\s+sensitivity|duration\s+exposure/i, /compared\s+to|vs\.\s+[A-Z]{3}|relative\s+to/i, /mega.cap|financing\s+cost|dividend\s+yield\s+spread/i];
    const compareHits = comparativePatterns.filter((p) => p.test(text)).length;
    if (compareHits < 2) failures.push(`${rel}: shallow comparative_depth — ETF comparisons must address allocation structure, rate sensitivity, and concentration risk`);
  }

  // V2 gate: probability reasoning (conditional framing required, not absolute claims)
  const probPatterns = [/probability|historically|in.*of.*\d+.*event/i, /if.*then|scenario/i, /conditioned on|subject to|depends on/i];
  const probHits = probPatterns.filter((p) => p.test(text)).length;
  if (probHits < 1) failures.push(`${rel}: missing probability_reasoning — article must use conditional scenario framing (if X, then Y) not absolute claims`);

  // V2 gate: evidence linkage (claims must reference data, history, or mechanism)
  const evidencePatterns = [/historical(ly)?|based on|evidence|data suggest|pattern/i, /\d+\s*(bp|basis points|%|percent)/i, /\d+\s*of\s*\d+|in.*case|N\s*=\s*\d+/i, /since\s+20\d\d|in\s+(20\d\d|the\s+\d{4}s)|as\s+of\s+20/i];
  const evidenceHits = evidencePatterns.filter((p) => p.test(text)).length;
  if (evidenceHits < 2) failures.push(`${rel}: insufficient evidence_linkage — analytical claims must be grounded in historical data, specific magnitudes, or mechanism description`);
}

function checkGenericPhrasesV2(text, rel) {
  // Banned phrases unless immediately followed by specific evidence (within ~2 sentences)
  const BANNED_PATTERNS = [
    { pattern: /markets\s+are\s+watching/gi, label: 'markets are watching' },
    { pattern: /uncertainty\s+remains/gi, label: 'uncertainty remains' },
    { pattern: /investors\s+reacted/gi, label: 'investors reacted' },
    { pattern: /mixed\s+signals/gi, label: 'mixed signals' },
    { pattern: /market\s+sentiment/gi, label: 'market sentiment' },
    { pattern: /economic\s+concerns/gi, label: 'economic concerns' },
    { pattern: /heightened\s+uncertainty/gi, label: 'heightened uncertainty' },
    { pattern: /volatility\s+spiked/gi, label: 'volatility spiked' },
    { pattern: /market\s+participants/gi, label: 'market participants' }
  ];

  // Evidence anchors — if these appear within 120 chars of the banned phrase, the phrase is acceptable
  const EVIDENCE_ANCHORS = /because|specifically|\d+%|\d+\s*bp|historically|relative to|compared to|in\s+\d{4}|since/i;

  for (const { pattern, label } of BANNED_PATTERNS) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const context = text.slice(Math.max(0, match.index + match[0].length), match.index + match[0].length + 120);
      if (!EVIDENCE_ANCHORS.test(context)) {
        failures.push(`${rel}: anti_generic_gate_v2 — unsupported generic phrase: "${label}" without evidence anchoring`);
        break; // One failure per pattern is sufficient
      }
    }
  }
}

function checkPublishedTopic(topic) {
  const slug = topic.slug || '';
  const enFile = path.join(ROOT, 'insights', `${slug}.html`);
  const arFile = path.join(ROOT, 'ar', 'insights', `${slug}.html`);
  const registryFile = path.join(ROOT, 'data', 'insights', 'article-registry.json');
  if (!fs.existsSync(enFile)) failures.push(`${slug}: published status requires insights/${slug}.html`);
  if (!fs.existsSync(arFile)) failures.push(`${slug}: published status requires ar/insights/${slug}.html`);
  if (!fs.existsSync(registryFile)) failures.push(`${slug}: published status requires article registry`);
  for (const file of [enFile, arFile]) {
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const rel = relative(file);
    if (!/<meta name="robots" content="index,follow/.test(html)) failures.push(`${rel}: published article must be indexable`);
    if (!/<link rel="canonical"/.test(html)) failures.push(`${rel}: missing canonical`);
    if (!/<link rel="alternate" hreflang="ar"/.test(html) || !/<link rel="alternate" hreflang="en"/.test(html)) failures.push(`${rel}: missing bilingual hreflang`);
    if (!/<meta property="og:title"/.test(html) || !/<meta name="twitter:card"/.test(html)) failures.push(`${rel}: missing social metadata`);
    if (!/<script type="application\/ld\+json">[\s\S]*"Article"[\s\S]*<\/script>/.test(html)) failures.push(`${rel}: missing Article schema`);
    if (!/<script type="application\/ld\+json">[\s\S]*"FAQPage"[\s\S]*<\/script>/.test(html)) failures.push(`${rel}: missing FAQ schema`);
    if ((html.match(/<details/g) || []).length < 3) failures.push(`${rel}: missing FAQ blocks`);
    if (!/id="related-research"/.test(html) || !/id="continue-learning"/.test(html)) failures.push(`${rel}: missing related/discovery sections`);
  }
}

function forbiddenClaims(value) {
  return /\b(?:guaranteed profit|best stock to buy|buy now|sure signal|price target|will outperform|must own)\b/i.test(value || '');
}

function hasCorruptedText(value) {
  const text = String(value || '');
  return /[\uFFFD]/.test(text) || /(?:\?{3,}|\u00D8|\u00D9|\u00E2\u20AC|\u00C3)/.test(text);
}

function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push(`${relative(file)}: ${error.message}`);
    return {};
  }
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}
