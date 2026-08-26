# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Account::ReactivateAccount do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:account_repository) }

  describe "#call" do
    it "clears deactivated_at and returns the reactivated account" do
      account = double(:account, id: "sub-1")
      expect(repo).to receive(:reactivate).with("sub-1")
      allow(repo).to receive(:find_by_id).with("sub-1").and_return(account)
      expect(use_case.call(sub: "sub-1")).to eq(account)
    end
  end
end
