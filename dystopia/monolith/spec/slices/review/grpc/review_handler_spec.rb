# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/review/grpc/review_handler"

RSpec.describe Review::Grpc::ReviewHandler, type: :database do
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "guest_one") }
  let(:cast_account) { create_account(role: 2) }
  let(:cast) { create_account_with_profile(account_id: cast_account, username: "cast_one") }

  let(:booked) do
    ::Review::V1::ReviewEventInput.new(stage: :REVIEW_STAGE_RESERVATION, outcome: "booked", tags: ["quick_reply"], note: "", occurred_on: "2026-10-01")
  end

  def handler_for(message)
    described_class.new(method_key: :test, service: double, rpc_desc: double, active_call: double, message: message)
  end

  def act_as(account_id, profile_id)
    Current.account_id = account_id
    Current.profile_id = profile_id
  end

  def status(code)
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
  end

  def create_review(rating: 0, target: cast)
    handler_for(::Review::V1::CreateReviewRequest.new(target_profile_id: target, rating: rating, event: booked)).create_review.review
  end

  after { Current.clear }

  it "creates an open review by the acting profile" do
    act_as(guest_account, guest)

    review = create_review

    expect([review.status, review.rating, review.author_profile_id, review.target.username, review.is_mine]).to eq([:REVIEW_STATUS_OPEN, 0, guest, "cast_one", true])
    expect(review.events.first.stage).to eq(:REVIEW_STAGE_RESERVATION)
  end

  it "marks a private cast target as private in its summary" do
    act_as(guest_account, guest)
    private_cast = create_account_with_profile(role: 2, username: "private_cast", is_private: true)

    review = create_review(target: private_cast)

    expect([review.target.username, review.target.is_private, review.author.is_private]).to eq(["private_cast", true, false])
  end

  it "refuses a cast with PERMISSION_DENIED and a guest target with INVALID_ARGUMENT" do
    act_as(cast_account, cast)
    expect { create_review }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)

    act_as(guest_account, guest)
    expect { create_review(target: create_account_with_profile(username: "guest_two")) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
  end

  it "rates, closes and reopens, then lists the review with the summary for the cast" do
    act_as(guest_account, guest)
    id = create_review(rating: 4).id
    closed = handler_for(::Review::V1::CloseReviewRequest.new(review_id: id)).close_review.review
    expect(closed.status).to eq(:REVIEW_STATUS_CLOSED)

    act_as(cast_account, cast)
    listed = handler_for(::Review::V1::ListReviewsByTargetRequest.new(target_profile_id: cast)).list_reviews_by_target
    expect(listed.reviews.map(&:id)).to eq([id])
    expect([listed.summary.average_rating, listed.summary.rater_count, listed.summary.review_count]).to eq([4.0, 1, 1])
    expect { handler_for(::Review::V1::ReopenReviewRequest.new(review_id: id)).reopen_review }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
  end

  it "lists the author's, the viewer's own and the recent reviews" do
    act_as(guest_account, guest)
    id = create_review.id

    by_author = handler_for(::Review::V1::ListReviewsByAuthorRequest.new(author_profile_id: guest)).list_reviews_by_author
    mine = handler_for(::Review::V1::ListMyReviewsRequest.new).list_my_reviews
    recent = handler_for(::Review::V1::ListRecentReviewsRequest.new).list_recent_reviews

    expect([by_author.reviews.map(&:id), mine.reviews.map(&:id), recent.reviews.map(&:id)]).to eq([[id], [id], [id]])
    expect([mine.counts.total_count, mine.counts.open_count, mine.counts.closed_count]).to eq([1, 1, 0])
  end

  it "adds, updates and deletes events" do
    act_as(guest_account, guest)
    id = create_review.id
    service = ::Review::V1::ReviewEventInput.new(stage: :REVIEW_STAGE_SERVICE, outcome: "satisfied", occurred_on: "2026-10-02")

    added = handler_for(::Review::V1::AddReviewEventRequest.new(review_id: id, event: service)).add_review_event.review
    event_id = added.events.last.id
    updated = handler_for(::Review::V1::UpdateReviewEventRequest.new(event_id: event_id, event: service.dup.tap { |e| e.outcome = "completed_with_issues" })).update_review_event.review
    remaining = handler_for(::Review::V1::DeleteReviewEventRequest.new(event_id: event_id)).delete_review_event.review

    expect([added.events.length, updated.events.last.outcome, remaining.events.length]).to eq([2, "completed_with_issues", 1])
  end
end
