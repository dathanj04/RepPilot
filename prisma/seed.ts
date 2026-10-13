import "dotenv/config";
import { hash } from "bcryptjs";
import { prisma } from "../src/lib/db";
import { computeReminderInstants, reminderIdempotencyKey } from "../src/lib/domain/reminders";
import { issueSecureLink } from "../src/lib/services/links";

const PASSWORD = "RepPilot-demo-2026";

const roles = [
  { key: "REP", name: "Representative", description: "Field representative", scope: "organization" },
  { key: "MANAGER", name: "Manager", description: "Team manager", scope: "organization" },
  { key: "COMPLIANCE_ADMIN", name: "Compliance administrator", description: "Reviews meal policy exceptions", scope: "organization" },
  { key: "ORG_ADMIN", name: "Organization administrator", description: "Manages the organization", scope: "organization" },
  { key: "PLATFORM_ADMIN", name: "Platform administrator", description: "RepPilot platform operations", scope: "platform" },
];

async function main() {
  const passwordHash = await hash(PASSWORD, 10);
  for (const role of roles) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: role,
      create: role,
    });
  }
  const roleByKey = Object.fromEntries(
    (await prisma.role.findMany()).map((role) => [role.key, role.id]),
  );

  await prisma.organization.deleteMany({
    where: { slug: { in: ["example-healthcare", "reppilot-platform"] } },
  });

  const users = [
    { email: "alex.davis@example-health.test", name: "Alex Davis", title: "Field representative", role: "REP", phone: "(972) 555-0101" },
    { email: "jordan.lee@example-health.test", name: "Jordan Lee", title: "Regional manager", role: "MANAGER", phone: "(972) 555-0102" },
    { email: "priya.shah@example-health.test", name: "Priya Shah", title: "Organization administrator", role: "ORG_ADMIN", phone: "(972) 555-0103" },
    { email: "casey.nguyen@example-health.test", name: "Casey Nguyen", title: "Compliance administrator", role: "COMPLIANCE_ADMIN", phone: "(972) 555-0104" },
    { email: "avery.cole@reppilot.demo", name: "Avery Cole", title: "Platform administrator", role: "PLATFORM_ADMIN", phone: "(972) 555-0199" },
  ];

  const userIds: Record<string, string> = {};
  for (const user of users) {
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, passwordHash, title: user.title, phone: user.phone, timezone: "America/Chicago" },
      create: { email: user.email, name: user.name, passwordHash, title: user.title, phone: user.phone, timezone: "America/Chicago" },
    });
    userIds[user.role] = saved.id;
  }

  const org = await prisma.organization.create({
    data: {
      name: "Example Healthcare Services",
      slug: "example-healthcare",
      timezone: "America/Chicago",
      isDemo: true,
      branding: { displayName: "Example Healthcare Services", emailFromName: "Alex Davis · Example Healthcare Services" },
      settings: {
        workdayStart: "08:00",
        workdayEnd: "17:00",
        visitMinutes: 20,
        recentVisitDays: 14,
        overdueVisitDays: 45,
        staleBriefingDays: 30,
        invitationExpiryHours: 48,
        aiEnabled: true,
        monthlyAiLimit: 200,
        previewCapabilities: ["manager_dashboard", "compliance_console", "advanced_reporting"],
      },
    },
  });

  const platform = await prisma.organization.create({
    data: {
      name: "RepPilot Platform",
      slug: "reppilot-platform",
      timezone: "America/Chicago",
      isDemo: true,
      settings: { previewCapabilities: [] },
    },
  });

  const memberships = [
    ["REP", org.id],
    ["MANAGER", org.id],
    ["ORG_ADMIN", org.id],
    ["COMPLIANCE_ADMIN", org.id],
    ["PLATFORM_ADMIN", platform.id],
  ] as const;
  for (const [role, organizationId] of memberships) {
    await prisma.organizationMembership.create({
      data: { organizationId, userId: userIds[role]!, roleId: roleByKey[role]! },
    });
  }

  await prisma.subscription.create({
    data: { organizationId: org.id, plan: "basic", status: "demo", priceMonthlyCents: 2900 },
  });
  await prisma.subscription.create({
    data: { organizationId: platform.id, plan: "enterprise", status: "demo", priceMonthlyCents: null },
  });

  const territory = await prisma.territory.create({
    data: {
      organizationId: org.id,
      name: "North Dallas",
      boundary: {
        type: "Polygon",
        coordinates: [[
          [-97.05, 33.28],
          [-96.55, 33.28],
          [-96.55, 32.95],
          [-97.05, 32.95],
          [-97.05, 33.28],
        ]],
      },
    },
  });
  await prisma.territoryAssignment.create({
    data: { territoryId: territory.id, userId: userIds.REP! },
  });

  await prisma.mealPolicy.create({
    data: {
      organizationId: org.id,
      name: "Internal Meal Policy",
      version: "1.2",
      active: true,
      perPersonCapCents: 2500,
      entertainmentAllowed: false,
      referralLinkedMealsAllowed: false,
      exceptionsPermitted: true,
      educationalPurposeRequired: true,
      rules: {
        create: [
          { code: "educational_purpose", description: "Educational purpose must be documented.", severity: "block", overridable: false },
          { code: "entertainment", description: "Entertainment is disabled in this product.", severity: "block", overridable: false },
          { code: "referral_linked", description: "Referral-linked meals are not permitted.", severity: "block", overridable: false },
          { code: "over_cap", description: "Internal per-person cap. Not a federal meal allowance.", severity: "block", overridable: true },
        ],
      },
    },
  });

  const officeData = [
    ["Northside Clinic", "Pediatrics", "123 Medical Drive", "Frisco", "75034", 33.1507, -96.8236, "(972) 555-0142", "office@northside-clinic.example", 4, "Sarah Mitchell", "office_manager", "2026-10-01T15:00:00.000Z"],
    ["Riverside Medical", "Internal Medicine", "880 River Road", "Plano", "75024", 33.0198, -96.6989, "(972) 555-0160", "office@riverside-medical.example", 6, "Daniel Ortiz", "practice_administrator", "2026-09-20T15:00:00.000Z"],
    ["Lakeside Health", "Family Medicine", "45 Lakeview Blvd", "McKinney", "75069", 33.1976, -96.615, "(972) 555-0174", "office@lakeside-health.example", 5, "Megan Brooks", "office_manager", "2026-09-02T15:00:00.000Z"],
    ["Oak Ridge Family Medicine", "Family Medicine", "220 Oak Ridge Lane", "Allen", "75013", 33.1032, -96.6706, "(214) 555-0133", "office@oakridge-fm.example", 3, "Helen Cho", "front_desk", "2026-10-08T15:00:00.000Z"],
    ["Summit Medical", "Cardiology", "910 Summit Parkway", "Little Elm", "75068", 33.1626, -96.9375, "(469) 555-0188", "office@summit-medical.example", 8, "Noah Patel", "referral_coordinator", "2026-08-01T15:00:00.000Z"],
    ["West Valley Clinic", "Orthopedics", "15 Valley Creek", "The Colony", "75056", 33.089, -96.8864, "(972) 555-0190", "office@westvalley-clinic.example", 4, "Grace Allen", "office_manager", null],
  ] as const;

  const accountIds: Record<string, string> = {};
  for (const row of officeData) {
    const [name, specialty, street, city, zip, lat, lng, phone, email, providers, contact, role, last] = row;
    const account = await prisma.account.create({
      data: {
        organizationId: org.id,
        territoryId: territory.id,
        name,
        specialty,
        street,
        city,
        state: "TX",
        zip,
        latitude: lat,
        longitude: lng,
        phone,
        email,
        providerCount: providers,
        officeHours: "Mon–Fri 8:00 a.m.–5:00 p.m.",
        generalNotes: "Fictional demonstration office. Do not store patient information here.",
        referralCommunicationPreference: "Office email",
        status: "ACTIVE",
        isDemo: true,
        lastVisitAt: last ? new Date(last) : null,
        officeType: "Clinic",
        contacts: {
          create: {
            organizationId: org.id,
            name: contact,
            roleLabel: role,
            email: email.replace("office@", `${contact.split(" ")[0]?.toLowerCase()}.`),
            phone,
            isPrimary: true,
          },
        },
        assignments: { create: { organizationId: org.id, userId: userIds.REP! } },
      },
    });
    accountIds[name] = account.id;
  }

  const northside = accountIds["Northside Clinic"]!;
  const sarah = await prisma.accountContact.findFirst({ where: { accountId: northside } });
  await prisma.accountInteraction.create({
    data: {
      organizationId: org.id,
      accountId: northside,
      userId: userIds.REP!,
      type: "office_visit",
      outcome: "completed",
      summary: "Spoke with the office manager, left program materials, and committed to sending an updated overview.",
      completedActivities: ["met_office_manager", "left_educational_materials", "provided_program_overview"],
      occurredAt: new Date("2026-09-18T15:30:00.000Z"),
      participants: { create: [{ name: "Sarah Mitchell", roleLabel: "office_manager", contactId: sarah?.id }] },
    },
  });
  await prisma.accountInteraction.create({
    data: {
      organizationId: org.id,
      accountId: northside,
      userId: userIds.REP!,
      type: "office_visit",
      outcome: "completed",
      summary: "Answered questions about the educational program and confirmed the office still wants the overview.",
      completedActivities: ["answered_questions"],
      occurredAt: new Date("2026-10-01T15:00:00.000Z"),
      participants: { create: [{ name: "Sarah Mitchell", roleLabel: "office_manager", contactId: sarah?.id }] },
    },
  });

  await prisma.followUpTask.createMany({
    data: [
      { organizationId: org.id, accountId: northside, ownerId: userIds.REP!, title: "Send updated overview", dueDate: new Date("2026-10-13T17:00:00.000Z"), priority: "HIGH", status: "OPEN", source: "check_in" },
      { organizationId: org.id, accountId: accountIds["Lakeside Health"], ownerId: userIds.REP!, title: "Call office manager", dueDate: new Date("2026-10-13T17:00:00.000Z"), priority: "NORMAL", status: "OPEN", source: "check_in" },
      { organizationId: org.id, accountId: accountIds["Summit Medical"], ownerId: userIds.REP!, title: "Schedule office visit", dueDate: new Date("2026-10-10T17:00:00.000Z"), priority: "HIGH", status: "OPEN", source: "manual" },
    ],
  });
  await prisma.account.update({ where: { id: northside }, data: { nextFollowUpAt: new Date("2026-10-13T17:00:00.000Z") } });
  await prisma.account.update({ where: { id: accountIds["Lakeside Health"]! }, data: { nextFollowUpAt: new Date("2026-10-13T17:00:00.000Z") } });
  await prisma.account.update({ where: { id: accountIds["Summit Medical"]! }, data: { nextFollowUpAt: new Date("2026-10-10T17:00:00.000Z") } });

  async function bookedLunch(input: {
    name: string;
    start: string;
    end: string;
    status: string;
    attendees: number;
    confirmed?: boolean;
    budget: number;
    finalAmount?: number;
    vendor?: string;
    orderStatus: string;
    spendingKind: "recorded" | "commitment";
  }) {
    const start = new Date(input.start);
    const booking = await prisma.lunchBooking.create({
      data: {
        organizationId: org.id,
        accountId: accountIds[input.name]!,
        representativeId: userIds.REP!,
        slotStartsAt: start,
        slotEndsAt: new Date(input.end),
        status: input.status,
        purpose: "Educational program overview for office staff.",
        expectedAttendees: input.attendees,
        confirmedAttendees: input.confirmed ? input.attendees : null,
        confirmedAt: input.confirmed ? new Date("2026-10-12T15:00:00.000Z") : null,
        confirmedByName: input.confirmed ? "Office contact" : null,
        timezone: "America/Chicago",
        estimatedBudgetCents: input.budget,
        mealPreferences: "Sandwich tray. No nuts.",
        deliveryInstructions: "Deliver to the front desk and ask for the office manager.",
      },
    });
    await prisma.cateringOrder.create({
      data: {
        organizationId: org.id,
        bookingId: booking.id,
        accountId: accountIds[input.name]!,
        vendor: input.vendor ?? null,
        status: input.orderStatus,
        estimatedAmountCents: input.budget,
        finalAmountCents: input.finalAmount ?? null,
        confirmedAttendees: input.attendees,
        targetDeliveryAt: start,
        placedAt: input.finalAmount ? new Date("2026-10-12T18:00:00.000Z") : null,
        orderReference: input.finalAmount ? `DEMO-${input.name.slice(0, 4).toUpperCase()}` : null,
        deliveryInstructions: "Front desk.",
      },
    });
    await prisma.officeSpendingEntry.create({
      data: {
        organizationId: org.id,
        accountId: accountIds[input.name]!,
        bookingId: booking.id,
        kind: input.spendingKind,
        amountCents: input.finalAmount ?? input.budget,
        attendeeCount: input.attendees,
        perPersonCents: Math.round((input.finalAmount ?? input.budget) / input.attendees),
        vendor: input.vendor ?? null,
        occurredOn: start,
        policyStatus: input.spendingKind === "recorded" ? "PASS" : "pending",
      },
    });
    const reminders = computeReminderInstants(start, "America/Chicago");
    const cutoff = new Date("2026-10-13T12:00:00.000Z");
    await prisma.lunchReminder.createMany({
      data: (Object.keys(reminders) as (keyof typeof reminders)[]).map((kind) => {
        const when = reminders[kind];
        const finished = input.status === "COMPLETED" || input.status === "CANCELED";
        const confirmationReminder = kind !== "SEVEN_DAY" && input.confirmed;
        const staleSevenDay = kind === "SEVEN_DAY" && input.confirmed && when < cutoff;
        return {
          organizationId: org.id,
          bookingId: booking.id,
          kind,
          scheduledFor: when,
          status: finished || confirmationReminder || staleSevenDay ? "SKIPPED" : "SCHEDULED",
          idempotencyKey: reminderIdempotencyKey(booking.id, kind, start.toISOString()),
        };
      }),
    });
    await prisma.calendarEventMapping.create({
      data: {
        organizationId: org.id,
        userId: userIds.REP!,
        lunchBookingId: booking.id,
        title: `Educational lunch · ${input.name}`,
        startsAt: start,
        endsAt: new Date(input.end),
        syncState: "internal",
      },
    });
    return booking;
  }

  await bookedLunch({
    name: "Northside Clinic",
    start: "2026-10-22T17:00:00.000Z",
    end: "2026-10-22T18:00:00.000Z",
    status: "SCHEDULED",
    attendees: 12,
    budget: 30000,
    orderStatus: "NOT_STARTED",
    spendingKind: "commitment",
  });
  const riverside = await bookedLunch({
    name: "Riverside Medical",
    start: "2026-10-15T17:00:00.000Z",
    end: "2026-10-15T18:00:00.000Z",
    status: "SCHEDULED",
    attendees: 10,
    budget: 22000,
    orderStatus: "NOT_STARTED",
    spendingKind: "commitment",
  });
  await prisma.lunchReminder.updateMany({
    where: { bookingId: riverside.id, kind: "FORTY_EIGHT_HOUR" },
    data: { scheduledFor: new Date("2026-10-13T12:00:00.000Z"), status: "SCHEDULED" },
  });
  await bookedLunch({
    name: "Lakeside Health",
    start: "2026-10-16T17:00:00.000Z",
    end: "2026-10-16T18:00:00.000Z",
    status: "CONFIRMED",
    attendees: 12,
    confirmed: true,
    budget: 24000,
    finalAmount: 21600,
    vendor: "ezcater",
    orderStatus: "ORDER_RECORDED",
    spendingKind: "recorded",
  });
  await bookedLunch({
    name: "Oak Ridge Family Medicine",
    start: "2026-10-01T16:00:00.000Z",
    end: "2026-10-01T17:00:00.000Z",
    status: "COMPLETED",
    attendees: 8,
    confirmed: true,
    budget: 18000,
    finalAmount: 17600,
    vendor: "doordash",
    orderStatus: "COMPLETED",
    spendingKind: "recorded",
  });

  const summitInvite = await prisma.lunchInvitation.create({
    data: {
      organizationId: org.id,
      accountId: accountIds["Summit Medical"]!,
      createdById: userIds.REP!,
      purpose: "Educational overview of in-home clinical support for office staff.",
      status: "ACTIVE",
      recipientName: "Noah Patel",
      recipientEmail: "office@summit-medical.example",
      expiresAt: new Date("2026-10-16T17:00:00.000Z"),
      slots: {
        create: [
          { startsAt: new Date("2026-10-21T17:00:00.000Z"), endsAt: new Date("2026-10-21T18:00:00.000Z"), status: "offered" },
          { startsAt: new Date("2026-10-23T17:00:00.000Z"), endsAt: new Date("2026-10-23T18:00:00.000Z"), status: "offered" },
        ],
      },
    },
  });
  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      actorId: userIds.REP!,
      action: "invitation.created",
      entityType: "LunchInvitation",
      entityId: summitInvite.id,
      metadata: { expectedAttendees: 8, estimatedBudgetCents: 20000, mealPreferences: "Boxed lunches", deliveryInstructions: "Suite 200" },
    },
  });
  const summitLink = await issueSecureLink(prisma, {
    organizationId: org.id,
    purpose: "invitation",
    accountId: accountIds["Summit Medical"]!,
    invitationId: summitInvite.id,
    expiresAt: summitInvite.expiresAt,
  });
  const officeLink = await issueSecureLink(prisma, {
    organizationId: org.id,
    purpose: "office",
    accountId: northside,
    expiresAt: new Date("2027-01-13T00:00:00.000Z"),
  });

  await prisma.aIInteraction.create({
    data: {
      organizationId: org.id,
      userId: userIds.REP!,
      purpose: "account_brief",
      provider: "deterministic",
      inputExcerpt: "Northside Clinic history",
      outputJson: { text: "Sample suggestion only. Not saved as a visit." },
      accepted: false,
    },
  });

  for (const provider of ["google", "microsoft"] as const) {
    await prisma.calendarConnection.create({
      data: { organizationId: org.id, userId: userIds.REP!, provider, status: "not_connected" },
    });
  }
  for (const provider of ["salesforce", "hubspot"] as const) {
    await prisma.externalCRMConnection.create({
      data: { organizationId: org.id, provider, status: "not_connected" },
    });
  }

  console.log("Seeded Example Healthcare Services");
  console.log(`Demo password: ${PASSWORD}`);
  console.log(`Summit invitation: ${process.env.APP_URL}/i/${summitLink.token}`);
  console.log(`Northside office link: ${process.env.APP_URL}/o/${officeLink.token}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
