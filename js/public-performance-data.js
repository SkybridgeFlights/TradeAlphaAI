/*
 * public-performance-data.js — SYSTEM B (website) public-performance consumer.
 *
 * Phase 1B/1D, System-B half. CONSUMES the public transport objects that
 * SYSTEM A (the trading VPS) publishes to a public object store. It never
 * talks to the VPS, never fetches admin data, never renders dollar balances /
 * live positions / order IDs, and never invents values.
 *
 * Transport objects (public, read-only, allowlisted):
 *   public_manifest.json  (loaded first — the commit marker)
 *   public_system_summary.json
 *   public_performance_summary.json
 *   public_weekly_research.json
 *
 * NEVER fetched or referenced: any admin_* file (e.g. research-health or
 * phase-3 readiness) or any raw research file. The forbidden-name guard below
 * rejects them structurally; they are intentionally not named literally here.
 *
 * Phase 1D integrity: each snapshot is fetched as RAW BYTES, its byte size and
 * SHA-256 (Web Crypto in the browser, node:crypto in Node) are verified against
 * the manifest, and JSON is parsed ONLY after integrity passes. A file that
 * fails size/hash is rejected and its figures are never rendered — with NO
 * fallback to synthetic fixtures.
 *
 * UMD-ish: the PURE core (validation/normalization/staleness/allowlisting) is
 * exported for Node tests; the browser adapter (fetch, integrity, DOM render,
 * init) attaches to window only in a browser.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // Node (tests)
  }
  if (typeof window !== 'undefined') {
    window.TradeAlphaPublicPerformance = api; // Browser
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Contract constants ──────────────────────────────────────────────────
  const TRANSPORT_VERSION = '1.0.0';
  const SCHEMA_VERSION = '1.0.0';
  const EXPECTED_SOURCE = 'tradealpha.snapshot_exporter';
  const MANIFEST_FILE = 'public_manifest.json';
  const ALLOWED_FILES = Object.freeze([
    'public_system_summary.json',
    'public_performance_summary.json',
    'public_weekly_research.json',
  ]);
  const FORBIDDEN_NAME = /admin|research_health|phase3|raw|secret|token|credential/i;
  const SHA256_HEX = /^[a-f0-9]{64}$/i;
  const DEFAULT_TIMEOUT_MS = 8000;
  // Maximum age a session-cached last-known-good snapshot may be shown for.
  const MAX_CACHE_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours
  const SAMPLE_THRESHOLDS = Object.freeze({ insufficient: 30, preliminary: 100, developing: 200 });

  // ── Small safe helpers ──────────────────────────────────────────────────
  function safeNum(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function safeInt(v) { const n = safeNum(v); return n === null ? null : Math.trunc(n); }
  function safeStr(v) { if (v === null || v === undefined) return null; return String(v); }
  function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  function isValidUtcTimestamp(s, nowMs) {
    if (typeof s !== 'string' || !s.length) return false;
    if (!/[zZ]$|[+-]00:?00$/.test(s)) return false;
    const t = Date.parse(s);
    if (Number.isNaN(t)) return false;
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    if (t > now + 5 * 60 * 1000) return false;
    return true;
  }

  function sampleStatusFor(closedTrades) {
    const n = safeInt(closedTrades);
    if (n === null) return 'insufficient';
    if (n < SAMPLE_THRESHOLDS.insufficient) return 'insufficient';
    if (n < SAMPLE_THRESHOLDS.preliminary) return 'preliminary';
    if (n < SAMPLE_THRESHOLDS.developing) return 'developing';
    return 'mature';
  }

  // ── Filename / URL safety ───────────────────────────────────────────────
  function isSafePublicFilename(name) {
    if (typeof name !== 'string' || !name.length) return false;
    if (FORBIDDEN_NAME.test(name)) return false;
    if (name.indexOf('..') !== -1) return false;
    if (/[\\/]/.test(name)) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(name)) return false;
    return ALLOWED_FILES.indexOf(name) !== -1 || name === MANIFEST_FILE;
  }

  // A configured base URL must be https (or http on localhost for dev preview),
  // free of dangerous protocols, traversal, and injection characters. This is
  // the ONLY origin the consumer will ever contact; page input can never
  // override it (init reads a trusted global, never location/query params).
  function isSafeBaseUrl(url) {
    if (typeof url !== 'string' || !url.length) return false;
    if (/[<>"'`\s\\]/.test(url)) return false;
    if (url.indexOf('..') !== -1) return false;
    if (/^(javascript|data|file|vbscript|blob):/i.test(url)) return false;
    if (/^https:\/\/[^/]+/i.test(url)) return true;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url)) return true;
    return false;
  }

  function buildSnapshotUrl(baseUrl, filename) {
    if (!isSafePublicFilename(filename)) throw new Error('refused unsafe transport filename');
    if (!isSafeBaseUrl(baseUrl)) throw new Error('PUBLIC_SNAPSHOT_BASE_URL is missing or unsafe');
    return baseUrl.replace(/\/+$/, '') + '/' + filename;
  }

  // Immutable versioned path (Phase 1F). The ONLY accepted shape is exactly
  // `snapshots/<release_id>/<name>` where <name> is the allowlisted logical
  // filename and release_id is [A-Za-z0-9_-]+. Everything else is refused:
  // admin names, traversal (literal or percent-encoded), separators/backslash,
  // schemes, query/fragment, leading/duplicate slash, extra directories,
  // arbitrary extensions, or a final filename that differs from entry.name.
  function isSafeSnapshotPath(path, name) {
    if (typeof path !== 'string' || !path.length) return false;
    if (ALLOWED_FILES.indexOf(name) === -1) return false;          // name must be allowlisted
    if (FORBIDDEN_NAME.test(path)) return false;                   // admin/secret/etc.
    if (/[\\]/.test(path)) return false;                           // backslash
    if (path.indexOf('..') !== -1) return false;                   // literal traversal
    if (/%2e|%2f|%5c/i.test(path)) return false;                   // encoded . / \
    if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false;           // scheme (http:, data:, …)
    if (path.indexOf('?') !== -1 || path.indexOf('#') !== -1) return false; // query/fragment
    if (path.charAt(0) === '/') return false;                      // leading slash
    if (path.indexOf('//') !== -1) return false;                   // duplicate slash
    const parts = path.split('/');
    if (parts.length !== 3) return false;                          // exactly snapshots/<id>/<name>
    if (parts[0] !== 'snapshots') return false;
    if (!/^[A-Za-z0-9_-]+$/.test(parts[1])) return false;          // release_id (no dots/spaces)
    if (parts[2] !== name) return false;                           // final filename === entry.name
    return true;
  }

  // Resolve the fetch URL for a manifest entry: validated immutable path when
  // present, otherwise the legacy fixed name. URL is built ONLY from the
  // configured base + validated manifest data; page/query input can never
  // influence it.
  function buildSnapshotUrlFromEntry(baseUrl, entry) {
    if (!isSafeBaseUrl(baseUrl)) throw new Error('PUBLIC_SNAPSHOT_BASE_URL is missing or unsafe');
    const name = entry && entry.name;
    if (entry && entry.path != null && entry.path !== '') {
      if (!isSafeSnapshotPath(entry.path, name)) throw new Error('refused unsafe snapshot path');
      return baseUrl.replace(/\/+$/, '') + '/' + entry.path;
    }
    return buildSnapshotUrl(baseUrl, name);
  }

  // ── Cross-environment SHA-256 (hex) ─────────────────────────────────────
  function toUint8(bytes) {
    if (bytes instanceof Uint8Array) return bytes;
    if (typeof ArrayBuffer !== 'undefined' && bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(bytes)) return new Uint8Array(bytes);
    if (bytes && bytes.buffer) return new Uint8Array(bytes.buffer);
    return new Uint8Array(0);
  }
  function bytesToUtf8(bytes) {
    const u8 = toUint8(bytes);
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(u8);
    if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('utf8');
    return '';
  }
  function hex(u8) { let s = ''; for (let i = 0; i < u8.length; i++) s += u8[i].toString(16).padStart(2, '0'); return s; }
  function sha256Hex(bytes) {
    const u8 = toUint8(bytes);
    const g = (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null));
    if (g && g.crypto && g.crypto.subtle) {
      return g.crypto.subtle.digest('SHA-256', u8).then(function (d) { return hex(new Uint8Array(d)); });
    }
    if (typeof require === 'function') {
      const c = require('crypto');
      return Promise.resolve(c.createHash('sha256').update(Buffer.from(u8)).digest('hex'));
    }
    return Promise.reject(new Error('no sha-256 implementation available'));
  }

  // ── Validators ──────────────────────────────────────────────────────────
  function validateManifest(obj, nowMs) {
    const errors = [];
    if (!isPlainObject(obj)) return { ok: false, errors: ['manifest is not an object'], files: [], entries: {} };
    if (obj.transport_version !== TRANSPORT_VERSION) errors.push('bad transport_version');
    if (!isValidUtcTimestamp(obj.generated_at, nowMs)) errors.push('bad generated_at');
    if (!Array.isArray(obj.files)) return { ok: false, errors: errors.concat('files not an array'), files: [], entries: {} };

    const seen = new Set();
    const entries = {};
    for (const f of obj.files) {
      if (!isPlainObject(f)) { errors.push('file entry not an object'); continue; }
      if (!isSafePublicFilename(f.name) || f.name === MANIFEST_FILE || ALLOWED_FILES.indexOf(f.name) === -1) {
        errors.push('manifest references non-allowlisted file: ' + safeStr(f.name));
        continue;
      }
      if (seen.has(f.name)) errors.push('duplicate manifest entry: ' + f.name);
      seen.add(f.name);
      if (!SHA256_HEX.test(String(f.sha256 || ''))) errors.push('bad sha256 for ' + f.name);
      if (!Number.isInteger(f.size_bytes) || f.size_bytes < 0) errors.push('bad size_bytes for ' + f.name);
      if (f.schema_version !== SCHEMA_VERSION) errors.push('bad schema_version for ' + f.name);
      // Immutable path is optional and additive; when present it must be a
      // strictly-valid snapshots/<release_id>/<name> path.
      if (f.path != null && f.path !== '' && !isSafeSnapshotPath(f.path, f.name)) errors.push('bad path for ' + f.name);
      entries[f.name] = { name: f.name, path: (f.path != null && f.path !== '') ? String(f.path) : null, sha256: String(f.sha256 || '').toLowerCase(), size_bytes: f.size_bytes, schema_version: f.schema_version };
    }
    return { ok: errors.length === 0, errors: errors, files: Array.from(seen), entries: entries };
  }

  function validateEnvelope(obj, nowMs) {
    const errors = [];
    if (!isPlainObject(obj)) return { ok: false, errors: ['envelope not an object'] };
    if (obj.schema_version !== SCHEMA_VERSION) errors.push('bad schema_version');
    if (obj.privacy !== 'public') errors.push('privacy is not "public"');
    if (!isValidUtcTimestamp(obj.generated_at, nowMs)) errors.push('bad generated_at');
    if (!Number.isInteger(obj.freshness_seconds) || obj.freshness_seconds < 0) errors.push('bad freshness_seconds');
    if (typeof obj.source !== 'string' || !obj.source.length) errors.push('missing source');
    if (!isPlainObject(obj.payload)) errors.push('missing payload');
    return { ok: errors.length === 0, errors: errors };
  }

  function isStale(envelope, nowMs) {
    if (!isPlainObject(envelope)) return true;
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    const gen = Date.parse(envelope.generated_at);
    if (Number.isNaN(gen)) return true;
    const fresh = Number.isInteger(envelope.freshness_seconds) ? envelope.freshness_seconds : 0;
    if (gen + fresh * 1000 < now) return true;
    const p = envelope.payload;
    if (isPlainObject(p) && (p.stale === true || p.status === 'stale')) return true;
    return false;
  }

  // ── Normalizers (field-by-field allowlist; null preserved) ──────────────
  function normalizeSystemSummary(payload) {
    if (!isPlainObject(payload)) return null;
    const strategies = Array.isArray(payload.strategies) ? payload.strategies.map(function (s) {
      s = isPlainObject(s) ? s : {};
      return {
        public_name: safeStr(s.public_name), asset_class: safeStr(s.asset_class),
        status: safeStr(s.status), data_delay_hours: safeNum(s.data_delay_hours),
        sample_status: safeStr(s.sample_status),
      };
    }) : [];
    return {
      as_of: safeStr(payload.as_of), status: safeStr(payload.status), strategies: strategies,
      last_public_snapshot_at: safeStr(payload.last_public_snapshot_at), stale: payload.stale === true,
    };
  }

  // Optional, additive historical record. Returns null when absent (so the
  // section never renders). Kept STRICTLY separate from schema-1.0 metrics —
  // never merged, never treated as verified. null preserved.
  function normalizeHistorical(hr) {
    if (!isPlainObject(hr)) return null;
    const dq = isPlainObject(hr.data_quality) ? hr.data_quality : {};
    return {
      available: hr.available !== false, // object present but not explicitly false => available
      coverage: safeStr(hr.coverage),
      verified_from: safeStr(hr.verified_from),
      independently_audited: hr.independently_audited === true,
      as_of: safeStr(hr.as_of),
      closed_trades: safeInt(hr.closed_trades),
      wins: safeInt(hr.wins),
      losses: safeInt(hr.losses),
      win_rate_pct: safeNum(hr.win_rate_pct),
      profit_factor: safeNum(hr.profit_factor),
      expectancy_r: safeNum(hr.expectancy_r),
      pnl_usd: safeNum(hr.pnl_usd),
      average_holding_minutes: safeNum(hr.average_holding_minutes),
      data_quality: {
        schema_1_closed_trades: safeInt(dq.schema_1_closed_trades),
        legacy_closed_trades: safeInt(dq.legacy_closed_trades),
        join_success_pct: safeNum(dq.join_success_pct),
        critical_issues: safeInt(dq.critical_issues),
      },
      methodology_note: safeStr(hr.methodology_note),
    };
  }

  function normalizePerformance(payload) {
    if (!isPlainObject(payload)) return null;
    const systems = Array.isArray(payload.systems) ? payload.systems.map(function (s) {
      s = isPlainObject(s) ? s : {};
      const closed = safeInt(s.closed_trades);
      return {
        public_name: safeStr(s.public_name), verified_from: safeStr(s.verified_from), as_of: safeStr(s.as_of),
        data_delay_hours: safeNum(s.data_delay_hours),
        sample_status: safeStr(s.sample_status) || sampleStatusFor(closed),
        insufficient_sample: s.insufficient_sample === true || (closed !== null && closed < SAMPLE_THRESHOLDS.insufficient),
        closed_trades: closed, wins: safeInt(s.wins), losses: safeInt(s.losses),
        win_rate_pct: safeNum(s.win_rate_pct), profit_factor: safeNum(s.profit_factor),
        expectancy_r: safeNum(s.expectancy_r), cumulative_return_pct: safeNum(s.cumulative_return_pct),
        max_drawdown_pct: safeNum(s.max_drawdown_pct), average_holding_minutes: safeNum(s.average_holding_minutes),
        schema_1_signal_rows: safeInt(s.schema_1_signal_rows), schema_1_trading_days: safeInt(s.schema_1_trading_days),
        methodology_note: safeStr(s.methodology_note),
        historical_record: normalizeHistorical(s.historical_record),
      };
    }) : [];
    return { as_of: safeStr(payload.as_of), systems: systems };
  }

  function normalizeWeekly(payload) {
    if (!isPlainObject(payload)) return null;
    const dc = isPlainObject(payload.data_collected) ? payload.data_collected : {};
    return {
      week_start: safeStr(payload.week_start), week_end: safeStr(payload.week_end), generated_at: safeStr(payload.generated_at),
      title_en: safeStr(payload.title_en), title_ar: safeStr(payload.title_ar),
      summary_en: safeStr(payload.summary_en), summary_ar: safeStr(payload.summary_ar),
      curation_note: safeStr(payload.curation_note),
      data_collected: {
        xau_signals: safeInt(dc.xau_signals), xau_closed_trades: safeInt(dc.xau_closed_trades),
        qqq_signals: safeInt(dc.qqq_signals), qqq_closed_trades: safeInt(dc.qqq_closed_trades),
      },
      public_observations: Array.isArray(payload.public_observations) ? payload.public_observations.map(safeStr).filter(Boolean) : [],
      sample_warning: safeStr(payload.sample_warning),
    };
  }

  const NORMALIZERS = {
    'public_system_summary.json': normalizeSystemSummary,
    'public_performance_summary.json': normalizePerformance,
    'public_weekly_research.json': normalizeWeekly,
  };

  function ingestSnapshot(filename, obj, nowMs) {
    if (ALLOWED_FILES.indexOf(filename) === -1) return { ok: false, errors: ['not an allowlisted snapshot'], stale: true, view: null };
    const env = validateEnvelope(obj, nowMs);
    if (!env.ok) return { ok: false, errors: env.errors, stale: true, view: null };
    const stale = isStale(obj, nowMs);
    const view = NORMALIZERS[filename](obj.payload);
    return { ok: view !== null, errors: view === null ? ['payload did not normalize'] : [], stale: stale, view: view, generated_at: obj.generated_at };
  }

  // ── Browser-only bits ────────────────────────────────────────────────────
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  const LABELS = {
    en: {
      unavailable: 'Not available',
      dataUnavailable: 'Performance data temporarily unavailable',
      integrityError: 'A data file failed integrity verification and was not shown.',
      staleBanner: 'Delayed / stale data — last valid update shown below.',
      delayNote: 'Data is delayed and provided for education only.',
      asOf: 'As of', verifiedFrom: 'Verified from', delay: 'Data delay (hours)',
      closedTrades: 'Closed trades', wins: 'Wins', losses: 'Losses', winRate: 'Win rate',
      profitFactor: 'Profit factor', expectancy: 'Expectancy (R)', avgHold: 'Avg holding (min)',
      signalRows: 'Schema 1.0 signal rows', tradingDays: 'Schema 1.0 trading days',
      cumReturn: 'Cumulative return', maxDd: 'Max drawdown', status: 'Status',
      systemStatus: 'System status', lastSnapshot: 'Last public snapshot', generated: 'Snapshot generated',
      schemaVerified: 'Schema 1.0 verified data', delayedSnapshot: 'Delayed public snapshot',
      verifiedSource: 'Verified from TradeAlpha schema 1.0 research logs',
      notAudited: 'Internally generated research record — not independently audited.',
      weeklyHeading: 'Weekly research', weeklyUnavailable: 'Public weekly summary not yet available.',
      week: 'Week', observations: 'Observations',
      verifiedHeading: 'Verified Schema 1.0 Research Record',
      histHeading: 'Historical Research Record', histBadge: 'Historical / Legacy coverage',
      histUnavailable: 'Historical research record not available.',
      histWarning: 'Includes legacy pre-schema data. Legacy rows do not contain the complete Schema 1.0 field set. This record is internally generated and not independently audited.',
      histLimited: 'Limited historical sample — results remain observational and may change materially.',
      pnlUsd: 'PnL (USD)', schema1Count: 'Schema 1.0 closed trades', legacyCount: 'Legacy closed trades',
      joinSuccess: 'Join success', criticalIssues: 'Critical data issues', auditState: 'Independently audited',
      auditNo: 'No — internally generated',
      statusLive: 'Live', statusActive: 'Active',
      totalClosedTrades: 'Total Closed Trades', netProfit: 'Net Profit', avgHoldTime: 'Average Holding Time', minSuffix: 'min',
      histTrades: 'Historical Trades', schema1Trades: 'Schema 1.0 Trades', lastUpdated: 'Last Updated',
      verifiedChip: 'Research Statistics', historicalChip: 'Historical Statistics', trackRecordNote: 'Performance history',
      aboutData: 'About this data',
      trustLive: 'Update status', trustPublic: 'Public statistics', trustHistory: 'Performance history', trustMethod: 'Methodology details',
      footNote: 'Educational research · not investment advice · delayed public snapshot.',
      infoDelay: 'Figures are a delayed public snapshot of internally generated research logs.',
      infoAudit: 'Internally generated and not independently audited.',
      infoHistory: 'Historical figures combine legacy and Schema 1.0 records; legacy rows do not carry the full Schema 1.0 field set.',
      infoSample: 'Sample sizes remain limited, so figures are observational and not a guarantee of future results.',
      disclaimer: 'Educational research only — not investment advice. Past performance does not guarantee future results.',
      sample: {
        insufficient: 'Insufficient sample — these statistics are observational and are not evidence of stable future performance.',
        preliminary: 'Preliminary sample — results may change materially as more trades close.',
        developing: 'Developing sample — sample maturity has improved but this is not a guarantee of future performance.',
        mature: 'Sample size has reached the configured maturity threshold. This indicates sample size only, not future-performance certainty.',
      },
    },
    ar: {
      unavailable: 'غير متاح',
      dataUnavailable: 'بيانات الأداء غير متوفرة مؤقتاً',
      integrityError: 'فشل التحقق من سلامة أحد ملفات البيانات ولم يُعرض.',
      staleBanner: 'بيانات متأخرة/قديمة — يظهر أدناه آخر تحديث صالح.',
      delayNote: 'البيانات متأخرة وتُعرض لأغراض تعليمية فقط.',
      asOf: 'حتى تاريخ', verifiedFrom: 'موثّقة منذ', delay: 'تأخير البيانات (ساعات)',
      closedTrades: 'الصفقات المغلقة', wins: 'الصفقات الرابحة', losses: 'الصفقات الخاسرة', winRate: 'نسبة النجاح',
      profitFactor: 'معامل الربحية', expectancy: 'التوقع (R)', avgHold: 'متوسط مدة الصفقة (دقيقة)',
      signalRows: 'صفوف إشارات المخطط 1.0', tradingDays: 'أيام التداول للمخطط 1.0',
      cumReturn: 'العائد التراكمي', maxDd: 'أقصى تراجع', status: 'الحالة',
      systemStatus: 'حالة النظام', lastSnapshot: 'آخر لقطة عامة', generated: 'وقت إنشاء اللقطة',
      schemaVerified: 'بيانات موثّقة وفق المخطط 1.0', delayedSnapshot: 'لقطة عامة مؤجَّلة',
      verifiedSource: 'موثّقة من سجلات أبحاث TradeAlpha وفق المخطط 1.0',
      notAudited: 'سجل بحثي مُولّد داخلياً — غير مُدقّق من جهة خارجية مستقلة.',
      weeklyHeading: 'البحث الأسبوعي', weeklyUnavailable: 'الملخّص الأسبوعي العام غير متوفر بعد.',
      week: 'الأسبوع', observations: 'ملاحظات',
      verifiedHeading: 'سجل بحثي موثّق وفق المخطط 1.0',
      histHeading: 'السجل البحثي التاريخي', histBadge: 'تغطية تاريخية/قديمة',
      histUnavailable: 'السجل البحثي التاريخي غير متاح.',
      histWarning: 'يتضمن بيانات تاريخية سابقة للمخطط 1.0. السجلات القديمة لا تحتوي على كامل حقول المخطط 1.0. هذا السجل مُنشأ داخليًا ولم يخضع لتدقيق مستقل.',
      histLimited: 'العينة التاريخية محدودة — النتائج وصفية وقد تتغير بصورة جوهرية.',
      pnlUsd: 'الربح/الخسارة (دولار)', schema1Count: 'صفقات المخطط 1.0 المغلقة', legacyCount: 'الصفقات القديمة المغلقة',
      joinSuccess: 'نجاح الربط', criticalIssues: 'مشكلات بيانات حرجة', auditState: 'مُدقّق من جهة مستقلة',
      auditNo: 'لا — مُنشأ داخليًا',
      statusLive: 'مباشر', statusActive: 'نشط',
      totalClosedTrades: 'إجمالي الصفقات المغلقة', netProfit: 'صافي الربح', avgHoldTime: 'متوسط مدة الصفقة', minSuffix: 'دقيقة',
      histTrades: 'الصفقات التاريخية', schema1Trades: 'صفقات المخطط 1.0', lastUpdated: 'آخر تحديث',
      verifiedChip: 'إحصاءات بحثية', historicalChip: 'إحصاءات تاريخية', trackRecordNote: 'سجل الأداء',
      aboutData: 'عن هذه البيانات',
      trustLive: 'حالة التحديث', trustPublic: 'إحصاءات عامة', trustHistory: 'سجل الأداء', trustMethod: 'تفاصيل المنهجية',
      footNote: 'بحث تعليمي · ليس نصيحة استثمارية · لقطة عامة مؤجَّلة.',
      infoDelay: 'الأرقام لقطة عامة مؤجَّلة من سجلات بحثية مُنشأة داخليًا.',
      infoAudit: 'مُنشأة داخليًا وغير مُدقّقة من جهة خارجية مستقلة.',
      infoHistory: 'تجمع الأرقام التاريخية بين السجلات القديمة وسجلات المخطط 1.0؛ ولا تحتوي السجلات القديمة على كامل حقول المخطط 1.0.',
      infoSample: 'أحجام العينات ما زالت محدودة، لذا فالأرقام وصفية وليست ضماناً لنتائج مستقبلية.',
      disclaimer: 'محتوى بحثي تعليمي فقط — وليس نصيحة استثمارية. الأداء السابق لا يضمن النتائج المستقبلية.',
      sample: {
        insufficient: 'حجم العينة غير كافٍ — هذه الإحصاءات وصفية فقط ولا تُعد دليلاً على ثبات الأداء مستقبلًا.',
        preliminary: 'عيّنة أولية — قد تتغيّر النتائج جوهرياً مع إغلاق مزيد من الصفقات.',
        developing: 'عيّنة قيد التطور — تحسّن نضج العيّنة لكنه ليس ضماناً للأداء المستقبلي.',
        mature: 'بلغت العيّنة حدّ النضج المُهيّأ. هذا يدل على حجم العيّنة فقط وليس على يقين بالأداء المستقبلي.',
      },
    },
  };

  function fetchJson(url, timeoutMs) {
    const ctrl = new AbortController();
    const to = setTimeout(function () { ctrl.abort(); }, timeoutMs || DEFAULT_TIMEOUT_MS);
    return fetch(url, { signal: ctrl.signal, cache: 'no-store', credentials: 'omit', redirect: 'error' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .finally(function () { clearTimeout(to); });
  }
  function fetchBytes(url, timeoutMs) {
    const ctrl = new AbortController();
    const to = setTimeout(function () { ctrl.abort(); }, timeoutMs || DEFAULT_TIMEOUT_MS);
    return fetch(url, { signal: ctrl.signal, cache: 'no-store', credentials: 'omit', redirect: 'error' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(function (buf) { return new Uint8Array(buf); })
      .finally(function () { clearTimeout(to); });
  }

  // Fetch raw bytes, verify byte size + SHA-256 against the manifest entry,
  // then parse JSON. Throws on any integrity failure (never returns figures
  // from an unverified file).
  function fetchVerified(url, expected, opts) {
    const getBytes = opts.getBytes || fetchBytes;
    const hasher = opts.sha256Hex || sha256Hex;
    return Promise.resolve(getBytes(url, opts.timeoutMs)).then(function (bytes) {
      const u8 = toUint8(bytes);
      if (expected && Number.isInteger(expected.size_bytes) && u8.length !== expected.size_bytes) {
        throw new Error('size mismatch');
      }
      return Promise.resolve(hasher(u8)).then(function (h) {
        if (expected && expected.sha256 && String(h).toLowerCase() !== String(expected.sha256).toLowerCase()) {
          throw new Error('hash mismatch');
        }
        return JSON.parse(bytesToUtf8(u8));
      });
    });
  }

  const SESSION_KEY = 'ta_public_perf_last_good_v1';
  function cacheLastGood(result) {
    try {
      if (!isBrowser || !window.sessionStorage) return;
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        cached_at: new Date().toISOString(),
        system: result.system, performance: result.performance, weekly: result.weekly,
      }));
    } catch (e) { /* non-fatal */ }
  }
  function readLastGood(nowMs) {
    try {
      if (!isBrowser || !window.sessionStorage) return null;
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const cachedAt = Date.parse(parsed.cached_at);
      const now = typeof nowMs === 'number' ? nowMs : Date.now();
      // Enforce a maximum safe cached age — never show old metrics indefinitely.
      if (Number.isNaN(cachedAt) || now - cachedAt > MAX_CACHE_AGE_MS) return null;
      return parsed;
    } catch (e) { return null; }
  }

  // Load manifest first, then integrity-verify + ingest the three snapshots.
  function load(baseUrl, opts) {
    opts = opts || {};
    const nowMs = typeof opts.nowMs === 'number' ? opts.nowMs : Date.now();
    const timeout = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
    const getJson = opts.fetchJson || fetchJson;             // manifest (the marker)
    const verifyOpts = { getBytes: opts.getBytes, sha256Hex: opts.sha256Hex, timeoutMs: timeout };
    const result = { ok: false, base: baseUrl, transport_available: false, stale: false, partial: false,
      integrity_error: false, generated_at: null, errors: [], system: null, performance: null, weekly: null };

    if (!isSafeBaseUrl(baseUrl)) { result.errors.push('invalid base url'); return Promise.resolve(result); }

    return Promise.resolve()
      .then(function () { return getJson(buildSnapshotUrl(baseUrl, MANIFEST_FILE), timeout); })
      .then(function (manifest) {
        result.transport_available = true;
        const mv = validateManifest(manifest, nowMs);
        if (!mv.ok) { result.errors.push.apply(result.errors, mv.errors); return result; }
        const wanted = mv.files.filter(function (n) { return ALLOWED_FILES.indexOf(n) !== -1; });
        return Promise.all(wanted.map(function (name) {
          // Use the validated immutable path when present, else the legacy name.
          return fetchVerified(buildSnapshotUrlFromEntry(baseUrl, mv.entries[name]), mv.entries[name], verifyOpts)
            .then(function (obj) { return { name: name, obj: obj }; })
            .catch(function (e) {
              const msg = String(e && e.message || e);
              if (msg.indexOf('mismatch') !== -1) { result.integrity_error = true; result.errors.push('integrity failed: ' + name); }
              else { result.errors.push('fetch failed: ' + name); }
              result.partial = true; return null;
            });
        })).then(function (fetched) {
          fetched.forEach(function (item) {
            if (!item) return;
            const ing = ingestSnapshot(item.name, item.obj, nowMs);
            if (!ing.ok) { result.errors.push.apply(result.errors, ing.errors.map(function (e) { return item.name + ': ' + e; })); result.partial = true; return; }
            if (ing.stale) result.stale = true;
            if (item.name === 'public_system_summary.json') result.system = ing.view;
            else if (item.name === 'public_performance_summary.json') { result.performance = ing.view; result.generated_at = ing.generated_at; }
            else if (item.name === 'public_weekly_research.json') result.weekly = ing.view;
          });
          result.ok = !!(result.system || result.performance || result.weekly) && result.errors.length === 0;
          if (result.ok) cacheLastGood(result);
          return result;
        });
      })
      .catch(function (e) {
        result.errors.push('transport unavailable');
        const lastGood = readLastGood(nowMs);
        if (lastGood) { result.system = lastGood.system; result.performance = lastGood.performance; result.weekly = lastGood.weekly; result.stale = true; result.from_cache = true; }
        return result;
      });
  }

  // ── Render (browser) ─────────────────────────────────────────────────────
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtPct(v) { return v === null ? null : (Number(v).toFixed(2) + '%'); }
  function fmtNum(v, d) { return v === null ? null : (d != null ? Number(v).toFixed(d) : String(v)); }

  function metricRow(label, value, unavailableText) {
    const shown = (value === null || value === undefined) ? unavailableText : value;
    const cls = (value === null || value === undefined) ? ' data-unavailable' : '';
    return '<div class="pp-metric' + cls + '"><span class="pp-metric-label">' + esc(label) +
      '</span><span class="pp-metric-value">' + esc(shown) + '</span></div>';
  }

  // Historical Research Record — a SEPARATE subsection, only when present.
  // Neutral badge (never green/"verified"), its own legacy warning, and its
  // own metrics. Never merged with the schema-1.0 figures above it. pnl_usd is
  // the one place a USD figure is allowed (and only when non-null).
  function renderHistoricalCard(hist, L) {
    if (!hist) return ''; // absent => no section at all
    const badge = '<span class="pp-badge pp-badge-historical">' + esc(L.histBadge) + '</span>';
    if (hist.available === false) {
      return '<section class="pp-historical"><div class="pp-hist-head"><h4>' + esc(L.histHeading) + '</h4>' + badge + '</div>' +
        '<p class="pp-unavailable" role="status">' + esc(L.histUnavailable) + '</p></section>';
    }
    const limited = (hist.closed_trades !== null && hist.closed_trades < SAMPLE_THRESHOLDS.insufficient)
      ? '<p class="pp-hist-limited" role="note">' + esc(L.histLimited) + '</p>' : '';
    const dq = hist.data_quality || {};
    return '<section class="pp-historical">' +
      '<div class="pp-hist-head"><h4>' + esc(L.histHeading) + '</h4>' + badge + '</div>' +
      '<p class="pp-hist-warning" role="note">' + esc(L.histWarning) + '</p>' + limited +
      '<div class="pp-metrics">' +
        metricRow(L.closedTrades, hist.closed_trades === null ? null : String(hist.closed_trades), L.unavailable) +
        metricRow(L.winRate, fmtPct(hist.win_rate_pct), L.unavailable) +
        metricRow(L.profitFactor, fmtNum(hist.profit_factor, 2), L.unavailable) +
        metricRow(L.wins, hist.wins === null ? null : String(hist.wins), L.unavailable) +
        metricRow(L.losses, hist.losses === null ? null : String(hist.losses), L.unavailable) +
        metricRow(L.expectancy, fmtNum(hist.expectancy_r, 2), L.unavailable) +
        // USD PnL shown only when non-null; null => "Not available" (never 0).
        metricRow(L.pnlUsd, hist.pnl_usd === null ? null : ('$' + Number(hist.pnl_usd).toFixed(2)), L.unavailable) +
        metricRow(L.avgHold, hist.average_holding_minutes === null ? null : String(hist.average_holding_minutes), L.unavailable) +
        metricRow(L.schema1Count, dq.schema_1_closed_trades === null ? null : String(dq.schema_1_closed_trades), L.unavailable) +
        metricRow(L.legacyCount, dq.legacy_closed_trades === null ? null : String(dq.legacy_closed_trades), L.unavailable) +
        metricRow(L.joinSuccess, fmtPct(dq.join_success_pct), L.unavailable) +
        metricRow(L.criticalIssues, dq.critical_issues === null ? null : String(dq.critical_issues), L.unavailable) +
        metricRow(L.auditState, L.auditNo, L.unavailable) +
      '</div>' +
      '<footer class="pp-card-foot">' +
        '<span>' + esc(L.asOf) + ': ' + esc(hist.as_of || L.unavailable) + '</span>' +
        '<span>' + esc(L.notAudited) + '</span>' +
        (hist.methodology_note ? '<span class="pp-method">' + esc(hist.methodology_note) + '</span>' : '') +
      '</footer>' +
    '</section>';
  }

  function fmtMoney(v) { if (v === null || v === undefined) return null; const n = Number(v); return (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2); }
  function formatDate(s) { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? String(s).slice(0, 10) : d.toISOString().slice(0, 10); }
  function bigMetric(label, value) {
    const na = (value === null || value === undefined);
    return '<div class="pp-big' + (na ? ' pp-na' : '') + '"><span class="pp-big-value">' + esc(na ? '—' : value) + '</span><span class="pp-big-label">' + esc(label) + '</span></div>';
  }
  function smallMetric(label, value) {
    const na = (value === null || value === undefined);
    return '<div class="pp-small' + (na ? ' pp-na' : '') + '"><span class="pp-small-label">' + esc(label) + '</span><span class="pp-small-value">' + esc(na ? '—' : value) + '</span></div>';
  }
  function trustRow(L) {
    const items = [L.trustLive, L.trustPublic, L.trustHistory, L.trustMethod];
    return '<ul class="pp-trust">' + items.map(function (t) { return '<li><span class="pp-check" aria-hidden="true">✓</span>' + esc(t) + '</li>'; }).join('') + '</ul>';
  }
  // Collapsible ⓘ panel — ALL transparency lives here (delayed, not audited,
  // legacy/schema composition, sample context), hidden by default instead of
  // dominating the page with warning boxes. Nothing is hidden; it is one click
  // away. Backend methodology notes are English-only, shown only in EN mode to
  // keep strict language purity.
  function infoPanel(sys, hist, L, lang) {
    let lines = '<p>' + esc(L.infoDelay) + '</p><p>' + esc(L.infoAudit) + '</p>';
    if (hist) lines += '<p>' + esc(L.infoHistory) + '</p>';
    lines += '<p>' + esc(L.infoSample) + '</p><p class="pp-info-note">' + esc(L.footNote) + '</p>';
    if (lang === 'en') {
      if (sys && sys.methodology_note) lines += '<p class="pp-info-note">' + esc(sys.methodology_note) + '</p>';
      if (hist && hist.methodology_note) lines += '<p class="pp-info-note">' + esc(hist.methodology_note) + '</p>';
    }
    return '<details class="pp-info"><summary><span class="pp-info-icon" aria-hidden="true">ⓘ</span>' + esc(L.aboutData) + '</summary><div class="pp-info-body">' + lines + '</div></details>';
  }
  // One clean, professional card per strategy. Leads with the fuller track
  // record when a historical_record exists (else the verified Schema 1.0
  // figures). Trade counts are always front-and-centre; verified vs historical
  // composition and every caveat live in the ⓘ panel. Records are shown side by
  // side, never merged mathematically, and no value is fabricated.
  function renderSystemCard(sys, L, lang) {
    if (!sys) return '';
    const hist = (sys.historical_record && sys.historical_record.available !== false) ? sys.historical_record : null;
    const primary = hist || sys;
    const isLive = /live|active|running/i.test(String(sys.status || ''));
    const pill = '<span class="pp-pill' + (isLive ? ' pp-pill-live' : '') + '">' + (isLive ? '<i aria-hidden="true"></i>' : '') + esc(isLive ? L.statusLive : (sys.status || L.statusActive)) + '</span>';
    const chip = '<span class="pp-chip">' + esc(hist ? L.historicalChip : L.verifiedChip) + '</span>';

    const hero =
      bigMetric(L.totalClosedTrades, primary.closed_trades === null ? null : String(primary.closed_trades)) +
      bigMetric(L.winRate, fmtPct(primary.win_rate_pct)) +
      bigMetric(L.profitFactor, fmtNum(primary.profit_factor, 2)) +
      (hist ? bigMetric(L.netProfit, fmtMoney(hist.pnl_usd)) : '') +
      bigMetric(L.avgHoldTime, primary.average_holding_minutes === null ? null : (Math.round(Number(primary.average_holding_minutes)) + ' ' + L.minSuffix));

    const detail =
      smallMetric(L.wins, primary.wins === null ? null : String(primary.wins)) +
      smallMetric(L.losses, primary.losses === null ? null : String(primary.losses)) +
      smallMetric(L.expectancy, fmtNum(primary.expectancy_r, 2)) +
      smallMetric(L.schema1Trades, sys.closed_trades === null ? null : String(sys.closed_trades)) +
      (hist ? smallMetric(L.histTrades, hist.closed_trades === null ? null : String(hist.closed_trades)) : '') +
      smallMetric(L.lastUpdated, formatDate((hist && hist.as_of) || sys.as_of));

    return '<article class="pp-strategy">' +
      '<header class="pp-strategy-head"><h3>' + esc(sys.public_name || L.unavailable) + '</h3>' +
        '<div class="pp-strategy-tags">' + chip + pill + '</div></header>' +
      '<div class="pp-hero">' + hero + '</div>' +
      '<div class="pp-detail">' + detail + '</div>' +
      trustRow(L) +
      infoPanel(sys, hist, L, lang) +
      '</article>';
  }

  function renderStatusHeader(result, L) {
    const sys = result.system;
    const stat = sys && sys.status ? sys.status : L.unavailable;
    const last = sys && sys.last_public_snapshot_at ? sys.last_public_snapshot_at : (result.generated_at || L.unavailable);
    return '<div class="pp-status" role="group">' +
      '<span class="pp-status-item"><b>' + esc(L.systemStatus) + ':</b> ' + esc(stat) + '</span>' +
      '<span class="pp-status-item"><b>' + esc(L.lastSnapshot) + ':</b> ' + esc(last) + '</span>' +
      '<span class="pp-status-item pp-source">' + esc(L.verifiedSource) + '</span>' +
      '<span class="pp-status-item pp-source">' + esc(L.delayedSnapshot) + '</span>' +
      '<span class="pp-status-item pp-source">' + esc(L.notAudited) + '</span>' +
      '</div>';
  }

  function renderWeekly(weekly, L, lang) {
    if (!weekly) return '';
    const title = lang === 'ar' ? weekly.title_ar : weekly.title_en;
    const summary = lang === 'ar' ? weekly.summary_ar : weekly.summary_en;
    let inner;
    if (!title && !summary) {
      inner = '<p class="pp-unavailable" role="status">' + esc(L.weeklyUnavailable) + '</p>';
    } else {
      inner = (title ? '<h4>' + esc(title) + '</h4>' : '') +
        ((weekly.week_start || weekly.week_end) ? '<p class="pp-week-range">' + esc(L.week) + ': ' + esc(weekly.week_start || '') + ' → ' + esc(weekly.week_end || '') + '</p>' : '') +
        (summary ? '<p>' + esc(summary) + '</p>' : '') +
        (lang === 'en' && weekly.public_observations && weekly.public_observations.length ? '<ul class="pp-observations">' + weekly.public_observations.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul>' : '') +
        (lang === 'en' && weekly.sample_warning ? '<p class="pp-sample-warning">' + esc(weekly.sample_warning) + '</p>' : '');
    }
    return '<section class="pp-weekly"><h3>' + esc(L.weeklyHeading) + '</h3>' + inner + '</section>';
  }

  function render(container, result, lang) {
    if (!container) return;
    lang = lang === 'ar' ? 'ar' : 'en';
    const L = LABELS[lang];
    if (!result || (!result.performance && !result.system && !result.weekly)) {
      const extra = result && result.integrity_error ? '<div class="pp-notice">' + esc(L.integrityError) + '</div>' : '';
      container.innerHTML = extra + '<div class="pp-notice">' + esc(L.dataUnavailable) + '</div>';
      return;
    }
    let html = '';
    if (result.stale || result.from_cache) html += '<div class="pp-notice pp-notice-soft" role="status">' + esc(L.staleBanner) + '</div>';
    if (result.integrity_error) html += '<div class="pp-notice" role="status">' + esc(L.integrityError) + '</div>';
    if (result.performance && result.performance.systems.length) {
      html += '<div class="pp-grid">' + result.performance.systems.map(function (s) { return renderSystemCard(s, L, lang); }).join('') + '</div>';
    } else {
      html += '<div class="pp-notice" role="status">' + esc(L.dataUnavailable) + '</div>';
    }
    html += renderWeekly(result.weekly, L, lang);
    container.innerHTML = html;
  }

  // Init: activates only with a configured, SAFE public base URL. With none (or
  // an unsafe one) it renders the honest unavailable state — never fixtures,
  // never the old "Live on Myfxbook".
  // Resolve the active display language. Prefers an explicit selection from the
  // page language switcher (so the section is 100% single-language even if the
  // switcher doesn't update <html lang>), then falls back to <html lang>.
  function activeLang() {
    if (init._selectedLang) return init._selectedLang === 'ar' ? 'ar' : 'en';
    return (isBrowser && (document.documentElement.getAttribute('lang') || 'en').slice(0, 2) === 'ar') ? 'ar' : 'en';
  }

  function init(options) {
    if (!isBrowser) return;
    options = options || {};
    const container = document.querySelector('[data-public-performance]');
    if (!container) return;
    const baseUrl = options.baseUrl || window.PUBLIC_SNAPSHOT_BASE_URL || '';
    if (!isSafeBaseUrl(baseUrl)) {
      container.innerHTML = '<div class="pp-notice" role="status">' + esc(LABELS[activeLang()].dataUnavailable) + '</div>';
      return;
    }
    container.setAttribute('aria-busy', 'true');
    load(baseUrl, { nowMs: Date.now() }).then(function (result) {
      init._last = result;
      render(container, result, activeLang());
      container.setAttribute('aria-busy', 'false');
    });
    // Re-render (no refetch) whenever the page language changes, so the section
    // is always fully in the selected language — never mixed AR/EN.
    if (!init._langHooked) {
      init._langHooked = true;
      const rerender = function () { if (init._last) render(container, init._last, activeLang()); };
      try {
        const mo = new MutationObserver(function (muts) { muts.forEach(function (m) { if (m.attributeName === 'lang') rerender(); }); });
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      } catch (e) { /* no-op */ }
      document.addEventListener('click', function (e) {
        const el = e.target && e.target.closest ? e.target.closest('[data-lang]') : null;
        if (el) { init._selectedLang = el.getAttribute('data-lang'); setTimeout(rerender, 60); }
      }, true);
    }
  }

  if (isBrowser) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); });
    else init();
  }

  return {
    TRANSPORT_VERSION: TRANSPORT_VERSION, SCHEMA_VERSION: SCHEMA_VERSION, EXPECTED_SOURCE: EXPECTED_SOURCE,
    MANIFEST_FILE: MANIFEST_FILE, ALLOWED_FILES: ALLOWED_FILES, MAX_CACHE_AGE_MS: MAX_CACHE_AGE_MS,
    isValidUtcTimestamp: isValidUtcTimestamp, isSafePublicFilename: isSafePublicFilename, isSafeBaseUrl: isSafeBaseUrl,
    buildSnapshotUrl: buildSnapshotUrl, isSafeSnapshotPath: isSafeSnapshotPath, buildSnapshotUrlFromEntry: buildSnapshotUrlFromEntry, sha256Hex: sha256Hex,
    validateManifest: validateManifest, validateEnvelope: validateEnvelope, isStale: isStale, sampleStatusFor: sampleStatusFor,
    normalizeSystemSummary: normalizeSystemSummary, normalizePerformance: normalizePerformance, normalizeWeekly: normalizeWeekly, normalizeHistorical: normalizeHistorical,
    ingestSnapshot: ingestSnapshot, fetchVerified: fetchVerified, load: load, render: render, init: init, _labels: LABELS,
  };
});
