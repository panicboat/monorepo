# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Account::DeactivateAccount do
  let(:use_case) { described_class.new(repo: repo, cancel_subscriptions: cancel_subscriptions) }
  let(:repo) { double(:account_repository) }
  let(:cancel_subscriptions) { double(:cancel_subscriptions) }
  let(:active_account) { double(:account, deactivated_at: nil) }

  describe "#call" do
    before do
      allow(repo).to receive(:find_by_id).with("sub-1").and_return(active_account)
      allow(repo).to receive(:mark_deactivated)
      allow(cancel_subscriptions).to receive(:call)
    end

    it "cancels the subscriptions at period end, then marks the account as deactivated" do
      expect(cancel_subscriptions).to receive(:call).with(account_id: "sub-1").ordered
      expect(repo).to receive(:mark_deactivated).with("sub-1").ordered
      use_case.call(sub: "sub-1")
    end

    it "returns nil" do
      expect(use_case.call(sub: "sub-1")).to be_nil
    end

    it "does not mark the account as deactivated when cancelling fails" do
      allow(cancel_subscriptions).to receive(:call).and_raise(RuntimeError, "stripe failed")
      expect(repo).not_to receive(:mark_deactivated)

      expect { use_case.call(sub: "sub-1") }.to raise_error(RuntimeError, "stripe failed")
    end

    it "does nothing when the account is already deactivated" do
      allow(repo).to receive(:find_by_id).with("sub-1").and_return(double(:account, deactivated_at: Time.now))
      expect(cancel_subscriptions).not_to receive(:call)
      expect(repo).not_to receive(:mark_deactivated)

      expect(use_case.call(sub: "sub-1")).to be_nil
    end

    it "does nothing when the account does not exist" do
      allow(repo).to receive(:find_by_id).with("sub-1").and_return(nil)
      expect(cancel_subscriptions).not_to receive(:call)
      expect(repo).not_to receive(:mark_deactivated)

      expect(use_case.call(sub: "sub-1")).to be_nil
    end
  end
end
