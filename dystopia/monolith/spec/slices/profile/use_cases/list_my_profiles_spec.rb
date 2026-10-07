# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::ListMyProfiles", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.list_my_profiles"] }

  it "returns enabled and disabled profiles of the account and none of other accounts" do
    account_id = create_account(role: 2)
    enabled = create_account_with_profile(account_id: account_id)
    disabled = create_account_with_profile(account_id: account_id, disabled_at: Time.now)
    create_account_with_profile

    expect(uc.call(account_id: account_id).map(&:id)).to contain_exactly(enabled, disabled)
  end

  it "returns an empty list for an account without a profile" do
    expect(uc.call(account_id: create_account)).to eq([])
  end
end
