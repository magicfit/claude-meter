/**
 * Fire-and-forget recorder that POSTs cost data to a Supabase REST endpoint.
 *
 * Failure modes:
 * - Network error or non-2xx response: logged via the supplied logger, then swallowed.
 *   The wrapper NEVER throws from recording failures — cost tracking must not
 *   break the actual Claude call.
 * - Missing env vars: silently no-op. Lets local dev / tests run without the
 *   metrics infra set up.
 */
export interface MeterConfig {
    /** Full Supabase REST URL for the claude_call_costs table.
     *  e.g. https://<project>.supabase.co/rest/v1/claude_call_costs
     *  Falls back to process.env.MAGICFIT_METER_URL. */
    url?: string;
    /** Supabase anon (publishable) key. Granted INSERT-only by RLS on the table.
     *  Falls back to process.env.MAGICFIT_METER_TOKEN. */
    token?: string;
    /** Optional logger for recorder failures. Defaults to console.warn.
     *  Set to () => {} to silence completely. */
    logger?: (message: string, details?: unknown) => void;
}
export interface CostRow {
    model: string;
    api_key_label: string;
    service: string;
    job_kind: string;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
    cost_usd: number;
    job_ref?: string | null;
    shop?: string | null;
    user_id?: string | null;
    duration_ms?: number | null;
    metadata?: Record<string, unknown> | null;
}
export declare function createRecorder(config?: MeterConfig): (row: CostRow) => Promise<void>;
//# sourceMappingURL=recorder.d.ts.map