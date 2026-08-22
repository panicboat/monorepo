# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::GetProfileByUsername", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.get_profile_by_username"] }
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }

  it "finds by username case-insensitively" do
    id = SecureRandom.uuid_v7
    repo.create(account_id: id, display_name: "Coco", username: "coco_u")
    expect(uc.call(username: "COCO_U").account_id).to eq(id)
  end

  it "returns nil for an unknown username" do
    expect(uc.call(username: "nobody_here")).to be_nil
  end
end
