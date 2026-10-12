# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::CreateEntry do
  let(:owner_id) { create_account(role: 2) }
  let(:owner_profile) { create_account_with_profile(account_id: owner_id) }
  let(:target_id) { create_account_with_profile(role: 1) }
  let(:entry_repo) { Karte::Repositories::EntryRepository.new }
  let(:event_repo) { Karte::Repositories::EventRepository.new }
  let(:event) { {stage: "booking", outcome: "confirmed", tags: [], note: "", occurred_on: "2026-10-12"} }
  let(:entry) { Karte::UseCases::CreateEntry.new.call(viewer_account_id: owner_id, viewer_profile_id: owner_profile, target_profile_id: target_id, rating: 4, first_event: event) }

  it "creates an open unrated chart and its first event together" do
    result = described_class.new.call(viewer_account_id: owner_id, viewer_profile_id: owner_profile, target_profile_id: target_id, first_event: event)
    expect([result.rating, result.status, result.author_account_id, result.author_profile_id]).to eq([nil, "open", owner_id, owner_profile])
    expect(event_repo.list_by_entry(entry_id: result.id).map(&:outcome)).to eq(["confirmed"])
  end

  it "rejects a missing first event without leaving a parent" do
    expect { described_class.new.call(viewer_account_id: owner_id, viewer_profile_id: owner_profile, target_profile_id: target_id, first_event: nil) }.to raise_error(Karte::Domain::Errors::Validation)
    expect(entry_repo.list_by_author(author_account_id: owner_id)).to eq([])
  end

  it "rejects a one-star chart without an explanation" do
    expect { described_class.new.call(viewer_account_id: owner_id, viewer_profile_id: owner_profile, target_profile_id: target_id, rating: 1, first_event: event) }.to raise_error(Karte::Domain::Errors::Validation)
    expect(entry_repo.list_by_author(author_account_id: owner_id)).to eq([])
  end

  it "rejects a guest account" do
    guest_id = create_account(role: 1)
    profile_id = create_account_with_profile(account_id: guest_id)
    expect { described_class.new.call(viewer_account_id: guest_id, viewer_profile_id: profile_id, target_profile_id: target_id, first_event: event) }.to raise_error(Karte::Domain::Errors::Access)
  end

  it "rejects a cast as the target" do
    expect { described_class.new.call(viewer_account_id: owner_id, viewer_profile_id: owner_profile, target_profile_id: owner_profile, first_event: event) }.to raise_error(Karte::Domain::Errors::Validation)
  end

  it "rejects a missing target" do
    expect { described_class.new.call(viewer_account_id: owner_id, viewer_profile_id: owner_profile, target_profile_id: SecureRandom.uuid_v7, first_event: event) }.to raise_error(Karte::Domain::Errors::NotFound)
  end

  it "rejects invalid ratings and oversized legacy memos" do
    [0, 6, 2.5].each do |rating|
      expect { described_class.new.call(viewer_account_id: owner_id, viewer_profile_id: owner_profile, target_profile_id: target_id, rating: rating, first_event: event) }.to raise_error(Karte::Domain::Errors::Validation)
    end
    expect { described_class.new.call(viewer_account_id: owner_id, viewer_profile_id: owner_profile, target_profile_id: target_id, body: "x" * 501, first_event: event) }.to raise_error(Karte::Domain::Errors::Validation)
  end
end
