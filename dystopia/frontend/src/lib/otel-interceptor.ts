import { context, propagation } from "@opentelemetry/api";
import type { Interceptor } from "@connectrpc/connect";

// Inject trace context manually because the Node.js gRPC transport is not covered by current auto-instrumentation.
export const traceContextInterceptor: Interceptor = (next) => async (req) => {
  propagation.inject(context.active(), req.header, {
    set: (headers, key, value) => headers.set(key, value),
  });
  return await next(req);
};
