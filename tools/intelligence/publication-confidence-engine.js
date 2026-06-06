'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT = path.join(ROOT, 'data', 'intelligence', 'publication-confidence.json');

function assessPublicationConfidence({ slug, draftDir, write = true }) {
  const dir = draftDir || path.join(ROOT, 'drafts', 'editorial', slug);
  const html = read(path.join(dir, 'en.html'));
  const plan = readJson(path.join(dir, 'reasoning-plan.json'), readJson(path.join(ROOT, 'data', 'intelligence', 'article-reasoning-plan.json'), {}));
  const text = stripHtml(extractArticle(html));
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter((item) => wordCount(item) >= 18);
  const sections = [...html.matchAll(/<section\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/gi)]
    .filter((match) => !['faq', 'related-research', 'continue-learning'].includes(match[1]));
  const checks = {
    reasoning_plan_present: plan.slug === slug && (plan.section_plan || []).length >= 8,
    causal_reasoning: count(text, /\b(because|therefore|depends on|transmission|first-order effect|in turn|as a result)\b/gi) >= 8,
    evidence_linkage: count(text, /\b(evidence|observable|verified|issuer materials|filings|earnings revisions|company guidance|market data)\b/gi) >= 5,
    comparative_analysis: count(text, /\b(versus|compared with|by contrast|tradeoff|comparison|different construction)\b/gi) >= 6,
    scenario_framing: /\bbase case\b/i.test(text) && /\bconstructive case\b/i.test(text) && /\badverse case\b/i.test(text),
    analytical_density: analyticalDensity(text) >= 0.42,
    paragraph_depth: paragraphs.length >= 24 && average(paragraphs.map(wordCount)) >= 45,
    section_depth: sections.length >= 8 && sections.every((match) => wordCount(stripHtml(match[2])) >= 120),
    non_advisory: /(does not constitute financial advice|not forecasts or trading signals)/i.test(text),
    plan_consumed: /data-editorial-intelligence="v2"/.test(html) && new RegExp(`data-reasoning-module="${escapeRegExp(plan.topic_module || '')}"`).test(html)
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  const depthScore = Math.round(Object.values(checks).filter(Boolean).length / Object.keys(checks).length * 100);
  const confidence = Math.max(0, Math.min(100, Math.round(depthScore * 0.75 + Math.min(100, wordCount(text) / 15) * 0.25)));
  const report = {
    slug,
    assessed_at: new Date().toISOString(),
    confidence,
    publish_probability: Math.max(0, Math.min(0.98, Number((confidence / 105).toFixed(2)))),
    likely_failed_gates: failed,
    repair_difficulty: failed.length === 0 ? 'none' : failed.length <= 2 ? 'targeted' : 'substantial',
    institutional_depth_score: depthScore,
    institutional_depth_passed: failed.length === 0 && depthScore >= 90,
    confidence_threshold: 90,
    checks
  };
  if (write) writeJson(OUTPUT, report);
  return report;
}

function analyticalDensity(text) {
  const sentences = String(text).split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  const analytical = /(because|while|therefore|however|depends|risk|valuation|liquidity|volatility|concentration|earnings|cash flow|duration|rates|comparison|scenario|transmission)/i;
  return sentences.filter((sentence) => sentence.split(/\s+/).length >= 10 && analytical.test(sentence)).length / Math.max(sentences.length, 1);
}

function extractArticle(html) {
  return (String(html).match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) || [])[1] || html;
}

function stripHtml(value) {
  return String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function wordCount(value) {
  return stripHtml(value).split(/\s+/).filter(Boolean).length;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function count(value, pattern) {
  return (String(value).match(pattern) || []).length;
}

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

function readJson(file, fallback = {}) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback; } catch { return fallback; }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main() {
  const slugArg = process.argv.find((arg) => arg.startsWith('--slug='));
  const slug = slugArg ? slugArg.slice(7) : '';
  if (!slug) {
    console.error('Usage: node tools/intelligence/publication-confidence-engine.js --slug=<slug>');
    process.exit(1);
  }
  const report = assessPublicationConfidence({ slug, write: true });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.institutional_depth_passed && report.confidence >= report.confidence_threshold ? 0 : 1);
}

if (require.main === module) main();

module.exports = { assessPublicationConfidence };
