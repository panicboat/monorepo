# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::ListRecentEntries do
  let(:use_case) do
    described_class.new(
      entry_repo: entry_repo,
      authorize_cast_access: authorize_cast_access,
      get_profile: get_profile_uc,
      media_adapter: media_adapter
    )
  end
  let(:entry_repo)            { double(:entry_repository) }
  let(:authorize_cast_access) { double(:authorize_cast_access) }
  let(:get_profile_uc)        { double(:get_profile) }
  let(:media_adapter)         { double(:media_adapter) }

  let(:viewer_id) { "viewer-cast-1" }
  let(:now)       { Time.now }

  let(:entry_flagged) do
    double(:entry,
      id: "e-1",
      author_account_id: "author-1",
      target_account_id: "target-1",
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
      target_account_id: "target-2",
      rating: 3,
      body: "clean entry",
      reported_count: 0,
      created_at: now - 200,
      updated_at: now - 100)
  end

  let(:profile1) { double(:profile, username: "cast1", avatar_media_id: "media-1") }
  let(:profile2) { double(:profile, username: "cast2", avatar_media_id: nil) }
  let(:target_profile1) { double(:profile, username: "guest1", avatar_media_id: nil) }
  let(:target_profile2) { double(:profile, username: "guest2", avatar_media_id: nil) }

  before do
    allow(authorize_cast_access).to receive(:call).with(viewer_account_id: viewer_id).and_return(true)
  end

  it "returns entries across authors when the viewer is a cast" do
    allow(entry_repo).to receive(:list_recent).with(limit: 2, cursor: nil)
      .and_return([entry_flagged, entry_clean])
    allow(get_profile_uc).to receive(:call).with(account_id: "author-1").and_return(profile1)
    allow(get_profile_uc).to receive(:call).with(account_id: "author-2").and_return(profile2)
    allow(get_profile_uc).to receive(:call).with(account_id: "target-1").and_return(target_profile1)
    allow(get_profile_uc).to receive(:call).with(account_id: "target-2").and_return(target_profile2)
    allow(media_adapter).to receive(:find_url).with("media-1").and_return("https://cdn.example.com/avatar.jpg")

    result = use_case.call(viewer_account_id: viewer_id, limit: 2)

    expect(result[:entries].length).to eq(2)
    expect(result[:entries][0][:flagged]).to be(true)
    expect(result[:entries][1][:flagged]).to be(false)
    expect(result[:entries][0][:author_username]).to eq("cast1")
    expect(result[:entries][0][:target_username]).to eq("guest1")
    expect(result[:has_more]).to be(false)
    expect(result[:next_cursor]).to be_nil
  end

  it "delegates the cast/billing check to AuthorizeCastAccess and rejects when it fails" do
    allow(authorize_cast_access).to receive(:call).with(viewer_account_id: viewer_id).and_return(false)
    expect {
      use_case.call(viewer_account_id: viewer_id)
    }.to raise_error(Karte::UseCases::ListRecentEntries::AccessError)
  end

  it "sets has_more and next_cursor when the repo returns limit + 1 rows" do
    extra_entry = double(:entry,
      id: "e-3",
      author_account_id: "author-1",
      target_account_id: "target-1",
      rating: 4,
      body: "extra",
      reported_count: 0,
      created_at: now - 300,
      updated_at: now - 200)

    allow(entry_repo).to receive(:list_recent).with(limit: 2, cursor: nil)
      .and_return([entry_flagged, entry_clean, extra_entry])
    allow(get_profile_uc).to receive(:call).with(account_id: "author-1").and_return(profile1)
    allow(get_profile_uc).to receive(:call).with(account_id: "author-2").and_return(profile2)
    allow(get_profile_uc).to receive(:call).with(account_id: "target-1").and_return(target_profile1)
    allow(get_profile_uc).to receive(:call).with(account_id: "target-2").and_return(target_profile2)
    allow(media_adapter).to receive(:find_url).with("media-1").and_return("https://cdn.example.com/avatar.jpg")

    result = use_case.call(viewer_account_id: viewer_id, limit: 2)

    expect(result[:has_more]).to be(true)
    expect(result[:next_cursor]).not_to be_nil
    expect(result[:entries].length).to eq(2)
  end

  it "returns entries after a cursor when timestamps differ only by microseconds" do
    base_time = Time.utc(2026, 1, 1, 0, 0, 0)
    all_entries = [
      double(:entry, id: "e-1", author_account_id: "author-1", target_account_id: "target-1",
        rating: 5, body: "newest", reported_count: 0, created_at: base_time + 0.900_000, updated_at: base_time),
      double(:entry, id: "e-2", author_account_id: "author-2", target_account_id: "target-2",
        rating: 4, body: "middle", reported_count: 0, created_at: base_time + 0.800_000, updated_at: base_time),
      double(:entry, id: "e-3", author_account_id: "author-3", target_account_id: "target-3",
        rating: 3, body: "oldest", reported_count: 0, created_at: base_time + 0.700_000, updated_at: base_time)
    ]
    allow(entry_repo).to receive(:list_recent) do |limit:, cursor:|
      decoded = use_case.send(:decode_cursor, cursor)
      page = if decoded
        all_entries.select do |entry|
          entry.created_at < decoded[:created_at] ||
            (entry.created_at == decoded[:created_at] && entry.id < decoded[:id])
        end
      else
        all_entries
      end
      page.first(limit + 1)
    end
    allow(get_profile_uc).to receive(:call) do |account_id:|
      double(:profile, username: account_id, avatar_media_id: nil)
    end

    first_page = use_case.call(viewer_account_id: viewer_id, limit: 2)
    second_page = use_case.call(viewer_account_id: viewer_id, limit: 2, cursor: first_page[:next_cursor])

    expect(first_page[:next_cursor]).not_to be_nil
    expect(second_page[:entries].map { |entry| entry[:id] }).to eq(["e-3"])
  end

  it "caps a large limit before querying the repository" do
    expect(entry_repo).to receive(:list_recent).with(limit: 100, cursor: nil).and_return([])

    result = use_case.call(viewer_account_id: viewer_id, limit: 10_000)

    expect(result[:entries]).to eq([])
  end

  it "clamps a negative limit to one before querying the repository" do
    expect(entry_repo).to receive(:list_recent).with(limit: 1, cursor: nil).and_return([])

    result = use_case.call(viewer_account_id: viewer_id, limit: -5)

    expect(result[:entries]).to eq([])
  end
end
