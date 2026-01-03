RSpec.describe Identity::Services::Login, :db do
  subject(:service) { described_class.new }
  let(:repo) { Identity::Repositories::UserRepository.new }

  before do
    # Create user manually
    hash = BCrypt::Password.create("password")
    repo.create(email: "login@example.com", password_hash: hash, role: "guest")
  end

  it "returns token on successful login" do
    result = service.call(email: "login@example.com", password: "password")

    expect(result).not_to be_nil
    expect(result[:access_token]).to be_a(String)
    expect(result[:user_profile][:email]).to eq("login@example.com")
  end

  it "returns nil on invalid password" do
    result = service.call(email: "login@example.com", password: "wrong_password")
    expect(result).to be_nil
  end

  it "returns nil on unknown user" do
    result = service.call(email: "unknown@example.com", password: "password")
    expect(result).to be_nil
  end
end
