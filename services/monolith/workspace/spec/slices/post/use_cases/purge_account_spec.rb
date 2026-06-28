# frozen_string_literal: true

require "spec_helper"

RSpec.describe Post::UseCases::PurgeAccount do
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

  it "deletes likes, comments, then posts owned by the account" do
    expect(like_repo).to receive(:delete_by_account).with("cast-1").ordered
    expect(comment_repo).to receive(:delete_by_account).with("cast-1").ordered
    expect(post_repo).to receive(:delete_by_author).with("cast-1").ordered
    use_case.call(account_id: "cast-1")
  end

  it "returns nil" do
    allow(like_repo).to receive(:delete_by_account)
    allow(comment_repo).to receive(:delete_by_account)
    allow(post_repo).to receive(:delete_by_author)
    expect(use_case.call(account_id: "cast-1")).to be_nil
  end
end
