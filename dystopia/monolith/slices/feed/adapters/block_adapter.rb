# frozen_string_literal: true

module Feed
  module Adapters
    # Wraps Social::Repositories::BlockRepository for the feed slice's symmetric
    # block exclusion (bidirectional union). Internal repo dep is the new social
    # schema; legacy cast/guest split is no longer modeled.
    class BlockAdapter
      def bidirectionally_blocked_account_ids(account_id:)
        return [] if account_id.nil? || account_id.to_s.empty?

        block_repo.bidirectionally_blocked_ids(account_id: account_id)
      end

      private

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end
    end
  end
end
