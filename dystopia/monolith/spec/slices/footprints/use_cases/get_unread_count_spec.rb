# frozen_string_literal: true

require "spec_helper"

RSpec.describe Footprints::UseCases::GetUnreadCount do
  subject(:use_case) { Footprints::Slice["use_cases.get_unread_count"] }

  let(:viewer) { SecureRandom.uuid_v7 }
  let(:visitor) { create_account_with_profile(username: "unread_visitor") }
  let(:footprints_repo) { Footprints::Slice["repositories.footprints_repository"] }
  let(:read_state_records) { Footprints::Slice["relations.read_state_records"] }
  let(:social_blocks) { Social::Slice["relations.blocks"] }
  let(:db) { Hanami.app["db.gateway"].connection }

  def seed_block(blocker:, blocked:)
    social_blocks.dataset.insert(
      id: SecureRandom.uuid_v7,
      blocker_profile_id: blocker,
      blocked_profile_id: blocked,
      created_at: Time.now
    )
  end

  it "returns 0 when no visits" do
    expect(use_case.call(profile_id: viewer)).to eq(0)
  end

  it "counts all visits when no read state exists" do
    footprints_repo.upsert_visit(visitor_profile_id: visitor, visited_profile_id: viewer)
    expect(use_case.call(profile_id: viewer)).to eq(1)
  end

  it "uses `>` exclusive boundary: visit at exact last_read_visit_at is read" do
    row = footprints_repo.upsert_visit(visitor_profile_id: visitor, visited_profile_id: viewer)
    read_state_records.dataset.insert(
      profile_id: viewer,
      last_read_visit_at: row[:last_visited_at],
      created_at: Time.now,
      updated_at: Time.now
    )
    expect(use_case.call(profile_id: viewer)).to eq(0)
  end

  it "counts only visits after last_read_visit_at" do
    footprints_repo.upsert_visit(visitor_profile_id: visitor, visited_profile_id: viewer)
    footprints_repo.set_last_read_now(profile_id: viewer)
    sleep 0.05
    second_visitor = create_account_with_profile(username: "unread_second_visitor")
    footprints_repo.upsert_visit(visitor_profile_id: second_visitor, visited_profile_id: viewer)
    expect(use_case.call(profile_id: viewer)).to eq(1)
  end

  it "does not count visitors blocked by the viewer or visitors who blocked the viewer" do
    blocked_by_viewer = create_account_with_profile(username: "unread_blocked_by_viewer")
    blocker_of_viewer = create_account_with_profile(username: "unread_blocker_of_viewer")
    [blocked_by_viewer, blocker_of_viewer, visitor].each do |visitor_profile_id|
      footprints_repo.upsert_visit(visitor_profile_id: visitor_profile_id, visited_profile_id: viewer)
    end
    seed_block(blocker: viewer, blocked: blocked_by_viewer)
    seed_block(blocker: blocker_of_viewer, blocked: viewer)

    expect(use_case.call(profile_id: viewer)).to eq(1)
  end

  it "does not count visitors whose profile is disabled or whose account is deactivated" do
    disabled = create_account_with_profile(username: "unread_disabled")
    db[:profile__profiles].where(id: disabled).update(disabled_at: Time.now)
    deactivated_account = create_account
    deactivated = create_account_with_profile(account_id: deactivated_account, username: "unread_deactivated")
    db[:identity__accounts].where(id: deactivated_account).update(deactivated_at: Time.now)
    [disabled, deactivated, visitor].each do |visitor_profile_id|
      footprints_repo.upsert_visit(visitor_profile_id: visitor_profile_id, visited_profile_id: viewer)
    end

    expect(use_case.call(profile_id: viewer)).to eq(1)
  end
end
