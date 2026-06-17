# frozen_string_literal: true

require "spec_helper"

RSpec.describe Footprints::UseCases::ListFootprints do
  subject(:use_case) { Footprints::Slice["use_cases.list_footprints"] }

  let(:viewer) { SecureRandom.uuid_v7 }
  let(:visitor_a) { SecureRandom.uuid_v7 }
  let(:visitor_b) { SecureRandom.uuid_v7 }

  let(:footprints_repo) { Footprints::Slice["repositories.footprints_repository"] }
  let(:social_blocks) { Social::Slice["relations.blocks"] }

  def record(visitor:, visited:)
    footprints_repo.upsert_visit(visitor_id: visitor, visited_id: visited)
  end

  # Insert a social.blocks row directly (BlockRepository#block has a pre-existing bug).
  def seed_block(blocker:, blocked:)
    social_blocks.dataset.insert(
      id: SecureRandom.uuid_v7,
      blocker_id: blocker,
      blocked_id: blocked,
      created_at: Time.now
    )
  end

  it "returns visits to viewer in last_visited_at DESC order" do
    record(visitor: visitor_a, visited: viewer)
    sleep 0.05
    record(visitor: visitor_b, visited: viewer)

    result = use_case.call(viewer_id: viewer, limit: 20, cursor: nil)

    rows = result[:rows]
    expect(rows.size).to eq(2)
    expect(rows.first[:visitor_id]).to eq(visitor_b)
    expect(rows.last[:visitor_id]).to eq(visitor_a)
  end

  it "excludes blocked visitors (both directions)" do
    record(visitor: visitor_a, visited: viewer)
    record(visitor: visitor_b, visited: viewer)
    seed_block(blocker: viewer, blocked: visitor_a)
    seed_block(blocker: visitor_b, blocked: viewer)

    result = use_case.call(viewer_id: viewer, limit: 20, cursor: nil)
    expect(result[:rows]).to be_empty
  end

  it "tags rows whose last_visited_at > last_read_visit_at as unread" do
    record(visitor: visitor_a, visited: viewer)
    footprints_repo.set_last_read_now(account_id: viewer)
    sleep 0.05
    record(visitor: visitor_b, visited: viewer)

    result = use_case.call(viewer_id: viewer, limit: 20, cursor: nil)
    rows = result[:rows]
    expect(rows.size).to eq(2)
    expect(rows.find { |r| r[:visitor_id] == visitor_b }[:is_unread]).to be true
    expect(rows.find { |r| r[:visitor_id] == visitor_a }[:is_unread]).to be false
  end
end
