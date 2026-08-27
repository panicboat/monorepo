export type Tokens = {
  accessToken: string;
  refreshToken: string;
  idToken: string;
};

export type CognitoAdapter = {
  signUp(phone: string, password: string): Promise<{ userSub: string }>;
  confirmSignUp(phone: string, code: string): Promise<void>;
  initiateAuth(phone: string, password: string): Promise<Tokens>;
  refreshTokens(refreshToken: string): Promise<Pick<Tokens, "accessToken" | "idToken">>;
  globalSignOut(accessToken: string): Promise<void>;
  forgotPassword(phone: string): Promise<void>;
  confirmForgotPassword(phone: string, code: string, newPassword: string): Promise<void>;
};

let instance: CognitoAdapter | null = null;

export function cognito(): CognitoAdapter {
  if (instance) return instance;

  if (process.env.COGNITO_ADAPTER === "aws") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./aws") as { createAwsAdapter: () => CognitoAdapter };
    instance = mod.createAwsAdapter();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./fake") as { createFakeAdapter: () => CognitoAdapter };
    instance = mod.createFakeAdapter();
  }

  return instance;
}

export function _resetCognitoInstance(): void {
  instance = null;
}
