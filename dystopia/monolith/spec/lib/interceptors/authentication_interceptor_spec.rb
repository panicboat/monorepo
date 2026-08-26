# frozen_string_literal: true

require "base64"
require "json"
require "openssl"
require "spec_helper"
require "lib/current"
require "lib/interceptors/authentication_interceptor"

RSpec.describe Interceptors::AuthenticationInterceptor do
  let(:interceptor) { described_class.new(request, error) }
  let(:request) { double(:request, metadata: metadata, context: {}) }
  let(:error) { double(:error) }
  let(:metadata) { {} }

  describe "#call" do
    context "when x-user-id metadata is present" do
      let(:metadata) { { "x-user-id" => "sub-1" } }

      it "sets Current.user_id to the metadata value" do
        interceptor.call { expect(Current.user_id).to eq("sub-1") }
      end

      it "sets current_user_id in the request context" do
        interceptor.call {}
        expect(request.context[:current_user_id]).to eq("sub-1")
      end
    end

    context "when x-user-id metadata is absent" do
      it "leaves Current.user_id nil" do
        interceptor.call { expect(Current.user_id).to be_nil }
      end
    end

    context "with an Authorization: Bearer header" do
      let(:private_key) { OpenSSL::PKey::RSA.new(2048) }
      let(:metadata) { { "authorization" => "Bearer #{signed_token}" } }

      around do |example|
        original_private_key = ENV["JWT_PRIVATE_KEY"]
        original_public_key = ENV["JWT_PUBLIC_KEY"]
        ENV["JWT_PRIVATE_KEY"] = private_key.to_pem
        ENV["JWT_PUBLIC_KEY"] = private_key.public_key.to_pem
        example.run
      ensure
        restore_environment("JWT_PRIVATE_KEY", original_private_key)
        restore_environment("JWT_PUBLIC_KEY", original_public_key)
      end

      it "does not extract a user id from Bearer" do
        interceptor.call { expect(Current.user_id).to be_nil }
      end
    end

    it "propagates or generates a request id" do
      interceptor.call { expect(Current.request_id).not_to be_nil }
    end

    it "clears Current after the block" do
      interceptor.call {}
      expect(Current.user_id).to be_nil
      expect(Current.request_id).to be_nil
    end
  end

  private

  def signed_token
    header = Base64.urlsafe_encode64(JSON.generate({ alg: "RS256", typ: "JWT" }), padding: false)
    payload = Base64.urlsafe_encode64(JSON.generate({ sub: "legacy-sub" }), padding: false)
    signing_input = [header, payload].join(".")
    signature = private_key.sign(OpenSSL::Digest::SHA256.new, signing_input)

    [signing_input, Base64.urlsafe_encode64(signature, padding: false)].join(".")
  end

  def restore_environment(key, value)
    value.nil? ? ENV.delete(key) : ENV[key] = value
  end
end
