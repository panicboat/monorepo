# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Likes::LikePost do
  let(:use_case) { described_class.new(like_repo: like_repo, post_repo: post_repo) }
  let(:like_repo) { double(:like_repo) }
  let(:post_repo) { double(:post_repo) }

  let(:post_id) { "post-1" }
  let(:guest_id) { "guest-1" }
  let(:post) { double(:post, id: post_id) }

  describe "#call" do
    it "likes a post and returns likes count" do
      allow(post_repo).to receive(:find_by_id).with(post_id).and_return(post)
      allow(like_repo).to receive(:like).with(post_id: post_id, guest_id: guest_id)
      allow(like_repo).to receive(:likes_count).with(post_id: post_id).and_return(5)

      result = use_case.call(post_id: post_id, guest_id: guest_id)

      expect(result[:likes_count]).to eq(5)
    end

    it "raises PostNotFoundError when post does not exist" do
      allow(post_repo).to receive(:find_by_id).with(post_id).and_return(nil)

      expect {
        use_case.call(post_id: post_id, guest_id: guest_id)
      }.to raise_error(Social::UseCases::Likes::LikePost::PostNotFoundError)
    end
  end
end
