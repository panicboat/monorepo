# frozen_string_literal: true

require "spec_helper"
require "cognito"

RSpec.describe Identity::UseCases::Account::PurgeIdentity do
  let(:use_case) do
    described_class.new(
      account_repo: account_repo,
      purge_profiles: purge_profiles,
      purge_push_subscriptions: purge_push_subscriptions,
      purge_billing: purge_billing
    )
  end
  let(:account_repo) { double(:account_repository) }
  let(:purge_profiles) { double(:purge_profiles) }
  let(:purge_push_subscriptions) { double(:purge_push_subscriptions) }
  let(:purge_billing) { double(:purge_billing) }
  let(:sub) { "sub-purge-1" }
  let(:cognito_adapter) { double(:cognito_adapter, admin_delete_user: true) }

  before do
    Cognito.reset!
    Cognito.adapter = cognito_adapter
    allow(purge_profiles).to receive(:call)
    allow(purge_push_subscriptions).to receive(:call)
    allow(purge_billing).to receive(:call)
    allow(account_repo).to receive(:delete).with(sub)
  end

  after { Cognito.reset! }

  it "purges the account's profiles, push subscriptions and billing, then the Cognito user, then the account" do
    expect(purge_profiles).to receive(:call).with(account_id: sub).ordered
    expect(purge_push_subscriptions).to receive(:call).with(account_id: sub).ordered
    expect(purge_billing).to receive(:call).with(account_id: sub).ordered
    expect(cognito_adapter).to receive(:admin_delete_user).with(sub: sub).ordered
    expect(account_repo).to receive(:delete).with(sub).ordered

    expect(use_case.call(sub: sub)).to be_nil
  end

  it "keeps the account when deleting the Cognito user fails" do
    allow(cognito_adapter).to receive(:admin_delete_user).and_raise(RuntimeError, "cognito failed")
    expect(account_repo).not_to receive(:delete)

    expect { use_case.call(sub: sub) }.to raise_error(RuntimeError, "cognito failed")
  end

  it "keeps the Cognito user and the account when purging billing fails" do
    allow(purge_billing).to receive(:call).and_raise(RuntimeError, "stripe failed")
    expect(cognito_adapter).not_to receive(:admin_delete_user)
    expect(account_repo).not_to receive(:delete)

    expect { use_case.call(sub: sub) }.to raise_error(RuntimeError, "stripe failed")
  end

  it "keeps the Cognito user and the account when purging the profiles fails" do
    allow(purge_profiles).to receive(:call).and_raise(RuntimeError, "slice failed")
    expect(cognito_adapter).not_to receive(:admin_delete_user)
    expect(account_repo).not_to receive(:delete)

    expect { use_case.call(sub: sub) }.to raise_error(RuntimeError, "slice failed")
  end
end
