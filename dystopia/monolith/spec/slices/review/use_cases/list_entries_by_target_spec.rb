# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::ListEntriesByTarget do
  let(:use_case) do
    described_class.new(
      entry_repo: entry_repo,
      filter_visible_entries: filter_visible_entries,
      get_profile: get_profile,
      media_adapter: media_adapter
    )
  end
  let(:entry_repo) { double(:entry_repository) }
  let(:filter_visible_entries) { double(:filter_visible_entries) }
  let(:get_profile) { double(:get_profile) }
  let(:media_adapter) { double(:media_adapter) }

  let(:viewer_id) { "viewer-1" }
  let(:target_id) { "target-1" }

  let(:raw_entry) do
    double(:entry,
      id: "e-1", author_account_id: "author-1", target_account_id: target_id,
      rating: 4.5, body: "nice", hidden: false,
      created_at: Time.now, updated_at: Time.now)
  end

  it "delegates filtering to FilterVisibleEntries with page_owner = target" do
    allow(entry_repo).to receive(:list_by_target)
      .with(target_account_id: target_id, limit: 20, cursor: nil)
      .and_return([raw_entry])
    expect(filter_visible_entries).to receive(:call).with(
      viewer_account_id: viewer_id, page_owner_account_id: target_id, entries: [raw_entry]
    ).and_return([raw_entry])
    allow(get_profile).to receive(:call).and_return(double(username: "guest1", avatar_media_id: nil))

    result = use_case.call(viewer_account_id: viewer_id, target_account_id: target_id)
    expect(result[:entries].first[:id]).to eq("e-1")
    expect(result[:entries].first[:rating]).to eq(4.5)
    expect(result[:has_more]).to eq(false)
  end

  it "computes has_more/next_cursor from the raw page, before filtering" do
    entries = Array.new(21) { raw_entry }
    allow(entry_repo).to receive(:list_by_target).and_return(entries)
    allow(filter_visible_entries).to receive(:call).and_return([]) # everything filtered out
    allow(get_profile).to receive(:call).and_return(double(username: "g", avatar_media_id: nil))

    result = use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, limit: 20)
    expect(result[:has_more]).to eq(true)
    expect(result[:next_cursor]).not_to be_nil
    expect(result[:entries]).to eq([])
  end
end
