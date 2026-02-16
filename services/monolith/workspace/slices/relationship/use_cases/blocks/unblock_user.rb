# frozen_string_literal: true

module Relationship
  module UseCases
    module Blocks
      class UnblockUser
        include Relationship::Deps[block_repo: "repositories.block_repository"]

        def call(blocker_id:, blocked_id:)
          block_repo.unblock(blocker_id: blocker_id, blocked_id: blocked_id)
          { success: true }
        end
      end
    end
  end
end
