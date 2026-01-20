# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/identity/grpc/handler"

RSpec.describe Identity::Grpc::Handler do
  let(:handler) {
    described_class.new(
      method_key: :test,
      service: double,
      rpc_desc: double,
      active_call: double,
      message: message,
      login_uc: login_uc,
      logout_uc: logout_uc,
      register_uc: register_uc,
      refresh_token_uc: refresh_token_uc,
      send_code_uc: send_code_uc,
      verify_code_uc: verify_code_uc,
      get_profile_uc: get_profile_uc
    )
  }
  let(:message) { double(:message) }

  # Mocks for use cases
  let(:login_uc) { double(:login_uc) }
  let(:logout_uc) { double(:logout_uc) }
  let(:register_uc) { double(:register_uc) }
  let(:refresh_token_uc) { double(:refresh_token_uc) }
  let(:send_code_uc) { double(:send_code_uc) }
  let(:verify_code_uc) { double(:verify_code_uc) }
  let(:get_profile_uc) { double(:get_profile_uc) }

  describe "#health_check" do
    it "returns serving status" do
      response = handler.health_check
      expect(response).to be_a(Identity::V1::HealthCheckResponse)
      expect(response.status).to eq("serving")
    end
  end

  describe "#send_sms" do
    let(:phone_number) { "+1234567890" }
    let(:message) { Identity::V1::SendSmsRequest.new(phone_number: phone_number) }

    it "calls send_code_uc and returns success" do
      expect(send_code_uc).to receive(:call).with(phone_number: phone_number)

      response = handler.send_sms
      expect(response).to be_a(Identity::V1::SendSmsResponse)
      expect(response.success).to be(true)
    end
  end

  describe "#verify_sms" do
    let(:phone_number) { "+1234567890" }
    let(:code) { "123456" }
    let(:message) { Identity::V1::VerifySmsRequest.new(phone_number: phone_number, code: code) }

    it "returns token when verification succeeds" do
      expect(verify_code_uc).to receive(:call).with(phone_number: phone_number, code: code).and_return({ success: true, verification_token: "token" })

      response = handler.verify_sms
      expect(response).to be_a(Identity::V1::VerifySmsResponse)
      expect(response.verification_token).to eq("token")
    end

    it "raises error when verification fails" do
      expect(verify_code_uc).to receive(:call).and_return({ success: false })

      expect { handler.verify_sms }.to raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(GRPC::Core::StatusCodes::INVALID_ARGUMENT) }
    end
  end

  describe "#register" do
    let(:message) { Identity::V1::RegisterRequest.new(phone_number: "123", password: "pass", verification_token: "token", role: :ROLE_CAST) }

    it "registers user and returns tokens" do
      result = {
        access_token: "access",
        refresh_token: "refresh",
        user_profile: { id: "1", phone_number: "123", role: 2 }
      }
      expect(register_uc).to receive(:call).with(
        phone_number: "123",
        password: "pass",
        verification_token: "token",
        role: 2 # :ROLE_CAST -> 2
      ).and_return(result)

      response = handler.register
      expect(response).to be_a(Identity::V1::RegisterResponse)
      expect(response.access_token).to eq("access")
      expect(response.user_profile.role).to eq(:ROLE_CAST)
    end
  end

  describe "#login" do
    let(:message) { Identity::V1::LoginRequest.new(phone_number: "123", password: "pass", role: :ROLE_CAST) }

    it "logs in user and returns tokens" do
      result = {
        access_token: "access",
        refresh_token: "refresh",
        user_profile: { id: "1", phone_number: "123", role: 2 }
      }
      expect(login_uc).to receive(:call).with(phone_number: "123", password: "pass", role: 2).and_return(result)

      response = handler.login
      expect(response).to be_a(Identity::V1::LoginResponse)
    end

    it "raises unauthenticated on failure" do
      expect(login_uc).to receive(:call).and_return(nil)
      expect { handler.login }.to raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED) }
    end
  end

  describe "#refresh_token" do
    let(:message) { Identity::V1::RefreshTokenRequest.new(refresh_token: "refresh") }

    it "returns new tokens" do
      expect(refresh_token_uc).to receive(:call).with(refresh_token: "refresh").and_return({ access_token: "new_first", refresh_token: "new_refresh" })

      response = handler.refresh_token
      expect(response).to be_a(Identity::V1::RefreshTokenResponse)
      expect(response.access_token).to eq("new_first")
    end
  end

  describe "#logout" do
    let(:message) { Identity::V1::LogoutRequest.new(refresh_token: "refresh") }

    it "calls logout use case" do
      expect(logout_uc).to receive(:call).with(refresh_token: "refresh")
      handler.logout
    end
  end

  describe "#get_current_user" do
    before { allow(Current).to receive(:user_id).and_return(1) }

    it "returns user profile" do
      expect(get_profile_uc).to receive(:call).with(user_id: 1).and_return({ id: "1", phone_number: "123", role: 2 })

      response = handler.get_current_user
      expect(response).to be_a(Identity::V1::UserProfile)
      expect(response.role).to eq(:ROLE_CAST)
    end

    it "raises unauthenticated if no current user" do
      allow(Current).to receive(:user_id).and_return(nil)
      expect { handler.get_current_user }.to raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED) }
    end
  end
end
