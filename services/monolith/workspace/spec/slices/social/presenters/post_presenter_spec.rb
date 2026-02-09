# frozen_string_literal: true

require "spec_helper"
require "social/v1/post_service_pb"
require "storage"

RSpec.describe Social::Presenters::PostPresenter do
  before do
    allow(Storage).to receive(:download_url) { |key:| "/uploads/#{key}" }
  end

  describe ".to_proto" do
    it "returns nil when post is nil" do
      expect(described_class.to_proto(nil)).to be_nil
    end

    it "converts post to proto" do
      media = double(:media, id: "m1", media_type: "image", url: "http://img.jpg", thumbnail_url: "", position: 0)
      post = double(
        :post,
        id: "post-1",
        cast_id: "cast-1",
        content: "Hello world",
        visibility: "public",
        cast_post_media: [media],
        created_at: Time.parse("2026-01-01T10:00:00Z")
      )

      proto = described_class.to_proto(post)

      expect(proto).to be_a(::Social::V1::CastPost)
      expect(proto.id).to eq("post-1")
      expect(proto.cast_id).to eq("cast-1")
      expect(proto.content).to eq("Hello world")
      expect(proto.media.size).to eq(1)
      expect(proto.likes_count).to eq(0)
      expect(proto.comments_count).to eq(0)
      expect(proto.visibility).to eq("public")
    end

    it "converts hidden post to proto" do
      post = double(
        :post,
        id: "post-1",
        cast_id: "cast-1",
        content: "Hidden",
        visibility: "private",
        cast_post_media: [],
        created_at: Time.parse("2026-01-01T10:00:00Z")
      )

      proto = described_class.to_proto(post)

      expect(proto.visibility).to eq("private")
    end

    it "includes author when provided" do
      post = double(
        :post,
        id: "post-1",
        cast_id: "cast-1",
        content: "Hello",
        visibility: "public",
        cast_post_media: [],
        created_at: Time.now
      )
      author = double(:author, user_id: "user-1", name: "Yuna", image_path: "casts/user-1/uploads/img.jpg")

      proto = described_class.to_proto(post, author: author)

      expect(proto.author).to be_a(::Social::V1::CastPostAuthor)
      expect(proto.author.id).to eq("user-1")
      expect(proto.author.name).to eq("Yuna")
      expect(proto.author.image_url).to eq("/uploads/casts/user-1/uploads/img.jpg")
    end

    it "handles post without cast_post_media method" do
      post = double(:post, id: "post-1", cast_id: "cast-1", content: "Hello", created_at: Time.now)
      allow(post).to receive(:respond_to?).and_return(false)

      proto = described_class.to_proto(post)

      expect(proto.media).to eq([])
    end

    it "handles nil media" do
      post = double(:post, id: "post-1", cast_id: "cast-1", content: "Hello", cast_post_media: nil, created_at: Time.now)

      proto = described_class.to_proto(post)

      expect(proto.media).to eq([])
    end
  end

  describe ".many_to_proto" do
    it "returns empty array for nil" do
      expect(described_class.many_to_proto(nil)).to eq([])
    end

    it "converts multiple posts" do
      post1 = double(:post, id: "p1", cast_id: "c1", content: "Hello", cast_post_media: [], created_at: Time.now)
      post2 = double(:post, id: "p2", cast_id: "c1", content: "World", cast_post_media: [], created_at: Time.now)

      protos = described_class.many_to_proto([post1, post2])

      expect(protos.size).to eq(2)
      expect(protos.map(&:id)).to eq(%w[p1 p2])
    end
  end

  describe ".media_to_proto" do
    it "converts media to proto" do
      media = double(:media, id: "m1", media_type: "video", url: "vid.mp4", thumbnail_url: "thumb.jpg")

      proto = described_class.media_to_proto(media)

      expect(proto).to be_a(::Social::V1::CastPostMedia)
      expect(proto.id).to eq("m1")
      expect(proto.media_type).to eq("video")
      expect(proto.url).to eq("/uploads/vid.mp4")
      expect(proto.thumbnail_url).to eq("/uploads/thumb.jpg")
    end

    it "handles nil thumbnail_url" do
      media = double(:media, id: "m1", media_type: "image", url: "img.jpg", thumbnail_url: nil)

      proto = described_class.media_to_proto(media)

      expect(proto.thumbnail_url).to eq("")
    end
  end

  describe ".author_to_proto" do
    it "returns nil when cast is nil" do
      expect(described_class.author_to_proto(nil)).to be_nil
    end

    it "converts cast to author proto" do
      cast = double(:cast, user_id: "u1", name: "Yuna", image_path: "casts/u1/uploads/img.jpg")

      proto = described_class.author_to_proto(cast)

      expect(proto).to be_a(::Social::V1::CastPostAuthor)
      expect(proto.id).to eq("u1")
      expect(proto.name).to eq("Yuna")
      expect(proto.image_url).to eq("/uploads/casts/u1/uploads/img.jpg")
    end

    it "handles nil image_path" do
      cast = double(:cast, user_id: "u1", name: "Yuna", image_path: nil)

      proto = described_class.author_to_proto(cast)

      expect(proto.image_url).to eq("")
    end

    it "handles nil name" do
      cast = double(:cast, user_id: "u1", name: nil, image_path: nil)

      proto = described_class.author_to_proto(cast)

      expect(proto.name).to eq("")
      expect(proto.image_url).to eq("")
    end
  end
end
