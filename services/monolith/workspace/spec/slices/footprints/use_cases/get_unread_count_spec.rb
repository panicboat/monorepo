# frozen_string_literal: true

require "spec_helper"

RSpec.describe Footprints::UseCases::GetUnreadCount do
  subject(:use_case) { Footprints::Slice["use_cases.get_unread_count"] }

  let(:viewer) { SecureRandom.uuid_v7 }
  let(:visitor) { SecureRandom.uuid_v7 }
  let(:footprints_repo) { Footprints::Slice["repositories.footprints_repository"] }
  let(:read_state_records) { Footprints::Slice["relations.read_state_records"] }

  it "returns 0 when no visits" do
    expect(use_case.call(account_id: viewer)).to eq(0)
  end

  it "counts all visits when no read state exists" do
    footprints_repo.upsert_visit(visitor_id: visitor, visited_id: viewer)
    expect(use_case.call(account_id: viewer)).to eq(1)
  end

  it "uses `>` exclusive boundary: visit at exact last_read_visit_at is read" do
    row = footprints_repo.upsert_visit(visitor_id: visitor, visited_id: viewer)
    # set read state to exactly the visit's last_visited_at
    read_state_records.dataset.insert(
      account_id: viewer,
      last_read_visit_at: row[:last_visited_at],
      created_at: Time.now,
      updated_at: Time.now
    )
    expect(use_case.call(account_id: viewer)).to eq(0)
  end

  it "counts only visits after last_read_visit_at" do
    footprints_repo.upsert_visit(visitor_id: visitor, visited_id: viewer)
    footprints_repo.set_last_read_now(account_id: viewer)
    sleep 0.05
    second_visitor = SecureRandom.uuid_v7
    footprints_repo.upsert_visit(visitor_id: second_visitor, visited_id: viewer)
    expect(use_case.call(account_id: viewer)).to eq(1)
  end
end
