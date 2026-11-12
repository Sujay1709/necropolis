// Every spec under .kiro/specs must be mechanically well-formed: EARS criteria,
// tasks that name files and cite requirements that exist. This is also the
// contract Exorcist's spec-drift analyzer relies on.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SPECS = join(ROOT, ".kiro", "specs");
const EARS = /^\d+\. (WHEN|IF|WHILE) .+\bSHALL\b.+$/;

const specDirs = readdirSync(SPECS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

describe(".kiro/specs", () => {
  it("has the core-engine spec", () => expect(specDirs).toContain("core-engine"));

  for (const name of specDirs) {
    describe(name, () => {
      const dir = join(SPECS, name);
      const isBugfix = existsSync(join(dir, "bugfix.md"));
      const reqFile = isBugfix ? "bugfix.md" : "requirements.md";
      const req = readFileSync(join(dir, reqFile), "utf8");
      const design = readFileSync(join(dir, "design.md"), "utf8");
      const tasks = readFileSync(join(dir, "tasks.md"), "utf8");

      it("has the three files", () => {
        for (const f of [reqFile, "design.md", "tasks.md"]) expect(existsSync(join(dir, f)), f).toBe(true);
      });

      // Requirement ids like "3.4" = requirement 3, criterion 4.
      const reqIds = new Set<string>();
      if (!isBugfix) {
        const sections = req.split(/^### Requirement (\d+)/m);
        it("has at least one requirement with a user story", () => expect(sections.length).toBeGreaterThan(1));
        for (let i = 1; i < sections.length; i += 2) {
          const num = sections[i];
          const body = sections[i + 1];
          it(`requirement ${num} has a user story and EARS criteria`, () => {
            expect(body).toMatch(/\*\*User Story:\*\*/);
            const critBlock = body.split("#### Acceptance Criteria")[1] ?? "";
            const lines = critBlock.split("\n").map((l) => l.trim()).filter((l) => /^\d+\./.test(l));
            expect(lines.length, "no criteria").toBeGreaterThan(0);
            for (const l of lines) {
              expect(l, `not EARS: ${l}`).toMatch(EARS);
              reqIds.add(`${num}.${l.match(/^(\d+)\./)![1]}`);
            }
          });
        }
      } else {
        it("bugfix.md has current / expected / unchanged behavior", () => {
          for (const h of ["Current behavior", "Expected behavior", "Unchanged behavior"]) expect(req).toMatch(new RegExp(h, "i"));
        });
      }

      it("design.md covers the required sections", () => {
        for (const h of ["Overview", "Architecture", "Components", "Error Handling", "Testing Strategy"]) {
          expect(design, `missing ## ${h}`).toMatch(new RegExp(`^## .*${h}`, "m"));
        }
      });

      const taskBlocks = tasks.split(/^(?=- \[[ x]\] \d+\. )/m).filter((b) => /^- \[[ x]\] \d+\. /.test(b));
      it("has tasks in checkbox form", () => expect(taskBlocks.length).toBeGreaterThan(0));
      for (const block of taskBlocks) {
        const title = block.split("\n")[0];
        it(`${title.slice(0, 60)}: names a file and cites existing requirements`, () => {
          expect(block, "task names no file path").toMatch(/`[\w./-]+\.(ts|tsx|mjs|md|json)`/);
          const cite = block.match(/_Requirements: ([^_]+)_/);
          expect(cite, "missing _Requirements:_ trailer").not.toBeNull();
          if (!isBugfix) {
            for (const id of cite![1].split(",").map((s) => s.trim())) expect(reqIds.has(id), `unknown requirement ${id}`).toBe(true);
          }
        });
      }

      it("task numbers are unique", () => {
        const nums = taskBlocks.map((b) => b.match(/^- \[[ x]\] (\d+)\./)![1]);
        expect(new Set(nums).size).toBe(nums.length);
      });

      it("completed tasks [x] name files that exist (no spec drift)", () => {
        for (const block of taskBlocks.filter((b) => b.startsWith("- [x]"))) {
          for (const m of block.matchAll(/`([\w./-]+\.(?:ts|tsx|mjs|md|json))`/g)) {
            expect(existsSync(join(ROOT, m[1])), `task done but ${m[1]} missing`).toBe(true);
          }
        }
      });
    });
  }
});
