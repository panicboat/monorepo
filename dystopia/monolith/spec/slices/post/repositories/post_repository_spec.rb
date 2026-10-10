# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::Repositories::PostRepository", type: :database do
  let(:repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:cast_id) { SecureRandom.uuid_v7 }

  describe "#create_post" do
    it "creates a post and returns it" do
      post = repo.create_post(author_profile_id: cast_id, content: "Hello world")
      expect(post.author_profile_id).to eq(cast_id)
      expect(post.content).to eq("Hello world")
      expect(post.id).not_to be_nil
    end
  end

  describe "#search_by_hashtag" do
    def tagged_post(content, tags, visibility: "public")
      post = repo.create_post(author_profile_id: cast_id, content: content, visibility: visibility)
      repo.save_hashtags(post_id: post.id, hashtags: tags)
      post.id
    end

    it "finds the public posts that carry exactly that tag, whatever its case" do
      exact = tagged_post("a #NewLook", ["NewLook"])
      tagged_post("a #NewLookBook", ["NewLookBook"])
      tagged_post("no tag at all, only the words newlook", [])
      tagged_post("a private #newlook", ["newlook"], visibility: "private")

      expect(repo.search_by_hashtag(tag: "newlook")).to eq([exact])
    end

    it "finds a tag written in Japanese" do
      id = tagged_post("今日の #新作", ["新作"])
      tagged_post("今日の #新作コスメ", ["新作コスメ"])

      expect(repo.search_by_hashtag(tag: "新作")).to eq([id])
    end

    it "lists a post once even when the tag was saved on it twice" do
      id = tagged_post("#a and #A", ["a", "A"])

      expect(repo.search_by_hashtag(tag: "a")).to eq([id])
    end

    it "returns nothing for an empty tag" do
      tagged_post("a #tag", ["tag"])

      expect(repo.search_by_hashtag(tag: " ")).to eq([])
    end
  end

  describe "#find_by_id" do
    it "returns nil when post does not exist" do
      expect(repo.find_by_id(SecureRandom.uuid_v7)).to be_nil
    end

    it "returns post with media when exists" do
      post = repo.create_post(author_profile_id: cast_id, content: "Test")
      result = repo.find_by_id(post.id)
      expect(result).not_to be_nil
      expect(result.content).to eq("Test")
    end
  end

  describe "#update_post" do
    it "updates post content" do
      post = repo.create_post(author_profile_id: cast_id, content: "Original")
      result = repo.update_post(post.id, content: "Updated")
      expect(result.content).to eq("Updated")
    end
  end

  describe "#delete_post" do
    it "deletes the post" do
      post = repo.create_post(author_profile_id: cast_id, content: "To delete")
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
        media_key: "uploads/#{media_id}.jpg"
      )
      media_id
    end

    it "saves media with media_id for a post" do
      post = repo.create_post(author_profile_id: cast_id, content: "With media")
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
      post = repo.create_post(author_profile_id: cast_id, content: "With media")
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
      post = repo.create_post(author_profile_id: cast_id, content: "With media")
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
      post = repo.create_post(author_profile_id: cast_id, content: "Post with hashtags")
      repo.save_hashtags(post_id: post.id, hashtags: ["ruby", "rails"])

      result = repo.find_by_id(post.id)
      expect(result.hashtags.map(&:tag)).to contain_exactly("ruby", "rails")
    end

    it "replaces existing hashtags" do
      post = repo.create_post(author_profile_id: cast_id, content: "Post")
      repo.save_hashtags(post_id: post.id, hashtags: ["old"])
      repo.save_hashtags(post_id: post.id, hashtags: ["new"])

      result = repo.find_by_id(post.id)
      expect(result.hashtags.map(&:tag)).to eq(["new"])
    end
  end

  describe "#save_mentions" do
    it "saves mentions for a post" do
      post = repo.create_post(author_profile_id: cast_id, content: "@alice hi")
      mentioned_id = SecureRandom.uuid_v7
      repo.save_mentions(post_id: post.id, mentions: [{ profile_id: mentioned_id, position: 0, length: 6 }])

      result = repo.find_by_id(post.id)
      expect(result.post_mentions.length).to eq(1)
      expect(result.post_mentions.first.profile_id).to eq(mentioned_id)
      expect(result.post_mentions.first.position).to eq(0)
      expect(result.post_mentions.first.length).to eq(6)
    end

    it "replaces existing mentions" do
      post = repo.create_post(author_profile_id: cast_id, content: "@a @b")
      id_a = SecureRandom.uuid_v7
      id_b = SecureRandom.uuid_v7
      repo.save_mentions(post_id: post.id, mentions: [{ profile_id: id_a, position: 0, length: 2 }])
      repo.save_mentions(post_id: post.id, mentions: [{ profile_id: id_b, position: 3, length: 2 }])

      result = repo.find_by_id(post.id)
      expect(result.post_mentions.map(&:profile_id)).to eq([id_b])
    end
  end

  describe "author-based queries (symmetric)" do
    let(:author_profile_id) { SecureRandom.uuid_v7 }

    it "creates a post with author_profile_id and finds it" do
      created = repo.create_post(author_profile_id: author_profile_id, content: "hello", visibility: "public")
      found = repo.find_by_id_and_author(id: created.id, author_profile_id: author_profile_id)
      expect(found).not_to be_nil
      expect(found.content).to eq("hello")
    end

    it "lists public posts by author_profile_id" do
      repo.create_post(author_profile_id: author_profile_id, content: "p1", visibility: "public")
      repo.create_post(author_profile_id: author_profile_id, content: "p2", visibility: "private")
      result = repo.list_posts(author_profile_id: author_profile_id)
      expect(result.map(&:content)).to include("p1")
      expect(result.map(&:content)).not_to include("p2")
    end
  end

  describe "#top_by_likes" do
    it "does not raise an ambiguous column error for day and week periods" do
      repo.create_post(author_profile_id: cast_id, content: "ranked", visibility: "public")

      %w[day week all].each do |period|
        expect { repo.top_by_likes(period: period, limit: 10) }.not_to raise_error
      end
    end
  end

  describe "#delete_by_author" do
    it "deletes all posts by the author" do
      author_profile_id = SecureRandom.uuid_v7
      other_author_profile_id = SecureRandom.uuid_v7
      mine = repo.create_post(author_profile_id: author_profile_id, content: "mine")
      other = repo.create_post(author_profile_id: other_author_profile_id, content: "not mine")

      repo.delete_by_author(author_profile_id)

      expect(repo.find_by_id(mine.id)).to be_nil
      expect(repo.find_by_id(other.id)).not_to be_nil
    end
  end
end
