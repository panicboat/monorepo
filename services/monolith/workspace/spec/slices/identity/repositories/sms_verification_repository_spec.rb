# frozen_string_literal: true

require "spec_helper"
require "slices/identity/repositories/sms_verification_repository"

RSpec.describe Identity::Repositories::SmsVerificationRepository, type: :database do
  subject(:repo) { described_class.new }

  describe "#create" do
    it "creates a new verification record" do
      verification = repo.create(
        phone_number: "+1234567890",
        code: "123456",
        expires_at: Time.now + 300
      )

      expect(verification.id).not_to be_nil
      expect(verification.phone_number).to eq("+1234567890")
      expect(verification.code).to eq("123456")
    end
  end

  describe "#find_latest_by_phone_number" do
    context "when multiple records exist" do
      before do
        repo.sms_verifications.command(:create).call(
          phone_number: "+1234567890",
          code: "111111",
          expires_at: Time.now - 300,
          created_at: Time.now - 100
        )
        repo.sms_verifications.command(:create).call(
          phone_number: "+1234567890",
          code: "222222",
          expires_at: Time.now + 300,
          created_at: Time.now
        )
      end

      it "returns the most recent one" do
        verification = repo.find_latest_by_phone_number("+1234567890")
        expect(verification.code).to eq("222222")
      end
    end

    context "when no output exists" do
      it "returns nil" do
        verification = repo.find_latest_by_phone_number("+9999999999")
        expect(verification).to be_nil
      end
    end
  end

  describe "#mark_as_verified" do
    let!(:verification) { repo.create(phone_number: "+1234567890", code: "123456", expires_at: Time.now + 300) }

    it "updates verified_at timestamp" do
      repo.mark_as_verified(verification.id)

      updated = repo.find_by_id(verification.id)
      expect(updated.verified_at).not_to be_nil
    end
  end
end
