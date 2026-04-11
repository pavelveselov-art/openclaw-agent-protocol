#!/usr/bin/env node
/**
 * agent-routing-enforcer setup wizard
 *
 * Auto-detects agents from openclaw.json and generates a hard_stop_policy.json
 * with sensible defaults based on agent roles.
 *
 * Usage:
 *   npm run setup
 *   node dist/wizard.js
 */
import { readFileSync, writeFileSync, existsSync, cpSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { globSync } from "glob";
import Database from "better-sqlite3";
import { COMPLIANCE_DB } from "./policy.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HOME = process.env.HOME ?? ".";
const OPENCLAW_DIR = join(HOME, ".openclaw");
const POLICY_PATH = join(OPENCLAW_DIR, "hard_stop_policy.json");
const EXTENSION_DIR = join(OPENCLAW_DIR, "extensions", "agent-routing-enforcer");
const OPENCLAW_JSON_PATH = join(OPENCLAW_DIR, "openclaw.json");
// ── CLI helpers ────────────────────────────────────────────────────────────────
async function ask(question) {
    const readline = await import("readline");
    const iface = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        iface.question(question, (answer) => {
            iface.close();
            resolve(answer.trim());
        });
    });
}
function print(msg) {
    console.log(msg);
}
function detectAgents() {
    try {
        const raw = readFileSync(OPENCLAW_JSON_PATH, "utf-8");
        const config = JSON.parse(raw);
        const agents = (config.agents?.list ?? []).map((a) => ({
            id: a.id,
            name: a.identity?.name ?? a.id,
            workspace: a.workspace ?? "",
        }));
        return agents;
    }
    catch (e) {
        print(`⚠️  Could not read ${OPENCLAW_JSON_PATH}: ${e}`);
        print("   Falling back to common agent names.");
        return [
            { id: "sentinel", name: "Sentinel", workspace: "" },
            { id: "coder", name: "Coder", workspace: "" },
            { id: "ghost", name: "Ghost", workspace: "" },
            { id: "oracle", name: "Oracle", workspace: "" },
        ];
    }
}
function inferDefaultRouting(agents) {
    const agentIds = new Set(agents.map((a) => a.id.toLowerCase()));
    const defaults = [
        {
            tool: "exec",
            target: agentIds.has("sentinel")
                ? "sentinel"
                : agentIds.has("ops")
                    ? "ops"
                    : agents[0]?.id ?? "sentinel",
            description: "Terminal/shell commands",
        },
        {
            tool: "execute_code",
            target: agentIds.has("coder") ? "coder" : agents[0]?.id ?? "coder",
            description: "Inline code execution (Python, etc.)",
        },
        {
            tool: "write_file",
            target: agentIds.has("coder") ? "coder" : agents[0]?.id ?? "coder",
            description: "File writes (with path-based glob routing)",
        },
        {
            tool: "patch",
            target: agentIds.has("coder") ? "coder" : agents[0]?.id ?? "coder",
            description: "Patch / targeted edits (with path-based glob routing)",
        },
        {
            tool: "browser_navigate",
            target: agentIds.has("ghost") ? "ghost" : agents[0]?.id ?? "ghost",
            description: "Browser navigation",
        },
        {
            tool: "browser_click",
            target: agentIds.has("ghost") ? "ghost" : agents[0]?.id ?? "ghost",
            description: "Browser clicks",
        },
        {
            tool: "browser_type",
            target: agentIds.has("ghost") ? "ghost" : agents[0]?.id ?? "ghost",
            description: "Browser typing",
        },
        {
            tool: "web_search",
            target: agentIds.has("ghost")
                ? "ghost"
                : agentIds.has("oracle")
                    ? "oracle"
                    : agents[0]?.id ?? "ghost",
            description: "Web search",
        },
        {
            tool: "web_extract",
            target: agentIds.has("ghost")
                ? "ghost"
                : agentIds.has("oracle")
                    ? "oracle"
                    : agents[0]?.id ?? "ghost",
            description: "Web content extraction",
        },
    ];
    return defaults;
}
// ── Interactive confirmation ────────────────────────────────────────────────────
async function confirmRouting(rules, agents) {
    print("\n📋 Routing rules — press Enter to accept default, or type an agent ID to change:\n");
    const confirmed = [];
    for (const rule of rules) {
        const answer = await ask(`  ${rule.tool.padEnd(20)} → ${rule.target.padEnd(16)} (${rule.description})\n  [${rule.target}] > `);
        const target = answer.trim() || rule.target;
        // Validate target is a known agent
        const validAgent = agents.find((a) => a.id.toLowerCase() === target.toLowerCase() ||
            a.name.toLowerCase() === target.toLowerCase());
        if (!validAgent) {
            print(`  ⚠️  Unknown agent "${target}", keeping ${rule.target}`);
            confirmed.push(rule);
        }
        else {
            confirmed.push({ ...rule, target: validAgent.id });
        }
    }
    return confirmed;
}
// ── Policy generation ────────────────────────────────────────────────────────────
function buildPolicyJson(rules) {
    const routing = {};
    const fileTools = new Set(["write_file", "patch"]);
    for (const rule of rules) {
        if (fileTools.has(rule.tool)) {
            // write_file and patch get path-based routing with coder as default
            routing[rule.tool] = {
                [rule.target]: [`**/${rule.target}/**`],
                coder: [
                    "**/*.py",
                    "**/*.js",
                    "**/*.ts",
                    "**/*.sh",
                    "**/*.md",
                    "**/src/**",
                    "**/lib/**",
                    "**/scripts/**",
                ],
            };
        }
        else {
            routing[rule.tool] = rule.target;
        }
    }
    return {
        enabled: true,
        mode: "enforce",
        description: "Hard Stop policy — routes tool calls to the correct specialist agent. " +
            "Auto-generated by agent-routing-enforcer wizard.",
        routing,
        allowTools: [
            "read_file",
            "search_files",
            "session_search",
            "memory",
            "delegate_task",
            "cronjob",
            "clarify",
            "text_to_speech",
        ],
    };
}
// ── Plugin installation ────────────────────────────────────────────────────────
function installPlugin() {
    // __dirname is dist/ after build
    const srcDist = __dirname;
    const indexSrc = join(srcDist, "index.js");
    if (!existsSync(indexSrc)) {
        print(`\n⚠️  Plugin not built yet. Run: npm run build`);
        print(`   (Expected to find: ${indexSrc})`);
        return;
    }
    mkdirSync(join(EXTENSION_DIR, "dist"), { recursive: true });
    // Copy dist files
    const distFiles = globSync("**/*", { cwd: srcDist });
    for (const file of distFiles) {
        cpSync(join(srcDist, file), join(EXTENSION_DIR, "dist", file));
    }
    // Copy defaults
    const defaultsDir = join(dirname(dirname(__dirname)), "defaults");
    if (existsSync(defaultsDir)) {
        mkdirSync(join(EXTENSION_DIR, "defaults"), { recursive: true });
        const defaultFiles = globSync("**/*", { cwd: defaultsDir });
        for (const file of defaultFiles) {
            cpSync(join(defaultsDir, file), join(EXTENSION_DIR, "defaults", file));
        }
    }
    // Write plugin manifest
    writeFileSync(join(EXTENSION_DIR, "openclaw.plugin.json"), JSON.stringify({
        id: "agent-routing-enforcer",
        enabledByDefault: true,
        configSchema: { type: "object", additionalProperties: false },
    }, null, 2));
    print(`\n✅ Plugin installed to ${EXTENSION_DIR}/`);
}
// ── Compliance DB setup ─────────────────────────────────────────────────────────
function ensureComplianceDb() {
    const schemaPath = join(EXTENSION_DIR, "defaults", "compliance.sql");
    if (!existsSync(schemaPath))
        return;
    try {
        // Create DB if it doesn't exist
        if (!existsSync(COMPLIANCE_DB)) {
            const db = new Database(COMPLIANCE_DB);
            const schema = readFileSync(schemaPath, "utf-8");
            db.exec(schema);
            db.close();
            print(`✅ Compliance DB initialized at ${COMPLIANCE_DB}`);
        }
    }
    catch (e) {
        print(`⚠️  Could not init compliance DB: ${e}`);
    }
}
// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    print("  agent-routing-enforcer  —  setup wizard");
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    // 1. Detect agents
    print("1. Detecting agents from openclaw.json...");
    const agents = detectAgents();
    print(`   Found ${agents.length} agent(s):`);
    for (const a of agents) {
        print(`   • ${a.id.padEnd(16)} "${a.name}"`);
    }
    // 2. Show detected routing
    print("\n2. Default routing (inferred from agent roles):");
    const defaultRules = inferDefaultRouting(agents);
    // 3. Interactive confirmation
    const confirmedRules = await confirmRouting(defaultRules, agents);
    // 4. Mode selection
    const modeAnswer = await ask(`\n3. Enforcement mode:\n   [enforce] = block + require approval\n   [log]    = log violations only\n   [off]    = disable plugin\n   (default: enforce) > `);
    const mode = ["enforce", "log", "off"].includes(modeAnswer.trim())
        ? modeAnswer.trim()
        : "enforce";
    // 5. Build policy
    const policy = {
        ...buildPolicyJson(confirmedRules),
        mode,
    };
    // 6. Write policy file
    mkdirSync(OPENCLAW_DIR, { recursive: true });
    writeFileSync(POLICY_PATH, JSON.stringify(policy, null, 2));
    print(`\n✅ Policy written to ${POLICY_PATH}`);
    // 7. Install plugin files
    print("\n4. Installing plugin to extensions directory...");
    installPlugin();
    ensureComplianceDb();
    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    print("  Done! Restart OpenClaw gateway to activate.");
    print(`  Policy file: ${POLICY_PATH}`);
    print(`  Plugin dir:  ${EXTENSION_DIR}`);
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}
main().catch((e) => {
    console.error("Wizard error:", e);
    process.exit(1);
});
