# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "lib/interceptors/access_log_interceptor"
require "lib/interceptors/authentication_interceptor"

RSpec.describe "gRPC interceptor chain", type: :database do
  let(:request) do
    double(
      :request,
      metadata: metadata,
      context: ActiveSupport::HashWithIndifferentAccess.new,
      method_key: :get_profile,
      service_key: :profile
    )
  end
  let(:error) { double(:error) }
  let(:logger) { double(:logger, info: nil, error: nil) }
  let(:account_id) { create_account(role: 2) }

  let(:chain) do
    Gruf::Interceptors::Context.new(
      [
        Interceptors::AccessLogInterceptor.new(request, error),
        Interceptors::AuthenticationInterceptor.new(request, error)
      ]
    )
  end

  before { allow(Hanami).to receive(:logger).and_return(logger) }

  context "with a successful request" do
    let(:metadata) { { "x-request-id" => "req-1", "x-user-id" => account_id } }

    it "logs the request id, the account and the profile of a successful request" do
      profile_id = create_account_with_profile(account_id: account_id)

      expect(logger).to receive(:info) do |json_string|
        log = JSON.parse(json_string)
        expect(log["request_id"]).to eq("req-1")
        expect(log["account_id"]).to eq(account_id)
        expect(log["profile_id"]).to eq(profile_id)
        expect(log["status"]).to eq("OK")
      end

      chain.intercept! { :result }
    end
  end

  context "when the handler raises" do
    let(:metadata) { { "x-request-id" => "req-1", "x-user-id" => account_id } }

    it "logs the request context when the handler raises" do
      profile_id = create_account_with_profile(account_id: account_id)

      expect(logger).to receive(:error) do |json_string|
        log = JSON.parse(json_string)
        expect(log["request_id"]).to eq("req-1")
        expect(log["account_id"]).to eq(account_id)
        expect(log["profile_id"]).to eq(profile_id)
        expect(log["error_class"]).to eq("GRPC::NotFound")
      end

      expect { chain.intercept! { raise GRPC::NotFound } }.to raise_error(GRPC::NotFound)
    end
  end

  context "with an anonymous request" do
    let(:metadata) { { "x-request-id" => "req-2" } }

    it "logs the request id without an account for an anonymous request" do
      expect(logger).to receive(:info) do |json_string|
        log = JSON.parse(json_string)
        expect(log["request_id"]).to eq("req-2")
        expect(log["account_id"]).to be_nil
        expect(log["profile_id"]).to be_nil
      end

      chain.intercept! { :result }
    end
  end

  context "when resolving the profile fails" do
    let(:metadata) { { "x-request-id" => "req-3", "x-user-id" => account_id, "x-profile-id" => "p" } }

    before do
      allow_any_instance_of(Profile::Repositories::ProfileRepository).to receive(:find_visible_by_id).and_raise("db down")
    end

    it "logs the error raised while resolving the profile" do
      expect(logger).to receive(:error) do |json_string|
        log = JSON.parse(json_string)
        expect(log["request_id"]).to eq("req-3")
        expect(log["account_id"]).to eq(account_id)
        expect(log["error"]).to eq("db down")
      end

      expect { chain.intercept! { :result } }.to raise_error(RuntimeError, "db down")
    end
  end
end
