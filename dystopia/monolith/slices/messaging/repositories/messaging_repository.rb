# frozen_string_literal: true

require "concerns/cursor_pagination"

module Messaging
  module Repositories
    class MessagingRepository < Messaging::DB::Repo
      include ::Concerns::CursorPagination


      # Callers must pass normalized account pairs because the unique constraint uses account_a < account_b.
      def find_thread(id:)
        thread_records.by_pk(id).one
      end

      def find_thread_by_pair(account_a:, account_b:)
        thread_records.where(account_a: account_a, account_b: account_b).one
      end

      def upsert_thread(account_a:, account_b:)
        new_id = SecureRandom.uuid_v7
        now = Time.now

        sql = <<~SQL
          INSERT INTO messaging.threads (id, account_a, account_b, last_message_at, created_at)
          VALUES (?, ?, ?, NULL, ?)
          ON CONFLICT (account_a, account_b) DO UPDATE SET account_a = EXCLUDED.account_a
          RETURNING *
        SQL

        ds = thread_records.dataset.db
        ds.fetch(sql, new_id, account_a, account_b, now).first
      end

      def update_thread_last_message_at(thread_id:, time:)
        thread_records.dataset.where(id: thread_id).update(last_message_at: time)
      end

      def list_threads(account_id:, limit: 20, cursor: nil)
        scope = thread_records.where(
          Sequel.|(
            { account_a: account_id },
            { account_b: account_id }
          )
        )
        scope = apply_thread_cursor(scope, cursor)
        scope.order(Sequel.desc(:last_message_at, nulls: :last), Sequel.desc(:id))
          .limit(limit + 1)
          .to_a
      end


      def insert_message(thread_id:, sender_id:, content:)
        new_id = SecureRandom.uuid_v7
        now = Time.now
        ds = message_records.dataset.db

        ds.transaction do
          ds.fetch(
            "INSERT INTO messaging.messages (id, thread_id, sender_id, content, created_at) " \
              "VALUES (?, ?, ?, ?, ?) RETURNING *",
            new_id, thread_id, sender_id, content, now
          ).first.tap do
            ds.from(Sequel[:messaging][:threads])
              .where(id: thread_id)
              .update(last_message_at: now)
          end
        end
      end

      def list_messages(thread_id:, limit: 50, cursor: nil)
        scope = message_records.where(thread_id: thread_id)
        scope = apply_message_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def last_message(thread_id:)
        message_records.where(thread_id: thread_id)
          .order { [created_at.desc, id.desc] }
          .limit(1)
          .one
      end


      def upsert_read_state(thread_id:, account_id:, last_read_message_id:)
        now = Time.now
        sql = <<~SQL
          INSERT INTO messaging.read_states (thread_id, account_id, last_read_message_id, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (thread_id, account_id) DO UPDATE SET
            last_read_message_id = EXCLUDED.last_read_message_id,
            updated_at = EXCLUDED.updated_at
          RETURNING *
        SQL

        ds = read_state_records.dataset.db
        ds.fetch(sql, thread_id, account_id, last_read_message_id, now).first
      end

      def find_read_state(thread_id:, account_id:)
        read_state_records.where(thread_id: thread_id, account_id: account_id).one
      end


      def unread_count(thread_id:, account_id:)
        rs = find_read_state(thread_id: thread_id, account_id: account_id)
        last_id = rs&.last_read_message_id

        scope = message_records.where(thread_id: thread_id).exclude(sender_id: account_id)
        if last_id
          cutoff_row = message_records.where(id: last_id).one
          if cutoff_row
            scope = scope.where { created_at > cutoff_row.created_at }
          end
        end
        scope.count
      end


      def delete_read_states_by_account(account_id)
        read_state_records.where(account_id: account_id).command(:delete).call
      end

      def null_out_sender(account_id)
        message_records.where(sender_id: account_id).dataset.update(sender_id: nil)
      end

      def null_out_thread_participants(account_id)
        thread_records.where(account_a: account_id).dataset.update(account_a: nil)
        thread_records.where(account_b: account_id).dataset.update(account_b: nil)
      end

      def total_unread_count(account_id:)
        ds = message_records.dataset.db
        sql = <<~SQL
          SELECT COALESCE(SUM(unread), 0)::int AS total FROM (
            SELECT (
              SELECT COUNT(*)
              FROM messaging.messages m
              LEFT JOIN messaging.read_states rs
                ON rs.thread_id = t.id AND rs.account_id = ?
              LEFT JOIN messaging.messages cutoff
                ON cutoff.id = rs.last_read_message_id
              WHERE m.thread_id = t.id
                AND m.sender_id <> ?
                AND (cutoff.created_at IS NULL OR m.created_at > cutoff.created_at)
            ) AS unread
            FROM messaging.threads t
            WHERE t.account_a = ? OR t.account_b = ?
          ) sub
        SQL
        row = ds.fetch(sql, account_id, account_id, account_id, account_id).first
        row ? row[:total].to_i : 0
      end

      private

      def apply_thread_cursor(scope, cursor)
        return scope unless cursor

        decoded = decode_cursor(cursor)
        return scope unless decoded

        cutoff = decoded[:created_at]
        cutoff_id = decoded[:id]
        scope.where {
          (last_message_at < cutoff) |
            ((last_message_at =~ cutoff) & (id < cutoff_id))
        }
      end

      def apply_message_cursor(scope, cursor)
        return scope unless cursor

        decoded = decode_cursor(cursor)
        return scope unless decoded

        scope.where {
          (created_at < decoded[:created_at]) |
            ((created_at =~ decoded[:created_at]) & (id < decoded[:id]))
        }
      end
    end
  end
end
