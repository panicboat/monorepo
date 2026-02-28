# frozen_string_literal: true

module Post
  module UseCases
    module Posts
      class DeletePost
        include Post::Deps[repo: "repositories.post_repository"]

        def call(cast_user_id:, post_id:)
          post = repo.find_by_id_and_cast(id: post_id, cast_user_id: cast_user_id)
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless post

          repo.delete_post(post_id)
        end
      end
    end
  end
end
