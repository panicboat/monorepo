# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::ListMyEntries do
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
  let(:now)       { Time.now }

  let(:entry1) do
    double(:entry,
      id: "e-1",
      author_account_id: viewer_id,
      target_account_id: "target-1",
      rating: 4,
      body: "good",
      reported_count: 0,
      created_at: now - 100,
      updated_at: now - 50)
  end

  let(:profile) { double(:profile, username: "cast1", avatar_media_id: nil) }

  before do
    allow(access_repo).to receive(:find_by_account).with(viewer_id)
      .and_return(double(:access, account_id: viewer_id))
  end

  it "returns the viewer's entries without aggregate" do
    allow(entry_repo).to receive(:list_by_author)
      .with(author_account_id: viewer_id, limit: 20, cursor: nil)
      .and_return([entry1])
    allow(get_profile_uc).to receive(:call).with(account_id: viewer_id).and_return(profile)

    result = use_case.call(viewer_account_id: viewer_id)

    expect(result[:entries].length).to eq(1)
    expect(result[:entries][0][:author_account_id]).to eq(viewer_id)
    expect(result[:has_more]).to be(false)
    expect(result[:next_cursor]).to be_nil
    expect(result).not_to have_key(:aggregate)
  end

  it "rejects when viewer has no karte access" do
    allow(access_repo).to receive(:find_by_account).with(viewer_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: viewer_id)
    }.to raise_error(Karte::UseCases::ListMyEntries::AccessError)
  end
end
