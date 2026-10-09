# frozen_string_literal: true

module Review
  module UseCases
    class UpdateMySettings
      include Review::Deps[cast_settings_repo: "repositories.cast_settings_repository"]

      def call(viewer_profile_id:, reviews_visible:)
        cast_settings_repo.upsert(profile_id: viewer_profile_id, reviews_visible: reviews_visible)
        { reviews_visible: reviews_visible }
      end
    end
  end
end
