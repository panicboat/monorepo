# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::UnhideEntry do
  let(:use_case) { described_class.new(entry_repo: entry_repo) }
  let(:entry_repo) { double(:entry_repository) }
  let(:target_id) { "target-1" }
  let(:entry_id) { "entry-1" }

  it "unhides when called by the target" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id)
      .and_return(double(:entry, target_account_id: target_id))
    expect(entry_repo).to receive(:update).with(entry_id, hidden: false)

    use_case.call(viewer_account_id: target_id, entry_id: entry_id)
  end

  it "raises NotFoundError when the entry does not exist" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: target_id, entry_id: entry_id)
    }.to raise_error(Review::UseCases::UnhideEntry::NotFoundError)
  end

  it "raises PermissionError when the viewer is not the target" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id)
      .and_return(double(:entry, target_account_id: "someone-else"))
    expect {
      use_case.call(viewer_account_id: target_id, entry_id: entry_id)
    }.to raise_error(Review::UseCases::UnhideEntry::PermissionError)
  end
end
