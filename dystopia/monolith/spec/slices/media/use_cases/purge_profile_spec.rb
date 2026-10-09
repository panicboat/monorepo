# frozen_string_literal: true

require "spec_helper"

RSpec.describe Media::UseCases::PurgeProfile do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:media_repository) }

  it "deletes media__files where uploader_profile_id matches" do
    expect(repo).to receive(:delete_by_uploader).with("cast-1")
    use_case.call(profile_id: "cast-1")
  end
end
