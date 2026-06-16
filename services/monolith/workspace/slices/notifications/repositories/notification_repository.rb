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
