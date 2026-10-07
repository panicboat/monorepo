# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::AuthorizeCastAccess do
  let(:use_case) { described_class.new(get_role: get_role, get_my_access: get_my_access_uc) }
  let(:get_role)         { double(:get_role) }
  let(:get_my_access_uc) { double(:get_my_access) }

  let(:viewer_id) { "viewer-1" }

  it "returns true for a cast with billing access on" do
    allow(get_role).to receive(:call).with(profile_id: viewer_id).and_return(2)
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_id).and_return(has_access: true)

    expect(use_case.call(viewer_account_id: viewer_id)).to be(true)
  end

  it "returns false for a guest" do
    allow(get_role).to receive(:call).with(profile_id: viewer_id).and_return(1)
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_id).and_return(has_access: true)

    expect(use_case.call(viewer_account_id: viewer_id)).to be(false)
  end

  it "returns false when the account cannot be found" do
    allow(get_role).to receive(:call).with(profile_id: viewer_id).and_return(nil)
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_id).and_return(has_access: true)

    expect(use_case.call(viewer_account_id: viewer_id)).to be(false)
  end

  it "returns false for a cast with billing access off" do
    allow(get_role).to receive(:call).with(profile_id: viewer_id).and_return(2)
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_id).and_return(has_access: false)

    expect(use_case.call(viewer_account_id: viewer_id)).to be(false)
  end

  it "does not call get_my_access when the role check already fails" do
    allow(get_role).to receive(:call).with(profile_id: viewer_id).and_return(1)
    expect(get_my_access_uc).not_to receive(:call)

    use_case.call(viewer_account_id: viewer_id)
  end
end
