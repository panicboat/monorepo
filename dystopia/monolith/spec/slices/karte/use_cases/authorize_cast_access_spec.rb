# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::AuthorizeCastAccess do
  let(:use_case) { described_class.new(account_repo: account_repo, get_my_access: get_my_access_uc) }
  let(:account_repo)     { double(:account_repository) }
  let(:get_my_access_uc) { double(:get_my_access) }

  let(:viewer_account_id) { "account-1" }

  it "returns true for a cast account with karte access" do
    allow(account_repo).to receive(:find_by_id).with(viewer_account_id).and_return(double(:account, role: 2))
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_account_id).and_return(has_access: true)

    expect(use_case.call(viewer_account_id: viewer_account_id)).to be(true)
  end

  it "returns false for a guest account" do
    allow(account_repo).to receive(:find_by_id).with(viewer_account_id).and_return(double(:account, role: 1))
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_account_id).and_return(has_access: true)

    expect(use_case.call(viewer_account_id: viewer_account_id)).to be(false)
  end

  it "returns false when the account cannot be found" do
    allow(account_repo).to receive(:find_by_id).with(viewer_account_id).and_return(nil)
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_account_id).and_return(has_access: true)

    expect(use_case.call(viewer_account_id: viewer_account_id)).to be(false)
  end

  it "returns false for a cast account without karte access" do
    allow(account_repo).to receive(:find_by_id).with(viewer_account_id).and_return(double(:account, role: 2))
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_account_id).and_return(has_access: false)

    expect(use_case.call(viewer_account_id: viewer_account_id)).to be(false)
  end

  it "does not ask for access when the role check already fails" do
    allow(account_repo).to receive(:find_by_id).with(viewer_account_id).and_return(double(:account, role: 1))
    expect(get_my_access_uc).not_to receive(:call)

    use_case.call(viewer_account_id: viewer_account_id)
  end
end
