# frozen_string_literal: true

require "concerns/cursor_pagination"

module Review
  module Repositories
    class EntryRepository < Review::DB::Repo
      include ::Concerns::CursorPagination

      def create(author_profile_id:, target_profile_id:, rating:, body:)
        entry_records.command(:create).call(
          id: SecureRandom.uuid_v7,
          author_profile_id: author_profile_id,
          target_profile_id: target_profile_id,
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

      def delete_by_profile(profile_id)
        entry_records.dataset
          .where(Sequel.|({ author_profile_id: profile_id }, { target_profile_id: profile_id }))
          .delete
      end

      def list_by_target(target_profile_id:, limit: 20, cursor: nil)
        scope = entry_records.where(target_profile_id: target_profile_id)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_by_author(author_profile_id:, limit: 20, cursor: nil)
        scope = entry_records.where(author_profile_id: author_profile_id)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_recent(limit: 20, cursor: nil)
        scope = apply_cursor(entry_records, cursor)
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
