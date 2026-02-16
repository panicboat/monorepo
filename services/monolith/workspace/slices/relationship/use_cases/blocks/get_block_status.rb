# frozen_string_literal: true

module Relationship
  module UseCases
    module Blocks
      class GetBlockStatus
        include Relationship::Deps[block_repo: "repositories.block_repository"]

        def call(user_ids:, blocker_id:)
          block_repo.block_status_batch(user_ids: user_ids, blocker_id: blocker_id)
        end
      end
    end
  end
end
