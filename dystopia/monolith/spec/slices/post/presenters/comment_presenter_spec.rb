# frozen_string_literal: true

require "spec_helper"
require "post/v1/comment_service_pb"
require "profile/v1/service_pb"
require "slices/post/presenters/comment_presenter"

RSpec.describe Post::Presenters::CommentPresenter do
  describe ".to_proto author" do
    let(:comment) do
      double(
        :comment, id: "comment-1", post_id: "post-1", parent_id: nil, author_profile_id: "user-1", content: "hi",
        created_at: Time.now, comment_media: [], comment_mentions: [], replies_count: 0
      )
    end

    it "presents the author as a profile summary with its privacy" do
      summary = Profile::UseCases::SummarizeProfiles::Summary.new(
        profile_id: "user-1", username: "coco_u", display_name: "Coco", avatar_url: "", is_private: true, role: 1
      )

      proto = described_class.to_proto(comment, author: summary)

      expect(proto.author).to be_a(::Profile::V1::ProfileSummary)
      expect(proto.author.username).to eq("coco_u")
      expect(proto.author.is_private).to be true
    end

    it "leaves the author unset when there is none" do
      expect(described_class.to_proto(comment).author).to be_nil
    end
  end

  describe ".to_proto mentions" do
    let(:mention) { double(:mention, profile_id: "mentioned-1", position: 0, length: 6) }
    let(:comment) do
      double(
        :comment,
        id: "comment-1",
        post_id: "post-1",
        parent_id: nil,
        author_profile_id: "user-1",
        content: "@alice hi",
        created_at: Time.now,
        comment_media: [],
        comment_mentions: [mention],
        replies_count: 0
      )
    end

    it "resolves the mentioned profile's current username" do
      proto = described_class.to_proto(comment, mentioned_usernames: { "mentioned-1" => "alice_now" })

      expect(proto.mentions.length).to eq(1)
      expect(proto.mentions.first.username).to eq("alice_now")
    end

    it "leaves out a mention whose profile is unresolved" do
      proto = described_class.to_proto(comment, mentioned_usernames: {})

      expect(proto.mentions).to be_empty
    end
  end
end
