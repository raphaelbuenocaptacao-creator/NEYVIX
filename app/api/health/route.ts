export async function GET() {
  return Response.json({
    ok: true,
    service: 'NEYVIX',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
}
