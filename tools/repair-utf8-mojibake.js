#!/usr/bin/env node

const fs = require("fs");
const { execFileSync } = require("child_process");

const WINDOWS_1252_BYTES = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

function asWindows1252Bytes(input) {
  return Buffer.from(
    Array.from(input, (char) => {
      const code = char.codePointAt(0);
      return WINDOWS_1252_BYTES.get(code) ?? (code <= 0xff ? code : 0x3f);
    })
  );
}

function decodeMojibakeRun(run) {
  const decoded = asWindows1252Bytes(run).toString("utf8");
  return decoded.includes("\uFFFD") ? run : decoded;
}

function repair(source) {
  const byteChars = "\u0080-\u00ff\u0192\u02c6\u02dc\u20ac\u2018-\u201d\u201a\u201e\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u2122\u0152\u0153\u0160\u0161\u0178\u017d\u017e";
  return source
    .replace(new RegExp(`[\\u00d8\\u00d9][${byteChars}\\u0600-\\u06ffA-Za-z0-9\\s.,;:!?"'()[\\]{}<>\\/\\\\|+=_#$%&*@^-]{1,220}`, "g"), decodeMojibakeRun)
    .replace(new RegExp(`[\\u00c2\\u00c3\\u00f0][${byteChars}A-Za-z0-9\\s.,;:!?"'()[\\]{}<>\\/\\\\|+=_#$%&*@^-]{1,120}`, "g"), decodeMojibakeRun)
    .replace(new RegExp(`\\u00e2[${byteChars}]{1,4}`, "g"), decodeMojibakeRun);
}

const fromHead = process.argv.includes("--from-git-head");
const wholeFile = process.argv.includes("--whole-file");
const files = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

if (!files.length) {
  console.error("Usage: node tools/repair-utf8-mojibake.js <file...>");
  process.exit(1);
}

for (const file of files) {
  const before = fromHead
    ? execFileSync("git", ["show", `HEAD:${file.replace(/\\/g, "/")}`], { encoding: "utf8" })
    : fs.readFileSync(file, "utf8");
  let after = wholeFile ? decodeMojibakeRun(before) : repair(before);
  if (after.charCodeAt(0) === 0xfeff || (after[0] === "?" && ["{", "/", "c"].includes(after[1]))) {
    after = after.slice(1);
  }
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    console.log(`repaired ${file}`);
  } else {
    console.log(`unchanged ${file}`);
  }
}
