const KEY = 'ta_recently_viewed_v1';
const MAX = 10;

const TYPE_LABELS = {
  stock: { en: 'Stock', ar: 'سهم' },
  etf: { en: 'ETF', ar: 'صندوق' },
  comparison: { en: 'Comparison', ar: 'مقارنة' },
  insight: { en: 'Article', ar: 'مقال' },
};

export function trackRecentlyViewed({ title, url, type, symbol }) {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) || '[]');
    const entry = { title: String(title || ''), url: String(url || location.pathname), type: String(type || 'page'), symbol: symbol ? String(symbol).toUpperCase() : null, timestamp: Date.now() };
    const next = [entry, ...items.filter(i => i.url !== entry.url)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function getRecentlyViewed() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function isAr() {
  return document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
}

export function renderRecentlyViewed(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  const ar = isAr();
  const items = getRecentlyViewed();

  if (!items.length) {
    container.innerHTML = `<p class="muted-text recently-viewed-empty">${ar ? 'لم تقم بعرض أي صفحات بحثية بعد.' : 'No recently viewed research pages yet.'}</p>`;
    return;
  }

  container.innerHTML = `<div class="recently-viewed-strip">${
    items.map(item => {
      const typeLabel = (TYPE_LABELS[item.type] || { en: item.type, ar: item.type })[ar ? 'ar' : 'en'];
      const sym = item.symbol ? `<strong>${item.symbol}</strong> ` : '';
      const title = item.title.length > 52 ? item.title.slice(0, 50) + '…' : item.title;
      return `<a class="recently-viewed-item" href="${item.url}"><span class="rv-type">${typeLabel}</span>${sym}<span class="rv-title">${title}</span></a>`;
    }).join('')
  }</div>`;
}
