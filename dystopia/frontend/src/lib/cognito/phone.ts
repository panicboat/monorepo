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
