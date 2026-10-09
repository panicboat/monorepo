# frozen_string_literal: true

module Review
  module UseCases
    class PurgeProfile
      include Review::Deps[
        entry_repo: "repositories.entry_repository",
        cast_settings_repo: "repositories.cast_settings_repository"
      ]

      def call(profile_id:)
        entry_repo.delete_by_profile(profile_id)
        cast_settings_repo.delete_by_profile(profile_id)
        nil
      end
    end
  end
end
