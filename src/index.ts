import { loadPolicy, logBlocked, buildApproval, debug } from "./policy.js";
import { resolveTargetAgent } from "./resolve.js";
import type { BeforeToolCallEvent, BeforeToolCallContext, BlockResult } from "./types.js";

// ── Plugin registration ───────────────────────────────────────────────────────
//
// OpenClaw calls register(api) when loading the plugin.
// Use api.on() to attach hooks — NOT api.registerHook() (that's for internal hooks).

export function register(api: { on: (event: string, handler: (event: BeforeToolCallEvent, ctx: BeforeToolCallContext) => Promise<BlockResult | void>) => void }): void {
  debug("PLUGIN REGISTERED");

  api.on("before_tool_call", async (event, ctx): Promise<BlockResult | void> => {
    debug(`HOOK FIRING: tool=${event.toolName} sessionId=${ctx.sessionId}`);

    // Reload policy on every call so edits take effect immediately
    const pol = loadPolicy();
    if (!pol.enabled) return;
    if (pol.mode === "off") return;

    const { toolName, params } = event;
    const sessionKey = ctx.sessionId ?? "unknown";

    const allowTools = pol.allowTools ?? [];
    if (allowTools.includes(toolName)) {
      debug(`ALLOWED (allowTools): ${toolName}`);
      return;
    }

    const targetAgent = resolveTargetAgent(toolName, params, pol);
    debug(`Target agent for ${toolName}: ${targetAgent}`);

    if (!targetAgent) return; // not in routing table — passthrough

    const rawDetail = params?.command ?? params?.path ?? params?.code ?? params?.url ?? toolName;
    const detail = String(rawDetail).slice(0, 200);

    logBlocked(toolName, detail, targetAgent, sessionKey);
    debug(`LOGGED BLOCKED: ${toolName} → ${targetAgent}`);

    if (pol.mode === "log") {
      return {
        params: event.params,
        block: false,
        blockReason: `[HARD STOP] ${toolName} should be dispatched to ${targetAgent}. Compliance logged.`,
      };
    }

    // Enforce mode — block and require approval
    debug(`BLOCKING: ${toolName} (enforce mode)`);
    return {
      params: event.params,
      block: true,
      blockReason: `HARD STOP: ${toolName} must be dispatched to ${targetAgent}. Use delegate_task().`,
      requireApproval: buildApproval(toolName, targetAgent),
    };
  });
}

// ── Default export for OpenClaw ────────────────────────────────────────────────
//
// OpenClaw loads plugins by importing the default export.
// The SDK calls register(api) internally after loading.

export default { register };
