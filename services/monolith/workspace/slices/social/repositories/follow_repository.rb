# frozen_string_literal: true

require "concerns/cursor_pagination"

module Social
  module Repositories
    # Symmetric follow repository. follower_id/followee_id are both account_ids.
    # status is "approved" (immediate, default for public targets) or "pending" (private targets).
    class FollowRepository < Social::DB::Repo
      include Concerns::CursorPagination

      # --- Mutations ----

      # Insert or no-op. Returns the resulting status (existing or new).
      # @return [Hash{success: Boolean, status: String, reason: Symbol?}]
      def follow(follower_id:, followee_id:, status:)
        existing = follows.where(follower_id: follower_id, followee_id: followee_id).one
        return { success: false, status: existing.status, reason: :already_exists } if existing

        follows.changeset(:create,
          id: SecureRandom.uuid_v7,
          follower_id: follower_id,
          followee_id: followee_id,
          status: status,
          updated_at: Time.now
        ).commit
        { success: true, status: status }
      end

      def unfollow(follower_id:, followee_id:)
        follows.dataset.where(follower_id: follower_id, followee_id: followee_id).delete > 0
      end

      def approve_all_pending(account_id:)
        follows.dataset
          .where(followee_id: account_id, status: "pending")
          .update(status: "approved", updated_at: Time.now)
      end

      def update_status(follower_id:, followee_id:, status:)
        updated = follows.dataset
          .where(follower_id: follower_id, followee_id: followee_id)
          .update(status: status, updated_at: Time.now)
        updated > 0
      end

      # Delete both directions (used by Block transaction in BlockRepository).
      def remove_bidirectional(account_a:, account_b:)
        follows.dataset
          .where(
            Sequel.|(
              { follower_id: account_a, followee_id: account_b },
              { follower_id: account_b, followee_id: account_a }
            )
          )
          .delete
      end

      # --- Reads ----

      def find(follower_id:, followee_id:)
        follows.where(follower_id: follower_id, followee_id: followee_id).one
      end

      def list_following(account_id:, status: "approved", limit: 20, cursor: nil)
        scope = follows.where(follower_id: account_id, status: status)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_followers(account_id:, status: "approved", limit: 20, cursor: nil)
        scope = follows.where(followee_id: account_id, status: status)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_pending_to(account_id:, limit: 20, cursor: nil)
        list_followers(account_id: account_id, status: "pending", limit: limit, cursor: cursor)
      end

      def count_pending_to(account_id:)
        follows.where(followee_id: account_id, status: "pending").count
      end

      # @return [Hash{target_account_id (String) => status (String)}], missing keys = no row
      def status_batch(follower_id:, followee_ids:)
        return {} if followee_ids.nil? || followee_ids.empty?

        rows = follows.dataset
          .where(follower_id: follower_id, followee_id: followee_ids)
          .select_map([:followee_id, :status])
        rows.each_with_object({}) { |(target, status), h| h[target.to_s] = status }
      end

      # Used by Feed FOLLOWING tab (already exposed since F3).
      def following_account_ids(account_id:)
        follows.dataset
          .where(follower_id: account_id, status: "approved")
          .select_map(:followee_id)
      end

      def count_following(account_id:)
        follows.where(follower_id: account_id, status: "approved").count
      end

      def count_followers(account_id:)
        follows.where(followee_id: account_id, status: "approved").count
      end

      def delete_by_account(account_id)
        follows.dataset
          .where(Sequel.|({follower_id: account_id}, {followee_id: account_id}))
          .delete
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
