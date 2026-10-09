# frozen_string_literal: true

module Profile
  module UseCases
    class DisableProfile
      class NotFoundError < StandardError; end
      class LastEnabledProfileError < StandardError; end

      include Deps["repositories.profile_repository"]

      def call(account_id:, profile_id:)
        profile = profile_repository.find_owned(account_id: account_id, profile_id: profile_id)
        raise NotFoundError, "Profile not found" unless profile
        return profile if profile.disabled_at

        disabled = profile_repository.disable_unless_last_enabled(account_id: account_id, profile_id: profile.id)
        raise LastEnabledProfileError, "最後の有効なプロフィールは無効にできません" unless disabled

        disabled
      end
    end
  end
end
