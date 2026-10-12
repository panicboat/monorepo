# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::AddEvent do
  let(:owner_id) { create_account(role: 2) }
  let(:owner_profile) { create_account_with_profile(account_id: owner_id) }
  let(:target_id) { create_account_with_profile(role: 1) }
  let(:entry_repo) { Karte::Repositories::EntryRepository.new }
  let(:event_repo) { Karte::Repositories::EventRepository.new }
  let(:event) { {stage: "booking", outcome: "confirmed", tags: [], note: "", occurred_on: "2026-10-12"} }
  let(:entry) { Karte::UseCases::CreateEntry.new.call(viewer_account_id: owner_id, viewer_profile_id: owner_profile, target_profile_id: target_id, rating: 4, first_event: event) }

  it "adds a past event without changing the creation date" do
    result = described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id, event: event.merge(occurred_on: "2026-10-10"))
    expect(result.created_at).to eq(entry.created_at)
    expect(event_repo.list_by_entry(entry_id: entry.id).map(&:occurred_on)).to eq([Date.new(2026, 10, 10), Date.new(2026, 10, 12)])
  end

  it "rejects closed charts and guest accounts" do
    guest = create_account(role: 1)
    expect { described_class.new.call(viewer_account_id: guest, entry_id: entry.id, event: event) }.to raise_error(Karte::Domain::Errors::Access)
    Karte::UseCases::CloseEntry.new.call(viewer_account_id: owner_id, entry_id: entry.id)
    expect { described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id, event: event) }.to raise_error(Karte::Domain::Errors::Conflict)
    expect(event_repo.list_by_entry(entry_id: entry.id).length).to eq(1)
  end
end
