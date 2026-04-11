export interface RoutingEntry {
    [agent: string]: string[];
}
export interface HardStopPolicy {
    enabled: boolean;
    mode: "off" | "log" | "enforce";
    description?: string;
    routing: {
        exec?: string;
        execute_code?: string;
        write_file?: RoutingEntry | string;
        patch?: RoutingEntry | string;
        browser_navigate?: string;
        browser_click?: string;
        browser_type?: string;
        web_search?: string;
        web_extract?: string;
        [toolName: string]: unknown;
    };
    allowTools?: string[];
}
export interface BeforeToolCallEvent {
    toolName: string;
    params: Record<string, unknown>;
    runId?: string;
    toolCallId?: string;
}
export interface BeforeToolCallContext {
    sessionId?: string;
    agentId?: string;
}
export interface BlockResult {
    block: boolean;
    blockReason?: string;
    params?: Record<string, unknown>;
    requireApproval?: {
        title: string;
        description: string;
        severity: "info" | "warning" | "critical";
        timeoutMs: number;
        timeoutBehavior: "allow" | "deny";
    };
}
export interface OpenClawAgent {
    id: string;
    identity?: {
        name?: string;
    };
    workspace?: string;
}
