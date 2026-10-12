# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::UpdateEntry do
  let(:owner_id) { create_account(role: 2) }
  let(:owner_profile) { create_account_with_profile(account_id: owner_id) }
  let(:target_id) { create_account_with_profile(role: 1) }
  let(:entry_repo) { Karte::Repositories::EntryRepository.new }
  let(:event_repo) { Karte::Repositories::EventRepository.new }
  let(:event) { {stage: "booking", outcome: "confirmed", tags: [], note: "", occurred_on: "2026-10-12"} }
  let(:entry) { Karte::UseCases::CreateEntry.new.call(viewer_account_id: owner_id, viewer_profile_id: owner_profile, target_profile_id: target_id, rating: 4, first_event: event) }

  it "distinguishes an omitted rating from explicit clearing" do
    unchanged = described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id, attrs: {})
    expect([unchanged.rating, unchanged.updated_at]).to eq([4, entry.updated_at])
    cleared = described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id, attrs: {rating: nil})
    expect(cleared.rating).to be_nil
  end

  it "preserves the recording profile when the owner has another profile" do
    create_account_with_profile(account_id: owner_id)
    result = described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id, attrs: {rating: 5})
    expect([result.rating, result.author_profile_id]).to eq([5, owner_profile])
  end

  it "rejects other accounts and missing charts" do
    other_id = create_account(role: 2)
    expect { described_class.new.call(viewer_account_id: other_id, entry_id: entry.id, attrs: {rating: 3}) }.to raise_error(Karte::Domain::Errors::Access)
    expect { described_class.new.call(viewer_account_id: owner_id, entry_id: SecureRandom.uuid_v7, attrs: {}) }.to raise_error(Karte::Domain::Errors::NotFound)
  end

  it "rejects edits to closed charts" do
    Karte::UseCases::CloseEntry.new.call(viewer_account_id: owner_id, entry_id: entry.id)
    expect { described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id, attrs: {rating: nil}) }.to raise_error(Karte::Domain::Errors::Conflict)
  end

  it "validates the resulting explanation before changing a rating" do
    expect { described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id, attrs: {rating: 1}) }.to raise_error(Karte::Domain::Errors::Validation)
    expect(entry_repo.find_by_id(entry.id).rating).to eq(4)
    result = described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id, attrs: {rating: 1, body: "過去の説明"})
    expect([result.rating, result.body]).to eq([1, "過去の説明"])
    expect { described_class.new.call(viewer_account_id: owner_id, entry_id: entry.id, attrs: {body: ""}) }.to raise_error(Karte::Domain::Errors::Validation)
    expect(entry_repo.find_by_id(entry.id).body).to eq("過去の説明")
  end
end
