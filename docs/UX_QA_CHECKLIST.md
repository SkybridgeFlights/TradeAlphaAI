# UX QA Checklist

Core URLs:
- `/`
- `/ar/`
- `/stocks.html`
- `/ar/stocks.html`
- `/etfs.html`
- `/ar/etfs.html`
- `/ai-stock-screener.html`
- `/ar/ai-stock-screener.html`
- `/rankings.html`
- `/ar/rankings.html`

Mobile widths:
- 390px
- 430px
- 768px

Checks:
- Header shows logo, language switcher, and hamburger on mobile.
- Drawer opens/closes, backdrop works, no permanent nav content blocks the page.
- Arabic drawer is RTL and English drawer is LTR.
- Search autocomplete returns NVDA, NVIDIA, SPY, and semiconductor matches.
- Screener filters by type, sector/theme, risk, score, ETF category, and sort.
- Arabic pages have Arabic UI labels, RTL typography, no mixed-language nav.
- Production checks pass after generation.
