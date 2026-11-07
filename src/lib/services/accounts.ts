import type { Db } from "../db";
import { accountIdentityKey } from "../domain/accounts";

export async function findDuplicateAccount(
  db: Db,
  input: { organizationId: string; name: string; street: string; zip: string; exceptId?: string },
) {
  const key = accountIdentityKey(input);
  const candidates = await db.account.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.exceptId ? { id: { not: input.exceptId } } : {}),
    },
    select: { id: true, name: true, street: true, zip: true },
  });
  return candidates.find((account) => accountIdentityKey(account) === key) ?? null;
}
