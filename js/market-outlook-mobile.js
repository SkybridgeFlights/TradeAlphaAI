(function () {
  'use strict';

  // ── Reading progress bar ──────────────────────────────────────────────────

  function initProgressBar() {
    const bar = document.querySelector('.reading-progress span');
    const mini = document.querySelector('.reading-progress-mini .mini-bar-fill');
    if (!bar && !mini) return;

    const article = document.querySelector('.market-outlook-article') || document.querySelector('main');
    if (!article) return;

    function update() {
      const rect = article.getBoundingClientRect();
      const total = article.offsetHeight;
      const scrolled = Math.max(0, -rect.top);
      const pct = Math.min(100, Math.round((scrolled / (total - window.innerHeight)) * 100));
      const pctStr = pct + '%';
      if (bar) bar.style.width = pctStr;
      if (mini) mini.style.width = pctStr;
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // ── Collapsible sections ──────────────────────────────────────────────────

  function initCollapsibleSections() {
    if (window.innerWidth > 768) return;

    const sections = document.querySelectorAll('.market-section[data-collapsible]');
    sections.forEach(function (section) {
      const head = section.querySelector('.market-section-head');
      const body = section.querySelector('.market-section-body');
      if (!head || !body) return;

      const btn = document.createElement('button');
      btn.className = 'market-section-collapse-toggle';
      btn.setAttribute('aria-expanded', 'true');
      btn.innerHTML = '<span class="toggle-label">طي</span><span class="toggle-icon" aria-hidden="true">&#9650;</span>';

      const isAr = document.documentElement.dir === 'rtl';
      btn.querySelector('.toggle-label').textContent = isAr ? 'طي' : 'Collapse';

      btn.addEventListener('click', function () {
        const collapsed = section.classList.toggle('is-collapsed');
        btn.setAttribute('aria-expanded', String(!collapsed));
        const label = btn.querySelector('.toggle-label');
        if (label) label.textContent = collapsed ? (isAr ? 'توسيع' : 'Expand') : (isAr ? 'طي' : 'Collapse');
      });

      head.appendChild(btn);
    });
  }

  // ── Mini progress bar ─────────────────────────────────────────────────────

  function injectMiniProgressBar() {
    if (window.innerWidth > 768) return;
    if (document.querySelector('.reading-progress-mini')) return;

    const article = document.querySelector('.market-outlook-article');
    if (!article) return;

    const isAr = document.documentElement.dir === 'rtl';
    const label = isAr ? 'القراءة' : 'Reading';

    const mini = document.createElement('div');
    mini.className = 'reading-progress-mini';
    mini.setAttribute('aria-hidden', 'true');
    mini.innerHTML = `<span>${label}</span><div class="mini-bar"><div class="mini-bar-fill"></div></div>`;
    article.parentNode.insertBefore(mini, article);
  }

  // ── Key takeaways mobile enhancement ─────────────────────────────────────

  function enhanceKeyTakeaways() {
    const box = document.querySelector('.market-key-takeaways');
    if (!box) return;

    // On mobile, move key takeaways to just below the hero section
    if (window.innerWidth > 768) return;

    const hero = document.querySelector('.market-hero');
    if (!hero || !hero.nextElementSibling) return;

    const existing = box.parentNode;
    if (existing && hero.nextElementSibling !== box.parentNode) {
      hero.parentNode.insertBefore(box.parentNode || box, hero.nextSibling);
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function init() {
    initProgressBar();
    injectMiniProgressBar();
    initCollapsibleSections();
    enhanceKeyTakeaways();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
