# frozen_string_literal: true

require "spec_helper"

RSpec.describe Footprints::UseCases::MarkRead do
  subject(:use_case) { Footprints::Slice["use_cases.mark_read"] }

  let(:viewer) { SecureRandom.uuid_v7 }
  let(:read_state_records) { Footprints::Slice["relations.read_state_records"] }

  it "inserts a read_state row when none exists" do
    expect { use_case.call(account_id: viewer) }
      .to change { read_state_records.where(account_id: viewer).count }
      .from(0).to(1)
  end

  it "updates last_read_visit_at on subsequent call" do
    use_case.call(account_id: viewer)
    first = read_state_records.where(account_id: viewer).one[:last_read_visit_at]
    sleep 0.05
    use_case.call(account_id: viewer)
    second = read_state_records.where(account_id: viewer).one[:last_read_visit_at]
    expect(second).to be > first
  end
end
