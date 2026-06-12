'use strict';

// Phase 87 — Editorial visual mount.
// Resolves .editorial-visual-slot containers into TradingView symbol-overview
// embeds, lazily (IntersectionObserver) so charts cost nothing until the
// reader reaches them. No framework, no hydration, one third-party script per
// visible slot. If the embed cannot load, the institutional caption and
// attribution remain — the figure still reads.

(function editorialVisuals() {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
  var slots = document.querySelectorAll('.editorial-visual-slot[data-tv-symbols]');
  if (!slots.length) return;

  function mount(slot) {
    if (slot.getAttribute('data-mounted') === 'true') return;
    slot.setAttribute('data-mounted', 'true');
    var symbols = (slot.getAttribute('data-tv-symbols') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!symbols.length) return;
    var ar = slot.getAttribute('data-visual-locale') === 'ar';

    var container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    var inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    container.appendChild(inner);

    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
    script.async = true;
    script.text = JSON.stringify({
      symbols: symbols.map(function (s) { return [s]; }),
      chartOnly: true,
      width: '100%',
      height: 320,
      locale: ar ? 'ar_AE' : 'en',
      colorTheme: 'dark',
      autosize: true,
      showVolume: false,
      hideDateRanges: false,
      scalePosition: ar ? 'left' : 'right',
      lineWidth: 2,
      backgroundColor: 'rgba(9, 11, 15, 0)',
      gridLineColor: 'rgba(255, 255, 255, 0.06)',
    });
    container.appendChild(script);

    var fallback = slot.querySelector('.editorial-visual-fallback');
    if (fallback) fallback.remove();
    slot.appendChild(container);
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        mount(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '240px 0px' });

  slots.forEach(function (slot) { observer.observe(slot); });
})();
