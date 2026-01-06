import { createClient } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { CastService } from "./cast/v1/service_connect";
import { IdentityService } from "./identity/v1/service_connect";

// Backend URL environment variable (default for docker)
const baseUrl = process.env.GRPC_BACKEND_URL || "http://localhost:9001";

// Create transport for Node.js environment (gRPC requires HTTP/2)
const transport = createGrpcTransport({
  baseUrl,
  httpVersion: "2",
});

// Create client for IdentityService
export const identityClient = createClient(IdentityService, transport);
export const castClient = createClient(CastService, transport);
