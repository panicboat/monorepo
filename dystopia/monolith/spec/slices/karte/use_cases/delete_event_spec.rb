# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::DeleteEvent do
  let(:owner_id) { create_account(role: 2) }
  let(:owner_profile) { create_account_with_profile(account_id: owner_id) }
  let(:target_id) { create_account_with_profile(role: 1) }
  let(:entry_repo) { Karte::Repositories::EntryRepository.new }
  let(:event_repo) { Karte::Repositories::EventRepository.new }
  let(:event) { {stage: "booking", outcome: "confirmed", tags: [], note: "", occurred_on: "2026-10-12"} }
  let(:entry) { Karte::UseCases::CreateEntry.new.call(viewer_account_id: owner_id, viewer_profile_id: owner_profile, target_profile_id: target_id, rating: 4, first_event: event) }

  it "rejects deleting the last event" do
    record = event_repo.list_by_entry(entry_id: entry.id).first
    expect { described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id, event_id: record.id) }.to raise_error(Karte::Domain::Errors::Validation)
    expect(event_repo.list_by_entry(entry_id: entry.id).length).to eq(1)
  end

  it "removes an event when another event remains" do
    Karte::UseCases::AddEvent.new.call(viewer_account_id: owner_id, entry_id: entry.id, event: event.merge(note: "別の出来事"))
    record = event_repo.list_by_entry(entry_id: entry.id).first
    described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id, event_id: record.id)
    expect(event_repo.list_by_entry(entry_id: entry.id).map(&:note)).to eq(["別の出来事"])
  end

  it "rolls back deletion of the only explanation for one star" do
    Karte::UseCases::AddEvent.new.call(viewer_account_id: owner_id, entry_id: entry.id, event: event.merge(note: "説明"))
    Karte::UseCases::UpdateEntry.new.call(viewer_account_id: owner_id, entry_id: entry.id, attrs: {rating: 1})
    record = event_repo.list_by_entry(entry_id: entry.id).find { |item| item.note == "説明" }
    expect { described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id, event_id: record.id) }.to raise_error(Karte::Domain::Errors::Validation)
    expect(event_repo.list_by_entry(entry_id: entry.id).length).to eq(2)
  end
end
