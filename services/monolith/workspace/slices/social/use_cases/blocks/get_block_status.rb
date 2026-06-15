# frozen_string_literal: true

module Social
  module UseCases
    module Blocks
      class GetBlockStatus
        include Social::Deps[block_repo: "repositories.block_repository"]

        def call(blocker_id:, target_account_ids:)
          target_account_ids = (target_account_ids || []).compact.uniq
          block_repo.status_batch(blocker_id: blocker_id, blocked_ids: target_account_ids)
        end
      end
    end
  end
end
