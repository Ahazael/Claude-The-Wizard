#!/usr/bin/env node
// Control CLI for Claude The Wizard.
// Usage:
//   node wizard.mjs on               enable the finish sound
//   node wizard.mjs off              disable the finish sound
//   node wizard.mjs volume <0-100>   set volume (previews at the new level)
//   node wizard.mjs status           show current state
//   node wizard.mjs test             play a test cast now
//
// State lives in ~/.claude/claude-the-wizard/ so it is shared by the local
// install and the marketplace plugin, and takes effect immediately.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { homedir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const controlDir = join(homedir(), ".claude", "claude-the-wizard");
const disabledFile = join(controlDir, "disabled");
const volumeFile = join(controlDir, "volume");

const ensureDir = () => mkdirSync(controlDir, { recursive: true });

function currentVolume() {
  try {
    if (existsSync(volumeFile)) {
      const n = parseInt(readFileSync(volumeFile, "utf8").trim(), 10);
      if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
    }
  } catch {}
  const e = parseInt(process.env.CLAUDE_WIZARD_VOLUME ?? "", 10);
  return Number.isFinite(e) ? Math.max(0, Math.min(100, e)) : 40;
}

function isEnabled() {
  const env = (process.env.CLAUDE_WIZARD_ENABLED ?? "").trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(env)) return false;
  return !existsSync(disabledFile);
}

function playPreview() {
  try {
    const child = spawn(process.execPath, [join(here, "play.mjs")], {
      stdio: "ignore",
      detached: true,
    });
    child.on("error", () => {});
    child.unref();
  } catch {}
}

const [cmd, arg] = process.argv.slice(2);

switch ((cmd || "status").toLowerCase()) {
  case "on":
  case "enable":
    ensureDir();
    if (existsSync(disabledFile)) rmSync(disabledFile);
    console.log("🧙 Claude The Wizard: ENABLED (volume " + currentVolume() + "%)");
    break;

  case "off":
  case "disable":
    ensureDir();
    writeFileSync(disabledFile, "");
    console.log("🔇 Claude The Wizard: DISABLED");
    break;

  case "volume":
  case "vol": {
    const n = parseInt(arg, 10);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      console.error(
        "Usage: wizard volume <0-100>   (current: " + currentVolume() + "%)"
      );
      process.exit(1);
    }
    ensureDir();
    writeFileSync(volumeFile, String(n));
    console.log("🔊 Volume set to " + n + "%" + (isEnabled() ? "" : " (currently disabled)"));
    if (isEnabled()) playPreview();
    break;
  }

  case "test":
  case "play":
    playPreview();
    console.log(
      "🧙 Test cast at " + currentVolume() + "% (enabled: " + isEnabled() + ")"
    );
    break;

  case "status":
  default:
    console.log("Claude The Wizard");
    console.log("  enabled: " + isEnabled());
    console.log("  volume:  " + currentVolume() + "%");
    console.log("  control: " + controlDir);
    break;
}
