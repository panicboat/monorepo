# frozen_string_literal: true

require "spec_helper"
require "errors/validation_error"

RSpec.describe "Profile::UseCases::SaveProfile", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.save_profile"] }
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:account_id) { SecureRandom.uuid_v7 }

  it "creates a profile with required fields" do
    profile = uc.call(account_id: account_id, display_name: "Coco", username: "coco_01")
    expect(profile.display_name).to eq("Coco")
    expect(profile.username).to eq("coco_01")
  end

  it "rejects a missing display_name" do
    expect { uc.call(account_id: account_id, display_name: "") }.to raise_error(Errors::ValidationError)
  end

  it "rejects a bio longer than 160 chars" do
    expect {
      uc.call(account_id: account_id, display_name: "Coco", bio: "あ" * 161)
    }.to raise_error(Errors::ValidationError)
  end

  it "rejects an invalid username format" do
    expect {
      uc.call(account_id: account_id, display_name: "Coco", username: "ab")
    }.to raise_error(Errors::ValidationError)
  end

  it "rejects a username already taken by another account" do
    repo.create(account_id: SecureRandom.uuid_v7, display_name: "Other", username: "taken_01")
    expect {
      uc.call(account_id: account_id, display_name: "Coco", username: "TAKEN_01")
    }.to raise_error(Errors::ValidationError)
  end

  it "rejects more than two areas" do
    expect {
      uc.call(account_id: account_id, display_name: "Coco",
        area_ids: [SecureRandom.uuid_v7, SecureRandom.uuid_v7, SecureRandom.uuid_v7])
    }.to raise_error(Errors::ValidationError)
  end

  it "persists up to two areas" do
    a1 = SecureRandom.uuid_v7
    a2 = SecureRandom.uuid_v7
    areas = Hanami.app.slices[:profile]["relations.areas"]
    [a1, a2].each_with_index do |id, i|
      areas.changeset(:create, id: id, prefecture: "東京都", name: "e#{i}", code: "c#{i}").commit
    end
    uc.call(account_id: account_id, display_name: "Coco", area_ids: [a1, a2])
    expect(repo.find_area_ids(account_id)).to contain_exactly(a1, a2)
  end
end
