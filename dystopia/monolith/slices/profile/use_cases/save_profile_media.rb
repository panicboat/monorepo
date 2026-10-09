# frozen_string_literal: true

module Profile
  module UseCases
    class SaveProfileMedia
      include Deps["repositories.profile_repository"]

      def call(profile_id:, avatar_media_id: nil, cover_media_id: nil)
        return nil unless profile_repository.find_by_id(profile_id)

        profile_repository.save_media(
          profile_id: profile_id,
          avatar_media_id: avatar_media_id,
          cover_media_id: cover_media_id
        )
        profile_repository.find_by_id(profile_id)
      end
    end
  end
end
