import { context, propagation } from "@opentelemetry/api";
import type { Interceptor } from "@connectrpc/connect";

// gRPC の送信は node:http2 を直接叩く (@connectrpc/connect-node) ため、
// OTel の auto-instrumentations-node には対象の計装が無く traceparent は
// 自動注入されない。Beyla も eBPF 側で注入していない (Service Graph の edge が
// user -> monolith になる実測で確認済み)。手動で inject する。
export const traceContextInterceptor: Interceptor = (next) => async (req) => {
  propagation.inject(context.active(), req.header, {
    set: (headers, key, value) => headers.set(key, value),
  });
  return await next(req);
};
