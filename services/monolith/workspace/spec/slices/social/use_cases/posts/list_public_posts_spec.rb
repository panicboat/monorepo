# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Posts::ListPublicPosts do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }

  let(:post1) { double(:post, id: "p1", cast_id: "cast-1", created_at: Time.parse("2026-01-01T10:00:00Z")) }
  let(:post2) { double(:post, id: "p2", cast_id: "cast-2", created_at: Time.parse("2026-01-01T09:00:00Z")) }
  let(:post3) { double(:post, id: "p3", cast_id: "cast-1", created_at: Time.parse("2026-01-01T08:00:00Z")) }

  let(:author1) { double(:author, id: "cast-1", name: "Cast 1") }
  let(:author2) { double(:author, id: "cast-2", name: "Cast 2") }

  before do
    adapter = instance_double(Social::Adapters::CastAdapter)
    allow(Social::Adapters::CastAdapter).to receive(:new).and_return(adapter)
    allow(adapter).to receive(:find_by_cast_id).with("cast-1").and_return(author1)
    allow(adapter).to receive(:find_by_cast_id).with("cast-2").and_return(author2)
  end

  describe "#call" do
    it "returns visible posts with pagination info and authors" do
      allow(repo).to receive(:list_all_visible)
        .with(limit: 20, cursor: nil, cast_id: nil)
        .and_return([post1, post2])

      result = use_case.call

      expect(result[:posts]).to eq([post1, post2])
      expect(result[:has_more]).to eq(false)
      expect(result[:next_cursor]).to be_nil
      expect(result[:authors]["cast-1"]).to eq(author1)
      expect(result[:authors]["cast-2"]).to eq(author2)
    end

    it "respects custom limit" do
      allow(repo).to receive(:list_all_visible)
        .with(limit: 2, cursor: nil, cast_id: nil)
        .and_return([post1, post2, post3])

      result = use_case.call(limit: 2)

      expect(result[:posts].size).to eq(2)
      expect(result[:has_more]).to eq(true)
      expect(result[:next_cursor]).not_to be_nil
    end

    it "filters by cast_id when provided" do
      expect(repo).to receive(:list_all_visible)
        .with(limit: 20, cursor: nil, cast_id: "cast-1")
        .and_return([post1, post3])

      result = use_case.call(cast_id: "cast-1")

      expect(result[:posts]).to eq([post1, post3])
    end

    it "clamps limit to minimum of 1" do
      expect(repo).to receive(:list_all_visible)
        .with(limit: 1, cursor: nil, cast_id: nil)
        .and_return([])

      use_case.call(limit: 0)
    end

    it "clamps limit to maximum of 50" do
      expect(repo).to receive(:list_all_visible)
        .with(limit: 50, cursor: nil, cast_id: nil)
        .and_return([])

      use_case.call(limit: 100)
    end

    it "decodes cursor and passes to repo" do
      cursor_data = { "created_at" => "2026-01-01T09:00:00Z", "id" => "p2" }
      encoded = Base64.urlsafe_encode64(JSON.generate(cursor_data), padding: false)

      expect(repo).to receive(:list_all_visible) do |args|
        expect(args[:cursor][:id]).to eq("p2")
        expect(args[:cursor][:created_at]).to be_a(Time)
        []
      end

      use_case.call(cursor: encoded)
    end

    it "handles invalid cursor gracefully" do
      expect(repo).to receive(:list_all_visible)
        .with(limit: 20, cursor: nil, cast_id: nil)
        .and_return([])

      result = use_case.call(cursor: "invalid-cursor")
      expect(result[:posts]).to eq([])
    end

    it "handles empty cursor string" do
      expect(repo).to receive(:list_all_visible)
        .with(limit: 20, cursor: nil, cast_id: nil)
        .and_return([])

      use_case.call(cursor: "")
    end
  end
end
