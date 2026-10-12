# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::DeleteEntry do
  let(:owner_id) { create_account(role: 2) }
  let(:owner_profile) { create_account_with_profile(account_id: owner_id) }
  let(:target_id) { create_account_with_profile(role: 1) }
  let(:entry_repo) { Karte::Repositories::EntryRepository.new }
  let(:event_repo) { Karte::Repositories::EventRepository.new }
  let(:event) { {stage: "booking", outcome: "confirmed", tags: [], note: "", occurred_on: "2026-10-12"} }
  let(:entry) { Karte::UseCases::CreateEntry.new.call(viewer_account_id: owner_id, viewer_profile_id: owner_profile, target_profile_id: target_id, rating: 4, first_event: event) }

  it "allows the owner to delete a closed chart and its events" do
    Karte::UseCases::CloseEntry.new.call(viewer_account_id: owner_id, entry_id: entry.id)
    described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id)
    expect(entry_repo.find_by_id(entry.id)).to be_nil
    expect(event_repo.list_by_entry(entry_id: entry.id)).to eq([])
  end

  it "rejects other owners and guests" do
    [create_account(role: 2), create_account(role: 1)].each do |viewer|
      expect { described_class.new.call(viewer_account_id: viewer, entry_id: entry.id) }.to raise_error(Karte::Domain::Errors::Access)
    end
    expect(entry_repo.find_by_id(entry.id)).not_to be_nil
  end
end
