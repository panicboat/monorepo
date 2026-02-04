# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Follows::UnfollowCast do
  let(:use_case) { described_class.new(follow_repo: follow_repo) }
  let(:follow_repo) { double(:follow_repo) }

  let(:cast_id) { "cast-1" }
  let(:guest_id) { "guest-1" }

  describe "#call" do
    it "unfollows a cast and returns success" do
      allow(follow_repo).to receive(:unfollow).with(cast_id: cast_id, guest_id: guest_id)

      result = use_case.call(cast_id: cast_id, guest_id: guest_id)

      expect(result[:success]).to be true
    end
  end
end
