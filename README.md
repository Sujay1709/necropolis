<!-- NECROPOLIS — Kiroween 2026, Skeleton Crew -->

# 🪦 NECROPOLIS

> A small shared **core engine** that finds a codebase's **hauntings** and turns
> them into Kiro specs. One skeleton, two apps.

**Kiroween 2026 · Skeleton Crew.** The pitch is *reuse*: a single, well-documented
core drives two very different apps. Both apps differ **only** in which analyzers
they run and how they present the results.

```
Analyzer  ─▶  Haunting (one shared schema)  ─▶  Spec writer
```

---

## ⏱️ 60-second judge path

> **Status (honest):** the **core engine** is implemented and tested. Graveyard
> and Exorcist are scaffolded and in progress — see [Status](#-status). Nothing
> below fakes output; commands that aren't wired yet are marked **TODO**.

**1. Install + prove the core (works today):**
```bash
pnpm install
pnpm -C core test:run      # unit + property tests, fully offline
```

**2. Graveyard — tombstone map of cursed files** *(TODO: wired in Phase 3)*
```bash
# pnpm -C apps/graveyard dev      # open the SVG graveyard for a repo
```

**3. Exorcist — audit a project's .kiro/ folder** *(TODO: wired in Phase 4)*
```bash
# pnpm necropolis exorcist scan .   # haunting score 0–100 (lower is better)
```

Screenshots: `docs/graveyard.png` · `docs/exorcist.png` *(placeholders — TODO)*

---

## 💀 What NECROPOLIS is

A **haunting** is one recurring problem in a codebase. NECROPOLIS detects a fixed,
documented set of them and, instead of handing you a dashboard to interpret,
writes an actionable **Kiro spec** you can hand straight back to Kiro.

Two apps sit on the one core:

- **🪦 GRAVEYARD** (web app) — scans any git repo and draws a **tombstone map**
  of cursed files. Tombstone **height = churn** (commits in the last 90 days),
  **glow = share of bug-fix commits**, **red tint = low test coverage**. Click a
  tombstone to see the evidence and a **Generate Kiro bugfix spec** button that
  writes into the repo's `.kiro/specs/`.
- **🕯️ EXORCIST** (Kiro Crew app + standalone CLI) — audits a project's `.kiro/`
  folder for hauntings: conflicting steering docs, dead/legacy hooks, agent
  resource lists over Kiro's limits, spec drift, legacy configs. Outputs a
  **haunting score 0–100** (lower is better) and writes the fix as a Kiro spec.

### Haunting kinds
| kind | meaning | surfaced by |
|---|---|---|
| `cursed-file` | high-churn, bug-prone, poorly-tested file | Graveyard |
| `steering-conflict` | steering docs that contradict each other | Exorcist |
| `dead-hook` | a hook that can never fire / is legacy | Exorcist |
| `over-budget` | agent exceeds Kiro's resource limits | Exorcist |
| `spec-drift` | task marked done with no matching code | Exorcist |
| `legacy-config` | legacy 2.x config still in the repo | Exorcist |

---

## 🧱 Architecture — one skeleton, two apps

The whole value is that `core/` is **app-agnostic**. Dependencies point **inward
only**: the apps know about the core; the core never knows an app exists.

```
          ┌───────────────────────────────────────────────┐
          │                     core/                      │
          │  Haunting schema · Analyzer contract · Registry │
          │          scoring · spec writer                  │
          │   (pure TypeScript, Node built-ins only)        │
          └───────────────────────────────────────────────┘
                 ▲                 ▲                 ▲
                 │ imports         │ imports         │ imports
        ┌────────┴──────┐  ┌───────┴───────┐  ┌──────┴──────┐
        │ apps/graveyard│  │ apps/exorcist │  │     mcp/     │
        │  (web · SVG)  │  │ (Crew app+CLI)│  │ (optional)   │
        └───────────────┘  └───────────────┘  └─────────────┘
```

Each app contributes value only by **(a)** choosing which analyzers to register
and **(b)** presenting the resulting `Haunting[]`. Graveyard draws them; Exorcist
scores and reports them. Neither forks the pipeline. If a change ever needs
`core/` to import an app, the design is wrong — the shared piece belongs in the
core. (See `.kiro/steering/structure.md`.)

### The pipeline, concretely

```ts
import { createRegistry, score, writeSpec } from "@necropolis/core";

const registry = createRegistry([ /* app chooses its analyzers */ ]);
const { hauntings, errors } = await registry.run({ rootDir: "." });

const haunting = score(hauntings);          // 0..100, lower is better
await writeSpec(hauntings, ".");            // -> .kiro/specs/<slug>/
```

### Core contract
```ts
type HauntingKind =
  | "cursed-file" | "steering-conflict" | "dead-hook"
  | "over-budget" | "spec-drift" | "legacy-config";

interface Haunting {
  id: string;            // stable hash of {analyzer, kind, subject}
  kind: HauntingKind;
  severity: number;      // [0,1]
  subject: string;       // path
  evidence: string[];
  suggestedFix: string;
  analyzer: string;
}

interface Analyzer {
  name: string;
  analyze(ctx: { rootDir: string }): Promise<Haunting[]>;
}
```

- **Registry** runs analyzers over one root, isolates per-analyzer failures,
  validates every haunting, and returns a **deterministically ordered** list
  (sorted by `kind` → `subject` → `id`).
- **Scoring** is deterministic, documented, and **monotonic**: adding a haunting
  or raising any severity never lowers the score. *(TODO: `score()` lands in
  task 6.)*
- **Spec writer** turns a haunting (or group) into
  `.kiro/specs/<slug>/{requirements.md, design.md, tasks.md}` using EARS-style
  requirements, bugfix framing for cursed files. Every `subject` path is
  preserved verbatim so no finding loses its location. *(TODO: task 8.)*

---

## 🎨 Design language

NECROPOLIS is a graveyard you can read at a glance. The aesthetic is
**moonlit cemetery**: calm, dark, and legible — scary in theme, never in UX.

**Palette (SVG, hand-rolled — no chart library):**

| token | hex | use |
|---|---|---|
| `--necro-night` | `#0b0f14` | background / sky |
| `--necro-stone` | `#8a93a6` | tombstone base |
| `--necro-fog` | `#c9d1e0` | text, outlines |
| `--necro-glow` | `#7cfffb` | bug-fix glow (churn of fixes) |
| `--necro-curse` | `#ff4d5e` | red tint = low coverage |
| `--necro-moss` | `#4ad17a` | healthy / calm files |

**Visual grammar (Graveyard):**
- **Tombstone height** encodes churn — taller stone = more recent commits.
- **Glow radius/intensity** encodes the bug-fix-commit share — the more a file is
  patched for bugs, the more it haunts.
- **Red tint** encodes low test coverage — the redder, the more exposed.
- **Fog + moonlight** are ambient only; they carry no data (honesty rule: never
  imply signal that isn't there).

**Voice:** spooky nouns, plain verbs. We say *haunting*, *cursed file*,
*exorcise* — but every label resolves to a concrete, checkable fact
(“12 commits in 90 days, 7 contain ‘fix’”). The theme decorates the data; it
never replaces it.

**Typography:** a single display face for headings (tombstone-engraved feel) and
a monospace for evidence/code. Everything degrades gracefully to system fonts.

> Full visual spec and tokens live with the app in Phase 3
> (`apps/graveyard/`). This section is the shared north star.

---

## 📁 Repository layout

```
.kiro/
  steering/      product.md · tech.md · structure.md   (the rules, committed & judged)
  specs/         core-engine/ (requirements · design · tasks)
  hooks/         offline-test · core-guard
  agents/        spec-writer · reviewer
core/            analyzer contract · Haunting schema · scoring · spec writer
apps/
  graveyard/     web app (Vite + React + SVG) — static deploy
  exorcist/      Crew app (app.json · agents · skills) + CLI
mcp/             optional, last: MCP server exposing core to Kiro
examples/
  sample-repo/   generator: a small repo with seeded git history (reproducible demos)
LICENSE · README.md
```

---

## 🛠️ Tech & rules

- **TypeScript (strict) · Node 22 · pnpm workspaces.** Vitest + **fast-check**
  (property-based tests). Few dependencies by design — `core/` has **zero**
  runtime deps (hashing via `node:crypto`).
- **Graveyard:** Vite + React + hand-written SVG, deployable as a **static site**.
- **Exorcist:** Kiro Crew app **and** a standalone CLI.
- **Everything runs offline.** No network calls in any analyzer.
- **New code only, MIT licensed, public-repo ready.**
- **`.kiro/` is committed, never gitignored** — it's part of the submission.
- **We don't invent Kiro facts.** Every `.kiro` file, hook, agent, and Crew
  manifest is written against the current docs at
  [kiro.dev/docs](https://kiro.dev/docs); anything unverified is marked **TODO**,
  never guessed.

```bash
pnpm install          # install workspace deps
pnpm -C core test:run # run the core suite (offline)
pnpm -C core build    # emit dist/
```

---

## 📊 Status

| component | state |
|---|---|
| Kiro setup (steering, hooks, agents) | ✅ done |
| Core spec (`.kiro/specs/core-engine`) | ✅ done |
| Core: schema · ids/slugs · analyzer contract · registry | ✅ done, tested |
| Core: scoring | 🔜 task 6 |
| Core: spec writer + property tests | 🔜 tasks 7–9 |
| Sample-repo generator | 🔜 task 11 |
| Graveyard (web) | ⏳ Phase 3 |
| Exorcist (Crew app + CLI) | ⏳ Phase 4 |
| MCP server | ⏳ optional, last |

**Kill switch (Nov 20):** if the core + a deployed Graveyard aren't working, we
drop Exorcist and ship a single, honest app. We'd rather ship less that works
than more that doesn't.

---

## 📜 License

[MIT](./LICENSE) © 2026 NECROPOLIS contributors.
