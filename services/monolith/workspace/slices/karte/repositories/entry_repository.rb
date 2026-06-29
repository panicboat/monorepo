# frozen_string_literal: true

require "concerns/cursor_pagination"

module Karte
  module Repositories
    class EntryRepository < Karte::DB::Repo
      include ::Concerns::CursorPagination

      def create(author_account_id:, target_account_id:, rating:, body:)
        entry_records.command(:create).call(
          id: SecureRandom.uuid_v7,
          author_account_id: author_account_id,
          target_account_id: target_account_id,
          rating: rating,
          body: body
        )
      end

      def find_by_id(id)
        entry_records.by_pk(id).one
      end

      def update(id, attrs)
        entry_records.by_pk(id).command(:update).call(attrs.merge(updated_at: Time.now))
      end

      def delete(id)
        entry_records.by_pk(id).command(:delete).call
      end

      def list_by_target(target_account_id:, limit: 20, cursor: nil)
        scope = entry_records.where(target_account_id: target_account_id)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_by_author(author_account_id:, limit: 20, cursor: nil)
        scope = entry_records.where(author_account_id: author_account_id)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def aggregate(target_account_id:)
        # .unordered strips the relation's implicit ORDER BY id that ROM
        # carries from the schema's primary_key. Without it, the aggregate
        # query becomes SELECT count(id), avg(rating) ... ORDER BY id, and
        # Postgres rejects it with PG::GroupingError because id is not
        # grouped on or wrapped in an aggregate.
        row = entry_records
          .where(target_account_id: target_account_id)
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
