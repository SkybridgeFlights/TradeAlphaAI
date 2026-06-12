'use strict';

// Phase 75-RT — Live terminal refresh engine.
// Adaptive intraday polling of /api/live-quotes that updates the homepage
// market matrix (asset strip), the derivable macro monitor chips, and the
// data-as-of indicator. Honesty rules: only sourced live quotes update the
// DOM; unavailable assets keep the server-rendered state; on repeated
// failures the engine backs off and leaves the page exactly as CI built it.
// No fabricated values, no fake "real-time" claims — the indicator shows the
// actual sources and quote time.
//
// Cadence (seconds): volatility-sensitive, session-aware, paused when hidden.
//   US cash 35s · premarket/europe/after-hours 60s · asia 90s · weekend 180s
//   stressed tape (VIX >= 28 or any |move| >= 1.5%) tightens toward 30s.

(function liveTerminal() {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;

  var section = document.getElementById('newsroom-live');
  if (!section) return;
  var strip = section.querySelector('.nr-asset-strip');
  if (!strip) return;

  var ENDPOINT = strip.getAttribute('data-live-endpoint') || '/api/live-quotes';
  var AR = (document.documentElement.getAttribute('lang') || '').toLowerCase() === 'ar';
  var MAX_FAILURES = 3;
  var failures = 0;
  var timer = null;
  var lastStatus = null;

  // ── Contextual labels (mirrors render-newsroom-modules assetContext) ──────
  var LABELS = {
    GOLD: { up: ['Gold bid returning', 'عودة الطلب على الذهب'], down: ['Gold momentum fading', 'تراجع زخم الذهب'], flat: ['Gold holding range', 'الذهب في نطاق مستقر'] },
    DXY: { up: ['Dollar pressure building', 'ضغط الدولار يتصاعد'], down: ['Dollar pressure easing', 'ضغط الدولار يتراجع'], flat: ['Dollar steady', 'الدولار مستقر'] },
    US10Y: { up: ['Yield pressure building', 'ضغط العوائد يتصاعد'], down: ['Yield pressure stabilizing', 'ضغط العوائد يستقر'], flat: ['Yields anchored', 'العوائد مستقرة'] },
    SPY: { up: ['Broad bid intact', 'الطلب العام قائم'], down: ['Risk reduction visible', 'تقليص المخاطر ظاهر'], flat: ['Tape balanced', 'حركة متوازنة'], upThin: ['Index up, breadth thin', 'المؤشر صاعد والاتساع ضعيف'] },
    QQQ: { up: ['Duration risk rewarded', 'مكافأة المخاطرة في النمو'], down: ['Valuation tolerance tightening', 'تشدد في تقبل التقييمات'], flat: ['Growth complex steady', 'قطاع النمو مستقر'], upAI: ['AI leadership extended', 'قيادة الذكاء الاصطناعي ممتدة'] },
    BTC: { up: ['Liquidity beta firm', 'بيتا السيولة قوية'], down: ['Liquidity beta soft', 'بيتا السيولة ضعيفة'], flat: ['Crypto liquidity neutral', 'سيولة الكريبتو محايدة'] },
    VIX: { up: ['Hedging demand rising', 'طلب التحوط يرتفع'], down: ['Volatility compression', 'انضغاط التقلب'], flat: ['Vol regime steady', 'نظام التقلب مستقر'] },
    NVDA: { up: ['AI momentum extended', 'زخم الذكاء الاصطناعي ممتد'], down: ['AI momentum cooling', 'زخم الذكاء الاصطناعي يهدأ'], flat: ['AI complex consolidating', 'قطاع الذكاء الاصطناعي يتماسك'] },
    OIL: { up: ['Energy bid firming', 'الطلب على الطاقة يتقوى'], down: ['Energy complex soft', 'قطاع الطاقة ضعيف'], flat: ['Crude rangebound', 'الخام في نطاق محدود'] },
  };

  var STATE_AR = {
    compressed: 'منضغط', normal: 'طبيعي', elevated: 'مرتفع', stressed: 'مضغوط بشدة',
    firming: 'يتقوى', easing: 'يتراجع', stable: 'مستقر',
    'narrow-megacap': 'ضيق حول الكبرى', broadening: 'يتسع', balanced: 'متوازن',
    deteriorating: 'يتدهور', confirming: 'مؤكِّد', mixed: 'متباين', contained: 'محتوى',
  };

  function label(symbol, asset, dims) {
    var map = LABELS[symbol];
    if (!map) return null;
    var dir = asset.direction || 'flat';
    if (symbol === 'SPY' && dir === 'up' && dims.breadth_state === 'deteriorating' && map.upThin) return map.upThin[AR ? 1 : 0];
    if (symbol === 'QQQ' && dir === 'up' && dims.ai_concentration_risk === 'elevated' && map.upAI) return map.upAI[AR ? 1 : 0];
    var pair = map[dir] || map.flat;
    return pair[AR ? 1 : 0];
  }

  function fmtChange(pct) {
    if (pct === null || pct === undefined || !isFinite(pct)) return '—';
    return (pct > 0 ? '+' : '') + pct.toFixed(2) + '%';
  }

  // ── Intraday dimension derivation (same thresholds as build-market-pulse) ─
  function deriveDims(assets) {
    var vix = assets.vix && assets.vix.live ? assets.vix.value : null;
    var dxy = assets.dxy && assets.dxy.live ? assets.dxy.change_pct : null;
    var spy = assets.spy && assets.spy.live ? assets.spy.change_pct : null;
    var qqq = assets.qqq && assets.qqq.live ? assets.qqq.change_pct : null;
    var iwm = assets.iwm && assets.iwm.live ? assets.iwm.change_pct : null;
    var nvda = assets.nvda && assets.nvda.live ? assets.nvda.change_pct : null;
    var dims = {};
    if (vix !== null) dims.volatility_regime = vix < 14 ? 'compressed' : vix < 20 ? 'normal' : vix < 28 ? 'elevated' : 'stressed';
    if (dxy !== null) dims.dollar_pressure = dxy > 0.3 ? 'firming' : dxy < -0.3 ? 'easing' : 'stable';
    if (qqq !== null && iwm !== null) dims.momentum_concentration = qqq - iwm > 0.8 ? 'narrow-megacap' : iwm - qqq > 0.8 ? 'broadening' : 'balanced';
    if (spy !== null && iwm !== null) dims.breadth_state = spy > 0 && iwm < 0 ? 'deteriorating' : spy > 0 && iwm > 0 ? 'confirming' : 'mixed';
    if (nvda !== null && spy !== null) dims.ai_concentration_risk = Math.abs(nvda) > Math.abs(spy) * 2.5 ? 'elevated' : 'contained';
    return dims;
  }

  function updateStrip(assets, dims) {
    var cells = strip.querySelectorAll('.nr-asset[data-symbol]');
    for (var i = 0; i < cells.length; i += 1) {
      var cell = cells[i];
      var symbol = cell.getAttribute('data-symbol');
      var entry = null;
      for (var key in assets) {
        if (assets[key] && assets[key].symbol === symbol) { entry = assets[key]; break; }
      }
      if (!entry || !entry.live) continue; // keep server-rendered honesty state
      var chg = cell.querySelector('.nr-asset-chg');
      var ctx = cell.querySelector('.nr-asset-ctx');
      if (chg) chg.textContent = fmtChange(entry.change_pct);
      cell.setAttribute('data-dir', entry.direction || 'flat');
      var text = label(symbol, entry, dims);
      if (ctx && text) ctx.textContent = text;
    }
  }

  function updateChips(dims) {
    for (var dim in dims) {
      var chip = section.querySelector('.nr-chip[data-dim="' + dim + '"]');
      if (!chip) continue;
      var value = dims[dim];
      chip.setAttribute('data-state', value);
      var strong = chip.querySelector('strong');
      if (strong) strong.textContent = AR ? (STATE_AR[value] || value) : value.replace(/_/g, '-');
    }
  }

  function updateAsOf(payload) {
    var node = section.querySelector('.nr-live-asof');
    if (!node) return;
    var sources = {};
    for (var key in payload.assets) {
      var a = payload.assets[key];
      if (a && a.live && a.source) sources[a.source] = true;
    }
    var names = Object.keys(sources).join(', ');
    var time = payload.updated_at ? payload.updated_at.slice(11, 16) + ' UTC' : '';
    node.textContent = AR
      ? 'تحديث موثق ' + time + (names ? ' · المصادر: ' + names : '')
      : 'Sourced update ' + time + (names ? ' · ' + names : '');
    node.setAttribute('data-live-status', payload.status || 'unknown');
  }

  // ── Session + cadence ──────────────────────────────────────────────────────
  function sessionSeconds() {
    var now = new Date();
    var day = now.getUTCDay();
    var hour = now.getUTCHours() + now.getUTCMinutes() / 60;
    if (day === 6 || (day === 0 && hour < 22) || (day === 5 && hour >= 21)) return 180; // weekend: crypto/futures pace
    if (hour >= 13.5 && hour < 20) return 35;  // US cash
    if (hour >= 9 && hour < 13.5) return 60;   // US premarket
    if (hour >= 7 && hour < 9) return 60;      // Europe
    if (hour >= 20 && hour < 22) return 60;    // after-hours
    return 90;                                  // Asia
  }

  function cadence(payload) {
    var base = sessionSeconds();
    if (payload && payload.assets) {
      var vix = payload.assets.vix;
      var stressed = vix && vix.live && vix.value >= 28;
      if (!stressed) {
        for (var key in payload.assets) {
          var a = payload.assets[key];
          if (a && a.live && Math.abs(a.change_pct) >= 1.5) { stressed = true; break; }
        }
      }
      if (stressed) base = Math.max(30, Math.round(base * 0.6));
    }
    if (failures >= MAX_FAILURES) base = 300; // degraded: stop hammering, page stays CI-rendered
    return Math.min(Math.max(base, 30), 300) * 1000;
  }

  function schedule(payload) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(tick, cadence(payload));
  }

  function tick() {
    if (document.hidden) { schedule(lastStatus); return; }
    fetch(ENDPOINT, { headers: { Accept: 'application/json' } })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (payload) {
        failures = 0;
        lastStatus = payload;
        if (payload && payload.ok && payload.assets && payload.live_count > 0) {
          var dims = deriveDims(payload.assets);
          updateStrip(payload.assets, dims);
          updateChips(dims);
          updateAsOf(payload);
          section.setAttribute('data-live', payload.status);
        }
        schedule(payload);
      })
      .catch(function () {
        failures += 1;
        if (failures >= MAX_FAILURES) section.setAttribute('data-live', 'degraded');
        schedule(lastStatus);
      });
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      if (timer) clearTimeout(timer);
      tick(); // immediate refresh on return
    }
  });

  // First fetch shortly after load — the server-rendered state remains the
  // source of truth until verified live quotes arrive.
  timer = setTimeout(tick, 1200);
})();
