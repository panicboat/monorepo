# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::Repositories::LikeRepository", type: :database do
  let(:repo) { Hanami.app.slices[:post]["repositories.like_repository"] }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:cast_id) { SecureRandom.uuid }
  let(:guest_id) { SecureRandom.uuid }
  let(:post) { post_repo.create_post(cast_id: cast_id, content: "Test post") }

  describe "#like" do
    it "creates a like" do
      repo.like(post_id: post.id, guest_id: guest_id)
      expect(repo.liked?(post_id: post.id, guest_id: guest_id)).to be true
    end

    it "does not create duplicate likes" do
      repo.like(post_id: post.id, guest_id: guest_id)
      repo.like(post_id: post.id, guest_id: guest_id)
      expect(repo.likes_count(post_id: post.id)).to eq(1)
    end
  end

  describe "#unlike" do
    it "removes a like" do
      repo.like(post_id: post.id, guest_id: guest_id)
      repo.unlike(post_id: post.id, guest_id: guest_id)
      expect(repo.liked?(post_id: post.id, guest_id: guest_id)).to be false
    end
  end

  describe "#liked?" do
    it "returns false when not liked" do
      expect(repo.liked?(post_id: post.id, guest_id: guest_id)).to be false
    end

    it "returns true when liked" do
      repo.like(post_id: post.id, guest_id: guest_id)
      expect(repo.liked?(post_id: post.id, guest_id: guest_id)).to be true
    end
  end

  describe "#likes_count" do
    it "returns 0 when no likes" do
      expect(repo.likes_count(post_id: post.id)).to eq(0)
    end

    it "returns correct count" do
      3.times { |i| repo.like(post_id: post.id, guest_id: SecureRandom.uuid) }
      expect(repo.likes_count(post_id: post.id)).to eq(3)
    end
  end

  describe "#likes_count_batch" do
    it "returns counts for multiple posts" do
      post2 = post_repo.create_post(cast_id: cast_id, content: "Post 2")
      2.times { repo.like(post_id: post.id, guest_id: SecureRandom.uuid) }
      3.times { repo.like(post_id: post2.id, guest_id: SecureRandom.uuid) }

      counts = repo.likes_count_batch(post_ids: [post.id, post2.id])
      expect(counts[post.id]).to eq(2)
      expect(counts[post2.id]).to eq(3)
    end

    it "returns empty hash for empty input" do
      expect(repo.likes_count_batch(post_ids: [])).to eq({})
    end
  end

  describe "#liked_status_batch" do
    it "returns liked status for multiple posts" do
      post2 = post_repo.create_post(cast_id: cast_id, content: "Post 2")
      repo.like(post_id: post.id, guest_id: guest_id)

      status = repo.liked_status_batch(post_ids: [post.id, post2.id], guest_id: guest_id)
      expect(status[post.id]).to be true
      expect(status[post2.id]).to be false
    end

    it "returns empty hash for empty input" do
      expect(repo.liked_status_batch(post_ids: [], guest_id: guest_id)).to eq({})
    end
  end
end
