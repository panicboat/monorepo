# frozen_string_literal: true

require "spec_helper"
require "errors/validation_error"

RSpec.describe "Schedule::UseCases::SaveSchedule", type: :database do
  let(:uc) { Hanami.app.slices[:schedule]["use_cases.save_schedule"] }
  let(:account_id) { SecureRandom.uuid_v7 }

  it "saves a valid schedule" do
    row = uc.call(account_id: account_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    expect(row[:start_time]).to eq("20:00")
    expect(row[:end_time]).to eq("02:00")
  end

  it "rejects a malformed start_time" do
    expect {
      uc.call(account_id: account_id, work_date: "2026-09-20", start_time: "8pm", end_time: "02:00")
    }.to raise_error(Errors::ValidationError)
  end

  it "rejects a malformed work_date" do
    expect {
      uc.call(account_id: account_id, work_date: "Sept 20", start_time: "20:00", end_time: "02:00")
    }.to raise_error(Errors::ValidationError)
  end
end
