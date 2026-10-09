# frozen_string_literal: true

module Review
  module UseCases
    class GetMySettings
      include Review::Deps[cast_settings_repo: "repositories.cast_settings_repository"]

      def call(viewer_profile_id:)
        settings = cast_settings_repo.find_by_profile(viewer_profile_id)
        { reviews_visible: settings.nil? || settings.reviews_visible != false }
      end
    end
  end
end
