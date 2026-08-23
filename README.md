# NEYVIX

NEYVIX is a connected digital ecosystem built around one identity, intelligence and execution layer.

## Vision
**One identity. Your digital world.**

The current product foundation connects identity, AI, product creation, content, automation, real-estate site creation, mail, deployment and administration under one Command Center.

## Implemented foundation
- **NEYVIX ID** — registration, login, signed sessions, PostgreSQL-first identity and encrypted preview fallback
- **NEYVIX AI** — authenticated HTTPS gateway, timeout/validation, persisted user + assistant messages
- **NEYVIX Studio** — blueprint workspace with persisted project history
- **NEYVIX Content** — content workspace with persisted history
- **NEYVIX Automation** — protected workspace with authenticated create/list APIs and human approve/reject actions
- **NEYVIX Estate** — authenticated real-estate website builder, multi-property catalog, image URLs, persisted project history, draft/publish state, custom-domain field and public published-site route at `/s/[slug]`
- **NEYVIX Mail** — authenticated inbox backed by persisted messages when Mail tables are available; outbound delivery is not enabled yet
- **NEYVIX Admin / User 360** — superadmin-only operations surface with identity, trial, AI, Studio and Content activity
- **NEYVIX Deploy** — Git/deployment product surface; provider-backed orchestration remains pending
- **Command Center** — role-aware module navigation, trial status and real activity timeline
- **PWA** — native manifest, standalone mode, install metadata, NEYVIX icons, service worker and app shortcuts
- **Platform health** — `/api/health` for database/project health and `/api/status` for runtime readiness
- **CI** — dependency audit, TypeScript validation and production `next build` on push/PR
- **Security baseline** — HttpOnly signed sessions, production secret enforcement, admin authorization, response security headers, bounded API payloads and no-store identity/data endpoints

## Runtime stack
- Next.js 16.3.2 + React 19 + TypeScript
- PostgreSQL / Neon
- Vercel target runtime
- GitHub Actions CI
- `@neondatabase/serverless`
- API-first product boundaries

## Database migrations
Apply migrations only to a dedicated NEYVIX database and review them before production:

1. `database/schema.sql` — legacy identity + Mail foundation
2. `database/002_ecosystem.sql` — Chat, Meet, Social, Drive, Docs, Business, Deploy/Cloud and Pay architecture
3. `database/003_automation_approvals.sql` — Automation runs and human approvals
4. `database/004_runtime_core.sql` — compatibility layer plus current ID/trial/AI/Studio/Content runtime model
5. `database/005_estate.sql` — NEYVIX Estate sites, globally reserved subdomain slugs and property catalog persistence

The Pay schema is architecture only. No regulated banking, custody, card acquiring or real-money movement is implemented.

## Configuration
Copy `.env.example` and configure at minimum:
- `DATABASE_URL` — dedicated NEYVIX PostgreSQL database
- `NEYVIX_SESSION_SECRET` — long random production secret
- `NEYVIX_AI_GATEWAY_URL` — HTTPS gateway used by NEYVIX AI

Mail delivery additionally requires a provider decision and credentials. Do not commit production secrets.

## Verified in CI
The repository is validated with Node.js 22, dependency security audit, strict TypeScript and a production Next.js build. PWA wiring and the first NEYVIX Estate implementation have both passed the NEYVIX CI during the August 23, 2026 validation runs.

## Current external blockers
- **Vercel:** GitHub is now receiving successful NEYVIX deployment status checks, but the connected `rbs consultoria` Vercel account still exposes only `aureonbase` through the available integration, so the production URL cannot yet be independently resolved here.
- **Neon connector:** the connected Neon organization currently exposes no NEYVIX project through the available integration. Database migrations therefore remain versioned in Git and are not force-applied to an unidentified database.
- **Mail delivery:** inbox persistence is wired, but external inbound/outbound transport still needs a mail provider.

## Next production priorities
1. Resolve direct Vercel project visibility and confirm the public NEYVIX production URL.
2. Restore access to the dedicated NEYVIX Neon project, then safely apply/test migrations through `005_estate.sql`.
3. Validate `/api/health`, `/api/status`, registration/login, trial, AI, Studio, Content, Estate, Mail and Automation in production.
4. Connect a production mail transport.
5. Add subscription billing provider/webhooks after identity + deployment + database are stable.
6. Add managed media upload/storage for Estate so users do not need to paste external image URLs.
7. Add custom-domain provisioning and wildcard-subdomain routing for `*.neyvix.site`.

## Product principles
1. One NEYVIX ID across every product.
2. Security and privacy by design.
3. Mobile-first, understandable interfaces.
4. Shared design system and shared platform services.
5. Products launch independently but work better together.
6. High-impact actions remain observable and, where appropriate, approval-gated.
7. Financial services only launch with required regulated infrastructure.

## Domain
`neyvix.com` and `neyvix.site` are naming targets. Domain availability and trademark clearance must be independently confirmed before public launch.

## Status
NEYVIX foundation in active beta development — August 2026.
