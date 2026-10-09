# frozen_string_literal: true

module Social
  module UseCases
    module Blocks
      class GetBlockStatus
        include Social::Deps[block_repo: "repositories.block_repository"]

        def call(blocker_profile_id:, target_profile_ids:)
          target_profile_ids = (target_profile_ids || []).compact.uniq
          block_repo.status_batch(blocker_profile_id: blocker_profile_id, blocked_profile_ids: target_profile_ids)
        end
      end
    end
  end
end
