# frozen_string_literal: true

module Profile
  module UseCases
    class PurgeAccount
      include Profile::Deps[profile_repo: "repositories.profile_repository"]

      def call(account_id:)
        profile_repo.delete_profile_areas_by_account(account_id)
        profile_repo.delete_by_account(account_id)
        nil
      end
    end
  end
end
