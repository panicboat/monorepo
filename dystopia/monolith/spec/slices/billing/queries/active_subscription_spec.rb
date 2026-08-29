# frozen_string_literal: true

require "spec_helper"
require "slices/billing/queries/active_subscription"

RSpec.describe Billing::Queries::ActiveSubscription do
  let(:sub_repo) { double(:subscription_repo) }
  subject(:query) { described_class.new(subscription_repo: sub_repo) }

  it "returns row from find_active_by_account_id" do
    row = double(:sub)
    allow(sub_repo).to receive(:find_active_by_account_id).with("a1").and_return(row)
    expect(query.call("a1")).to be(row)
  end

  it "returns nil when repo returns nil" do
    allow(sub_repo).to receive(:find_active_by_account_id).with("a1").and_return(nil)
    expect(query.call("a1")).to be_nil
  end
end
