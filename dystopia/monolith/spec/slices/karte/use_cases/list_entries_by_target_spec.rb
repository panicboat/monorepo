# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::ListEntriesByTarget do
  let(:owner_id) { create_account(role: 2) }
  let(:author_id) { create_account_with_profile(account_id: owner_id, username: "author") }
  let(:target_id) { create_account_with_profile(role: 1, username: "guest") }
  let(:entry_repo) { Karte::Repositories::EntryRepository.new }
  let(:event_repo) { Karte::Repositories::EventRepository.new }
  let(:entry) { entry_repo.create(author_account_id: owner_id, author_profile_id: author_id, target_profile_id: target_id, rating: 4) }

  it "returns summaries and a global aggregate independently of page size" do
    entry_repo.update(entry.id, status: "closed", closed_at: Sequel.function(:clock_timestamp))
    entry_repo.create(author_account_id: owner_id, author_profile_id: author_id, target_profile_id: target_id, rating: 2, status: "closed", closed_at: Time.now)
    result = described_class.new.call(viewer_account_id: owner_id, target_profile_id: target_id, limit: 1)
    expect(result[:entries].length).to eq(1)
    expect(result[:has_more]).to be(true)
    expect(result[:aggregate]).to eq(count: 2, avg_rating: 3.0, author_count: 1, rated_count: 2)
    expect(result[:entries].first).to include(events: [], status: "closed")
  end

  it "rejects guest readers" do
    expect { described_class.new.call(viewer_account_id: create_account(role: 1), target_profile_id: target_id) }.to raise_error(Karte::Domain::Errors::Access)
  end
end
