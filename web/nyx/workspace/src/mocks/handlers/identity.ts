import { http, HttpResponse } from "msw";

interface SignInRequest {
  phoneNumber: string;
  verificationCode: string;
}

export const handlers = [
  http.post("/api/identity/sign-in", async ({ request }) => {
    const { verificationCode } = (await request.json()) as SignInRequest;

    if (verificationCode === "0000") {
      return HttpResponse.json({
        token: "mock-jwt-token-guest",
        role: "guest",
        userId: "guest-123",
      });
    }

    return new HttpResponse(null, { status: 401 });
  }),
];
