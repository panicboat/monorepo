# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Likes::GetLikeStatus do
  let(:use_case) { described_class.new(like_repo: like_repo) }
  let(:like_repo) { double(:like_repo) }

  let(:guest_id) { "guest-1" }
  let(:post_ids) { %w[post-1 post-2 post-3] }

  describe "#call" do
    it "returns like status for multiple posts" do
      allow(like_repo).to receive(:liked_status_batch)
        .with(post_ids: post_ids, guest_id: guest_id)
        .and_return({ "post-1" => true, "post-2" => false, "post-3" => true })

      result = use_case.call(post_ids: post_ids, guest_id: guest_id)

      expect(result["post-1"]).to be true
      expect(result["post-2"]).to be false
      expect(result["post-3"]).to be true
    end

    it "returns empty hash for empty post_ids" do
      allow(like_repo).to receive(:liked_status_batch)
        .with(post_ids: [], guest_id: guest_id)
        .and_return({})

      result = use_case.call(post_ids: [], guest_id: guest_id)

      expect(result).to eq({})
    end
  end
end
