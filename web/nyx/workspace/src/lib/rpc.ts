import { createClient } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { file_portfolio_v1_service } from "./portfolio/v1/service_pb";
import { file_identity_v1_service } from "./identity/v1/service_pb";

// Backend URL environment variable (default for docker)
const baseUrl = process.env.GRPC_BACKEND_URL || "http://localhost:9001";

// Create transport for Node.js environment (gRPC requires HTTP/2)
const transport = createGrpcTransport({
  baseUrl,
});

// Create client for IdentityService
export const identityClient = createClient(file_identity_v1_service.services[0], transport);
export const portfolioClient = createClient(file_portfolio_v1_service.services[0], transport);
