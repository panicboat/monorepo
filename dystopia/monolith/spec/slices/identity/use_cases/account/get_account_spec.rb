# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Account::GetAccount do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:account_repository) }

  describe "#call" do
    it "returns the account when found" do
      account = double(:account, id: "sub-1", role: 1)
      allow(repo).to receive(:find_by_id).with("sub-1").and_return(account)
      expect(use_case.call(sub: "sub-1")).to eq(account)
    end

    it "returns nil when not found" do
      allow(repo).to receive(:find_by_id).with("missing").and_return(nil)
      expect(use_case.call(sub: "missing")).to be_nil
    end
  end
end
