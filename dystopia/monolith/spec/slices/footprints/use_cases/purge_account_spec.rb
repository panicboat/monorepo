# frozen_string_literal: true

require "spec_helper"

RSpec.describe Footprints::UseCases::PurgeAccount do
  let(:use_case) { described_class.new(footprints_repo: footprints_repo) }
  let(:footprints_repo) { double(:footprints_repository) }

  it "deletes visits (visitor or visited) and read_state for the account" do
    expect(footprints_repo).to receive(:delete_visits_by_account).with("cast-1")
    expect(footprints_repo).to receive(:delete_read_state_by_account).with("cast-1")
    use_case.call(account_id: "cast-1")
  end
end
