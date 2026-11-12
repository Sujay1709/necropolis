#!/usr/bin/env node
// PostFileSave hook: an analyzer file was saved. Check registration and tests.
// Reads the hook context JSON from STDIN. The key that carries the saved path is
// not documented (see docs/kiro-verification.md), so every string value is
// inspected. Exits 0 always: this hook informs, it does not block.
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const root = process.cwd();
let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  // no stdin
}

const paths = new Set();
const walk = (v) => {
  if (typeof v === "string") {
    const m = v.match(/core\/src\/analyzers\/([a-z0-9-]+)\.ts$/);
    if (m && m[1] !== "index") paths.add(v);
  } else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === "object") Object.values(v).forEach(walk);
};
try {
  walk(JSON.parse(raw));
} catch {
  // Non-JSON stdin: fall back to scanning for a path in the text.
  walk(raw.split(/\s+/));
}

if (paths.size === 0) {
  console.log("[analyzer-saved] no analyzer path found in hook input; nothing to check.");
  process.exit(0);
}

const registry = join(root, "core/src/analyzers/index.ts");
const registryText = existsSync(registry) ? readFileSync(registry, "utf8") : "";

for (const p of paths) {
  const name = basename(p, ".ts");
  const findings = [];
  if (!registryText.includes(`./${name}`)) {
    findings.push(`not exported from core/src/analyzers/index.ts (add: export { ${toCamel(name)}Analyzer } from "./${name}.js";)`);
  }
  const test = join(root, `core/test/analyzers/${name}.test.ts`);
  if (!existsSync(test)) findings.push(`missing test file core/test/analyzers/${name}.test.ts`);
  const fixture = join(root, `core/test/fixtures/${name}`);
  if (!existsSync(fixture)) findings.push(`missing fixture directory core/test/fixtures/${name}/`);

  if (findings.length === 0) console.log(`[analyzer-saved] ${name}: registered, tested, fixture present.`);
  else console.log(`[analyzer-saved] ${name}:\n  - ${findings.join("\n  - ")}`);
}

function toCamel(s) {
  return s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}
