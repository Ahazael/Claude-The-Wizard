#!/usr/bin/env node
// Claude The Wizard - plays the bundled spell sound when invoked.
// Blocks until playback finishes (run it from an `async` hook so it never
// delays the session). Blocking matters: a detached player would be reaped
// when the fast-returning hook process exits, cutting the sound off.
//
// Runtime controls (shared with wizard.mjs, effective immediately):
//   ~/.claude/claude-the-wizard/disabled  -> presence silences the sound
//   ~/.claude/claude-the-wizard/volume    -> integer 0-100
// Env fallbacks: CLAUDE_WIZARD_ENABLED (off/false/0/no), CLAUDE_WIZARD_VOLUME (0-100).

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const sound = join(here, "sound.mp3");
if (!existsSync(sound)) process.exit(0);

// Shared control directory (same for local and plugin installs).
const controlDir = join(homedir(), ".claude", "claude-the-wizard");
const disabledFile = join(controlDir, "disabled");
const volumeFile = join(controlDir, "volume");

// Disabled via marker file or env var? Stay silent.
const envEnabled = (process.env.CLAUDE_WIZARD_ENABLED ?? "").trim().toLowerCase();
if (existsSync(disabledFile) || ["0", "false", "no", "off"].includes(envEnabled)) {
  process.exit(0);
}

// Volume precedence: control file > env var > default 40. Clamp to 0-100.
function readVolume() {
  try {
    if (existsSync(volumeFile)) {
      const n = parseInt(readFileSync(volumeFile, "utf8").trim(), 10);
      if (Number.isFinite(n)) return n;
    }
  } catch {}
  const e = parseInt(process.env.CLAUDE_WIZARD_VOLUME ?? "", 10);
  return Number.isFinite(e) ? e : 40;
}
const vol = Math.max(0, Math.min(100, readVolume()));

// Run a player and WAIT for it to finish, swallowing all errors/output.
function play(cmd, args) {
  try {
    const r = spawnSync(cmd, args, { stdio: "ignore" });
    return !r.error && r.status === 0;
  } catch {
    return false;
  }
}

function has(bin) {
  const probe = process.platform === "win32" ? "where" : "which";
  try {
    return spawnSync(probe, [bin], { stdio: "ignore" }).status === 0;
  } catch {
    return false;
  }
}

if (process.platform === "win32") {
  // MCI (winmm.dll) reliably plays mp3 headless. Volume range is 0-1000.
  // "play ... wait" blocks in PowerShell until the clip ends.
  const esc = sound.replace(/'/g, "''"); // safe inside a single-quoted PS string
  const mciVol = Math.round(vol * 10);
  const ps = [
    "$ErrorActionPreference='SilentlyContinue';",
    'Add-Type -Name WinMM -Namespace Native -MemberDefinition \'[DllImport("winmm.dll", CharSet=CharSet.Auto)] public static extern int mciSendString(string command, System.Text.StringBuilder buffer, int bufferSize, IntPtr hwndCallback);\';',
    `[Native.WinMM]::mciSendString('open "${esc}" type mpegvideo alias claudecast', $null, 0, [IntPtr]::Zero) | Out-Null;`,
    `[Native.WinMM]::mciSendString('setaudio claudecast volume to ${mciVol}', $null, 0, [IntPtr]::Zero) | Out-Null;`,
    "[Native.WinMM]::mciSendString('play claudecast wait', $null, 0, [IntPtr]::Zero) | Out-Null;",
    "[Native.WinMM]::mciSendString('close claudecast', $null, 0, [IntPtr]::Zero) | Out-Null;",
  ].join(" ");
  play("powershell", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", ps]);
} else if (process.platform === "darwin") {
  play("afplay", ["-v", (vol / 100).toFixed(2), sound]);
} else {
  // Linux/other: try common mp3-capable players in order, each with a volume flag.
  const mpg123Factor = String(Math.round((32768 * vol) / 100)); // -f scale, 32768 = 100%
  const players = [
    ["mpg123", ["-q", "-f", mpg123Factor, sound]],
    ["ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", "-volume", String(vol), sound]],
    ["mpv", ["--no-video", "--really-quiet", `--volume=${vol}`, sound]],
    ["cvlc", ["--play-and-exit", "--intf", "dummy", `--gain=${(vol / 100).toFixed(2)}`, sound]],
  ];
  for (const [bin, args] of players) {
    if (has(bin) && play(bin, args)) break;
  }
}
