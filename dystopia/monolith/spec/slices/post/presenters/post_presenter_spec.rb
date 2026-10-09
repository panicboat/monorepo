# frozen_string_literal: true

require "spec_helper"
require "post/v1/post_service_pb"
require "slices/post/presenters/post_presenter"

RSpec.describe Post::Presenters::PostPresenter do
  describe ".to_post_proto mentions" do
    let(:mention) { double(:mention, profile_id: "mentioned-1", position: 3, length: 6) }
    let(:post) do
      double(
        :post,
        id: "post-1",
        author_profile_id: "author-1",
        content: "hi @alice",
        created_at: Time.now,
        post_media: [],
        hashtags: [],
        post_mentions: [mention],
        visibility: "public"
      )
    end

    it "resolves the mentioned profile's current username" do
      proto = described_class.to_post_proto(post, mentioned_usernames: { "mentioned-1" => "alice_now" })

      expect(proto.mentions.length).to eq(1)
      expect(proto.mentions.first.profile_id).to eq("mentioned-1")
      expect(proto.mentions.first.username).to eq("alice_now")
      expect(proto.mentions.first.position).to eq(3)
      expect(proto.mentions.first.length).to eq(6)
    end

    it "defaults to an empty username when unresolved" do
      proto = described_class.to_post_proto(post, mentioned_usernames: {})

      expect(proto.mentions.first.username).to eq("")
    end

    it "defaults to no mentions when the post has none" do
      no_mention_post = double(
        :post, id: "post-2", author_profile_id: "author-1", content: "hi", created_at: Time.now,
        post_media: [], hashtags: [], post_mentions: [], visibility: "public"
      )

      proto = described_class.to_post_proto(no_mention_post)

      expect(proto.mentions).to eq([])
    end
  end
end
