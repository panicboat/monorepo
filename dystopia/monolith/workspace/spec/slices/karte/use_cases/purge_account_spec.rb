# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::PurgeAccount do
  let(:use_case) { described_class.new(access_repo: access_repo, report_repo: report_repo) }
  let(:access_repo) { double(:access_repository) }
  let(:report_repo) { double(:report_repository) }
  let(:account_id) { "cast-1" }

  it "deletes karte__access and karte__reports rows for the account, leaving karte__entries untouched" do
    expect(access_repo).to receive(:revoke).with(account_id)
    expect(report_repo).to receive(:delete_by_reporter).with(account_id)
    use_case.call(account_id: account_id)
  end

  it "is idempotent (re-running on already-purged account is no-op)" do
    allow(access_repo).to receive(:revoke).with(account_id)
    allow(report_repo).to receive(:delete_by_reporter).with(account_id)
    expect { use_case.call(account_id: account_id) }.not_to raise_error
    expect { use_case.call(account_id: account_id) }.not_to raise_error
  end
end
