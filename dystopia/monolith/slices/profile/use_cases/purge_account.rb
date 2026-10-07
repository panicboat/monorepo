# frozen_string_literal: true

module Profile
  module UseCases
    class PurgeAccount
      include Profile::Deps[
        profile_repo: "repositories.profile_repository",
        cast_repo: "repositories.cast_repository"
      ]

      def call(account_id:)
        profile_ids = profile_repo.list_by_account(account_id).map(&:id)
        cast_repo.delete_by_profile_ids(profile_ids)
        profile_repo.delete_by_account(account_id)
        nil
      end
    end
  end
end
