# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::GetProfile", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.get_profile"] }

  it "finds a profile by its id" do
    profile_id = create_account_with_profile(username: "coco_u")
    expect(uc.call(profile_id: profile_id).username).to eq("coco_u")
  end

  it "returns nil for a blank id" do
    expect(uc.call(profile_id: nil)).to be_nil
    expect(uc.call(profile_id: "")).to be_nil
  end
end
