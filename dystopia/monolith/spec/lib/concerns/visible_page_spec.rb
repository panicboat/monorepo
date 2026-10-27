# frozen_string_literal: true

require "spec_helper"
require "concerns/visible_page"

RSpec.describe Concerns::VisiblePage do
  describe ".fill" do
    def fill(source, limit:)
      fetch = ->(cursor) { source.select { |row| cursor.nil? || row > cursor }.first(limit + 1) }
      described_class.fill(limit: limit, cursor: nil, fetch: fetch, keep: ->(rows) { rows.select(&:even?) }, cursor_of: ->(row) { row })
    end

    it "keeps fetching past dropped rows until the page fills and one more kept row shows there is more" do
      expect(fill([1, 2, 3, 4, 5, 6], limit: 2)).to eq(items: [2, 4], has_more: true)
    end

    it "returns an empty last page when every remaining row is dropped" do
      expect(fill([1, 3, 5, 7, 9], limit: 2)).to eq(items: [], has_more: false)
    end

    it "reports no more when the rows run out right after the page fills" do
      expect(fill([1, 2, 3, 4], limit: 2)).to eq(items: [2, 4], has_more: false)
    end
  end
end
