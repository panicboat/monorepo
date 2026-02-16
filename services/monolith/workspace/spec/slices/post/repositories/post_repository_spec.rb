# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::Repositories::PostRepository", type: :database do
  let(:repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:cast_id) { SecureRandom.uuid }

  describe "#create_post" do
    it "creates a post and returns it" do
      post = repo.create_post(cast_id: cast_id, content: "Hello world")
      expect(post.cast_id).to eq(cast_id)
      expect(post.content).to eq("Hello world")
      expect(post.id).not_to be_nil
    end
  end

  describe "#find_by_id" do
    it "returns nil when post does not exist" do
      expect(repo.find_by_id(SecureRandom.uuid)).to be_nil
    end

    it "returns post with media when exists" do
      post = repo.create_post(cast_id: cast_id, content: "Test")
      result = repo.find_by_id(post.id)
      expect(result).not_to be_nil
      expect(result.content).to eq("Test")
    end
  end

  describe "#find_by_id_and_cast" do
    it "returns nil when post does not belong to cast" do
      post = repo.create_post(cast_id: cast_id, content: "Test")
      expect(repo.find_by_id_and_cast(id: post.id, cast_id: SecureRandom.uuid)).to be_nil
    end

    it "returns post when it belongs to cast" do
      post = repo.create_post(cast_id: cast_id, content: "Test")
      result = repo.find_by_id_and_cast(id: post.id, cast_id: cast_id)
      expect(result).not_to be_nil
      expect(result.id).to eq(post.id)
    end
  end

  describe "#update_post" do
    it "updates post content" do
      post = repo.create_post(cast_id: cast_id, content: "Original")
      result = repo.update_post(post.id, content: "Updated")
      expect(result.content).to eq("Updated")
    end
  end

  describe "#delete_post" do
    it "deletes the post" do
      post = repo.create_post(cast_id: cast_id, content: "To delete")
      repo.delete_post(post.id)
      expect(repo.find_by_id(post.id)).to be_nil
    end
  end

  describe "#save_media" do
    it "saves media for a post" do
      post = repo.create_post(cast_id: cast_id, content: "With media")
      media_data = [
        { media_type: "image", url: "http://example.com/img.jpg", thumbnail_url: "" },
        { media_type: "video", url: "http://example.com/vid.mp4", thumbnail_url: "http://example.com/thumb.jpg" }
      ]
      repo.save_media(post_id: post.id, media_data: media_data)

      result = repo.find_by_id(post.id)
      expect(result.post_media.size).to eq(2)
      expect(result.post_media.map(&:media_type)).to contain_exactly("image", "video")
    end

    it "replaces existing media" do
      post = repo.create_post(cast_id: cast_id, content: "With media")
      repo.save_media(post_id: post.id, media_data: [{ media_type: "image", url: "http://old.jpg", thumbnail_url: "" }])
      repo.save_media(post_id: post.id, media_data: [{ media_type: "video", url: "http://new.mp4", thumbnail_url: "" }])

      result = repo.find_by_id(post.id)
      expect(result.post_media.size).to eq(1)
      expect(result.post_media.first.media_type).to eq("video")
    end
  end

  describe "#list_by_cast_id" do
    let(:db) { Hanami.app.slices[:post]["db.rom"].gateways[:default].connection }

    before do
      base_time = Time.parse("2026-01-01T10:00:00Z")
      3.times do |i|
        db[:post__posts].insert(
          id: SecureRandom.uuid, cast_id: cast_id, content: "Post #{i}",
          created_at: base_time + (i * 60), updated_at: base_time + (i * 60)
        )
      end
    end

    it "returns posts for the cast ordered by created_at desc" do
      posts = repo.list_by_cast_id(cast_id: cast_id, limit: 10)
      expect(posts.size).to eq(3)
      expect(posts.first.content).to eq("Post 2")
    end

    it "limits results" do
      posts = repo.list_by_cast_id(cast_id: cast_id, limit: 2)
      # limit + 1 for has_more detection
      expect(posts.size).to eq(3)
    end

    it "does not return posts from other casts" do
      other_cast_id = SecureRandom.uuid
      repo.create_post(cast_id: other_cast_id, content: "Other cast post")

      posts = repo.list_by_cast_id(cast_id: cast_id, limit: 10)
      expect(posts.map(&:cast_id).uniq).to eq([cast_id])
    end
  end

  describe "#list_all_visible" do
    let(:db) { Hanami.app.slices[:post]["db.rom"].gateways[:default].connection }
    let(:cast1_id) { SecureRandom.uuid }
    let(:cast2_id) { SecureRandom.uuid }

    before do
      db[:post__posts].insert(id: SecureRandom.uuid, cast_id: cast1_id, content: "Public post", visibility: "public", created_at: Time.now, updated_at: Time.now)
      db[:post__posts].insert(id: SecureRandom.uuid, cast_id: cast2_id, content: "Private post", visibility: "private", created_at: Time.now, updated_at: Time.now)
    end

    it "returns only public posts" do
      posts = repo.list_all_visible(limit: 10)
      expect(posts.map(&:visibility).uniq).to eq(["public"])
    end

    it "excludes specified cast_ids" do
      posts = repo.list_all_visible(limit: 10, exclude_cast_ids: [cast1_id])
      expect(posts.map(&:cast_id)).not_to include(cast1_id)
    end
  end

  describe "#save_hashtags" do
    it "saves hashtags for a post" do
      post = repo.create_post(cast_id: cast_id, content: "Post with hashtags")
      repo.save_hashtags(post_id: post.id, hashtags: ["ruby", "rails"])

      result = repo.find_by_id(post.id)
      expect(result.hashtags.map(&:tag)).to contain_exactly("ruby", "rails")
    end

    it "replaces existing hashtags" do
      post = repo.create_post(cast_id: cast_id, content: "Post")
      repo.save_hashtags(post_id: post.id, hashtags: ["old"])
      repo.save_hashtags(post_id: post.id, hashtags: ["new"])

      result = repo.find_by_id(post.id)
      expect(result.hashtags.map(&:tag)).to eq(["new"])
    end
  end
end
