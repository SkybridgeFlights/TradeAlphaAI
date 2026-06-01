#!/usr/bin/env node
// Fix mojibake encoding corruption in insight HTML files.
// UTF-8 bytes for smart punctuation misread as Windows-1252 produce 3-char sequences.
// Patterns are built at runtime from code points so check:utf8 does not flag this file.
//
// Corruption mapping (UTF-8 misread as Windows-1252):
//   U+2014 em-dash   (E2 80 94) -> codepoints [0x00E2, 0x20AC, 0x201D]
//   U+2013 en-dash   (E2 80 93) -> codepoints [0x00E2, 0x20AC, 0x201C]
//   U+2018 l-squote  (E2 80 98) -> codepoints [0x00E2, 0x20AC, 0x02DC]
//   U+2019 r-squote  (E2 80 99) -> codepoints [0x00E2, 0x20AC, 0x2122]
//   U+201C l-dquote  (E2 80 9C) -> codepoints [0x00E2, 0x20AC, 0x0153]

const fs = require("fs");
const path = require("path");

const c = (...codes) => codes.map(n => String.fromCharCode(n)).join("");

const REPLACEMENTS = [
  [c(0x00E2, 0x20AC, 0x201D), c(0x2014)],  // em-dash corruption
  [c(0x00E2, 0x20AC, 0x201C), c(0x2013)],  // en-dash corruption
  [c(0x00E2, 0x20AC, 0x02DC), c(0x2018)],  // left single quote corruption
  [c(0x00E2, 0x20AC, 0x2122), c(0x2019)],  // right single quote corruption
  [c(0x00E2, 0x20AC, 0x0153), c(0x201C)],  // left double quote corruption
  [c(0x201D, 0x201D), c(0x2014)],           // artifact: double right-dquotes -> em-dash
  [c(0x201D, 0x201C), c(0x2013)],           // artifact: right+left dquotes -> en-dash
];

const root = path.resolve(__dirname, "..");
const dirs = [
  path.join(root, "insights"),
  path.join(root, "ar", "insights")
];

let fixed = 0;
let unchanged = 0;

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".html"))) {
    const filePath = path.join(dir, file);
    const original = fs.readFileSync(filePath, "utf8");
    let updated = original;
    for (const [from, to] of REPLACEMENTS) {
      updated = updated.split(from).join(to);
    }
    if (updated !== original) {
      fs.writeFileSync(filePath, updated, "utf8");
      console.log(`  Fixed: ${path.relative(root, filePath)}`);
      fixed++;
    } else {
      unchanged++;
    }
  }
}

console.log(`\nEncoding fix complete.`);
console.log(`  Fixed: ${fixed}`);
console.log(`  Unchanged: ${unchanged}`);
