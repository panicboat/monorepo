// Initialize OpenTelemetry only in the Node.js runtime because the Edge runtime lacks the required SDK.

import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { AwsInstrumentation } from "@opentelemetry/instrumentation-aws-sdk";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter(),
      // List instrumentations individually because the auto-instrumentations bundle makes the build resolve frameworks this app does not install.
      instrumentations: [new HttpInstrumentation(), new UndiciInstrumentation(), new AwsInstrumentation()],
    });
    sdk.start();
  }
}
