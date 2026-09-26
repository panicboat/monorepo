# frozen_string_literal: true

require "spec_helper"
require "slices/review/repositories/cast_settings_repository"

RSpec.describe Review::Repositories::CastSettingsRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:account_id) { SecureRandom.uuid_v7 }

  it "returns nil when no row exists" do
    expect(repo.find_by_account(account_id)).to be_nil
  end

  it "creates a row on first upsert" do
    repo.upsert(account_id: account_id, reviews_visible: false)
    expect(repo.find_by_account(account_id).reviews_visible).to eq(false)
  end

  it "updates an existing row on subsequent upsert" do
    repo.upsert(account_id: account_id, reviews_visible: false)
    repo.upsert(account_id: account_id, reviews_visible: true)
    expect(repo.find_by_account(account_id).reviews_visible).to eq(true)
  end
end
