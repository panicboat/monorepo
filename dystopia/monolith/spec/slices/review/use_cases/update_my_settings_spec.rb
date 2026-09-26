# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::UpdateMySettings do
  let(:use_case) { described_class.new(cast_settings_repo: cast_settings_repo) }
  let(:cast_settings_repo) { double(:cast_settings_repository) }
  let(:account_id) { "cast-1" }

  it "upserts and returns the new value" do
    expect(cast_settings_repo).to receive(:upsert).with(account_id: account_id, reviews_visible: false)
    expect(use_case.call(viewer_account_id: account_id, reviews_visible: false)).to eq(reviews_visible: false)
  end
end
