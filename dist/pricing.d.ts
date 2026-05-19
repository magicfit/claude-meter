/**
 * Per-million-token pricing in USD for each Claude model.
 *
 * Keep this in sync with https://www.anthropic.com/pricing.
 * If a model is missing here, the wrapper logs a row with cost_usd = 0
 * and a warning — better to record the call than to throw.
 */
export interface ModelPricing {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreation: number;
}
/**
 * Looks up pricing for a model id. Returns null if unknown — caller should
 * record cost_usd = 0 and log a warning so the missing model gets noticed
 * during ops review.
 */
export declare function getPricing(model: string): ModelPricing | null;
/**
 * Computes cost in USD from raw token counts + a pricing entry.
 */
export declare function computeCostUsd(pricing: ModelPricing, usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
}): number;
//# sourceMappingURL=pricing.d.ts.map