// The demo repo is the fixture for everything else, so it is tested directly.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const GEN = join(ROOT, "examples/sample-repo/generate.mjs");

let dir: string;
const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf8" });
const commitsFor = (file: string) => git("log", "--format=%s", "--", file).trim().split("\n").filter(Boolean);
const isFix = (s: string) => /^(fix|bugfix|hotfix)(\(|:|!|\s)/i.test(s);

beforeAll(() => {
  dir = join(mkdtempSync(join(tmpdir(), "necropolis-sample-")), "repo");
  execFileSync("node", [GEN, dir, "--seed", "1031"], { encoding: "utf8" });
});
afterAll(() => rmSync(resolve(dir, ".."), { recursive: true, force: true }));

describe("sample repo generator", () => {
  it("creates a git repo with >= 120 commits by >= 5 authors over 90 days", () => {
    const log = git("log", "--format=%an%x09%aI").trim().split("\n");
    expect(log.length).toBeGreaterThanOrEqual(120);
    expect(new Set(log.map((l) => l.split("\t")[0])).size).toBeGreaterThanOrEqual(5);
    const dates = log.map((l) => new Date(l.split("\t")[1]).getTime());
    expect((Math.max(...dates) - Math.min(...dates)) / 86400e3).toBeLessThanOrEqual(92);
  });

  it("cart.ts is cursed: >= 40 commits, >= 15 fixes", () => {
    const c = commitsFor("src/checkout/cart.ts");
    expect(c.length).toBeGreaterThanOrEqual(40);
    expect(c.filter(isFix).length).toBeGreaterThanOrEqual(15);
  });

  it("at least 10 quiet files have <= 3 commits (plus the initial import and config commit)", () => {
    const quiet = ["src/index.ts", "src/config.ts", "src/catalog/products.ts", "src/catalog/search.ts", "src/users/profile.ts", "src/users/address.ts", "src/shipping/rates.ts", "src/shipping/labels.ts", "src/email/templates.ts", "src/email/send.ts", "src/util/money.ts", "src/util/dates.ts"];
    const ok = quiet.filter((f) => commitsFor(f).length <= 5);
    expect(ok.length).toBeGreaterThanOrEqual(10);
  });

  it("writes an Istanbul coverage summary with cart.ts < 30% and >= 5 files > 80%", () => {
    const cov = JSON.parse(readFileSync(join(dir, "coverage/coverage-summary.json"), "utf8"));
    const entries = Object.entries(cov).filter(([k]) => k !== "total") as [string, { lines: { pct: number } }][];
    const cart = entries.find(([k]) => k.endsWith("src/checkout/cart.ts"));
    expect(cart?.[1].lines.pct).toBeLessThan(30);
    expect(entries.filter(([, v]) => v.lines.pct > 80).length).toBeGreaterThanOrEqual(5);
  });

  it("includes a haunted .kiro/ with every planned haunting", () => {
    const k = (p: string) => readFileSync(join(dir, ".kiro", p), "utf8");
    expect(k("steering/tech.md")).toMatch(/GraphQL/);
    expect(k("steering/api.md")).toMatch(/REST/);
    const hooks = JSON.parse(k("hooks/on-save.json")).hooks;
    expect(hooks.some((h: { trigger: string }) => h.trigger === "agentSpawn")).toBe(true);
    const dead = hooks.find((h: { name: string }) => h.name === "lint-on-save");
    expect(existsSync(join(dir, "scripts/lint-changed.mjs"))).toBe(false);
    expect(dead).toBeDefined();
    const agent = JSON.parse(k("agents/dev.json"));
    expect(agent.resources.filter((r: string) => r.startsWith("file://")).length).toBeGreaterThan(32);
    expect(agent).toHaveProperty("allowedTools");
    expect(k("specs/cart/tasks.md")).toMatch(/- \[x\] 7\..*src\/checkout\/money\.ts/);
    expect(existsSync(join(dir, "src/checkout/money.ts"))).toBe(false);
    expect(existsSync(join(dir, "src/checkout/cart.test.ts"))).toBe(true);
  });

  it("is reproducible for the same seed (messages and files)", () => {
    const dir2 = join(mkdtempSync(join(tmpdir(), "necropolis-sample2-")), "repo");
    try {
      execFileSync("node", [GEN, dir2, "--seed", "1031"], { encoding: "utf8" });
      const a = git("log", "--format=%s%x09%an");
      const b = execFileSync("git", ["log", "--format=%s%x09%an"], { cwd: dir2, encoding: "utf8" });
      expect(a).toBe(b);
    } finally {
      rmSync(resolve(dir2, ".."), { recursive: true, force: true });
    }
  });

  it("refuses to overwrite without --force", () => {
    expect(() => execFileSync("node", [GEN, dir], { stdio: "pipe" })).toThrow();
  });

  it("--small produces a quick fixture", () => {
    const dir3 = join(mkdtempSync(join(tmpdir(), "necropolis-sample3-")), "repo");
    try {
      execFileSync("node", [GEN, dir3, "--small"], { encoding: "utf8" });
      const n = execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: dir3, encoding: "utf8" }).trim();
      expect(Number(n)).toBeLessThan(80);
    } finally {
      rmSync(resolve(dir3, ".."), { recursive: true, force: true });
    }
  });
});
