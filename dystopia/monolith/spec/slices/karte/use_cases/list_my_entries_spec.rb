# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::ListMyEntries do
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

  let(:entry1) do
    double(:entry,
      id: "e-1",
      author_account_id: viewer_id,
      author_profile_id: "viewer-profile-1",
      target_profile_id: "target-1",
      rating: 4,
      body: "good",
      reported_count: 0,
      created_at: now - 100,
      updated_at: now - 50)
  end

  let(:profile) { double(:profile, username: "cast1", avatar_media_id: nil) }

  before do
    allow(authorize_cast_access).to receive(:call).with(viewer_account_id: viewer_id).and_return(true)
  end

  it "returns the viewer's entries without aggregate" do
    allow(entry_repo).to receive(:list_by_author)
      .with(author_account_id: viewer_id, limit: 20, cursor: nil)
      .and_return([entry1])
    allow(get_profile_uc).to receive(:call).with(profile_id: "viewer-profile-1").and_return(profile)
    allow(get_profile_uc).to receive(:call).with(profile_id: "target-1")
      .and_return(double(:profile, username: "guest1", avatar_media_id: nil))

    result = use_case.call(viewer_account_id: viewer_id)

    expect(result[:entries].length).to eq(1)
    expect(result[:entries][0][:author_profile_id]).to eq("viewer-profile-1")
    expect(result[:entries][0][:target_username]).to eq("guest1")
    expect(result[:has_more]).to be(false)
    expect(result[:next_cursor]).to be_nil
    expect(result).not_to have_key(:aggregate)
  end

  it "delegates the cast/billing check to AuthorizeCastAccess and rejects when it fails" do
    allow(authorize_cast_access).to receive(:call).with(viewer_account_id: viewer_id).and_return(false)
    expect {
      use_case.call(viewer_account_id: viewer_id)
    }.to raise_error(Karte::UseCases::ListMyEntries::AccessError)
  end

  it "sets has_more and next_cursor when the repo returns limit + 1 rows" do
    entry2 = double(:entry,
      id: "e-2",
      author_account_id: viewer_id,
      author_profile_id: "viewer-profile-1",
      target_profile_id: "target-2",
      rating: 5,
      body: "ok",
      reported_count: 0,
      created_at: now - 200,
      updated_at: now - 150)
    entry3 = double(:entry,
      id: "e-3",
      author_account_id: viewer_id,
      author_profile_id: "viewer-profile-1",
      target_profile_id: "target-3",
      rating: 3,
      body: "meh",
      reported_count: 0,
      created_at: now - 300,
      updated_at: now - 250)

    allow(entry_repo).to receive(:list_by_author)
      .with(author_account_id: viewer_id, limit: 2, cursor: nil)
      .and_return([entry1, entry2, entry3])
    allow(get_profile_uc).to receive(:call).with(profile_id: "viewer-profile-1").and_return(profile)
    allow(get_profile_uc).to receive(:call).with(profile_id: "target-1")
      .and_return(double(:profile, username: "guest1", avatar_media_id: nil))
    allow(get_profile_uc).to receive(:call).with(profile_id: "target-2")
      .and_return(double(:profile, username: "guest2", avatar_media_id: nil))

    result = use_case.call(viewer_account_id: viewer_id, limit: 2)

    expect(result[:entries].length).to eq(2)
    expect(result[:entries].map { |e| e[:id] }).to eq(["e-1", "e-2"])
    expect(result[:has_more]).to be(true)
    expect(result[:next_cursor]).not_to be_nil
  end

  it "marks an entry as mine by the owning account, whichever profile wrote it" do
    mine = double(:entry, id: "e-mine", author_account_id: viewer_id, author_profile_id: "other-persona",
      target_profile_id: "target-x", rating: 3, body: nil, reported_count: 0, created_at: now, updated_at: now)
    theirs = double(:entry, id: "e-theirs", author_account_id: "someone-else", author_profile_id: "their-persona",
      target_profile_id: "target-x", rating: 3, body: nil, reported_count: 0, created_at: now, updated_at: now)
    allow(entry_repo).to receive(:list_by_author).and_return([mine, theirs])
    allow(get_profile_uc).to receive(:call).and_return(nil)

    entries = use_case.call(viewer_account_id: viewer_id)[:entries]

    expect(entries.map { |e| e[:is_mine] }).to eq([true, false])
    expect(entries.map { |e| e[:author_profile_id] }).to eq(["other-persona", "their-persona"])
  end

  it "never includes the author's account id in a presented entry" do
    entry = double(:entry, id: "e-1", author_account_id: "secret-account", author_profile_id: "persona-1",
      target_profile_id: "target-x", rating: 3, body: nil, reported_count: 0, created_at: now, updated_at: now)
    allow(entry_repo).to receive(:list_by_author).and_return([entry])
    allow(get_profile_uc).to receive(:call).and_return(nil)

    presented = use_case.call(viewer_account_id: viewer_id)[:entries].first

    expect(presented).not_to have_key(:author_account_id)
    expect(presented.values).not_to include("secret-account")
  end
end
