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

  it "saves the main area with its prefecture" do
    profile = uc.call(profile_id: profile_id, display_name: "Coco", prefecture: "東京都", area: "新宿")

    expect(profile).to have_attributes(prefecture: "東京都", area: "新宿")
  end

  it "drops the area when no prefecture is given" do
    uc.call(profile_id: profile_id, display_name: "Coco", prefecture: "東京都", area: "新宿")

    profile = uc.call(profile_id: profile_id, display_name: "Coco", area: "新宿")

    expect(profile).to have_attributes(prefecture: nil, area: nil)
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

  describe "follow approval" do
    let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
    let(:db) { Hanami.app["db.gateway"].connection }
    let(:cast_profile) { create_account_with_profile(role: 2, username: "gate_cast", follow_approval_required: true, is_private: true) }
    let(:first_requester) { create_account_with_profile(username: "gate_first") }
    let(:second_requester) { create_account_with_profile(username: "gate_second") }

    def request_follow(requester)
      follow_repo.follow(follower_profile_id: requester, followee_profile_id: cast_profile, status: "pending")
    end

    def statuses
      [first_requester, second_requester].map { |id| follow_repo.find(follower_profile_id: id, followee_profile_id: cast_profile).status }
    end

    def approvals
      db[:notifications__notifications].where(type: "follow").select_map([:recipient_profile_id, :actor_count])
    end

    it "persists follow_approval_required" do
      profile = uc.call(profile_id: profile_id, display_name: "Coco", follow_approval_required: true)

      expect(profile.follow_approval_required).to be true
    end

    it "keeps the requests pending and sends nothing when approval is turned off" do
      request_follow(first_requester)
      request_follow(second_requester)

      profile = uc.call(profile_id: cast_profile, display_name: "Gate", is_private: false, follow_approval_required: false)

      expect(profile.follow_approval_required).to be false
      expect(statuses).to eq(%w[pending pending])
      expect(approvals).to be_empty
    end

    it "changes no request when the saved value stays the same" do
      request_follow(first_requester)

      uc.call(profile_id: cast_profile, display_name: "Gate", is_private: true, follow_approval_required: true)

      expect(follow_repo.find(follower_profile_id: first_requester, followee_profile_id: cast_profile).status).to eq("pending")
      expect(approvals).to be_empty
    end

    it "does not approve requests when approval was already off" do
      open_profile = create_account_with_profile(role: 2, username: "gate_open", follow_approval_required: false)
      follow_repo.follow(follower_profile_id: first_requester, followee_profile_id: open_profile, status: "pending")

      uc.call(profile_id: open_profile, display_name: "Open", follow_approval_required: false)

      expect(follow_repo.find(follower_profile_id: first_requester, followee_profile_id: open_profile).status).to eq("pending")
    end
  end
end
