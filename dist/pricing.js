const PRICING = {
    // Opus 4.x
    "claude-opus-4-7": { input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75 },
    "claude-opus-4-6": { input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75 },
    "claude-opus-4-5": { input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75 },
    // Sonnet 4.x
    "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75 },
    "claude-sonnet-4-5": { input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75 },
    "claude-sonnet-4-5-20250929": { input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75 },
    // Haiku 4.5
    "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheCreation: 1.25 },
    "claude-haiku-4-5-20251001": { input: 1, output: 5, cacheRead: 0.1, cacheCreation: 1.25 },
};
/**
 * Looks up pricing for a model id. Returns null if unknown — caller should
 * record cost_usd = 0 and log a warning so the missing model gets noticed
 * during ops review.
 */
export function getPricing(model) {
    return PRICING[model] ?? null;
}
/**
 * Computes cost in USD from raw token counts + a pricing entry.
 */
export function computeCostUsd(pricing, usage) {
    const total = usage.inputTokens * pricing.input +
        usage.outputTokens * pricing.output +
        usage.cacheReadTokens * pricing.cacheRead +
        usage.cacheCreationTokens * pricing.cacheCreation;
    return total / 1_000_000;
}
//# sourceMappingURL=pricing.js.map