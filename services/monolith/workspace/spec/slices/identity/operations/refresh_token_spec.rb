require 'spec_helper'
require 'slices/identity/operations/refresh_token'

RSpec.describe Identity::Operations::RefreshToken do
  let(:service) { described_class.new(repo: repo, user_repo: user_repo) }
  let(:repo) { double(:refresh_token_repository) }
  let(:user_repo) { double(:user_repository) }
  let(:valid_token) { "valid_token" }
  let(:user_id) { "user-uuid" }
  let(:user) { double(:user, id: user_id, role: 1) }

  context 'with valid refresh token' do
    let(:token_record) { double(:token, user_id: user_id, expires_at: Time.now + 3600) }

    before do
      allow(repo).to receive(:find_by_token).with(valid_token).and_return(token_record)
      allow(repo).to receive(:revoke).with(valid_token)
      allow(user_repo).to receive(:find_by_id).with(user_id).and_return(user)
      allow(repo).to receive(:create)
    end

    it 'returns new tokens and rotates refresh token' do
      result = service.call(refresh_token: valid_token)

      expect(result).to be_a(Hash)
      expect(result[:access_token]).not_to be_nil
      expect(result[:refresh_token]).not_to be_nil

      expect(repo).to have_received(:revoke).with(valid_token)
      expect(repo).to have_received(:create).with(hash_including(user_id: user_id))
    end
  end

  context 'with invalid refresh token' do
    before do
      allow(repo).to receive(:find_by_token).with('invalid').and_return(nil)
    end

    it 'returns nil' do
      expect(service.call(refresh_token: 'invalid')).to be_nil
    end
  end

  context 'with expired refresh token' do
    let(:token) { "expired_token" }
    let(:token_record) { double(:token, user_id: user_id, expires_at: Time.now - 3600) }

    before do
      allow(repo).to receive(:find_by_token).with(token).and_return(token_record)
    end

    it 'returns nil' do
      expect(service.call(refresh_token: token)).to be_nil
    end
  end
end
