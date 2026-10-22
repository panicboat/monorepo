# frozen_string_literal: true

require "spec_helper"
require "errors/validation_error"

RSpec.describe "Schedule::UseCases::SaveSchedule", type: :database do
  let(:uc) { Hanami.app.slices[:schedule]["use_cases.save_schedule"] }
  let(:profile_id) { SecureRandom.uuid_v7 }

  it "saves a valid schedule" do
    row = uc.call(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    expect(row[:start_time]).to eq("20:00")
    expect(row[:end_time]).to eq("02:00")
  end

  it "rejects a malformed start_time" do
    expect {
      uc.call(profile_id: profile_id, work_date: "2026-09-20", start_time: "8pm", end_time: "02:00")
    }.to raise_error(Errors::ValidationError)
  end

  it "rejects a malformed work_date" do
    expect {
      uc.call(profile_id: profile_id, work_date: "Sept 20", start_time: "20:00", end_time: "02:00")
    }.to raise_error(Errors::ValidationError)
  end

  it "rejects an impossible work_date with the format message" do
    expect {
      uc.call(profile_id: profile_id, work_date: "2026-13-45", start_time: "20:00", end_time: "02:00")
    }.to raise_error(Errors::ValidationError, "予定日の形式が正しくありません")
  end

  it "rejects an impossible work_date when announcing" do
    expect {
      uc.call(profile_id: profile_id, work_date: "2026-02-30", start_time: "20:00", end_time: "02:00", announce: true, announce_time: "09:00")
    }.to raise_error(Errors::ValidationError, "予定日の形式が正しくありません")
  end

  describe "announcement" do
    let(:post_repo) { Post::Slice["repositories.post_repository"] }
    let(:now) { Time.new(2026, 10, 20, 12, 0, 0, "+09:00") }
    let(:note) { "お待ちしてます！" }

    def jst(*parts)
      Time.new(*parts, 0, "+09:00")
    end

    def save(work_date: "2026-10-24", start_time: "20:00", end_time: "02:00", announce: true, announce_time: "09:00", announce_note: note, now: self.now)
      uc.call(
        profile_id: profile_id, work_date: work_date, start_time: start_time, end_time: end_time,
        announce: announce, announce_time: announce_time, announce_note: announce_note, now: now
      )
    end

    def post_of(row)
      post_repo.find_by_id(row[:post_id])
    end

    def post_count
      Hanami.app["db.gateway"].connection[:post__posts].where(author_profile_id: profile_id).count
    end

    it "creates a public scheduled post with the note, the announcement time and the schedule end" do
      row = save

      post = post_of(row)
      expect(post.author_profile_id).to eq(profile_id)
      expect(post.content).to eq("お待ちしてます！")
      expect(post.visibility).to eq("public")
      expect(post.published_at).to eq(jst(2026, 10, 24, 9, 0))
      expect(post.expires_at).to eq(jst(2026, 10, 25, 2, 0))
    end

    it "ends a same-day schedule on that day" do
      row = save(start_time: "10:00", end_time: "18:00")

      expect(post_of(row).expires_at).to eq(jst(2026, 10, 24, 18, 0))
    end

    it "ends a schedule that starts before 05:00 on the night of its work date" do
      row = save(start_time: "01:00", end_time: "05:00")

      post = post_of(row)
      expect(post.published_at).to eq(jst(2026, 10, 24, 9, 0))
      expect(post.expires_at).to eq(jst(2026, 10, 25, 5, 0))
    end

    it "keeps the post of a schedule that starts before 05:00 until its night ends" do
      row = save(start_time: "01:00", end_time: "05:00", now: jst(2026, 10, 24, 23, 0))

      expect(row[:post_id]).not_to be_nil
      expect(post_count).to eq(1)
    end

    it "does not create a post once the night of a schedule that starts before 05:00 has ended" do
      row = save(start_time: "01:00", end_time: "05:00", now: jst(2026, 10, 25, 5, 0))

      expect(row[:post_id]).to be_nil
      expect(post_count).to eq(0)
    end

    it "strips surrounding whitespace from the note and allows an empty one" do
      expect(post_of(save(announce_note: "  こんばんは \n")).content).to eq("こんばんは")
      expect(post_of(save(work_date: "2026-10-25", announce_note: "")).content).to eq("")
    end

    it "publishes now when the announcement time has already passed" do
      current = jst(2026, 10, 24, 15, 0)
      row = save(now: current)

      expect(post_of(row).published_at).to eq(current)
    end

    it "does not create a post for a day whose schedule has already ended" do
      row = save(work_date: "2026-10-24", now: jst(2026, 10, 25, 2, 0))

      expect(row[:post_id]).to be_nil
      expect(post_count).to eq(0)
    end

    it "rewrites the same post when saved again and keeps one post" do
      first = save
      second = save(end_time: "03:00", announce_note: "変更しました")

      expect(second[:post_id]).to eq(first[:post_id])
      expect(post_count).to eq(1)
      post = post_of(second)
      expect(post.content).to eq("変更しました")
      expect(post.expires_at).to eq(jst(2026, 10, 25, 3, 0))
    end

    it "makes a post public again when it was changed to private" do
      first = save
      post_repo.update_post(first[:post_id], visibility: "private")

      row = save

      expect(row[:post_id]).to eq(first[:post_id])
      expect(post_of(row).visibility).to eq("public")
    end

    it "moves a scheduled post to the new announcement time" do
      save
      row = save(announce_time: "12:00")

      expect(post_of(row).published_at).to eq(jst(2026, 10, 24, 12, 0))
    end

    it "moves a scheduled post to now when the new announcement time has passed" do
      save
      current = jst(2026, 10, 24, 8, 0)
      row = save(announce_time: "07:00", now: current)

      expect(post_of(row).published_at).to eq(current)
    end

    it "keeps published_at of a post that is already showing" do
      save
      current = jst(2026, 10, 24, 21, 0)
      row = save(announce_time: "22:00", now: current)

      expect(post_of(row).published_at).to eq(jst(2026, 10, 24, 9, 0))
      expect(post_count).to eq(1)
    end

    it "rewrites at 01:00 on the day after a schedule that ends at 02:00" do
      first = save(work_date: "2026-10-24")
      row = save(work_date: "2026-10-24", end_time: "03:00", now: jst(2026, 10, 25, 1, 0))

      expect(row[:post_id]).to eq(first[:post_id])
      expect(post_count).to eq(1)
      expect(post_of(row).expires_at).to eq(jst(2026, 10, 25, 3, 0))
    end

    it "deletes the post and clears post_id when the shortened schedule ends before the post began showing" do
      first = save
      row = save(start_time: "08:00", end_time: "09:00", announce_time: "08:30", now: jst(2026, 10, 24, 21, 0))

      expect(row[:post_id]).to be_nil
      expect(post_repo.find_by_id(first[:post_id])).to be_nil
    end

    it "deletes the post and clears post_id when announce is off" do
      first = save
      row = save(announce: false)

      expect(row[:post_id]).to be_nil
      expect(post_repo.find_by_id(first[:post_id])).to be_nil
    end

    it "does nothing when announce is off and there is no post" do
      row = save(announce: false)

      expect(row[:post_id]).to be_nil
      expect(post_count).to eq(0)
    end

    it "recreates the post when the author deleted it" do
      first = save
      post_repo.delete_post(first[:post_id])

      row = save

      expect(row[:post_id]).not_to eq(first[:post_id])
      expect(post_of(row).content).to eq("お待ちしてます！")
      expect(post_count).to eq(1)
    end

    it "keeps one post per day when several days are saved twice" do
      %w[2026-10-24 2026-10-25 2026-10-26].each { |date| save(work_date: date) }
      %w[2026-10-24 2026-10-25 2026-10-26].each { |date| save(work_date: date, announce_note: "again") }

      expect(post_count).to eq(3)
    end

    it "rejects an announcement time at or after the schedule end" do
      expect { save(start_time: "10:00", end_time: "18:00", announce_time: "18:00") }
        .to raise_error(Errors::ValidationError, "お知らせの時刻は予定の終了より前にしてください")
    end

    it "rejects a note longer than 200 characters" do
      expect { save(announce_note: "あ" * 201) }
        .to raise_error(Errors::ValidationError, "ひとことは200文字以内で入力してください")
      expect { save(announce_note: "あ" * 200) }.not_to raise_error
    end

    it "rejects a malformed announcement time" do
      expect { save(announce_time: "9am") }.to raise_error(Errors::ValidationError)
    end

    it "skips announcement validation when announce is off" do
      expect {
        save(announce: false, start_time: "10:00", end_time: "18:00", announce_time: "garbage", announce_note: "あ" * 300)
      }.not_to raise_error
    end
  end
end
