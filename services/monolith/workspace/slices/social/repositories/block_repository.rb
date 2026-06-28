# frozen_string_literal: true

require "concerns/cursor_pagination"

module Social
  module Repositories
    # Symmetric block repository. blocker_id/blocked_id are both account_ids.
    # Block creates a one-way row but the effect is bidirectional (enforced by callers reading
    # bidirectionally_blocked_ids). Block transactionally removes any follows in both directions
    # so the relationship is severed.
    class BlockRepository < Social::DB::Repo
      include Concerns::CursorPagination
      include Social::Deps[follow_repo: "repositories.follow_repository"]

      # --- Mutations ----

      def block(blocker_id:, blocked_id:)
        transaction do
          existing = blocks.where(blocker_id: blocker_id, blocked_id: blocked_id).one
          unless existing
            blocks.changeset(:create,
              id: SecureRandom.uuid_v7,
              blocker_id: blocker_id,
              blocked_id: blocked_id
            ).commit
          end
          follow_repo.remove_bidirectional(account_a: blocker_id, account_b: blocked_id)
        end
        true
      end

      def unblock(blocker_id:, blocked_id:)
        blocks.dataset.where(blocker_id: blocker_id, blocked_id: blocked_id).delete > 0
      end

      # --- Reads ----

      def blocked?(blocker_id:, blocked_id:)
        blocks.where(blocker_id: blocker_id, blocked_id: blocked_id).exist?
      end

      # account_id has blocked these ids
      def blocked_ids(account_id:)
        blocks.dataset.where(blocker_id: account_id).select_map(:blocked_id)
      end

      # These ids have blocked account_id
      def blocker_ids(account_id:)
        blocks.dataset.where(blocked_id: account_id).select_map(:blocker_id)
      end

      # Union: anyone in a bidirectional block with account_id
      def bidirectionally_blocked_ids(account_id:)
        (blocked_ids(account_id: account_id) + blocker_ids(account_id: account_id)).uniq
      end

      def delete_by_account(account_id)
        blocks.dataset
          .where(Sequel.|({blocker_id: account_id}, {blocked_id: account_id}))
          .delete
      end

      # cursor pagination for ListBlocked
      def list_blocked(blocker_id:, limit: 20, cursor: nil)
        scope = blocks.where(blocker_id: blocker_id)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      # @return [Hash{target_account_id (String) => Boolean}]
      def status_batch(blocker_id:, blocked_ids:)
        return {} if blocked_ids.nil? || blocked_ids.empty?

        present = blocks.dataset
          .where(blocker_id: blocker_id, blocked_id: blocked_ids)
          .select_map(:blocked_id)
          .map(&:to_s)
        blocked_ids.each_with_object({}) { |id, h| h[id.to_s] = present.include?(id.to_s) }
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
