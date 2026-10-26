# frozen_string_literal: true

module Profile
  module UseCases
    class SaveProfileMedia
      include Deps["repositories.profile_repository", media_adapter: "adapters.media_adapter"]

      def call(profile_id:, avatar_media_id: nil, cover_media_id: nil)
        return nil unless profile_repository.find_by_id(profile_id)
        unless media_adapter.owned_all?(profile_id: profile_id, ids: [avatar_media_id, cover_media_id])
          raise Errors::ValidationError, "設定できない画像が含まれています"
        end

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
