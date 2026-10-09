# frozen_string_literal: true

module Profile
  module UseCases
    class DeleteProfile
      class NotFoundError < StandardError; end
      class NotDisabledError < StandardError; end

      include Deps["repositories.profile_repository", purge_profile: "use_cases.purge_profile"]

      def call(account_id:, profile_id:)
        profile = profile_repository.find_owned(account_id: account_id, profile_id: profile_id)
        raise NotFoundError, "Profile not found" unless profile
        raise NotDisabledError, "有効なプロフィールは削除できません。先に無効にしてください" unless profile.disabled_at

        purge_profile.call(profile_id: profile.id)
        nil
      end
    end
  end
end
