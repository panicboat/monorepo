# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::GetEntry do
  let(:owner_id) { create_account(role: 2) }
  let(:author_id) { create_account_with_profile(account_id: owner_id, username: "author") }
  let(:target_id) { create_account_with_profile(role: 1, username: "guest") }
  let(:entry_repo) { Karte::Repositories::EntryRepository.new }
  let(:event_repo) { Karte::Repositories::EventRepository.new }
  let(:entry) { entry_repo.create(author_account_id: owner_id, author_profile_id: author_id, target_profile_id: target_id, rating: 4) }

  it "returns full events to another cast without revealing the account owner" do
    event_repo.create(entry_id: entry.id, input: {stage: "booking", outcome: "confirmed", tags: [], note: "補足", occurred_on: Date.new(2026, 10, 10)})
    viewer = create_account(role: 2)
    result = described_class.new.call(viewer_account_id: viewer, entry_id: entry.id)
    expect(result).to include(is_mine: false, status: "open", event_count: 1)
    expect(result[:events].first).to include(note: "補足", occurred_on: Date.new(2026, 10, 10))
    expect(result).not_to have_key(:author_account_id)
  end

  it "rejects guest readers and missing charts" do
    viewer = create_account(role: 1)
    expect { described_class.new.call(viewer_account_id: viewer, entry_id: entry.id) }.to raise_error(Karte::Domain::Errors::Access)
    expect { described_class.new.call(viewer_account_id: owner_id, entry_id: SecureRandom.uuid_v7) }.to raise_error(Karte::Domain::Errors::NotFound)
  end
end
