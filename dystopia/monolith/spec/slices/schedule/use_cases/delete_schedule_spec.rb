# frozen_string_literal: true

require "spec_helper"
require "errors/validation_error"

RSpec.describe "Schedule::UseCases::DeleteSchedule", type: :database do
  let(:uc) { Hanami.app.slices[:schedule]["use_cases.delete_schedule"] }
  let(:save_uc) { Hanami.app.slices[:schedule]["use_cases.save_schedule"] }
  let(:list_uc) { Hanami.app.slices[:schedule]["use_cases.list_schedules"] }
  let(:profile_id) { SecureRandom.uuid_v7 }

  it "removes the row for that date" do
    save_uc.call(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    uc.call(profile_id: profile_id, work_date: "2026-09-20")

    rows = list_uc.call(profile_id: profile_id, viewer_profile_id: profile_id, from_date: "2026-09-20", to_date: "2026-09-20")
    expect(rows).to be_empty
  end

  it "rejects a malformed work_date" do
    expect {
      uc.call(profile_id: profile_id, work_date: "not-a-date")
    }.to raise_error(Errors::ValidationError)
  end

  it "deletes the announcement post linked to the schedule" do
    post_repo = Post::Slice["repositories.post_repository"]
    row = save_uc.call(
      profile_id: profile_id, work_date: "2026-10-24", start_time: "20:00", end_time: "02:00",
      announce: true, announce_time: "09:00", announce_note: "hi", now: Time.new(2026, 10, 20, 12, 0, 0, "+09:00")
    )
    expect(post_repo.find_by_id(row[:post_id])).not_to be_nil

    uc.call(profile_id: profile_id, work_date: "2026-10-24")

    expect(post_repo.find_by_id(row[:post_id])).to be_nil
  end

  it "does not fail when the linked post is already gone" do
    post_repo = Post::Slice["repositories.post_repository"]
    row = save_uc.call(
      profile_id: profile_id, work_date: "2026-10-24", start_time: "20:00", end_time: "02:00",
      announce: true, announce_time: "09:00", announce_note: "hi", now: Time.new(2026, 10, 20, 12, 0, 0, "+09:00")
    )
    post_repo.delete_post(row[:post_id])

    expect { uc.call(profile_id: profile_id, work_date: "2026-10-24") }.not_to raise_error
  end
end
