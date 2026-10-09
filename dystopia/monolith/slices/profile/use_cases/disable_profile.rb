# frozen_string_literal: true

module Profile
  module UseCases
    class DisableProfile
      class NotFoundError < StandardError; end
      class LastEnabledProfileError < StandardError; end

      include Deps["repositories.profile_repository"]

      def call(account_id:, profile_id:)
        profile_repository.locking_account(account_id) do
          profile = profile_repository.find_owned(account_id: account_id, profile_id: profile_id)
          raise NotFoundError, "Profile not found" unless profile
          next profile if profile.disabled_at
          unless profile_repository.other_enabled?(account_id: account_id, profile_id: profile.id)
            raise LastEnabledProfileError, "最後の有効なプロフィールは無効にできません"
          end

          profile_repository.disable(profile.id)
        end
      end
    end
  end
end
