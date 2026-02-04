# frozen_string_literal: true

module Social
  module Repositories
    class FollowRepository < Social::DB::Repo
      def follow(cast_id:, guest_id:)
        existing = cast_follows.where(cast_id: cast_id, guest_id: guest_id).one
        return false if existing

        cast_follows.changeset(:create, cast_id: cast_id, guest_id: guest_id).commit
        true
      end

      def unfollow(cast_id:, guest_id:)
        deleted = cast_follows.dataset.where(cast_id: cast_id, guest_id: guest_id).delete
        deleted > 0
      end

      def following?(cast_id:, guest_id:)
        cast_follows.where(cast_id: cast_id, guest_id: guest_id).exist?
      end

      def list_following(guest_id:, limit: 100, cursor: nil)
        scope = cast_follows.where(guest_id: guest_id)

        if cursor
          scope = scope.where { created_at < cursor[:created_at] }
        end

        scope.order { created_at.desc }.limit(limit + 1).to_a
      end

      def following_cast_ids(guest_id:)
        cast_follows.dataset
          .where(guest_id: guest_id)
          .select_map(:cast_id)
      end

      def following_status_batch(cast_ids:, guest_id:)
        return {} if cast_ids.empty? || guest_id.nil?

        following_ids = cast_follows.dataset
          .where(cast_id: cast_ids, guest_id: guest_id)
          .select_map(:cast_id)

        cast_ids.each_with_object({}) do |id, hash|
          hash[id] = following_ids.include?(id)
        end
      end
    end
  end
end
