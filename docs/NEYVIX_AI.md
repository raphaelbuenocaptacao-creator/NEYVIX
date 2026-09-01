# NEYVIX AI

## Current architecture

`Browser -> NEYVIX /api/ai -> n8n production webhook -> Google Gemini -> n8n -> NEYVIX -> Browser`

The browser never receives the Gemini API key or the n8n production webhook URL. The NEYVIX server is the only supported gateway client.

## Required production environment variables

Configure the deployment environment with both values:

```text
NEYVIX_AI_GATEWAY_URL=<n8n production webhook HTTPS URL>
NEYVIX_AI_GATEWAY_SECRET=<shared server-to-server secret>
```

Do not prefix either variable with `NEXT_PUBLIC_`. Both values are server-only. The n8n webhook must validate the same bearer secret before invoking any model or downstream workflow.

NEYVIX intentionally fails closed when the URL is not HTTPS or when the shared secret is absent. `/api/health/intelligence` reports the gateway as ready only when both are configured.

## API contract

Authenticated NEYVIX users call:

```http
POST /api/ai
Content-Type: application/json

{"prompt":"Sua pergunta"}
```

Successful response:

```json
{"answer":"Resposta gerada pela NEYVIX AI","memoryUsed":0}
```

## Security implemented

- Requires an active NEYVIX ID session before proxying a request.
- Applies durable account-scoped rate limiting.
- Keeps gateway URL and secret server-side.
- Requires HTTPS plus an authenticated Bearer header for every upstream AI request.
- Validates input and limits prompts to 4,000 characters.
- Limits upstream responses to 24,000 characters.
- Uses a 45-second upstream timeout.
- Sends only a pseudonymous hash as the gateway user identifier.
- Keeps authenticated AI responses `no-store` with `no-referrer`.
- Does not log upstream response bodies on gateway errors.
- Uses NEYVIX Memory only on explicit request and only when `NEYVIX_MEMORY_AI_CONTEXT=true`; private memories are never included.

## Before public launch

1. Record privacy-preserving request usage for quotas and abuse monitoring without storing private prompt content by default.
2. Add trial credits and plan-based AI limits.
3. Add moderation/safety controls appropriate to the products enabled in NEYVIX Studio.
4. Pin the production model instead of relying indefinitely on a preview model.
5. Add structured JSON responses for NEYVIX Studio workflows.

## NEYVIX Studio next milestone

The first Studio pipeline should be:

`Prompt -> specification -> generated project plan -> files/code generation -> isolated validation -> repository -> NEYVIX Deploy preview`

Code execution must happen in an isolated sandbox, never inside the main NEYVIX application process.
