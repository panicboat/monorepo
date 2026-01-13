RSpec.describe Identity::Services::VerifySms, :db do
  subject(:service) { described_class.new }
  let(:repo) { Identity::Repositories::SmsVerificationRepository.new }

  before do
    repo.create(phone_number: "09012345678", code: "0000", expires_at: Time.now + 3600)
  end

  it "verifies valid code and returns token" do
    result = service.call(phone_number: "09012345678", code: "0000")

    # Return the verification ID as the token
    # TODO: In a real implementation, this might be a separate secure token column
    expect(result[:verification_token]).to be_a(String)

    # Verify DB state
    record = repo.find_latest_by_phone_number("09012345678")
    expect(record.verified_at).not_to be_nil
    expect(record.id).to eq(result[:verification_token])
  end

  it "fails on invalid code" do
    expect {
      service.call(phone_number: "09012345678", code: "9999")
    }.to raise_error(Identity::Services::VerifySms::VerificationError)
  end

  it "fails on non-existent phone number" do
    expect {
      service.call(phone_number: "09000000000", code: "0000")
    }.to raise_error(Identity::Services::VerifySms::VerificationError)
  end
end
