# frozen_string_literal: true

require "spec_helper"

RSpec.describe Media::UseCases::PurgeAccount do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:media_repository) }

  it "deletes media__files where uploader_account_id matches" do
    expect(repo).to receive(:delete_by_uploader).with("cast-1")
    use_case.call(account_id: "cast-1")
  end
end
