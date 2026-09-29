# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::DeleteEntry do
  let(:use_case) do
    described_class.new(
      entry_repo: entry_repo,
      authorize_cast_access: authorize_cast_access
    )
  end
  let(:entry_repo)            { double(:entry_repository) }
  let(:authorize_cast_access) { double(:authorize_cast_access) }

  let(:viewer_id) { "viewer-cast-1" }
  let(:entry_id)  { "entry-1" }

  let(:entry) do
    double(:entry, id: entry_id, author_account_id: viewer_id)
  end

  before do
    allow(authorize_cast_access).to receive(:call).with(viewer_account_id: viewer_id).and_return(true)
    allow(entry_repo).to receive(:find_by_id).with(entry_id).and_return(entry)
  end

  it "deletes the entry and returns nil" do
    expect(entry_repo).to receive(:delete).with(entry_id)
    result = use_case.call(viewer_account_id: viewer_id, entry_id: entry_id)
    expect(result).to be_nil
  end

  it "delegates the cast/billing check to AuthorizeCastAccess and rejects when it fails" do
    allow(authorize_cast_access).to receive(:call).with(viewer_account_id: viewer_id).and_return(false)
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
