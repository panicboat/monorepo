# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::CreateEntry do
  let(:use_case) do
    described_class.new(
      entry_repo: entry_repo,
      get_role: get_role,
      authorize_cast_access: authorize_cast_access
    )
  end
  let(:entry_repo)            { double(:entry_repository) }
  let(:get_role)              { double(:get_role) }
  let(:authorize_cast_access) { double(:authorize_cast_access) }

  let(:viewer_id) { "viewer-cast-1" }
  let(:target_id) { "target-guest-1" }

  before do
    allow(authorize_cast_access).to receive(:call).with(viewer_account_id: viewer_id).and_return(true)
  end

  it "creates an entry when target is a guest" do
    allow(get_role).to receive(:call).with(profile_id: target_id).and_return(1)
    expect(entry_repo).to receive(:create).with(
      author_account_id: viewer_id,
      target_account_id: target_id,
      rating: 3,
      body: "ok"
    ).and_return(double(:entry, id: "e-1"))

    result = use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "ok")
    expect(result.id).to eq("e-1")
  end

  it "delegates the cast/billing check to AuthorizeCastAccess and rejects when it fails" do
    allow(authorize_cast_access).to receive(:call).with(viewer_account_id: viewer_id).and_return(false)
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::AccessError)
  end

  it "rejects when target is a Cast" do
    allow(get_role).to receive(:call).with(profile_id: target_id).and_return(2)
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::CreateError, "Target must be a guest")
  end

  it "rejects when target does not exist" do
    allow(get_role).to receive(:call).with(profile_id: target_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::CreateError, "Target not found")
  end

  it "rejects rating outside 1..5" do
    allow(get_role).to receive(:call).with(profile_id: target_id).and_return(1)
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 0, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::CreateError, "Rating must be 1..5")
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 6, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::CreateError, "Rating must be 1..5")
  end

  it "rejects body over 500 chars" do
    allow(get_role).to receive(:call).with(profile_id: target_id).and_return(1)
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "x" * 501)
    }.to raise_error(Karte::UseCases::CreateEntry::CreateError, "Body too long")
  end
end
