// Mirror the user pool password policy here because Cognito only reports a violation after the form is submitted.
export const PASSWORD_REQUIREMENTS =
  "12 文字以上で、大文字・小文字・数字・記号をそれぞれ 1 文字以上含めてください。";

export const INVALID_PASSWORD_MESSAGE = `パスワードが条件を満たしていません。${PASSWORD_REQUIREMENTS}`;

export function isInvalidPasswordError(error: unknown): boolean {
  return error instanceof Error && error.name === "InvalidPasswordException";
}
