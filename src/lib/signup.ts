import { newTrial } from "./domain/trial";
import { hash } from "bcryptjs";
import { prisma } from "./db";
import { clearPreviewSession, getSession } from "./session";
import { credentialVersion } from "./session-options";
import { parseOrgSettings } from "./org-settings";
import { consumeSharedRateLimit } from "./domain/rate-limit-store";

const ROLES = [
  ["REP", "Representative", "Field representative", "organization"],
  ["MANAGER", "Manager", "Team manager", "organization"],
  ["COMPLIANCE_ADMIN", "Compliance administrator", "Reviews meal-policy exceptions", "organization"],
  ["ORG_ADMIN", "Organization administrator", "Manages the organization", "organization"],
  ["PLATFORM_ADMIN", "Platform administrator", "RepPilot platform operations", "platform"],
] as const;

async function ensureRoles() {
  for (const [key, name, description, scope] of ROLES) {
    await prisma.role.upsert({
      where: { key },
      update: {},
      create: { key, name, description, scope },
    });
  }
}

function slugify(value: string) {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
  return base || "organization";
}

export async function createOrganizationAccount(input: {
  name: string;
  email: string;
  password: string;
  organization: string;
}): Promise<{ error: string } | { organizationId: string }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const organizationName = input.organization.trim();
  if (name.length < 2 || organizationName.length < 2) return { error: "Add your name and organization." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." };
  if (password.length < 8) return { error: "Use at least 8 characters for the password." };

  const attempts = await consumeSharedRateLimit(prisma, `signup:${email}`, 5, 15 * 60_000);
  if (!attempts.ok) return { error: "Too many attempts. Wait a few minutes and try again." };

  await ensureRoles();
  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: "An account with that email already exists. Sign in instead." };
  }
  const role = await prisma.role.findUniqueOrThrow({ where: { key: "ORG_ADMIN" } });
  let slug = slugify(organizationName);
  if (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${slug}-${Math.floor(Math.random() * 10000)}`;
  }
  const passwordHash = await hash(password, 10);
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, passwordHash, timezone: "America/Chicago" },
    });
    const organization = await tx.organization.create({
      data: {
        name: organizationName,
        slug,
        timezone: "America/Chicago",
        settings: parseOrgSettings({}),
        branding: { displayName: organizationName, emailFromName: organizationName },
      },
    });
    await tx.organizationMembership.create({
      data: { organizationId: organization.id, userId: user.id, roleId: role.id },
    });
    await tx.subscription.create({
      data: { organizationId: organization.id, plan: "basic", status: "trialing", ...newTrial() },
    });
    return { userId: user.id, organizationId: organization.id };
  });

  const session = await getSession();
  session.userId = created.userId;
  session.organizationId = created.organizationId;
  session.roleKey = "ORG_ADMIN";
  session.credentialVersion = credentialVersion(passwordHash);
  await session.save();
  await clearPreviewSession();
  return { organizationId: created.organizationId };
}
