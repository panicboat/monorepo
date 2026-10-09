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

  it "deletes only the acting profile's schedule for that date" do
    act_as(cast)
    save("2026-10-20")
    act_as(other_cast)
    save("2026-10-20")

    rpc(:delete_schedule, Schedule::V1::DeleteScheduleRequest.new(work_date: "2026-10-20"))

    expect(schedules_of(other_cast)).to be_empty
    expect(schedules_of(cast)).to eq([[cast, "2026-10-20", "20:00", "02:00"]])
  end
end
