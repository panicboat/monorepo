RSpec.describe Identity::Services::Register, :db do
  subject(:service) { described_class.new }
  let(:repo) { Identity::Repositories::UserRepository.new }

  it "creates a user and returns result with token" do
    result = service.call(email: "reg@example.com", password: "password", role: "guest")

    expect(result[:access_token]).to be_a(String)
    expect(result[:user_profile][:email]).to eq("reg@example.com")
    expect(result[:user_profile][:role]).to eq("guest")

    # Verify DB
    user = repo.find_by_email("reg@example.com")
    expect(user).not_to be_nil
    expect(BCrypt::Password.new(user.password_hash)).to eq("password")
  end
end
