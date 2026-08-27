import {
  AuthFlowType,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { CognitoAdapter, Tokens } from "./adapter";

function client(): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient({
    region: process.env.COGNITO_REGION ?? "ap-northeast-1",
  });
}

function clientId(): string {
  const id = process.env.COGNITO_CLIENT_ID;
  if (!id) throw new Error("COGNITO_CLIENT_ID env is required");
  return id;
}

export function createAwsAdapter(): CognitoAdapter {
  return {
    async signUp(phone, password) {
      const response = await client().send(
        new SignUpCommand({
          ClientId: clientId(),
          Username: phone,
          Password: password,
          UserAttributes: [{ Name: "phone_number", Value: phone }],
        }),
      );

      if (!response.UserSub) throw new Error("Cognito SignUp returned no UserSub");
      return { userSub: response.UserSub };
    },
    async confirmSignUp(phone, code) {
      await client().send(
        new ConfirmSignUpCommand({
          ClientId: clientId(),
          Username: phone,
          ConfirmationCode: code,
        }),
      );
    },
    async initiateAuth(phone, password): Promise<Tokens> {
      const response = await client().send(
        new InitiateAuthCommand({
          AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
          ClientId: clientId(),
          AuthParameters: {
            USERNAME: phone,
            PASSWORD: password,
          },
        }),
      );
      const result = response.AuthenticationResult;

      if (!result?.AccessToken || !result.RefreshToken || !result.IdToken) {
        throw new Error("Cognito InitiateAuth returned no tokens");
      }

      return {
        accessToken: result.AccessToken,
        refreshToken: result.RefreshToken,
        idToken: result.IdToken,
      };
    },
    async refreshTokens(refreshToken) {
      const response = await client().send(
        new InitiateAuthCommand({
          AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
          ClientId: clientId(),
          AuthParameters: { REFRESH_TOKEN: refreshToken },
        }),
      );
      const result = response.AuthenticationResult;

      if (!result?.AccessToken || !result.IdToken) {
        throw new Error("Cognito refresh returned no tokens");
      }

      return { accessToken: result.AccessToken, idToken: result.IdToken };
    },
    async globalSignOut(accessToken) {
      await client().send(new GlobalSignOutCommand({ AccessToken: accessToken }));
    },
    async forgotPassword(phone) {
      await client().send(new ForgotPasswordCommand({ ClientId: clientId(), Username: phone }));
    },
    async confirmForgotPassword(phone, code, newPassword) {
      await client().send(
        new ConfirmForgotPasswordCommand({
          ClientId: clientId(),
          Username: phone,
          ConfirmationCode: code,
          Password: newPassword,
        }),
      );
    },
  };
}
