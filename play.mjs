#!/usr/bin/env node
// Claude The Wizard - plays the bundled spell sound when invoked.
// Cross-platform, non-blocking, and fails silently so it never disrupts a session.

import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const sound = join(here, "sound.mp3");

if (!existsSync(sound)) process.exit(0);

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
  // Windows has no built-in mp3 CLI, so use the .NET MediaPlayer via PowerShell.
  const esc = sound.replace(/'/g, "''");
  const ps =
    "Add-Type -AssemblyName presentationCore; " +
    "$p = New-Object System.Windows.Media.MediaPlayer; " +
    `$p.Open([uri]'${esc}'); Start-Sleep -Milliseconds 400; ` +
    "$p.Play(); Start-Sleep -Seconds 6; $p.Close()";
  launch("powershell", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", ps]);
} else if (process.platform === "darwin") {
  launch("afplay", [sound]);
} else {
  // Linux/other: try common mp3-capable players in order of preference.
  const players = [
    ["mpg123", ["-q", sound]],
    ["ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", sound]],
    ["mpv", ["--no-video", "--really-quiet", sound]],
    ["cvlc", ["--play-and-exit", "--intf", "dummy", sound]],
  ];
  for (const [bin, args] of players) {
    if (has(bin) && launch(bin, args)) break;
  }
}
