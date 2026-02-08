# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Comments::ListReplies do
  let(:use_case) { described_class.new(comment_repo: comment_repo) }
  let(:comment_repo) { double(:comment_repo) }

  let(:comment_id) { "comment-1" }
  let(:user_id_cast) { "user-cast-1" }
  let(:user_id_guest) { "user-guest-1" }

  let(:reply1) do
    double(:reply,
      id: "reply-1",
      user_id: user_id_cast,
      content: "Reply 1",
      created_at: Time.parse("2026-01-01T10:00:00Z")
    )
  end

  let(:reply2) do
    double(:reply,
      id: "reply-2",
      user_id: user_id_guest,
      content: "Reply 2",
      created_at: Time.parse("2026-01-01T09:00:00Z")
    )
  end

  before do
    # Mock adapters
    user_adapter = double(:user_adapter)
    cast_adapter = double(:cast_adapter)
    guest_adapter = double(:guest_adapter)

    allow(Social::Adapters::UserAdapter).to receive(:new).and_return(user_adapter)
    allow(Social::Adapters::CastAdapter).to receive(:new).and_return(cast_adapter)
    allow(Social::Adapters::GuestAdapter).to receive(:new).and_return(guest_adapter)

    allow(user_adapter).to receive(:get_user_types_batch)
      .and_return({ user_id_cast => "cast", user_id_guest => "guest" })

    cast_info = double(:cast_info, id: "cast-1", name: "Yuna", image_path: "casts/yuna.jpg", avatar_path: nil)
    allow(cast_adapter).to receive(:find_by_user_ids)
      .and_return({ user_id_cast => cast_info })

    guest_info = double(:guest_info, id: "guest-1", name: "Taro", avatar_path: "avatars/taro.jpg")
    allow(guest_adapter).to receive(:find_by_user_ids)
      .and_return({ user_id_guest => guest_info })
  end

  describe "#call" do
    it "returns replies with authors" do
      allow(comment_repo).to receive(:list_replies)
        .with(parent_id: comment_id, limit: 20, cursor: nil, exclude_user_ids: nil)
        .and_return([reply1, reply2])

      result = use_case.call(comment_id: comment_id)

      expect(result[:replies]).to eq([reply1, reply2])
      expect(result[:has_more]).to be false
      expect(result[:next_cursor]).to be_nil
      expect(result[:authors]).to include(user_id_cast, user_id_guest)
    end

    it "respects limit parameter" do
      allow(comment_repo).to receive(:list_replies)
        .with(parent_id: comment_id, limit: 5, cursor: nil, exclude_user_ids: nil)
        .and_return([reply1])

      result = use_case.call(comment_id: comment_id, limit: 5)

      expect(result[:replies]).to eq([reply1])
    end

    it "clamps limit to MAX_LIMIT" do
      allow(comment_repo).to receive(:list_replies)
        .with(parent_id: comment_id, limit: 50, cursor: nil, exclude_user_ids: nil)
        .and_return([])

      use_case.call(comment_id: comment_id, limit: 100)

      expect(comment_repo).to have_received(:list_replies)
        .with(parent_id: comment_id, limit: 50, cursor: nil, exclude_user_ids: nil)
    end

    it "clamps limit to minimum of 1" do
      allow(comment_repo).to receive(:list_replies)
        .with(parent_id: comment_id, limit: 1, cursor: nil, exclude_user_ids: nil)
        .and_return([])

      use_case.call(comment_id: comment_id, limit: 0)

      expect(comment_repo).to have_received(:list_replies)
        .with(parent_id: comment_id, limit: 1, cursor: nil, exclude_user_ids: nil)
    end

    it "sets has_more to true when more results exist" do
      # Return limit + 1 results to indicate more exist
      replies = [reply1, reply2, double(:reply3, id: "r3", user_id: user_id_cast, created_at: Time.now)]
      allow(comment_repo).to receive(:list_replies)
        .with(parent_id: comment_id, limit: 2, cursor: nil, exclude_user_ids: nil)
        .and_return(replies)

      result = use_case.call(comment_id: comment_id, limit: 2)

      expect(result[:has_more]).to be true
      expect(result[:replies].size).to eq(2)
      expect(result[:next_cursor]).not_to be_nil
    end

    it "decodes and passes cursor to repository" do
      cursor_data = { "created_at" => "2026-01-01T09:00:00Z", "id" => "reply-2" }
      encoded_cursor = Base64.urlsafe_encode64(JSON.generate(cursor_data), padding: false)

      allow(comment_repo).to receive(:list_replies)
        .with(parent_id: comment_id, limit: 20, cursor: hash_including(:created_at, :id), exclude_user_ids: nil)
        .and_return([])

      use_case.call(comment_id: comment_id, cursor: encoded_cursor)

      expect(comment_repo).to have_received(:list_replies)
    end

    it "handles invalid cursor gracefully" do
      allow(comment_repo).to receive(:list_replies)
        .with(parent_id: comment_id, limit: 20, cursor: nil, exclude_user_ids: nil)
        .and_return([])

      result = use_case.call(comment_id: comment_id, cursor: "invalid-cursor")

      expect(result[:replies]).to eq([])
    end

    it "returns fallback author when profile not found" do
      allow(comment_repo).to receive(:list_replies).and_return([reply1])

      user_adapter = double(:user_adapter)
      cast_adapter = double(:cast_adapter)
      guest_adapter = double(:guest_adapter)

      allow(Social::Adapters::UserAdapter).to receive(:new).and_return(user_adapter)
      allow(Social::Adapters::CastAdapter).to receive(:new).and_return(cast_adapter)
      allow(Social::Adapters::GuestAdapter).to receive(:new).and_return(guest_adapter)

      allow(user_adapter).to receive(:get_user_types_batch)
        .with([user_id_cast])
        .and_return({ user_id_cast => "cast" })
      allow(cast_adapter).to receive(:find_by_user_ids)
        .with([user_id_cast])
        .and_return({})  # No cast found
      allow(guest_adapter).to receive(:find_by_user_ids)
        .and_return({})

      result = use_case.call(comment_id: comment_id)

      author = result[:authors][user_id_cast]
      expect(author[:name]).to eq("Anonymous Cast")
      expect(author[:user_type]).to eq("cast")
    end

    it "returns empty authors when no comments" do
      allow(comment_repo).to receive(:list_replies).and_return([])

      result = use_case.call(comment_id: comment_id)

      expect(result[:authors]).to eq({})
    end
  end
end
