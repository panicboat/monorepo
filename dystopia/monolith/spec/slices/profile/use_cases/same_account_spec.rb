# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::SameAccount", type: :database do
  let(:use_case) { Hanami.app.slices[:profile]["use_cases.same_account"] }
  let(:account_id) { create_account(role: 2) }
  let(:first) { create_account_with_profile(account_id: account_id) }
  let(:second) { create_account_with_profile(account_id: account_id) }
  let(:stranger) { create_account_with_profile(role: 2) }

  it "is true for two profiles of one account and for a profile compared with itself" do
    expect(use_case.call(profile_id: first, other_profile_id: second)).to be true
    expect(use_case.call(profile_id: first, other_profile_id: first)).to be true
  end

  it "is false for profiles of different accounts and for a profile that does not exist" do
    expect(use_case.call(profile_id: first, other_profile_id: stranger)).to be false
    expect(use_case.call(profile_id: first, other_profile_id: SecureRandom.uuid_v7)).to be false
    expect(use_case.call(profile_id: SecureRandom.uuid_v7, other_profile_id: SecureRandom.uuid_v7)).to be false
  end
end
