# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Schedule::Repositories::ScheduleRepository", type: :database do
  let(:repo) { Hanami.app.slices[:schedule]["repositories.schedule_repository"] }
  let(:account_id) { SecureRandom.uuid_v7 }

  it "creates a row on the first upsert for a date" do
    row = repo.upsert(account_id: account_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    expect(row[:account_id]).to eq(account_id)
    expect(row[:start_time]).to eq("20:00")
    expect(row[:end_time]).to eq("02:00")
  end

  it "overwrites the same row on a second upsert for the same date" do
    repo.upsert(account_id: account_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    repo.upsert(account_id: account_id, work_date: "2026-09-20", start_time: "21:00", end_time: "03:00")

    rows = repo.list(account_id: account_id, from_date: "2026-09-20", to_date: "2026-09-20")
    expect(rows.size).to eq(1)
    expect(rows.first.start_time).to eq("21:00")
  end

  it "lists only rows within the given date range" do
    repo.upsert(account_id: account_id, work_date: "2026-09-18", start_time: "20:00", end_time: "02:00")
    repo.upsert(account_id: account_id, work_date: "2026-09-25", start_time: "20:00", end_time: "02:00")

    rows = repo.list(account_id: account_id, from_date: "2026-09-19", to_date: "2026-09-21")
    expect(rows).to be_empty
  end

  it "does not return another account's rows" do
    other_account_id = SecureRandom.uuid_v7
    repo.upsert(account_id: other_account_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")

    rows = repo.list(account_id: account_id, from_date: "2026-09-20", to_date: "2026-09-20")
    expect(rows).to be_empty
  end

  it "deletes a row, making that date off again" do
    repo.upsert(account_id: account_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    repo.delete(account_id: account_id, work_date: "2026-09-20")

    rows = repo.list(account_id: account_id, from_date: "2026-09-20", to_date: "2026-09-20")
    expect(rows).to be_empty
  end

  it "deletes all rows for an account, across dates" do
    repo.upsert(account_id: account_id, work_date: "2026-09-18", start_time: "20:00", end_time: "02:00")
    repo.upsert(account_id: account_id, work_date: "2026-09-25", start_time: "20:00", end_time: "02:00")

    repo.delete_by_account(account_id)

    rows = repo.list(account_id: account_id, from_date: "2026-09-01", to_date: "2026-09-30")
    expect(rows).to be_empty
  end
end
