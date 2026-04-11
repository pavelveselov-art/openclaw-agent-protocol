import { minimatch } from "minimatch";
/**
 * Match a file path against a list of glob patterns.
 * Uses dot:true so ** matches hidden files like .bashrc
 */
export function matchesGlobPatterns(filePath, patterns) {
    if (!filePath || !patterns?.length)
        return false;
    for (const pattern of patterns) {
        try {
            if (minimatch(filePath, pattern, { dot: true }))
                return true;
        }
        catch {
            // Invalid glob, skip
        }
    }
    return false;
}
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
export function resolveTargetAgent(toolName, params, policy) {
    const routing = policy.routing ?? {};
    const entry = routing[toolName];
    if (!entry)
        return null;
    // Direct string mapping: "exec": "sentinel"
    if (typeof entry === "string")
        return entry;
    // Object mapping: "write_file": { "coder": ["**/*.py"], "researcher": ["**/research/**"] }
    if (typeof entry === "object" && !Array.isArray(entry)) {
        const filePath = params?.path ?? "";
        const entryObj = entry;
        for (const [agent, patterns] of Object.entries(entryObj)) {
            if (Array.isArray(patterns) && matchesGlobPatterns(filePath, patterns)) {
                return agent;
            }
        }
        // No glob matched — return first key as default
        return Object.keys(entryObj)[0] ?? null;
    }
    return null;
}
