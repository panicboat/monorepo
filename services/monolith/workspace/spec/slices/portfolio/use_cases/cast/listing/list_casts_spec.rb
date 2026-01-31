# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::UseCases::Cast::Listing::ListCasts do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }
  let(:casts) { [double(:cast)] }

  describe "#call" do
    it "calls repo.list_casts_with_filters with all parameters" do
      allow(repo).to receive(:list_casts_with_filters).with(
        visibility_filter: "published",
        genre_id: "genre-1",
        tag: "清楚系",
        status_filter: :online,
        area_id: "area-1",
        query: "かわいい",
        limit: 10,
        offset: 0
      ).and_return(casts)

      result = use_case.call(
        visibility_filter: "published",
        genre_id: "genre-1",
        tag: "清楚系",
        status_filter: :online,
        area_id: "area-1",
        query: "かわいい",
        limit: 10,
        offset: 0
      )
      expect(result).to eq(casts)
    end

    it "defaults all filters to nil" do
      allow(repo).to receive(:list_casts_with_filters).with(
        visibility_filter: nil,
        genre_id: nil,
        tag: nil,
        status_filter: nil,
        area_id: nil,
        query: nil,
        limit: nil,
        offset: nil
      ).and_return(casts)

      result = use_case.call
      expect(result).to eq(casts)
    end

    it "supports genre filter only" do
      allow(repo).to receive(:list_casts_with_filters).with(
        visibility_filter: nil,
        genre_id: "genre-123",
        tag: nil,
        status_filter: nil,
        area_id: nil,
        query: nil,
        limit: nil,
        offset: nil
      ).and_return(casts)

      result = use_case.call(genre_id: "genre-123")
      expect(result).to eq(casts)
    end

    it "supports status filter only" do
      allow(repo).to receive(:list_casts_with_filters).with(
        visibility_filter: nil,
        genre_id: nil,
        tag: nil,
        status_filter: :new,
        area_id: nil,
        query: nil,
        limit: nil,
        offset: nil
      ).and_return(casts)

      result = use_case.call(status_filter: :new)
      expect(result).to eq(casts)
    end

    it "supports tag filter only" do
      allow(repo).to receive(:list_casts_with_filters).with(
        visibility_filter: nil,
        genre_id: nil,
        tag: "かわいい",
        status_filter: nil,
        area_id: nil,
        query: nil,
        limit: nil,
        offset: nil
      ).and_return(casts)

      result = use_case.call(tag: "かわいい")
      expect(result).to eq(casts)
    end

    it "supports combined filters (genre + status + tag)" do
      allow(repo).to receive(:list_casts_with_filters).with(
        visibility_filter: "published",
        genre_id: "genre-1",
        tag: "清楚系",
        status_filter: :online,
        area_id: nil,
        query: nil,
        limit: nil,
        offset: nil
      ).and_return(casts)

      result = use_case.call(
        visibility_filter: "published",
        genre_id: "genre-1",
        tag: "清楚系",
        status_filter: :online
      )
      expect(result).to eq(casts)
    end

    it "supports text search query" do
      allow(repo).to receive(:list_casts_with_filters).with(
        visibility_filter: nil,
        genre_id: nil,
        tag: nil,
        status_filter: nil,
        area_id: nil,
        query: "かわいい",
        limit: nil,
        offset: nil
      ).and_return(casts)

      result = use_case.call(query: "かわいい")
      expect(result).to eq(casts)
    end
  end
end
