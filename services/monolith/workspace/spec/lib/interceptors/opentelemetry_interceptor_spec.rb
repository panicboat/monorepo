# frozen_string_literal: true

require "spec_helper"
require "opentelemetry/sdk"
require "lib/interceptors/opentelemetry_interceptor"

RSpec.describe Interceptors::OpenTelemetryInterceptor do
  let(:tracer_provider) { OpenTelemetry::SDK::Trace::TracerProvider.new }
  let(:span_exporter) { OpenTelemetry::SDK::Trace::Export::InMemorySpanExporter.new }
  let(:span_processor) { OpenTelemetry::SDK::Trace::Export::SimpleSpanProcessor.new(span_exporter) }

  before do
    tracer_provider.add_span_processor(span_processor)
    OpenTelemetry.tracer_provider = tracer_provider
    # Enable W3C tracecontext propagation for parent context extraction tests
    OpenTelemetry.propagation = OpenTelemetry::Trace::Propagation::TraceContext.text_map_propagator
  end

  after do
    OpenTelemetry.tracer_provider = OpenTelemetry::Internal::ProxyTracerProvider.new
    OpenTelemetry.propagation = OpenTelemetry::Context::Propagation::NoopTextMapPropagator.new
  end

  let(:request) do
    instance_double(
      Gruf::Controllers::Request,
      service: double(name: "Identity::V1::IdentityService::Service"),
      method_key: :GetUser,
      active_call: double(metadata: { "traceparent" => "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" })
    )
  end

  let(:errors) { Gruf::Error.new }
  subject(:interceptor) { described_class.new(request, errors, {}) }

  it "creates a span with rpc attributes for successful call" do
    interceptor.call { "success" }

    spans = span_exporter.finished_spans
    expect(spans.size).to eq(1)
    expect(spans[0].name).to eq("Identity::V1::IdentityService::Service/GetUser")
    expect(spans[0].kind).to eq(:server)
    expect(spans[0].attributes["rpc.system"]).to eq("grpc")
    expect(spans[0].attributes["rpc.service"]).to eq("Identity::V1::IdentityService::Service")
    expect(spans[0].attributes["rpc.method"]).to eq("GetUser")  # method_key.to_s
    expect(spans[0].attributes["rpc.grpc.status_code"]).to eq(0)
  end

  it "records error span on GRPC::BadStatus" do
    expect {
      interceptor.call { raise GRPC::Unauthenticated.new("auth failed") }
    }.to raise_error(GRPC::Unauthenticated)

    spans = span_exporter.finished_spans
    expect(spans[0].attributes["rpc.grpc.status_code"]).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED)
    expect(spans[0].status.code).to eq(OpenTelemetry::Trace::Status::ERROR)
  end

  it "extracts parent context from W3C tracecontext metadata" do
    interceptor.call { "success" }

    spans = span_exporter.finished_spans
    expect(spans[0].trace_id.unpack1("H*")).to eq("0af7651916cd43dd8448eb211c80319c")
  end
end
