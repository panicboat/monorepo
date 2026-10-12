# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::CloseEntry do
  let(:owner_id) { create_account(role: 2) }
  let(:owner_profile) { create_account_with_profile(account_id: owner_id) }
  let(:target_id) { create_account_with_profile(role: 1) }
  let(:entry_repo) { Karte::Repositories::EntryRepository.new }
  let(:event_repo) { Karte::Repositories::EventRepository.new }
  let(:event) { {stage: "booking", outcome: "confirmed", tags: [], note: "", occurred_on: "2026-10-12"} }
  let(:entry) { Karte::UseCases::CreateEntry.new.call(viewer_account_id: owner_id, viewer_profile_id: owner_profile, target_profile_id: target_id, rating: 4, first_event: event) }

  it "closes a chart and keeps repeat completion timestamps unchanged" do
    closed = described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id)
    expect(closed.status).to eq("closed")
    expect(closed.closed_at).not_to be_nil
    repeated = described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id)
    expect([repeated.closed_at, repeated.updated_at]).to eq([closed.closed_at, closed.updated_at])
  end

  it "does not retroactively validate an already closed legacy chart" do
    legacy = entry_repo.create(author_account_id: owner_id, author_profile_id: owner_profile, target_profile_id: target_id, rating: 1, status: "closed", closed_at: Hanami.app["db.gateway"].connection.get(Sequel.function(:clock_timestamp)))
    result = described_class.new.call(viewer_account_id: owner_id, entry_id: legacy.id)
    expect(result.updated_at).to eq(legacy.updated_at)
  end
end
