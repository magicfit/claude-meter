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

const PRICING: Record<string, ModelPricing> = {
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
export function getPricing(model: string): ModelPricing | null {
  return PRICING[model] ?? null;
}

/**
 * Computes cost in USD from raw token counts + a pricing entry.
 */
export function computeCostUsd(
  pricing: ModelPricing,
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  },
): number {
  const total =
    usage.inputTokens * pricing.input +
    usage.outputTokens * pricing.output +
    usage.cacheReadTokens * pricing.cacheRead +
    usage.cacheCreationTokens * pricing.cacheCreation;
  return total / 1_000_000;
}
