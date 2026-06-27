# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::DeleteEntry do
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

  it "deletes the entry and returns nil" do
    expect(entry_repo).to receive(:delete).with(entry_id)
    result = use_case.call(viewer_account_id: viewer_id, entry_id: entry_id)
    expect(result).to be_nil
  end

  it "rejects when viewer has no karte access" do
    allow(access_repo).to receive(:find_by_account).with(viewer_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: viewer_id, entry_id: entry_id)
    }.to raise_error(Karte::UseCases::DeleteEntry::AccessError)
  end

  it "rejects when entry not found" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: viewer_id, entry_id: entry_id)
    }.to raise_error(Karte::UseCases::DeleteEntry::DeleteError, "Entry not found")
  end

  it "rejects when viewer is not the author" do
    other_entry = double(:entry, id: entry_id, author_account_id: "someone-else")
    allow(entry_repo).to receive(:find_by_id).with(entry_id).and_return(other_entry)
    expect {
      use_case.call(viewer_account_id: viewer_id, entry_id: entry_id)
    }.to raise_error(Karte::UseCases::DeleteEntry::DeleteError, "Not the author")
  end
end
