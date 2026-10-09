# frozen_string_literal: true

module Profile
  module UseCases
    class EnableProfile
      class NotFoundError < StandardError; end

      include Deps["repositories.profile_repository"]

      def call(account_id:, profile_id:)
        profile_repository.locking_account(account_id) do
          profile = profile_repository.find_owned(account_id: account_id, profile_id: profile_id)
          raise NotFoundError, "Profile not found" unless profile
          next profile unless profile.disabled_at

          profile_repository.enable(profile.id)
        end
      end
    end
  end
end
