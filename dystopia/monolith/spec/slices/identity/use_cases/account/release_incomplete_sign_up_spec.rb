# frozen_string_literal: true

require "spec_helper"
require "cognito"

RSpec.describe Identity::UseCases::Account::ReleaseIncompleteSignUp do
  let(:use_case) { described_class.new(account_repo: account_repo) }
  let(:account_repo) { double(:account_repository) }
  let(:cognito_adapter) { double(:cognito_adapter) }
  let(:username) { "a" * 64 }
  let(:sub) { "sub-release-1" }
  let(:status) { "UNCONFIRMED" }
  let(:cognito_user) { Cognito::User.new(username: username, sub: sub, status: status, created_at: Time.now) }

  before do
    Cognito.reset!
    Cognito.adapter = cognito_adapter
    allow(cognito_adapter).to receive(:find_user).with(username: username).and_return(cognito_user)
    allow(cognito_adapter).to receive(:delete_user)
    allow(account_repo).to receive(:find_by_id).with(sub).and_return(nil)
  end

  after { Cognito.reset! }

  describe "#call" do
    it "returns false without deleting when no Cognito user exists" do
      allow(cognito_adapter).to receive(:find_user).with(username: username).and_return(nil)
      expect(cognito_adapter).not_to receive(:delete_user)

      expect(use_case.call(username: username)).to be(false)
    end

    it "returns false without deleting when the Cognito user has no sub" do
      allow(cognito_adapter).to receive(:find_user).with(username: username)
        .and_return(Cognito::User.new(username: username, sub: nil, status: status, created_at: Time.now))
      expect(cognito_adapter).not_to receive(:delete_user)

      expect(use_case.call(username: username)).to be(false)
    end

    it "deletes an UNCONFIRMED Cognito user that has no account row" do
      expect(cognito_adapter).to receive(:delete_user).with(username: username).and_return(true)

      expect(use_case.call(username: username)).to be(true)
    end

    context "when the Cognito user is CONFIRMED" do
      let(:status) { "CONFIRMED" }

      it "deletes it when it has no account row" do
        expect(cognito_adapter).to receive(:delete_user).with(username: username).and_return(true)

        expect(use_case.call(username: username)).to be(true)
      end

      it "returns false without deleting when it has an account row" do
        allow(account_repo).to receive(:find_by_id).with(sub).and_return(double(:account, id: sub))
        expect(cognito_adapter).not_to receive(:delete_user)

        expect(use_case.call(username: username)).to be(false)
      end
    end

    it "returns false without deleting when an UNCONFIRMED Cognito user has an account row" do
      allow(account_repo).to receive(:find_by_id).with(sub).and_return(double(:account, id: sub))
      expect(cognito_adapter).not_to receive(:delete_user)

      expect(use_case.call(username: username)).to be(false)
    end

    it "propagates a lookup failure instead of reporting the user as missing" do
      allow(cognito_adapter).to receive(:find_user).and_raise(RuntimeError, "lookup failed")
      expect(cognito_adapter).not_to receive(:delete_user)

      expect { use_case.call(username: username) }.to raise_error(RuntimeError, "lookup failed")
    end
  end
end
