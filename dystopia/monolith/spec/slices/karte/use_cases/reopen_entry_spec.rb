# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::ReopenEntry do
  let(:owner_id) { create_account(role: 2) }
  let(:owner_profile) { create_account_with_profile(account_id: owner_id) }
  let(:target_id) { create_account_with_profile(role: 1) }
  let(:entry_repo) { Karte::Repositories::EntryRepository.new }
  let(:event_repo) { Karte::Repositories::EventRepository.new }
  let(:event) { {stage: "booking", outcome: "confirmed", tags: [], note: "", occurred_on: "2026-10-12"} }
  let(:entry) { Karte::UseCases::CreateEntry.new.call(viewer_account_id: owner_id, viewer_profile_id: owner_profile, target_profile_id: target_id, rating: 4, first_event: event) }

  it "keeps events and rating while reopening and does not touch an open chart twice" do
    closed = Karte::UseCases::CloseEntry.new.call(viewer_account_id: owner_id, entry_id: entry.id)
    reopened = described_class.new.call(viewer_account_id: owner_id, entry_id: closed.id)
    expect([reopened.status, reopened.rating, reopened.closed_at]).to eq(["open", 4, nil])
    expect(event_repo.list_by_entry(entry_id: entry.id).length).to eq(1)
    expect(described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id).updated_at).to eq(reopened.updated_at)
  end

  it "reopens an empty legacy chart but validates its next completion" do
    legacy = entry_repo.create(author_account_id: owner_id, author_profile_id: owner_profile, target_profile_id: target_id, rating: 1, status: "closed", closed_at: Hanami.app["db.gateway"].connection.get(Sequel.function(:clock_timestamp)))
    result = described_class.new.call(viewer_account_id: owner_id, entry_id: legacy.id)
    expect(result.status).to eq("open")
    expect { Karte::UseCases::CloseEntry.new.call(viewer_account_id: owner_id, entry_id: legacy.id) }.to raise_error(Karte::Domain::Errors::Validation)
  end
end
