# frozen_string_literal: true

require "spec_helper"

RSpec.describe Bookmarks::UseCases::PurgeProfile do
  let(:use_case) { described_class.new(bookmark_repo: bookmark_repo) }
  let(:bookmark_repo) { double(:bookmark_repository) }

  it "deletes all bookmarks owned by the profile" do
    expect(bookmark_repo).to receive(:delete_by_profile).with("cast-1")
    use_case.call(profile_id: "cast-1")
  end
end
