# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::CheckUsernameAvailability", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.check_username_availability"] }

  it "is available for a fresh valid username" do
    expect(uc.call(username: "fresh_name")[:available]).to be true
  end

  it "is unavailable for an invalid format" do
    expect(uc.call(username: "x")[:available]).to be false
  end

  it "is unavailable when taken (case-insensitive)" do
    create_account_with_profile(username: "dup_name")
    expect(uc.call(username: "DUP_NAME")[:available]).to be false
  end

  it "is available to the profile that already holds the username" do
    profile_id = create_account_with_profile(username: "mine_01")
    expect(uc.call(username: "mine_01", profile_id: profile_id)[:available]).to be true
  end
end
