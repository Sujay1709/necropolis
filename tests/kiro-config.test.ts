// Keeps .kiro/ valid against the facts in docs/kiro-verification.md.
// If Kiro changes a format, update that doc first, then this test.
import { describe, expect, it } from "vitest";
import { existsSync, globSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

const ROOT = resolve(__dirname, "..");
const KIRO = join(ROOT, ".kiro");

// Verified PascalCase trigger names (docs/kiro-verification.md, Hooks row).
const VERIFIED_TRIGGERS = new Set(["SessionStart", "SessionEnd", "PreToolUse", "PostToolUse", "PostFileSave", "Stop", "PreCompact", "PostCompact"]);
const LEGACY_TRIGGERS = new Set(["agentSpawn", "AgentSpawn", "preToolUse", "postToolUse", "userTriggered"]);
const LEGACY_AGENT_FIELDS = ["allowedTools", "toolsSettings", "toolAliases", "keyboardShortcut"];
const TOOL_TAGS = new Set(["read", "write", "shell", "web", "subagent", "*", "@mcp", "@builtin"]);
const CAPABILITIES = new Set(["fs_read", "fs_write", "shell", "web_fetch", "web_search", "mcp", "subagent", "skill", "power", "context", "diagnostics", "sandbox_network", "all", "builtin", "filesystem"]);

const jsonFiles = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => join(dir, f)) : []);
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));

describe(".kiro/hooks", () => {
  const files = jsonFiles(join(KIRO, "hooks"));
  it("has at least one hook file", () => expect(files.length).toBeGreaterThan(0));

  for (const file of files) {
    describe(file.replace(ROOT, "."), () => {
      const doc = readJson(file);
      it('is a {"version":"v1","hooks":[...]} wrapper', () => {
        expect(doc.version).toBe("v1");
        expect(Array.isArray(doc.hooks)).toBe(true);
        expect(doc.hooks.length).toBeGreaterThan(0);
      });
      for (const hook of doc.hooks) {
        describe(`hook ${hook.name}`, () => {
          it("has required fields", () => {
            expect(typeof hook.name).toBe("string");
            expect(typeof hook.trigger).toBe("string");
            expect(hook.action && typeof hook.action).toBe("object");
          });
          it("uses a verified PascalCase trigger, never a CLI 2.x name", () => {
            expect(LEGACY_TRIGGERS.has(hook.trigger)).toBe(false);
            expect(VERIFIED_TRIGGERS.has(hook.trigger)).toBe(true);
          });
          it("has a well-formed action", () => {
            expect(["command", "agent"]).toContain(hook.action.type);
            if (hook.action.type === "command") expect(typeof hook.action.command).toBe("string");
            if (hook.action.type === "agent") expect(typeof hook.action.prompt).toBe("string");
          });
          it("timeout is in seconds, not milliseconds", () => {
            if (hook.timeout !== undefined) {
              expect(Number.isInteger(hook.timeout)).toBe(true);
              expect(hook.timeout).toBeLessThanOrEqual(600);
            }
          });
          it("only uses confirm on Stop command hooks", () => {
            if (hook.confirm) {
              expect(hook.trigger).toBe("Stop");
              expect(hook.action.type).toBe("command");
              expect(typeof hook.confirm.question).toBe("string");
              for (const o of hook.confirm.options) {
                expect(typeof o.id).toBe("string");
                expect(typeof o.label).toBe("string");
                expect(typeof o.run).toBe("boolean");
              }
            }
          });
          it("matcher is a valid regex when present", () => {
            if (hook.matcher !== undefined) expect(() => new RegExp(hook.matcher)).not.toThrow();
          });
          it("local scripts it runs exist", () => {
            const cmds = [hook.action.command, hook.confirm?.confirmCommand].filter(Boolean) as string[];
            for (const c of cmds) {
              const m = c.match(/\b(scripts\/[\w./-]+\.mjs)\b/);
              if (m) expect(existsSync(join(ROOT, m[1]))).toBe(true);
            }
          });
        });
      }
    });
  }
});

describe(".kiro/agents", () => {
  const files = jsonFiles(join(KIRO, "agents"));
  it("has at least two custom agents", () => expect(files.length).toBeGreaterThanOrEqual(2));

  for (const file of files) {
    describe(file.replace(ROOT, "."), () => {
      const agent = readJson(file);
      it("name matches filename", () => {
        expect(agent.name).toBe(file.split("/").pop()!.replace(/\.json$/, ""));
      });
      it("has no CLI 2.x legacy fields", () => {
        for (const f of LEGACY_AGENT_FIELDS) expect(agent, `legacy field ${f}`).not.toHaveProperty(f);
      });
      it("prompt file:// resolves relative to the config", () => {
        if (typeof agent.prompt === "string" && agent.prompt.startsWith("file://")) {
          const rel = agent.prompt.slice("file://".length);
          expect(existsSync(resolve(dirname(file), rel))).toBe(true);
        }
      });
      it("tools use documented selectors", () => {
        for (const t of agent.tools ?? []) {
          const ok = TOOL_TAGS.has(t) || t.startsWith("@") || /^[a-z_]+$/.test(t);
          expect(ok, `tool selector ${t}`).toBe(true);
        }
      });
      it("permission rules use documented capabilities and effects", () => {
        for (const r of agent.permissions?.rules ?? []) {
          expect(CAPABILITIES.has(r.capability), `capability ${r.capability}`).toBe(true);
          expect(["allow", "ask", "deny"]).toContain(r.effect);
          expect(Array.isArray(r.match)).toBe(true);
        }
      });
      it("stays under the 32-file / 100K-char resource limits and every file:// matches something", () => {
        const fileRes = (agent.resources ?? []).filter((r: unknown) => typeof r === "string" && (r as string).startsWith("file://")) as string[];
        expect(fileRes.length).toBeLessThanOrEqual(32);
        let total = 0;
        for (const r of fileRes) {
          const pattern = r.slice("file://".length);
          const matches = globSync(pattern, { cwd: ROOT });
          expect(matches.length, `no file matches ${r}`).toBeGreaterThan(0);
          for (const m of matches) total += Math.min(50_000, readFileSync(join(ROOT, m), "utf8").length);
        }
        expect(total).toBeLessThanOrEqual(100_000);
      });
    });
  }
});

describe(".kiro/steering", () => {
  const dir = join(KIRO, "steering");
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  it("has the three default files", () => {
    for (const f of ["product.md", "tech.md", "structure.md"]) expect(files).toContain(f);
  });
  for (const f of files) {
    it(`${f}: front matter, if any, is first and uses a documented inclusion mode`, () => {
      const text = readFileSync(join(dir, f), "utf8");
      if (text.includes("\n---\n") || text.startsWith("---")) {
        expect(text.startsWith("---\n")).toBe(true);
        const fm = text.split("\n---\n")[0];
        const mode = fm.match(/inclusion:\s*(\w+)/)?.[1];
        expect(["always", "fileMatch", "manual", "auto"]).toContain(mode);
        if (mode === "fileMatch") expect(fm).toMatch(/fileMatchPattern:/);
        if (mode === "auto") expect(fm).toMatch(/description:/);
      }
    });
    it(`${f}: #[[file:...]] references resolve`, () => {
      const text = readFileSync(join(dir, f), "utf8");
      for (const m of text.matchAll(/#\[\[file:([^\]]+)\]\]/g)) expect(existsSync(join(ROOT, m[1])), m[1]).toBe(true);
    });
    it(`${f}: contains no secrets`, () => {
      const text = readFileSync(join(dir, f), "utf8");
      expect(text).not.toMatch(/(api[_-]?key|secret|token)\s*[:=]\s*["']?[A-Za-z0-9_\-]{16,}/i);
    });
  }
});

describe("agent prompts", () => {
  it("#[[file:...]] references in prompts resolve", () => {
    for (const p of globSync(".kiro/agents/prompts/*.md", { cwd: ROOT })) {
      const text = readFileSync(join(ROOT, p), "utf8");
      for (const m of text.matchAll(/#\[\[file:([^\]]+)\]\]/g)) expect(existsSync(join(ROOT, m[1])), `${p}: ${m[1]}`).toBe(true);
    }
  });
});

describe("repo hygiene", () => {
  it(".kiro is not gitignored", () => {
    const gi = readFileSync(join(ROOT, ".gitignore"), "utf8");
    const active = gi.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
    expect(active.some((l) => /^\/?\.kiro\/?$/.test(l.trim()))).toBe(false);
  });
  it("has an MIT LICENSE", () => {
    expect(readFileSync(join(ROOT, "LICENSE"), "utf8")).toMatch(/MIT License/);
  });
});
