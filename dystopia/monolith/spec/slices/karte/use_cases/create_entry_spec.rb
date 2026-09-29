# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::CreateEntry do
  let(:use_case) do
    described_class.new(
      entry_repo: entry_repo,
      user_repo: user_repo,
      get_my_access: get_my_access_uc
    )
  end
  let(:entry_repo)       { double(:entry_repository) }
  let(:user_repo)        { double(:user_repository) }
  let(:get_my_access_uc) { double(:get_my_access) }

  let(:viewer_id) { "viewer-cast-1" }
  let(:target_id) { "target-guest-1" }

  before do
    allow(user_repo).to receive(:find_by_id).with(viewer_id).and_return(double(:user, id: viewer_id, role: 2))
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_id).and_return(has_access: true)
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

  it "rejects when the author is not a cast" do
    allow(user_repo).to receive(:find_by_id).with(viewer_id).and_return(double(:user, id: viewer_id, role: 1))
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::AccessError)
  end

  it "rejects when the author account cannot be found" do
    allow(user_repo).to receive(:find_by_id).with(viewer_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::AccessError)
  end

  it "rejects when karte billing access is off" do
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_id).and_return(has_access: false)
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
