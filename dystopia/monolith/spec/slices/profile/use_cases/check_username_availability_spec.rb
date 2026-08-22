# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::CheckUsernameAvailability", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.check_username_availability"] }
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }

  it "is available for a fresh valid username" do
    expect(uc.call(username: "fresh_name")[:available]).to be true
  end

  it "is unavailable for an invalid format" do
    expect(uc.call(username: "x")[:available]).to be false
  end

  it "is unavailable when taken (case-insensitive)" do
    repo.create(account_id: SecureRandom.uuid_v7, display_name: "X", username: "dup_name")
    expect(uc.call(username: "DUP_NAME")[:available]).to be false
  end
end
