# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::PurgeProfile do
  let(:use_case) do
    described_class.new(follow_repo: follow_repo, block_repo: block_repo)
  end
  let(:follow_repo) { double(:follow_repository) }
  let(:block_repo) { double(:block_repository) }

  it "deletes follows (follower OR followee) and blocks (blocker OR blocked)" do
    expect(follow_repo).to receive(:delete_by_profile).with("cast-1")
    expect(block_repo).to receive(:delete_by_profile).with("cast-1")
    use_case.call(profile_id: "cast-1")
  end

  it "returns nil" do
    allow(follow_repo).to receive(:delete_by_profile)
    allow(block_repo).to receive(:delete_by_profile)
    expect(use_case.call(profile_id: "cast-1")).to be_nil
  end
end
