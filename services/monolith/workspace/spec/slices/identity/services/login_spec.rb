RSpec.describe Identity::Services::Login, :db do
  subject(:service) { described_class.new }
  let(:repo) { Identity::Repositories::UserRepository.new }

  before do
    # Create user manually
    hash = BCrypt::Password.create("password")
    repo.create(phone_number: "09012345678", password_digest: hash, role: 1)
  end

  it "returns token on successful login" do
    result = service.call(phone_number: "09012345678", password: "password")

    expect(result).not_to be_nil
    expect(result[:access_token]).to be_a(String)
    expect(result[:user_profile][:phone_number]).to eq("09012345678")
    expect(result[:user_profile][:role]).to eq(1)
  end

  it "returns nil on invalid password" do
    result = service.call(phone_number: "09012345678", password: "wrong_password")
    expect(result).to be_nil
  end

  it "returns nil on unknown user" do
    result = service.call(phone_number: "09000000000", password: "password")
    expect(result).to be_nil
  end
end
