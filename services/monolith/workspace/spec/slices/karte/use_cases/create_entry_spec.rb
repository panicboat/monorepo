# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::CreateEntry do
  let(:use_case) do
    described_class.new(
      entry_repo: entry_repo,
      access_repo: access_repo,
      user_repo: user_repo
    )
  end
  let(:entry_repo) { double(:entry_repository) }
  let(:access_repo) { double(:access_repository) }
  let(:user_repo) { double(:user_repository) }

  let(:viewer_id) { "viewer-cast-1" }
  let(:target_id) { "target-guest-1" }

  before do
    allow(access_repo).to receive(:find_by_account).with(viewer_id).and_return(double(:access, account_id: viewer_id))
  end

  it "creates an entry when target is a guest" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, id: target_id, role: 1))
    expect(entry_repo).to receive(:create).with(
      author_account_id: viewer_id,
      target_account_id: target_id,
      rating: 3,
      body: "ok"
    ).and_return(double(:entry, id: "e-1"))

    result = use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "ok")
    expect(result.id).to eq("e-1")
  end

  it "rejects when viewer has no karte access" do
    allow(access_repo).to receive(:find_by_account).with(viewer_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::AccessError)
  end

  it "rejects when target is a Cast" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, id: target_id, role: 2))
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::CreateError, "Target must be a guest")
  end

  it "rejects when target does not exist" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::CreateError, "Target not found")
  end

  it "rejects rating outside 1..5" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, role: 1))
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 0, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::CreateError, "Rating must be 1..5")
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 6, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::CreateError, "Rating must be 1..5")
  end

  it "rejects body over 500 chars" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, role: 1))
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "x" * 501)
    }.to raise_error(Karte::UseCases::CreateEntry::CreateError, "Body too long")
  end
end
