#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const SCAN_ROOTS = [
  "ar",
  "data/localization",
  "data/research-assets",
  "js",
  "tools",
  "landing-i18n.js",
  "index.html",
  "stocks.html",
  "etfs.html",
  "rankings.html",
  "ai-stock-screener.html",
  "methodology.html",
  "performance",
];

const TEXT_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".json",
  ".css",
  ".xml",
  ".txt",
  ".md",
]);

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".vercel",
  ".npm-cache",
]);

const MOJIBAKE_PATTERNS = [
  { name: "Arabic UTF-8 decoded as Latin-1/Windows-1252", regex: /[\u00d8\u00d9][\u0080-\u00ffA-Za-z0-9\s.,;:!?'"()[\]{}<>\/\\|+=_-]{1,80}/ },
  { name: "UTF-8 punctuation decoded as Windows-1252", regex: /\u00e2(?:\u20ac|\u20ac\u2122|\u20ac\u0153|\u20ac\u009d|\u20ac\u201c|\u20ac\u2018|\u20ac\u201d|\u201e|\u00a2|\u00a6)/ },
  { name: "Latin-1 mojibake marker", regex: /[\u00c3\u00c2][\u0080-\u00ffA-Za-z0-9\s.,;:!?'"()[\]{}<>\/\\|+=_-]{1,80}/ },
  { name: "Unicode replacement character", regex: /\uFFFD/ },
];

function walk(target, out = []) {
  const absolute = path.join(ROOT, target);
  if (!fs.existsSync(absolute)) return out;
  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    out.push(absolute);
    return out;
  }
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) {
      walk(child, out);
    } else {
      out.push(path.join(ROOT, child));
    }
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

function isTextFile(file) {
  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function lineAndColumn(source, index) {
  const before = source.slice(0, index);
  const lines = before.split(/\r\n|\r|\n/);
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function snippet(source, index) {
  return source
    .slice(Math.max(0, index - 35), Math.min(source.length, index + 95))
    .replace(/\s+/g, " ")
    .trim();
}

const files = [...new Set(SCAN_ROOTS.flatMap((root) => walk(root)))].filter(isTextFile);
const failures = [];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const pattern of MOJIBAKE_PATTERNS) {
    const match = source.match(pattern.regex);
    if (match && match.index !== undefined) {
      const loc = lineAndColumn(source, match.index);
      failures.push({
        file: rel(file),
        line: loc.line,
        column: loc.column,
        reason: pattern.name,
        snippet: snippet(source, match.index),
      });
      break;
    }
  }

  if (path.extname(file).toLowerCase() === ".html") {
    const headStart = source.search(/<head[\s>]/i);
    const searchArea = headStart >= 0 ? source.slice(headStart, headStart + 1200) : source.slice(0, 1200);
    if (!/<meta\s+charset=["']?UTF-8["']?\s*\/?>/i.test(searchArea)) {
      failures.push({
        file: rel(file),
        line: 1,
        column: 1,
        reason: "Missing early UTF-8 charset meta tag",
        snippet: "Expected <meta charset=\"UTF-8\"> near the top of <head>",
      });
    }
  }
}

if (failures.length) {
  console.error(`UTF-8 integrity check failed with ${failures.length} finding(s):`);
  for (const failure of failures.slice(0, 80)) {
    console.error(`- ${failure.file}:${failure.line}:${failure.column} ${failure.reason}`);
    console.error(`  ${failure.snippet}`);
  }
  if (failures.length > 80) {
    console.error(`... ${failures.length - 80} more finding(s) omitted`);
  }
  process.exit(1);
}

console.log(`UTF-8 integrity check passed for ${files.length} text file(s).`);
