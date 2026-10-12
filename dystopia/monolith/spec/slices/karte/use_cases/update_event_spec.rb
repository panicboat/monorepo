# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::UpdateEvent do
  let(:owner_id) { create_account(role: 2) }
  let(:owner_profile) { create_account_with_profile(account_id: owner_id) }
  let(:target_id) { create_account_with_profile(role: 1) }
  let(:entry_repo) { Karte::Repositories::EntryRepository.new }
  let(:event_repo) { Karte::Repositories::EventRepository.new }
  let(:event) { {stage: "booking", outcome: "confirmed", tags: [], note: "", occurred_on: "2026-10-12"} }
  let(:entry) { Karte::UseCases::CreateEntry.new.call(viewer_account_id: owner_id, viewer_profile_id: owner_profile, target_profile_id: target_id, rating: 4, first_event: event) }

  it "updates the scoped event with validated stage choices" do
    record = event_repo.list_by_entry(entry_id: entry.id).first
    described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id, event_id: record.id, event: {stage: "service", outcome: "completed", tags: [], note: "対応終了", occurred_on: "2026-10-12"})
    expect(event_repo.list_by_entry(entry_id: entry.id).first.to_h).to include(stage: "service", outcome: "completed", note: "対応終了")
  end

  it "rolls back an edit that removes the explanation for one star" do
    record = event_repo.list_by_entry(entry_id: entry.id).first
    described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id, event_id: record.id, event: event.merge(note: "支払いの確認"))
    Karte::UseCases::UpdateEntry.new.call(viewer_account_id: owner_id, entry_id: entry.id, attrs: {rating: 1})
    expect { described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id, event_id: record.id, event: event) }.to raise_error(Karte::Domain::Errors::Validation)
    expect(event_repo.list_by_entry(entry_id: entry.id).first.note).to eq("支払いの確認")
  end

  it "does not update an event belonging to another chart" do
    expect { described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id, event_id: SecureRandom.uuid_v7, event: event) }.to raise_error(Karte::Domain::Errors::NotFound)
  end
end
