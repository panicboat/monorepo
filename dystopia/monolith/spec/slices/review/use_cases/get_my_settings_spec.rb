# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::GetMySettings do
  let(:use_case) { described_class.new(cast_settings_repo: cast_settings_repo) }
  let(:cast_settings_repo) { double(:cast_settings_repository) }
  let(:account_id) { "cast-1" }

  it "returns true when no settings row exists" do
    allow(cast_settings_repo).to receive(:find_by_account).with(account_id).and_return(nil)
    expect(use_case.call(viewer_account_id: account_id)).to eq(reviews_visible: true)
  end

  it "returns the stored value when a row exists" do
    allow(cast_settings_repo).to receive(:find_by_account).with(account_id).and_return(double(reviews_visible: false))
    expect(use_case.call(viewer_account_id: account_id)).to eq(reviews_visible: false)
  end
end
