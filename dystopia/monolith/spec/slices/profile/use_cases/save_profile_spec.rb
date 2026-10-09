# frozen_string_literal: true

require "spec_helper"
require "errors/validation_error"

RSpec.describe "Profile::UseCases::SaveProfile", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.save_profile"] }
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:cast_repo) { Hanami.app.slices[:profile]["repositories.cast_repository"] }
  let(:account_id) { create_account(role: 1) }
  let(:profile_id) { create_account_with_profile(account_id: account_id, username: "coco_01") }

  it "updates the addressed profile" do
    profile = uc.call(profile_id: profile_id, display_name: "Coco", bio: "hello")

    expect(profile.id).to eq(profile_id)
    expect(profile.display_name).to eq("Coco")
    expect(profile.bio).to eq("hello")
  end

  it "does not touch another profile of the same account" do
    cast_account = create_account(role: 2)
    target = create_account_with_profile(account_id: cast_account, display_name: "Target")
    sibling = create_account_with_profile(account_id: cast_account, display_name: "Sibling")

    uc.call(profile_id: target, display_name: "Renamed")

    expect(repo.find_by_id(sibling).display_name).to eq("Sibling")
  end

  it "returns nil and creates nothing when the profile does not exist" do
    missing = SecureRandom.uuid_v7

    expect(uc.call(profile_id: missing, display_name: "Coco")).to be_nil
    expect(repo.find_by_id(missing)).to be_nil
  end

  it "rejects a missing display_name" do
    expect { uc.call(profile_id: profile_id, display_name: "") }.to raise_error(Errors::ValidationError)
  end

  it "rejects a bio longer than 1000 chars" do
    expect {
      uc.call(profile_id: profile_id, display_name: "Coco", bio: "あ" * 1001)
    }.to raise_error(Errors::ValidationError)
  end

  it "accepts a bio up to 1000 chars" do
    profile = uc.call(profile_id: profile_id, display_name: "Coco", bio: "あ" * 1000)
    expect(profile.bio.length).to eq(1000)
  end

  it "rejects an invalid username format" do
    expect {
      uc.call(profile_id: profile_id, display_name: "Coco", username: "ab")
    }.to raise_error(Errors::ValidationError)
  end

  it "keeps its own username without a conflict" do
    profile = uc.call(profile_id: profile_id, display_name: "Coco", username: "coco_01")
    expect(profile.username).to eq("coco_01")
  end

  it "rejects a username taken by a profile of another account" do
    create_account_with_profile(username: "taken_01")

    expect {
      uc.call(profile_id: profile_id, display_name: "Coco", username: "TAKEN_01")
    }.to raise_error(Errors::ValidationError)
  end

  it "rejects a username taken by another profile of the same account" do
    cast_account = create_account(role: 2)
    create_account_with_profile(account_id: cast_account, username: "persona_a")
    other = create_account_with_profile(account_id: cast_account, username: "persona_b")

    expect {
      uc.call(profile_id: other, display_name: "Coco", username: "persona_a")
    }.to raise_error(Errors::ValidationError)
  end

  it "persists cast extras on the cast row of the addressed profile for a cast account" do
    cast_account = create_account(role: 2)
    cast_profile = create_account_with_profile(account_id: cast_account)
    sibling = create_account_with_profile(account_id: cast_account)

    uc.call(
      profile_id: cast_profile, display_name: "Coco", age: 24, industry: "fuzoku",
      sns_links: { "x" => "https://x.com/coco" },
      body_stats: { "height_cm" => 158, "bust" => 88, "waist" => 58, "hip" => 86, "cup" => "D" }
    )

    cast = cast_repo.find_by_profile_id(cast_profile)
    expect(cast.age).to eq(24)
    expect(cast.industry).to eq("fuzoku")
    expect(cast.sns_links).to eq("x" => "https://x.com/coco")
    expect(cast.body_stats).to eq(
      "height_cm" => 158, "bust" => 88, "waist" => 58, "hip" => 86, "cup" => "D"
    )
    expect(cast_repo.find_by_profile_id(sibling)).to be_nil
  end

  it "does not create a cast row for a guest account" do
    uc.call(profile_id: profile_id, display_name: "Coco", age: 24, body_stats: { "height_cm" => 158 })

    expect(cast_repo.find_by_profile_id(profile_id)).to be_nil
  end
end
