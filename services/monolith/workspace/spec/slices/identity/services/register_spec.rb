RSpec.describe Identity::Services::Register, :db do
  subject(:service) { described_class.new }
  let(:repo) { Identity::Repositories::UserRepository.new }
  let(:sms_repo) { Identity::Repositories::SmsVerificationRepository.new }

  before do
    # Create a verified token for the phone number
    sms_repo.create(phone_number: "09012345678", code: "0000", expires_at: Time.now + 3600)
    # Mark it as verified (simulation)
    # TODO: This setup relies on mock SMS verification logic
    verification = sms_repo.find_latest_by_phone_number("09012345678")
    sms_repo.mark_as_verified(verification.id)
  end

  it "creates a user and returns result with token" do
    # Fetch the verified token string
    verification = sms_repo.find_latest_by_phone_number("09012345678")
    token_string = verification.id

    result = service.call(phone_number: "09012345678", password: "password", verification_token: token_string)

    expect(result[:access_token]).to be_a(String)
    expect(result[:user_profile][:phone_number]).to eq("09012345678")
    expect(result[:user_profile][:role]).to eq(1) # Default Guest role

    # Verify DB
    user = repo.find_by_phone_number("09012345678")
    expect(user).not_to be_nil
    expect(BCrypt::Password.new(user.password_digest)).to eq("password")
  end

  it "fails if verification token is invalid" do
    expect {
      service.call(phone_number: "09012345678", password: "password", verification_token: SecureRandom.uuid)
    }.to raise_error(Identity::Services::Register::RegistrationError)
  end
end
