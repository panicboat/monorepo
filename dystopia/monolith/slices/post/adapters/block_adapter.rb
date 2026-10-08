# frozen_string_literal: true

module Post
  module Adapters
    class BlockAdapter
      def blocked_ids(profile_id:)
        block_repo.blocked_ids(account_id: profile_id)
      end

      private

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end
    end
  end
end
