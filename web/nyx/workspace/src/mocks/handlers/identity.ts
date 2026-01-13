import { http, HttpResponse } from "msw";

interface SignInRequest {
  phoneNumber: string;
  verificationCode: string;
}

export const handlers = [
  // Mock handlers disabled to allow Real API (BFF -> gRPC) passthrough
];
