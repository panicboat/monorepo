# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Account::CreateAccount do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:account_repository) }
  let(:sub) { "sub-1" }

  describe "#call" do
    it "creates an account with the given sub and role" do
      account = double(:account, id: sub, role: 2)
      expect(repo).to receive(:create).with(sub: sub, role: 2).and_return(account)
      expect(use_case.call(sub: sub, role: 2)).to eq(account)
    end

    it "raises AccountAlreadyExists on duplicate sub" do
      allow(repo).to receive(:create).and_raise(Sequel::UniqueConstraintViolation)
      expect { use_case.call(sub: sub, role: 1) }.to raise_error(
        Identity::UseCases::Account::CreateAccount::AccountAlreadyExists
      )
    end
  end
end
