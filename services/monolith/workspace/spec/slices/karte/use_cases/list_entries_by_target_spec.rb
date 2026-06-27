# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::ListEntriesByTarget do
  let(:use_case) do
    described_class.new(
      entry_repo: entry_repo,
      access_repo: access_repo,
      get_profile: get_profile_uc,
      media_adapter: media_adapter
    )
  end
  let(:entry_repo)     { double(:entry_repository) }
  let(:access_repo)    { double(:access_repository) }
  let(:get_profile_uc) { double(:get_profile) }
  let(:media_adapter)  { double(:media_adapter) }

  let(:viewer_id) { "viewer-cast-1" }
  let(:target_id) { "target-guest-1" }
  let(:now)       { Time.now }

  let(:entry_flagged) do
    double(:entry,
      id: "e-1",
      author_account_id: "author-1",
      target_account_id: target_id,
      rating: 5,
      body: "flagged entry",
      reported_count: 5,
      created_at: now - 100,
      updated_at: now - 50)
  end

  let(:entry_clean) do
    double(:entry,
      id: "e-2",
      author_account_id: "author-2",
      target_account_id: target_id,
      rating: 3,
      body: "clean entry",
      reported_count: 0,
      created_at: now - 200,
      updated_at: now - 100)
  end

  let(:profile1) { double(:profile, username: "cast1", avatar_media_id: "media-1") }
  let(:profile2) { double(:profile, username: "cast2", avatar_media_id: nil) }
  let(:aggregate) { { count: 2, avg_rating: 4.0 } }

  before do
    allow(access_repo).to receive(:find_by_account).with(viewer_id)
      .and_return(double(:access, account_id: viewer_id))
  end

  it "returns entries with correct flagged values and aggregate" do
    allow(entry_repo).to receive(:list_by_target)
      .with(target_account_id: target_id, limit: 2, cursor: nil)
      .and_return([entry_flagged, entry_clean])
    allow(entry_repo).to receive(:aggregate)
      .with(target_account_id: target_id)
      .and_return(aggregate)

    allow(get_profile_uc).to receive(:call).with(account_id: "author-1").and_return(profile1)
    allow(get_profile_uc).to receive(:call).with(account_id: "author-2").and_return(profile2)
    allow(media_adapter).to receive(:find_url).with("media-1").and_return("https://cdn.example.com/avatar.jpg")

    result = use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, limit: 2)

    expect(result[:entries].length).to eq(2)
    expect(result[:entries][0][:flagged]).to be(true)
    expect(result[:entries][1][:flagged]).to be(false)
    expect(result[:entries][0][:author_username]).to eq("cast1")
    expect(result[:entries][0][:author_avatar_url]).to eq("https://cdn.example.com/avatar.jpg")
    expect(result[:entries][1][:author_avatar_url]).to eq("")
    expect(result[:has_more]).to be(false)
    expect(result[:next_cursor]).to be_nil
    expect(result[:aggregate]).to eq(aggregate)
  end

  it "detects has_more and builds next_cursor when repo returns limit + 1 entries" do
    extra_entry = double(:entry,
      id: "e-3",
      author_account_id: "author-1",
      target_account_id: target_id,
      rating: 4,
      body: "extra",
      reported_count: 0,
      created_at: now - 300,
      updated_at: now - 200)

    allow(entry_repo).to receive(:list_by_target)
      .with(target_account_id: target_id, limit: 2, cursor: nil)
      .and_return([entry_flagged, entry_clean, extra_entry])
    allow(entry_repo).to receive(:aggregate)
      .with(target_account_id: target_id)
      .and_return(aggregate)

    allow(get_profile_uc).to receive(:call).with(account_id: "author-1").and_return(profile1)
    allow(get_profile_uc).to receive(:call).with(account_id: "author-2").and_return(profile2)
    allow(media_adapter).to receive(:find_url).with("media-1").and_return("https://cdn.example.com/avatar.jpg")

    result = use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, limit: 2)

    expect(result[:has_more]).to be(true)
    expect(result[:next_cursor]).not_to be_nil
    expect(result[:entries].length).to eq(2)
  end

  it "rejects when viewer has no karte access" do
    allow(access_repo).to receive(:find_by_account).with(viewer_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id)
    }.to raise_error(Karte::UseCases::ListEntriesByTarget::AccessError)
  end
end
