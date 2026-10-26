import { prisma } from "@/lib/db";
import { reportError } from "@/lib/monitoring";

export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      ok: true,
      service: "reppilot",
      database: "up",
      emailConfigured: Boolean(process.env.RESEND_API_KEY),
      monitoringConfigured: Boolean(process.env.SENTRY_DSN),
      scheduler: "vercel-cron:/api/cron/reminders",
      elapsedMs: Date.now() - started,
    });
  } catch (error) {
    await reportError(error, { route: "/api/health" });
    return Response.json({ ok: false, service: "reppilot", database: "down" }, { status: 503 });
  }
}
