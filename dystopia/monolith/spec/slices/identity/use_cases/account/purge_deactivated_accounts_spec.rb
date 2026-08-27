# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Account::PurgeDeactivatedAccounts do
  let(:use_case) do
    described_class.new(
      account_repo: account_repo,
      purge_identity: purge_identity
    )
  end
  let(:account_repo) { double(:account_repository) }
  let(:purge_identity) { double(:purge_identity) }
  let(:now) { Time.utc(2026, 8, 26, 12, 0, 0) }

  describe "#call" do
    it "purges every account deactivated before the 30-day cutoff" do
      old_a = double(:account, id: "sub-a")
      old_b = double(:account, id: "sub-b")
      cutoff = now - 30 * 24 * 3600
      expect(account_repo).to receive(:deactivated_before).with(cutoff).and_return([old_a, old_b])
      expect(purge_identity).to receive(:call).with(sub: "sub-a")
      expect(purge_identity).to receive(:call).with(sub: "sub-b")

      expect(use_case.call(now: now)).to eq(2)
    end
  end
end
