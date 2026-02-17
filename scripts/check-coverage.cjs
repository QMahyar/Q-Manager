const fs = require("fs");
const path = require("path");

const minLines = Number(process.env.COVERAGE_MIN_LINES || 0);
const coveragePath = path.resolve(process.cwd(), "coverage", "coverage-summary.json");

if (Number.isNaN(minLines)) {
  console.error("COVERAGE_MIN_LINES must be a number");
  process.exit(1);
}

if (!fs.existsSync(coveragePath)) {
  console.error(`Coverage summary not found at ${coveragePath}`);
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(coveragePath, "utf8"));
const pct = summary.total?.lines?.pct ?? 0;

if (pct < minLines) {
  console.error(`Coverage ${pct}% is below required minimum ${minLines}%`);
  process.exit(1);
}

console.log(`Coverage ${pct}% meets required minimum ${minLines}%`);
