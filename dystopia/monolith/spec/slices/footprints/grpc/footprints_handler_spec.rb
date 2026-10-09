# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/footprints/grpc/footprints_handler"

RSpec.describe Footprints::Grpc::FootprintsHandler, type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }

  let(:cast) { create_account_with_profile(role: 2, username: "footprint_cast") }
  let(:other_cast) { create_account_with_profile(role: 2, username: "footprint_other_cast") }
  let(:guest) { create_account_with_profile(username: "footprint_guest") }

  def rpc(method, message)
    described_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def visit(profile_id)
    rpc(:record_visit, Footprints::V1::RecordVisitRequest.new(visited_profile_id: profile_id))
  end

  def footprints
    rpc(:list_footprints, Footprints::V1::ListFootprintsRequest.new).footprints
  end

  def unread
    rpc(:get_unread_count, Footprints::V1::GetUnreadCountRequest.new).count
  end

  after { Current.clear }

  it "records a visit from the acting profile to the visited profile" do
    act_as(guest)
    visit(cast)
    visit(cast)

    expect(db[:footprints__visits].select_map([:visitor_profile_id, :visited_profile_id, :visit_count])).to eq([[guest, cast, 2]])
  end

  it "lists the acting profile's visitors with their role and clears the unread state" do
    act_as(guest)
    visit(cast)
    act_as(other_cast)
    visit(cast)

    act_as(cast)
    expect(footprints.map { |f| [f.visitor.id, f.visitor.role, f.is_unread, f.visit_count] }).to eq([[other_cast, 2, true, 1], [guest, 1, true, 1]])
    expect(unread).to eq(2)

    rpc(:mark_read, Footprints::V1::MarkReadRequest.new)

    expect(db[:footprints__read_states].select_map(:profile_id)).to eq([cast])
    expect(unread).to eq(0)
    expect(footprints.map(&:is_unread)).to eq([false, false])

    act_as(guest)
    expect(footprints).to be_empty
    expect(unread).to eq(0)
  end

  it "keeps one profile's read state from clearing another profile's unread footprints" do
    act_as(guest)
    visit(cast)
    act_as(other_cast)
    rpc(:mark_read, Footprints::V1::MarkReadRequest.new)

    act_as(cast)
    expect(unread).to eq(1)
    expect(footprints.map(&:is_unread)).to eq([true])

    rpc(:mark_read, Footprints::V1::MarkReadRequest.new)

    expect(db[:footprints__read_states].select_order_map(:profile_id)).to eq([cast, other_cast].sort)
    expect(unread).to eq(0)
  end

  it "decides whether to record a visit from the visitor's setting, not the visited profile's" do
    get_preferences = Notifications::Slice["use_cases.get_preferences"]
    update_preferences = Notifications::Slice["use_cases.update_preferences"]
    [guest, cast].each do |profile_id|
      update_preferences.call(profile_id: profile_id, preferences: get_preferences.call(profile_id: profile_id).merge(footprints_record_my_visits: false))
    end

    act_as(guest)
    visit(cast)
    act_as(other_cast)
    visit(cast)

    expect(db[:footprints__visits].select_map(:visitor_profile_id)).to eq([other_cast])
  end
end
