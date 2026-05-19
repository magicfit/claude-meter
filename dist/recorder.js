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
export function createRecorder(config = {}) {
    const url = config.url ?? process.env.MAGICFIT_METER_URL;
    const token = config.token ?? process.env.MAGICFIT_METER_TOKEN;
    const logger = config.logger ?? ((msg, details) => {
        if (details !== undefined) {
            console.warn(`[claude-meter] ${msg}`, details);
        }
        else {
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
    return function record(row) {
        if (!isConfigured || !url || !token)
            return Promise.resolve();
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
            .catch((err) => {
            logger("Recorder POST threw", err);
        });
    };
}
//# sourceMappingURL=recorder.js.map