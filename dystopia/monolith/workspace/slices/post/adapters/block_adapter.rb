# frozen_string_literal: true

module Post
  module Adapters
    # Cross-slice block view from Post slice. Wraps the new social schema's
    # block repository. Used by Post::Grpc::Handler#get_blocked_user_ids to
    # exclude blocked accounts from comment hydration.
    class BlockAdapter
      def blocked_ids(account_id:)
        block_repo.blocked_ids(account_id: account_id)
      end

      private

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end
    end
  end
end
