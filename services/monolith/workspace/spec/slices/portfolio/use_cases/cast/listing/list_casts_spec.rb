# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::UseCases::Cast::Listing::ListCasts do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }
  let(:casts) { [double(:cast)] }

  describe "#call" do
    it "calls repo.list_online with status_filter" do
      filter = "online"
      allow(repo).to receive(:list_online).with(filter).and_return(casts)

      result = use_case.call(status_filter: filter)
      expect(result).to eq(casts)
    end

    it "defaults status_filter to nil" do
      allow(repo).to receive(:list_online).with(nil).and_return(casts)

      result = use_case.call
      expect(result).to eq(casts)
    end
  end
end
