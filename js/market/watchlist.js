const KEY = 'tradealpha_watchlist_v1';

export function getWatchlist() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

export function isInWatchlist(symbol) {
  return getWatchlist().includes(String(symbol).toUpperCase());
}

export function toggleWatchlist(symbol) {
  const sym = String(symbol).toUpperCase();
  const list = getWatchlist();
  const idx = list.indexOf(sym);
  if (idx === -1) { list.push(sym); save(list); return true; }
  list.splice(idx, 1); save(list); return false;
}

export function renderWatchlistButton(symbol, containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const isAr = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
  const sym = String(symbol).toUpperCase();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'watchlist-btn' + (isInWatchlist(sym) ? ' in-watchlist' : '');
  btn.setAttribute('aria-pressed', isInWatchlist(sym) ? 'true' : 'false');
  btn.dataset.symbol = sym;

  function updateLabel() {
    const inList = isInWatchlist(sym);
    btn.textContent = inList
      ? (isAr ? '★ في قائمة المتابعة' : '★ In Watchlist')
      : (isAr ? '☆ أضف إلى قائمة المتابعة' : '☆ Add to Watchlist');
    btn.className = 'watchlist-btn' + (inList ? ' in-watchlist' : '');
    btn.setAttribute('aria-pressed', inList ? 'true' : 'false');
  }

  updateLabel();

  btn.addEventListener('click', () => {
    toggleWatchlist(sym);
    updateLabel();
    dispatchWatchlistUpdate();
  });

  container.appendChild(btn);
  return btn;
}

function dispatchWatchlistUpdate() {
  try { window.dispatchEvent(new CustomEvent('tradealpha:watchlist-changed')); } catch {}
}

export function renderWatchlistStrip(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const isAr = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
  const list = getWatchlist();

  function render() {
    const current = getWatchlist();
    if (!current.length) {
      container.innerHTML = `<p class="muted-text watchlist-empty">${isAr ? 'قائمة المتابعة فارغة.' : 'Your watchlist is empty.'}</p>`;
      return;
    }
    container.innerHTML = `
      <div class="watchlist-strip">
        ${current.map(sym => {
          const folder = sym.length <= 4 && !['ABBV','AMGN','ARKG','ARKK','ARKQ','GILD','GOOGL','INTC','LULU','MRVL','NFLX','PANW','PYPL','SBUX','SHOP','SMCI','SNOW','SOXX','SOXL','TQQQ','AVGO'].includes(sym) ? 'stocks' : 'stocks';
          return `<a class="watchlist-chip" href="/${folder}/${sym.toLowerCase()}.html">
            <strong>${sym}</strong>
            <button type="button" class="watchlist-remove" data-remove="${sym}" aria-label="${isAr ? 'إزالة ' + sym : 'Remove ' + sym}">&times;</button>
          </a>`;
        }).join('')}
      </div>`;

    container.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        toggleWatchlist(btn.dataset.remove);
        render();
        dispatchWatchlistUpdate();
      });
    });
  }

  render();
  window.addEventListener('tradealpha:watchlist-changed', render);
}
