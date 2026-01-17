require "spec_helper"
require "slices/identity/repositories/refresh_token_repository"
require "slices/identity/repositories/user_repository"

RSpec.describe Identity::Repositories::RefreshTokenRepository do
  let(:repo) { described_class.new }
  let(:user_repo) { Identity::Repositories::UserRepository.new }
  let(:phone) { "090#{rand(1000..9999)}#{rand(1000..9999)}" }
  let(:user) { user_repo.create(phone_number: phone, password_digest: 'digest', role: 1) }

  before do
    repo.refresh_tokens.delete
  end

  context "#create" do
    it "creates a refresh token" do
      token = SecureRandom.hex(32)
      repo.create(token: token, user_id: user.id, expires_at: Time.now + 3600)

      found = repo.find_by_token(token)
      expect(found).not_to be_nil
      expect(found.token).to eq(token)
      expect(found.user_id).to eq(user.id)
    end
  end

  context "#find_by_token" do
    let(:token) { SecureRandom.hex(32) }

    before do
      repo.create(token: token, user_id: user.id, expires_at: Time.now + 3600)
    end

    it "finds the token" do
      found = repo.find_by_token(token)
      expect(found).not_to be_nil
      expect(found.token).to eq(token)
    end

    it "returns nil for non-existent token" do
      expect(repo.find_by_token("invalid")).to be_nil
    end
  end

  context "#revoke" do
    let(:token) { SecureRandom.hex(32) }

    before do
      repo.create(token: token, user_id: user.id, expires_at: Time.now + 3600)
    end

    it "deletes the token" do
      repo.revoke(token)
      expect(repo.find_by_token(token)).to be_nil
    end
  end
end
