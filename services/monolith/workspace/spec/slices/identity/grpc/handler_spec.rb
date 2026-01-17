# frozen_string_literal: true

require "spec_helper"
require "slices/identity/grpc/handler"

RSpec.describe Identity::Grpc::Handler do
  let(:handler) {
    described_class.new(
      method_key: :test,
      service: double,
      rpc_desc: double,
      active_call: double,
      message: message,
      register_service: register_service,
      login_service: login_service,
      send_sms_service: send_sms_service,
      verify_sms_service: verify_sms_service,
      get_current_user_service: get_current_user_service
    )
  }
  let(:message) { double(:message) }

  # Mocks for dependencies
  let(:register_service) { double(:register_service) }
  let(:login_service) { double(:login_service) }
  let(:send_sms_service) { double(:send_sms_service) }
  let(:verify_sms_service) { double(:verify_sms_service) }
  let(:get_current_user_service) { double(:get_current_user_service) }

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

    it "calls send_sms_service and returns success" do
      expect(send_sms_service).to receive(:call).with(phone_number: phone_number)

      response = handler.send_sms
      expect(response).to be_a(Identity::V1::SendSmsResponse)
      expect(response.success).to be(true)
    end
  end

  # Additional specs for other methods (verify_sms, register, login, get_current_user) would go here
  # Implementation skipped for brevity for this initial step
end
