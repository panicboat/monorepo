# frozen_string_literal: true

require "spec_helper"
require "post/v1/post_service_pb"
require "profile/v1/service_pb"
require "slices/post/presenters/post_presenter"

RSpec.describe Post::Presenters::PostPresenter do
  describe ".to_post_proto author" do
    let(:post) do
      double(
        :post, id: "post-1", author_profile_id: "author-1", content: "hi", created_at: Time.now,
        published_at: Time.now, expires_at: nil, pinned_at: nil, post_media: [], hashtags: [], post_mentions: [], visibility: "public"
      )
    end

    it "presents the author as a profile summary with its privacy" do
      summary = Profile::UseCases::SummarizeProfiles::Summary.new(
        profile_id: "author-1", username: "alice", display_name: "Alice", avatar_url: "", is_private: true, role: 2, industry: ""
      )

      proto = described_class.to_post_proto(post, author: summary)

      expect(proto.author).to be_a(::Profile::V1::ProfileSummary)
      expect(proto.author.username).to eq("alice")
      expect(proto.author.is_private).to be true
    end

    it "leaves the author unset when there is none" do
      expect(described_class.to_post_proto(post).author).to be_nil
    end
  end

  describe ".to_post_proto schedule" do
    let(:post) do
      double(
        :post, id: "post-1", author_profile_id: "author-1", content: "hi", created_at: Time.now,
        published_at: Time.now, expires_at: nil, pinned_at: nil, post_media: [], hashtags: [], post_mentions: [], visibility: "public"
      )
    end

    it "presents the connected schedule with the author's profile id" do
      schedules = { "post-1" => { work_date: "2026-10-24", start_time: "20:00", end_time: "02:00" } }

      schedule = described_class.to_post_proto(post, schedules: schedules).schedule

      expect(schedule).to be_a(::Schedule::V1::Schedule)
      expect([schedule.profile_id, schedule.work_date, schedule.start_time, schedule.end_time]).to eq(%w[author-1 2026-10-24 20:00 02:00])
    end

    it "leaves the schedule unset when the post has none" do
      expect(described_class.to_post_proto(post, schedules: {}).has_schedule?).to be false
    end
  end

  describe ".to_post_proto mentions" do
    let(:mention) { double(:mention, profile_id: "mentioned-1", position: 3, length: 6) }
    let(:post) do
      double(
        :post,
        id: "post-1",
        author_profile_id: "author-1",
        content: "hi @alice",
        created_at: Time.now,
        published_at: Time.now,
        expires_at: nil,
        pinned_at: nil,
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

    it "leaves out a mention whose profile is unresolved" do
      proto = described_class.to_post_proto(post, mentioned_usernames: {})

      expect(proto.mentions).to be_empty
    end

    it "defaults to no mentions when the post has none" do
      no_mention_post = double(
        :post, id: "post-2", author_profile_id: "author-1", content: "hi", created_at: Time.now,
        published_at: Time.now, expires_at: nil, pinned_at: nil, post_media: [], hashtags: [], post_mentions: [], visibility: "public"
      )

      proto = described_class.to_post_proto(no_mention_post)

      expect(proto.mentions).to eq([])
    end
  end

  describe ".to_post_proto display window" do
    it "presents the start and the end in the created_at format, leaving a missing end empty" do
      created_at = Time.utc(2026, 10, 1, 9, 0, 0)
      published_at = Time.utc(2026, 10, 2, 9, 0, 0)
      expires_at = Time.utc(2026, 10, 3, 9, 0, 0)
      post = double(
        :post, id: "post-3", author_profile_id: "author-1", content: "hi", created_at: created_at,
        published_at: published_at, expires_at: expires_at, pinned_at: nil, post_media: [], hashtags: [], post_mentions: [], visibility: "public"
      )
      endless = double(
        :post, id: "post-4", author_profile_id: "author-1", content: "hi", created_at: created_at,
        published_at: published_at, expires_at: nil, pinned_at: nil, post_media: [], hashtags: [], post_mentions: [], visibility: "public"
      )

      proto = described_class.to_post_proto(post)

      expect([proto.created_at, proto.published_at, proto.expires_at]).to eq([created_at.iso8601, published_at.iso8601, expires_at.iso8601])
      expect(described_class.to_post_proto(endless).expires_at).to eq("")
    end
  end
end
