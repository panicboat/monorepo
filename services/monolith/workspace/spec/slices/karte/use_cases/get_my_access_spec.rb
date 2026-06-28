# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::GetMyAccess do
  let(:use_case) do
    described_class.new(access_repo: access_repo)
  end
  let(:access_repo) { double(:access_repository) }

  let(:viewer_id) { "viewer-cast-1" }

  it "returns has_access true with granted_at when access row exists" do
    granted_time = Time.now
    row = double(:access, account_id: viewer_id, granted_at: granted_time)
    allow(access_repo).to receive(:find_by_account).with(viewer_id).and_return(row)

    result = use_case.call(viewer_account_id: viewer_id)

    expect(result[:has_access]).to be(true)
    expect(result[:granted_at]).to eq(granted_time)
  end

  it "returns has_access false with nil granted_at when no access row" do
    allow(access_repo).to receive(:find_by_account).with(viewer_id).and_return(nil)

    result = use_case.call(viewer_account_id: viewer_id)

    expect(result[:has_access]).to be(false)
    expect(result[:granted_at]).to be_nil
  end
end
