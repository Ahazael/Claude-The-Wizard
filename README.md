# Claude The Wizard 🧙‍♂️✨

A tiny [Claude Code](https://claude.com/claude-code) plugin that plays a **Wizard101 Leprechaun spell** sound whenever Claude finishes a task. Every response now ends with a satisfying little cast.

## What it does

It registers a `Stop` hook — the event Claude Code fires when Claude finishes responding — that plays the bundled `sound.mp3`. The player runs detached and non-blocking, so it never slows Claude down, and fails silently if no audio backend is available.

Cross-platform:
- **Windows** — MCI via `winmm.dll` through PowerShell (no extra install)
- **macOS** — `afplay` (built in)
- **Linux** — first available of `mpg123`, `ffplay`, `mpv`, `cvlc`

## Controls

Once installed, four slash commands control the effect (state changes take effect
immediately — no restart needed):

| Command | Does |
| --- | --- |
| `/claude-the-wizard:volume 25` | Set volume to 25% (0–100), plays a preview |
| `/claude-the-wizard:off` | Mute the finish sound |
| `/claude-the-wizard:on` | Re-enable it |
| `/claude-the-wizard:status` | Show current enabled state + volume |

Or drive it directly with the bundled CLI:

```
node /path/to/plugin/wizard.mjs volume 25
node /path/to/plugin/wizard.mjs off
node /path/to/plugin/wizard.mjs on
node /path/to/plugin/wizard.mjs status
```

State is stored in `~/.claude/claude-the-wizard/` (`volume` and `disabled` files),
so it's shared across installs. Env-var fallbacks are also honored:
`CLAUDE_WIZARD_VOLUME` (0–100, default `40`) and `CLAUDE_WIZARD_ENABLED`
(`off`/`false`/`0` to mute). Playback defaults to a gentle **40%**.

## Install

In Claude Code, add this repo as a plugin marketplace and install:

```
/plugin marketplace add Ahazael/Claude-The-Wizard
/plugin install claude-the-wizard@claude-the-wizard
```

Then restart Claude Code (or reload plugins). Done — finish any task and hear the spell.

To remove it:

```
/plugin uninstall claude-the-wizard@claude-the-wizard
```

## Manual install (without the marketplace)

Clone the repo and point a `Stop` hook at `play.mjs` in your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["/absolute/path/to/Claude-The-Wizard/play.mjs"],
            "async": true
          }
        ]
      }
    ]
  }
}
```

## Files

| File | Purpose |
| --- | --- |
| `.claude-plugin/plugin.json` | Plugin manifest |
| `.claude-plugin/marketplace.json` | Makes the repo installable as a one-plugin marketplace |
| `hooks/hooks.json` | Registers the `Stop` hook |
| `play.mjs` | Cross-platform sound player |
| `sound.mp3` | The Leprechaun spell sound |

## License

MIT
