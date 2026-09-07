import { createHash } from "node:crypto";

// Cognito requires phone_number in E.164 (+<country code><number>, no
// separators). Users type domestic-format numbers (leading 0, hyphens), so
// normalize before every SignUp/InitiateAuth/ForgotPassword call — Cognito
// rejects anything else with InvalidParameterException.
export function normalizePhoneNumber(phone: string): string {
  const stripped = phone.trim().replace(/[\s-]/g, "");
  if (stripped.startsWith("+")) return stripped;

  const withoutLeadingZero = stripped.startsWith("0") ? stripped.slice(1) : stripped;
  return `+81${withoutLeadingZero}`;
}

// Cognito's phone_number alias only resolves once phone_number_verified is
// true, which isn't the case yet at SignUp/ConfirmSignUp time — the alias
// doesn't exist until confirmation succeeds. With PreventUserExistenceErrors
// enabled, a Username the pool can't resolve surfaces as CodeMismatchException
// instead of UserNotFoundException, which looks exactly like "wrong code"
// even when the code is correct. SignUp also rejects a phone-number-shaped
// Username outright ("Username cannot be of phone number format"). A
// deterministic, non-phone-shaped Username sidesteps both: SignUp and
// ConfirmSignUp always target the same real Cognito user for a given phone
// number, with no alias resolution involved. InitiateAuth/ForgotPassword/
// ConfirmForgotPassword operate on already-confirmed users, where the
// verified alias resolves normally, so they keep using the phone number.
export function usernameForPhone(phone: string): string {
  return createHash("sha256").update(normalizePhoneNumber(phone)).digest("hex");
}
