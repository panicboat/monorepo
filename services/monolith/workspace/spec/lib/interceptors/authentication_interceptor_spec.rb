# frozen_string_literal: true

require "spec_helper"
require "lib/interceptors/authentication_interceptor"
require "lib/current"

RSpec.describe Interceptors::AuthenticationInterceptor do
  let(:interceptor) { described_class.new(request, error) }
  let(:request) { double(:request, metadata: metadata, context: {}) }
  let(:error) { double(:error) }
  let(:metadata) { {} }

  describe "#call" do
    subject(:call) { interceptor.call { :yielded } }

    context "when x-user-id metadata is present" do
      let(:metadata) { { 'x-user-id' => 'user-123' } }

      it "sets Current.user_id" do
        interceptor.call do
          expect(::Current.user_id).to eq('user-123')
        end
      end

      it "sets user_id in request context" do
        call
        expect(request.context[:current_user_id]).to eq('user-123')
      end

      it "yields control" do
        expect(call).to eq(:yielded)
      end
    end

    context "when authorization header is present" do
      let(:secret) { 'pan1cb0at' }
      let(:user_id) { 'user-456' }
      let(:token) { JWT.encode({ sub: user_id }, secret, 'HS256') }
      let(:metadata) { { 'authorization' => "Bearer #{token}" } }

      it "decodes JWT and sets Current.user_id" do
        interceptor.call do
          expect(::Current.user_id).to eq(user_id)
        end
      end
    end

    context "when authorization header contains invalid JWT" do
      let(:metadata) { { 'authorization' => "Bearer invalid-token" } }

      it "does not set Current.user_id" do
        call
        expect(::Current.user_id).to be_nil
      end
    end

    context "when no authentication metadata is present" do
      it "does not set Current.user_id" do
        call
        expect(::Current.user_id).to be_nil
      end
    end

    it "clears Current after execution" do
      # Set state to verify it gets cleared
      ::Current.user_id = "temp"
      ::Current.request_id = "temp-request"

      interceptor.call {
        # Inside the block, it might be set (if we provided metadata),
        # or nil (if we didn't).
        # But we want to ensure it's cleared *after* the block returns.
      }

      expect(::Current.user_id).to be_nil
      expect(::Current.request_id).to be_nil
    end

    context "when x-request-id metadata is present" do
      let(:metadata) { { 'x-request-id' => 'request-abc-123' } }

      it "sets Current.request_id from header" do
        interceptor.call do
          expect(::Current.request_id).to eq('request-abc-123')
        end
      end

      it "sets request_id in request context" do
        call
        expect(request.context[:request_id]).to eq('request-abc-123')
      end
    end

    context "when x-request-id metadata is not present" do
      let(:metadata) { {} }

      it "generates a UUID for Current.request_id" do
        interceptor.call do
          expect(::Current.request_id).to match(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
        end
      end

      it "sets generated request_id in request context" do
        call
        expect(request.context[:request_id]).to match(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
      end
    end
  end
end
