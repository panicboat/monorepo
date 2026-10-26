# frozen_string_literal: true

require "spec_helper"
require "concerns/cursor_pagination"

RSpec.describe Concerns::CursorPagination do
  let(:test_class) do
    Class.new do
      include Concerns::CursorPagination
      public :normalize_limit, :decode_cursor, :encode_cursor, :build_pagination_result
    end
  end

  let(:instance) { test_class.new }

  describe "#normalize_limit" do
    it "returns default when 0" do
      expect(instance.normalize_limit(0)).to eq(1)
    end

    it "returns default when negative" do
      expect(instance.normalize_limit(-5)).to eq(1)
    end

    it "caps at MAX_LIMIT" do
      expect(instance.normalize_limit(999)).to eq(100)
    end

    it "allows valid limit" do
      expect(instance.normalize_limit(25)).to eq(25)
    end

    it "respects custom MAX_LIMIT" do
      custom_class = Class.new do
        include Concerns::CursorPagination
        public :normalize_limit
      end
      custom_class.const_set(:MAX_LIMIT, 50)
      expect(custom_class.new.normalize_limit(75)).to eq(50)
    end
  end

  describe "#encode_cursor / #decode_cursor" do
    it "reads a display start cursor as a time down to the microsecond" do
      published_at = Time.at(1_800_000_000, 123_456, :usec)
      id = SecureRandom.uuid_v7
      encoded = instance.encode_cursor(published_at: published_at.iso8601(6), id: id)

      expect(instance.decode_cursor(encoded, keys: [:published_at, :id])).to eq(published_at: published_at, id: id)
    end

    it "round-trips cursor data" do
      id = SecureRandom.uuid_v7
      data = { created_at: Time.now.iso8601, id: id }
      encoded = instance.encode_cursor(data)
      decoded = instance.decode_cursor(encoded)

      expect(decoded[:id]).to eq(id)
      expect(decoded[:created_at]).to be_a(Time)
    end

    it "returns nil for nil cursor" do
      expect(instance.decode_cursor(nil)).to be_nil
    end

    it "returns nil for empty cursor" do
      expect(instance.decode_cursor("")).to be_nil
    end

    it "returns nil for invalid cursor" do
      expect(instance.decode_cursor("not-valid-base64!!!")).to be_nil
    end

    it "returns nil for a cursor whose id is not a uuid" do
      expect(instance.decode_cursor(instance.encode_cursor(created_at: Time.now.iso8601(6), id: "not-a-uuid"))).to be_nil
    end

    it "supports custom keys" do
      id = SecureRandom.uuid_v7
      data = { score: "42", id: id }
      encoded = instance.encode_cursor(data)
      decoded = instance.decode_cursor(encoded, keys: [:score, :id])

      expect(decoded[:score]).to eq("42")
      expect(decoded[:id]).to eq(id)
    end
  end

  describe "#build_pagination_result" do
    it "returns has_more: false when items <= limit" do
      items = [1, 2, 3]
      result = instance.build_pagination_result(items: items, limit: 5) { |_| "cursor" }
      expect(result[:has_more]).to be false
      expect(result[:next_cursor]).to be_nil
      expect(result[:items]).to eq([1, 2, 3])
    end

    it "returns has_more: true and truncates when items > limit" do
      items = [1, 2, 3, 4]
      result = instance.build_pagination_result(items: items, limit: 3) { |last| "cursor_#{last}" }
      expect(result[:has_more]).to be true
      expect(result[:next_cursor]).to eq("cursor_3")
      expect(result[:items]).to eq([1, 2, 3])
    end

    it "handles empty items" do
      result = instance.build_pagination_result(items: [], limit: 5) { |_| "cursor" }
      expect(result[:has_more]).to be false
      expect(result[:next_cursor]).to be_nil
      expect(result[:items]).to eq([])
    end
  end
end
