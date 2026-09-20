# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Schedule::UseCases::DeleteSchedule", type: :database do
  let(:uc) { Hanami.app.slices[:schedule]["use_cases.delete_schedule"] }
  let(:save_uc) { Hanami.app.slices[:schedule]["use_cases.save_schedule"] }
  let(:list_uc) { Hanami.app.slices[:schedule]["use_cases.list_schedules"] }
  let(:account_id) { SecureRandom.uuid_v7 }

  it "removes the row for that date" do
    save_uc.call(account_id: account_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    uc.call(account_id: account_id, work_date: "2026-09-20")

    rows = list_uc.call(account_id: account_id, from_date: "2026-09-20", to_date: "2026-09-20")
    expect(rows).to be_empty
  end
end
