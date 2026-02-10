# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Follows::ListFollowers do
  let(:use_case) { described_class.new(follow_repo: follow_repo, block_repo: block_repo) }
  let(:follow_repo) { double(:follow_repo) }
  let(:block_repo) { double(:block_repo) }

  let(:cast_id) { "cast-1" }
  let(:now) { Time.now }

  describe "#call" do
    let(:follower_records) do
      [
        double(guest_id: "guest-1", created_at: now - 100),
        double(guest_id: "guest-2", created_at: now - 200)
      ]
    end

    before do
      allow(block_repo).to receive(:blocked_guest_ids)
        .with(blocker_id: cast_id)
        .and_return([])
    end

    it "returns followers with pagination" do
      allow(follow_repo).to receive(:list_followers)
        .with(cast_id: cast_id, blocked_guest_ids: [], limit: 20, cursor: nil)
        .and_return({ followers: follower_records, total: 2, has_more: false })

      result = use_case.call(cast_id: cast_id)

      expect(result[:followers].size).to eq(2)
      expect(result[:followers].first[:guest_id]).to eq("guest-1")
      expect(result[:total]).to eq(2)
      expect(result[:has_more]).to be false
    end

    it "excludes blocked users from the list" do
      allow(block_repo).to receive(:blocked_guest_ids)
        .with(blocker_id: cast_id)
        .and_return(["guest-3"])

      allow(follow_repo).to receive(:list_followers)
        .with(cast_id: cast_id, blocked_guest_ids: ["guest-3"], limit: 20, cursor: nil)
        .and_return({ followers: follower_records, total: 2, has_more: false })

      result = use_case.call(cast_id: cast_id)

      expect(result[:followers].size).to eq(2)
    end

    it "sets has_more when results exceed limit" do
      allow(follow_repo).to receive(:list_followers)
        .with(cast_id: cast_id, blocked_guest_ids: [], limit: 1, cursor: nil)
        .and_return({ followers: [follower_records.first], total: 2, has_more: true })

      result = use_case.call(cast_id: cast_id, limit: 1)

      expect(result[:followers].size).to eq(1)
      expect(result[:has_more]).to be true
    end

    it "returns empty list when no followers exist" do
      allow(follow_repo).to receive(:list_followers)
        .with(cast_id: cast_id, blocked_guest_ids: [], limit: 20, cursor: nil)
        .and_return({ followers: [], total: 0, has_more: false })

      result = use_case.call(cast_id: cast_id)

      expect(result[:followers]).to eq([])
      expect(result[:total]).to eq(0)
      expect(result[:has_more]).to be false
    end

    it "returns next_cursor for pagination" do
      allow(follow_repo).to receive(:list_followers)
        .with(cast_id: cast_id, blocked_guest_ids: [], limit: 20, cursor: nil)
        .and_return({ followers: follower_records, total: 2, has_more: false })

      result = use_case.call(cast_id: cast_id)

      expect(result[:next_cursor]).to eq({ created_at: follower_records.last.created_at })
    end
  end
end
