RSpec.describe Identity::Repositories::UserRepository, :db do
  subject(:repo) { described_class.new }

  describe "#create" do
    it "creates a user with hashed password" do
      user = repo.create(email: "spec@example.com", password_hash: "hashed_secret", role: "guest")

      expect(user.id).not_to be_nil
      expect(user.email).to eq("spec@example.com")
      expect(user.role).to eq("guest")
      expect(user.password_hash).to eq("hashed_secret")
    end
  end

  describe "#find_by_email" do
    before do
      repo.create(email: "found@example.com", password_hash: "123", role: "cast")
    end

    it "returns the user if found" do
      user = repo.find_by_email("found@example.com")
      expect(user).not_to be_nil
      expect(user.email).to eq("found@example.com")
      expect(user.role).to eq("cast")
    end

    it "returns nil if not found" do
      user = repo.find_by_email("missing@example.com")
      expect(user).to be_nil
    end
  end
end
