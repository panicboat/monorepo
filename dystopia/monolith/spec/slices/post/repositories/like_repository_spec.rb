# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::Repositories::LikeRepository", type: :database do
  let(:repo) { Hanami.app.slices[:post]["repositories.like_repository"] }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:cast_id) { SecureRandom.uuid_v7 }
  let(:post) { post_repo.create_post(author_id: cast_id, content: "Test post") }

  describe "#likes_count" do
    it "returns 0 when no likes" do
      expect(repo.likes_count(post_id: post.id)).to eq(0)
    end

    it "returns correct count" do
      3.times { repo.account_like(post_id: post.id, account_id: SecureRandom.uuid_v7) }
      expect(repo.likes_count(post_id: post.id)).to eq(3)
    end
  end

  describe "#likes_count_batch" do
    it "returns counts for multiple posts" do
      post2 = post_repo.create_post(author_id: cast_id, content: "Post 2")
      2.times { repo.account_like(post_id: post.id, account_id: SecureRandom.uuid_v7) }
      3.times { repo.account_like(post_id: post2.id, account_id: SecureRandom.uuid_v7) }

      counts = repo.likes_count_batch(post_ids: [post.id, post2.id])
      expect(counts[post.id]).to eq(2)
      expect(counts[post2.id]).to eq(3)
    end

    it "returns empty hash for empty input" do
      expect(repo.likes_count_batch(post_ids: [])).to eq({})
    end
  end

  describe "account-based likes (symmetric)" do
    let(:account_id) { SecureRandom.uuid_v7 }
    let(:post2) { post_repo.create_post(author_id: SecureRandom.uuid_v7, content: "sym post", visibility: "public") }

    it "creates and detects a like by account" do
      repo.account_like(post_id: post2.id, account_id: account_id)
      expect(repo.account_liked?(post_id: post2.id, account_id: account_id)).to be true
    end

    it "does not duplicate" do
      repo.account_like(post_id: post2.id, account_id: account_id)
      repo.account_like(post_id: post2.id, account_id: account_id)
      expect(repo.likes_count(post_id: post2.id)).to eq(1)
    end

    it "unlikes" do
      repo.account_like(post_id: post2.id, account_id: account_id)
      repo.account_unlike(post_id: post2.id, account_id: account_id)
      expect(repo.account_liked?(post_id: post2.id, account_id: account_id)).to be false
    end

    it "batch status" do
      repo.account_like(post_id: post2.id, account_id: account_id)
      status = repo.account_liked_status_batch(post_ids: [post2.id], account_id: account_id)
      expect(status[post2.id]).to be true
    end
  end

  describe "#delete_by_account" do
    it "deletes all likes by the account" do
      account_id = SecureRandom.uuid_v7
      other_account_id = SecureRandom.uuid_v7
      repo.account_like(post_id: post.id, account_id: account_id)
      repo.account_like(post_id: post.id, account_id: other_account_id)

      repo.delete_by_account(account_id)

      expect(repo.account_liked?(post_id: post.id, account_id: account_id)).to be false
      expect(repo.account_liked?(post_id: post.id, account_id: other_account_id)).to be true
    end
  end
end
