import { prisma } from "@/lib/db";
import { processDueReminders } from "@/lib/services/reminders";
import { deliverEmail } from "@/lib/email/send";
import { renderReminderEmail } from "@/lib/email/templates";
import { appUrl } from "@/lib/permissions";

export async function POST(request: Request) {
  return run(request);
}

export async function GET(request: Request) {
  return run(request);
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await processDueReminders(prisma, new Date(), {
    appUrl: appUrl(),
    render: renderReminderEmail,
    send: deliverEmail,
  });
  await prisma.rateLimitBucket.upsert({where:{key:"operational:reminders:last-success"},create:{key:"operational:reminders:last-success",count:results.length,resetAt:new Date(Date.now()+15*60000)},update:{count:results.length,resetAt:new Date(Date.now()+15*60000)}});
  return Response.json({ processed: results.length, results });
}
