# OpenClaw Agent Routing Enforcer

**Infrastructure-level routing enforcement for [OpenClaw](https://github.com/openclaw/openclaw) multi-agent systems.**

Prevents agents from self-executing restricted tool calls. Instead, they must dispatch to the correct specialist agent. The enforcement happens at the OpenClaw gateway level — agents cannot bypass it by ignoring prompts.

---

## What it does

```
Agent tries to run "terminal" command
         │
         ▼
  ┌─────────────────────────┐
  │  before_tool_call hook  │  ← runs in OpenClaw gateway
  │  (agent-routing-enforcer)│
  └──────────┬──────────────┘
             │
    ┌────────▼────────┐
    │ hard_stop_policy │  ← ~/.openclaw/hard_stop_policy.json
    │   .json          │
    └────────┬────────┘
             │
    ┌────────▼─────────────────────────────────┐
    │  Is tool in routing table?                │
    │  Is tool on allowTools?                   │
    └────────┬─────────────────────────────────┘
             │
      ┌──────┴──────┐
      │ NO           │ YES
      ▼              ▼
   Pass through   Block + log + require approval
                  (or log-only in "log" mode)
```

## Features

- **Infrastructure enforcement** — runs as an OpenClaw plugin hook, not a prompt instruction. Agents can't bypass it.
- **Auto-detect agents** — wizard reads your `openclaw.json` and infers sensible routing defaults from agent IDs/names.
- **Path-based routing** — `write_file` and `patch` route to different agents based on glob patterns in the file path.
- **Three modes** — `enforce` (block + approve), `log` (log only), `off` (passthrough).
- **Zero restart** — policy file reloads on every call. Edit `hard_stop_policy.json` and it's live immediately.
- **Compliance audit trail** — every blocked call is logged to `~/.openclaw/compliance.db`.

---

## Quick start

```bash
# Install
npm install -g openclaw-agent-routing-enforcer

# Run the setup wizard (auto-detects your agents + generates policy)
npm run setup

# Restart OpenClaw gateway
openclaw restart
```

## Manual setup

```bash
# 1. Build the plugin
npm run build

# 2. Copy plugin to OpenClaw extensions directory
cp -r dist/ ~/.openclaw/extensions/agent-routing-enforcer/
cp defaults/compliance.sql ~/.openclaw/  # if compliance.db doesn't exist yet

# 3. Create policy file
cp defaults/policy.json ~/.openclaw/hard_stop_policy.json
# Edit as needed

# 4. Restart OpenClaw
openclaw restart
```

---

## Policy file

`~/.openclaw/hard_stop_policy.json`:

```json
{
  "enabled": true,
  "mode": "enforce",
  "routing": {
    "exec": "sentinel",
    "execute_code": "coder",
    "write_file": {
      "coder": ["**/*.py", "**/*.js", "**/*.ts", "**/src/**"],
      "researcher": ["**/research/**", "**/reports/**"]
    },
    "patch": {
      "coder": ["**/*.py", "**/*.js", "**/*.ts", "**/src/**"],
      "researcher": ["**/research/**", "**/reports/**"]
    },
    "browser_navigate": "ghost",
    "browser_click": "ghost",
    "browser_type": "ghost",
    "web_search": "ghost",
    "web_extract": "ghost"
  },
  "allowTools": [
    "read_file", "search_files", "session_search",
    "memory", "delegate_task", "cronjob", "clarify", "text_to_speech"
  ]
}
```

### Routing resolution

| Entry type | Example | Behavior |
|------------|---------|----------|
| String | `"exec": "sentinel"` | All `exec` calls → `sentinel` |
| Object | `"write_file": { "coder": ["**/*.py"], "researcher": ["**/reports/**"] }` | Path-based: `.py` files → `coder`, files in `reports/` → `researcher`. No match → first key |

### Modes

| Mode | Behavior |
|------|----------|
| `enforce` | Block + show approval dialog to user |
| `log` | Log to `compliance.db` but allow execution |
| `off` | Plugin does nothing |

### AllowTools

Tools that always pass through even if listed in `routing`. Default: `read_file`, `search_files`, `session_search`, `memory`, `delegate_task`, `cronjob`, `clarify`, `text_to_speech`.

---

## Compliance database

Every blocked call is logged to `~/.openclaw/compliance.db`:

```sql
SELECT * FROM compliance_log ORDER BY timestamp DESC LIMIT 20;
```

Schema:

| Column | Type | Description |
|--------|------|-------------|
| `session_key` | TEXT | OpenClaw session ID |
| `trigger_type` | TEXT | Tool name that was blocked |
| `trigger_detail` | TEXT | Command / path / URL that was blocked |
| `decision` | TEXT | `blocked` or `allowed` |
| `agent` | TEXT | Target agent it should have been routed to |
| `violation` | INTEGER | 1 = yes, 0 = no |
| `timestamp` | DATETIME | When it happened |

---

## Debugging

```bash
# Watch the debug log
tail -f ~/.openclaw/agent-routing-debug.log

# Enable verbose output for the plugin
DEBUG=1 openclaw restart
```

Key log entries to look for:
```
HOOK FIRING: tool=exec sessionId=...
Target agent for exec: sentinel
LOGGED BLOCKED: exec → sentinel
BLOCKING: exec (enforce mode)
```

---

## Project structure

```
openclaw-agent-routing-enforcer/
├── src/
│   ├── index.ts        # Plugin hook (before_tool_call)
│   ├── resolve.ts      # resolveTargetAgent + glob matching
│   ├── policy.ts       # loadPolicy, logBlocked, buildApproval
│   ├── types.ts        # TypeScript interfaces
│   └── wizard.ts       # Auto-detect + interactive setup CLI
├── defaults/
│   ├── policy.json     # Shipped default routing
│   └── compliance.sql  # Compliance DB schema
├── dist/               # Compiled output
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE (MIT)
```

---

## License

MIT
