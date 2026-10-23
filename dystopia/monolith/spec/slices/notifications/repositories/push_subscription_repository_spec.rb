# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::Repositories::PushSubscriptionRepository, type: :database do
  let(:repo) { Notifications::Slice["repositories.push_subscription_repository"] }
  let(:account_id) { create_account }
  let(:profile_a) { create_account_with_profile(account_id: account_id) }
  let(:profile_b) { create_account_with_profile(account_id: account_id) }
  let(:endpoint) { "https://fcm.googleapis.com/fcm/send/e1" }

  def upsert(profile_id:, endpoint:, account_id: self.account_id, p256dh: "BKey", auth: "auth")
    repo.upsert(account_id: account_id, profile_id: profile_id, endpoint: endpoint, p256dh: p256dh, auth: auth)
  end

  it "keeps one row per profile on the same endpoint" do
    upsert(profile_id: profile_a, endpoint: endpoint)
    upsert(profile_id: profile_b, endpoint: endpoint)
    upsert(profile_id: profile_b, endpoint: endpoint)

    expect(repo.list_by_profile(profile_a).size).to eq(1)
    expect(repo.list_by_profile(profile_b).size).to eq(1)
  end

  it "removes the rows of another account on the same endpoint" do
    other_account = create_account
    other_profile = create_account_with_profile(account_id: other_account)
    upsert(profile_id: profile_a, endpoint: endpoint)

    upsert(profile_id: other_profile, endpoint: endpoint, account_id: other_account)

    expect(repo.list_by_profile(profile_a)).to be_empty
    expect(repo.list_by_profile(other_profile).size).to eq(1)
  end

  it "updates the keys of every row on the endpoint" do
    upsert(profile_id: profile_a, endpoint: endpoint)
    upsert(profile_id: profile_b, endpoint: endpoint)

    upsert(profile_id: profile_a, endpoint: endpoint, p256dh: "NewKey", auth: "new-auth")

    rows = repo.list_by_profile(profile_a) + repo.list_by_profile(profile_b)
    expect(rows.map(&:p256dh)).to all(eq("NewKey"))
    expect(rows.map(&:auth)).to all(eq("new-auth"))
  end

  it "lists the rows of a profile oldest first" do
    upsert(profile_id: profile_a, endpoint: "https://example.com/1")
    upsert(profile_id: profile_a, endpoint: "https://example.com/2")

    expect(repo.list_by_profile(profile_a).map(&:endpoint)).to eq(["https://example.com/1", "https://example.com/2"])
  end

  it "counts the profiles of the account per endpoint" do
    other_account = create_account
    other_profile = create_account_with_profile(account_id: other_account)
    upsert(profile_id: profile_a, endpoint: "e1")
    upsert(profile_id: profile_b, endpoint: "e1")
    upsert(profile_id: profile_a, endpoint: "e2")
    upsert(profile_id: other_profile, endpoint: "e3", account_id: other_account)

    counts = repo.profile_counts_by_endpoint(account_id: account_id, endpoints: %w[e1 e2 e3])

    expect(counts).to eq("e1" => 2, "e2" => 1)
  end

  it "returns an empty hash when no endpoints are given" do
    expect(repo.profile_counts_by_endpoint(account_id: account_id, endpoints: [])).to eq({})
  end

  it "releases the rows of other accounts on the endpoint and keeps the rest" do
    other_account = create_account
    other_profile = create_account_with_profile(account_id: other_account)
    upsert(profile_id: profile_a, endpoint: "e1")
    upsert(profile_id: profile_a, endpoint: "e3")
    upsert(profile_id: other_profile, endpoint: "e2", account_id: other_account)

    repo.release_endpoint(account_id: other_account, endpoint: "e1")

    expect(repo.list_by_profile(profile_a).map(&:endpoint)).to eq(["e3"])
    expect(repo.list_by_profile(other_profile).map(&:endpoint)).to eq(["e2"])
  end

  it "deletes only the row of the given profile" do
    upsert(profile_id: profile_a, endpoint: endpoint)
    upsert(profile_id: profile_b, endpoint: endpoint)

    repo.delete_for_profile(profile_id: profile_a, endpoint: endpoint)

    expect(repo.list_by_profile(profile_a)).to be_empty
    expect(repo.list_by_profile(profile_b).size).to eq(1)
  end

  it "reports whether the profile is subscribed on the endpoint" do
    upsert(profile_id: profile_a, endpoint: endpoint)

    expect(repo.subscribed?(profile_id: profile_a, endpoint: endpoint)).to be(true)
    expect(repo.subscribed?(profile_id: profile_b, endpoint: endpoint)).to be(false)
    expect(repo.subscribed?(profile_id: profile_a, endpoint: "other")).to be(false)
  end

  it "deletes every row of a profile or of an account" do
    other_account = create_account
    other_profile = create_account_with_profile(account_id: other_account)
    upsert(profile_id: profile_a, endpoint: "e1")
    upsert(profile_id: profile_b, endpoint: "e2")
    upsert(profile_id: other_profile, endpoint: "e3", account_id: other_account)

    repo.delete_by_profile(profile_a)
    expect(repo.list_by_profile(profile_a)).to be_empty
    expect(repo.list_by_profile(profile_b).size).to eq(1)

    repo.delete_by_account(account_id)
    expect(repo.list_by_profile(profile_b)).to be_empty
    expect(repo.list_by_profile(other_profile).size).to eq(1)
  end
end
