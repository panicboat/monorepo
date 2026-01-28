# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Images
        class SaveImages
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          def call(cast_id:, image_path:, images:, avatar_path: nil)
            repo.save_images(id: cast_id, image_path: image_path, images: images, avatar_path: avatar_path)
            repo.find_with_plans(cast_id)
          end
        end
      end
    end
  end
end
