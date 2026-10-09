# frozen_string_literal: true

require "concerns/cursor_pagination"

module Social
  module Repositories
    class BlockRepository < Social::DB::Repo
      include Concerns::CursorPagination
      include Social::Deps[follow_repo: "repositories.follow_repository"]


      def block(blocker_profile_id:, blocked_profile_id:)
        transaction do
          existing = blocks.where(blocker_profile_id: blocker_profile_id, blocked_profile_id: blocked_profile_id).one
          unless existing
            blocks.changeset(:create,
              id: SecureRandom.uuid_v7,
              blocker_profile_id: blocker_profile_id,
              blocked_profile_id: blocked_profile_id
            ).commit
          end
          follow_repo.remove_bidirectional(profile_a: blocker_profile_id, profile_b: blocked_profile_id)
        end
        true
      end

      def unblock(blocker_profile_id:, blocked_profile_id:)
        blocks.dataset.where(blocker_profile_id: blocker_profile_id, blocked_profile_id: blocked_profile_id).delete > 0
      end


      def blocked?(blocker_profile_id:, blocked_profile_id:)
        blocks.where(blocker_profile_id: blocker_profile_id, blocked_profile_id: blocked_profile_id).exist?
      end

      def blocked_profile_ids(profile_id:)
        blocks.dataset.where(blocker_profile_id: profile_id).select_map(:blocked_profile_id)
      end

      def blocker_profile_ids(profile_id:)
        blocks.dataset.where(blocked_profile_id: profile_id).select_map(:blocker_profile_id)
      end

      def bidirectionally_blocked_profile_ids(profile_id:)
        (blocked_profile_ids(profile_id: profile_id) + blocker_profile_ids(profile_id: profile_id)).uniq
      end

      def delete_by_profile(profile_id)
        blocks.dataset
          .where(Sequel.|({blocker_profile_id: profile_id}, {blocked_profile_id: profile_id}))
          .delete
      end

      def list_blocked(blocker_profile_id:, limit: 20, cursor: nil)
        scope = blocks.where(blocker_profile_id: blocker_profile_id)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def status_batch(blocker_profile_id:, blocked_profile_ids:)
        return {} if blocked_profile_ids.nil? || blocked_profile_ids.empty?

        present = blocks.dataset
          .where(blocker_profile_id: blocker_profile_id, blocked_profile_id: blocked_profile_ids)
          .select_map(:blocked_profile_id)
          .map(&:to_s)
        blocked_profile_ids.each_with_object({}) { |id, h| h[id.to_s] = present.include?(id.to_s) }
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
