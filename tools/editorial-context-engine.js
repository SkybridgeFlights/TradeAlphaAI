'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function buildEditorialContext(topic) {
  const live = readJson(path.join(ROOT, 'data', 'live-market-state.json'));
  const regime = readJson(path.join(ROOT, 'data', 'market-regime-state.json'));
  const memory = readJson(path.join(ROOT, 'data', 'editorial-memory.json'));
  const repairSpec = readJson(path.join(ROOT, 'data', 'intelligence', 'repair-spec.json'));
  const liveVerified = live.metadata?.status === 'live' && live.metadata?.data_quality !== 'none';
  const state = liveVerified ? (live.computed_regime || {}) : (regime.state || {});
  const verifiedSignals = liveVerified
    ? {
        volatility: verifiedValue(state.volatility_regime),
        rates: verifiedValue(state.rates_trend),
        rotation: verifiedValue(state.defensive_rotation),
        risk: verifiedValue(state.risk_regime),
        leadership: Array.isArray(state.sector_leadership) ? state.sector_leadership.slice(0, 3) : []
      }
    : {};

  return {
    evidence_status: liveVerified ? 'verified' : 'conditional',
    generated_at: new Date().toISOString(),
    verified_signals: verifiedSignals,
    recent_angles: (memory.entries || []).slice(-12).map((entry) => entry.angle).filter(Boolean),
    recent_structures: (memory.entries || []).slice(-12).map((entry) => entry.structure).filter(Boolean),
    selected_angle: selectAngle(topic, memory),
    context_note: buildContextNote(topic, verifiedSignals, liveVerified),
    repair_spec: repairSpec.target_slug === topic.slug ? repairSpec : null
  };
}

function buildContextNote(topic, signals, verified) {
  if (!verified) {
    return 'Current market-state inputs are unverified, so the article uses conditional rate, volatility, and rotation analysis rather than presenting a live regime as fact.';
  }
  const parts = [];
  if (signals.rates) parts.push(`rates backdrop: ${signals.rates}`);
  if (signals.volatility) parts.push(`volatility regime: ${signals.volatility}`);
  if (signals.rotation) parts.push(`defensive rotation: ${signals.rotation}`);
  if (signals.risk) parts.push(`risk regime: ${signals.risk}`);
  return parts.length
    ? `Verified local market context used for ${topic.slug}: ${parts.join('; ')}.`
    : 'No verified regime fields were available; conditional analysis was used.';
}

function selectAngle(topic, memory) {
  const candidates = topic.related_etfs?.length >= 2
    ? ['portfolio-construction', 'index-design', 'risk-transmission', 'subindustry-economics']
    : ['risk-transmission', 'market-structure', 'valuation-context', 'portfolio-construction'];
  const recent = new Set((memory.entries || []).slice(-8).map((entry) => entry.angle));
  return candidates.find((angle) => !recent.has(angle)) || candidates[0];
}

function updateEditorialMemory(topic, context, html) {
  const file = path.join(ROOT, 'data', 'editorial-memory.json');
  const memory = readJson(file);
  const entries = Array.isArray(memory.entries) ? memory.entries : [];
  const next = entries.filter((entry) => entry.slug !== topic.slug);
  next.push({
    slug: topic.slug,
    generated_at: new Date().toISOString(),
    category: topic.category,
    cluster: topic.discovery_cluster,
    etfs: topic.related_etfs || [],
    angle: context.selected_angle,
    structure: detectStructure(html),
    opening_fingerprint: openingFingerprint(html),
    internal_links: (html.match(/href="\/[^"]+"/g) || []).length
  });
  const bounded = next.slice(-90);
  fs.writeFileSync(file, JSON.stringify({
    version: '1.0',
    updated_at: new Date().toISOString(),
    max_entries: 90,
    entries: bounded
  }, null, 2) + '\n', 'utf8');
}

function detectStructure(html) {
  const ids = [...String(html || '').matchAll(/<section[^>]+id="([^"]+)"/gi)].map((match) => match[1]);
  return ids.slice(0, 8).join('>');
}

function openingFingerprint(html) {
  const articleBody = (String(html || '').match(/<article[^>]*>([\s\S]*?)<\/article>/i) || [])[1] || html;
  const firstSection = (String(articleBody || '').match(/<section[^>]*>([\s\S]*?)<\/section>/i) || [])[1] || articleBody;
  const paragraph = (String(firstSection || '').match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '';
  return paragraph.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().split(/\s+/).slice(0, 12).join(' ');
}

function verifiedValue(value) {
  return value && value !== 'unverified' ? String(value) : null;
}

function readJson(file) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  } catch {
    return {};
  }
}

module.exports = { buildEditorialContext, updateEditorialMemory };
