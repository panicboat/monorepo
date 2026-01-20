# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Verification::VerifyCode do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:sms_verification_repository) }

  describe "#call" do
    let(:phone_number) { "+1234567890" }
    let(:code) { "0000" }

    context "when code is valid" do
      let(:verification) do
        double(
          :verification,
          id: "ver-123",
          code: code,
          expires_at: Time.now + 300
        )
      end

      before do
        allow(repo).to receive(:find_latest_by_phone_number).with(phone_number).and_return(verification)
        allow(repo).to receive(:mark_as_verified)
      end

      it "returns success with verification token" do
        result = use_case.call(phone_number: phone_number, code: code)

        expect(result[:success]).to be(true)
        expect(result[:verification_token]).to eq("ver-123")
      end

      it "marks verification as verified" do
        expect(repo).to receive(:mark_as_verified).with("ver-123")
        use_case.call(phone_number: phone_number, code: code)
      end
    end

    context "when verification not found" do
      before do
        allow(repo).to receive(:find_latest_by_phone_number).with(phone_number).and_return(nil)
      end

      it "raises VerificationError" do
        expect {
          use_case.call(phone_number: phone_number, code: code)
        }.to raise_error(Identity::UseCases::Verification::VerifyCode::VerificationError, "Verification not found")
      end
    end

    context "when code is expired" do
      let(:verification) do
        double(
          :verification,
          id: "ver-123",
          code: code,
          expires_at: Time.now - 300
        )
      end

      before do
        allow(repo).to receive(:find_latest_by_phone_number).with(phone_number).and_return(verification)
      end

      it "raises VerificationError" do
        expect {
          use_case.call(phone_number: phone_number, code: code)
        }.to raise_error(Identity::UseCases::Verification::VerifyCode::VerificationError, "Code expired")
      end
    end

    context "when code does not match" do
      let(:verification) do
        double(
          :verification,
          id: "ver-123",
          code: "different",
          expires_at: Time.now + 300
        )
      end

      before do
        allow(repo).to receive(:find_latest_by_phone_number).with(phone_number).and_return(verification)
      end

      it "raises VerificationError" do
        expect {
          use_case.call(phone_number: phone_number, code: code)
        }.to raise_error(Identity::UseCases::Verification::VerifyCode::VerificationError, "Invalid code")
      end
    end
  end
end
