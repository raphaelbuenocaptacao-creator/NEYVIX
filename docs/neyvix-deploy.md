# NEYVIX Deploy

NEYVIX Deploy is the deployment platform of the NEYVIX ecosystem. Its goal is to let a user connect a Git repository, detect the application, build it in an isolated runner, publish it, attach domains, manage environment variables and inspect logs.

## MVP flow

1. Sign in with NEYVIX ID.
2. Connect GitHub.
3. Select repository and branch.
4. Detect framework and build command.
5. Create a project.
6. Queue an isolated build.
7. Store build artifact.
8. Publish deployment.
9. Assign a generated NEYVIX deployment URL.
10. Trigger automatic redeploys on future pushes.

## Core services

- Control Plane: projects, teams, deployments, domains, environment variables and permissions.
- Git Integrations: repository access, webhooks and commit metadata.
- Build Orchestrator: queues jobs, assigns runners and tracks status.
- Isolated Runners: ephemeral containers used to install dependencies and build code.
- Artifact Store: immutable build outputs and metadata.
- Runtime Layer: serves static assets and runs application workloads.
- Edge/DNS Layer: TLS, custom domains, routing and caching.
- Logs & Observability: build logs, runtime logs, health and deployment events.
- Secrets Service: encrypted environment variables with scoped access.

## Initial stack

- Control plane: Next.js + TypeScript
- Database: PostgreSQL
- Queue: managed Redis/queue initially
- Build isolation: containers
- Artifact storage: S3-compatible object storage
- Runtime: containers/functions depending on framework
- DNS/TLS: managed provider initially
- Source control: GitHub first

## Data model

Main entities: users, organizations, projects, git_connections, repositories, deployments, deployment_events, build_jobs, domains, environment_variables, runtime_logs and audit_logs.

## Security rules

- Never expose secret values after creation.
- Every build runs in a disposable isolated environment.
- Repository tokens are encrypted and scoped.
- Production deployments require explicit project permission.
- Build artifacts are immutable.
- Every sensitive action is written to an audit log.
- Resource limits are enforced per build and runtime.

## Product phases

### Phase 1 — MVP
GitHub connection, project import, framework detection, build queue, deployment history, generated URL and logs.

### Phase 2 — Production platform
Custom domains, TLS, environment variables, preview deployments, rollback, teams and usage limits.

### Phase 3 — NEYVIX Cloud
Multi-region runtime, functions, edge caching, databases, storage, observability and billing.

## Principle

NEYVIX Deploy should own the developer experience first. Infrastructure underneath may initially use third-party cloud services. Components can be internalized as usage grows.
