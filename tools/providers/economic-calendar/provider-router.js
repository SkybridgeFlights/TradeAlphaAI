'use strict';

const fs = require('fs');
const path = require('path');
const fmp          = require('./fmp-provider');
const finnhub      = require('./finnhub-provider');
const alphavantage = require('./alphavantage-provider');
const fred         = require('./fred-provider');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const HEALTH_PATH = path.join(ROOT, 'data', 'provider-health.json');
const CACHE_PATH = path.join(ROOT, 'data', 'cache', 'economic-calendar-cache.json');
const PROVIDERS = [fmp, finnhub, alphavantage, fred];

async function fetchEconomicCalendar(options = {}) {
  const context = {
    from: options.from,
    to: options.to,
    env: options.env || process.env
  };
  const attempts = [];

  // Key-presence diagnostics — never log values
  const keyChecks = [
    ['FMP_API_KEY', 'FINANCIAL_MODELING_PREP_API_KEY'],
    ['FINNHUB_API_KEY'],
    ['ALPHAVANTAGE_API_KEY'],
    ['FRED_API_KEY'],
  ];
  for (const [primary, alias] of keyChecks) {
    const present = !!(
      String(context.env[primary] || '').trim() ||
      (alias && String(context.env[alias] || '').trim())
    );
    console.log(`[calendar-env] ${primary}=${present ? 'present' : 'missing'}`);
  }

  console.log(`[PROVIDER_ROUTER] starting priority=fmp>finnhub>alphavantage>fred range=${context.from}..${context.to}`);

  for (const provider of PROVIDERS) {
    const name = providerName(provider);
    try {
      const result = await provider.fetchCalendar(context);
      const allEvents   = result.events || [];
      const valid       = allEvents.filter((event) => !event.error);
      const rejected    = allEvents.length - valid.length;
      console.log(`[PROVIDER_ROUTER] ${name} raw=${result.rawCount || allEvents.length} normalized=${allEvents.length} valid=${valid.length} rejected=${rejected}`);
      if (rejected > 0) {
        const reasons = {};
        allEvents.filter((e) => e.error).forEach((e) => {
          const key = (e.error || 'unknown').slice(0, 60);
          reasons[key] = (reasons[key] || 0) + 1;
        });
        Object.entries(reasons).slice(0, 8).forEach(([r, n]) => console.log(`[PROVIDER_ROUTER]   ${name} rejected: ${r} (×${n})`));
      }
      if (!valid.length) throw providerFailure(name, result.endpoint, 'no_supported_events');
      attempts.push(healthAttempt(name, 'ok', result.endpoint, '', valid.length));
      const routed = { ...result, events: valid, fallbackUsed: name !== 'fmp', attempts };
      writeCache(routed);
      writeHealth(routed, attempts, false, '');
      console.log(`[PROVIDER_ROUTER] active=${name} events=${valid.length} fallback_used=${routed.fallbackUsed}`);
      return routed;
    } catch (error) {
      const endpoint = error.endpoint || provider.ENDPOINT || '';
      const reason = sanitizeReason(error.message);
      attempts.push(healthAttempt(name, 'unavailable', endpoint, reason, 0));
      console.warn(`[${name.toUpperCase()}_PROVIDER] unavailable reason=${reason}`);
    }
  }

  const cached = readCache();
  if (cached?.events?.length) {
    const result = {
      provider: cached.provider || 'cache',
      endpoint: cached.endpoint || 'local-cache',
      fetchedAt: cached.fetchedAt || cached.fetched_at,
      events: cached.events,
      rawCount: cached.events.length,
      fallbackUsed: true,
      cacheUsed: true,
      attempts
    };
    writeHealth(result, attempts, true, 'all_live_providers_unavailable_cache_used');
    console.warn(`[PROVIDER_ROUTER] active=cache events=${result.events.length} degraded=true`);
    return result;
  }

  const degraded = {
    provider: 'degraded',
    endpoint: '',
    fetchedAt: new Date().toISOString(),
    events: [],
    rawCount: 0,
    fallbackUsed: true,
    attempts
  };
  writeHealth(degraded, attempts, true, 'all_providers_unavailable');
  console.warn('[PROVIDER_ROUTER] active=degraded events=0 reason=all_providers_unavailable');
  return degraded;
}

function writeHealth(result, attempts, degraded, reason) {
  const existing = readJson(HEALTH_PATH, {});
  const providers = { ...(existing.providers || {}) };
  for (const attempt of attempts) {
    const previous = providers[attempt.provider] || {};
    providers[attempt.provider] = {
      ...previous,
      last_checked: attempt.last_checked,
      status: attempt.status,
      degraded: attempt.status !== 'ok',
      reason: attempt.reason || null,
      endpoint: attempt.endpoint,
      last_event_count: attempt.event_count,
      ...(attempt.status === 'ok' ? { last_success: attempt.last_checked } : {})
    };
  }
  const previousSuccess = existing.last_success || providers[result.provider]?.last_success || null;
  const health = {
    provider: result.provider,
    status: degraded ? 'degraded' : 'live',
    degraded,
    reason: reason || null,
    endpoint: result.endpoint || null,
    fallback_used: result.fallbackUsed === true,
    fallback_provider: result.fallbackUsed ? result.provider : null,
    last_success: degraded ? previousSuccess : result.fetchedAt,
    last_checked: new Date().toISOString(),
    event_count: result.events.length,
    providers
  };
  safeWriteJson(HEALTH_PATH, health, 'provider health');
}

function writeCache(result) {
  safeWriteJson(CACHE_PATH, {
    provider: result.provider,
    endpoint: result.endpoint,
    fetched_at: result.fetchedAt,
    events: result.events
  }, 'calendar cache');
}

function readCache() {
  return readJson(CACHE_PATH, null);
}

function healthAttempt(provider, status, endpoint, reason, eventCount) {
  return {
    provider,
    status,
    endpoint,
    reason,
    event_count: eventCount,
    last_checked: new Date().toISOString()
  };
}

function providerName(provider) {
  if (provider === fmp)          return 'fmp';
  if (provider === finnhub)      return 'finnhub';
  if (provider === alphavantage) return 'alphavantage';
  return 'fred';
}

function providerFailure(provider, endpoint, reason) {
  const error = new Error(reason);
  error.provider = provider;
  error.endpoint = endpoint;
  return error;
}

function sanitizeReason(value) {
  return String(value || 'unknown_error')
    .replace(/apikey=[^&\s]+/gi, 'apikey=[redacted]')
    .replace(/token=[^&\s]+/gi, 'token=[redacted]')
    .slice(0, 240);
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function safeWriteJson(file, data, label) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    return true;
  } catch (error) {
    console.warn(`[PROVIDER_ROUTER] unable to write ${label}: ${sanitizeReason(error.message)}`);
    return false;
  }
}

module.exports = { fetchEconomicCalendar };
