# frozen_string_literal: true

module Feed
  module Adapters
    class BlockAdapter
      def bidirectionally_blocked_profile_ids(profile_id:)
        return [] if profile_id.nil? || profile_id.to_s.empty?

        block_repo.bidirectionally_blocked_profile_ids(profile_id: profile_id)
      end

      private

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end
    end
  end
end
