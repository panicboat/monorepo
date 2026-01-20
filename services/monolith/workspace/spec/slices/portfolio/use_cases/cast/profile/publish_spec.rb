# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::UseCases::Cast::Profile::Publish do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }

  describe "#call" do
    let(:cast_id) { 1 }
    let(:status) { "online" }

    it "updates the cast status" do
      expect(repo).to receive(:update_status).with(cast_id, status)

      use_case.call(cast_id: cast_id, status: status)
    end
  end
end
