# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::ReportEntry do
  let(:use_case) do
    described_class.new(
      entry_repo: entry_repo,
      authorize_cast_access: authorize_cast_access,
      report_repo: report_repo
    )
  end
  let(:entry_repo)            { double(:entry_repository) }
  let(:authorize_cast_access) { double(:authorize_cast_access) }
  let(:report_repo)           { double(:report_repository) }

  let(:viewer_id) { "viewer-cast-1" }
  let(:entry_id)  { "entry-1" }
  let(:author_id) { "author-cast-2" }

  let(:entry) do
    double(:entry, id: entry_id, author_account_id: author_id)
  end

  before do
    allow(authorize_cast_access).to receive(:call).with(viewer_account_id: viewer_id).and_return(true)
    allow(entry_repo).to receive(:find_by_id).with(entry_id).and_return(entry)
  end

  it "creates a report and increments reported_count when new" do
    allow(report_repo).to receive(:create)
      .with(entry_id: entry_id, reporter_account_id: viewer_id, reason: "spam")
      .and_return(true)
    expect(entry_repo).to receive(:increment_reported_count).with(entry_id)

    result = use_case.call(viewer_account_id: viewer_id, entry_id: entry_id, reason: "spam")
    expect(result).to be_nil
  end

  it "does not increment reported_count when report is a duplicate" do
    allow(report_repo).to receive(:create)
      .with(entry_id: entry_id, reporter_account_id: viewer_id, reason: "spam")
      .and_return(false)
    expect(entry_repo).not_to receive(:increment_reported_count)

    use_case.call(viewer_account_id: viewer_id, entry_id: entry_id, reason: "spam")
  end

  it "delegates the cast/billing check to AuthorizeCastAccess and rejects when it fails" do
    allow(authorize_cast_access).to receive(:call).with(viewer_account_id: viewer_id).and_return(false)
    expect {
      use_case.call(viewer_account_id: viewer_id, entry_id: entry_id, reason: "spam")
    }.to raise_error(Karte::UseCases::ReportEntry::AccessError)
  end

  it "rejects when entry not found" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: viewer_id, entry_id: entry_id, reason: "spam")
    }.to raise_error(Karte::UseCases::ReportEntry::ReportError, "Entry not found")
  end

  it "rejects when viewer tries to report their own entry" do
    own_entry = double(:entry, id: entry_id, author_account_id: viewer_id)
    allow(entry_repo).to receive(:find_by_id).with(entry_id).and_return(own_entry)
    expect {
      use_case.call(viewer_account_id: viewer_id, entry_id: entry_id, reason: "spam")
    }.to raise_error(Karte::UseCases::ReportEntry::ReportError, "Cannot report own entry")
  end
end
