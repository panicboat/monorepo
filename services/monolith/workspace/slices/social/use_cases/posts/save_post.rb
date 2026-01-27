# frozen_string_literal: true

module Social
  module UseCases
    module Posts
      class SavePost
        class ValidationError < StandardError
          attr_reader :errors

          def initialize(errors)
            @errors = errors
            super(errors.to_h.to_s)
          end
        end

        include Social::Deps[
          repo: "repositories.post_repository",
          contract: "contracts.save_post_contract"
        ]

        def call(cast_id:, id: nil, content: "", media: [], visible: true)
          validation = contract.call(cast_id: cast_id, id: id, content: content, media: media, visible: visible)
          raise ValidationError, validation.errors unless validation.success?

          if id && !id.empty?
            update_post(cast_id: cast_id, id: id, content: content, media: media, visible: visible)
          else
            create_post(cast_id: cast_id, content: content, media: media, visible: visible)
          end
        end

        private

        def create_post(cast_id:, content:, media:, visible:)
          post = repo.create_post(cast_id: cast_id, content: content, visible: visible)
          repo.save_media(post_id: post.id, media_data: media) if media.any?
          repo.find_by_id(post.id)
        end

        def update_post(cast_id:, id:, content:, media:, visible:)
          existing = repo.find_by_id_and_cast(id: id, cast_id: cast_id)
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless existing

          repo.update_post(id, content: content, visible: visible)
          repo.save_media(post_id: id, media_data: media) if media.any?
          repo.find_by_id(id)
        end
      end
    end
  end
end
