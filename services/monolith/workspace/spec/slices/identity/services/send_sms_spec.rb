RSpec.describe Identity::Services::SendSms, :db do
  subject(:service) { described_class.new }
  let(:repo) { Identity::Repositories::SmsVerificationRepository.new }

  it "creates an sms verification record" do
    result = service.call(phone_number: "09012345678")

    expect(result).not_to be_nil
    # Check mocked expiration
    expect(result.expires_at).to be > Time.now

    # Verify DB
    record = repo.find_latest_by_phone_number("09012345678")
    expect(record).not_to be_nil
    # TODO: Verify real SMS sending (e.g. check Twilio mock)
    expect(record.code).to eq("0000") # Mock logic
  end
end
