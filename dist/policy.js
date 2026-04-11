import { readFileSync, appendFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// ── Debug logging ──────────────────────────────────────────────────────────────
const DEBUG = process.env.DEBUG === "1";
const DEBUG_LOG = join(process.env.HOME ?? ".", ".openclaw", "agent-routing-debug.log");
export function debug(msg) {
    if (!DEBUG)
        return;
    try {
        appendFileSync(DEBUG_LOG, `${new Date().toISOString()} [enforcer] ${msg}\n`);
    }
    catch {
        // ignore
    }
}
// ── Policy loading ─────────────────────────────────────────────────────────────
export const POLICY_PATH = join(process.env.HOME ?? ".", ".openclaw", "hard_stop_policy.json");
export const COMPLIANCE_DB = join(process.env.HOME ?? ".", ".openclaw", "compliance.db");
export function loadPolicy() {
    try {
        const raw = readFileSync(POLICY_PATH, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return { enabled: false, mode: "off", routing: {} };
    }
}
// ── Compliance logging ─────────────────────────────────────────────────────────
export function logBlocked(toolName, detail, agent, sessionKey) {
    try {
        if (!existsSync(COMPLIANCE_DB))
            return;
        const db = new Database(COMPLIANCE_DB, { readonly: false });
        db
            .prepare(`INSERT INTO compliance_log (session_key, trigger_type, trigger_detail, decision, agent, violation)
       VALUES (?, ?, ?, 'blocked', ?, 1)`)
            .run(sessionKey ?? "unknown", toolName, String(detail).slice(0, 200), agent);
        db.close();
    }
    catch {
        // ignore
    }
}
// ── Approval builder ───────────────────────────────────────────────────────────
const AGENT_DISPLAY = {
    sentinel: "Sentinel (ops)",
    coder: "Coder",
    ghost: "Ghost (scraping)",
    researcher: "Researcher (Oracle)",
};
export function buildApproval(toolName, agent) {
    return {
        title: `HARD STOP: ${toolName} → ${AGENT_DISPLAY[agent] ?? agent}`,
        description: `This tool must be dispatched to ${AGENT_DISPLAY[agent] ?? agent}, not executed directly.\n\n` +
            `Use delegate_task() with the appropriate brief to route this to ${agent}.`,
        severity: "critical",
        timeoutMs: 0,
        timeoutBehavior: "deny",
    };
}
