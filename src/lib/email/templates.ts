import { formatWhen } from "../format";
import type { ReminderKind } from "../domain/reminders";

function shell(input: { title: string; preheader: string; body: string }) {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#F5F7FA;font-family:Arial,Helvetica,sans-serif;color:#14243A;">
  <div style="display:none;max-height:0;overflow:hidden;">${input.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FA;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#10263E;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:700;">RepPilot AI</td></tr>
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${input.title}</h1>
          ${input.body}
        </td></tr>
      </table>
      <p style="max-width:560px;color:#66758B;font-size:12px;line-height:1.5;">This message is about a scheduled educational lunch. It is not a marketing list. Reply to your representative if you need a change.</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:20px 0;"><a href="${href}" style="background:#19B78A;color:#06281f;text-decoration:none;padding:12px 18px;border-radius:10px;display:inline-block;font-weight:700;">${label}</a></p>`;
}

export function renderReminderEmail(input: {
  kind: ReminderKind;
  officeName: string;
  repName: string;
  organizationName: string;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  attendees: number;
  confirmUrl?: string;
}) {
  const when = formatWhen(input.startsAt, input.timeZone);
  const until = formatWhen(input.endsAt, input.timeZone).split("·")[1]?.trim() ?? "";
  if (input.kind === "SEVEN_DAY") {
    const text = `Hi ${input.officeName},\n\nWe're looking forward to our upcoming educational lunch.\n\n${when}${until ? ` – ${until}` : ""}\nExpected attendees: ${input.attendees}\nRepresentative: ${input.repName}\n\nNo action is required.\n\nThank you,\n${input.repName}\n${input.organizationName}`;
    return {
      subject: `Upcoming educational lunch — ${input.officeName}`,
      text,
      html: shell({
        title: "Your educational lunch is on the calendar",
        preheader: `${input.officeName} · ${when}`,
        body: `<p>Hi ${input.officeName},</p><p>We're looking forward to our upcoming educational lunch.</p><p><strong>${when}</strong><br/>Expected attendees: ${input.attendees}<br/>Representative: ${input.repName}</p><p>No action is required. This is a reminder only.</p><p>Thank you,<br/>${input.repName}<br/>${input.organizationName}</p>`,
      }),
    };
  }
  if (input.kind === "NONRESPONSE_24H") {
    const text = `${input.officeName} has not confirmed the educational lunch scheduled ${when}. The appointment was not canceled.`;
    return {
      subject: `Lunch still unconfirmed — ${input.officeName}`,
      text,
      html: shell({
        title: "No confirmation yet",
        preheader: text,
        body: `<p>${text}</p><p>The office did not receive a rejection, and the lunch remains on your calendar until you change it.</p>`,
      }),
    };
  }
  const confirm = input.confirmUrl ?? "";
  const text = `Hi ${input.officeName},\n\nPlease confirm your educational lunch.\n\n${when}\nExpected attendees: ${input.attendees}\nRepresentative: ${input.repName}\n\nConfirm: ${confirm}\n\nThank you,\n${input.repName}\n${input.organizationName}`;
  return {
    subject: `Please confirm your educational lunch — ${input.officeName}`,
    text,
    html: shell({
      title: "Please confirm your upcoming lunch",
      preheader: `${input.officeName} · ${when}`,
      body: `<p>Hi ${input.officeName},</p><p>We're looking forward to our upcoming educational lunch.</p><p><strong>${when}</strong><br/>Expected attendees: ${input.attendees}</p><p>Please confirm your office is ready.</p>${confirm ? button(confirm, "Confirm Lunch") : ""}<p>Need to make a change? Use the confirmation page to request a different arrangement, or contact ${input.repName}.</p><p>Thank you,<br/>${input.repName}<br/>${input.organizationName}</p>`,
    }),
  };
}

export function renderInvitationEmail(input: {
  officeName: string;
  repName: string;
  organizationName: string;
  purpose: string;
  url: string;
}) {
  const text = `Hi ${input.officeName},\n\n${input.repName} from ${input.organizationName} invited you to choose a time for an educational lunch.\n\n${input.purpose}\n\nView offered times: ${input.url}\n\nThis link only includes times ${input.repName} already approved.`;
  return {
    subject: `Choose a time for an educational lunch — ${input.officeName}`,
    text,
    html: shell({
      title: "Choose an offered time",
      preheader: `${input.repName} invited ${input.officeName}`,
      body: `<p>Hi ${input.officeName},</p><p>${input.repName} from ${input.organizationName} invited your office to choose a time.</p><p>${input.purpose}</p>${button(input.url, "View offered times")}<p>This link only includes times your representative already approved. It cannot be used to book a different day.</p>`,
    }),
  };
}
