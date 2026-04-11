/**
 * OpenClaw Agent Protocol — Plugin Entry Point
 *
 * Infrastructure-level routing enforcement for OpenClaw multi-agent systems.
 * Intercepts tool calls and enforces that they are dispatched to the correct
 * specialist agent, not executed directly.
 */
declare const _default: {
    id: string;
    name: string;
    description: string;
    configSchema: import("openclaw/plugin-sdk/plugin-entry").OpenClawPluginConfigSchema;
    register: NonNullable<import("openclaw/plugin-sdk/plugin-entry").OpenClawPluginDefinition["register"]>;
} & Pick<import("openclaw/plugin-sdk/plugin-entry").OpenClawPluginDefinition, "kind" | "reload" | "nodeHostCommands" | "securityAuditCollectors">;
export default _default;
