# OpenClaw Agent Protocol

**The missing enforcement layer for OpenClaw multi-agent systems.**

Agents that always delegate correctly. Every time. At infrastructure level.

---

## The Problem

In a multi-agent setup, you define roles — Coder writes code, Ghost scrapes the web, Sentinel runs terminals. But agents are free to ignore that. They can execute terminal commands when they shouldn't, write files directly instead of dispatching, or scrape the web without routing through the right agent.

Prompt-level instructions get overridden, forgotten, or bypassed. You end up with agents that do things they shouldn't, and you lose the consistency that makes multi-agent systems trustworthy.

## The Solution

OpenClaw Agent Protocol is a gateway-level enforcement hook that intercepts every tool call before it executes. If an agent tries to run a tool that should be dispatched to another agent, it gets blocked — not warned, not logged after the fact. Blocked, with a compliance record and an approval dialog.

```
Agent tries to run "exec" (terminal command)
         │
         ▼
  ┌─────────────────────────────────┐
  │  OpenClaw Agent Protocol hook   │  ← gateway-level, not prompt-level
  │  (before_tool_call)             │
  └──────────────┬──────────────────┘
                 │
        ┌────────▼────────┐
        │ Routing policy?  │
        │ Should this agent │
        │ handle this tool? │
        └────────┬────────┘
                 │
          ┌──────┴──────┐
          │ NO           │ YES
          ▼              ▼
    Block + Log     Pass through
    + Require       (normal execution)
    Approval
```

## What You Get

- **Consistent multi-agent behavior** — agents can only do what they're supposed to do, not what they want to do
- **Infrastructure-level enforcement** — bypass-proof. The gateway enforces the policy, not the agent's prompts
- **Smart routing** — path-based routing for file operations (code files → Coder, reports → Researcher)
- **Audit trail** — every blocked call logged to SQLite with session, tool, detail, and target agent
- **Zero restarts** — policy file reloads on every call. Edit it and it's live immediately
- **One-command setup** — auto-detects your agents and generates a policy in under a minute

## Features

- **Auto-detect agents** from your `openclaw.json` and infer sensible routing defaults
- **Three enforcement modes** — `enforce` (block + approve), `log` (log only), `off` (passthrough)
- **Path-based routing** for `write_file` and `patch` — route by glob patterns, not just tool name
- **Compliance DB** — SQLite audit log of every violation
- **Debug log** — verbose hook firing trace for troubleshooting

## Quick Start

```bash
git clone https://github.com/pavelveselov-art/openclaw-agent-protocol.git
cd openclaw-agent-protocol
npm install
npm run build
npm run setup   # auto-detects your agents, generates policy, installs plugin

# Restart OpenClaw gateway
openclaw restart
```

## How Routing Works

The policy file (`~/.openclaw/hard_stop_policy.json`) maps tools to agents:

```json
{
  "enabled": true,
  "mode": "enforce",
  "routing": {
    "exec": "sentinel",
    "execute_code": "coder",
    "write_file": {
      "coder": ["**/*.py", "**/*.js", "**/src/**", "**/scripts/**"],
      "researcher": ["**/research/**", "**/reports/**"]
    },
    "patch": { ... },
    "browser_navigate": "ghost",
    "browser_click": "ghost",
    "browser_type": "ghost",
    "web_search": "ghost",
    "web_extract": "ghost"
  },
  "allowTools": ["read_file", "search_files", "session_search", "memory", "delegate_task", "cronjob", "clarify", "text_to_speech"]
}
```

| Entry type | Behavior |
|------------|----------|
| String `"exec": "sentinel"` | All `exec` calls → Sentinel |
| Object with globs | Route based on `params.path` glob match |

## Debugging

```bash
# Watch the hook fire in real time
tail -f ~/.openclaw/agent-routing-debug.log

# Query the compliance audit log
sqlite3 ~/.openclaw/compliance.db "SELECT * FROM compliance_log ORDER BY timestamp DESC LIMIT 20;"
```

## Why Not Just Use Prompt Instructions?

Prompts get overridden. Models can ignore system instructions, especially under task pressure or when the context window shifts. OpenClaw Agent Protocol runs at the infrastructure level — the gateway won't pass a blocked tool call to any agent, regardless of what the agent's prompt says.

## License

MIT
