# NEYVIX AI

## Current architecture

`Browser -> NEYVIX /api/ai -> n8n production webhook -> Google Gemini -> n8n -> NEYVIX -> Browser`

The browser never needs the Gemini API key and should not call the n8n production webhook directly.

## Required production environment variable

Configure the deployment environment with:

```text
NEYVIX_AI_GATEWAY_URL=<n8n production webhook URL>
```

Do not prefix this variable with `NEXT_PUBLIC_`. The URL is consumed only by the NEYVIX server route.

## API contract

Authenticated NEYVIX users call:

```http
POST /api/ai
Content-Type: application/json

{"prompt":"Sua pergunta"}
```

Successful response:

```json
{"answer":"Resposta gerada pela NEYVIX AI"}
```

## Security already implemented

- Requires an active NEYVIX ID session before proxying a request.
- Keeps the n8n gateway URL on the server.
- Validates input and limits prompts to 4,000 characters.
- Enforces HTTPS for the upstream gateway.
- Uses a 45-second upstream timeout.
- Does not expose the Gemini API key to the browser.

## Before public launch

1. Add rate limiting per NEYVIX account/IP using a durable store.
2. Protect the n8n production webhook with a secret/header and configure the same secret server-side.
3. Record request usage (not private prompt content by default) for quotas and abuse monitoring.
4. Add trial credits and plan-based AI limits.
5. Add moderation/safety controls appropriate to the products enabled in NEYVIX Studio.
6. Pin a production Gemini model instead of relying indefinitely on a preview model.
7. Add structured JSON responses for NEYVIX Studio workflows.

## NEYVIX Studio next milestone

The first Studio pipeline should be:

`Prompt -> specification -> generated project plan -> files/code generation -> isolated validation -> repository -> NEYVIX Deploy preview`

Code execution must happen in an isolated sandbox, never inside the main NEYVIX application process.
