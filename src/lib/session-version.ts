import { sql, isNeonConfigured } from "./neon";

/** Legacy tokens count as version zero until a password reset revokes them. */
export async function currentNeonSession(userId: unknown, version: unknown): Promise<boolean> {
  if (!isNeonConfigured() || typeof userId !== "string" || !/^[a-f0-9-]{36}$/i.test(userId)) return false;
  const expected = version === undefined ? 0 : version;
  if (!Number.isSafeInteger(expected) || Number(expected) < 0) return false;
  const rows = await sql()`SELECT session_version FROM users WHERE id=${userId}`;
  return rows.length === 1 && Number(rows[0].session_version) === expected;
}
