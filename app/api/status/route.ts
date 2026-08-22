const modules = {
  id: 'foundation',
  mail: 'foundation',
  admin: 'foundation',
  deploy: 'mvp',
  chat: 'schema-ready',
  meet: 'schema-ready',
  social: 'schema-ready',
  ai: 'integration-ready',
  drive: 'schema-ready',
  docs: 'schema-ready',
  business: 'schema-ready',
  pay: 'architecture-only',
  cloud: 'architecture-only',
} as const;

export async function GET() {
  return Response.json({
    ok: true,
    service: 'NEYVIX',
    version: '0.1.0',
    readiness: {
      app: true,
      ci: true,
      databaseSchema: true,
      productionDatabaseVerified: false,
      vercelProjectVerified: false,
    },
    modules,
    timestamp: new Date().toISOString(),
  });
}
