# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Social::Repositories::LikeRepository", type: :database do
  let(:repo) { Hanami.app.slices[:social]["repositories.like_repository"] }
  let(:post_repo) { Hanami.app.slices[:social]["repositories.post_repository"] }
  let(:cast_id) { SecureRandom.uuid }
  let(:guest_id) { SecureRandom.uuid }
  let(:post) { post_repo.create_post(cast_id: cast_id, content: "Test post") }

  describe "#like" do
    it "creates a like record" do
      repo.like(post_id: post.id, guest_id: guest_id)
      expect(repo.liked?(post_id: post.id, guest_id: guest_id)).to be true
    end

    it "is idempotent - does not create duplicate likes" do
      repo.like(post_id: post.id, guest_id: guest_id)
      repo.like(post_id: post.id, guest_id: guest_id)
      expect(repo.likes_count(post_id: post.id)).to eq(1)
    end
  end

  describe "#unlike" do
    it "removes the like record" do
      repo.like(post_id: post.id, guest_id: guest_id)
      repo.unlike(post_id: post.id, guest_id: guest_id)
      expect(repo.liked?(post_id: post.id, guest_id: guest_id)).to be false
    end

    it "does nothing when like does not exist" do
      expect { repo.unlike(post_id: post.id, guest_id: guest_id) }.not_to raise_error
    end
  end

  describe "#liked?" do
    it "returns true when guest has liked the post" do
      repo.like(post_id: post.id, guest_id: guest_id)
      expect(repo.liked?(post_id: post.id, guest_id: guest_id)).to be true
    end

    it "returns false when guest has not liked the post" do
      expect(repo.liked?(post_id: post.id, guest_id: guest_id)).to be false
    end
  end

  describe "#likes_count" do
    it "returns the number of likes for a post" do
      guest_ids = [SecureRandom.uuid, SecureRandom.uuid, SecureRandom.uuid]
      guest_ids.each { |gid| repo.like(post_id: post.id, guest_id: gid) }
      expect(repo.likes_count(post_id: post.id)).to eq(3)
    end

    it "returns 0 for posts with no likes" do
      expect(repo.likes_count(post_id: post.id)).to eq(0)
    end
  end

  describe "#likes_count_batch" do
    it "returns counts for multiple posts" do
      post2 = post_repo.create_post(cast_id: cast_id, content: "Another post")

      repo.like(post_id: post.id, guest_id: guest_id)
      repo.like(post_id: post.id, guest_id: SecureRandom.uuid)
      repo.like(post_id: post2.id, guest_id: guest_id)

      counts = repo.likes_count_batch(post_ids: [post.id, post2.id])
      expect(counts[post.id]).to eq(2)
      expect(counts[post2.id]).to eq(1)
    end

    it "returns empty hash for empty post_ids" do
      expect(repo.likes_count_batch(post_ids: [])).to eq({})
    end
  end

  describe "#liked_status_batch" do
    it "returns like status for multiple posts" do
      post2 = post_repo.create_post(cast_id: cast_id, content: "Another post")

      repo.like(post_id: post.id, guest_id: guest_id)

      status = repo.liked_status_batch(post_ids: [post.id, post2.id], guest_id: guest_id)
      expect(status[post.id]).to be true
      expect(status[post2.id]).to be false
    end

    it "returns empty hash for empty post_ids" do
      expect(repo.liked_status_batch(post_ids: [], guest_id: guest_id)).to eq({})
    end
  end
end
