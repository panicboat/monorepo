# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::PurgeProfile, type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:repo) { Review::Slice["repositories.review_repository"] }
  let(:cast) { create_account_with_profile(role: 2, username: "cast_one") }
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "guest_one") }
  let(:other_cast) { create_account_with_profile(role: 2, username: "cast_two") }

  it "deletes the reviews the profile wrote or received with their events and keeps the others" do
    gone = repo.create(author_account_id: guest_account, author_profile_id: guest, target_profile_id: cast, rating: nil, occurred_on: Date.new(2026, 10, 1))
    Review::Slice["repositories.event_repository"].create(review_id: gone.id, stage: "service", outcome: "satisfied", tags: [], note: nil, occurred_on: Date.new(2026, 10, 1))
    kept = repo.create(author_account_id: create_account(role: 1), author_profile_id: create_account_with_profile(username: "guest_two"), target_profile_id: other_cast, rating: nil, occurred_on: Date.new(2026, 10, 1))

    described_class.new.call(profile_id: cast)

    expect(db[:review__reviews].select_map(:id)).to eq([kept.id])
    expect(db[:review__events].count).to eq(0)
  end
end
