# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::Repositories::PostRepository", type: :database do
  let(:repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:cast_id) { SecureRandom.uuid_v7 }

  describe "#create_post" do
    it "creates a post and returns it" do
      post = repo.create_post(author_id: cast_id, content: "Hello world")
      expect(post.author_id).to eq(cast_id)
      expect(post.content).to eq("Hello world")
      expect(post.id).not_to be_nil
    end
  end

  describe "#find_by_id" do
    it "returns nil when post does not exist" do
      expect(repo.find_by_id(SecureRandom.uuid_v7)).to be_nil
    end

    it "returns post with media when exists" do
      post = repo.create_post(author_id: cast_id, content: "Test")
      result = repo.find_by_id(post.id)
      expect(result).not_to be_nil
      expect(result.content).to eq("Test")
    end
  end

  describe "#update_post" do
    it "updates post content" do
      post = repo.create_post(author_id: cast_id, content: "Original")
      result = repo.update_post(post.id, content: "Updated")
      expect(result.content).to eq("Updated")
    end
  end

  describe "#delete_post" do
    it "deletes the post" do
      post = repo.create_post(author_id: cast_id, content: "To delete")
      repo.delete_post(post.id)
      expect(repo.find_by_id(post.id)).to be_nil
    end
  end

  describe "#save_media" do
    let(:media_repo) { Hanami.app.slices[:media]["repositories.media_repository"] }

    def create_media_file(media_type: "image")
      media_id = SecureRandom.uuid_v7
      media_repo.create(
        id: media_id,
        media_type: media_type,
        url: "https://example.com/#{media_id}.jpg",
        media_key: "uploads/#{media_id}.jpg"
      )
      media_id
    end

    it "saves media with media_id for a post" do
      post = repo.create_post(author_id: cast_id, content: "With media")
      media_id = create_media_file(media_type: "image")
      media_data = [
        { media_id: media_id, media_type: "image" }
      ]
      repo.save_media(post_id: post.id, media_data: media_data)

      result = repo.find_by_id(post.id)
      expect(result.post_media.size).to eq(1)
      expect(result.post_media.first.media_id).to eq(media_id)
      expect(result.post_media.first.media_type).to eq("image")
    end

    it "saves multiple media with media_ids preserving position" do
      post = repo.create_post(author_id: cast_id, content: "With media")
      media_id1 = create_media_file(media_type: "image")
      media_id2 = create_media_file(media_type: "video")
      media_data = [
        { media_id: media_id1, media_type: "image" },
        { media_id: media_id2, media_type: "video" }
      ]
      repo.save_media(post_id: post.id, media_data: media_data)

      result = repo.find_by_id(post.id)
      expect(result.post_media.size).to eq(2)
      sorted_media = result.post_media.sort_by(&:position)
      expect(sorted_media[0].media_id).to eq(media_id1)
      expect(sorted_media[0].position).to eq(0)
      expect(sorted_media[1].media_id).to eq(media_id2)
      expect(sorted_media[1].position).to eq(1)
    end

    it "replaces existing media" do
      post = repo.create_post(author_id: cast_id, content: "With media")
      old_media_id = create_media_file(media_type: "image")
      new_media_id = create_media_file(media_type: "video")

      repo.save_media(post_id: post.id, media_data: [{ media_id: old_media_id, media_type: "image" }])
      repo.save_media(post_id: post.id, media_data: [{ media_id: new_media_id, media_type: "video" }])

      result = repo.find_by_id(post.id)
      expect(result.post_media.size).to eq(1)
      expect(result.post_media.first.media_id).to eq(new_media_id)
      expect(result.post_media.first.media_type).to eq("video")
    end
  end

  describe "#save_hashtags" do
    it "saves hashtags for a post" do
      post = repo.create_post(author_id: cast_id, content: "Post with hashtags")
      repo.save_hashtags(post_id: post.id, hashtags: ["ruby", "rails"])

      result = repo.find_by_id(post.id)
      expect(result.hashtags.map(&:tag)).to contain_exactly("ruby", "rails")
    end

    it "replaces existing hashtags" do
      post = repo.create_post(author_id: cast_id, content: "Post")
      repo.save_hashtags(post_id: post.id, hashtags: ["old"])
      repo.save_hashtags(post_id: post.id, hashtags: ["new"])

      result = repo.find_by_id(post.id)
      expect(result.hashtags.map(&:tag)).to eq(["new"])
    end
  end

  describe "author-based queries (symmetric)" do
    let(:author_id) { SecureRandom.uuid_v7 }

    it "creates a post with author_id and finds it" do
      created = repo.create_post(author_id: author_id, content: "hello", visibility: "public")
      found = repo.find_by_id_and_author(id: created.id, author_id: author_id)
      expect(found).not_to be_nil
      expect(found.content).to eq("hello")
    end

    it "lists public posts by author_id" do
      repo.create_post(author_id: author_id, content: "p1", visibility: "public")
      repo.create_post(author_id: author_id, content: "p2", visibility: "private")
      result = repo.list_posts(author_id: author_id)
      expect(result.map(&:content)).to include("p1")
      expect(result.map(&:content)).not_to include("p2")
    end
  end

  describe "#delete_by_author" do
    it "deletes all posts by the author" do
      author_id = SecureRandom.uuid_v7
      other_author_id = SecureRandom.uuid_v7
      mine = repo.create_post(author_id: author_id, content: "mine")
      other = repo.create_post(author_id: other_author_id, content: "not mine")

      repo.delete_by_author(author_id)

      expect(repo.find_by_id(mine.id)).to be_nil
      expect(repo.find_by_id(other.id)).not_to be_nil
    end
  end
end
