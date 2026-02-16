# frozen_string_literal: true

module Post
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

        include Post::Deps[
          repo: "repositories.post_repository",
          contract: "contracts.save_post_contract"
        ]

        def call(cast_id:, id: nil, content: "", media: [], visibility: "public", hashtags: [])
          validation = contract.call(cast_id: cast_id, id: id, content: content, media: media, visibility: visibility, hashtags: hashtags)
          raise ValidationError, validation.errors unless validation.success?

          if id && !id.empty?
            update_post(cast_id: cast_id, id: id, content: content, media: media, visibility: visibility, hashtags: hashtags)
          else
            create_post(cast_id: cast_id, content: content, media: media, visibility: visibility, hashtags: hashtags)
          end
        end

        private

        def create_post(cast_id:, content:, media:, visibility:, hashtags:)
          post = repo.create_post(cast_id: cast_id, content: content, visibility: visibility)
          repo.save_media(post_id: post.id, media_data: media) if media.any?
          repo.save_hashtags(post_id: post.id, hashtags: hashtags) if hashtags.any?
          repo.find_by_id(post.id)
        end

        def update_post(cast_id:, id:, content:, media:, visibility:, hashtags:)
          existing = repo.find_by_id_and_cast(id: id, cast_id: cast_id)
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless existing

          repo.update_post(id, content: content, visibility: visibility)
          repo.save_media(post_id: id, media_data: media) if media.any?
          repo.save_hashtags(post_id: id, hashtags: hashtags)
          repo.find_by_id(id)
        end
      end
    end
  end
end
