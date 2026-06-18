# frozen_string_literal: true

require "concerns/cursor_pagination"

module Notifications
  module Repositories
    # Single-table notification store with built-in aggregation:
    # UPSERT on (recipient_id, type, target_resource_id) increments actor_count and
    # rebumps latest_event_at + clears read_at on each new event.
    class NotificationRepository < Notifications::DB::Repo
      include Concerns::CursorPagination

      # Idempotent emit. Aggregates into existing group row if present, else inserts new.
      # Returns the resulting row.
      def emit(recipient_id:, type:, target_resource_id:, actor_id:)
        new_id = SecureRandom.uuid_v7
        now = Time.now

        sql = <<~SQL
          INSERT INTO notifications.notifications
            (id, recipient_id, type, target_resource_id, actor_count,
             latest_actor_id, latest_event_at, read_at, created_at)
          VALUES (?, ?, ?, ?, 1, ?, ?, NULL, ?)
          ON CONFLICT (recipient_id, type, target_resource_id) DO UPDATE SET
            actor_count = notifications.notifications.actor_count + 1,
            latest_actor_id = EXCLUDED.latest_actor_id,
            latest_event_at = EXCLUDED.latest_event_at,
            read_at = NULL
          RETURNING *
        SQL

        ds = notification_records.dataset.db
        result = ds.fetch(sql, new_id, recipient_id, type, target_resource_id, actor_id, now, now).first
        result
      end

      def list(recipient_id:, limit: 20, cursor: nil)
        scope = notification_records.where(recipient_id: recipient_id)
        scope = apply_cursor(scope, cursor)
        scope.order { [latest_event_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def count_unread(recipient_id:)
        notification_records.where(recipient_id: recipient_id, read_at: nil).count
      end

      # Updates read_at only if the caller is the recipient (defense against cross-account access).
      def mark_read(id:, recipient_id:)
        updated = notification_records.dataset
          .where(id: id, recipient_id: recipient_id)
          .update(read_at: Time.now)
        updated > 0
      end

      # Marks all currently-unread notifications for `recipient_id` as read.
      # Returns the number of rows affected.
      def mark_all_read(recipient_id:)
        notification_records.dataset
          .where(recipient_id: recipient_id, read_at: nil)
          .update(read_at: Time.now)
      end

      # --- Preferences ----

      PREFERENCE_COLUMNS = %i[
        push_enabled post like repost quote reply follow mention message oshi footprint_unread_badge
      ].freeze

      def get_preferences(account_id:)
        preference_records.where(account_id: account_id).one
      end

      # Idempotent upsert. Inserts a new row with the supplied 11 bool attrs, or updates
      # all 11 columns on the existing row keyed by account_id. Returns the resulting row.
      # Column names are double-quoted because `like` and `message` collide with PG reserved words.
      def upsert_preferences(account_id:, attrs:)
        now = Time.now
        values = PREFERENCE_COLUMNS.map { |c| attrs.fetch(c) }
        quoted_cols = PREFERENCE_COLUMNS.map { |c| %("#{c}") }.join(", ")
        update_assignments = PREFERENCE_COLUMNS.map { |c| %("#{c}" = EXCLUDED."#{c}") }.join(", ")

        sql = <<~SQL
          INSERT INTO notifications.preferences
            (account_id, #{quoted_cols}, created_at, updated_at)
          VALUES (?, #{(['?'] * PREFERENCE_COLUMNS.size).join(', ')}, ?, ?)
          ON CONFLICT (account_id) DO UPDATE SET
            #{update_assignments},
            updated_at = EXCLUDED.updated_at
          RETURNING *
        SQL

        ds = preference_records.dataset.db
        ds.fetch(sql, account_id, *values, now, now).first
      end

      private

      def apply_cursor(scope, cursor)
        return scope unless cursor

        decoded = decode_cursor(cursor)
        scope.where {
          (latest_event_at < decoded[:created_at]) |
            ((latest_event_at =~ decoded[:created_at]) & (id < decoded[:id]))
        }
      end
    end
  end
end
