# frozen_string_literal: true

require "concerns/cursor_pagination"

module Notifications
  module Repositories
    class NotificationRepository < Notifications::DB::Repo
      include Concerns::CursorPagination

      def emit(recipient_id:, type:, target_resource_id:, actor_id:, target_post_id: nil)
        new_id = SecureRandom.uuid_v7
        now = Time.now

        sql = <<~SQL
          INSERT INTO notifications.notifications
            (id, recipient_id, type, target_resource_id, actor_count,
             latest_actor_id, latest_event_at, read_at, created_at, target_post_id)
          VALUES (?, ?, ?, ?, 1, ?, ?, NULL, ?, ?)
          ON CONFLICT (recipient_id, type, target_resource_id) DO UPDATE SET
            actor_count = notifications.notifications.actor_count + 1,
            latest_actor_id = EXCLUDED.latest_actor_id,
            latest_event_at = EXCLUDED.latest_event_at,
            read_at = NULL,
            target_post_id = EXCLUDED.target_post_id
          RETURNING *
        SQL

        ds = notification_records.dataset.db
        result = ds.fetch(sql, new_id, recipient_id, type, target_resource_id, actor_id, now, now, target_post_id).first
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

      def mark_read(id:, recipient_id:)
        updated = notification_records.dataset
          .where(id: id, recipient_id: recipient_id)
          .update(read_at: Time.now)
        updated > 0
      end

      def mark_all_read(recipient_id:)
        notification_records.dataset
          .where(recipient_id: recipient_id, read_at: nil)
          .update(read_at: Time.now)
      end


      PREFERENCE_COLUMNS = %i[
        push_enabled post like repost quote reply follow mention message oshi footprint_unread_badge footprints_record_my_visits
      ].freeze

      def get_preferences(account_id:)
        preference_records.where(account_id: account_id).one
      end

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
            updated_at = EXCLUDED.updated_at
          RETURNING *
        SQL

        ds = preference_records.dataset.db
        ds.fetch(sql, account_id, *values, now, now).first
      end

      def delete_notifications_by_account(account_id)
        notification_records.dataset
          .where(Sequel.|({recipient_id: account_id}, {latest_actor_id: account_id}))
          .delete
      end

      def delete_preferences_by_account(account_id)
        preference_records.dataset.where(account_id: account_id).delete
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
