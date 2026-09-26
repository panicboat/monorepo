# frozen_string_literal: true

module Review
  module Adapters
    class BlockAdapter
      def bidirectionally_blocked_ids(account_id:)
        block_repo.bidirectionally_blocked_ids(account_id: account_id)
      end

      private

      def block_repo
        @block_repo ||= ::Social::Slice["repositories.block_repository"]
      end
    end
  end
end
