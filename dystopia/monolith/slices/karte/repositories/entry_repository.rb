# frozen_string_literal: true

require "concerns/cursor_pagination"

module Karte
  module Repositories
    class EntryRepository < Karte::DB::Repo
      include ::Concerns::CursorPagination

      def create(author_account_id:, author_profile_id:, target_profile_id:, rating: nil, body: nil, status: "open", closed_at: nil)
        entry_records.command(:create).call(
          id: SecureRandom.uuid_v7,
          author_account_id: author_account_id,
          author_profile_id: author_profile_id,
          target_profile_id: target_profile_id,
          rating: rating,
          body: body,
          status: status,
          closed_at: closed_at
        )
      end

      def find_by_id(id)
        entry_records.by_pk(id).one
      end

      def update(id, attrs)
        entry_records.by_pk(id).dataset.update(attrs.merge(updated_at: Sequel.function(:clock_timestamp)))
        find_by_id(id)
      end

      def locking_entry(id)
        transaction(savepoint: true) do
          scope = entry_records.by_pk(id)
          record = scope.dataset.for_update.first
          yield(record ? scope.one : nil)
        end
      end

      def delete(id)
        entry_records.by_pk(id).command(:delete).call
      end

      def list_by_target(target_profile_id:, limit: 20, cursor: nil)
        scope = entry_records.where(target_profile_id: target_profile_id)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_by_author(author_account_id:, limit: 20, cursor: nil, status: nil)
        scope = entry_records.where(author_account_id: author_account_id)
        scope = scope.where(status: status) if status
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_recent(limit: 20, cursor: nil)
        scope = apply_cursor(entry_records, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def aggregate(target_profile_id:)
        scope = entry_records.where(target_profile_id: target_profile_id).dataset.unordered
        accounts = scope.where(status: "closed").exclude(rating: nil)
          .group(:author_account_id).select { [author_account_id, avg(rating).as(:account_average), count(id).as(:rated_count)] }
        row = scope.db.from(accounts.as(:rated_accounts))
          .select { [avg(account_average).as(:average), count(author_account_id).as(:authors), sum(rated_count).as(:rated)] }.first
        {
          count: scope.count,
          avg_rating: row[:average]&.to_f,
          author_count: row[:authors].to_i,
          rated_count: row[:rated].to_i
        }
      end

      def counts_by_author(author_account_id:)
        counts = entry_records.where(author_account_id: author_account_id).dataset.unordered.group(:status).select { [status, count(id).as(:count)] }.all.to_h { |row| [row[:status], row[:count]] }
        opened = counts.fetch("open", 0)
        closed = counts.fetch("closed", 0)
        {total: opened + closed, open: opened, closed: closed}
      end

      def increment_reported_count(id)
        entry_records.by_pk(id).dataset.update(reported_count: Sequel[:reported_count] + 1)
      end

      private

      def apply_cursor(scope, cursor)
        return scope unless cursor

        decoded = decode_cursor(cursor)
        # FALLBACK: Malformed cursors follow the concern's initial-page behavior.
        return scope unless decoded
        scope.where {
          (created_at < decoded[:created_at]) |
            ((created_at =~ decoded[:created_at]) & (id < decoded[:id]))
        }
      end
    end
  end
end
