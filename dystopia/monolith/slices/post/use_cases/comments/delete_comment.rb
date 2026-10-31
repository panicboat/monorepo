# frozen_string_literal: true

module Post
  module UseCases
    module Comments
      class DeleteComment
        include Post::Deps[
          comment_repo: "repositories.comment_repository",
          discard_detached_media: "use_cases.discard_detached_media"
        ]

        def call(comment_id:, author_profile_id:)
          result = comment_repo.delete_comment(id: comment_id, author_profile_id: author_profile_id)
          raise CommentNotFoundOrUnauthorizedError unless result

          discard_detached_media.call(ids: result[:media_ids])
          { post_id: result[:post_id] }
        end

        class CommentNotFoundOrUnauthorizedError < StandardError; end
      end
    end
  end
end
