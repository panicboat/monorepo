# frozen_string_literal: true

module Social
  module Repositories
    class FollowRepository < Social::DB::Repo
      def follow(cast_id:, guest_id:, status: "approved")
        existing = cast_follows.where(cast_id: cast_id, guest_id: guest_id).one
        return { success: false, reason: :already_exists, status: existing.status } if existing

        cast_follows.changeset(:create, cast_id: cast_id, guest_id: guest_id, status: status).commit
        { success: true, status: status }
      end

      def request_follow(cast_id:, guest_id:)
        follow(cast_id: cast_id, guest_id: guest_id, status: "pending")
      end

      def approve_follow(cast_id:, guest_id:)
        record = cast_follows.where(cast_id: cast_id, guest_id: guest_id).one
        return false unless record
        return true if record.status == "approved"

        cast_follows.dataset
          .where(cast_id: cast_id, guest_id: guest_id)
          .update(status: "approved")
        true
      end

      def reject_follow(cast_id:, guest_id:)
        deleted = cast_follows.dataset
          .where(cast_id: cast_id, guest_id: guest_id, status: "pending")
          .delete
        deleted > 0
      end

      def approve_all_pending(cast_id:)
        cast_follows.dataset
          .where(cast_id: cast_id, status: "pending")
          .update(status: "approved")
      end

      def list_pending_requests(cast_id:, limit: 100, cursor: nil)
        scope = cast_follows.where(cast_id: cast_id, status: "pending")

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

      def pending_count(cast_id:)
        cast_follows.where(cast_id: cast_id, status: "pending").count
      end

      def unfollow(cast_id:, guest_id:)
        deleted = cast_follows.dataset.where(cast_id: cast_id, guest_id: guest_id).delete
        deleted > 0
      end

      def following?(cast_id:, guest_id:)
        cast_follows.where(cast_id: cast_id, guest_id: guest_id, status: "approved").exist?
      end

      def follow_status(cast_id:, guest_id:)
        record = cast_follows.where(cast_id: cast_id, guest_id: guest_id).one
        return nil unless record

        record.status
      end

      def list_following(guest_id:, limit: 100, cursor: nil)
        scope = cast_follows.where(guest_id: guest_id, status: "approved")

        if cursor
          scope = scope.where { created_at < cursor[:created_at] }
        end

        records = scope.order { created_at.desc }.limit(limit + 1).to_a
        has_more = records.size > limit
        records = records.first(limit) if has_more

        {
          cast_ids: records.map(&:cast_id),
          has_more: has_more
        }
      end

      def following_cast_ids(guest_id:)
        cast_follows.dataset
          .where(guest_id: guest_id, status: "approved")
          .select_map(:cast_id)
      end

      def following_status_batch(cast_ids:, guest_id:)
        return {} if cast_ids.empty? || guest_id.nil?

        records = cast_follows.dataset
          .where(cast_id: cast_ids, guest_id: guest_id)
          .select(:cast_id, :status)
          .to_a

        status_map = records.each_with_object({}) { |r, h| h[r[:cast_id]] = r[:status] }

        cast_ids.each_with_object({}) do |id, hash|
          hash[id] = status_map[id] || "none"
        end
      end

      def get_follow_detail(cast_id:, guest_id:)
      record = cast_follows.where(cast_id: cast_id, guest_id: guest_id, status: "approved").one
      return { is_following: false, followed_at: nil } unless record

      { is_following: true, followed_at: record.created_at }
    end

    def list_followers(cast_id:, blocked_guest_ids: [], limit: 20, cursor: nil)
        scope = cast_follows.where(cast_id: cast_id, status: "approved")

        scope = scope.where { Sequel.~(guest_id: blocked_guest_ids) } if blocked_guest_ids.any?

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
