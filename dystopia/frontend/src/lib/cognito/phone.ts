import { createHash } from "node:crypto";

export function normalizePhoneNumber(phone: string): string {
  const stripped = phone.trim().replace(/[\s-]/g, "");
  if (stripped.startsWith("+")) return stripped;

  // Normalize domestic input to E.164 because Cognito rejects other phone formats.
  const withoutLeadingZero = stripped.startsWith("0") ? stripped.slice(1) : stripped;
  return `+81${withoutLeadingZero}`;
}

export function usernameForPhone(phone: string): string {
  // Use a deterministic non-phone-shaped username because the phone alias is unavailable until confirmation.
  return createHash("sha256").update(normalizePhoneNumber(phone)).digest("hex");
}
