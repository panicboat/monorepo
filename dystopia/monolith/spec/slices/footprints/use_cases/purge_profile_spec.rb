# frozen_string_literal: true

require "spec_helper"

RSpec.describe Footprints::UseCases::PurgeProfile do
  let(:use_case) { described_class.new(footprints_repo: footprints_repo) }
  let(:footprints_repo) { double(:footprints_repository) }

  it "deletes visits (visitor or visited) and read_state for the profile" do
    expect(footprints_repo).to receive(:delete_visits_by_profile).with("cast-1")
    expect(footprints_repo).to receive(:delete_read_state_by_profile).with("cast-1")
    use_case.call(profile_id: "cast-1")
  end
end
