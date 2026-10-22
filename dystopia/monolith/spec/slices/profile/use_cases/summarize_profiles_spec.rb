# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::SummarizeProfiles", type: :database do
  let(:uc) { Profile::Slice["use_cases.summarize_profiles"] }
  let(:db) { Hanami.app["db.gateway"].connection }

  it "summarizes each visible profile with its role and privacy" do
    cast = create_account_with_profile(role: 2, username: "rin", display_name: "りん", is_private: true)
    guest = create_account_with_profile(role: 1, username: "hanako", display_name: "はなこ")

    summaries = uc.call(profile_ids: [cast, guest])

    expect(summaries[cast].to_h).to eq(profile_id: cast, username: "rin", display_name: "りん", avatar_url: "", is_private: true, role: 2, industry: "")
    expect(summaries[guest].to_h).to include(username: "hanako", is_private: false, role: 1)
  end

  it "reads the cast industry in the same query and leaves it empty without a cast" do
    cast = create_account_with_profile(role: 2, username: "with_industry")
    db[:profile__casts].insert(profile_id: cast, industry: "fuzoku")
    guest = create_account_with_profile(username: "no_industry")

    summaries = uc.call(profile_ids: [cast, guest])

    expect(summaries[cast].industry).to eq("fuzoku")
    expect(summaries[guest].industry).to eq("")
  end

  it "fills the avatar url from the media slice" do
    profile = create_account_with_profile(username: "with_avatar")
    media_id = SecureRandom.uuid_v7
    db[:profile__profiles].where(id: profile).update(avatar_media_id: media_id)
    file = Profile::Adapters::MediaAdapter::MediaFile.new(
      id: media_id, url: "https://cdn.example/avatar.png", thumbnail_url: nil, media_type: "image", media_key: "k", thumbnail_key: nil
    )
    media_adapter = instance_double(Profile::Adapters::MediaAdapter)
    allow(media_adapter).to receive(:find_by_ids).with([media_id]).and_return({ media_id => file })

    summaries = Profile::UseCases::SummarizeProfiles.new(media_adapter: media_adapter).call(profile_ids: [profile])

    expect(summaries[profile].avatar_url).to eq("https://cdn.example/avatar.png")
  end

  it "leaves out disabled profiles, deactivated accounts, unknown and malformed ids" do
    disabled = create_account_with_profile(username: "disabled")
    db[:profile__profiles].where(id: disabled).update(disabled_at: Time.now)
    deactivated_account = create_account
    deactivated = create_account_with_profile(account_id: deactivated_account, username: "deactivated")
    db[:identity__accounts].where(id: deactivated_account).update(deactivated_at: Time.now)
    shown = create_account_with_profile(username: "shown")

    summaries = uc.call(profile_ids: [disabled, deactivated, SecureRandom.uuid_v7, "abc", nil, shown, shown])

    expect(summaries.keys).to eq([shown])
  end

  it "returns an empty hash for no ids" do
    expect(uc.call(profile_ids: [])).to eq({})
  end

  it "keeps the order of the given ids and reads the repository once per batch" do
    ids = Array.new(5) { |i| create_account_with_profile(username: "many_#{i}") }.reverse
    repo = Profile::Slice["repositories.profile_repository"]
    allow(repo).to receive(:visible_by_ids).and_call_original
    allow(repo).to receive(:roles_by_account_ids).and_call_original

    summaries = Profile::UseCases::SummarizeProfiles.new(profile_repository: repo).call(profile_ids: ids)

    expect(summaries.keys).to eq(ids)
    expect(repo).to have_received(:visible_by_ids).once
    expect(repo).to have_received(:roles_by_account_ids).once
  end
end
