# frozen_string_literal: true

require "spec_helper"

RSpec.describe Trust::UseCases::Reviews::ListReviews do
  subject(:use_case) { described_class.new }

  let(:reviewee_id) { SecureRandom.uuid }
  let(:review_repo) { Trust::Slice["repositories.review_repository"] }

  before do
    5.times do |i|
      review_repo.create(
        reviewer_id: SecureRandom.uuid,
        reviewee_id: reviewee_id,
        content: "Review #{i}",
        score: 4,
        status: "approved"
      )
      sleep 0.01
    end
  end

  describe "#call" do
    it "returns paginated results" do
      result = use_case.call(reviewee_id: reviewee_id, limit: 2)

      expect(result[:items].length).to eq(2)
      expect(result[:has_more]).to be true
      expect(result[:next_cursor]).not_to be_nil
    end

    it "supports cursor-based pagination" do
      first = use_case.call(reviewee_id: reviewee_id, limit: 2)
      second = use_case.call(reviewee_id: reviewee_id, limit: 2, cursor: first[:next_cursor])

      expect(second[:items].first.id).not_to eq(first[:items].first.id)
    end
  end
end
