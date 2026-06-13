# frozen_string_literal: true

module Feed
  module Adapters
    class BlockAdapter
      def blocked_guest_ids(blocker_id:)
        block_repo.blocked_guest_ids(blocker_id: blocker_id)
      end

      def blocker_cast_ids_for_guest(guest_user_id:)
        block_repo.blocker_ids_for_blocked(blocked_id: guest_user_id, blocker_type: "cast")
      end

      # Symmetric: returns union of accounts that this account blocked AND accounts that blocked this account.
      # Used by feed slice to hide posts in both directions.
      def bidirectionally_blocked_account_ids(account_id:)
        return [] if account_id.nil? || account_id.to_s.empty?

        outgoing = block_repo.blocked_user_ids(blocker_id: account_id)
        incoming = block_repo.blocker_ids_of(blocked_id: account_id)
        (outgoing + incoming).uniq
      end

      private

      def block_repo
        @block_repo ||= Relationship::Slice["repositories.block_repository"]
      end
    end
  end
end
