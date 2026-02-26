# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::UseCases::Cast::Listing::ListCasts do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }
  let(:casts) { [double(:cast, user_id: "cast-1", created_at: Time.now)] }

  describe "#call" do
    it "calls repo.list_casts_with_filters with all parameters" do
      allow(repo).to receive(:list_casts_with_filters).with(
        visibility_filter: "public",
        genre_id: "genre-1",
        tag: "清楚系",
        status_filter: :online,
        area_id: "area-1",
        query: "かわいい",
        limit: 10,
        cursor: nil,
        registered_only: true
      ).and_return(casts)

      result = use_case.call(
        visibility_filter: "public",
        genre_id: "genre-1",
        tag: "清楚系",
        status_filter: :online,
        area_id: "area-1",
        query: "かわいい",
        limit: 10,
        cursor: nil,
        registered_only: true
      )
      expect(result[:casts]).to eq(casts)
      expect(result[:has_more]).to eq(false)
    end

    it "defaults all filters to nil with cursor pagination" do
      allow(repo).to receive(:list_casts_with_filters).with(
        visibility_filter: nil,
        genre_id: nil,
        tag: nil,
        status_filter: nil,
        area_id: nil,
        query: nil,
        limit: 20,
        cursor: nil,
        registered_only: false
      ).and_return(casts)

      result = use_case.call
      expect(result[:casts]).to eq(casts)
      expect(result[:has_more]).to eq(false)
    end

    it "supports genre filter only" do
      allow(repo).to receive(:list_casts_with_filters).with(
        visibility_filter: nil,
        genre_id: "genre-123",
        tag: nil,
        status_filter: nil,
        area_id: nil,
        query: nil,
        limit: 20,
        cursor: nil,
        registered_only: false
      ).and_return(casts)

      result = use_case.call(genre_id: "genre-123")
      expect(result[:casts]).to eq(casts)
    end

    it "supports status filter only" do
      allow(repo).to receive(:list_casts_with_filters).with(
        visibility_filter: nil,
        genre_id: nil,
        tag: nil,
        status_filter: :new,
        area_id: nil,
        query: nil,
        limit: 20,
        cursor: nil,
        registered_only: false
      ).and_return(casts)

      result = use_case.call(status_filter: :new)
      expect(result[:casts]).to eq(casts)
    end

    it "supports tag filter only" do
      allow(repo).to receive(:list_casts_with_filters).with(
        visibility_filter: nil,
        genre_id: nil,
        tag: "かわいい",
        status_filter: nil,
        area_id: nil,
        query: nil,
        limit: 20,
        cursor: nil,
        registered_only: false
      ).and_return(casts)

      result = use_case.call(tag: "かわいい")
      expect(result[:casts]).to eq(casts)
    end

    it "supports combined filters (genre + status + tag)" do
      allow(repo).to receive(:list_casts_with_filters).with(
        visibility_filter: "public",
        genre_id: "genre-1",
        tag: "清楚系",
        status_filter: :online,
        area_id: nil,
        query: nil,
        limit: 20,
        cursor: nil,
        registered_only: false
      ).and_return(casts)

      result = use_case.call(
        visibility_filter: "public",
        genre_id: "genre-1",
        tag: "清楚系",
        status_filter: :online
      )
      expect(result[:casts]).to eq(casts)
    end

    it "supports text search query" do
      allow(repo).to receive(:list_casts_with_filters).with(
        visibility_filter: nil,
        genre_id: nil,
        tag: nil,
        status_filter: nil,
        area_id: nil,
        query: "かわいい",
        limit: 20,
        cursor: nil,
        registered_only: false
      ).and_return(casts)

      result = use_case.call(query: "かわいい")
      expect(result[:casts]).to eq(casts)
    end

    context "with pagination" do
      it "returns next_cursor when there are more results" do
        created_at = Time.now
        many_casts = (1..21).map { |i| double(:cast, user_id: "cast-#{i}", created_at: created_at) }

        allow(repo).to receive(:list_casts_with_filters).and_return(many_casts)

        result = use_case.call

        expect(result[:has_more]).to eq(true)
        expect(result[:casts].length).to eq(20)
        expect(result[:next_cursor]).not_to be_nil
      end
    end
  end
end
