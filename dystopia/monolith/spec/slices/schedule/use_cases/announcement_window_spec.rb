# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Schedule::UseCases::AnnouncementWindow" do
  let(:window) { Hanami.app.slices[:schedule]["use_cases.announcement_window"] }
  let(:now) { Time.new(2026, 10, 20, 12, 0, 0, "+09:00") }

  def call(start_time: "20:00", end_time: "02:00", announce_time: "09:00", work_date: "2026-10-24", now: self.now)
    window.call(work_date: work_date, start_time: start_time, end_time: end_time, announce_time: announce_time, now: now)
  end

  it "builds the announcement time on the work date in Asia/Tokyo" do
    expect(call.published_at).to eq(Time.new(2026, 10, 24, 9, 0, 0, "+09:00"))
  end

  it "ends the schedule on the same day when the end time is after the start time" do
    expect(call(start_time: "10:00", end_time: "18:00").expires_at).to eq(Time.new(2026, 10, 24, 18, 0, 0, "+09:00"))
  end

  it "ends the schedule on the next day when the end time is at or before the start time" do
    expect(call.expires_at).to eq(Time.new(2026, 10, 25, 2, 0, 0, "+09:00"))
    expect(call(start_time: "20:00", end_time: "20:00").expires_at).to eq(Time.new(2026, 10, 25, 20, 0, 0, "+09:00"))
  end

  it "moves published_at to now once the announcement time has passed" do
    later = Time.new(2026, 10, 24, 15, 0, 0, "+09:00")
    expect(call(now: later).published_at).to eq(later)
  end

  it "reports whether the schedule has ended" do
    expect(call.ended?).to be(false)
    expect(call(now: Time.new(2026, 10, 25, 1, 0, 0, "+09:00")).ended?).to be(false)
    expect(call(now: Time.new(2026, 10, 25, 2, 0, 0, "+09:00")).ended?).to be(true)
  end

  it "reports an announcement time at or after the schedule end" do
    expect(call(announce_time: "01:59", work_date: "2026-10-24").announce_before_end?).to be(true)
    expect(call(start_time: "10:00", end_time: "18:00", announce_time: "18:00").announce_before_end?).to be(false)
    expect(call(start_time: "10:00", end_time: "18:00", announce_time: "23:00").announce_before_end?).to be(false)
  end
end
