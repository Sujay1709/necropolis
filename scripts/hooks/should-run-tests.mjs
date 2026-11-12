#!/usr/bin/env node
// confirmCommand for the Stop hook. Prints {"skip": true} when nothing under a
// code directory changed in the working tree, so the prompt only appears when
// tests could plausibly have been affected. On any error, print nothing and let
// the hook fall back to its static question.
import { execSync } from "node:child_process";

try {
  const out = execSync("git status --porcelain", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const touched = out
    .split("\n")
    .map((l) => l.slice(3).trim())
    .filter(Boolean)
    .some((p) => /^(core|apps|mcp|scripts|tests|examples)\//.test(p));
  if (!touched) process.stdout.write(JSON.stringify({ skip: true }));
} catch {
  // not a git repo or git missing: fall back to the static prompt
}
