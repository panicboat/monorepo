# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Comments::ListComments do
  let(:use_case) { described_class.new(comment_repo: comment_repo) }
  let(:comment_repo) { double(:comment_repo) }

  let(:post_id) { "post-1" }
  let(:user_id_cast) { "user-cast-1" }
  let(:user_id_guest) { "user-guest-1" }

  let(:comment1) do
    double(:comment,
      id: "comment-1",
      user_id: user_id_cast,
      content: "Comment 1",
      created_at: Time.parse("2026-01-01T10:00:00Z")
    )
  end

  let(:comment2) do
    double(:comment,
      id: "comment-2",
      user_id: user_id_guest,
      content: "Comment 2",
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
      .with([user_id_cast, user_id_guest])
      .and_return({ user_id_cast => "cast", user_id_guest => "guest" })

    allow(user_adapter).to receive(:get_user_types_batch)
      .with([user_id_cast])
      .and_return({ user_id_cast => "cast" })

    cast_info = double(:cast_info, id: "cast-1", user_id: user_id_cast, name: "Yuna", image_path: "casts/yuna.jpg", avatar_path: "avatars/yuna.jpg", handle: "yuna")
    allow(cast_adapter).to receive(:find_by_user_ids)
      .and_return({ user_id_cast => cast_info })

    guest_info = double(:guest_info, id: "guest-1", user_id: user_id_guest, name: "Taro", avatar_path: "avatars/taro.jpg")
    allow(guest_adapter).to receive(:find_by_user_ids)
      .and_return({ user_id_guest => guest_info })
  end

  describe "#call" do
    it "returns comments with authors" do
      allow(comment_repo).to receive(:list_by_post_id)
        .with(hash_including(post_id: post_id, limit: 20, cursor: nil))
        .and_return([comment1, comment2])

      result = use_case.call(post_id: post_id)

      expect(result[:comments]).to eq([comment1, comment2])
      expect(result[:has_more]).to be false
      expect(result[:next_cursor]).to be_nil
      expect(result[:authors]).to include(user_id_cast, user_id_guest)
    end

    it "respects limit parameter" do
      allow(comment_repo).to receive(:list_by_post_id)
        .with(hash_including(post_id: post_id, limit: 5, cursor: nil))
        .and_return([comment1])

      result = use_case.call(post_id: post_id, limit: 5)

      expect(result[:comments]).to eq([comment1])
    end

    it "clamps limit to MAX_LIMIT" do
      allow(comment_repo).to receive(:list_by_post_id)
        .with(hash_including(post_id: post_id, limit: 50, cursor: nil))
        .and_return([])

      use_case.call(post_id: post_id, limit: 100)

      expect(comment_repo).to have_received(:list_by_post_id)
        .with(hash_including(post_id: post_id, limit: 50, cursor: nil))
    end

    it "clamps limit to minimum of 1" do
      allow(comment_repo).to receive(:list_by_post_id)
        .with(hash_including(post_id: post_id, limit: 1, cursor: nil))
        .and_return([])

      use_case.call(post_id: post_id, limit: 0)

      expect(comment_repo).to have_received(:list_by_post_id)
        .with(hash_including(post_id: post_id, limit: 1, cursor: nil))
    end

    it "sets has_more to true when more results exist" do
      # Return limit + 1 results to indicate more exist
      comments = [comment1, comment2, double(:comment3, id: "c3", user_id: user_id_cast, created_at: Time.now)]
      allow(comment_repo).to receive(:list_by_post_id)
        .with(hash_including(post_id: post_id, limit: 2, cursor: nil))
        .and_return(comments)

      result = use_case.call(post_id: post_id, limit: 2)

      expect(result[:has_more]).to be true
      expect(result[:comments].size).to eq(2)
      expect(result[:next_cursor]).not_to be_nil
    end

    it "decodes and passes cursor to repository" do
      cursor_data = { "created_at" => "2026-01-01T09:00:00Z", "id" => "comment-2" }
      encoded_cursor = Base64.urlsafe_encode64(JSON.generate(cursor_data), padding: false)

      allow(comment_repo).to receive(:list_by_post_id)
        .with(hash_including(post_id: post_id, limit: 20))
        .and_return([])

      use_case.call(post_id: post_id, cursor: encoded_cursor)

      expect(comment_repo).to have_received(:list_by_post_id)
    end

    it "handles invalid cursor gracefully" do
      allow(comment_repo).to receive(:list_by_post_id)
        .with(hash_including(post_id: post_id, limit: 20, cursor: nil))
        .and_return([])

      result = use_case.call(post_id: post_id, cursor: "invalid-cursor")

      expect(result[:comments]).to eq([])
    end

    it "loads cast author information" do
      allow(comment_repo).to receive(:list_by_post_id).and_return([comment1])

      result = use_case.call(post_id: post_id)

      author = result[:authors][user_id_cast]
      expect(author[:name]).to eq("Yuna")
      expect(author[:user_type]).to eq("cast")
    end

    it "loads guest author information" do
      allow(comment_repo).to receive(:list_by_post_id).and_return([comment2])

      # Update mock for single user
      user_adapter = double(:user_adapter)
      guest_adapter = double(:guest_adapter)
      allow(Social::Adapters::UserAdapter).to receive(:new).and_return(user_adapter)
      allow(Social::Adapters::CastAdapter).to receive(:new).and_return(double(:cast_adapter, find_by_user_ids: {}))
      allow(Social::Adapters::GuestAdapter).to receive(:new).and_return(guest_adapter)

      allow(user_adapter).to receive(:get_user_types_batch)
        .with([user_id_guest])
        .and_return({ user_id_guest => "guest" })

      guest_info = double(:guest_info, id: "guest-1", name: "Taro", avatar_path: "avatars/taro.jpg")
      allow(guest_adapter).to receive(:find_by_user_ids)
        .with([user_id_guest])
        .and_return({ user_id_guest => guest_info })

      result = use_case.call(post_id: post_id)

      author = result[:authors][user_id_guest]
      expect(author[:name]).to eq("Taro")
      expect(author[:user_type]).to eq("guest")
      # image_url is generated by Storage.download_url, which uses LocalAdapter in test
      expect(author[:image_url]).to include("avatars/taro.jpg")
    end
  end
end
