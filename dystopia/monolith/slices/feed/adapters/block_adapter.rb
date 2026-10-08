# frozen_string_literal: true

module Feed
  module Adapters
    class BlockAdapter
      def bidirectionally_blocked_account_ids(account_id:)
        return [] if account_id.nil? || account_id.to_s.empty?

        block_repo.bidirectionally_blocked_profile_ids(profile_id: account_id)
      end

      private

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end
    end
  end
end
