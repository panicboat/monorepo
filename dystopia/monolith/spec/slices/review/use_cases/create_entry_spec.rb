# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::CreateEntry do
  let(:use_case) { described_class.new(entry_repo: entry_repo, user_repo: user_repo) }
  let(:entry_repo) { double(:entry_repository) }
  let(:user_repo) { double(:user_repository) }

  let(:viewer_id) { "viewer-guest-1" }
  let(:target_id) { "target-cast-1" }

  it "creates an entry when target is a cast" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, id: target_id, role: 2))
    expect(entry_repo).to receive(:create).with(
      author_account_id: viewer_id,
      target_account_id: target_id,
      rating: 3.5,
      body: "great"
    ).and_return(double(:entry, id: "e-1"))

    result = use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3.5, body: "great")
    expect(result.id).to eq("e-1")
  end

  it "never consults reviews_visible before creating (the use case has no such dependency)" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, id: target_id, role: 2))
    allow(entry_repo).to receive(:create).and_return(double(:entry, id: "e-2"))

    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 1.0, body: nil)
    }.not_to raise_error
  end

  it "rejects when target is a guest" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, id: target_id, role: 1))
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3.0, body: nil)
    }.to raise_error(Review::UseCases::CreateEntry::CreateError, "Target must be a cast")
  end

  it "rejects when target does not exist" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3.0, body: nil)
    }.to raise_error(Review::UseCases::CreateEntry::CreateError, "Target not found")
  end

  it "rejects a rating outside the 0.5-step set" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, role: 2))
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3.3, body: nil)
    }.to raise_error(Review::UseCases::CreateEntry::CreateError, /Rating must be one of/)
  end

  it "rejects body over 500 chars" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, role: 2))
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3.0, body: "x" * 501)
    }.to raise_error(Review::UseCases::CreateEntry::CreateError, "Body too long")
  end
end
