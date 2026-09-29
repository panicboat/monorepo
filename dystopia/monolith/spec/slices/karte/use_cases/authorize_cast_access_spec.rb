# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::AuthorizeCastAccess do
  let(:use_case) { described_class.new(user_repo: user_repo, get_my_access: get_my_access_uc) }
  let(:user_repo)        { double(:user_repository) }
  let(:get_my_access_uc) { double(:get_my_access) }

  let(:viewer_id) { "viewer-1" }

  it "returns true for a cast with billing access on" do
    allow(user_repo).to receive(:find_by_id).with(viewer_id).and_return(double(:user, role: 2))
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_id).and_return(has_access: true)

    expect(use_case.call(viewer_account_id: viewer_id)).to be(true)
  end

  it "returns false for a guest" do
    allow(user_repo).to receive(:find_by_id).with(viewer_id).and_return(double(:user, role: 1))
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_id).and_return(has_access: true)

    expect(use_case.call(viewer_account_id: viewer_id)).to be(false)
  end

  it "returns false when the account cannot be found" do
    allow(user_repo).to receive(:find_by_id).with(viewer_id).and_return(nil)
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_id).and_return(has_access: true)

    expect(use_case.call(viewer_account_id: viewer_id)).to be(false)
  end

  it "returns false for a cast with billing access off" do
    allow(user_repo).to receive(:find_by_id).with(viewer_id).and_return(double(:user, role: 2))
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_id).and_return(has_access: false)

    expect(use_case.call(viewer_account_id: viewer_id)).to be(false)
  end

  it "does not call get_my_access when the role check already fails" do
    allow(user_repo).to receive(:find_by_id).with(viewer_id).and_return(double(:user, role: 1))
    expect(get_my_access_uc).not_to receive(:call)

    use_case.call(viewer_account_id: viewer_id)
  end
end
