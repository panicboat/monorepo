# frozen_string_literal: true

module Post
  module Adapters
    # Cross-slice block view from Post slice. Backed by the new social schema
    # (symmetric model). The legacy "blocked_guest" / "blocker_cast" semantics
    # are preserved at the public API level but the underlying queries are
    # type-agnostic — returns all blocked / all blockers regardless of legacy
    # cast/guest classification.
    class BlockAdapter
      def blocked_guest_ids(blocker_id:)
        block_repo.blocked_ids(account_id: blocker_id)
      end

      def cast_blocked_guest?(cast_user_id:, guest_user_id:)
        block_repo.blocked?(blocker_id: cast_user_id, blocked_id: guest_user_id)
      end

      def blocked_by_cast_ids(guest_user_id:)
        block_repo.blocker_ids(account_id: guest_user_id)
      end

      private

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end
    end
  end
end
