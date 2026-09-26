# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::FilterVisibleEntries do
  let(:use_case) do
    described_class.new(
      cast_settings_repo: cast_settings_repo,
      block_adapter: block_adapter,
      filter_visible_posts: filter_visible_posts
    )
  end
  let(:cast_settings_repo) { double(:cast_settings_repository) }
  let(:block_adapter) { double(:block_adapter) }
  let(:filter_visible_posts) { double(:filter_visible_posts) }

  let(:viewer_id) { "viewer-1" }
  let(:page_owner_id) { "page-owner-1" }
  let(:other_id) { "other-1" }

  def entry(author:, target:, hidden: false)
    double(:entry, id: SecureRandom.uuid, author_account_id: author, target_account_id: target, hidden: hidden)
  end

  before do
    allow(cast_settings_repo).to receive(:find_by_account).and_return(nil) # default: reviews_visible = true
    allow(block_adapter).to receive(:bidirectionally_blocked_ids).and_return([])
    allow(filter_visible_posts).to receive(:call).and_return([double(:post)]) # default: page owner reachable
  end

  it "self-view: returns everything including hidden, ignoring reviews_visible" do
    allow(cast_settings_repo).to receive(:find_by_account).with(page_owner_id).and_return(double(reviews_visible: false))
    entries = [entry(author: page_owner_id, target: other_id, hidden: true)]

    result = use_case.call(viewer_account_id: page_owner_id, page_owner_account_id: page_owner_id, entries: entries)
    expect(result).to eq(entries)
  end

  it "Level A: drops hidden entries for third-party viewers" do
    entries = [entry(author: page_owner_id, target: other_id, hidden: true)]
    result = use_case.call(viewer_account_id: viewer_id, page_owner_account_id: page_owner_id, entries: entries)
    expect(result).to be_empty
  end

  it "Level A: drops entries whose target has reviews_visible = false" do
    allow(cast_settings_repo).to receive(:find_by_account).with(other_id).and_return(double(reviews_visible: false))
    entries = [entry(author: page_owner_id, target: other_id, hidden: false)]
    result = use_case.call(viewer_account_id: viewer_id, page_owner_account_id: page_owner_id, entries: entries)
    expect(result).to be_empty
  end

  it "keeps entries whose target has no settings row (default reviews_visible = true)" do
    entries = [entry(author: page_owner_id, target: other_id, hidden: false)]
    result = use_case.call(viewer_account_id: viewer_id, page_owner_account_id: page_owner_id, entries: entries)
    expect(result).to eq(entries)
  end

  it "Level B1: drops everything when the page owner is not reachable by the viewer (block/private)" do
    allow(filter_visible_posts).to receive(:call).and_return([])
    entries = [entry(author: page_owner_id, target: other_id, hidden: false)]
    result = use_case.call(viewer_account_id: viewer_id, page_owner_account_id: page_owner_id, entries: entries)
    expect(result).to be_empty
  end

  it "Level B2: drops an entry when the viewer is blocked with the other party (author-list case)" do
    allow(block_adapter).to receive(:bidirectionally_blocked_ids).with(account_id: viewer_id).and_return([other_id])
    entries = [entry(author: page_owner_id, target: other_id, hidden: false)]
    result = use_case.call(viewer_account_id: viewer_id, page_owner_account_id: page_owner_id, entries: entries)
    expect(result).to be_empty
  end

  it "Level B2: drops an entry when the viewer is blocked with the other party (target-list case)" do
    allow(block_adapter).to receive(:bidirectionally_blocked_ids).with(account_id: viewer_id).and_return([other_id])
    entries = [entry(author: other_id, target: page_owner_id, hidden: false)]
    result = use_case.call(viewer_account_id: viewer_id, page_owner_account_id: page_owner_id, entries: entries)
    expect(result).to be_empty
  end

  it "keeps an entry that passes every check" do
    entries = [entry(author: page_owner_id, target: other_id, hidden: false)]
    result = use_case.call(viewer_account_id: viewer_id, page_owner_account_id: page_owner_id, entries: entries)
    expect(result).to eq(entries)
  end
end
