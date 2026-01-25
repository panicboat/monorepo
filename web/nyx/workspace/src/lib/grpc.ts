import { createClient } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { IdentityService } from "@/stub/identity/v1/service_pb";
import { CastService } from "@/stub/portfolio/v1/service_pb";

// In server environment (Next.js API Routes), we connect to Monolith directly.

// In server environment (Next.js API Routes), we connect to Monolith directly.
// Monolith is at 'http://monolith:9001' or 'http://localhost:9001' depending on Docker/Local.
// We should use ENV.
// standard gRPC server requires createGrpcTransport
const transport = createGrpcTransport({
  baseUrl: process.env.MONOLITH_URL || "http://localhost:9001",
});

export const identityClient = createClient(IdentityService, transport);
export const castClient = createClient(CastService, transport);
