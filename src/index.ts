import Anthropic from "@anthropic-ai/sdk";
import type { ClientOptions } from "@anthropic-ai/sdk";
import { getPricing, computeCostUsd } from "./pricing.js";
import { createRecorder, type CostRow, type MeterConfig } from "./recorder.js";

export type { ModelPricing } from "./pricing.js";
export type { CostRow, MeterConfig } from "./recorder.js";

/**
 * Context attached to a single API call for attribution purposes.
 *
 * Every cost row records WHO called the API and WHAT for, so a future
 * cost-analysis agent can drill down past raw totals into per-shop /
 * per-feature spend.
 */
export interface ClaudeJobContext {
  /** What kind of work this call is doing.
   *  Examples: 'techpack-extraction', 'fit-recommendation', 'pr-review',
   *  'image-classification', 'return-reason-inference'. */
  jobKind: string;
  /** Caller-defined reference identifying the specific job.
   *  Examples: 'shop:foo/product:123', 'pr:281'. Optional but
   *  recommended for any per-job analysis later. */
  jobRef?: string;
  /** Tenant identifier when the work is shop-scoped. Enables
   *  per-shop spend breakdowns. */
  shop?: string;
  /** End-user identifier when a human triggered the call directly. */
  userId?: string;
  /** Any extra context worth storing for later analysis. */
  metadata?: Record<string, unknown>;
}

export interface MeteredClientOptions {
  /** Human-readable label for the API key in use.
   *  Examples: 'portal-techpack-extraction', 'pr-review', 'sdk-runtime'.
   *  This is what shows up in cost reports — NOT the key value itself. */
  apiKeyLabel: string;
  /** Which service owns the call.
   *  Examples: 'magicfit-client-portal', 'magicfit-github-actions',
   *  'magicfit-sdk'. */
  service: string;
  /** Anthropic SDK client options (apiKey, timeout, etc.).
   *  Passed straight through to `new Anthropic(...)`. */
  anthropic?: ClientOptions;
  /** Optional override for the recorder config. Falls back to
   *  MAGICFIT_METER_URL / MAGICFIT_METER_TOKEN env vars. */
  meter?: MeterConfig;
}

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
export function createMeteredClient(options: MeteredClientOptions) {
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
      create: async (
        params: Parameters<typeof sdk.messages.create>[0],
        context: ClaudeJobContext,
      ) => {
        const start = Date.now();
        const response = await sdk.messages.create(params);

        // If streaming was requested, response is an AsyncIterable and we
        // can't capture usage here. Skip recording — callers wanting to meter
        // streamed responses should accumulate usage themselves and call
        // recordCost() manually.
        if (Symbol.asyncIterator in (response as object)) {
          return response;
        }

        // Non-streaming Message response
        const msg = response as Anthropic.Messages.Message;
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

        const row: CostRow = {
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
