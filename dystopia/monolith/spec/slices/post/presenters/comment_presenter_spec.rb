# frozen_string_literal: true

require "spec_helper"
require "post/v1/comment_service_pb"
require "slices/post/presenters/comment_presenter"

RSpec.describe Post::Presenters::CommentPresenter do
  describe ".author_to_proto" do
    it "carries the author's username through to the proto" do
      author_info = { id: "user-1", name: "Coco", image_url: "https://example.com/a.png", username: "coco_u" }

      proto = described_class.author_to_proto(author_info)

      expect(proto.username).to eq("coco_u")
    end

    it "defaults username to an empty string when absent" do
      author_info = { id: "user-1", name: "Coco", image_url: "" }

      proto = described_class.author_to_proto(author_info)

      expect(proto.username).to eq("")
    end

    it "returns nil when author_info is nil" do
      expect(described_class.author_to_proto(nil)).to be_nil
    end
  end

  describe ".to_proto mentions" do
    let(:mention) { double(:mention, account_id: "mentioned-1", position: 0, length: 6) }
    let(:comment) do
      double(
        :comment,
        id: "comment-1",
        post_id: "post-1",
        parent_id: nil,
        user_id: "user-1",
        content: "@alice hi",
        created_at: Time.now,
        comment_media: [],
        comment_mentions: [mention],
        replies_count: 0
      )
    end

    it "resolves the mentioned account's current username" do
      proto = described_class.to_proto(comment, mentioned_usernames: { "mentioned-1" => "alice_now" })

      expect(proto.mentions.length).to eq(1)
      expect(proto.mentions.first.username).to eq("alice_now")
    end

    it "defaults to an empty username when unresolved" do
      proto = described_class.to_proto(comment, mentioned_usernames: {})

      expect(proto.mentions.first.username).to eq("")
    end
  end
end
