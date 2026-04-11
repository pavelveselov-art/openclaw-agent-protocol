import type { BeforeToolCallEvent, BeforeToolCallContext, BlockResult } from "./types.js";
export declare function register(api: {
    on: (event: string, handler: (event: BeforeToolCallEvent, ctx: BeforeToolCallContext) => Promise<BlockResult | void>) => void;
}): void;
declare const _default: {
    register: typeof register;
};
export default _default;
