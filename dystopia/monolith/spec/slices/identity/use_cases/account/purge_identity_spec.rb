# frozen_string_literal: true

require "spec_helper"
require "cognito"

RSpec.describe Identity::UseCases::Account::PurgeIdentity do
  let(:use_case) do
    described_class.new(account_repo: account_repo, purge_profiles: purge_profiles, purge_karte: purge_karte)
  end
  let(:account_repo) { double(:account_repository) }
  let(:purge_profiles) { double(:purge_profiles) }
  let(:purge_karte) { double(:purge_karte) }
  let(:sub) { "sub-purge-1" }
  let(:cognito_adapter) { double(:cognito_adapter, admin_delete_user: true) }

  before do
    Cognito.reset!
    Cognito.adapter = cognito_adapter
    allow(purge_profiles).to receive(:call)
    allow(purge_karte).to receive(:call)
    allow(account_repo).to receive(:delete).with(sub)
  end

  after { Cognito.reset! }

  it "purges the account's profiles, then its karte rows, then the Cognito user, then the account" do
    expect(purge_profiles).to receive(:call).with(account_id: sub).ordered
    expect(purge_karte).to receive(:call).with(account_id: sub).ordered
    expect(cognito_adapter).to receive(:admin_delete_user).with(sub: sub).ordered
    expect(account_repo).to receive(:delete).with(sub).ordered

    expect(use_case.call(sub: sub)).to be_nil
  end

  it "keeps the Cognito user and the account when purging the profiles fails" do
    allow(purge_profiles).to receive(:call).and_raise(RuntimeError, "slice failed")
    expect(purge_karte).not_to receive(:call)
    expect(cognito_adapter).not_to receive(:admin_delete_user)
    expect(account_repo).not_to receive(:delete)

    expect { use_case.call(sub: sub) }.to raise_error(RuntimeError, "slice failed")
  end
end
