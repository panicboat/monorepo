# frozen_string_literal: true

require "base64"
require "json"

module Concerns
  module CursorPagination
    DEFAULT_LIMIT = 20
    MAX_LIMIT = 100
    UUID_FORMAT = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/

    def self.included(base)
      base.extend(ClassMethods)
    end

    module ClassMethods
      def max_limit
        const_defined?(:MAX_LIMIT) ? const_get(:MAX_LIMIT) : Concerns::CursorPagination::MAX_LIMIT
      end
    end

    private

    def normalize_limit(limit)
      limit = limit.to_i
      [[limit, 1].max, self.class.max_limit].min
    end

    def decode_cursor(cursor, keys: [:created_at, :id])
      return nil if cursor.nil? || cursor.empty?

      parsed = JSON.parse(Base64.urlsafe_decode64(cursor))
      decoded = keys.each_with_object({}) do |key, hash|
        value = parsed[key.to_s]
        hash[key] = %i[created_at published_at].include?(key) ? Time.parse(value) : value
      end
      # Lists compare the id against uuid columns, where a malformed id is a database error rather than no match.
      return nil if decoded.key?(:id) && !UUID_FORMAT.match?(decoded[:id].to_s)

      decoded
    rescue StandardError
      # FALLBACK: Return no cursor when decoding fails.
      nil
    end

    def encode_cursor(data)
      Base64.urlsafe_encode64(JSON.generate(data), padding: false)
    end

    def build_pagination_result(items:, limit:)
      has_more = items.length > limit
      items = items.first(limit) if has_more

      next_cursor = if has_more && items.any?
        yield(items.last)
      end

      { items: items, next_cursor: next_cursor, has_more: has_more }
    end
  end
end
