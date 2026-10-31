# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/schedule/grpc/schedule_handler"

RSpec.describe Schedule::Grpc::ScheduleHandler, type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }

  let(:cast) { create_account_with_profile(role: 2, username: "schedule_cast") }
  let(:other_cast) { create_account_with_profile(role: 2, username: "schedule_other_cast") }
  let(:guest) { create_account_with_profile(username: "schedule_guest") }

  def rpc(method, message)
    described_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def save(work_date)
    rpc(:save_schedule, Schedule::V1::SaveScheduleRequest.new(work_date: work_date, start_time: "20:00", end_time: "02:00")).schedule
  end

  def schedules_of(profile_id)
    request = Schedule::V1::ListSchedulesRequest.new(profile_id: profile_id, from_date: "2026-10-01", to_date: "2026-10-31")
    rpc(:list_schedules, request).schedules.map { |s| [s.profile_id, s.work_date, s.start_time, s.end_time] }
  end

  after { Current.clear }

  it "saves a schedule under the acting profile and lists it by profile id for any viewer" do
    act_as(cast)
    saved = save("2026-10-20")

    expect(saved.profile_id).to eq(cast)
    expect(db[:schedule__schedules].select_map(:profile_id)).to eq([cast])

    act_as(guest)
    expect(schedules_of(cast)).to eq([[cast, "2026-10-20", "20:00", "02:00"]])
    expect(schedules_of(other_cast)).to be_empty
  end

  it "lists nothing for a viewer in a block relation with the cast" do
    act_as(cast)
    save("2026-10-20")
    Social::Slice["repositories.block_repository"].block(blocker_profile_id: cast, blocked_profile_id: guest)

    act_as(guest)
    expect(schedules_of(cast)).to be_empty
    act_as(cast)
    expect(schedules_of(cast)).to eq([[cast, "2026-10-20", "20:00", "02:00"]])
  end

  it "sets hidden_by_lock on the response for a viewer who cannot pass" do
    locked_cast = create_account_with_profile(role: 2, username: "schedule_locked_cast", is_private: true)
    act_as(locked_cast)
    save("2026-10-20")
    request = Schedule::V1::ListSchedulesRequest.new(profile_id: locked_cast, from_date: "2026-10-01", to_date: "2026-10-31")

    act_as(guest)
    response = rpc(:list_schedules, request)
    expect(response.schedules).to be_empty
    expect(response.hidden_by_lock).to be(true)

    Social::Slice["repositories.follow_repository"].follow(follower_profile_id: guest, followee_profile_id: locked_cast, status: "approved")
    response = rpc(:list_schedules, request)
    expect(response.schedules.size).to eq(1)
    expect(response.hidden_by_lock).to be(false)
  end

  it "deletes only the acting profile's schedule for that date" do
    act_as(cast)
    save("2026-10-20")
    act_as(other_cast)
    save("2026-10-20")

    rpc(:delete_schedule, Schedule::V1::DeleteScheduleRequest.new(work_date: "2026-10-20"))

    expect(schedules_of(other_cast)).to be_empty
    expect(schedules_of(cast)).to eq([[cast, "2026-10-20", "20:00", "02:00"]])
  end

  describe "a guest account" do
    def expect_permission_denied(&block)
      expect(&block).to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::PERMISSION_DENIED)
        expect(e.details).to eq("キャストだけが予定を登録できます")
      }
    end

    it "refuses to save a schedule" do
      act_as(guest)

      expect_permission_denied { save("2026-10-20") }
      expect(db[:schedule__schedules].count).to eq(0)
    end

    it "refuses to save an announced schedule without creating a post" do
      act_as(guest)
      request = Schedule::V1::SaveScheduleRequest.new(
        work_date: "2099-10-24", start_time: "20:00", end_time: "02:00", announce: true, announce_time: "09:00", announce_note: "hi"
      )

      expect_permission_denied { rpc(:save_schedule, request) }
      expect(db[:schedule__schedules].count).to eq(0)
      expect(db[:post__posts].where(author_profile_id: guest).count).to eq(0)
    end

    it "refuses to delete a schedule" do
      act_as(cast)
      save("2026-10-20")
      act_as(guest)

      expect_permission_denied { rpc(:delete_schedule, Schedule::V1::DeleteScheduleRequest.new(work_date: "2026-10-20")) }
      expect(db[:schedule__schedules].select_map(:profile_id)).to eq([cast])
    end
  end

  describe "announcement" do
    let(:post_repo) { Post::Slice["repositories.post_repository"] }

    def announce(work_date, **attrs)
      request = Schedule::V1::SaveScheduleRequest.new(
        work_date: work_date, start_time: "20:00", end_time: "02:00", announce: true, announce_time: "09:00", announce_note: "hi", **attrs
      )
      rpc(:save_schedule, request)
    end

    def invalid_argument_message
      yield
      nil
    rescue GRPC::BadStatus => e
      [e.code, e.details]
    end

    it "creates a public post for a future work date and removes it when the schedule is deleted" do
      act_as(cast)
      announce("2099-10-24")

      post = db[:post__posts].where(author_profile_id: cast).first
      expect(post[:content]).to eq("hi")
      expect(post[:visibility]).to eq("public")

      rpc(:delete_schedule, Schedule::V1::DeleteScheduleRequest.new(work_date: "2099-10-24"))
      expect(db[:post__posts].where(author_profile_id: cast).count).to eq(0)
    end

    it "answers INVALID_ARGUMENT when the announcement time is not before the schedule end" do
      act_as(cast)
      request = Schedule::V1::SaveScheduleRequest.new(work_date: "2099-10-24", start_time: "10:00", end_time: "18:00", announce: true, announce_time: "18:00")

      expect(invalid_argument_message { rpc(:save_schedule, request) })
        .to eq([GRPC::Core::StatusCodes::INVALID_ARGUMENT, "お知らせの時刻は予定の終了より前にしてください"])
    end

    it "answers INVALID_ARGUMENT when the note exceeds 200 characters" do
      act_as(cast)

      expect(invalid_argument_message { announce("2099-10-24", announce_note: "あ" * 201) })
        .to eq([GRPC::Core::StatusCodes::INVALID_ARGUMENT, "ひとことは200文字以内で入力してください"])
    end

    it "does not validate the announcement fields when announce is off" do
      act_as(cast)
      request = Schedule::V1::SaveScheduleRequest.new(work_date: "2099-10-24", start_time: "10:00", end_time: "18:00", announce: false, announce_time: "18:00", announce_note: "あ" * 300)

      expect { rpc(:save_schedule, request) }.not_to raise_error
      expect(db[:post__posts].where(author_profile_id: cast).count).to eq(0)
    end
  end
end
