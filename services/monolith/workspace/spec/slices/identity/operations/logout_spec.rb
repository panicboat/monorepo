require 'spec_helper'
require 'slices/identity/operations/logout'

RSpec.describe Identity::Operations::Logout do
  let(:service) { described_class.new(repo: repo) }
  let(:repo) { double(:refresh_token_repository) }
  let(:token) { "token" }

  before do
    allow(repo).to receive(:revoke).with(token)
  end

  it 'revokes the token' do
    service.call(refresh_token: token)
    expect(repo).to have_received(:revoke).with(token)
  end
end
