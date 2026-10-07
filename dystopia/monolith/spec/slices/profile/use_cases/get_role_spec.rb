# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::GetRole", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.get_role"] }

  it "returns the role of the account that owns the profile" do
    expect(uc.call(profile_id: create_account_with_profile(role: 2))).to eq(2)
    expect(uc.call(profile_id: create_account_with_profile(role: 1))).to eq(1)
  end

  it "returns nil when given an account id instead of a profile id" do
    account_id = create_account(role: 2)
    create_account_with_profile(account_id: account_id)

    expect(uc.call(profile_id: account_id)).to be_nil
  end

  it "returns nil for a blank or malformed id" do
    expect(uc.call(profile_id: nil)).to be_nil
    expect(uc.call(profile_id: "viewer-1")).to be_nil
  end
end
