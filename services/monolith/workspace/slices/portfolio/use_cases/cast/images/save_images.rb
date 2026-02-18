# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Images
        class SaveImages
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          def call(cast_id:, profile_media_id:, gallery_media_ids:, avatar_media_id: nil)
            repo.save_images(
              id: cast_id,
              profile_media_id: profile_media_id,
              gallery_media_ids: gallery_media_ids,
              avatar_media_id: avatar_media_id
            )
            repo.find_with_plans(cast_id)
          end
        end
      end
    end
  end
end
