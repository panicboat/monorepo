# frozen_string_literal: true

require "base64"
require "json"

module Concerns
  # Cursor-based pagination concern for UseCases
  #
  # Usage:
  #   class ListPosts
  #     include Concerns::CursorPagination
  #
  #     MAX_LIMIT = 50  # Override default if needed
  #
  #     def call(limit: DEFAULT_LIMIT, cursor: nil)
  #       limit = normalize_limit(limit)
  #       decoded_cursor = decode_cursor(cursor)
  #       # ... fetch data ...
  #       next_cursor = encode_cursor(created_at: last.created_at.iso8601, id: last.id)
  #     end
  #   end
  #
  module CursorPagination
    DEFAULT_LIMIT = 20
    MAX_LIMIT = 100

    def self.included(base)
      base.extend(ClassMethods)
    end

    module ClassMethods
      def max_limit
        const_defined?(:MAX_LIMIT) ? const_get(:MAX_LIMIT) : Concerns::CursorPagination::MAX_LIMIT
      end
    end

    private

    # Normalize limit to be within valid range
    # @param limit [Integer, nil] The requested limit
    # @return [Integer] The normalized limit
    def normalize_limit(limit)
      limit = limit.to_i
      [[limit, 1].max, self.class.max_limit].min
    end

    # Decode a cursor string into a hash
    # @param cursor [String, nil] The Base64-encoded cursor
    # @param keys [Array<Symbol>] The keys to extract from the cursor
    # @return [Hash, nil] The decoded cursor or nil if invalid
    def decode_cursor(cursor, keys: [:created_at, :id])
      return nil if cursor.nil? || cursor.empty?

      parsed = JSON.parse(Base64.urlsafe_decode64(cursor))
      keys.each_with_object({}) do |key, hash|
        value = parsed[key.to_s]
        hash[key] = key == :created_at ? Time.parse(value) : value
      end
    rescue StandardError
      nil
    end

    # Encode a hash into a cursor string
    # @param data [Hash] The data to encode (should include :created_at and :id)
    # @return [String] The Base64-encoded cursor
    def encode_cursor(data)
      Base64.urlsafe_encode64(JSON.generate(data), padding: false)
    end

    # Helper to build pagination result
    # @param items [Array] The fetched items (should include limit + 1 for has_more check)
    # @param limit [Integer] The requested limit
    # @yield [last_item] Block to extract cursor data from the last item
    # @return [Hash] { items:, next_cursor:, has_more: }
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
