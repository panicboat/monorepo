RSpec.describe Identity::Repositories::UserRepository do
  let(:repo) { described_class.new }

  describe "#create" do
    it "creates a user with hashed password" do
      user = repo.create(phone_number: "09012345678", password_digest: "hashed_secret", role: :ROLE_GUEST)

      expect(user.id).not_to be_nil
      expect(user.phone_number).to eq("09012345678")
      expect(user.password_digest).to eq("hashed_secret")
    end
  end

  describe "#find_by_phone_number" do
    before do
      repo.create(phone_number: "09012345678", password_digest: "123", role: :ROLE_CAST)
    end

    it "returns the user if found" do
      user = repo.find_by_phone_number("09012345678")
      expect(user).not_to be_nil
      expect(user.phone_number).to eq("09012345678")
    end

    it "returns nil if not found" do
      user = repo.find_by_phone_number("09099999999")
      expect(user).to be_nil
    end
  end
end
