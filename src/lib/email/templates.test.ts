import { expect, it } from "vitest";
import { escapeHtml, renderInvitationEmail, renderReminderEmail } from "./templates";

it("keeps practice-provided markup out of invitation HTML without changing plain text", () => {
  const name = '<img src=x onerror="alert(1)">';
  const message = renderInvitationEmail({ officeName: name, repName: name, organizationName: name, purpose: name, url: 'https://example.test/invite?x="&y=1' });
  expect(message.text).toContain(name);
  expect(message.html).not.toContain("<img");
  expect(message.html).toContain(escapeHtml(name));
  expect(message.html).toContain('href="https://example.test/invite?x=&quot;&amp;y=1"');
});
it.each(["SEVEN_DAY", "TWENTY_FOUR_HOUR", "DELIVERY_DAY", "NONRESPONSE_24H", "FORTY_EIGHT_HOUR"] as const)("escapes dynamic content in %s reminders", (kind) => {
  const message = renderReminderEmail({ kind, officeName: "<b>Office</b>", repName: "<i>Rep</i>", organizationName: "<img>", startsAt: new Date("2026-11-12T18:00:00Z"), endsAt: new Date("2026-11-12T19:00:00Z"), timeZone: "America/Chicago", attendees: 10, confirmUrl: "https://example.test/confirm" });
  expect(message.html).not.toContain("<b>Office</b>");
  expect(message.html).not.toContain("<i>Rep</i>");
  expect(message.html).not.toContain("<img>");
});
