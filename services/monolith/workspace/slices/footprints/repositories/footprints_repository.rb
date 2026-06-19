# frozen_string_literal: true

require "concerns/cursor_pagination"

module Footprints
  module Repositories
    class FootprintsRepository < Footprints::DB::Repo
      include ::Concerns::CursorPagination

      # Idempotent upsert per (visitor_id, visited_id) pair.
      # First visit inserts visit_count = 1; each repeat visit increments it and
      # refreshes last_visited_at + updated_at; first_visited_at stays.
      # Returns row hash with :first_visited_at, :last_visited_at, :visit_count.
      def upsert_visit(visitor_id:, visited_id:)
        new_id = SecureRandom.uuid_v7
        now = Time.now

        sql = <<~SQL
          INSERT INTO footprints.visits
            (id, visitor_id, visited_id, first_visited_at, last_visited_at, visit_count, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT (visitor_id, visited_id) DO UPDATE
            SET last_visited_at = EXCLUDED.last_visited_at,
                updated_at = EXCLUDED.updated_at,
                visit_count = footprints.visits.visit_count + 1
          RETURNING first_visited_at, last_visited_at, visit_count
        SQL

        ds = visit_records.dataset.db
        ds.fetch(sql, new_id, visitor_id, visited_id, now, now, now, now).first
      end

      # Cursor: (last_visited_at, id) DESC.
      # exclude_visitor_ids removes mutually-blocked pairs at read time.
      def list_for_visited(visited_id:, limit: 20, cursor: nil, exclude_visitor_ids: [])
        scope = visit_records.where(visited_id: visited_id)
        scope = scope.exclude(visitor_id: exclude_visitor_ids) if exclude_visitor_ids.any?
        scope = apply_cursor(scope, cursor)
        scope.order { [last_visited_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      # Number of visits with last_visited_at > viewer.last_read_visit_at.
      # If no read_state row exists, last_read_visit_at defaults to nil (= all unread).
      def count_unread(account_id:)
        last_read = read_state_records.where(account_id: account_id).one&.last_read_visit_at
        scope = visit_records.where(visited_id: account_id)
        scope = scope.where { last_visited_at > last_read } if last_read
        scope.count
      end

      def last_read_at(account_id:)
        read_state_records.where(account_id: account_id).one&.last_read_visit_at
      end

      # Upsert read_state row with last_read_visit_at = now(). Returns row hash.
      def set_last_read_now(account_id:)
        now = Time.now

        sql = <<~SQL
          INSERT INTO footprints.read_states
            (account_id, last_read_visit_at, created_at, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (account_id) DO UPDATE
            SET last_read_visit_at = EXCLUDED.last_read_visit_at,
                updated_at = EXCLUDED.updated_at
          RETURNING *
        SQL

        ds = read_state_records.dataset.db
        ds.fetch(sql, account_id, now, now, now).first
      end

      private

      # Cursor is encoded under the :created_at JSON key (Concerns::CursorPagination
      # only Time.parse's that field). Locally, the value represents last_visited_at.
      def apply_cursor(scope, cursor)
        return scope unless cursor

        decoded = decode_cursor(cursor)
        return scope unless decoded

        cutoff = decoded[:created_at]
        cutoff_id = decoded[:id]
        scope.where {
          (last_visited_at < cutoff) |
            ((last_visited_at =~ cutoff) & (id < cutoff_id))
        }
      end
    end
  end
end
