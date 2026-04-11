/**
 * OpenClaw Agent Protocol — Plugin Entry Point
 *
 * Infrastructure-level routing enforcement for OpenClaw multi-agent systems.
 * Intercepts tool calls and enforces that they are dispatched to the correct
 * specialist agent, not executed directly.
 */
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { resolveTargetAgent } from "./resolve.js";
import { loadPolicy, logBlocked, buildApproval } from "./policy.js";
export default definePluginEntry({
    id: "openclaw-agent-protocol",
    name: "OpenClaw Agent Protocol",
    description: "Infrastructure-level routing enforcement for OpenClaw. " +
        "Agents must dispatch restricted tools to the correct specialist — " +
        "enforced at the gateway level, not the prompt level.",
    register(api) {
        api.on("before_tool_call", async (event, ctx) => {
            const pol = loadPolicy();
            if (!pol.enabled)
                return;
            if (pol.mode === "off")
                return;
            const { toolName, params } = event;
            const sessionKey = ctx.sessionKey ?? ctx.agentId ?? "unknown";
            // Always-allow tools
            const allowTools = pol.allowTools ?? [];
            if (allowTools.includes(toolName))
                return;
            // Resolve target agent
            const targetAgent = resolveTargetAgent(toolName, params, pol);
            if (!targetAgent)
                return; // not in routing table — passthrough
            // If the calling agent IS the target agent, it is the specialist — allow
            if (ctx.agentId === targetAgent)
                return;
            const rawDetail = params?.command ?? params?.path ?? params?.code ?? params?.url ?? toolName;
            const detail = String(rawDetail).slice(0, 200);
            logBlocked(toolName, detail, targetAgent, sessionKey);
            if (pol.mode === "log") {
                return {
                    params,
                    block: false,
                    blockReason: `[Agent Protocol] ${toolName} should be dispatched to ${targetAgent}. Compliance logged.`,
                };
            }
            // Enforce — block and require approval
            return {
                params,
                block: true,
                blockReason: `Agent Protocol: ${toolName} must be dispatched to ${targetAgent}. Use delegate_task().`,
                requireApproval: buildApproval(toolName, targetAgent),
            };
        });
    },
});
