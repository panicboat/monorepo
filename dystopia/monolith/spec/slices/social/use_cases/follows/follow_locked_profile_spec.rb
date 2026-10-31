# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Following a locked profile that does not require approval", type: :database do
  let(:follow) { Social::Slice["use_cases.follows.follow"] }
  let(:save_schedule) { Schedule::Slice["use_cases.save_schedule"] }
  let(:list_schedules) { Schedule::Slice["use_cases.list_schedules"] }
  let(:create_review) { Review::Slice["use_cases.create_review"] }
  let(:list_reviews_by_target) { Review::Slice["use_cases.list_reviews_by_target"] }
  let(:no_summary) { Review::UseCases::ListReviewsByTarget::NO_SUMMARY }
  let(:cast) { create_account_with_profile(role: 2, username: "unlock_cast", is_private: true, follow_approval_required: false) }
  let(:viewer_account) { create_account }
  let(:viewer) { create_account_with_profile(account_id: viewer_account, username: "unlock_viewer") }
  let(:author_account) { create_account }
  let(:author) { create_account_with_profile(account_id: author_account, username: "unlock_author") }

  def schedules
    list_schedules.call(profile_id: cast, viewer_profile_id: viewer, from_date: "2026-09-19", to_date: "2026-09-21")
  end

  def schedules_hidden_by_lock? = list_schedules.hidden_by_lock?(profile_id: cast, viewer_profile_id: viewer)

  def reviews
    list_reviews_by_target.call(
      viewer_account_id: viewer_account, viewer_profile_id: viewer, target_profile_id: cast, limit: 20, cursor: nil
    )
  end

  before do
    save_schedule.call(profile_id: cast, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    create_review.call(
      viewer_account_id: author_account, viewer_profile_id: author, target_profile_id: cast, rating: 4,
      event: { stage: "service", outcome: "satisfied", tags: [], note: "", occurred_on: "2026-10-01" }
    )
  end

  it "shows the schedules and the reviews with their average to the viewer right after following" do
    expect(schedules).to eq([])
    expect(schedules_hidden_by_lock?).to be(true)
    expect(reviews).to include(reviews: [], summary: no_summary, hidden_by_lock: true)

    expect(follow.call(follower_profile_id: viewer, target_profile_id: cast)).to eq(status: "approved")

    expect(schedules.map { |schedule| schedule.work_date.to_s }).to eq(["2026-09-20"])
    expect(schedules_hidden_by_lock?).to be(false)
    expect(reviews[:reviews].length).to eq(1)
    expect(reviews[:summary]).to eq(average_rating: 4.0, rater_count: 1, review_count: 1)
    expect(reviews[:hidden_by_lock]).to be(false)
  end
end
