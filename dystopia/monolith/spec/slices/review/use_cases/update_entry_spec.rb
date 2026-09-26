# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::UpdateEntry do
  let(:use_case) { described_class.new(entry_repo: entry_repo) }
  let(:entry_repo) { double(:entry_repository) }
  let(:author_id) { "author-1" }
  let(:entry_id) { "entry-1" }

  it "updates rating/body when called by the author" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id)
      .and_return(double(:entry, author_account_id: author_id))
    expect(entry_repo).to receive(:update).with(entry_id, rating: 4.5, body: "updated")

    use_case.call(viewer_account_id: author_id, entry_id: entry_id, rating: 4.5, body: "updated")
  end

  it "raises NotFoundError when the entry does not exist" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: author_id, entry_id: entry_id, rating: 4.5)
    }.to raise_error(Review::UseCases::UpdateEntry::NotFoundError)
  end

  it "raises PermissionError when the viewer is not the author" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id)
      .and_return(double(:entry, author_account_id: "someone-else"))
    expect {
      use_case.call(viewer_account_id: author_id, entry_id: entry_id, rating: 4.5)
    }.to raise_error(Review::UseCases::UpdateEntry::PermissionError)
  end

  it "raises UpdateError for an invalid rating" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id)
      .and_return(double(:entry, author_account_id: author_id))
    expect {
      use_case.call(viewer_account_id: author_id, entry_id: entry_id, rating: 3.3)
    }.to raise_error(Review::UseCases::UpdateEntry::UpdateError)
  end
end
