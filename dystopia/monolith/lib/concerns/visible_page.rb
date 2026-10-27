# frozen_string_literal: true

module Concerns
  module VisiblePage
    def self.fill(limit:, cursor:, fetch:, keep:, cursor_of:)
      kept = []
      loop do
        rows = fetch.call(cursor)
        kept.concat(keep.call(rows))
        break if kept.length > limit || rows.length <= limit

        cursor = cursor_of.call(rows.last)
      end
      { items: kept.first(limit), has_more: kept.length > limit }
    end
  end
end
