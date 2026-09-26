# frozen_string_literal: true

require "concerns/cursor_pagination"

module Review
  module Repositories
    class EntryRepository < Review::DB::Repo
      include ::Concerns::CursorPagination

      def create(author_account_id:, target_account_id:, rating:, body:)
        entry_records.command(:create).call(
          id: SecureRandom.uuid_v7,
          author_account_id: author_account_id,
          target_account_id: target_account_id,
          rating: rating,
          body: body,
          hidden: false
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
