# frozen_string_literal: true

require "spec_helper"

RSpec.describe Post::UseCases::PurgeProfile do
  let(:use_case) do
    described_class.new(
      post_repo: post_repo,
      like_repo: like_repo,
      comment_repo: comment_repo
    )
  end
  let(:post_repo) { double(:post_repository) }
  let(:like_repo) { double(:like_repository) }
  let(:comment_repo) { double(:comment_repository) }

  it "deletes the profile's likes, the mentions of it, its comments, then its posts" do
    expect(like_repo).to receive(:delete_by_profile).with("cast-1").ordered
    expect(comment_repo).to receive(:delete_mentions_of).with("cast-1").ordered
    expect(post_repo).to receive(:delete_mentions_of).with("cast-1").ordered
    expect(comment_repo).to receive(:delete_by_profile).with("cast-1").ordered
    expect(post_repo).to receive(:delete_by_author).with("cast-1").ordered
    use_case.call(profile_id: "cast-1")
  end

  it "returns nil" do
    allow(like_repo).to receive(:delete_by_profile)
    allow(comment_repo).to receive(:delete_mentions_of)
    allow(post_repo).to receive(:delete_mentions_of)
    allow(comment_repo).to receive(:delete_by_profile)
    allow(post_repo).to receive(:delete_by_author)
    expect(use_case.call(profile_id: "cast-1")).to be_nil
  end
end
