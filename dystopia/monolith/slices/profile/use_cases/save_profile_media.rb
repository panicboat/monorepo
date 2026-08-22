# frozen_string_literal: true

module Profile
  module UseCases
    class SaveProfileMedia
      include Deps["repositories.profile_repository"]

      def call(account_id:, avatar_media_id: nil, cover_media_id: nil)
        profile_repository.save_media(
          account_id: account_id,
          avatar_media_id: avatar_media_id,
          cover_media_id: cover_media_id
        )
        profile_repository.find_by_account_id(account_id)
      end
    end
  end
end
