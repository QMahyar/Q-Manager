#!/usr/bin/env node
/**
 * sync-version.cjs
 * Single-source versioning: reads version from package.json and writes it
 * to src-tauri/tauri.conf.json and src-tauri/Cargo.toml automatically.
 *
 * Usage:
 *   node scripts/sync-version.cjs              # sync current version
 *   node scripts/sync-version.cjs 1.2.3        # set new version everywhere
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

// ── 1. Read source of truth ──────────────────────────────────────────────────
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

// If a version argument is provided, update package.json first
const newVersion = process.argv[2];
if (newVersion) {
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(newVersion)) {
    console.error(`Invalid version: "${newVersion}". Expected semver e.g. 1.2.3`);
    process.exit(1);
  }
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`✔ package.json         → ${newVersion}`);
}

const version = pkg.version;

// ── 2. Sync tauri.conf.json ───────────────────────────────────────────────────
const tauriConfPath = path.join(root, "src-tauri", "tauri.conf.json");
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
const oldTauriVersion = tauriConf.version;
tauriConf.version = version;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
console.log(`✔ tauri.conf.json      → ${version}${oldTauriVersion !== version ? ` (was ${oldTauriVersion})` : ""}`);

// ── 3. Sync Cargo.toml ────────────────────────────────────────────────────────
const cargoPath = path.join(root, "src-tauri", "Cargo.toml");
let cargoContent = fs.readFileSync(cargoPath, "utf8");

// Match the [package] section's version = "x.y.z" line only
// Uses a state machine approach to only replace the first version under [package]
const lines = cargoContent.split("\n");
let inPackage = false;
let replaced = false;
const updatedLines = lines.map((line) => {
  if (/^\[package\]/.test(line)) { inPackage = true; return line; }
  if (/^\[/.test(line) && !/^\[package\]/.test(line)) { inPackage = false; return line; }
  if (inPackage && !replaced && /^version\s*=/.test(line)) {
    replaced = true;
    const oldMatch = line.match(/"([^"]+)"/);
    const old = oldMatch ? oldMatch[1] : "?";
    console.log(`✔ Cargo.toml           → ${version}${old !== version ? ` (was ${old})` : ""}`);
    return `version = "${version}"`;
  }
  return line;
});

fs.writeFileSync(cargoPath, updatedLines.join("\n"));

console.log(`\n✅ All files synced to v${version}`);
