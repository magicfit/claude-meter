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

export function createRecorder(config: MeterConfig = {}) {
  const url = config.url ?? process.env.MAGICFIT_METER_URL;
  const token = config.token ?? process.env.MAGICFIT_METER_TOKEN;
  const logger = config.logger ?? ((msg, details) => {
    if (details !== undefined) {
      console.warn(`[claude-meter] ${msg}`, details);
    } else {
      console.warn(`[claude-meter] ${msg}`);
    }
  });

  const isConfigured = Boolean(url && token);
  if (!isConfigured) {
    logger("MAGICFIT_METER_URL or MAGICFIT_METER_TOKEN not set — cost recording disabled.");
  }

  /**
   * Records a single cost row. Always returns a resolved promise (never throws).
   * Safe to call without awaiting — recorder failures don't affect the caller.
   */
  return function record(row: CostRow): Promise<void> {
    if (!isConfigured || !url || !token) return Promise.resolve();

    return fetch(url, {
      method: "POST",
      headers: {
        apikey: token,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    })
      .then((res) => {
        if (!res.ok) {
          return res.text().then((body) => {
            logger(`Recorder POST failed (${res.status})`, body.slice(0, 500));
          });
        }
      })
      .catch((err: unknown) => {
        logger("Recorder POST threw", err);
      });
  };
}
