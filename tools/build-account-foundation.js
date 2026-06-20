'use strict';

// Phase 219 CP1-CP5 + CP7 — Account-Ready Personal Intelligence Foundation.
//
// Builds the canonical account-ready contracts that future Premium /
// Subscription / Alert / Copilot systems will sit on. NO authentication,
// NO user database, NO payments, NO live alert dispatch, NO recommendation
// engine. Foundation only — every contract derives from existing Phase
// 200-218 intelligence artifacts.
//
// Inputs (existing artifacts only):
//   watchlists.json + workspace.json + watchlist-monitoring.json (Phase 218)
//   change-events.json + change-classifications.json (Phase 216)
//   research-hub.json + research-graph.json + research-coverage.json
//   asset-registry, sector-registry, equity-registry, etf-registry
//   market-regime-dashboard.json + market-narrative.json
//
// Outputs (data/intelligence/):
//   account-foundation.json     (CP1)
//   watchlist-contracts.json    (CP2)
//   preferences.json            (CP3)
//   alert-contracts.json        (CP4)
//   workspace-state.json        (CP5)
//   personalization.json        (CP7)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');

const { ASSETS } = require('./asset-registry');
const { SECTORS } = require('./sector-registry');
const { EQUITIES } = require('./equity-registry');
const { ETFS } = require('./etf-registry');

const ALLOWED_ENTITY_TYPES = new Set(['asset', 'sector', 'equity', 'etf']);
const ALLOWED_ALERT_CLASSES = [
  'regime_change',
  'ranking_change',
  'leadership_change',
  'narrative_change',
  'watchlist_change',
  'research_change',
  'change_event',
];
const ALLOWED_PREFERENCES = {
  preferred_language: ['en', 'ar'],
  preferred_homepage: ['intelligence', 'research', 'changes', 'workspace', 'explorer'],
  preferred_entity_type: ['asset', 'sector', 'equity', 'etf'],
  preferred_research_view: ['hub', 'feed', 'regime', 'history'],
  preferred_workspace_layout: ['default', 'compact', 'expanded'],
  preferred_market_focus: ['broad', 'growth', 'defensive', 'cyclical', 'all'],
};

function readJson(p, f = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; }
}

function hash(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 16);
}

// ─── Entity universe (the only valid targets for any account contract) ───
function buildUniverse() {
  const universe = [];
  for (const a of ASSETS) universe.push({ type: 'asset', symbol: a.symbol, slug: a.slug, name_en: a.symbol, name_ar: a.symbol, href: `/markets/${a.slug}/`, research_href: `/research/assets/${a.slug}/` });
  for (const s of SECTORS) universe.push({ type: 'sector', symbol: s.symbol, slug: s.slug, name_en: s.name_en || s.symbol, name_ar: s.name_ar || s.symbol, href: `/sectors/${s.slug}/`, research_href: `/research/sectors/${s.slug}/` });
  for (const e of EQUITIES) universe.push({ type: 'equity', symbol: e.symbol, slug: e.slug, name_en: e.symbol, name_ar: e.symbol, href: `/equities/${e.slug}/`, research_href: `/research/equities/${e.slug}/` });
  for (const f of ETFS) universe.push({ type: 'etf', symbol: f.symbol, slug: f.slug, name_en: f.fund_name || f.symbol, name_ar: f.fund_name || f.symbol, href: `/research/etfs/${f.slug}/`, research_href: `/research/etfs/${f.slug}/` });
  return universe;
}

// ─── CP2 — Watchlist Contracts ────────────────────────────────────────────
function buildWatchlistContracts(stamp) {
  const watchlists = readJson(J('watchlists.json'), { watchlists: [] });
  const valid = (watchlists.watchlists || []).filter((w) => Array.isArray(w.entities) && w.entities.every((e) => ALLOWED_ENTITY_TYPES.has(e.type)));
  // Public default watchlists become the "saved_watchlists" template (the same
  // ones already shipped in Phase 218). personal_watchlists is intentionally
  // empty — populated only when a user account exists (future phase).
  const saved = valid.map((w) => ({
    id: w.id,
    title_en: w.title_en,
    title_ar: w.title_ar,
    thesis_en: w.thesis_en,
    thesis_ar: w.thesis_ar,
    entity_count: (w.entities || []).length,
    href: `/workspace/watchlists/${w.id}/`,
    account_href: `/account/watchlists/`,
    entities: (w.entities || []).map((e) => ({ type: e.type, symbol: e.symbol, slug: e.slug, name_en: e.name_en || e.symbol, href: e.href, research_href: e.research_href })),
  }));
  // Favourites scaffolding — empty arrays today, validator-enforced shape.
  const favoritesShape = (type) => ({ type, count: 0, entities: [], note_en: 'No personal favourites yet — accounts not enabled in this phase.', note_ar: 'لا توجد مفضّلات شخصية بعد — لم تُفعَّل الحسابات في هذه المرحلة.' });
  const artifact = {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'watchlist-contracts',
    contracts_version: '1.0.0',
    personal_watchlists: { count: 0, items: [], note_en: 'Personal watchlists are stored per-account; accounts are not yet enabled.', note_ar: 'قوائم المتابعة الشخصية تُحفظ لكل حساب؛ ولم تُفعَّل الحسابات بعد.' },
    saved_watchlists: { count: saved.length, items: saved },
    favorite_assets: favoritesShape('asset'),
    favorite_sectors: favoritesShape('sector'),
    favorite_equities: favoritesShape('equity'),
    favorite_etfs: favoritesShape('etf'),
    attribution: {
      sources: ['data/intelligence/watchlists.json'],
      note: 'Watchlist contracts derive from the Phase 218 public watchlists registry. Only existing supported entities. No personal user state is fabricated.',
    },
  };
  artifact.contracts_hash = hash({ saved: saved.map((x) => x.id) });
  return artifact;
}

// ─── CP3 — Preference Engine ──────────────────────────────────────────────
function buildPreferences(stamp) {
  // Defaults reflect what an anonymous visitor sees today. Validator enforces
  // every default ∈ allowed enum (no fabricated values).
  const defaults = {
    preferred_language: 'en',
    preferred_homepage: 'intelligence',
    preferred_entity_type: 'asset',
    preferred_research_view: 'hub',
    preferred_workspace_layout: 'default',
    preferred_market_focus: 'broad',
  };
  return {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'preferences',
    contracts_version: '1.0.0',
    allowed: ALLOWED_PREFERENCES,
    defaults,
    overrides: { count: 0, items: [], note_en: 'Per-user preference overrides require an account; accounts are not yet enabled.', note_ar: 'تجاوزات التفضيلات الخاصة بكل مستخدم تتطلب حساباً؛ ولم تُفعَّل الحسابات بعد.' },
    attribution: {
      sources: ['tools/build-account-foundation.js'],
      note: 'Preference contracts. No login, no per-user state — foundation only. Future accounts will validate overrides against the allowed enums.',
    },
  };
}

// ─── CP4 — Alert Foundation ───────────────────────────────────────────────
function buildAlertContracts(stamp) {
  // Each allowed class maps to the existing artifact that would source it.
  // No dispatch, no scheduling — contracts only.
  const eventsCount = (readJson(J('change-events.json'), { total: 0 }).total) || 0;
  const classes = {
    regime_change: { source: 'regime-history.json + regime-transitions.json', trigger_en: 'A real prior → current regime transition is recorded.', trigger_ar: 'تسجيل تحول حقيقي بين النظام السابق والحالي.' },
    ranking_change: { source: 'ranking-history.json (snapshot_count > 1 required)', trigger_en: 'An entity rank label changes between consecutive snapshots.', trigger_ar: 'تغير تصنيف رتبة كيان بين لقطتين متتاليتين.' },
    leadership_change: { source: 'leadership-dashboard.json + change-events.json', trigger_en: 'A leadership_gain or leadership_loss event is emitted.', trigger_ar: 'إصدار حدث اكتساب أو فقدان قيادة.' },
    narrative_change: { source: 'market-narrative.json + market-narrative-state.json (prior_stances required)', trigger_en: 'The dominant market narrative shifts vs a prior recorded stance.', trigger_ar: 'تحول السردية المهيمنة مقابل موقف سابق مسجل.' },
    watchlist_change: { source: 'watchlist-monitoring.json', trigger_en: 'A watchlist entity\'s monitor_state, rank or recent_change_count changes.', trigger_ar: 'تغير حالة المتابعة أو الرتبة أو عدد التغيرات الأخيرة لكيان في قائمة المتابعة.' },
    research_change: { source: 'research-hub.json + research-coverage.json', trigger_en: 'A research category or item composition changes.', trigger_ar: 'تغير تكوين فئة أبحاث أو بند بحثي.' },
    change_event: { source: 'change-events.json', trigger_en: 'Any new change event of the closed allowed class set is emitted.', trigger_ar: 'إصدار أي حدث تغيير جديد من مجموعة الأصناف المغلقة المسموح بها.' },
  };
  return {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'alert-contracts',
    contracts_version: '1.0.0',
    allowed_classes: ALLOWED_ALERT_CLASSES,
    classes,
    dispatch: { enabled: false, channels: [], note_en: 'Alert dispatch is intentionally disabled in this phase. Contracts only.', note_ar: 'إرسال التنبيهات معطّل عمداً في هذه المرحلة. عقود فقط.' },
    metrics: { available_change_events: eventsCount },
    attribution: {
      sources: ['data/intelligence/change-events.json', 'data/intelligence/regime-history.json', 'data/intelligence/leadership-dashboard.json', 'data/intelligence/watchlist-monitoring.json', 'data/intelligence/market-narrative.json'],
      note: 'Allowed alert classes match real source artifacts. Triggers are observed transitions only — never forecasts, never signals, never recommendations.',
    },
  };
}

// ─── CP5 — Personal Workspace State ───────────────────────────────────────
function buildWorkspaceState(stamp) {
  const workspace = readJson(J('workspace.json'), { sections: [], watchlists: [], counts: {} });
  const monitoring = readJson(J('watchlist-monitoring.json'), { watchlists: [] });
  // Default workspace template — same surfaces a visitor sees today. Personal
  // saved workspaces are empty until accounts exist.
  const savedWorkspaces = [{
    id: 'default',
    title_en: 'Default workspace',
    title_ar: 'مساحة العمل الافتراضية',
    sections: workspace.sections || [],
    watchlist_ids: (workspace.watchlists || []).map((w) => w.id),
    href: '/workspace/',
    href_ar: '/ar/workspace/',
  }];
  const monitoredCount = monitoring.watchlists ? monitoring.watchlists.reduce((acc, w) => acc + ((w.entities || []).length), 0) : 0;
  return {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'workspace-state',
    contracts_version: '1.0.0',
    saved_workspaces: { count: savedWorkspaces.length, items: savedWorkspaces },
    monitored_entities: { count: monitoredCount, source: 'data/intelligence/watchlist-monitoring.json' },
    followed_research: { count: 0, items: [], note_en: 'Followed research requires an account; not enabled yet.', note_ar: 'متابعة الأبحاث تتطلب حساباً؛ غير مفعّلة بعد.' },
    followed_regimes: { count: 0, items: [], note_en: 'Followed regimes require an account; not enabled yet.', note_ar: 'متابعة الأنظمة تتطلب حساباً؛ غير مفعّلة بعد.' },
    followed_watchlists: { count: 0, items: [], note_en: 'Followed watchlists require an account; not enabled yet.', note_ar: 'متابعة قوائم المراقبة تتطلب حساباً؛ غير مفعّلة بعد.' },
    attribution: {
      sources: ['data/intelligence/workspace.json', 'data/intelligence/watchlist-monitoring.json'],
      note: 'Workspace state contract derives the default workspace from the Phase 218 workspace. Followed-* arrays are honest empty placeholders until accounts exist.',
    },
  };
}

// ─── CP7 — Personalization Foundation ─────────────────────────────────────
function buildPersonalization(stamp) {
  const universe = buildUniverse();
  // The personalization framework is a CONTRACT for future engines, not a
  // recommendation engine. It declares the inputs a future recommender /
  // copilot would consume and the surfaces it would feed.
  return {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'personalization',
    contracts_version: '1.0.0',
    inputs: {
      preferences: 'data/intelligence/preferences.json',
      watchlist_contracts: 'data/intelligence/watchlist-contracts.json',
      workspace_state: 'data/intelligence/workspace-state.json',
      alert_contracts: 'data/intelligence/alert-contracts.json',
      change_events: 'data/intelligence/change-events.json',
      research_hub: 'data/intelligence/research-hub.json',
      research_graph: 'data/intelligence/research-graph.json',
      entity_research_graph: 'data/intelligence/entity-research-graph.json',
    },
    capabilities: {
      recommendations: { enabled: false, note_en: 'Recommendation engine is not implemented. Future scope.', note_ar: 'محرّك التوصيات غير مُنفّذ. ضمن نطاق مستقبلي.' },
      copilot_context: { enabled: false, note_en: 'Copilot context contract is reserved; no AI copilot is wired.', note_ar: 'عقد سياق المساعد محجوز؛ لا يوجد مساعد ذكاء اصطناعي مفعّل.' },
      personalized_research: { enabled: false, note_en: 'Personalized research will compose research-hub + watchlist + preferences once accounts exist.', note_ar: 'الأبحاث الشخصية ستجمع بين مركز الأبحاث وقوائم المتابعة والتفضيلات بمجرد توفّر الحسابات.' },
      personalized_monitoring: { enabled: false, note_en: 'Personalized monitoring will filter watchlist-monitoring by the user\'s followed entities.', note_ar: 'المراقبة الشخصية ستصفّي مراقبة قوائم المتابعة وفق الكيانات التي يتبعها المستخدم.' },
    },
    entity_universe_size: universe.length,
    attribution: {
      sources: ['data/intelligence/workspace.json', 'data/intelligence/watchlists.json', 'data/intelligence/research-hub.json', 'data/intelligence/change-events.json'],
      note: 'Personalization is a contract framework. No recommendation engine is built; future phases will plug into these inputs.',
    },
  };
}

// ─── CP1 — Account Foundation (umbrella manifest) ─────────────────────────
function build() {
  const stamp = new Date().toISOString();
  const watchlistContracts = buildWatchlistContracts(stamp);
  const preferences = buildPreferences(stamp);
  const alertContracts = buildAlertContracts(stamp);
  const workspaceState = buildWorkspaceState(stamp);
  const personalization = buildPersonalization(stamp);
  const foundation = {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'account-foundation',
    contracts_version: '1.0.0',
    auth: { enabled: false, providers: [], note_en: 'Authentication is intentionally NOT enabled. Foundation phase only.', note_ar: 'لم تُفعّل المصادقة عمداً. مرحلة التأسيس فقط.' },
    user_database: { enabled: false, note_en: 'No user database; no per-user state is stored or fabricated.', note_ar: 'لا توجد قاعدة بيانات للمستخدمين؛ ولا يُخزَّن أو يُصطنع أي حالة لكل مستخدم.' },
    billing: { enabled: false, note_en: 'No payments, no subscriptions, no premium gating.', note_ar: 'لا توجد مدفوعات، ولا اشتراكات، ولا حواجز للوصول المميز.' },
    contracts: {
      watchlists: { artifact: 'data/intelligence/watchlist-contracts.json', summary: { saved: watchlistContracts.saved_watchlists.count, personal: watchlistContracts.personal_watchlists.count } },
      preferences: { artifact: 'data/intelligence/preferences.json', summary: { defaults: Object.keys(preferences.defaults).length, overrides: preferences.overrides.count } },
      alerts: { artifact: 'data/intelligence/alert-contracts.json', summary: { classes: alertContracts.allowed_classes.length, dispatch_enabled: alertContracts.dispatch.enabled } },
      workspace: { artifact: 'data/intelligence/workspace-state.json', summary: { saved_workspaces: workspaceState.saved_workspaces.count, monitored: workspaceState.monitored_entities.count } },
      personalization: { artifact: 'data/intelligence/personalization.json', summary: { capabilities_enabled: Object.values(personalization.capabilities).filter((c) => c.enabled).length } },
    },
    pages: {
      en: ['/account/', '/account/watchlists/', '/account/preferences/', '/account/alerts/', '/account/workspace/'],
      ar: ['/ar/account/', '/ar/account/watchlists/', '/ar/account/preferences/', '/ar/account/alerts/', '/ar/account/workspace/'],
    },
    governance: {
      no_signals: true,
      no_forecasts: true,
      no_price_targets: true,
      no_user_state_fabrication: true,
      contracts_only: true,
    },
    attribution: {
      sources: ['data/intelligence/watchlists.json', 'data/intelligence/workspace.json', 'data/intelligence/watchlist-monitoring.json', 'data/intelligence/change-events.json', 'data/intelligence/research-hub.json'],
      note: 'Account foundation is the canonical account-ready structure. Authentication, billing and the recommendation/copilot engines are explicitly disabled. Future phases plug into these contracts.',
    },
  };
  return { foundation, watchlistContracts, preferences, alertContracts, workspaceState, personalization };
}

if (require.main === module) {
  const out = build();
  console.log(`[account-foundation] auth=${out.foundation.auth.enabled} saved_watchlists=${out.foundation.contracts.watchlists.summary.saved} alert_classes=${out.foundation.contracts.alerts.summary.classes} monitored=${out.foundation.contracts.workspace.summary.monitored}`);
  console.log(`  preferences defaults=${out.foundation.contracts.preferences.summary.defaults} personalization capabilities_enabled=${out.foundation.contracts.personalization.summary.capabilities_enabled}`);
  if (WRITE) {
    fs.writeFileSync(J('account-foundation.json'), `${JSON.stringify(out.foundation, null, 2)}\n`, 'utf8');
    fs.writeFileSync(J('watchlist-contracts.json'), `${JSON.stringify(out.watchlistContracts, null, 2)}\n`, 'utf8');
    fs.writeFileSync(J('preferences.json'), `${JSON.stringify(out.preferences, null, 2)}\n`, 'utf8');
    fs.writeFileSync(J('alert-contracts.json'), `${JSON.stringify(out.alertContracts, null, 2)}\n`, 'utf8');
    fs.writeFileSync(J('workspace-state.json'), `${JSON.stringify(out.workspaceState, null, 2)}\n`, 'utf8');
    fs.writeFileSync(J('personalization.json'), `${JSON.stringify(out.personalization, null, 2)}\n`, 'utf8');
    console.log('[account-foundation] wrote 6 contract artifacts');
  }
}

module.exports = { build, ALLOWED_ENTITY_TYPES, ALLOWED_ALERT_CLASSES, ALLOWED_PREFERENCES };
