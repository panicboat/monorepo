# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Account::DeactivateAccount do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:account_repository) }

  describe "#call" do
    it "marks the account as deactivated" do
      expect(repo).to receive(:mark_deactivated).with("sub-1")
      use_case.call(sub: "sub-1")
    end

    it "returns nil" do
      allow(repo).to receive(:mark_deactivated)
      expect(use_case.call(sub: "sub-1")).to be_nil
    end
  end
end
