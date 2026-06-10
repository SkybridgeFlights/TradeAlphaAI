'use strict';

const SITE_URL = (process.env.SITE_URL || 'https://www.tradealphaai.com').replace(/\/$/, '');

const DIR_EMOJI = {
  'strongly bullish': '▲▲',
  'bullish':          '▲',
  'mildly bullish':   '△',
  'neutral':          '◆',
  'mildly bearish':   '▽',
  'bearish':          '▼',
  'strongly bearish': '▼▼',
};
const VOL_EMOJI = { low: '🟢', moderate: '🟡', elevated: '🟠', high: '🔴' };
const CONF_LABEL_EN = { high: '● High', moderate: '◑ Mod', low: '○ Low' };
const CONF_LABEL_AR = { high: '● عالٍ', moderate: '◑ متوسط', low: '○ منخفض' };

const DIR_LABEL_EN = {
  'strongly bullish': 'Strongly Bullish',
  'bullish':          'Bullish',
  'mildly bullish':   'Mildly Bullish',
  'neutral':          'Neutral',
  'mildly bearish':   'Mildly Bearish',
  'bearish':          'Bearish',
  'strongly bearish': 'Strongly Bearish',
};
const DIR_LABEL_AR = {
  'strongly bullish': 'صاعد بقوة',
  'bullish':          'صاعد',
  'mildly bullish':   'صاعد بحذر',
  'neutral':          'محايد',
  'mildly bearish':   'هابط بحذر',
  'bearish':          'هابط',
  'strongly bearish': 'هابط بقوة',
};
const VOL_LABEL_EN = { low: 'Low Volatility', moderate: 'Moderate', elevated: 'Elevated', high: 'High Volatility' };
const VOL_LABEL_AR = { low: 'تقلب منخفض', moderate: 'متوسط', elevated: 'مرتفع', high: 'تقلب عالٍ' };

function dirLine(asset, bias, ar) {
  const b     = bias || { direction: 'neutral', strength: 0, confidence: 'low', drivers: [] };
  const dir   = b.direction || 'neutral';
  const emoji = DIR_EMOJI[dir] || '◆';
  const label = ar ? (DIR_LABEL_AR[dir] || dir) : (DIR_LABEL_EN[dir] || dir);
  const conf  = ar ? (CONF_LABEL_AR[b.confidence] || '') : (CONF_LABEL_EN[b.confidence] || '');
  const driver = (b.drivers || [])[0] ? ` — ${(b.drivers)[0]}` : '';
  return `${emoji} ${asset}: ${label} (${b.strength}) ${conf}${driver}`;
}

function formatBrief(brief, lang) {
  const ar       = lang === 'ar';
  const biases   = brief.directional_biases || {};
  const vol      = brief.volatility_expectation || { level: 'unknown', score: 0, drivers: [] };
  const date     = brief.date || brief.generated_at?.slice(0, 10) || '';
  const narrative = ar ? (brief.narrative_ar || brief.narrative_en || '') : (brief.narrative_en || '');

  const volLine = `${VOL_EMOJI[vol.level] || '◆'} ${ar ? 'التقلب المتوقع' : 'Volatility'}: ${ar ? VOL_LABEL_AR[vol.level] : VOL_LABEL_EN[vol.level]} (${vol.score}/100)`;

  const biasLines = [
    dirLine('Gold', biases.gold, ar),
    dirLine('USD', biases.usd, ar),
    dirLine('SPY', biases.spy, ar),
    dirLine('Nasdaq', biases.nasdaq, ar),
  ].join('\n');

  const surprises = (brief.top_surprises || []).slice(0, 3);
  const surprisesBlock = surprises.length
    ? (ar ? '\n📊 مفاجآت البيانات:\n' : '\n📊 Data Surprises:\n') +
      surprises.map((s) => `• ${s.name}: ${s.label} (${s.direction})`).join('\n')
    : '';

  const calendarLink = ar
    ? `${SITE_URL}/ar/economic-calendar/`
    : `${SITE_URL}/economic-calendar/`;

  const header = ar
    ? `📋 موجز السوق اليومي — ${date}`
    : `📋 Daily Market Brief — ${date}`;

  const footer = ar
    ? `🔗 التقويم الاقتصادي: ${calendarLink}\n⚠️ تعليق تعليمي فقط. ليس نصيحة استثمارية.`
    : `🔗 Calendar: ${calendarLink}\n⚠️ Educational commentary only. Not investment advice.`;

  const narrativeBlock = narrative ? `\n${narrative}\n` : '';

  return [
    header,
    '',
    volLine,
    '',
    ar ? '📈 التحيز الاتجاهي:' : '📈 Directional Bias:',
    biasLines,
    surprisesBlock,
    narrativeBlock,
    footer,
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function formatSurpriseAlert(event, scored, lang) {
  const ar      = lang === 'ar';
  const name    = event.event_name || '';
  const country = event.country || '';
  const dir     = scored.direction;
  const label   = scored.label;
  const mag     = scored.magnitude.toFixed(1);
  const actual  = event.actual;
  const forecast = event.forecast;

  const emoji = dir === 'beat' ? '🟢' : dir === 'miss' ? '🔴' : '⚪';

  if (ar) {
    return [
      `${emoji} تنبيه البيانات الاقتصادية`,
      `📌 ${name} (${country})`,
      `الفعلي: ${actual} | التوقع: ${forecast}`,
      `النتيجة: ${label} (${mag}% انحراف)`,
      '',
      `⚠️ تعليق تعليمي. ليس توصية.`,
    ].join('\n');
  }

  return [
    `${emoji} Economic Data Alert`,
    `📌 ${name} (${country})`,
    `Actual: ${actual} | Forecast: ${forecast}`,
    `Result: ${label} (${mag}% deviation)`,
    '',
    `⚠️ Educational commentary. Not a recommendation.`,
  ].join('\n');
}

module.exports = { formatBrief, formatSurpriseAlert };
