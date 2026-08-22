# frozen_string_literal: true

require "concerns/cursor_pagination"

module Bookmarks
  module Repositories
    class BookmarkRepository < Bookmarks::DB::Repo
      include ::Concerns::CursorPagination

      # Idempotent INSERT. Returns true if a new row was inserted, false if it already existed.
      def bookmark(account_id:, post_id:)
        new_id = SecureRandom.uuid_v7
        now = Time.now

        sql = <<~SQL
          INSERT INTO bookmarks.bookmarks (id, account_id, post_id, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (account_id, post_id) DO NOTHING
          RETURNING id
        SQL

        ds = bookmark_records.dataset.db
        result = ds.fetch(sql, new_id, account_id, post_id, now).first
        !result.nil?
      end

      def unbookmark(account_id:, post_id:)
        deleted = bookmark_records.dataset
          .where(account_id: account_id, post_id: post_id)
          .delete
        deleted > 0
      end

      # Cursor: (created_at, id) DESC
      def list(account_id:, limit: 20, cursor: nil)
        scope = bookmark_records.where(account_id: account_id)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      # @return [Hash{post_id (String) => Boolean}] for ALL inputs, missing => false
      def status_batch(account_id:, post_ids:)
        return {} if post_ids.nil? || post_ids.empty?

        present = bookmark_records.dataset
          .where(account_id: account_id, post_id: post_ids)
          .select_map(:post_id)
          .map(&:to_s)
        post_ids.each_with_object({}) { |id, h| h[id.to_s] = present.include?(id.to_s) }
      end

      def bookmarked?(account_id:, post_id:)
        bookmark_records.where(account_id: account_id, post_id: post_id).exist?
      end

      def delete_by_account(account_id)
        bookmark_records.dataset.where(account_id: account_id).delete
      end

      private

      def apply_cursor(scope, cursor)
        return scope unless cursor

        decoded = decode_cursor(cursor)
        scope.where {
          (created_at < decoded[:created_at]) |
            ((created_at =~ decoded[:created_at]) & (id < decoded[:id]))
        }
      end
    end
  end
end
