# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::Adapters::ScheduleAdapter", type: :database do
  let(:adapter) { Post::Adapters::ScheduleAdapter.new }
  let(:schedule_repo) { Schedule::Slice["repositories.schedule_repository"] }

  it "returns the schedules connected to the given posts, keyed by post id" do
    post_id = SecureRandom.uuid_v7
    row = schedule_repo.upsert(profile_id: SecureRandom.uuid_v7, work_date: "2026-10-24", start_time: "20:00", end_time: "02:00")
    schedule_repo.set_post_id(id: row[:id], post_id: post_id)

    expect(adapter.find_by_post_ids([post_id, SecureRandom.uuid_v7])).to eq(post_id => { work_date: "2026-10-24", start_time: "20:00", end_time: "02:00" })
  end

  it "returns an empty hash for no ids" do
    expect(adapter.find_by_post_ids([])).to eq({})
  end
end
