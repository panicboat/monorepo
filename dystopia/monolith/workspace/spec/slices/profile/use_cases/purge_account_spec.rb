# frozen_string_literal: true

require "spec_helper"

RSpec.describe Profile::UseCases::PurgeAccount do
  let(:use_case) { described_class.new(profile_repo: profile_repo) }
  let(:profile_repo) { double(:profile_repository) }

  it "deletes profile_areas first, then the profile row" do
    expect(profile_repo).to receive(:delete_profile_areas_by_account).with("cast-1").ordered
    expect(profile_repo).to receive(:delete_by_account).with("cast-1").ordered
    use_case.call(account_id: "cast-1")
  end

  it "returns nil" do
    allow(profile_repo).to receive(:delete_profile_areas_by_account)
    allow(profile_repo).to receive(:delete_by_account)
    expect(use_case.call(account_id: "cast-1")).to be_nil
  end
end
