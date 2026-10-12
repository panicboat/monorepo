# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::ListMyEntries do
  let(:owner_id) { create_account(role: 2) }
  let(:author_id) { create_account_with_profile(account_id: owner_id, username: "author") }
  let(:target_id) { create_account_with_profile(role: 1, username: "guest") }
  let(:entry_repo) { Karte::Repositories::EntryRepository.new }
  let(:event_repo) { Karte::Repositories::EventRepository.new }
  let(:entry) { entry_repo.create(author_account_id: owner_id, author_profile_id: author_id, target_profile_id: target_id, rating: 4) }

  it "returns filtered account-wide charts with global status counts" do
    first = entry
    second_profile = create_account_with_profile(account_id: owner_id)
    entry_repo.create(author_account_id: owner_id, author_profile_id: second_profile, target_profile_id: target_id, status: "closed", closed_at: Time.now)
    result = described_class.new.call(viewer_account_id: owner_id, status: "open")
    expect(result[:entries].map { |item| item[:id] }).to eq([first.id])
    expect(result[:counts]).to eq(total: 2, open: 1, closed: 1)
  end

  it "rejects unknown status filters" do
    expect { described_class.new.call(viewer_account_id: owner_id, status: "unknown") }.to raise_error(Karte::Domain::Errors::Validation)
  end
end
