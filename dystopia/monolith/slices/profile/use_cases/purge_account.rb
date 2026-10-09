# frozen_string_literal: true

module Profile
  module UseCases
    class PurgeAccount
      include Profile::Deps[
        profile_repo: "repositories.profile_repository",
        purge_profile: "use_cases.purge_profile"
      ]

      def call(account_id:)
        profile_repo.list_by_account(account_id).each { |profile| purge_profile.call(profile_id: profile.id) }
        nil
      end
    end
  end
end
