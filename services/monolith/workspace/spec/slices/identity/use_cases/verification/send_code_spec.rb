# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Verification::SendCode do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:sms_verification_repository) }

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
  end
end
