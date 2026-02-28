# frozen_string_literal: true

require "spec_helper"
require "feed/v1/feed_service_pb"

RSpec.describe Feed::Presenters::FeedPresenter do
  let(:post_id) { SecureRandom.uuid }
  let(:cast_id) { SecureRandom.uuid }
  let(:media_id) { SecureRandom.uuid }

  let(:post) do
    double(
      id: post_id,
      cast_user_id: cast_id,
      content: "Test content",
      visibility: "public",
      created_at: Time.now,
      post_media: post_media,
      hashtags: []
    )
  end

  let(:post_media) { [] }

  let(:author_media_id) { SecureRandom.uuid }

  let(:author) do
    double(
      user_id: SecureRandom.uuid,
      name: "Test Cast",
      profile_media_id: author_media_id,
      avatar_media_id: author_media_id
    )
  end

  let(:author_media_file) do
    double(
      id: author_media_id,
      url: "https://example.com/avatar.jpg"
    )
  end

  describe ".to_proto" do
    context "without media" do
      it "returns FeedPost proto" do
        result = described_class.to_proto(post, author: author, media_files: { author_media_id => author_media_file })

        expect(result).to be_a(::Feed::V1::FeedPost)
        expect(result.id).to eq(post_id)
        expect(result.content).to eq("Test content")
        expect(result.media).to be_empty
      end
    end

    context "with media and media_files" do
      let(:media_file) do
        double(
          id: media_id,
          url: "https://example.com/image.jpg",
          thumbnail_url: "https://example.com/thumb.jpg",
          media_type: "image"
        )
      end

      let(:post_media) do
        [
          double(
            id: SecureRandom.uuid,
            media_id: media_id,
            media_type: "image",
            position: 0
          )
        ]
      end

      let(:media_files) { { media_id => media_file } }

      it "returns FeedPost proto with media URLs from media_files" do
        all_media_files = media_files.merge(author_media_id => author_media_file)
        result = described_class.to_proto(post, author: author, media_files: all_media_files)

        expect(result.media.size).to eq(1)
        expect(result.media.first.url).to eq("https://example.com/image.jpg")
        expect(result.media.first.thumbnail_url).to eq("https://example.com/thumb.jpg")
      end
    end

    context "with media but missing media_file" do
      let(:post_media) do
        [
          double(
            id: SecureRandom.uuid,
            media_id: media_id,
            media_type: "image",
            position: 0
          )
        ]
      end

      it "returns empty URLs when media_file not found" do
        result = described_class.to_proto(post, author: author, media_files: { author_media_id => author_media_file })

        expect(result.media.size).to eq(1)
        expect(result.media.first.url).to eq("")
        expect(result.media.first.thumbnail_url).to eq("")
      end
    end
  end

  describe ".many_to_proto" do
    let(:media_file) do
      double(
        id: media_id,
        url: "https://example.com/image.jpg",
        thumbnail_url: "https://example.com/thumb.jpg"
      )
    end

    let(:post_media) do
      [
        double(
          id: SecureRandom.uuid,
          media_id: media_id,
          media_type: "image",
          position: 0
        )
      ]
    end

    let(:media_files) { { media_id => media_file } }

    it "passes media_files to each post" do
      all_media_files = media_files.merge(author_media_id => author_media_file)
      result = described_class.many_to_proto(
        [post],
        authors: { cast_id => author },
        media_files: all_media_files
      )

      expect(result.size).to eq(1)
      expect(result.first.media.first.url).to eq("https://example.com/image.jpg")
    end
  end
end
