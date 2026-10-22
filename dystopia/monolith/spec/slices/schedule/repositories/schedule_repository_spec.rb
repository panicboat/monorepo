# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Schedule::Repositories::ScheduleRepository", type: :database do
  let(:repo) { Hanami.app.slices[:schedule]["repositories.schedule_repository"] }
  let(:profile_id) { SecureRandom.uuid_v7 }

  it "creates a row on the first upsert for a date" do
    row = repo.upsert(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    expect(row[:profile_id]).to eq(profile_id)
    expect(row[:start_time]).to eq("20:00")
    expect(row[:end_time]).to eq("02:00")
  end

  it "overwrites the same row on a second upsert for the same date" do
    repo.upsert(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    repo.upsert(profile_id: profile_id, work_date: "2026-09-20", start_time: "21:00", end_time: "03:00")

    rows = repo.list(profile_id: profile_id, from_date: "2026-09-20", to_date: "2026-09-20")
    expect(rows.size).to eq(1)
    expect(rows.first.start_time).to eq("21:00")
  end

  it "lists only rows within the given date range" do
    repo.upsert(profile_id: profile_id, work_date: "2026-09-18", start_time: "20:00", end_time: "02:00")
    repo.upsert(profile_id: profile_id, work_date: "2026-09-25", start_time: "20:00", end_time: "02:00")

    rows = repo.list(profile_id: profile_id, from_date: "2026-09-19", to_date: "2026-09-21")
    expect(rows).to be_empty
  end

  it "does not return another profile's rows" do
    other_profile_id = SecureRandom.uuid_v7
    repo.upsert(profile_id: other_profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")

    rows = repo.list(profile_id: profile_id, from_date: "2026-09-20", to_date: "2026-09-20")
    expect(rows).to be_empty
  end

  it "deletes a row, making that date off again" do
    repo.upsert(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    repo.delete(profile_id: profile_id, work_date: "2026-09-20")

    rows = repo.list(profile_id: profile_id, from_date: "2026-09-20", to_date: "2026-09-20")
    expect(rows).to be_empty
  end

  it "deletes all rows for a profile, across dates" do
    repo.upsert(profile_id: profile_id, work_date: "2026-09-18", start_time: "20:00", end_time: "02:00")
    repo.upsert(profile_id: profile_id, work_date: "2026-09-25", start_time: "20:00", end_time: "02:00")

    repo.delete_by_profile(profile_id)

    rows = repo.list(profile_id: profile_id, from_date: "2026-09-01", to_date: "2026-09-30")
    expect(rows).to be_empty
  end

  it "returns a nil post_id from upsert until a post is linked" do
    row = repo.upsert(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    expect(row[:post_id]).to be_nil
  end

  it "keeps the linked post_id when the same date is upserted again" do
    repo.upsert(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    post_id = SecureRandom.uuid_v7
    repo.set_post_id(id: repo.upsert(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")[:id], post_id: post_id)

    row = repo.upsert(profile_id: profile_id, work_date: "2026-09-20", start_time: "21:00", end_time: "03:00")

    expect(row[:post_id]).to eq(post_id)
  end

  it "clears the link when set_post_id is given nil" do
    row = repo.upsert(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    repo.set_post_id(id: row[:id], post_id: SecureRandom.uuid_v7)
    repo.set_post_id(id: row[:id], post_id: nil)

    expect(repo.upsert(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")[:post_id]).to be_nil
  end

  it "rejects two schedules linked to the same post" do
    first = repo.upsert(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    second = repo.upsert(profile_id: profile_id, work_date: "2026-09-21", start_time: "20:00", end_time: "02:00")
    post_id = SecureRandom.uuid_v7
    repo.set_post_id(id: first[:id], post_id: post_id)

    expect { repo.set_post_id(id: second[:id], post_id: post_id) }.to raise_error(Sequel::UniqueConstraintViolation)
  end

  it "allows many schedules without a linked post" do
    repo.upsert(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")

    expect { repo.upsert(profile_id: profile_id, work_date: "2026-09-21", start_time: "20:00", end_time: "02:00") }.not_to raise_error
  end

  it "finds only the schedules linked to the given post ids" do
    linked = repo.upsert(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    repo.upsert(profile_id: profile_id, work_date: "2026-09-21", start_time: "10:00", end_time: "18:00")
    post_id = SecureRandom.uuid_v7
    repo.set_post_id(id: linked[:id], post_id: post_id)

    found = repo.find_by_post_ids(post_ids: [post_id, SecureRandom.uuid_v7])

    expect(found).to eq(post_id => { work_date: "2026-09-20", start_time: "20:00", end_time: "02:00" })
  end

  it "returns an empty hash for no post ids" do
    expect(repo.find_by_post_ids(post_ids: [])).to eq({})
  end

  it "finds a schedule row with its linked post id" do
    row = repo.upsert(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    post_id = SecureRandom.uuid_v7
    repo.set_post_id(id: row[:id], post_id: post_id)

    expect(repo.find(profile_id: profile_id, work_date: "2026-09-20")[:post_id]).to eq(post_id)
  end
end
