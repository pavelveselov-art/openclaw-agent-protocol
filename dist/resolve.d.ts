import type { HardStopPolicy } from "./types.js";
/**
 * Match a file path against a list of glob patterns.
 * Uses dot:true so ** matches hidden files like .bashrc
 */
export declare function matchesGlobPatterns(filePath: string, patterns: string[]): boolean;
/**
 * Resolve which agent should handle a tool call.
 *
 * Strategy:
 *  - String entry  → routing[toolName] = "agent"  → return that agent directly
 *  - Object entry  → routing[toolName] = { agent: [glob patterns] }
 *    → match params.path against globs → return first matching agent
 *    → no match → return first key (default agent)
 *  - No entry → return null (tool passes through, not blocked)
 */
export declare function resolveTargetAgent(toolName: string, params: Record<string, unknown>, policy: HardStopPolicy): string | null;
