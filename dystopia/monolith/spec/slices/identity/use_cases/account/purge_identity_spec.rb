# frozen_string_literal: true

require "spec_helper"
require "cognito"

RSpec.describe Identity::UseCases::Account::PurgeIdentity do
  let(:use_case) do
    described_class.new(
      account_repo: account_repo,
      cascades: cascades
    )
  end
  let(:account_repo) { double(:account_repository) }
  let(:cascades) { [double(:cascade_profile), double(:cascade_post_comments)] }
  let(:sub) { "sub-purge-1" }
  let(:cognito_adapter) { double(:cognito_adapter, admin_delete_user: true) }

  before do
    Cognito.reset!
    Cognito.adapter = cognito_adapter
    cascades.each { |cascade| allow(cascade).to receive(:call).with(account_id: sub) }
    allow(account_repo).to receive(:delete).with(sub)
  end

  after { Cognito.reset! }

  it "calls each account cascade" do
    cascades.each { |cascade| expect(cascade).to receive(:call).with(account_id: sub) }

    use_case.call(sub: sub)
  end

  it "deletes the identity account before deleting the Cognito user" do
    expect(account_repo).to receive(:delete).with(sub).ordered
    expect(cognito_adapter).to receive(:admin_delete_user).with(sub: sub).ordered

    use_case.call(sub: sub)
  end

  it "returns nil" do
    expect(use_case.call(sub: sub)).to be_nil
  end
end
