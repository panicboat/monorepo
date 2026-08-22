# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::UpdateEntry do
  let(:use_case) do
    described_class.new(
      entry_repo: entry_repo,
      access_repo: access_repo
    )
  end
  let(:entry_repo)  { double(:entry_repository) }
  let(:access_repo) { double(:access_repository) }

  let(:viewer_id) { "viewer-cast-1" }
  let(:entry_id)  { "entry-1" }

  let(:entry) do
    double(:entry, id: entry_id, author_account_id: viewer_id)
  end

  before do
    allow(access_repo).to receive(:find_by_account).with(viewer_id)
      .and_return(double(:access, account_id: viewer_id))
    allow(entry_repo).to receive(:find_by_id).with(entry_id).and_return(entry)
  end

  it "updates only the non-nil attrs" do
    expect(entry_repo).to receive(:update).with(entry_id, { rating: 4 })
    use_case.call(viewer_account_id: viewer_id, entry_id: entry_id, rating: 4)
  end

  it "updates both rating and body when both provided" do
    expect(entry_repo).to receive(:update).with(entry_id, { rating: 5, body: "great" })
    use_case.call(viewer_account_id: viewer_id, entry_id: entry_id, rating: 5, body: "great")
  end

  it "rejects when viewer has no karte access" do
    allow(access_repo).to receive(:find_by_account).with(viewer_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: viewer_id, entry_id: entry_id, rating: 3)
    }.to raise_error(Karte::UseCases::UpdateEntry::AccessError)
  end

  it "rejects when entry not found" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: viewer_id, entry_id: entry_id, rating: 3)
    }.to raise_error(Karte::UseCases::UpdateEntry::UpdateError, "Entry not found")
  end

  it "rejects when viewer is not the author" do
    other_entry = double(:entry, id: entry_id, author_account_id: "someone-else")
    allow(entry_repo).to receive(:find_by_id).with(entry_id).and_return(other_entry)
    expect {
      use_case.call(viewer_account_id: viewer_id, entry_id: entry_id, rating: 3)
    }.to raise_error(Karte::UseCases::UpdateEntry::UpdateError, "Not the author")
  end

  it "rejects invalid rating" do
    expect {
      use_case.call(viewer_account_id: viewer_id, entry_id: entry_id, rating: 0)
    }.to raise_error(Karte::UseCases::UpdateEntry::UpdateError, "Rating must be 1..5")
    expect {
      use_case.call(viewer_account_id: viewer_id, entry_id: entry_id, rating: 6)
    }.to raise_error(Karte::UseCases::UpdateEntry::UpdateError, "Rating must be 1..5")
  end

  it "rejects body over 500 chars" do
    expect {
      use_case.call(viewer_account_id: viewer_id, entry_id: entry_id, body: "x" * 501)
    }.to raise_error(Karte::UseCases::UpdateEntry::UpdateError, "Body too long")
  end
end
