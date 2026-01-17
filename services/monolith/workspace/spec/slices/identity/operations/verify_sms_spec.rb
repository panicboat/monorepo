# frozen_string_literal: true

require "spec_helper"
require "slices/identity/operations/verify_sms"

RSpec.describe Identity::Operations::VerifySms do
  let(:service) { described_class.new(repo: repo) }

  # TODO: Review mock behavior for sms verification repository
  let(:repo) { double(:sms_verification_repository) }

  describe "#call" do
    let(:phone_number) { "+1234567890" }
    let(:code) { "123456" }
    let(:now) { Time.now }

    context "when code is valid" do
      let(:verification) do
        double(
          :verification,
          id: "ver-123",
          code: code,
          expires_at: now + 300
        )
      end

      before do
        allow(repo).to receive(:find_latest_by_phone_number).with(phone_number).and_return(verification)
        allow(repo).to receive(:mark_as_verified).with("ver-123")
      end

      it "returns success and token" do
        result = service.call(phone_number: phone_number, code: code)

        expect(result[:success]).to be(true)
        expect(result[:verification_token]).to eq("ver-123")
      end
    end

    context "when code is expired" do
      let(:verification) do
        double(
          :verification,
          code: code,
          expires_at: now - 300
        )
      end

      before do
        allow(repo).to receive(:find_latest_by_phone_number).with(phone_number).and_return(verification)
      end

      it "raises VerificationError" do
        expect {
          service.call(phone_number: phone_number, code: code)
        }.to raise_error(Identity::Operations::VerifySms::VerificationError, "Code expired")
      end
    end
  end
end
