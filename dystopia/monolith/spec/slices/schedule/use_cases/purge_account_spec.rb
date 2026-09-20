# frozen_string_literal: true

require "spec_helper"

RSpec.describe Schedule::UseCases::PurgeAccount do
  let(:use_case) { described_class.new(schedule_repo: schedule_repo) }
  let(:schedule_repo) { double(:schedule_repository) }

  it "deletes all schedule rows for the account" do
    expect(schedule_repo).to receive(:delete_by_account).with("cast-1")
    use_case.call(account_id: "cast-1")
  end
end
