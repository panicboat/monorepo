# frozen_string_literal: true

require "spec_helper"

RSpec.describe Schedule::UseCases::PurgeProfile do
  let(:use_case) { described_class.new(schedule_repo: schedule_repo) }
  let(:schedule_repo) { double(:schedule_repository) }

  it "deletes all schedule rows for the profile" do
    expect(schedule_repo).to receive(:delete_by_profile).with("cast-1")
    use_case.call(profile_id: "cast-1")
  end
end
