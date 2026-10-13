export function canManageOrg(roleKey: string) {
  return roleKey === "ORG_ADMIN";
}

export function canReviewCompliance(roleKey: string) {
  return roleKey === "ORG_ADMIN" || roleKey === "COMPLIANCE_ADMIN";
}

export function canViewTeam(roleKey: string) {
  return (
    roleKey === "MANAGER" ||
    roleKey === "ORG_ADMIN" ||
    roleKey === "COMPLIANCE_ADMIN"
  );
}

export function appUrl() {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:43123";
}
