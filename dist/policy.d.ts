import type { HardStopPolicy } from "./types.js";
export declare function debug(msg: string): void;
export declare const POLICY_PATH: string;
export declare const COMPLIANCE_DB: string;
export declare function loadPolicy(): HardStopPolicy;
export declare function logBlocked(toolName: string, detail: string, agent: string, sessionKey: string): void;
export declare function buildApproval(toolName: string, agent: string): NonNullable<import("./types.js").BlockResult["requireApproval"]>;
