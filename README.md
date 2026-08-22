# NEYVIX

NEYVIX is a global digital ecosystem built around one identity and a connected family of products.

## Vision
**One identity. Your digital world.**

NEYVIX starts with identity and communication, then expands into social, AI, productivity, business, payments architecture and developer infrastructure.

## Implemented foundation
- **NEYVIX ID** — registration, login, signed sessions and encrypted preview account storage
- **NEYVIX Mail** — mailbox/thread/message/attachment/contact data model and product surface
- **NEYVIX Admin** — operations/security/audit product surface
- **NEYVIX Deploy** — Git-to-deploy MVP surface plus project/deployment schema
- **Platform status API** — `/api/health` and `/api/status`
- **Ecosystem status page** — `/ecosystem`
- **CI** — TypeScript validation and production build on push/PR
- **Security baseline** — shared production response headers, HttpOnly cookies and AES-256-GCM protection for the temporary browser-stored account payload

## Database-ready modules
`database/002_ecosystem.sql` adds the backend foundation for:
- NEYVIX Chat
- NEYVIX Meet
- NEYVIX Social
- NEYVIX AI integration audit metadata
- NEYVIX Drive
- NEYVIX Docs
- NEYVIX Business
- NEYVIX Deploy / Cloud
- NEYVIX Pay wallet + ledger architecture

The Pay schema is architecture only. No regulated banking, custody, card acquiring or real-money movement is implemented.

## Architecture
- Next.js 16 + React 19 + TypeScript
- PostgreSQL / Neon target database
- Vercel target runtime
- GitHub CI
- API-first product boundaries
- Shared identity, security, audit and organization layers

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for platform boundaries, deployment strategy and security rules.

## Configuration
Copy `.env.example` and provide a production `NEYVIX_SESSION_SECRET`. A dedicated `DATABASE_URL` must point only to the NEYVIX database; do not reuse another application's database.

## Current deployment blockers
The connected Vercel account currently exposes only `aureonbase`; no NEYVIX project is linked. The connected Neon resource is also associated with another application. For safety, no schema changes were applied to that database.

Because of that isolation rule, NEYVIX ID currently uses an encrypted browser cookie as a functional preview store. Production auth still requires a dedicated NEYVIX Postgres database.

## Next priority
1. Provision/link dedicated NEYVIX Vercel + Neon resources without reusing another product's data.
2. Apply and verify database migrations on an isolated Neon branch.
3. Replace preview account storage with PostgreSQL-backed identity persistence.
4. Make Mail persistence functional end-to-end.
5. Turn Deploy from static MVP surface into provider-backed deployment orchestration.
6. Add Chat as the next working vertical slice.

## Product principles
1. One NEYVIX ID across every product.
2. Security and privacy by design.
3. Mobile-first and simple enough for anyone to use.
4. Shared design system and shared platform services.
5. Products launch independently but work better together.
6. Financial services only launch with the required regulated infrastructure.

## Domain
`neyvix.com` is a naming target. Domain availability and trademark clearance must be independently confirmed before public launch.

## Status
NEYVIX foundation in active development — August 2026.
