# frozen_string_literal: true

require "spec_helper"
require "sms"

RSpec.describe Identity::UseCases::Verification::SendCode do
  subject(:use_case) { Identity::Slice["use_cases.verification.send_code"] }

  let(:phone) { "+819012345678" }
  let(:fake) { Sms::FakeAdapter.new }

  before { Sms.adapter = fake }
  after { Sms.reset! }

  it "generates a 6-digit numeric code and persists it" do
    verification = use_case.call(phone_number: phone)
    expect(verification.code).to match(/\A\d{6}\z/)
    expect(verification.phone_number).to eq(phone)
  end

  it "sends the generated code via the SMS adapter (no mock 0000)" do
    verification = use_case.call(phone_number: phone)
    expect(fake.sent.size).to eq(1)
    expect(fake.sent.first[:phone_number]).to eq(phone)
    expect(fake.sent.first[:body]).to include(verification.code)
    expect(verification.code).not_to eq("0000")
  end
end
