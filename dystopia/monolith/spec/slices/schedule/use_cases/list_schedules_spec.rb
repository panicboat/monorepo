# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Schedule::UseCases::ListSchedules", type: :database do
  let(:uc) { Hanami.app.slices[:schedule]["use_cases.list_schedules"] }
  let(:save_uc) { Hanami.app.slices[:schedule]["use_cases.save_schedule"] }
  let(:account_id) { SecureRandom.uuid_v7 }

  it "returns rows within the date range" do
    save_uc.call(account_id: account_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")

    rows = uc.call(account_id: account_id, from_date: "2026-09-19", to_date: "2026-09-21")
    expect(rows.size).to eq(1)
    expect(rows.first.work_date.to_s).to eq("2026-09-20")
  end
end
