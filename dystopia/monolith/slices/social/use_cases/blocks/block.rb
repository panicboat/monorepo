# frozen_string_literal: true

module Social
  module UseCases
    module Blocks
      class Block
        include Social::Deps[block_repo: "repositories.block_repository"]

        def call(blocker_id:, target_account_id:)
          block_repo.block(blocker_id: blocker_id, blocked_id: target_account_id)
          {}
        end
      end
    end
  end
end
