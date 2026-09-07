# frozen_string_literal: true

require "spec_helper"
require "lib/telemetry"

RSpec.describe Telemetry do
  describe ".configure" do
    around do |example|
      original = ENV["OTEL_EXPORTER_OTLP_ENDPOINT"]
      example.run
      ENV["OTEL_EXPORTER_OTLP_ENDPOINT"] = original
    end

    context "when no collector endpoint is configured" do
      before { ENV.delete("OTEL_EXPORTER_OTLP_ENDPOINT") }

      it "leaves the SDK untouched" do
        expect(OpenTelemetry::SDK).not_to receive(:configure)

        expect(described_class.configure).to be(false)
      end
    end

    context "when the collector endpoint is blank" do
      before { ENV["OTEL_EXPORTER_OTLP_ENDPOINT"] = "" }

      it "leaves the SDK untouched" do
        expect(OpenTelemetry::SDK).not_to receive(:configure)

        expect(described_class.configure).to be(false)
      end
    end

    context "when a collector endpoint is configured" do
      before { ENV["OTEL_EXPORTER_OTLP_ENDPOINT"] = "http://collector.example:4318" }

      it "installs every available instrumentation except ActiveSupport" do
        configurator = instance_double(OpenTelemetry::SDK::Configurator)
        expect(configurator).to receive(:use_all).with(
          "OpenTelemetry::Instrumentation::ActiveSupport" => { enabled: false }
        )
        expect(OpenTelemetry::SDK).to receive(:configure).and_yield(configurator)

        expect(described_class.configure).to be(true)
      end
    end
  end
end
