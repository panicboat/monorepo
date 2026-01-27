# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Posts::ListPosts do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }

  let(:cast_id) { "cast-123" }
  let(:post1) { double(:post, id: "p1", created_at: Time.parse("2026-01-01T10:00:00Z")) }
  let(:post2) { double(:post, id: "p2", created_at: Time.parse("2026-01-01T09:00:00Z")) }
  let(:post3) { double(:post, id: "p3", created_at: Time.parse("2026-01-01T08:00:00Z")) }

  describe "#call" do
    it "returns posts with pagination info" do
      allow(repo).to receive(:list_by_cast_id)
        .with(cast_id: cast_id, limit: 20, cursor: nil)
        .and_return([post1, post2])

      result = use_case.call(cast_id: cast_id)

      expect(result[:posts]).to eq([post1, post2])
      expect(result[:has_more]).to eq(false)
      expect(result[:next_cursor]).to be_nil
    end

    it "respects custom limit" do
      allow(repo).to receive(:list_by_cast_id)
        .with(cast_id: cast_id, limit: 2, cursor: nil)
        .and_return([post1, post2, post3])

      result = use_case.call(cast_id: cast_id, limit: 2)

      expect(result[:posts].size).to eq(2)
      expect(result[:has_more]).to eq(true)
      expect(result[:next_cursor]).not_to be_nil
    end

    it "clamps limit to minimum of 1" do
      expect(repo).to receive(:list_by_cast_id)
        .with(cast_id: cast_id, limit: 1, cursor: nil)
        .and_return([])

      use_case.call(cast_id: cast_id, limit: 0)
    end

    it "clamps limit to maximum of 50" do
      expect(repo).to receive(:list_by_cast_id)
        .with(cast_id: cast_id, limit: 50, cursor: nil)
        .and_return([])

      use_case.call(cast_id: cast_id, limit: 100)
    end

    it "decodes cursor and passes to repo" do
      cursor_data = { "created_at" => "2026-01-01T09:00:00Z", "id" => "p2" }
      encoded = Base64.urlsafe_encode64(JSON.generate(cursor_data), padding: false)

      expect(repo).to receive(:list_by_cast_id) do |args|
        expect(args[:cursor][:id]).to eq("p2")
        expect(args[:cursor][:created_at]).to be_a(Time)
        []
      end

      use_case.call(cast_id: cast_id, cursor: encoded)
    end

    it "handles invalid cursor gracefully" do
      expect(repo).to receive(:list_by_cast_id)
        .with(cast_id: cast_id, limit: 20, cursor: nil)
        .and_return([])

      result = use_case.call(cast_id: cast_id, cursor: "invalid-cursor")
      expect(result[:posts]).to eq([])
    end

    it "handles empty cursor string" do
      expect(repo).to receive(:list_by_cast_id)
        .with(cast_id: cast_id, limit: 20, cursor: nil)
        .and_return([])

      use_case.call(cast_id: cast_id, cursor: "")
    end
  end
end
