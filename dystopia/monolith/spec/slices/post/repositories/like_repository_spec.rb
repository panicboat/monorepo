# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::Repositories::LikeRepository", type: :database do
  let(:repo) { Hanami.app.slices[:post]["repositories.like_repository"] }
  let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:cast_id) { SecureRandom.uuid_v7 }
  let(:post) { post_repo.create_post(author_profile_id: cast_id, content: "Test post") }

  describe "#likes_count" do
    it "returns 0 when no likes" do
      expect(repo.likes_count(post_id: post.id)).to eq(0)
    end

    it "returns correct count" do
      3.times { repo.profile_like(post_id: post.id, profile_id: SecureRandom.uuid_v7) }
      expect(repo.likes_count(post_id: post.id)).to eq(3)
    end
  end

  describe "#likes_count_batch" do
    it "returns counts for multiple posts" do
      post2 = post_repo.create_post(author_profile_id: cast_id, content: "Post 2")
      2.times { repo.profile_like(post_id: post.id, profile_id: SecureRandom.uuid_v7) }
      3.times { repo.profile_like(post_id: post2.id, profile_id: SecureRandom.uuid_v7) }

      counts = repo.likes_count_batch(post_ids: [post.id, post2.id])
      expect(counts[post.id]).to eq(2)
      expect(counts[post2.id]).to eq(3)
    end

    it "returns empty hash for empty input" do
      expect(repo.likes_count_batch(post_ids: [])).to eq({})
    end
  end

  describe "profile-based likes (symmetric)" do
    let(:profile_id) { SecureRandom.uuid_v7 }
    let(:post2) { post_repo.create_post(author_profile_id: SecureRandom.uuid_v7, content: "sym post", visibility: "public") }

    it "creates and detects a like by profile" do
      repo.profile_like(post_id: post2.id, profile_id: profile_id)
      expect(repo.profile_liked?(post_id: post2.id, profile_id: profile_id)).to be true
    end

    it "does not duplicate" do
      repo.profile_like(post_id: post2.id, profile_id: profile_id)
      repo.profile_like(post_id: post2.id, profile_id: profile_id)
      expect(repo.likes_count(post_id: post2.id)).to eq(1)
    end

    it "unlikes" do
      repo.profile_like(post_id: post2.id, profile_id: profile_id)
      repo.profile_unlike(post_id: post2.id, profile_id: profile_id)
      expect(repo.profile_liked?(post_id: post2.id, profile_id: profile_id)).to be false
    end

    it "batch status" do
      repo.profile_like(post_id: post2.id, profile_id: profile_id)
      status = repo.profile_liked_status_batch(post_ids: [post2.id], profile_id: profile_id)
      expect(status[post2.id]).to be true
    end
  end

  describe "#delete_by_profile" do
    it "deletes all likes by the profile" do
      profile_id = SecureRandom.uuid_v7
      other_profile_id = SecureRandom.uuid_v7
      repo.profile_like(post_id: post.id, profile_id: profile_id)
      repo.profile_like(post_id: post.id, profile_id: other_profile_id)

      repo.delete_by_profile(profile_id)

      expect(repo.profile_liked?(post_id: post.id, profile_id: profile_id)).to be false
      expect(repo.profile_liked?(post_id: post.id, profile_id: other_profile_id)).to be true
    end
  end
end
