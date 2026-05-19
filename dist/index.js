import Anthropic from "@anthropic-ai/sdk";
import { getPricing, computeCostUsd } from "./pricing.js";
import { createRecorder } from "./recorder.js";
/**
 * Returns an Anthropic SDK-compatible client that transparently records cost
 * to the central metrics store on every call.
 *
 * Usage mirrors the SDK with one extra arg on each call:
 *
 *   const claude = createMeteredClient({
 *     apiKeyLabel: 'portal-techpack-extraction',
 *     service: 'magicfit-client-portal',
 *   });
 *   const res = await claude.messages.create(
 *     { model: 'claude-sonnet-4-6', messages: [...] },
 *     { jobKind: 'techpack-extraction', jobRef: `shop:${shop}/product:${id}`, shop }
 *   );
 *
 * Cost recording is fire-and-forget — Recorder failures NEVER throw or block
 * the underlying Anthropic call. If MAGICFIT_METER_URL/TOKEN aren't set,
 * recording is silently disabled.
 */
export function createMeteredClient(options) {
    const { apiKeyLabel, service } = options;
    const sdk = new Anthropic(options.anthropic ?? {});
    const record = createRecorder(options.meter);
    return {
        /** Direct access to the underlying SDK if you need APIs the wrapper
         *  doesn't expose yet (beta endpoints, raw HTTP, etc.). Calls made
         *  through this escape hatch are NOT recorded — prefer the wrapped
         *  methods below. */
        raw: sdk,
        messages: {
            create: async (params, context) => {
                const start = Date.now();
                const response = await sdk.messages.create(params);
                // If streaming was requested, response is an AsyncIterable and we
                // can't capture usage here. Skip recording — callers wanting to meter
                // streamed responses should accumulate usage themselves and call
                // recordCost() manually.
                if (Symbol.asyncIterator in response) {
                    return response;
                }
                // Non-streaming Message response
                const msg = response;
                const usage = msg.usage;
                const model = typeof params.model === "string" ? params.model : String(params.model);
                const pricing = getPricing(model);
                const inputTokens = usage.input_tokens ?? 0;
                const outputTokens = usage.output_tokens ?? 0;
                const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
                const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
                const costUsd = pricing
                    ? computeCostUsd(pricing, { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens })
                    : 0;
                const row = {
                    model,
                    api_key_label: apiKeyLabel,
                    service,
                    job_kind: context.jobKind,
                    input_tokens: inputTokens,
                    output_tokens: outputTokens,
                    cache_read_tokens: cacheReadTokens,
                    cache_creation_tokens: cacheCreationTokens,
                    cost_usd: costUsd,
                    job_ref: context.jobRef ?? null,
                    shop: context.shop ?? null,
                    user_id: context.userId ?? null,
                    duration_ms: Date.now() - start,
                    metadata: pricing
                        ? (context.metadata ?? null)
                        : { ...(context.metadata ?? {}), pricing_warning: `unknown model: ${model}` },
                };
                // Fire-and-forget — no await. Recording failures never block the response.
                void record(row);
                return response;
            },
        },
    };
}
/**
 * Lower-level helper for recording a cost row manually. Use this when you
 * need to meter a streamed response, a custom HTTP call, or a non-Anthropic
 * model that you still want in the cost report.
 */
export { createRecorder } from "./recorder.js";
export { getPricing, computeCostUsd } from "./pricing.js";
//# sourceMappingURL=index.js.map