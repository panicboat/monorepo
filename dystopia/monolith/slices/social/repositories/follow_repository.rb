# frozen_string_literal: true

require "concerns/cursor_pagination"

module Social
  module Repositories
    class FollowRepository < Social::DB::Repo
      include Concerns::CursorPagination


      def follow(follower_profile_id:, followee_profile_id:, status:)
        existing = follows.where(follower_profile_id: follower_profile_id, followee_profile_id: followee_profile_id).one
        return { success: false, status: existing.status, reason: :already_exists } if existing

        follows.changeset(:create,
          id: SecureRandom.uuid_v7,
          follower_profile_id: follower_profile_id,
          followee_profile_id: followee_profile_id,
          status: status,
          updated_at: Time.now
        ).commit
        { success: true, status: status }
      end

      def unfollow(follower_profile_id:, followee_profile_id:)
        follows.dataset.where(follower_profile_id: follower_profile_id, followee_profile_id: followee_profile_id).delete > 0
      end

      def approve_all_pending(profile_id:)
        follows.dataset
          .where(followee_profile_id: profile_id, status: "pending")
          .update(status: "approved", updated_at: Time.now)
      end

      def update_status(follower_profile_id:, followee_profile_id:, status:)
        updated = follows.dataset
          .where(follower_profile_id: follower_profile_id, followee_profile_id: followee_profile_id)
          .update(status: status, updated_at: Time.now)
        updated > 0
      end

      def remove_bidirectional(profile_a:, profile_b:)
        follows.dataset
          .where(
            Sequel.|(
              { follower_profile_id: profile_a, followee_profile_id: profile_b },
              { follower_profile_id: profile_b, followee_profile_id: profile_a }
            )
          )
          .delete
      end


      def find(follower_profile_id:, followee_profile_id:)
        follows.where(follower_profile_id: follower_profile_id, followee_profile_id: followee_profile_id).one
      end

      def list_following(profile_id:, status: "approved", limit: 20, cursor: nil)
        scope = follows.where(follower_profile_id: profile_id, status: status)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_followers(profile_id:, status: "approved", limit: 20, cursor: nil)
        scope = follows.where(followee_profile_id: profile_id, status: status)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_pending_to(profile_id:, limit: 20, cursor: nil)
        list_followers(profile_id: profile_id, status: "pending", limit: limit, cursor: cursor)
      end

      def pending_requester_ids(profile_id:)
        follows.where(followee_profile_id: profile_id, status: "pending").pluck(:follower_profile_id)
      end

      def status_batch(follower_profile_id:, followee_profile_ids:)
        return {} if followee_profile_ids.nil? || followee_profile_ids.empty?

        rows = follows.dataset
          .where(follower_profile_id: follower_profile_id, followee_profile_id: followee_profile_ids)
          .select_map([:followee_profile_id, :status])
        rows.each_with_object({}) { |(target, status), h| h[target.to_s] = status }
      end

      def following_profile_ids(profile_id:)
        follows.dataset
          .where(follower_profile_id: profile_id, status: "approved")
          .select_map(:followee_profile_id)
      end

      def count_following(profile_id:)
        follows.where(follower_profile_id: profile_id, status: "approved").count
      end

      def count_followers(profile_id:)
        follows.where(followee_profile_id: profile_id, status: "approved").count
      end

      def delete_by_profile(profile_id)
        follows.dataset
          .where(Sequel.|({follower_profile_id: profile_id}, {followee_profile_id: profile_id}))
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
