# frozen_string_literal: true

module Profile
  module UseCases
    class PurgeAccount
      include Profile::Deps[
        profile_repo: "repositories.profile_repository",
        purge_profile: "use_cases.purge_profile"
      ]

      def call(account_id:)
        profile_repo.locking_account(account_id) do
          profile_repo.list_by_account(account_id).each { |profile| purge_profile.call(profile_id: profile.id) }
        end
        nil
      end
    end
  end
end
