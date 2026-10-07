# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::GetProfileByUsername", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.get_profile_by_username"] }

  it "finds by username case-insensitively" do
    profile_id = create_account_with_profile(username: "coco_u")
    expect(uc.call(username: "COCO_U").id).to eq(profile_id)
  end

  it "returns nil for an unknown username" do
    expect(uc.call(username: "nobody_here")).to be_nil
  end
end
