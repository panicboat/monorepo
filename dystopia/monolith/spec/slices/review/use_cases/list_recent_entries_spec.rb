# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::ListRecentEntries do
  let(:use_case) do
    described_class.new(
      entry_repo: entry_repo,
      cast_settings_repo: cast_settings_repo,
      block_adapter: block_adapter,
      filter_visible_posts: filter_visible_posts,
      get_profile: get_profile,
      media_adapter: media_adapter
    )
  end
  let(:entry_repo)            { double(:entry_repository) }
  let(:cast_settings_repo)    { double(:cast_settings_repository) }
  let(:block_adapter)         { double(:block_adapter) }
  let(:filter_visible_posts)  { double(:filter_visible_posts) }
  let(:get_profile)           { double(:get_profile) }
  let(:media_adapter)         { double(:media_adapter) }

  let(:viewer_id) { "viewer-1" }
  let(:author_id) { "author-1" }
  let(:target_id) { "target-1" }

  def entry(author: author_id, target: target_id, hidden: false, id: SecureRandom.uuid)
    double(:entry, id: id, author_account_id: author, target_account_id: target,
      rating: 4.0, body: "body", hidden: hidden, created_at: Time.now, updated_at: Time.now)
  end

  before do
    allow(cast_settings_repo).to receive(:find_by_account).and_return(nil)
    allow(block_adapter).to receive(:bidirectionally_blocked_ids).and_return([])
    allow(filter_visible_posts).to receive(:call) { |viewer_account_id:, posts:| posts }
    allow(get_profile).to receive(:call) { |account_id:| double(:profile, username: "user-#{account_id}", avatar_media_id: nil) }
  end

  it "returns a visible entry that passes every check" do
    e = entry
    allow(entry_repo).to receive(:list_recent).with(limit: 20, cursor: nil).and_return([e])

    result = use_case.call(viewer_account_id: viewer_id)

    expect(result[:entries].length).to eq(1)
    expect(result[:entries].first[:id]).to eq(e.id)
  end

  it "drops hidden entries" do
    e = entry(hidden: true)
    allow(entry_repo).to receive(:list_recent).with(limit: 20, cursor: nil).and_return([e])

    result = use_case.call(viewer_account_id: viewer_id)

    expect(result[:entries]).to be_empty
  end

  it "drops entries whose target has reviews_visible = false" do
    allow(cast_settings_repo).to receive(:find_by_account).with(target_id).and_return(double(reviews_visible: false))
    e = entry
    allow(entry_repo).to receive(:list_recent).with(limit: 20, cursor: nil).and_return([e])

    result = use_case.call(viewer_account_id: viewer_id)

    expect(result[:entries]).to be_empty
  end

  it "drops entries where the viewer is blocked with the author" do
    allow(block_adapter).to receive(:bidirectionally_blocked_ids).with(account_id: viewer_id).and_return([author_id])
    e = entry
    allow(entry_repo).to receive(:list_recent).with(limit: 20, cursor: nil).and_return([e])

    result = use_case.call(viewer_account_id: viewer_id)

    expect(result[:entries]).to be_empty
  end

  it "drops entries where the viewer is blocked with the target" do
    allow(block_adapter).to receive(:bidirectionally_blocked_ids).with(account_id: viewer_id).and_return([target_id])
    e = entry
    allow(entry_repo).to receive(:list_recent).with(limit: 20, cursor: nil).and_return([e])

    result = use_case.call(viewer_account_id: viewer_id)

    expect(result[:entries]).to be_empty
  end

  it "drops entries where the author or target is unreachable (private account, not followed)" do
    e = entry
    allow(entry_repo).to receive(:list_recent).with(limit: 20, cursor: nil).and_return([e])
    allow(filter_visible_posts).to receive(:call) do |viewer_account_id:, posts:|
      posts.reject { |p| p.author_id == target_id }
    end

    result = use_case.call(viewer_account_id: viewer_id)

    expect(result[:entries]).to be_empty
  end

  it "sets has_more and next_cursor when the repo returns limit + 1 rows" do
    e1 = entry(id: "e-1")
    e2 = entry(id: "e-2")
    e3 = entry(id: "e-3")
    allow(entry_repo).to receive(:list_recent).with(limit: 2, cursor: nil).and_return([e1, e2, e3])

    result = use_case.call(viewer_account_id: viewer_id, limit: 2)

    expect(result[:has_more]).to be(true)
    expect(result[:next_cursor]).not_to be_nil
    expect(result[:entries].length).to eq(2)
  end
end
