# frozen_string_literal: true

# =============================================================================
# OpenTelemetry SDK initialization
# =============================================================================
# L2 (= OTel Operator auto-injection、 panicboat platform で deploy 済) が
# 以下の env vars を Pod に injection:
# - OTEL_EXPORTER_OTLP_ENDPOINT (= OTel Collector の OTLP receiver endpoint)
# - OTEL_RESOURCE_ATTRIBUTES (= service.name=monolith 等)
# - OTEL_TRACES_EXPORTER / OTEL_METRICS_EXPORTER / OTEL_LOGS_EXPORTER (= "otlp")
# - OTEL_PROPAGATORS (= "tracecontext,baggage")
#
# 本 initializer は OpenTelemetry::SDK.configure を trigger するだけで、
# env vars を auto-detect + auto-config。 custom span は app code 内で
# tracer.in_span(...) で追加可能。
# =============================================================================

require "opentelemetry/sdk"
require "opentelemetry/instrumentation/all"
require "opentelemetry/exporter/otlp"

OpenTelemetry::SDK.configure do |c|
  c.service_name = "monolith"
  c.use_all # auto-instrument all installed instrumentation libraries
end
