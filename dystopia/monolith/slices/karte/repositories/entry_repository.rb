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

      def list_by_author(author_account_id:, limit: 20, cursor: nil)
        scope = entry_records.where(author_account_id: author_account_id)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_recent(limit: 20, cursor: nil)
        scope = apply_cursor(entry_records, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def aggregate(target_profile_id:)
        row = entry_records
          .where(target_profile_id: target_profile_id)
          # Remove the relation's implicit ORDER BY because PostgreSQL rejects it with aggregates.
          .dataset
          .unordered
          .select { [count(id).as(:count), avg(rating).as(:avg)] }
          .first
        {
          count: row[:count].to_i,
          avg_rating: row[:avg].nil? ? 0.0 : row[:avg].to_f
        }
      end

      def increment_reported_count(id)
        entry_records.by_pk(id).dataset.update(reported_count: Sequel[:reported_count] + 1)
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
