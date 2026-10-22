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

  describe "#search" do
    let(:work_date) { Date.new(2026, 10, 22) }

    def add(start_time, end_time = "23:00", date: "2026-10-22", profile: SecureRandom.uuid_v7)
      repo.upsert(profile_id: profile, work_date: date, start_time: start_time, end_time: end_time)
      profile
    end

    def search(profile_ids:, time_band: "", limit: 20, cursor: nil)
      repo.search(work_date: work_date, time_band: time_band, profile_ids: profile_ids, limit: limit, cursor: cursor)
    end

    def cursor_after(row)
      { start_time: row[:start_time], profile_id: row[:profile_id] }
    end

    def pages(profile_ids:, limit:)
      cursor = nil
      pages = []
      loop do
        rows = search(profile_ids: profile_ids, limit: limit, cursor: cursor)
        page = rows.first(limit)
        pages << page
        break if rows.size <= limit

        cursor = cursor_after(page.last)
      end
      pages
    end

    it "returns only the given profiles' schedules on the given date" do
      mine = add("20:00")
      add("20:00", profile: SecureRandom.uuid_v7)
      add("20:00", date: "2026-10-23", profile: mine)

      rows = search(profile_ids: [mine])

      expect(rows.map { |row| [row[:profile_id], row[:work_date]] }).to eq([[mine, work_date]])
    end

    it "returns the stored columns of each schedule" do
      profile = add("20:00")
      post_id = SecureRandom.uuid_v7
      repo.set_post_id(id: repo.find(profile_id: profile, work_date: "2026-10-22")[:id], post_id: post_id)

      row = search(profile_ids: [profile]).first

      expect(row).to include(profile_id: profile, start_time: "20:00", end_time: "23:00", post_id: post_id)
    end

    it "returns nothing for no profile ids" do
      add("20:00")

      expect(search(profile_ids: [])).to eq([])
    end

    {
      %w[16:00 22:00] => %w[day evening night],
      %w[20:00 02:00] => %w[evening night],
      %w[18:00 20:59] => %w[evening],
      %w[12:00 18:00] => %w[day],
      %w[17:59 18:01] => %w[day evening],
      %w[20:59 21:00] => %w[evening],
      %w[21:00 23:00] => %w[night],
      %w[05:00 10:00] => %w[day],
      %w[01:00 05:00] => %w[night],
      %w[04:00 06:00] => %w[night]
    }.each do |(start_time, end_time), bands|
      it "finds #{start_time}〜#{end_time} in the #{bands.join(", ")} bands only" do
        profile = add(start_time, end_time)

        found = %w[day evening night].select { |band| search(profile_ids: [profile], time_band: band).any? }

        expect(found).to eq(bands)
      end
    end

    it "returns every start time for an empty time band" do
      profiles = %w[04:59 05:00 21:00].map { |start_time| add(start_time) }

      expect(search(profile_ids: profiles, time_band: "").size).to eq(3)
    end

    it "rejects an unknown time band" do
      expect { search(profile_ids: [add("20:00")], time_band: "noon") }.to raise_error(ArgumentError)
    end

    it "orders by start time with the small hours after 23:59, then by profile id" do
      late = add("22:00")
      tied = [add("23:30"), add("23:30")].sort
      small = add("00:30")
      dawn = add("04:00")
      day = add("05:00")
      early = add("09:00")

      rows = search(profile_ids: [late, *tied, small, dawn, day, early])

      expect(rows.map { |row| [row[:start_time], row[:profile_id]] }).to eq([
        ["05:00", day], ["09:00", early], ["22:00", late], ["23:30", tied[0]], ["23:30", tied[1]], ["00:30", small], ["04:00", dawn]
      ])
    end

    [1, 2, 3].each do |limit|
      it "pages through the night starts in order without repeats or gaps, #{limit} at a time" do
        profiles = %w[22:00 23:30 00:30 04:00].map { |start_time| add(start_time) }
        expected = %w[22:00 23:30 00:30 04:00].each_slice(limit).to_a

        expect(pages(profile_ids: profiles, limit: limit).map { |page| page.map { |row| row[:start_time] } }).to eq(expected)
      end
    end

    it "pages through schedules that share a start time without repeats or gaps" do
      profiles = Array.new(3) { add("22:00") }.sort

      found = pages(profile_ids: profiles, limit: 1).flatten.map { |row| row[:profile_id] }

      expect(found).to eq(profiles)
    end
  end
end
