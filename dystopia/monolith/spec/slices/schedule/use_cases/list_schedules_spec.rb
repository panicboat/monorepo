# frozen_string_literal: true

require "spec_helper"
require "errors/validation_error"

RSpec.describe "Schedule::UseCases::ListSchedules", type: :database do
  let(:uc) { Hanami.app.slices[:schedule]["use_cases.list_schedules"] }
  let(:save_uc) { Hanami.app.slices[:schedule]["use_cases.save_schedule"] }
  let(:block_repo) { Hanami.app.slices[:social]["repositories.block_repository"] }
  let(:profile_id) { create_account_with_profile(role: 2) }
  let(:viewer_id) { create_account_with_profile }

  def list(viewer_profile_id:)
    uc.call(profile_id: profile_id, viewer_profile_id: viewer_profile_id, from_date: "2026-09-19", to_date: "2026-09-21")
  end

  it "returns rows within the date range" do
    save_uc.call(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")

    rows = uc.call(profile_id: profile_id, viewer_profile_id: profile_id, from_date: "2026-09-19", to_date: "2026-09-21")
    expect(rows.size).to eq(1)
    expect(rows.first.work_date.to_s).to eq("2026-09-20")
  end

  it "rejects a malformed from_date" do
    expect {
      uc.call(profile_id: profile_id, viewer_profile_id: profile_id, from_date: "not-a-date", to_date: "2026-09-20")
    }.to raise_error(Errors::ValidationError)
  end

  describe "block relations" do
    before { save_uc.call(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00") }

    it "returns no rows when the cast blocked the viewer" do
      block_repo.block(blocker_profile_id: profile_id, blocked_profile_id: viewer_id)

      expect(list(viewer_profile_id: viewer_id)).to eq([])
    end

    it "returns no rows when the viewer blocked the cast" do
      block_repo.block(blocker_profile_id: viewer_id, blocked_profile_id: profile_id)

      expect(list(viewer_profile_id: viewer_id)).to eq([])
    end

    it "returns no rows when the viewer profile is unknown" do
      expect(list(viewer_profile_id: nil)).to eq([])
    end

    it "returns the owner's rows even when the owner blocked someone" do
      block_repo.block(blocker_profile_id: profile_id, blocked_profile_id: viewer_id)

      expect(list(viewer_profile_id: profile_id).size).to eq(1)
    end

    it "returns rows to an unrelated viewer" do
      expect(list(viewer_profile_id: viewer_id).size).to eq(1)
    end
  end
end
