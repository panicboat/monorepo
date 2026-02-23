# frozen_string_literal: true

module Relationship
  module Repositories
    class BlockRepository < Relationship::DB::Repo
      def block(blocker_id:, blocker_type:, blocked_id:, blocked_type:)
        existing = blocks.where(blocker_id: blocker_id, blocked_id: blocked_id).one
        return false if existing

        blocks.changeset(:create,
          blocker_id: blocker_id,
          blocker_type: blocker_type,
          blocked_id: blocked_id,
          blocked_type: blocked_type
        ).commit
        true
      end

      def unblock(blocker_id:, blocked_id:)
        deleted = blocks.dataset.where(blocker_id: blocker_id, blocked_id: blocked_id).delete
        deleted > 0
      end

      def blocked?(blocker_id:, blocked_id:)
        blocks.where(blocker_id: blocker_id, blocked_id: blocked_id).exist?
      end

      def list_blocked(blocker_id:, limit: 50, cursor: nil)
        scope = blocks.where(blocker_id: blocker_id)

        if cursor
          scope = scope.where { created_at < cursor[:created_at] }
        end

        records = scope.order { created_at.desc }.limit(limit + 1).to_a
        has_more = records.size > limit
        records = records.first(limit) if has_more

        {
          records: records,
          has_more: has_more
        }
      end

      def list_by_blocked_id(blocked_id:, limit: 50)
        blocks.where(blocked_id: blocked_id)
          .order { created_at.desc }
          .limit(limit)
          .to_a
      end

      def blocked_user_ids(blocker_id:)
        blocks.dataset
          .where(blocker_id: blocker_id)
          .select_map(:blocked_id)
      end

      def blocked_cast_ids(blocker_id:)
        blocks.dataset
          .where(blocker_id: blocker_id, blocked_type: "cast")
          .select_map(:blocked_id)
      end

      def blocked_guest_ids(blocker_id:)
        blocks.dataset
          .where(blocker_id: blocker_id, blocked_type: "guest")
          .select_map(:blocked_id)
      end

      def block_status_batch(user_ids:, blocker_id:)
        return {} if user_ids.empty? || blocker_id.nil?

        blocked_ids = blocks.dataset
          .where(blocked_id: user_ids, blocker_id: blocker_id)
          .select_map(:blocked_id)

        user_ids.each_with_object({}) do |id, hash|
          hash[id] = blocked_ids.include?(id)
        end
      end
    end
  end
end
