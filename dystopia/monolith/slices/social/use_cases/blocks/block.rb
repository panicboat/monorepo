# frozen_string_literal: true

module Social
  module UseCases
    module Blocks
      class Block
        include Social::Deps[block_repo: "repositories.block_repository"]

        def call(blocker_profile_id:, target_profile_id:)
          return {} if blocker_profile_id.to_s == target_profile_id.to_s

          block_repo.block(blocker_profile_id: blocker_profile_id, blocked_profile_id: target_profile_id)
          {}
        end
      end
    end
  end
end
