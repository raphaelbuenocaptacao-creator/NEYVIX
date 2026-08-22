# NEYVIX Architecture

## Goal
NEYVIX is designed as a connected digital ecosystem with one shared identity and a common platform layer. Products should be able to launch independently while reusing identity, security, audit, notifications, storage and organization concepts.

## Current stack
- Next.js 16 + React 19 + TypeScript
- PostgreSQL / Neon target database
- Vercel target runtime
- GitHub source control and CI

## Platform layers

### Identity layer
NEYVIX ID owns users, sessions, security events and product memberships. Every product references the same user identity rather than maintaining isolated accounts.

### Communication layer
NEYVIX Mail is the first communication product. Chat and Meet share identity and conversation/meeting concepts but remain separate product surfaces.

### Productivity layer
NEYVIX Drive owns file/folder metadata and storage references. NEYVIX Docs links versioned collaborative documents to Drive items.

### Social layer
NEYVIX Social uses the shared identity and adds profile, post and follow-graph data.

### Intelligence layer
NEYVIX AI is provider-neutral. Product features can call an AI adapter while the platform records safe request/output metadata for observability and cost tracking. Prompts, credentials and private content must not be written into audit metadata by default.

### Developer infrastructure
NEYVIX Deploy models Git-connected projects and immutable deployments. NEYVIX Cloud is an abstraction for provider-backed infrastructure resources. Provisioning must be explicit and auditable; no secret values should be stored in application tables.

### Business layer
NEYVIX Business provides organizations, members and roles. Product permissions can later be scoped to both user and organization.

### Financial architecture
NEYVIX Pay currently defines an internal wallet/ledger architecture only. It does not create bank accounts, acquire cards, custody funds or move real money. Regulated payment functionality requires a licensed provider/partner, compliance controls, reconciliation and legal review before activation.

## Database strategy
- `database/schema.sql` contains the initial ID/Mail/Admin foundation.
- `database/002_ecosystem.sql` contains additive ecosystem tables for Chat, Meet, Social, Drive, Docs, Deploy, Cloud, Business, Pay architecture and AI observability.
- Production migrations should be tested on an isolated Neon branch before being applied to the production branch.
- The connected Neon database currently belongs to another application and must not be reused for NEYVIX.

## Deployment strategy
1. Create/link a dedicated Vercel project for the NEYVIX repository.
2. Provision a dedicated Neon project/database for NEYVIX.
3. Configure required environment variables without exposing secret values in GitHub.
4. Apply the base schema and ecosystem migration on an isolated database branch first.
5. Run `npm run typecheck` and `npm run build` through GitHub Actions.
6. Deploy a preview and verify `/api/health`, `/api/status`, registration, login, Mail, Admin and Deploy routes.
7. Promote only after verification.

## Security rules
- Never commit credentials, API keys, database passwords or private tokens.
- Store only password hashes and token hashes where application-managed authentication is used.
- Audit privileged actions and security-relevant events.
- Keep payment functionality inactive until regulated infrastructure exists.
- Prefer least-privilege provider tokens and separate preview/production credentials.
- Treat AI providers as external data processors; minimize sensitive data sent to them.

## Product status semantics
- **Foundation:** route and/or core data model exists.
- **MVP:** usable early product surface exists, but provider integration may still be incomplete.
- **Schema ready:** backend data contract is defined; full product UI/workflow is not complete.
- **Integration ready:** provider-neutral integration boundary/audit model exists.
- **Architecture only:** conceptual and data architecture exists; the service is intentionally not activated.
