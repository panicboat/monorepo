# frozen_string_literal: true

require "spec_helper"
require "sms"

RSpec.describe Identity::UseCases::Verification::SendCode do
  subject(:use_case) { Identity::Slice["use_cases.verification.send_code"] }

  let(:repo) { Identity::Slice["repositories.sms_verification_repository"] }
  let(:phone) { "+819012345678" }
  let(:fake) { Sms::FakeAdapter.new }

  before { Sms.adapter = fake }
  after { Sms.reset! }

  def freeze_time_at(t)
    original = Time.now
    allow(Time).to receive(:now).and_return(t)
    yield
  ensure
    allow(Time).to receive(:now).and_call_original
  end

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

  it "expires the previous active verification on resend" do
    base = Time.now
    first = freeze_time_at(base) { use_case.call(phone_number: phone) }
    second = freeze_time_at(base + 61) { use_case.call(phone_number: phone) }

    expect(second.id).not_to eq(first.id)
    reloaded = repo.find_by_id(first.id)
    expect(reloaded).not_to be_nil
    expect(reloaded.expires_at).to be <= (base + 61)
  end

  it "rejects resend within 60 seconds" do
    base = Time.now
    freeze_time_at(base) { use_case.call(phone_number: phone) }

    expect {
      freeze_time_at(base + 30) { use_case.call(phone_number: phone) }
    }.to raise_error(Identity::UseCases::Verification::SendCode::RateLimitError)
  end

  it "rejects when 5 sends already happened in the last 24 hours" do
    base = Time.now
    5.times do |i|
      freeze_time_at(base + i * 120) { use_case.call(phone_number: phone) }
    end

    expect {
      freeze_time_at(base + 5 * 120 + 120) { use_case.call(phone_number: phone) }
    }.to raise_error(Identity::UseCases::Verification::SendCode::RateLimitError)
  end
end
