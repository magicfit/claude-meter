# @magicfit/claude-meter

A thin cost-tracking wrapper around the [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript). Every `messages.create()` call is recorded to a central Supabase table with rich attribution (service, job kind, shop, etc.) so org-wide spend can be analyzed, reported, and alerted on.

## Why

- One canonical wrapper means **every Anthropic call across magicfit gets metered automatically** — portal techpack extraction, future SDK runtime calls, GitHub PR reviews, scripts, etc.
- Each row carries enough context to answer questions like _"what does Boody's onboarding cost in techpack tokens?"_ or _"which `job_kind` is climbing fastest week-over-week?"_
- Cost recording is **fire-and-forget** — recorder failures never throw, never block, never affect the actual Claude call.

## Install

```bash
npm install github:magicfit/claude-meter#main
# Or pin to a tag:
npm install github:magicfit/claude-meter#v0.1.0
```

Peer dep: `@anthropic-ai/sdk >= 0.60.0`.

## Setup

Set two env vars on every deployment that uses the wrapper:

```bash
MAGICFIT_METER_URL=https://mjjzzbriqvdyfycqajvh.supabase.co/rest/v1/claude_call_costs
MAGICFIT_METER_TOKEN=<the magicfit-project-manager Supabase anon key>
```

The anon key is INSERT-only on the `claude_call_costs` table (enforced by RLS), so it's safe to expose to server runtimes. It cannot read existing rows.

If either var is unset, the wrapper logs a one-time warning and silently disables recording — useful for local dev.

## Usage

```typescript
import { createMeteredClient } from "@magicfit/claude-meter";

const claude = createMeteredClient({
  apiKeyLabel: "portal-techpack-extraction",   // appears in cost reports
  service: "magicfit-client-portal",
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
});

const response = await claude.messages.create(
  {
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: "..." }],
  },
  {
    jobKind: "techpack-extraction",
    jobRef: `shop:${shop}/product:${productId}`,
    shop,
  }
);
```

The only difference from the raw SDK is the second arg — a `ClaudeJobContext` object describing what the call is for.

### Fields

| Field | Required | Notes |
|---|---|---|
| `jobKind` | yes | High-level category. Keep stable so trend analysis works. |
| `jobRef` | optional | Per-job identifier. Free-form string. |
| `shop` | optional | Tenant identifier when shop-scoped. Enables per-shop breakdowns. |
| `userId` | optional | When a human triggered the call directly. |
| `metadata` | optional | Arbitrary JSON for additional context. |

## Anti-bypass

To stop direct SDK usage from sneaking in, add this to each consumer's ESLint config:

```json
{
  "rules": {
    "no-restricted-imports": ["error", {
      "paths": [{
        "name": "@anthropic-ai/sdk",
        "message": "Use createMeteredClient() from @magicfit/claude-meter so cost tracking works."
      }]
    }]
  }
}
```

(Allow the import only inside whatever wrapper layer the consumer uses internally.)

## What's NOT recorded

- Streamed responses (`messages.stream()`) — usage isn't available until the stream completes; record manually using `createRecorder` if you need this.
- Direct calls via `client.raw.*` — that's the escape hatch when you need an SDK feature the wrapper doesn't expose yet. Use sparingly and meter manually.
- Beta API endpoints not exposed through `.messages.create`.

## The data shape

Cost rows land in `public.claude_call_costs` in the `magicfit-project-manager` Supabase project:

| Column | Type | Notes |
|---|---|---|
| `id`, `created_at` | uuid, timestamptz | Auto |
| `model` | text | e.g. `claude-sonnet-4-6` |
| `api_key_label` | text | Caller-set label |
| `service` | text | Caller-set service id |
| `job_kind` | text | Caller-set work category |
| `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens` | int | From `response.usage` |
| `cost_usd` | numeric(10,6) | Computed from tokens × `pricing.ts` |
| `job_ref`, `shop`, `user_id`, `duration_ms`, `metadata` | optional context | |

## Pricing maintenance

Pricing lives in [`src/pricing.ts`](./src/pricing.ts). When Anthropic changes prices or adds models, update that file and tag a new release. Unknown models record with `cost_usd = 0` and a `pricing_warning` in `metadata` so the gap is visible during ops review (rather than crashing the call).

## License

UNLICENSED — internal magicfit use.
