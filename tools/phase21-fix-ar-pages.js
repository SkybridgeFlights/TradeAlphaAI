#!/usr/bin/env node
// Phase 21 — Fix AR page issues:
// 1. Noindex 5 AR weak pages + remove from sitemap-ar.xml
// 2. Add research-layer.js to 4 AR stub pages
// 3. Add extra FAQ items to 3 AR pages with FAQ count mismatch

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

// === Part 1: Noindex 5 AR weak pages ===
const WEAK_AR = [
  "etf-education-etf-structure-and-index-methodology.html",
  "etf-education-expense-ratios-and-tracking-differences.html",
  "interest-rate-research-interest-rate-sensitivity-in-growth-stocks.html",
  "mega-cap-tech-research-mega-cap-concentration-in-passive-indexes.html",
  "semiconductor-market-research-ai-chip-supply-chain-constraints.html"
];

let noindexed = 0;
for (const slug of WEAK_AR) {
  const file = path.join(root, "ar", "insights", slug);
  if (!fs.existsSync(file)) { console.log("AR MISSING:", slug); continue; }
  let html = fs.readFileSync(file, "utf8");
  if (html.includes('content="noindex,nofollow"')) { console.log("AR SKIP (already noindex):", slug); continue; }
  html = html.replace(/(<meta name="robots" content=")[^"]*(")/,  '$1noindex,nofollow$2');
  fs.writeFileSync(file, html, "utf8");
  console.log("AR NOINDEXED:", slug);
  noindexed++;
}

// === Part 2: Remove 5 from sitemap-ar.xml ===
const arSitemap = path.join(root, "sitemap-ar.xml");
let arSM = fs.readFileSync(arSitemap, "utf8");
let sitemapFixed = 0;
for (const slug of WEAK_AR) {
  const re = new RegExp(
    `\\s*<url>\\s*<loc>[^<]*/ar/insights/${slug.replace(/\./g, "\\.")}[^<]*<\\/loc>\\s*<changefreq>[^<]*<\\/changefreq>\\s*<priority>[^<]*<\\/priority>\\s*<\\/url>`,
    "g"
  );
  const before = arSM.length;
  arSM = arSM.replace(re, "");
  if (arSM.length < before) { console.log("AR SITEMAP REMOVED:", slug); sitemapFixed++; }
  else { console.log("AR SITEMAP NOT FOUND:", slug); }
}
fs.writeFileSync(arSitemap, arSM, "utf8");

// === Part 3: Add research-layer.js to 4 AR stub pages ===
const RL_STUBS = [
  "spy-vs-qqq-etf-comparison-guide.html",
  "dividend-etfs-explained.html",
  "growth-etfs-vs-value-etfs.html",
  "semiconductor-stocks-outlook.html"
];
const RL_TAG = '\n  <script src="/js/research-layer.js"></script>';
let rlFixed = 0;
for (const slug of RL_STUBS) {
  const file = path.join(root, "ar", "insights", slug);
  if (!fs.existsSync(file)) { console.log("AR STUB MISSING:", slug); continue; }
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("research-layer.js")) { console.log("AR RL SKIP (already has):", slug); continue; }
  // Insert before </body>
  html = html.replace("</body>", RL_TAG + "\n</body>");
  fs.writeFileSync(file, html, "utf8");
  console.log("AR RL ADDED:", slug);
  rlFixed++;
}

// === Part 4: Add FAQ items to AR stubs with count mismatch ===

// dividend-etfs-explained: needs 2 more (3→5)
const DIVFAQ_EXTRA = `<details><summary>ما الفرق بين صندوق SCHD وصندوق VIG؟</summary><p>يفحص SCHD استدامة التوزيعات من خلال أربعة معايير مالية: نسبة التدفق النقدي إلى الديون، العائد على حقوق الملكية، عائد التوزيعات، ومعدل النمو لخمس سنوات. أما VIG فيختار الشركات التي تزيد توزيعاتها سنويا لأكثر من عشر سنوات متتالية. SCHD يوفر عائدا أعلى (~3-4%)؛ VIG يركز على اتساق النمو مع عائد أقل (~1.5-2%). محتوى تعليمي فقط.</p></details>
<details><summary>هل صناديق الأرباح بديل عن السندات؟</summary><p>لا. صناديق الأرباح أدوات ملكية تحمل مخاطر سوق الأسهم بالكامل وتنخفض بشكل ملحوظ خلال فترات هبوط الأسواق. تختلف عن السندات في الجودة الائتمانية وخصائص ارتباط العوائد. BND وIEF يوفران تنويعا حقيقيا عن الأسهم؛ أما صناديق الأرباح مثل SCHD فبيتا لديها ~0.75-0.85. محتوى تعليمي فقط.</p></details>`;

// growth-etfs-vs-value-etfs: needs 2 more (3→5)
const GROWTHFAQ_EXTRA = `<details><summary>ما صناديق النمو الأكثر بحثا؟</summary><p>تشمل صناديق النمو الأكثر بحثا: QQQ (إنفيسكو ناسداك 100، ~60% تقنية)، VUG (فانغارد للنمو، ~50-60% تقنية)، SCHG (شواب للنمو الأمريكي الكبير)، وIWF (iShares راسل 1000 للنمو). QQQ هو الأوسع استخداما في أبحاث نمو التقنية والذكاء الاصطناعي. محتوى تعليمي فقط.</p></details>
<details><summary>هل صناديق النمو أكثر خطورة من صناديق القيمة؟</summary><p>عموما نعم. صناديق النمو تحمل بيتا أعلى وتاريخيا تتأثر أكثر بارتفاع أسعار الفائدة لأن تقييماتها تستند إلى أرباح مستقبلية بعيدة. خلال دورة رفع الفائدة 2022 تراجع QQQ بنحو 35% مقارنة بـ 5-7% لصناديق القيمة مثل VTV. غير أن صناديق القيمة تتأخر بشكل ملحوظ خلال فترات ارتفاع الأسواق بقيادة التقنية. محتوى تعليمي فقط.</p></details>`;

// semiconductor-stocks-outlook: needs 1 more (3→4)
const SEMIFAQ_EXTRA = `<details><summary>ما الفرق بين صندوق SOXX وصندوق SMH؟</summary><p>SOXX (iShares، ~0.35% رسوم) يضم نحو 30 شركة بترجيح معدل يوفر تنويعا أوسع. SMH (VanEck، ~0.35% رسوم) يضم نحو 25 شركة بترجيح السوق مما يمنح أوزانا أكبر لـ TSMC وNVDA. كلا الصندوقين يحملان بيتا مرتفعا (~1.3-1.5) مقارنة بـ SPY. محتوى تعليمي فقط.</p></details>`;

function addFaq(slug, extraHtml) {
  const file = path.join(root, "ar", "insights", slug);
  if (!fs.existsSync(file)) { console.log("AR FAQ MISSING:", slug); return; }
  let html = fs.readFileSync(file, "utf8");
  // Insert extra FAQ items before closing insight-disclaimer div
  const marker = '<div class="insight-disclaimer">';
  if (!html.includes(marker)) {
    // Try inserting before </article>
    html = html.replace("</article>", extraHtml + "\n</article>");
  } else {
    html = html.replace(marker, extraHtml + "\n" + marker);
  }
  fs.writeFileSync(file, html, "utf8");
  console.log("AR FAQ ADDED:", slug);
}

addFaq("dividend-etfs-explained.html", DIVFAQ_EXTRA);
addFaq("growth-etfs-vs-value-etfs.html", GROWTHFAQ_EXTRA);
addFaq("semiconductor-stocks-outlook.html", SEMIFAQ_EXTRA);

console.log("\n=== Summary ===");
console.log("AR noindexed:", noindexed);
console.log("AR sitemap removed:", sitemapFixed);
console.log("AR research-layer.js added:", rlFixed);
console.log("AR FAQ additions: dividend-etfs+2, growth-etfs+2, semiconductor+1");
