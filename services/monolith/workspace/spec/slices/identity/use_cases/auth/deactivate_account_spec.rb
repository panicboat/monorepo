# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Auth::DeactivateAccount do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:user_repository) }
  let(:viewer_id) { "viewer-cast-1" }

  it "deactivates the account when it is currently active" do
    allow(repo).to receive(:find_by_id).with(viewer_id).and_return(
      double(:user, id: viewer_id, deactivated_at: nil)
    )
    expect(repo).to receive(:deactivate).with(viewer_id)
    use_case.call(viewer_account_id: viewer_id)
  end

  it "is no-op when the account is already deactivated" do
    allow(repo).to receive(:find_by_id).with(viewer_id).and_return(
      double(:user, id: viewer_id, deactivated_at: Time.now - 60)
    )
    expect(repo).not_to receive(:deactivate)
    use_case.call(viewer_account_id: viewer_id)
  end

  it "returns nil regardless of branch" do
    allow(repo).to receive(:find_by_id).with(viewer_id).and_return(
      double(:user, id: viewer_id, deactivated_at: nil)
    )
    allow(repo).to receive(:deactivate)
    expect(use_case.call(viewer_account_id: viewer_id)).to be_nil
  end

  it "raises when the user is not found" do
    allow(repo).to receive(:find_by_id).with(viewer_id).and_return(nil)
    expect { use_case.call(viewer_account_id: viewer_id) }.to raise_error(
      Identity::UseCases::Auth::DeactivateAccount::DeactivationError, "User not found"
    )
  end
end
