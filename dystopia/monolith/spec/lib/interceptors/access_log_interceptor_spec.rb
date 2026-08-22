# frozen_string_literal: true

require "spec_helper"
require "lib/interceptors/access_log_interceptor"
require "lib/current"

RSpec.describe Interceptors::AccessLogInterceptor do
  let(:interceptor) { described_class.new(request, error) }
  let(:request) { double(:request, method_key: :test_method, service_key: :test_service) }
  let(:error) { double(:error) }

  before do
    allow(Hanami).to receive(:logger).and_return(logger)
  end

  let(:logger) { double(:logger, info: nil, error: nil) }

  describe "#call" do
    context "when request succeeds" do
      before do
        ::Current.user_id = "user-123"
        ::Current.request_id = "request-abc-123"
      end

      after do
        ::Current.clear
      end

      it "logs request with request_id" do
        expect(logger).to receive(:info) do |json_string|
          log = JSON.parse(json_string)
          expect(log["request_id"]).to eq("request-abc-123")
          expect(log["user_id"]).to eq("user-123")
          expect(log["method"]).to eq("test_method")
          expect(log["service"]).to eq("test_service")
          expect(log["status"]).to eq("OK")
          expect(log["duration_ms"]).to be_a(Numeric)
        end

        interceptor.call { :result }
      end

      it "returns the yielded result" do
        result = interceptor.call { :my_result }
        expect(result).to eq(:my_result)
      end
    end

    context "when request fails" do
      before do
        ::Current.user_id = "user-456"
        ::Current.request_id = "request-def-456"
      end

      after do
        ::Current.clear
      end

      it "logs error with request_id" do
        expect(logger).to receive(:error) do |json_string|
          log = JSON.parse(json_string)
          expect(log["request_id"]).to eq("request-def-456")
          expect(log["user_id"]).to eq("user-456")
          expect(log["status"]).to eq("ERROR")
          expect(log["error"]).to eq("Something went wrong")
          expect(log["error_class"]).to eq("RuntimeError")
        end

        expect {
          interceptor.call { raise "Something went wrong" }
        }.to raise_error(RuntimeError, "Something went wrong")
      end
    end

    context "when request_id is nil" do
      before do
        ::Current.clear
      end

      it "logs with nil request_id" do
        expect(logger).to receive(:info) do |json_string|
          log = JSON.parse(json_string)
          expect(log["request_id"]).to be_nil
          expect(log["user_id"]).to be_nil
        end

        interceptor.call { :result }
      end
    end
  end
end
