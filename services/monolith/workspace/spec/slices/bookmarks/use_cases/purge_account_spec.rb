# frozen_string_literal: true

require "spec_helper"

RSpec.describe Bookmarks::UseCases::PurgeAccount do
  let(:use_case) { described_class.new(bookmark_repo: bookmark_repo) }
  let(:bookmark_repo) { double(:bookmark_repository) }

  it "deletes all bookmarks owned by the account" do
    expect(bookmark_repo).to receive(:delete_by_account).with("cast-1")
    use_case.call(account_id: "cast-1")
  end
end
