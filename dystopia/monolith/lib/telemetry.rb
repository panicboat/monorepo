# frozen_string_literal: true

require "opentelemetry-sdk"
require "opentelemetry-exporter-otlp"
require "opentelemetry-instrumentation-all"

module Telemetry
  def self.configure
    # Use the exporter endpoint as the instrumentation switch because local runs must not emit failed localhost exports.
    return false if ENV["OTEL_EXPORTER_OTLP_ENDPOINT"].to_s.empty?

    OpenTelemetry::SDK.configure do |c|
      # Disable ActiveSupport instrumentation because the transitive dependency lacks the version API expected by the integration.
      c.use_all("OpenTelemetry::Instrumentation::ActiveSupport" => { enabled: false })
    end
    true
  end
end
