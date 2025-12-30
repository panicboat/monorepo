import { createPromiseClient } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { IdentityService } from "@heaven/rpc/identity/v1/service_connect";

const transport = createGrpcTransport({
  baseUrl: process.env.GRPC_ENDPOINT || "http://localhost:9001",
  httpVersion: "2",
});

export const identityClient = createPromiseClient(IdentityService, transport);
