# frozen_string_literal: true

require "spec_helper"
require "cognito"

RSpec.describe Identity::UseCases::Account::PurgeIncompleteSignUps do
  let(:use_case) { described_class.new(account_repo: account_repo, logger: logger) }
  let(:account_repo) { double(:account_repository) }
  let(:logger) { double(:logger, info: nil, error: nil) }
  let(:cognito_adapter) { double(:cognito_adapter) }
  let(:now) { Time.utc(2026, 10, 28, 12, 0, 0) }
  let(:retention) { 24 * 3600 }

  before do
    Cognito.reset!
    Cognito.adapter = cognito_adapter
    allow(account_repo).to receive(:find_by_id).and_return(nil)
    allow(cognito_adapter).to receive(:delete_user).and_return(true)
  end

  after { Cognito.reset! }

  def cognito_user(username:, sub:, status: "UNCONFIRMED", created_at: now - retention - 1)
    Cognito::User.new(username: username, sub: sub, status: status, created_at: created_at)
  end

  def list_users(*users)
    allow(cognito_adapter).to receive(:each_user) { |&block| users.each(&block) }
    users.each { |user| allow(cognito_adapter).to receive(:find_user).with(username: user.username).and_return(user) }
  end

  describe "#call" do
    it "deletes UNCONFIRMED and CONFIRMED users older than 24 hours that have no account row" do
      unconfirmed = cognito_user(username: "a" * 64, sub: "sub-a", status: "UNCONFIRMED")
      confirmed = cognito_user(username: "b" * 64, sub: "sub-b", status: "CONFIRMED")
      list_users(unconfirmed, confirmed)
      expect(cognito_adapter).to receive(:delete_user).with(username: unconfirmed.username)
      expect(cognito_adapter).to receive(:delete_user).with(username: confirmed.username)

      result = use_case.call(now: now)

      expect([result.purged, result.failed_usernames]).to eq([2, []])
    end

    it "keeps a user created exactly 24 hours ago" do
      list_users(cognito_user(username: "a" * 64, sub: "sub-a", created_at: now - retention))
      expect(cognito_adapter).not_to receive(:delete_user)

      result = use_case.call(now: now)

      expect([result.purged, result.failed_usernames]).to eq([0, []])
    end

    it "keeps a user that has an account row" do
      list_users(cognito_user(username: "a" * 64, sub: "sub-a"))
      allow(account_repo).to receive(:find_by_id).with("sub-a").and_return(double(:account, id: "sub-a"))
      expect(cognito_adapter).not_to receive(:delete_user)

      result = use_case.call(now: now)

      expect([result.purged, result.failed_usernames]).to eq([0, []])
    end

    it "keeps a user whose account row appears between the listing and the delete" do
      user = cognito_user(username: "a" * 64, sub: "sub-a")
      list_users(user)
      allow(account_repo).to receive(:find_by_id).with("sub-a").and_return(nil, double(:account, id: "sub-a"))
      expect(cognito_adapter).not_to receive(:delete_user)

      result = use_case.call(now: now)

      expect([result.purged, result.failed_usernames]).to eq([0, []])
    end

    it "keeps a user that was re-created with another sub between the listing and the delete" do
      listed = cognito_user(username: "a" * 64, sub: "sub-old")
      list_users(listed)
      allow(cognito_adapter).to receive(:find_user).with(username: listed.username)
        .and_return(cognito_user(username: listed.username, sub: "sub-new"))
      expect(cognito_adapter).not_to receive(:delete_user)

      result = use_case.call(now: now)

      expect([result.purged, result.failed_usernames]).to eq([0, []])
    end

    it "keeps a user that no longer exists when re-checked" do
      listed = cognito_user(username: "a" * 64, sub: "sub-a")
      list_users(listed)
      allow(cognito_adapter).to receive(:find_user).with(username: listed.username).and_return(nil)
      expect(cognito_adapter).not_to receive(:delete_user)

      result = use_case.call(now: now)

      expect([result.purged, result.failed_usernames]).to eq([0, []])
    end

    it "records a user whose delete fails and goes on to the next user" do
      failing = cognito_user(username: "a" * 64, sub: "sub-a")
      succeeding = cognito_user(username: "b" * 64, sub: "sub-b")
      list_users(failing, succeeding)
      allow(cognito_adapter).to receive(:delete_user).with(username: failing.username).and_raise(RuntimeError, "delete failed")
      expect(cognito_adapter).to receive(:delete_user).with(username: succeeding.username)
      expect(logger).to receive(:error).with(a_string_including("sub-a", "delete failed"))

      result = use_case.call(now: now)

      expect([result.purged, result.failed_usernames]).to eq([1, [failing.username]])
    end

    it "records a user whose re-check fails and goes on to the next user" do
      failing = cognito_user(username: "a" * 64, sub: "sub-a")
      succeeding = cognito_user(username: "b" * 64, sub: "sub-b")
      list_users(failing, succeeding)
      allow(cognito_adapter).to receive(:find_user).with(username: failing.username)
        .and_raise(RuntimeError, "lookup did not finish")
      expect(cognito_adapter).not_to receive(:delete_user).with(username: failing.username)
      expect(cognito_adapter).to receive(:delete_user).with(username: succeeding.username)

      result = use_case.call(now: now)

      expect([result.purged, result.failed_usernames]).to eq([1, [failing.username]])
    end

    it "does not log the username when a user is purged" do
      user = cognito_user(username: "a" * 64, sub: "sub-a")
      list_users(user)
      expect(logger).to receive(:info).with(satisfy { |message| message.include?("sub-a") && !message.include?(user.username) })

      use_case.call(now: now)
    end
  end
end
