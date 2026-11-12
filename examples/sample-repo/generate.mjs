#!/usr/bin/env node
// Generates a demo git repository with seeded history, a coverage summary, and a
// deliberately haunted .kiro/ folder. Used by Graveyard, Exorcist, and tests.
//
//   node examples/sample-repo/generate.mjs <outDir> [--force] [--small] [--seed N]
//
// Deterministic for a given seed (commit hashes differ because of timestamps,
// but messages, files, authors, and coverage numbers are identical).
// No dependencies. Requires the `git` binary.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const args = process.argv.slice(2);
const outArg = args.find((a) => !a.startsWith("--"));
if (!outArg) {
  console.error("usage: generate.mjs <outDir> [--force] [--small] [--seed N]");
  process.exit(2);
}
const out = resolve(outArg);
const force = args.includes("--force");
const small = args.includes("--small");
const seedIdx = args.indexOf("--seed");
const seed = seedIdx >= 0 ? Number(args[seedIdx + 1]) : 1031;

if (existsSync(out)) {
  if (!force) {
    console.error(`refusing to overwrite ${out} (pass --force)`);
    process.exit(1);
  }
  rmSync(out, { recursive: true, force: true });
}
mkdirSync(out, { recursive: true });

// ---------- seeded PRNG (mulberry32) ----------
let s = seed >>> 0;
const rand = () => {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// ---------- plan ----------
const AUTHORS = ["Ada Lovelace", "Grace Hopper", "Linus Torvalds", "Margaret Hamilton", "Ken Thompson", "Barbara Liskov"];
const scale = small ? 0.25 : 1;
const n = (x) => Math.max(1, Math.round(x * scale));

// [file, commits, fixes]
const HOT = [
  ["src/checkout/cart.ts", n(47), n(19)],
  ["src/auth/session.ts", n(30), n(12)],
  ["src/pricing/pricing.ts", n(22), n(9)],
  ["src/orders/orders.ts", n(18), n(6)],
];
const QUIET = [
  "src/index.ts", "src/config.ts", "src/catalog/products.ts", "src/catalog/search.ts", "src/users/profile.ts",
  "src/users/address.ts", "src/shipping/rates.ts", "src/shipping/labels.ts", "src/email/templates.ts",
  "src/email/send.ts", "src/util/money.ts", "src/util/dates.ts", "README.md", "package.json",
];
const FIX_MSGS = [
  "fix: cart total drifts when discount applied twice",
  "fix(cart): rounding error on multi-item totals",
  "hotfix: negative quantity accepted",
  "fix: session expires early after refresh",
  "fix(pricing): tax computed before discount",
  "fix: orders duplicated on retry (#412)",
  "bugfix: NaN total when price missing",
  "fix: off-by-one in pagination",
];
const FEAT_MSGS = [
  "feat: add coupon support", "refactor: extract helper", "chore: tidy imports", "feat: support gift cards",
  "docs: explain flow", "perf: memoize lookup", "feat: add currency field", "style: rename variables",
];

// Each commit: { file, msg }
const commits = [];
for (const [file, total, fixes] of HOT) {
  for (let i = 0; i < total; i++) commits.push({ file, msg: i < fixes ? pick(FIX_MSGS) : pick(FEAT_MSGS) });
}
for (const file of QUIET) {
  const c = 1 + Math.floor(rand() * 3); // 1..3
  for (let i = 0; i < c; i++) commits.push({ file, msg: pick(FEAT_MSGS) });
}
// shuffle deterministically
for (let i = commits.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [commits[i], commits[j]] = [commits[j], commits[i]];
}

// ---------- git helpers ----------
const git = (argv, env = {}) =>
  execFileSync("git", argv, { cwd: out, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } }).toString();

git(["init", "-q", "-b", "main"]);
git(["config", "user.name", "Necropolis Generator"]);
git(["config", "user.email", "generator@necropolis.local"]);
git(["config", "commit.gpgsign", "false"]);

const writeIn = (rel, content) => {
  const p = join(out, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
};

// Initial commit with every file present, dated at the start of the window.
const DAYS = 90;
const end = new Date("2026-11-11T12:00:00Z");
const start = new Date(end.getTime() - DAYS * 86400e3);
const allFiles = [...HOT.map((h) => h[0]), ...QUIET];
for (const f of allFiles) writeIn(f, `// ${f}\nexport const name = "${f}";\n`);
writeIn(".gitignore", "node_modules/\ncoverage/\n");
const commitAt = (msg, author, when) => {
  const date = when.toISOString();
  git(["add", "-A"]);
  git(["commit", "-q", "-m", msg, "--author", `${author} <${author.toLowerCase().replace(/\s+/g, ".")}@example.com>`], {
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  });
};
commitAt("chore: initial import", AUTHORS[0], new Date(start.getTime() - 86400e3));

// Spread commits evenly across the window, oldest first.
commits.forEach((c, i) => {
  const when = new Date(start.getTime() + ((i + 1) / (commits.length + 1)) * (end.getTime() - start.getTime()));
  const line = `// change ${i}: ${c.msg}\n`;
  writeIn(c.file, `${readOr(c.file)}${line}`);
  commitAt(c.msg, pick(AUTHORS), when);
});

function readOr(rel) {
  try {
    return readFileSync(join(out, rel), "utf8");
  } catch {
    return "";
  }
}

// ---------- coverage summary (Istanbul JSON summary shape) ----------
const cov = { total: { lines: { total: 1000, covered: 640, skipped: 0, pct: 64 } } };
const pcts = {
  "src/checkout/cart.ts": 23, "src/auth/session.ts": 41, "src/pricing/pricing.ts": 58, "src/orders/orders.ts": 37,
  "src/index.ts": 95, "src/config.ts": 100, "src/catalog/products.ts": 88, "src/catalog/search.ts": 83,
  "src/users/profile.ts": 91, "src/users/address.ts": 86, "src/shipping/rates.ts": 72, "src/shipping/labels.ts": 69,
  "src/email/templates.ts": 90, "src/email/send.ts": 77, "src/util/money.ts": 97, "src/util/dates.ts": 94,
};
for (const [f, pct] of Object.entries(pcts)) {
  const total = 100;
  cov[join(out, f)] = { lines: { total, covered: pct, skipped: 0, pct }, statements: { total, covered: pct, skipped: 0, pct }, functions: { total: 10, covered: Math.round(pct / 10), skipped: 0, pct }, branches: { total: 20, covered: Math.round(pct / 5), skipped: 0, pct } };
}
writeIn("coverage/coverage-summary.json", JSON.stringify(cov, null, 2));

// ---------- haunted .kiro/ ----------
writeIn(".kiro/steering/tech.md", `---\ninclusion: always\n---\n# Tech\n\nAll APIs use GraphQL. Do not add REST endpoints.\n`);
writeIn(".kiro/steering/api.md", `---\ninclusion: always\n---\n# API conventions\n\nAll APIs are REST. Do not add GraphQL.\n`);
writeIn(".kiro/steering/product.md", `# Product\n\nacme-shop is a demo storefront used by Necropolis as a sample repository.\n`);
// legacy trigger name (CLI 2.x) and a dead command
writeIn(".kiro/hooks/on-save.json", JSON.stringify({
  version: "v1",
  hooks: [
    { name: "greet", trigger: "agentSpawn", action: { type: "command", command: "echo hello" } },
    { name: "lint-on-save", trigger: "PostFileSave", matcher: "src/.*\\.ts$", action: { type: "command", command: "node scripts/lint-changed.mjs" } },
  ],
}, null, 2));
// over-budget agent with a legacy field
const resources = Array.from({ length: 44 }, (_, i) => `file://docs/notes-${String(i + 1).padStart(2, "0")}.md`);
for (let i = 1; i <= 44; i++) writeIn(`docs/notes-${String(i).padStart(2, "0")}.md`, `# note ${i}\n`);
writeIn(".kiro/agents/dev.json", JSON.stringify({
  name: "dev", description: "Legacy dev agent", prompt: "You are the dev agent.",
  tools: ["read", "write", "shell"], allowedTools: ["fs_read", "fs_write"], resources,
}, null, 2));
// spec drift: a task marked done naming a file that does not exist
writeIn(".kiro/specs/cart/requirements.md", `# Requirements Document\n\n### Requirement 1\n\n**User Story:** As a shopper, I want correct totals, so that I am charged the right amount.\n\n#### Acceptance Criteria\n\n1. WHEN a discount is applied THEN the system SHALL round once at the total.\n`);
writeIn(".kiro/specs/cart/design.md", `# Design Document\n\n## Overview\n\nRounding is centralized in a money helper.\n`);
writeIn(".kiro/specs/cart/tasks.md", `# Implementation Plan\n\n- [x] 1. Add a failing test in \`src/checkout/cart.test.ts\`\n  - _Requirements: 1.1_\n\n- [x] 7. Add rounding helper in \`src/checkout/money.ts\`\n  - _Requirements: 1.1_\n\n- [ ] 8. Use the helper from \`src/checkout/cart.ts\`\n  - _Requirements: 1.1_\n`);
writeIn("src/checkout/cart.test.ts", `// exists so task 1 is genuinely done\n`);
commitAt("chore: add kiro config and coverage report", AUTHORS[1], end);

console.log(`sample repo written to ${out}: ${commits.length + 2} commits, ${allFiles.length} source files, haunted .kiro/ included`);
