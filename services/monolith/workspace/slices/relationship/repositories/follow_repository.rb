# frozen_string_literal: true

module Relationship
  module Repositories
    class FollowRepository < Relationship::DB::Repo
      def follow(cast_user_id:, guest_user_id:, status: "approved")
        existing = follows.where(cast_user_id: cast_user_id, guest_user_id: guest_user_id).one
        return { success: false, reason: :already_exists, status: existing.status } if existing

        follows.changeset(:create, cast_user_id: cast_user_id, guest_user_id: guest_user_id, status: status).commit
        { success: true, status: status }
      end

      def request_follow(cast_user_id:, guest_user_id:)
        follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id, status: "pending")
      end

      def approve_follow(cast_user_id:, guest_user_id:)
        record = follows.where(cast_user_id: cast_user_id, guest_user_id: guest_user_id).one
        return false unless record
        return true if record.status == "approved"

        follows.dataset
          .where(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
          .update(status: "approved")
        true
      end

      def reject_follow(cast_user_id:, guest_user_id:)
        deleted = follows.dataset
          .where(cast_user_id: cast_user_id, guest_user_id: guest_user_id, status: "pending")
          .delete
        deleted > 0
      end

      def approve_all_pending(cast_user_id:)
        follows.dataset
          .where(cast_user_id: cast_user_id, status: "pending")
          .update(status: "approved")
      end

      def list_pending_requests(cast_user_id:, limit: 100, cursor: nil)
        scope = follows.where(cast_user_id: cast_user_id, status: "pending")

        if cursor
          scope = scope.where { created_at < cursor[:created_at] }
        end

        records = scope.order { created_at.desc }.limit(limit + 1).to_a
        has_more = records.size > limit
        records = records.first(limit) if has_more

        {
          requests: records,
          has_more: has_more
        }
      end

      def pending_count(cast_user_id:)
        follows.where(cast_user_id: cast_user_id, status: "pending").count
      end

      def unfollow(cast_user_id:, guest_user_id:)
        deleted = follows.dataset.where(cast_user_id: cast_user_id, guest_user_id: guest_user_id).delete
        deleted > 0
      end

      def following?(cast_user_id:, guest_user_id:)
        follows.where(cast_user_id: cast_user_id, guest_user_id: guest_user_id, status: "approved").exist?
      end

      def follow_status(cast_user_id:, guest_user_id:)
        record = follows.where(cast_user_id: cast_user_id, guest_user_id: guest_user_id).one
        return nil unless record

        record.status
      end

      def list_following(guest_user_id:, limit: 100, cursor: nil)
        scope = follows.where(guest_user_id: guest_user_id, status: "approved")

        if cursor
          scope = scope.where { created_at < cursor[:created_at] }
        end

        records = scope.order { created_at.desc }.limit(limit + 1).to_a
        has_more = records.size > limit
        records = records.first(limit) if has_more

        {
          cast_user_ids: records.map(&:cast_user_id),
          has_more: has_more
        }
      end

      def following_cast_user_ids(guest_user_id:)
        follows.dataset
          .where(guest_user_id: guest_user_id, status: "approved")
          .select_map(:cast_user_id)
      end

      def following_status_batch(cast_user_ids:, guest_user_id:)
        return {} if cast_user_ids.empty? || guest_user_id.nil?

        records = follows.dataset
          .where(cast_user_id: cast_user_ids, guest_user_id: guest_user_id)
          .select(:cast_user_id, :status)
          .to_a

        status_map = records.each_with_object({}) { |r, h| h[r[:cast_user_id]] = r[:status] }

        cast_user_ids.each_with_object({}) do |id, hash|
          hash[id] = status_map[id] || "none"
        end
      end

      def get_follow_detail(cast_user_id:, guest_user_id:)
        record = follows.where(cast_user_id: cast_user_id, guest_user_id: guest_user_id, status: "approved").one
        return { is_following: false, followed_at: nil } unless record

        { is_following: true, followed_at: record.created_at }
      end

      def list_followers(cast_user_id:, blocked_guest_user_ids: [], limit: 20, cursor: nil)
        scope = follows.where(cast_user_id: cast_user_id, status: "approved")

        scope = scope.where { Sequel.~(guest_user_id: blocked_guest_user_ids) } if blocked_guest_user_ids.any?

        if cursor
          scope = scope.where { created_at < cursor[:created_at] }
        end

        total = scope.count
        records = scope.order { created_at.desc }.limit(limit + 1).to_a
        has_more = records.size > limit
        records = records.first(limit) if has_more

        {
          followers: records,
          total: total,
          has_more: has_more
        }
      end
    end
  end
end
