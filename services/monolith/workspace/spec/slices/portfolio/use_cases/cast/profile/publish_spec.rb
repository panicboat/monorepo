# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::UseCases::Cast::Profile::Publish do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }

  describe "#call" do
    let(:cast_id) { 1 }
    let(:visibility) { "published" }

    it "saves the cast visibility" do
      expect(repo).to receive(:save_visibility).with(cast_id, visibility)

      use_case.call(cast_id: cast_id, visibility: visibility)
    end
  end
end
