import "dotenv/config";

const to = (process.env.TEST_EMAIL_TO || "").trim().toLowerCase();
const apiKey = process.env.RESEND_API_KEY || "";
const from = process.env.EMAIL_FROM || "";

if (!apiKey || !to || !from) {
  console.error("Set RESEND_API_KEY, EMAIL_FROM, and TEST_EMAIL_TO. No email was sent.");
  process.exit(2);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  console.error("TEST_EMAIL_TO is not an email address. No email was sent.");
  process.exit(2);
}
const blocked = ["example.com", "example-health.test", "reppilot.demo"];
if (blocked.some((domain) => to.endsWith(`@${domain}`))) {
  console.error("TEST_EMAIL_TO must be an authorized inbox you control, not a seeded office address. No email was sent.");
  process.exit(2);
}

async function main() {
  const idempotencyKey = `reppilot-transport-test:${to}:${new Date().toISOString().slice(0, 16)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "RepPilot staging transport test",
      text: "This message confirms Resend can deliver a RepPilot operational email. No clinic was contacted.",
      html: "<p>This message confirms Resend can deliver a RepPilot operational email. No clinic was contacted.</p>",
    }),
  });

  if (!response.ok) {
    console.error(`Resend returned ${response.status}. No clinic was contacted.`);
    process.exit(1);
  }
  const body = (await response.json()) as { id?: string };
  console.log(`Test email accepted by Resend${body.id ? ` (${body.id})` : ""}. Recipient: ${to}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Test email failed. No clinic was contacted.");
  process.exit(1);
});
