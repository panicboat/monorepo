# frozen_string_literal: true

require "spec_helper"
require "slices/billing/grpc/billing_handler"

RSpec.describe Billing::Grpc::BillingHandler do
  describe "STATUS_MAP" do
    it "maps every status string to a proto enum value" do
      map = described_class.send(:const_get, :STATUS_MAP)
      %w[trialing active incomplete incomplete_expired past_due canceled unpaid paused].each do |status|
        expect(map[status]).not_to be_nil, "missing map entry for #{status}"
      end
    end
  end
end
