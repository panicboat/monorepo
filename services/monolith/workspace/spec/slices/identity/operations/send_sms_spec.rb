# frozen_string_literal: true

require "spec_helper"
require "slices/identity/operations/send_sms"

RSpec.describe Identity::Operations::SendSms do
  let(:service) { described_class.new(repo: repo) }

  # TODO: Review mock behavior for sms verification repository
  let(:repo) { double(:sms_verification_repository) }

  describe "#call" do
    let(:phone_number) { "+1234567890" }

    before do
      allow(repo).to receive(:create).and_return(double(:verification))
    end

    it "creates a verification record" do
      expect(repo).to receive(:create)
      service.call(phone_number: phone_number)
    end
  end
end
