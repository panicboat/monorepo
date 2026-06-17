# frozen_string_literal: true

require "spec_helper"

RSpec.describe Footprints::UseCases::RecordVisit do
  subject(:use_case) { Footprints::Slice["use_cases.record_visit"] }

  let(:visitor) { SecureRandom.uuid_v7 }
  let(:visited) { SecureRandom.uuid_v7 }

  let(:visit_records) { Footprints::Slice["relations.visit_records"] }
  let(:blocks) { Social::Slice["relations.blocks"] }

  before do
    visit_records.dataset.delete
    blocks.dataset.delete
  end

  def insert_block(blocker_id:, blocked_id:)
    blocks.dataset.insert(
      id: SecureRandom.uuid_v7,
      blocker_id: blocker_id,
      blocked_id: blocked_id,
      created_at: Time.now
    )
  end

  it "no-ops when visitor == visited" do
    use_case.call(visitor_id: visitor, visited_id: visitor)
    expect(visit_records.dataset.count).to eq(0)
  end

  it "no-ops when visitor blocks visited" do
    insert_block(blocker_id: visitor, blocked_id: visited)
    use_case.call(visitor_id: visitor, visited_id: visited)
    expect(visit_records.dataset.count).to eq(0)
  end

  it "no-ops when visited blocks visitor" do
    insert_block(blocker_id: visited, blocked_id: visitor)
    use_case.call(visitor_id: visitor, visited_id: visited)
    expect(visit_records.dataset.count).to eq(0)
  end

  it "inserts a row on first visit" do
    use_case.call(visitor_id: visitor, visited_id: visited)
    expect(visit_records.dataset.count).to eq(1)
  end

  it "upserts (single row, last_visited_at refreshed) on second visit" do
    use_case.call(visitor_id: visitor, visited_id: visited)
    row1 = visit_records.dataset.first
    sleep 0.05
    use_case.call(visitor_id: visitor, visited_id: visited)
    rows = visit_records.dataset.all
    expect(rows.size).to eq(1)
    expect(rows.first[:last_visited_at]).to be > row1[:last_visited_at]
    expect(rows.first[:first_visited_at]).to eq(row1[:first_visited_at])
  end
end
