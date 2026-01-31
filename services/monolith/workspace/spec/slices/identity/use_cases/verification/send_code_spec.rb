# frozen_string_literal: true

require "spec_helper"
require "sms"

RSpec.describe Identity::UseCases::Verification::SendCode do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:sms_verification_repository) }
  let(:sms_service) { SMS::MockAdapter.new }

  before do
    SMS.service = sms_service
    ENV["MOCK_SMS_CODE"] = "0000"
  end

  after do
    SMS.reset!
    ENV.delete("MOCK_SMS_CODE")
  end

  describe "#call" do
    let(:phone_number) { "+1234567890" }
    let(:verification) { double(:verification, id: "ver-123") }

    it "creates verification and returns it" do
      expect(repo).to receive(:create).with(
        phone_number: phone_number,
        code: "0000",
        expires_at: kind_of(Time)
      ).and_return(verification)

      result = use_case.call(phone_number: phone_number)
      expect(result).to eq(verification)
    end

    it "sends SMS via the configured adapter" do
      allow(repo).to receive(:create).and_return(verification)

      use_case.call(phone_number: phone_number)

      messages = sms_service.messages_to(phone_number)
      expect(messages.length).to eq(1)
      expect(messages.first[:message]).to include("0000")
    end

    context "when MOCK_SMS_CODE is not set" do
      before do
        ENV.delete("MOCK_SMS_CODE")
      end

      it "generates a random 4-digit code" do
        allow(repo).to receive(:create) do |attrs|
          expect(attrs[:code]).to match(/\A\d{4}\z/)
          verification
        end

        use_case.call(phone_number: phone_number)
      end
    end

    context "when SMS sending fails" do
      let(:failing_sms) { double(:sms_service) }

      before do
        allow(failing_sms).to receive(:send_verification)
          .and_return({ success: false, message_id: nil, error: "Network error" })
        SMS.service = failing_sms
      end

      it "still creates verification record" do
        expect(repo).to receive(:create).and_return(verification)

        result = use_case.call(phone_number: phone_number)
        expect(result).to eq(verification)
      end
    end
  end
end
