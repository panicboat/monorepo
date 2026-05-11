// =============================================================================
// OpenTelemetry SDK initialization for Next.js
// =============================================================================
// L2 (= OTel Operator auto-injection、 panicboat platform で deploy 済) が
// 以下の env vars を Pod に injection:
// - OTEL_EXPORTER_OTLP_ENDPOINT (= OTel Collector の OTLP receiver endpoint)
// - OTEL_RESOURCE_ATTRIBUTES (= service.name=frontend 等)
// - OTEL_PROPAGATORS (= "tracecontext,baggage")
//
// Next.js 16+ の instrumentation hook (= register function) で SDK を
// process startup 時に initialize。 NEXT_RUNTIME=nodejs ガードで edge
// runtime (= middleware) を除外。
// =============================================================================

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter(),
      instrumentations: [getNodeAutoInstrumentations()],
    });
    sdk.start();
  }
}
