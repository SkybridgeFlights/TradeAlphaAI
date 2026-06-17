'use strict';

// Phase 206 — canonical equity registry. Single source of truth for the equity
// intelligence layer (charts, structure/tactical/liquidity/participation,
// scoring, cognitive network, pages, terminal). Each is a real large/mega-cap US
// equity. `sector` links to a sector-registry slug; `related_asset` is the broad
// ETF it tracks. Descriptive context only — never advice.

const EQUITIES = [
  { symbol: 'NVDA', slug: 'nvda', name_en: 'NVIDIA', name_ar: 'إنفيديا', sector: 'technology', related_asset: 'QQQ', cap_tier: 'mega',
    macro_sensitivity_en: 'rate / risk-appetite sensitive', macro_sensitivity_ar: 'حساس للفائدة والإقبال على المخاطر',
    sector_sensitivity_en: 'semiconductor & AI leadership', sector_sensitivity_ar: 'قيادة أشباه الموصلات والذكاء الاصطناعي', related_equities: ['AMD', 'AVGO', 'SMCI'] },
  { symbol: 'MSFT', slug: 'msft', name_en: 'Microsoft', name_ar: 'مايكروسوفت', sector: 'technology', related_asset: 'QQQ', cap_tier: 'mega',
    macro_sensitivity_en: 'duration-sensitive megacap', macro_sensitivity_ar: 'سهم ضخم حساس للمدة',
    sector_sensitivity_en: 'software & cloud leadership', sector_sensitivity_ar: 'قيادة البرمجيات والسحابة', related_equities: ['AAPL', 'GOOGL'] },
  { symbol: 'AAPL', slug: 'aapl', name_en: 'Apple', name_ar: 'آبل', sector: 'technology', related_asset: 'QQQ', cap_tier: 'mega',
    macro_sensitivity_en: 'consumer / duration-sensitive', macro_sensitivity_ar: 'حساس للمستهلك والمدة',
    sector_sensitivity_en: 'consumer hardware leadership', sector_sensitivity_ar: 'قيادة الأجهزة الاستهلاكية', related_equities: ['MSFT'] },
  { symbol: 'AMZN', slug: 'amzn', name_en: 'Amazon', name_ar: 'أمازون', sector: 'consumer-discretionary', related_asset: 'QQQ', cap_tier: 'mega',
    macro_sensitivity_en: 'consumer / growth-sensitive', macro_sensitivity_ar: 'حساس للمستهلك والنمو',
    sector_sensitivity_en: 'e-commerce & cloud', sector_sensitivity_ar: 'التجارة الإلكترونية والسحابة', related_equities: ['META', 'GOOGL'] },
  { symbol: 'META', slug: 'meta', name_en: 'Meta Platforms', name_ar: 'ميتا', sector: 'technology', related_asset: 'QQQ', cap_tier: 'mega',
    macro_sensitivity_en: 'risk-appetite sensitive', macro_sensitivity_ar: 'حساس للإقبال على المخاطر',
    sector_sensitivity_en: 'digital advertising leadership', sector_sensitivity_ar: 'قيادة الإعلانات الرقمية', related_equities: ['GOOGL'] },
  { symbol: 'GOOGL', slug: 'googl', name_en: 'Alphabet', name_ar: 'ألفابت', sector: 'technology', related_asset: 'QQQ', cap_tier: 'mega',
    macro_sensitivity_en: 'risk-appetite sensitive', macro_sensitivity_ar: 'حساس للإقبال على المخاطر',
    sector_sensitivity_en: 'search & advertising leadership', sector_sensitivity_ar: 'قيادة البحث والإعلانات', related_equities: ['META'] },
  { symbol: 'TSLA', slug: 'tsla', name_en: 'Tesla', name_ar: 'تسلا', sector: 'consumer-discretionary', related_asset: 'QQQ', cap_tier: 'large',
    macro_sensitivity_en: 'high-beta / rate-sensitive', macro_sensitivity_ar: 'بيتا مرتفع وحساس للفائدة',
    sector_sensitivity_en: 'EV & growth-cycle', sector_sensitivity_ar: 'السيارات الكهربائية ودورة النمو', related_equities: [] },
  { symbol: 'AMD', slug: 'amd', name_en: 'Advanced Micro Devices', name_ar: 'إيه إم دي', sector: 'technology', related_asset: 'QQQ', cap_tier: 'large',
    macro_sensitivity_en: 'high-beta semiconductor', macro_sensitivity_ar: 'أشباه موصلات عالية البيتا',
    sector_sensitivity_en: 'semiconductor cycle', sector_sensitivity_ar: 'دورة أشباه الموصلات', related_equities: ['NVDA', 'AVGO'] },
  { symbol: 'AVGO', slug: 'avgo', name_en: 'Broadcom', name_ar: 'برودكوم', sector: 'technology', related_asset: 'QQQ', cap_tier: 'mega',
    macro_sensitivity_en: 'rate-sensitive semiconductor', macro_sensitivity_ar: 'أشباه موصلات حساسة للفائدة',
    sector_sensitivity_en: 'semiconductor & infrastructure', sector_sensitivity_ar: 'أشباه الموصلات والبنية التحتية', related_equities: ['NVDA', 'AMD'] },
  { symbol: 'PLTR', slug: 'pltr', name_en: 'Palantir', name_ar: 'بالانتير', sector: 'technology', related_asset: 'QQQ', cap_tier: 'large',
    macro_sensitivity_en: 'high-beta / risk-sensitive', macro_sensitivity_ar: 'بيتا مرتفع وحساس للمخاطر',
    sector_sensitivity_en: 'enterprise & AI software', sector_sensitivity_ar: 'برمجيات المؤسسات والذكاء الاصطناعي', related_equities: [] },
  { symbol: 'SMCI', slug: 'smci', name_en: 'Super Micro Computer', name_ar: 'سوبر مايكرو', sector: 'technology', related_asset: 'QQQ', cap_tier: 'mid',
    macro_sensitivity_en: 'high-beta / risk-sensitive', macro_sensitivity_ar: 'بيتا مرتفع وحساس للمخاطر',
    sector_sensitivity_en: 'AI server hardware', sector_sensitivity_ar: 'أجهزة خوادم الذكاء الاصطناعي', related_equities: ['NVDA'] },
];

// Equity ↔ counterpart relationships (peer equity or broad asset).
const EQUITY_RELATIONSHIPS = [
  { id: 'nvda_amd', equity: 'NVDA', counterpart: 'AMD', type: 'equity', kind: 'peer', en: 'NVIDIA vs AMD (semis)', ar: 'إنفيديا مقابل إيه إم دي (أشباه الموصلات)' },
  { id: 'nvda_avgo', equity: 'NVDA', counterpart: 'AVGO', type: 'equity', kind: 'peer', en: 'NVIDIA vs Broadcom', ar: 'إنفيديا مقابل برودكوم' },
  { id: 'nvda_qqq', equity: 'NVDA', counterpart: 'QQQ', type: 'asset', kind: 'leadership', en: 'NVIDIA vs Nasdaq growth', ar: 'إنفيديا مقابل نمو ناسداك' },
  { id: 'aapl_msft', equity: 'AAPL', counterpart: 'MSFT', type: 'equity', kind: 'peer', en: 'Apple vs Microsoft', ar: 'آبل مقابل مايكروسوفت' },
  { id: 'aapl_qqq', equity: 'AAPL', counterpart: 'QQQ', type: 'asset', kind: 'leadership', en: 'Apple vs Nasdaq growth', ar: 'آبل مقابل نمو ناسداك' },
  { id: 'meta_googl', equity: 'META', counterpart: 'GOOGL', type: 'equity', kind: 'peer', en: 'Meta vs Alphabet', ar: 'ميتا مقابل ألفابت' },
  { id: 'meta_spy', equity: 'META', counterpart: 'SPY', type: 'asset', kind: 'macro', en: 'Meta vs the broad market', ar: 'ميتا مقابل السوق العريض' },
  { id: 'tsla_qqq', equity: 'TSLA', counterpart: 'QQQ', type: 'asset', kind: 'leadership', en: 'Tesla vs Nasdaq growth', ar: 'تسلا مقابل نمو ناسداك' },
  { id: 'tsla_iwm', equity: 'TSLA', counterpart: 'IWM', type: 'asset', kind: 'macro', en: 'Tesla vs small-caps (risk appetite)', ar: 'تسلا مقابل صغيرة رأس المال (الإقبال على المخاطر)' },
  { id: 'pltr_qqq', equity: 'PLTR', counterpart: 'QQQ', type: 'asset', kind: 'leadership', en: 'Palantir vs Nasdaq growth', ar: 'بالانتير مقابل نمو ناسداك' },
  { id: 'smci_nvda', equity: 'SMCI', counterpart: 'NVDA', type: 'equity', kind: 'peer', en: 'Super Micro vs NVIDIA (AI hardware)', ar: 'سوبر مايكرو مقابل إنفيديا (أجهزة الذكاء الاصطناعي)' },
];

const BY_SYMBOL = new Map(EQUITIES.map((e) => [e.symbol, e]));
const SLUGS = EQUITIES.map((e) => e.slug);
const chartId = (symbol) => `${symbol.toLowerCase()}-equity`;

module.exports = { EQUITIES, EQUITY_RELATIONSHIPS, BY_SYMBOL, SLUGS, chartId };
