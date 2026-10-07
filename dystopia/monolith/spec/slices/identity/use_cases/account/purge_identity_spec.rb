# frozen_string_literal: true

require "spec_helper"
require "cognito"

RSpec.describe Identity::UseCases::Account::PurgeIdentity do
  let(:use_case) do
    described_class.new(
      account_repo: account_repo,
      actor_cascades: [actor_cascade],
      account_cascades: [account_cascade],
      list_profiles: list_profiles
    )
  end
  let(:account_repo) { double(:account_repository) }
  let(:actor_cascade) { double(:actor_cascade) }
  let(:account_cascade) { double(:account_cascade) }
  let(:list_profiles) { double(:list_profiles) }
  let(:sub) { "sub-purge-1" }
  let(:cognito_adapter) { double(:cognito_adapter, admin_delete_user: true) }

  before do
    Cognito.reset!
    Cognito.adapter = cognito_adapter
    allow(list_profiles).to receive(:call).with(account_id: sub)
      .and_return([double(:profile, id: "prof-a"), double(:profile, id: "prof-b")])
    allow(actor_cascade).to receive(:call)
    allow(account_cascade).to receive(:call)
    allow(account_repo).to receive(:delete).with(sub)
  end

  after { Cognito.reset! }

  it "calls each actor cascade once per profile of the account" do
    expect(actor_cascade).to receive(:call).with(account_id: "prof-a")
    expect(actor_cascade).to receive(:call).with(account_id: "prof-b")

    use_case.call(sub: sub)
  end

  it "never calls an actor cascade with the account id" do
    expect(actor_cascade).not_to receive(:call).with(account_id: sub)

    use_case.call(sub: sub)
  end

  it "calls each account cascade once with the account id, after the actor cascades" do
    expect(actor_cascade).to receive(:call).with(account_id: "prof-a").ordered
    expect(actor_cascade).to receive(:call).with(account_id: "prof-b").ordered
    expect(account_cascade).to receive(:call).with(account_id: sub).ordered

    use_case.call(sub: sub)
  end

  it "keeps purging the remaining profiles when one cascade call fails" do
    allow(actor_cascade).to receive(:call).with(account_id: "prof-a").and_raise(StandardError)
    expect(actor_cascade).to receive(:call).with(account_id: "prof-b")
    expect(account_cascade).to receive(:call).with(account_id: sub)

    use_case.call(sub: sub)
  end

  it "deletes the Cognito user before deleting the identity account" do
    expect(cognito_adapter).to receive(:admin_delete_user).with(sub: sub).ordered
    expect(account_repo).to receive(:delete).with(sub).ordered

    use_case.call(sub: sub)
  end

  it "returns nil" do
    expect(use_case.call(sub: sub)).to be_nil
  end
end
