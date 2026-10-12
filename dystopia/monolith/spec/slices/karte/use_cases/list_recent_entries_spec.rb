# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::ListRecentEntries do
  let(:owner_id) { create_account(role: 2) }
  let(:author_id) { create_account_with_profile(account_id: owner_id, username: "author") }
  let(:target_id) { create_account_with_profile(role: 1, username: "guest") }
  let(:entry_repo) { Karte::Repositories::EntryRepository.new }
  let(:event_repo) { Karte::Repositories::EventRepository.new }
  let(:entry) { entry_repo.create(author_account_id: owner_id, author_profile_id: author_id, target_profile_id: target_id, rating: 4) }

  it "includes open charts and does not move an appended chart to the front" do
    first = entry
    later = entry_repo.create(author_account_id: owner_id, author_profile_id: author_id, target_profile_id: target_id)
    Hanami.app["db.gateway"].connection[:karte__entries].where(id: first.id).update(created_at: Time.utc(2026, 10, 12, 10))
    Hanami.app["db.gateway"].connection[:karte__entries].where(id: later.id).update(created_at: Time.utc(2026, 10, 12, 11))
    event_repo.create(entry_id: first.id, input: {stage: "booking", outcome: "confirmed", tags: [], note: "追記", occurred_on: Date.new(2026, 10, 12)})
    entry_repo.update(first.id, {})
    result = described_class.new.call(viewer_account_id: owner_id)
    expect(result[:entries].map { |item| item[:id] }).to eq([later.id, first.id])
    expect(result[:entries].last[:latest_event][:note]).to eq("追記")
  end

  it "keeps pagination stable for equal creation times" do
    first = entry
    second = entry_repo.create(author_account_id: owner_id, author_profile_id: author_id, target_profile_id: target_id)
    db = Hanami.app["db.gateway"].connection
    db[:karte__entries].where(id: [first.id, second.id]).update(created_at: Time.utc(2026, 10, 12))
    page = described_class.new.call(viewer_account_id: owner_id, limit: 1)
    following = described_class.new.call(viewer_account_id: owner_id, limit: 1, cursor: page[:next_cursor])
    expect((page[:entries] + following[:entries]).map { |item| item[:id] }.uniq.length).to eq(2)
    expect(following[:has_more]).to be(false)
  end
end
