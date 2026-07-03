#!/usr/bin/env node
// Claude The Wizard - plays the bundled spell sound when invoked.
// Cross-platform, non-blocking, and fails silently so it never disrupts a session.
// Volume is configurable via the CLAUDE_WIZARD_VOLUME env var (0-100, default 40).

import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const sound = join(here, "sound.mp3");
if (!existsSync(sound)) process.exit(0);

// Clamp requested volume to 0-100; default to a gentle 40%.
let vol = parseInt(process.env.CLAUDE_WIZARD_VOLUME ?? "", 10);
if (!Number.isFinite(vol)) vol = 40;
vol = Math.max(0, Math.min(100, vol));

// Spawn a detached, output-suppressed process so the caller returns immediately.
function launch(cmd, args) {
  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

// Check whether a binary is on PATH (used on Linux to pick an available player).
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
  launch("powershell", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", ps]);
} else if (process.platform === "darwin") {
  launch("afplay", ["-v", (vol / 100).toFixed(2), sound]);
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
    if (has(bin) && launch(bin, args)) break;
  }
}
