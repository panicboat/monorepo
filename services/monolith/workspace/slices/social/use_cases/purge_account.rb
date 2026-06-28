# frozen_string_literal: true

module Social
  module UseCases
    class PurgeAccount
      include Social::Deps[
        follow_repo: "repositories.follow_repository",
        block_repo: "repositories.block_repository"
      ]

      def call(account_id:)
        follow_repo.delete_by_account(account_id)
        block_repo.delete_by_account(account_id)
        nil
      end
    end
  end
end
