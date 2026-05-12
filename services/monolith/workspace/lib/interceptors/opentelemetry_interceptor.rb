# frozen_string_literal: true

require "opentelemetry"
require "gruf"

module Interceptors
  # gruf custom interceptor for OpenTelemetry span generation
  #
  # 各 incoming RPC に対し OTel span を生成、 incoming gRPC metadata から W3C
  # tracecontext を extract して parent context として set。 frontend (= Next.js
  # ConnectRPC client) → monolith (= Ruby gruf gRPC server) の trace を結合。
  #
  # OTel SDK L1 (= config/initializers/opentelemetry.rb) で tracer_provider を
  # init 済、 本 interceptor は OpenTelemetry.tracer_provider.tracer("gruf-server")
  # で tracer を取得して span 生成。
  #
  # opentelemetry-instrumentation-all に gruf 非対応のため、 standard instrumentation
  # では gruf server-side span が生成されない。 本 interceptor でその gap を埋める。
  class OpenTelemetryInterceptor < Gruf::Interceptors::ServerInterceptor
    TRACER_NAME = "gruf-server"

    def call
      tracer = OpenTelemetry.tracer_provider.tracer(TRACER_NAME)
      service_name = request.service.name
      method_name  = request.method_key.to_s
      span_name    = "#{service_name}/#{method_name}"

      # Extract W3C tracecontext from incoming gRPC metadata
      carrier = request.active_call.metadata.to_h
      parent_context = OpenTelemetry.propagation.extract(carrier)

      OpenTelemetry::Context.with_current(parent_context) do
        tracer.in_span(span_name, kind: :server) do |span|
          span.set_attribute("rpc.system", "grpc")
          span.set_attribute("rpc.service", service_name)
          span.set_attribute("rpc.method", method_name)

          begin
            result = yield
            span.set_attribute("rpc.grpc.status_code", GRPC::Core::StatusCodes::OK)
            result
          rescue GRPC::BadStatus => e
            span.set_attribute("rpc.grpc.status_code", e.code)
            span.status = OpenTelemetry::Trace::Status.error(e.message)
            raise
          rescue => e
            span.set_attribute("rpc.grpc.status_code", GRPC::Core::StatusCodes::UNKNOWN)
            span.status = OpenTelemetry::Trace::Status.error(e.message)
            raise
          end
        end
      end
    end
  end
end
